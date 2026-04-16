import { createServer } from "http";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { bundleManager } from "./app/lib/BundleManager";
import { getDisplayConfigs, ensureDisplayId, setDisplayConfigs, DisplayConfig } from "./app/lib/displayState";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT ?? "3000", 10);
const hostname = process.env.HOST ?? "0.0.0.0";

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
}

interface CycleSlide {
    slide: string;
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
    displayCycleIndex[displayId] = displayCycleSlides[displayId].findIndex((s) => s.slide === initial.slide);
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
        const currentIdx = displayCycleSlides[displayId].findIndex((s) => s.slide === currentActive.slide);
        displayCycleIndex[displayId] = currentIdx < 0 ? 0 : (currentIdx + 1) % displayCycleSlides[displayId].length;
        const nextEntry = displayCycleSlides[displayId][displayCycleIndex[displayId]];
        const nextDelay = resolveSlideDuration(nextEntry, displayCycleBaseDuration[displayId]);
        displayStates[displayId] = { bundle, slide: nextEntry.slide, duration: nextDelay };
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

const app = next({ dev, turbopack: dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const httpServer = createServer((req, res) => {
        handle(req, res);
    });

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
                    const currentActive = displayStates[targetId];
                    const keepCurrent = currentActive?.bundle === bundle && slides.some((s) => s.slide === currentActive.slide);
                    if (!keepCurrent) {
                        const first = slides[0];
                        displayStates[targetId] = { bundle, slide: first.slide, duration: resolveSlideDuration(first, duration) };
                        if (io) {
                            io.to(displayRoom(targetId)).emit("slide:show", enrichSlideData(displayStates[targetId]!));
                        }
                    }
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
                        uniqueConfigs.push({ id, name: config.name || `Display ${id}` });
                    }
                }
                displayConfigs = uniqueConfigs.length > 0 ? uniqueConfigs : [{ id: "1", name: "Display 1" }];
                setDisplayConfigs(displayConfigs);
                normalizeDisplayKeys();
                emitAdminState();
                emitDisplayStatesToAll();
            });
        }
    });

    httpServer.listen(port, hostname, () => {
        console.log(`> Ready on http://${hostname}:${port} [${dev ? "dev" : "production"}]`);
    });
});
