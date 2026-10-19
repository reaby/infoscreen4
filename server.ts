import "./app/lib/nodeVersionCheck"; // must stay first: exits on a too-old Node.js before anything else loads
import { createServer as createHttpServer, IncomingMessage, ServerResponse } from "http";
import { createServer as createHttpsServer } from "https";
import { readFileSync, existsSync } from "fs";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { bundleManager } from "./app/lib/BundleManager";
import { getDisplayConfigs, ensureDisplayId, setDisplayConfigs, DisplayConfig } from "./app/lib/displayState";
import { resolveTransition, TransitionConfig } from "./app/lib/transitions";
import { setContentChangedListener } from "./app/lib/contentEvents";
import { isAllowedOrigin, resolveSocketIdentity, SocketRole } from "./app/lib/socketAuth";
import { CLIENT_ADDRESS_HEADER } from "./app/lib/clientAddress";
import { getAllUsers } from "./app/lib/auth";
import { getOrCreateSetupCode } from "./app/lib/setupCode";
import { resolveServerTlsFiles } from "./app/lib/tlsFiles";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT ?? "3000", 10);
const hostname = process.env.HOST ?? "0.0.0.0";

const tls = resolveServerTlsFiles();
const useHttps = existsSync(tls.key) && existsSync(tls.cert);

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
    displayQueuedNext: Record<string, string | null>;
    displayAnnouncements: Record<string, { line1: string; line2: string; color: string } | null>;
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
const displayQueuedNext: Record<string, string | null> = {};
let io: SocketIOServer | null = null;

// Lower-third announcements
interface DisplayAnnouncement {
    line1: string;
    line2: string;
    color: string;
}
const displayAnnouncements: Record<string, DisplayAnnouncement | null> = {};

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
const streamOwners = new Map<string, string>();         // streamId → username of the streamer

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
        displayQueuedNext: { ...displayQueuedNext },
        displayAnnouncements: { ...displayAnnouncements },
        streams: [...streams.values()],
    };
}

interface EnrichedSlide extends ActiveSlide {
    json?: object | null;
    bundleMeta?: unknown;
    transition?: TransitionConfig;
}

function resolveSlideTransition(bundle: string, slideId: string): TransitionConfig {
    const meta = bundleManager.getMeta(bundle);
    const entry = meta.slides?.find((s) => s.id === slideId);
    return resolveTransition(entry?.transition, meta.defaultTransition);
}

function enrichSlideData(slide: ActiveSlide): EnrichedSlide {
    return {
        ...slide,
        json: bundleManager.getSlideJson(slide.bundle, slide.slide),
        bundleMeta: bundleManager.getMeta(slide.bundle),
        transition: resolveSlideTransition(slide.bundle, slide.slide),
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
            delete displayQueuedNext[key];
        }
    }
    for (const key of Object.keys(displayAnnouncements)) {
        if (!validIds.has(key)) delete displayAnnouncements[key];
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

// The active bundle is restored on server start, so it follows whatever bundle is put on air.
function persistActiveBundle(displayId: string, bundle: string) {
    const confIndex = displayConfigs.findIndex((c) => c.id === displayId);
    if (confIndex === -1 || displayConfigs[confIndex].activeBundle === bundle) return;
    displayConfigs[confIndex] = { ...displayConfigs[confIndex], activeBundle: bundle };
    setDisplayConfigs(displayConfigs);
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
        const queuedId = displayQueuedNext[displayId];
        let nextIdx = currentIdx < 0 ? 0 : (currentIdx + 1) % displayCycleSlides[displayId].length;
        if (queuedId) {
            const queuedIdx = displayCycleSlides[displayId].findIndex((s) => s.id === queuedId);
            if (queuedIdx >= 0) nextIdx = queuedIdx;
            displayQueuedNext[displayId] = null;
        }
        displayCycleIndex[displayId] = nextIdx;
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

function emitStreamIncoming(displayId: string, stream: StreamInfo) {
    io?.to(displayRoom(displayId)).emit("stream:incoming", {
        streamId: stream.streamId,
        streamName: stream.name,
        streamSocketId: stream.socketId,
    });
}

/** A stream moved to a new streamer socket; displays showing it reconnect to the new one. */
function reannounceStreamToDisplays(stream: StreamInfo) {
    for (const [displayId, streamId] of displayActiveStream.entries()) {
        if (streamId === stream.streamId) emitStreamIncoming(displayId, stream);
    }
}

function cleanupStream(streamId: string, streamerSocketId: string) {
    streams.delete(streamId);
    streamOwners.delete(streamId);
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

/** Admins may preview any stream; a display may only watch the stream assigned to it. */
function canWatchStream(role: SocketRole, displayId: string, streamId: string): boolean {
    if (role === "admin") return true;
    if (role === "display") return displayActiveStream.get(displayId) === streamId;
    return false;
}

/** Signals may only flow between a streamer and a viewer watching that streamer's stream. */
function canSignal(fromSocketId: string, toSocketId: string): boolean {
    const watchedStreamId = socketToWatchedStream.get(fromSocketId);
    if (watchedStreamId && streams.get(watchedStreamId)?.socketId === toSocketId) return true;

    const ownStreamId = socketToStream.get(fromSocketId);
    return !!ownStreamId && socketToWatchedStream.get(toSocketId) === ownStreamId;
}

const app = next({ dev, turbopack: dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const handleWithClientAddress = (req: IncomingMessage, res: ServerResponse) => {
        req.headers[CLIENT_ADDRESS_HEADER] = req.socket.remoteAddress ?? "unknown";
        return handle(req, res);
    };

    const httpServer = useHttps
        ? createHttpsServer(
              { key: readFileSync(tls.key), cert: readFileSync(tls.cert) },
              handleWithClientAddress
          )
        : createHttpServer(handleWithClientAddress);

    io = new SocketIOServer(httpServer, {
        allowRequest: (req, callback) => callback(null, isAllowedOrigin(req)),
    });

    io.use(async (socket, next) => {
        const identity = await resolveSocketIdentity(socket);
        if (!identity) return next(new Error("unauthorized"));
        socket.data.role = identity.role;
        socket.data.username = identity.username;
        next();
    });

    setContentChangedListener(() => io?.to("admins").emit("content:changed"));

    io.on("connection", (socket) => {
        const role: SocketRole = socket.data.role;
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

            const announcement = displayAnnouncements[displayId];
            if (announcement) {
                socket.emit("announce:show", announcement);
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
                displayQueuedNext[targetId] = null;
                persistActiveBundle(targetId, data.bundle);
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
                displayQueuedNext[targetId] = null;
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

            socket.on("cycle:queueNext", (data: { displayId: string; slideId: string | null }) => {
                const targetId = ensureDisplayId(data.displayId);
                displayQueuedNext[targetId] = data.slideId ?? null;
                emitAdminState();
            });

            socket.on("announce:show", (data: { displayId: string; line1: string; line2: string; color: string }) => {
                const targetId = ensureDisplayId(data.displayId);
                const payload: DisplayAnnouncement = {
                    line1: data.line1 ?? "",
                    line2: data.line2 ?? "",
                    color: data.color || "#d32f2f",
                };
                displayAnnouncements[targetId] = payload;
                io?.to(displayRoom(targetId)).emit("announce:show", payload);
                emitAdminState();
            });

            socket.on("announce:showAll", (data: { line1: string; line2: string; color: string }) => {
                const payload: DisplayAnnouncement = {
                    line1: data.line1 ?? "",
                    line2: data.line2 ?? "",
                    color: data.color || "#d32f2f",
                };
                for (const conf of displayConfigs) {
                    displayAnnouncements[conf.id] = payload;
                }
                io?.to("displays").emit("announce:show", payload);
                emitAdminState();
            });

            socket.on("announce:clearAll", () => {
                for (const conf of displayConfigs) {
                    displayAnnouncements[conf.id] = null;
                }
                io?.to("displays").emit("announce:clear");
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

                displayQueuedNext[targetId] = null;
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

                persistActiveBundle(targetId, bundle);
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
                const existing = streams.get(data.streamId);
                const isTakeover = !!existing && existing.socketId !== socket.id;
                if (isTakeover) {
                    // Only the stream's own user may take it over — a streamer that reconnected
                    // before the server noticed its old connection dropped.
                    if (streamOwners.get(data.streamId) !== socket.data.username) return;
                    socketToStream.delete(existing.socketId);
                }
                // A socket owns one stream; drop its previous one instead of orphaning it.
                const previousStreamId = socketToStream.get(socket.id);
                if (previousStreamId && previousStreamId !== data.streamId) cleanupStream(previousStreamId, socket.id);
                const info: StreamInfo = { streamId: data.streamId, name: data.name, socketId: socket.id };
                streams.set(data.streamId, info);
                streamOwners.set(data.streamId, socket.data.username);
                socketToStream.set(socket.id, data.streamId);
                if (isTakeover) reannounceStreamToDisplays(info);
                emitAdminStreams();
            });

            socket.on("stream:unregister", (data: { streamId: string }) => {
                if (streams.get(data.streamId)?.socketId !== socket.id) return;
                cleanupStream(data.streamId, socket.id);
            });

            socket.on("disconnect", () => {
                const streamId = socketToStream.get(socket.id);
                if (streamId) cleanupStream(streamId, socket.id);
            });
        }

        // Signal relay between a streamer and its viewers
        socket.on("stream:watch", (data: { streamId: string }) => {
            const stream = streams.get(data.streamId);
            if (!stream) return;
            if (!canWatchStream(role, displayId, data.streamId)) return;

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
            if (typeof data?.to !== "string" || !canSignal(socket.id, data.to)) return;
            io?.to(data.to).emit("stream:signal", { from: socket.id, data: data.data });
        });

        if (role === "admin") {
            socket.on("stream:show", (data: { streamId: string; displayId: string }) => {
                const stream = streams.get(data.streamId);
                if (!stream) return;
                const targetId = ensureDisplayId(data.displayId);
                displayActiveStream.set(targetId, data.streamId);
                emitStreamIncoming(targetId, stream);
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
            console.log(`> To enable HTTPS, run "pnpm run gen-cert" (creates ${tls.cert} + ${tls.key}) and restart.`);
        }

        getAllUsers().then((users) => {
            if (users.length === 0) getOrCreateSetupCode();
        });

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
