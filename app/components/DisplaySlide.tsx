"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import * as fabric from "fabric";
import { BundleMeta, BundleSlideEntry } from "../interfaces/BundleMeta";
import "./fabricEnv"; // side-effect: frees the memory of elements Fabric disposes
import { FabricVideo } from "./FabricVideo"; // also registers FabricVideo in classRegistry
import ManagedVideo from "./ManagedVideo";
import { disposeObjectsOnRemove, loadFabricJsonSafely } from "./fabricLoadHelpers";
import { preloadFabricFonts, refreshTextMetrics } from "./fabricFonts";
import { useFontRegistry } from "../hooks/useFontRegistry";
import { loadFontsIntoDocument } from "../lib/loadCustomFonts";

interface Props {
    json: object | null;
    bundleMeta: BundleMeta | null;
    autoScale?: boolean;      // overrides bundleMeta.autoScale (e.g. admin preview always scales)
    showMissingAssetWarning?: boolean;
    activeEntry?: BundleSlideEntry | null;
    announcementActive?: boolean; // a lower-third announcement is currently showing over this slide
}

const DEFAULT_W = 1920;
const DEFAULT_H = 1080;

const VIDEO_EXTS = new Set(["mp4", "webm", "ogg"]);
function isVideo(name: string) {
    return VIDEO_EXTS.has(name.split(".").pop()?.toLowerCase() ?? "");
}

export default function DisplaySlide({ json, bundleMeta, autoScale: autoScaleOverride, showMissingAssetWarning = false, activeEntry, announcementActive = false }: Props) {
    const defer = (fn: () => void) => queueMicrotask(fn);
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasWrapRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fabricRef = useRef<fabric.StaticCanvas | null>(null);
    const loadSeqRef = useRef(0);

    const background = bundleMeta?.backgroundColor;
    const backgroundFile = bundleMeta?.backgroundFile;
    const designWidth = bundleMeta?.width;
    const designHeight = bundleMeta?.height;
    const autoScale = autoScaleOverride ?? bundleMeta?.autoScale;

    const { uploaded: uploadedFonts, google: googleFonts } = useFontRegistry();
    const [fontsVersion, setFontsVersion] = useState(0);
    useEffect(() => {
        let cancelled = false;
        loadFontsIntoDocument({ uploaded: uploadedFonts, google: googleFonts })
            .then(() => { if (!cancelled) setFontsVersion((v) => v + 1); });
        return () => { cancelled = true; };
    }, [uploadedFonts, googleFonts]);

    // Init canvas once
    useEffect(() => {
        if (!canvasRef.current) return;
        const c = new fabric.StaticCanvas(canvasRef.current, {
            selection: false,
            interactive: false,
        });
        fabricRef.current = c;

        disposeObjectsOnRemove(c);

        // Drive video frame updates. Static slides are redrawn only when something
        // changes, so they don't keep the GPU busy with identical frames.
        let running = true;
        const render = () => {
            if (!running || fabricRef.current !== c) return;
            try {
                if (c.getObjects().some((obj) => obj instanceof FabricVideo)) c.requestRenderAll();
            } catch {
                // Keep the loop alive; some browsers can throw transiently during media decode.
            }
            fabric.util.requestAnimFrame(render);
        };
        fabric.util.requestAnimFrame(render);

        return () => {
            running = false;
            if (fabricRef.current === c) fabricRef.current = null;
            c.dispose();
        };
    }, []);

    // Scale canvas to fill container (or set to exact design size)
    useEffect(() => {
        const container = containerRef.current;
        const c = fabricRef.current;
        if (!container || !c) return;

        const dw = designWidth ?? DEFAULT_W;
        const dh = designHeight ?? DEFAULT_H;

        const resize = () => {
            if (fabricRef.current !== c) return;
            let canvasW: number;
            let canvasH: number;
            if (autoScale) {
                const cw = container.clientWidth;
                const ch = container.clientHeight;
                // A collapsed container would give zoom 0; fabric then caches objects as
                // off-screen and stops drawing them even after the container grows back.
                if (cw === 0 || ch === 0) return;
                const scale = Math.min(cw / dw, ch / dh);
                canvasW = dw * scale;
                canvasH = dh * scale;
                c.setDimensions({ width: canvasW, height: canvasH });
                c.setZoom(scale);
            } else {
                canvasW = dw;
                canvasH = dh;
                c.setDimensions({ width: canvasW, height: canvasH });
                c.setZoom(1);
            }
            if (canvasWrapRef.current) {
                canvasWrapRef.current.style.width = `${canvasW}px`;
                canvasWrapRef.current.style.height = `${canvasH}px`;
            }
            try {
                c.requestRenderAll();
            } catch {
                // Canvas may be disposed between resize observation and render call.
            }
        };

        const ro = new ResizeObserver(resize);
        ro.observe(container);
        resize();
        return () => ro.disconnect();
    }, [designWidth, designHeight, autoScale]);

    const [hasMissingAssets, setHasMissingAssets] = useState(false);
    const [localTime, setLocalTime] = useState("");
    const [iframeFailed, setIframeFailed] = useState(false);
    // The iframe stays hidden until its document has loaded, so the slide
    // background shows through instead of a blank white frame.
    const [iframeLoaded, setIframeLoaded] = useState(false);

    // Sites that refuse to be framed (X-Frame-Options/CSP frame-ancestors) don't
    // reliably fire an iframe error event — they just stay blank. A load timeout
    // catches that case too, alongside genuine network failures.
    const websiteUrl = activeEntry?.type === "website" ? activeEntry.data : null;
    useEffect(() => {
        defer(() => {
            setIframeFailed(false);
            setIframeLoaded(false);
        });
    }, [websiteUrl]);

    // Re-runs once the iframe reports a load, which cancels the pending timeout.
    useEffect(() => {
        if (!websiteUrl || iframeLoaded) return;
        const timer = setTimeout(() => setIframeFailed(true), 4000);
        return () => clearTimeout(timer);
    }, [websiteUrl, iframeLoaded]);

    useEffect(() => {
        if (!bundleMeta?.showLocalTime) return;
        const updateTime = () => {
            const now = new Date();
            setLocalTime(now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false }));
        };
        updateTime();
        const interval = setInterval(updateTime, 1000);
        return () => clearInterval(interval);
    }, [bundleMeta?.showLocalTime]);

    // Load JSON whenever it changes
    useEffect(() => {
        const c = fabricRef.current;
        if (!c) return;
        const seq = ++loadSeqRef.current;
        if (!json) {
            try {
                c.clear();
                if (fabricRef.current === c) c.requestRenderAll();
            } catch {
                // Ignore dispose races.
            }
            queueMicrotask(() => setHasMissingAssets(false));
            return;
        }
        loadFabricJsonSafely(c, json)
            .then((result) => {
                if (fabricRef.current !== c || loadSeqRef.current !== seq) return;
                setHasMissingAssets(result.missingAssets);
                try {
                    c.requestRenderAll();
                } catch {
                    // Ignore dispose races.
                }
            });
    }, [json]);

    // Uploaded and Google fonts can finish loading after the slide was drawn;
    // load the slide's variants of them and re-measure the text.
    const jsonRef = useRef(json);
    useEffect(() => { jsonRef.current = json; }, [json]);
    useEffect(() => {
        const c = fabricRef.current;
        if (!c || fontsVersion === 0 || !jsonRef.current) return;
        preloadFabricFonts(jsonRef.current).then(() => {
            if (fabricRef.current === c) refreshTextMetrics(c);
        });
    }, [fontsVersion]);

    const fileUrl = backgroundFile
        ? `/api/files/backgrounds/${encodeURIComponent(backgroundFile)}`
        : null;
    const fileIsVideo = backgroundFile ? isVideo(backgroundFile) : false;
    // Website, video and image slides draw their own element instead of the fabric canvas.
    const usesCanvas = !activeEntry || activeEntry.type === "fabric";

    return (
        <div
            ref={containerRef}
            className="slide-preview-container"
            style={!fileUrl && background ? { background } : undefined}
        >
            {bundleMeta?.showLocalTime && (() => {
                const pos = bundleMeta.localTimePosition || "bottom-right";
                if (announcementActive && pos.includes("bottom")) return null; // avoid clipping with the lower-third
                return (
                    <div
                        style={{
                            position: "absolute",
                            margin: 0,
                            top: pos.includes("top") ? "min(20px, 2%)" : "auto",
                            bottom: pos.includes("bottom") ? "min(20px, 2%)" : "auto",
                            left: pos.includes("left") ? "min(30px, 3%)" : "auto",
                            right: pos.includes("right") ? "min(30px, 3%)" : "auto",
                            zIndex: 10,
                            padding: "0.08em 0.25em",
                            backgroundColor: "rgba(0,0,0,0.5)",
                            backdropFilter: "blur(4px)",
                            color: "white",
                            fontFamily: "Inter",
                            // cqw = the slide container, so the clock keeps its proportion in small admin previews.
                            fontSize: "min(3cqw, 48px)",
                            fontWeight: 900,
                            letterSpacing: "0.02em",
                            borderRadius: "0.17em",
                            pointerEvents: "none",
                            textShadow: "0.04em 0.04em 0.04em black",
                            boxShadow: "0 0.08em 0.12em rgba(0,0,0,0.9)",
                        }}
                    >
                        {localTime}
                    </div>
                );
            })()}
            <div ref={canvasWrapRef} className="ds-canvas-wrap" style={{ position: "relative" }}>
                {fileUrl && fileIsVideo && (
                    <ManagedVideo
                        key={fileUrl}
                        src={fileUrl}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="ds-bg-media"
                    />
                )}
                {fileUrl && !fileIsVideo && (
                    <Image src={fileUrl} className="ds-bg-media" alt="" fill />
                )}
                {activeEntry?.type === "website" && (
                    <iframe
                        key={websiteUrl}
                        src={activeEntry.data}
                        className="ds-iframe"
                        style={{
                            width: "100%",
                            height: "100%",
                            border: "none",
                            position: "absolute",
                            inset: 0,
                            zIndex: 1,
                            backgroundColor: "white",
                            opacity: iframeLoaded ? 1 : 0,
                            transition: "opacity 300ms ease-in",
                        }}
                        allow="autoplay; fullscreen"
                        onLoad={() => {
                            setIframeFailed(false);
                            setIframeLoaded(true);
                        }}
                        onError={() => setIframeFailed(true)}
                    />
                )}
                {activeEntry?.type === "website" && showMissingAssetWarning && iframeFailed && (
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            background: "rgba(0, 0, 0, 0.45)",
                            color: "white",
                            padding: "0 12px",
                            textAlign: "center",
                            zIndex: 2,
                            pointerEvents: "none",
                        }}
                    >
                        This site failed to load — it may block being embedded, or the URL may be unreachable.
                    </div>
                )}
                {activeEntry?.type === "video" && (
                    <ManagedVideo
                        key={activeEntry.data}
                        src={`/api/files/videos/${encodeURIComponent(activeEntry.data)}`}
                        autoPlay
                        loop
                        muted
                        playsInline
                        style={{ width: "100%", height: "100%", objectFit: "contain", position: "absolute", inset: 0, zIndex: 1 }}
                    />
                )}
                {activeEntry?.type === "image" && (
                    <Image
                        key={activeEntry.data}
                        src={`/api/files/images/${encodeURIComponent(activeEntry.data)}`}
                        alt=""
                        fill
                        unoptimized
                        style={{ objectFit: "contain", zIndex: 1 }}
                    />
                )}
                <canvas ref={canvasRef} className="ds-canvas" style={usesCanvas ? undefined : { display: "none" }} />
                {showMissingAssetWarning && hasMissingAssets && (
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            background: "rgba(0, 0, 0, 0.45)",
                            color: "white",
                            padding: "0 12px",
                            textAlign: "center",
                            zIndex: 2,
                            pointerEvents: "none",
                        }}
                    >
                        Some image assets were missing and have been skipped.
                    </div>
                )}
            </div>
        </div>
    );
}
