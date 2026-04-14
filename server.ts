import { createServer } from "http";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { bundleManager } from "./app/lib/BundleManager";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT ?? "3000", 10);

// Shared server state
interface ActiveSlide {
    bundle: string;
    slide: string;
    duration: number; // seconds, <=0 = manual
}

interface ServerState {
    activeSlide: ActiveSlide | null;
    activeBundle: string | null;
    connectedDisplays: number;
    isCycling: boolean;
}

interface CycleSlide {
    slide: string;
    duration?: number;
}

let activeSlide: ActiveSlide | null = null;
let activeBundle: string | null = null;
let connectedDisplays = 0;

// Slide cycling state
let cycleTimer: ReturnType<typeof setTimeout> | null = null;
let cycleSlides: CycleSlide[] = [];
let cycleIndex = 0;
let cycleBaseDuration = 10;

function getServerState(): ServerState {
    return {
        activeSlide,
        activeBundle,
        connectedDisplays,
        isCycling: cycleTimer !== null,
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

function stopCycle() {
    if (cycleTimer) { clearTimeout(cycleTimer); cycleTimer = null; }
}

const app = next({ dev, turbopack: dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const httpServer = createServer((req, res) => {
        handle(req, res);
    });

    const io = new SocketIOServer(httpServer, {
        cors: { origin: "*" },
    });

    function startCycle(initial: ActiveSlide) {
        stopCycle();
        activeBundle = initial.bundle;
        cycleBaseDuration = initial.duration;
        if (cycleBaseDuration <= 0) return;
        cycleSlides = getBundleSlides(initial.bundle);
        cycleIndex = cycleSlides.findIndex((s) => s.slide === initial.slide);
        if (cycleIndex < 0) cycleIndex = 0;

        const initialEntry = cycleSlides[cycleIndex];
        const initialDelay = resolveSlideDuration(initialEntry, cycleBaseDuration);
        if (activeSlide) {
            activeSlide = { ...activeSlide, duration: initialDelay };
            io.emit("state:sync", getServerState());
        }
        if (initialDelay <= 0) return;

        const tick = () => {
            if (!activeSlide) return;
            const currentActive = activeSlide;
            const bundle = activeBundle ?? activeSlide.bundle;
            // Re-read active slides on each tick so admin changes take effect immediately
            cycleSlides = getBundleSlides(bundle);
            if (cycleSlides.length === 0) return;
            // Find where the current slide sits in the (possibly refreshed) list, then advance
            const currentIdx = currentActive.bundle === bundle
                ? cycleSlides.findIndex((s) => s.slide === currentActive.slide)
                : -1;
            cycleIndex = currentIdx < 0 ? 0 : (currentIdx + 1) % cycleSlides.length;
            const nextEntry = cycleSlides[cycleIndex];
            const nextDelay = resolveSlideDuration(nextEntry, cycleBaseDuration);
            activeSlide = { bundle, slide: nextEntry.slide, duration: nextDelay };
            io.emit("slide:show", activeSlide);
            io.emit("state:sync", getServerState());
            if (nextDelay <= 0) {
                stopCycle();
                io.emit("state:sync", getServerState());
                return;
            }
            cycleTimer = setTimeout(tick, nextDelay * 1000);
        };
        cycleTimer = setTimeout(tick, initialDelay * 1000);
    }

    io.on("connection", (socket) => {
        const role: string = (socket.handshake.query.role as string) ?? "unknown";

        if (role === "display") {
            connectedDisplays++;
            io.emit("displays:count", connectedDisplays);
            io.emit("state:sync", getServerState());

            // Send current slide immediately on connect
            if (activeSlide) {
                socket.emit("slide:show", activeSlide);
            }

            socket.on("disconnect", () => {
                connectedDisplays--;
                io.emit("displays:count", connectedDisplays);
                io.emit("state:sync", getServerState());
            });
        }

        if (role === "admin") {
            // Send current state to newly connected admin
            socket.emit("state:sync", getServerState());

            // Admin commands
            socket.on("slide:show", (data: ActiveSlide) => {
                activeSlide = data;
                activeBundle = data.bundle;
                io.emit("slide:show", activeSlide);
                startCycle(data);
                io.emit("state:sync", getServerState());
            });

            socket.on("slide:clear", () => {
                stopCycle();
                activeSlide = null;
                io.emit("slide:clear");
                io.emit("state:sync", getServerState());
            });

            socket.on("cycle:stop", () => {
                stopCycle();
                // Keep activeSlide — display stays on current slide
                io.emit("state:sync", getServerState());
            });

            socket.on("bundle:meta", (data: { bundle: string; meta: Record<string, unknown> }) => {
                if (activeSlide && activeSlide.bundle === data.bundle) {
                    const currentActive = activeSlide;
                    cycleSlides = getBundleSlides(data.bundle);
                    if (cycleSlides.length === 0) {
                        stopCycle();
                    } else {
                        const idx = cycleSlides.findIndex((s) => s.slide === currentActive.slide);
                        if (idx < 0) {
                            cycleIndex = 0;
                            const first = cycleSlides[0];
                            activeSlide = {
                                ...activeSlide,
                                slide: first.slide,
                                duration: resolveSlideDuration(first, cycleBaseDuration),
                            };
                            io.emit("slide:show", activeSlide);
                        } else {
                            cycleIndex = idx;
                            const current = cycleSlides[idx];
                            activeSlide = {
                                ...activeSlide,
                                duration: resolveSlideDuration(current, cycleBaseDuration),
                            };
                        }
                    }
                }
                io.emit("bundle:meta", data);
                io.emit("state:sync", getServerState());
            });

            socket.on("bundle:activate", (data: { bundle: string }) => {
                const bundle = data?.bundle;
                if (typeof bundle !== "string" || !bundle) return;
                activeBundle = bundle;

                const slides = getBundleSlides(bundle);
                if (slides.length > 0) {
                    const duration = cycleBaseDuration > 0 ? cycleBaseDuration : (activeSlide?.duration ?? 10);
                    const currentActive = activeSlide;
                    const keepCurrent = currentActive?.bundle === bundle && slides.some((s) => s.slide === currentActive.slide);
                    if (!keepCurrent) {
                        const first = slides[0];
                        activeSlide = { bundle, slide: first.slide, duration: resolveSlideDuration(first, duration) };
                        io.emit("slide:show", activeSlide);
                    }
                }

                io.emit("state:sync", getServerState());
            });
        }
    });

    httpServer.listen(port, () => {
        console.log(`> Ready on http://localhost:${port} [${dev ? "dev" : "production"}]`);
    });
});
