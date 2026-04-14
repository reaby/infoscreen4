"use client";

import { useEffect, useRef } from "react";
import * as fabric from "fabric";
import { BundleMeta } from "../interfaces/BundleMeta";
import "./FabricVideo"; // side-effect: registers FabricVideo in classRegistry

interface Props {
    json: object | null;
    bundleMeta: BundleMeta | null;
    autoScale?: boolean;      // overrides bundleMeta.autoScale (e.g. admin preview always scales)
}

const DEFAULT_W = 1920;
const DEFAULT_H = 1080;

const VIDEO_EXTS = new Set(["mp4", "webm", "ogg"]);
function isVideo(name: string) {
    return VIDEO_EXTS.has(name.split(".").pop()?.toLowerCase() ?? "");
}

export default function DisplaySlide({ json, bundleMeta, autoScale: autoScaleOverride }: Props) {
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

    // Init canvas once
    useEffect(() => {
        if (!canvasRef.current) return;
        const c = new fabric.StaticCanvas(canvasRef.current, {
            selection: false,
            interactive: false,
        });
        fabricRef.current = c;

        // Drive video frame updates
        let running = true;
        const render = () => {
            if (!running || fabricRef.current !== c) return;
            try {
                c.requestRenderAll();
            } catch {
                return;
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
            return;
        }
        c.loadFromJSON(json)
            .then(() => {
                if (fabricRef.current !== c || loadSeqRef.current !== seq) return;
                try {
                    c.requestRenderAll();
                } catch {
                    // Ignore dispose races.
                }
            })
            .catch(() => {
                // Ignore load failures to keep display resilient.
            });
    }, [json]);

    const fileUrl = backgroundFile ? `/api/files/backgrounds/${encodeURIComponent(backgroundFile)}` : null;
    const fileIsVideo = backgroundFile ? isVideo(backgroundFile) : false;

    return (
        <div
            ref={containerRef}
            className="slide-preview-container"
            style={!fileUrl && background ? { background } : undefined}
        >
            <div ref={canvasWrapRef} className="ds-canvas-wrap">
                {fileUrl && fileIsVideo && (
                    <video
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
                    <img src={fileUrl} className="ds-bg-media" alt="" />
                )}
                <canvas ref={canvasRef} className="ds-canvas" />
            </div>
        </div>
    );
}
