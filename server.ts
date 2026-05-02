import { createServer as createHttpServer } from "http";
import { createServer as createHttpsServer } from "https";
import { readFileSync, existsSync } from "fs";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { bundleManager } from "./app/lib/BundleManager";
import { getDisplayConfigs, ensureDisplayId, setDisplayConfigs, DisplayConfig } from "./app/lib/displayState";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT ?? "3000", 10);
const hostname = process.env.HOST ?? "0.0.0.0";

const sslKey = process.env.SSL_KEY ?? "key.pem";
const sslCert = process.env.SSL_CERT ?? "cert.pem";
const useHttps = existsSync(sslKey) && existsSync(sslCert);

// Shared server state
interface ActiveSlide {
    bundle: string;
    slide: string;
    duration: number; // seconds, <=0 = manual
}

interface ServerState {
    activeSlide: ActiveSlide | null;
    connectedDisplays: number;
    isCycling: boolean;
    displayConfigs: DisplayConfig[];
    displayStates: Record<string, ActiveSlide | null>;
    displayConnections: Record<string, number>;
    displayCycling: Record<string, boolean>;
    streams: StreamInfo[];
}

interface CycleSlide {
    id: string;
    duration?: number;
}

let connectedDisplays = 0;
let displayConfigs: DisplayConfig[] = getDisplayConfigs();
const displayStates: Record<string, ActiveSlide | null> = {};
const displayConnections: Record<string, number> = {};
const displayCycleTimers: Record<string, ReturnType<typeof setTimeout> | null> = {};
const displayCycleSlides: Record<string, CycleSlide[]> = {};
const displayCycleIndex: Record<string, number> = {};
const displayCycleBaseDuration: Record<string, number> = {};
let io: SocketIOServer | null = null;

// WebRTC streaming state
interface StreamInfo {
    streamId: string;
    name: string;
    socketId: string;
}
const streams = new Map<string, StreamInfo>();          // streamId → info
const socketToStream = new Map<string, string>();       // socketId → streamId
const displayActiveStream = new Map<string, string>();  // displayId → streamId
const socketToWatchedStream = new Map<string, string>(); // viewerSocketId → streamId

function emitAdminStreams() {
    if (!io) return;
    io.to("admins").emit("streams:update", [...streams.values()]);
}

function getServerState(): ServerState {
    return {
        activeSlide: null,
        connectedDisplays,
        isCycling: Object.values(displayCycleTimers).some((timer) => timer !== null),
        displayConfigs,
        displayStates: { ...displayStates },
        displayConnections: { ...displayConnections },
        displayCycling: Object.fromEntries(
            Object.entries(displayCycleTimers).map(([displayId, timer]) => [displayId, timer !== null])
        ),
        streams: [...streams.values()],
    };
}

interface EnrichedSlide extends ActiveSlide {
    json?: object | null;
    bundleMeta?: unknown;
}

function enrichSlideData(slide: ActiveSlide): EnrichedSlide {
    return {
        ...slide,
        json: bundleManager.getSlideJson(slide.bundle, slide.slide),
        bundleMeta: bundleManager.getMeta(slide.bundle),
    };
}

function getBundleSlides(bundle: string): CycleSlide[] {
    return bundleManager.getOrderedSlides(bundle, { activeOnly: true });
}

function resolveSlideDuration(slide: CycleSlide | undefined, fallbackDuration: number): number {
    const override = slide?.duration;
    if (typeof override === "number" && Number.isFinite(override) && override >= 0) return override;
    return fallbackDuration;
}

function displayRoom(displayId: string) {
    return `display:${displayId}`;
}

function normalizeDisplayKeys() {
    const validIds = new Set(displayConfigs.map((conf) => conf.id));
    for (const key of Object.keys(displayStates)) {
        if (!validIds.has(key)) {
            delete displayStates[key];
        }
    }
    for (const key of Object.keys(displayConnections)) {
        if (!validIds.has(key)) {
            delete displayConnections[key];
        }
    }
    for (const key of Object.keys(displayCycleTimers)) {
        if (!validIds.has(key)) {
            if (displayCycleTimers[key]) clearTimeout(displayCycleTimers[key]!);
            delete displayCycleTimers[key];
            delete displayCycleSlides[key];
            delete displayCycleIndex[key];
            delete displayCycleBaseDuration[key];
        }
    }
    for (const conf of displayConfigs) {
        if (!(conf.id in displayStates)) displayStates[conf.id] = null;
        if (!(conf.id in displayConnections)) displayConnections[conf.id] = 0;
        if (!(conf.id in displayCycleTimers)) displayCycleTimers[conf.id] = null;
    }
}

function emitAdminState() {
    if (!io) return;
    io.to("admins").emit("state:sync", getServerState());
}

function emitDisplayState(displayId: string) {
    if (!io) return;
    io.to(displayRoom(displayId)).emit("display:state:sync", {
        activeSlide: displayStates[displayId] ?? null,
        connectedDisplays,
        isCycling: displayCycleTimers[displayId] !== null,
        displayConfigs,
        displayStates: { [displayId]: displayStates[displayId] ?? null },
        displayConnections: { [displayId]: displayConnections[displayId] ?? 0 },
    });
}

function emitDisplayStatesToAll() {
    for (const conf of displayConfigs) {
        emitDisplayState(conf.id);
    }
}

function stopCycle(displayId: string) {
    const timer = displayCycleTimers[displayId];
    if (timer) {
        clearTimeout(timer);
        displayCycleTimers[displayId] = null;
    }
}

function startCycle(displayId: string, initial: ActiveSlide) {
    stopCycle(displayId);
    if (initial.duration <= 0) return;

    displayCycleBaseDuration[displayId] = initial.duration;
    displayCycleSlides[displayId] = getBundleSlides(initial.bundle);
    displayCycleIndex[displayId] = displayCycleSlides[displayId].findIndex((s) => s.id === initial.slide);
    if (displayCycleIndex[displayId] < 0) displayCycleIndex[displayId] = 0;

    const initialEntry = displayCycleSlides[displayId][displayCycleIndex[displayId]];
    const initialDelay = resolveSlideDuration(initialEntry, displayCycleBaseDuration[displayId]);
    if (displayStates[displayId]) {
        displayStates[displayId] = { ...displayStates[displayId]!, duration: initialDelay };
        if (io) {
            io.to(displayRoom(displayId)).emit("slide:show", enrichSlideData(displayStates[displayId]!));
        }
    }
    emitAdminState();
    if (initialDelay <= 0) return;

    const tick = () => {
        if (!displayStates[displayId]) return;
        const currentActive = displayStates[displayId]!;
        const bundle = currentActive.bundle;
        displayCycleSlides[displayId] = getBundleSlides(bundle);
        if (displayCycleSlides[displayId].length === 0) return;
        const currentIdx = displayCycleSlides[displayId].findIndex((s) => s.id === currentActive.slide);
        displayCycleIndex[displayId] = currentIdx < 0 ? 0 : (currentIdx + 1) % displayCycleSlides[displayId].length;
        const nextEntry = displayCycleSlides[displayId][displayCycleIndex[displayId]];
        const nextDelay = resolveSlideDuration(nextEntry, displayCycleBaseDuration[displayId]);
        displayStates[displayId] = { bundle, slide: nextEntry.id, duration: nextDelay };
        if (io) {
            io.to(displayRoom(displayId)).emit("slide:show", enrichSlideData(displayStates[displayId]));
        }
        emitAdminState();
        if (nextDelay <= 0) {
            stopCycle(displayId);
            emitAdminState();
            return;
        }
        displayCycleTimers[displayId] = setTimeout(tick, nextDelay * 1000);
    };
    displayCycleTimers[displayId] = setTimeout(tick, initialDelay * 1000);
}

function cleanupStream(streamId: string, streamerSocketId: string) {
    streams.delete(streamId);
    socketToStream.delete(streamerSocketId);
    for (const [viewerSocketId, watchedStreamId] of socketToWatchedStream.entries()) {
        if (watchedStreamId === streamId) {
            socketToWatchedStream.delete(viewerSocketId);
        }
    }
    // Notify all displays showing this stream
    for (const [displayId, sid] of displayActiveStream.entries()) {
        if (sid === streamId) {
            displayActiveStream.delete(displayId);
            io?.to(displayRoom(displayId)).emit("stream:cleared");
        }
    }
    io?.emit("stream:ended", { streamId });
    emitAdminStreams();
}

const app = next({ dev, turbopack: dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const httpServer = useHttps
        ? createHttpsServer(
              { key: readFileSync(sslKey), cert: readFileSync(sslCert) },
              (req, res) => handle(req, res)
          )
        : createHttpServer((req, res) => handle(req, res));

    io = new SocketIOServer(httpServer, {
        cors: { origin: "*" },
    });

    io.on("connection", (socket) => {
        const role: string = (socket.handshake.query.role as string) ?? "unknown";
        const requestedDisplayId = (socket.handshake.query.displayId as string) ?? "1";
        const displayId = ensureDisplayId(requestedDisplayId);

        if (role === "display") {
            socket.join(displayRoom(displayId));
            socket.join("displays");
            displayConnections[displayId] = (displayConnections[displayId] ?? 0) + 1;
            connectedDisplays++;
            emitAdminState();
            emitDisplayState(displayId);

            if (displayStates[displayId]) {
                socket.emit("slide:show", enrichSlideData(displayStates[displayId]!));
            }

            const activeStreamId = displayActiveStream.get(displayId);
            if (activeStreamId) {
                const stream = streams.get(activeStreamId);
                if (stream) {
                    socket.emit("stream:incoming", {
                        streamId: stream.streamId,
                        streamName: stream.name,
                        streamSocketId: stream.socketId,
                    });
                } else {
                    displayActiveStream.delete(displayId);
                }
            }

            socket.on("disconnect", () => {
                displayConnections[displayId] = Math.max(0, (displayConnections[displayId] ?? 1) - 1);
                connectedDisplays = Math.max(0, connectedDisplays - 1);
                emitAdminState();
            });
        }

        if (role === "admin") {
            socket.join("admins");
            socket.emit("state:sync", getServerState());

            socket.on("slide:show", (data: ActiveSlide & { displayId: string }) => {
                const targetId = ensureDisplayId(data.displayId);
                displayStates[targetId] = { bundle: data.bundle, slide: data.slide, duration: data.duration };
                if (io) {
                    io.to(displayRoom(targetId)).emit("slide:show", enrichSlideData(displayStates[targetId]!));
                }
                startCycle(targetId, displayStates[targetId]!);
                emitAdminState();
            });

            socket.on("slide:clear", (data: { displayId: string }) => {
                const targetId = ensureDisplayId(data.displayId);
                stopCycle(targetId);
                displayStates[targetId] = null;
                if (io) {
                    io.to(displayRoom(targetId)).emit("slide:clear");
                }
                emitAdminState();
            });

            socket.on("cycle:stop", (data: { displayId: string }) => {
                const targetId = ensureDisplayId(data.displayId);
                stopCycle(targetId);
                emitAdminState();
            });

            socket.on("bundle:meta", (data: { bundle: string; meta: Record<string, unknown>; displayId?: string }) => {
                if (io) {
                    io.emit("bundle:meta", { bundle: data.bundle, meta: data.meta });
                }
                emitAdminState();
            });

            socket.on("bundle:activate", (data: { bundle: string; displayId: string }) => {
                const targetId = ensureDisplayId(data.displayId);
                const bundle = data?.bundle;
                if (typeof bundle !== "string" || !bundle) return;

                const slides = getBundleSlides(bundle);
                if (slides.length > 0) {
                    const duration = displayStates[targetId]?.duration ?? 10;
                    const first = slides[0];
                    displayStates[targetId] = { bundle, slide: first.id, duration: resolveSlideDuration(first, duration) };
                    if (io) {
                        io.to(displayRoom(targetId)).emit("slide:show", enrichSlideData(displayStates[targetId]!));
                    }
                    startCycle(targetId, displayStates[targetId]!);
                }

                const confIndex = displayConfigs.findIndex(c => c.id === targetId);
                if (confIndex !== -1) {
                    displayConfigs[confIndex] = { ...displayConfigs[confIndex], activeBundle: bundle };
                    setDisplayConfigs(displayConfigs);
                }

                emitAdminState();
            });

            socket.on("display:config", (data: { configs: DisplayConfig[] }) => {
                const uniqueConfigs: DisplayConfig[] = [];
                const seenIds = new Set<string>();
                for (const config of data.configs) {
                    const id = config.id.trim() || `display-${uniqueConfigs.length + 1}`;
                    if (!seenIds.has(id)) {
                        seenIds.add(id);

                        // Preserve existing activeBundle if available
                        const existing = displayConfigs.find(c => c.id === id);
                        uniqueConfigs.push({
                            id,
                            name: config.name || `Display ${id}`,
                            activeBundle: existing?.activeBundle
                        });
                    }
                }
                displayConfigs = uniqueConfigs.length > 0 ? uniqueConfigs : [{ id: "1", name: "Display 1" }];
                setDisplayConfigs(displayConfigs);
                normalizeDisplayKeys();
                emitAdminState();
                emitDisplayStatesToAll();
            });
        }

        // --- WebRTC streaming signaling ---
        if (role === "streamer") {
            socket.on("stream:register", (data: { streamId: string; name: string }) => {
                const info: StreamInfo = { streamId: data.streamId, name: data.name, socketId: socket.id };
                streams.set(data.streamId, info);
                socketToStream.set(socket.id, data.streamId);
                emitAdminStreams();
            });

            socket.on("stream:unregister", (data: { streamId: string }) => {
                cleanupStream(data.streamId, socket.id);
            });

            socket.on("disconnect", () => {
                const streamId = socketToStream.get(socket.id);
                if (streamId) cleanupStream(streamId, socket.id);
            });
        }

        // Signal relay — any role can send/receive signals
        socket.on("stream:watch", (data: { streamId: string }) => {
            const stream = streams.get(data.streamId);
            if (!stream) return;

            const previousStreamId = socketToWatchedStream.get(socket.id);
            if (previousStreamId && previousStreamId !== data.streamId) {
                const previousStream = streams.get(previousStreamId);
                if (previousStream) {
                    io?.to(previousStream.socketId).emit("stream:viewer:left", { viewerSocketId: socket.id });
                }
            }

            socketToWatchedStream.set(socket.id, data.streamId);
            io?.to(stream.socketId).emit("stream:viewer:joined", { viewerSocketId: socket.id });
        });

        socket.on("stream:unwatch", (data: { streamId: string }) => {
            const stream = streams.get(data.streamId);
            const watchedStreamId = socketToWatchedStream.get(socket.id);
            if (watchedStreamId === data.streamId) {
                socketToWatchedStream.delete(socket.id);
            }
            if (!stream) return;
            io?.to(stream.socketId).emit("stream:viewer:left", { viewerSocketId: socket.id });
        });

        socket.on("stream:signal", (data: { to: string; data: unknown }) => {
            io?.to(data.to).emit("stream:signal", { from: socket.id, data: data.data });
        });

        if (role === "admin") {
            socket.on("stream:show", (data: { streamId: string; displayId: string }) => {
                const stream = streams.get(data.streamId);
                if (!stream) return;
                const targetId = ensureDisplayId(data.displayId);
                displayActiveStream.set(targetId, data.streamId);
                io?.to(displayRoom(targetId)).emit("stream:incoming", {
                    streamId: stream.streamId,
                    streamName: stream.name,
                    streamSocketId: stream.socketId,
                });
            });

            socket.on("stream:clear", (data: { displayId: string }) => {
                const targetId = ensureDisplayId(data.displayId);
                displayActiveStream.delete(targetId);
                io?.to(displayRoom(targetId)).emit("stream:cleared");
            });
        }

        socket.on("disconnect", () => {
            const watchedStreamId = socketToWatchedStream.get(socket.id);
            if (!watchedStreamId) return;
            socketToWatchedStream.delete(socket.id);
            const stream = streams.get(watchedStreamId);
            if (stream) {
                io?.to(stream.socketId).emit("stream:viewer:left", { viewerSocketId: socket.id });
            }
        });
    });

    httpServer.listen(port, hostname, () => {
        const proto = useHttps ? "https" : "http";
        console.log(`> Ready on ${proto}://${hostname}:${port} [${dev ? "dev" : "production"}]`);
        if (!useHttps) {
            console.log(`> Running HTTP only — WebRTC screen/camera capture requires HTTPS on non-localhost origins.`);
            console.log(`> To enable HTTPS, generate key.pem + cert.pem in the project root (see README).`);
        }

        // Boot active bundles for all displays
        for (const config of displayConfigs) {
            if (config.activeBundle) {
                const slides = getBundleSlides(config.activeBundle);
                if (slides.length > 0) {
                    const first = slides[0];
                    const state = { bundle: config.activeBundle, slide: first.id, duration: resolveSlideDuration(first, 10) };
                    displayStates[config.id] = state;
                    startCycle(config.id, state);
                }
            }
        }
    });
});
