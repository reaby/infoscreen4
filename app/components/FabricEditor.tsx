
"use client";

import { useEffect, useRef, useState } from "react";
import * as fabric from "fabric";
import Toolbar from "./Toolbar";
import ContextMenu from "./ContextMenu";
import { FabricVideo } from "./FabricVideo";

export default function FabricEditor({ initialBundle, initialSlide }: { initialBundle?: string; initialSlide?: string }) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const bgLayerRef = useRef<HTMLDivElement | null>(null);
    const sizeRef = useRef({ width: 1920, height: 1080 });
    const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
    const [showBackground, setShowBackground] = useState(false);
    const [bundleBackground, setBundleBackground] = useState<{ color?: string; file?: string }>({});
    const panningRef = useRef(false);
    const ctrlModRef = useRef(false);
    const textEditRef = useRef(false);
    const lastPosRef = useRef({ x: 0, y: 0 });
    const mousePositionRef = useRef({ x: 0, y: 0 });
    const historyRef = useRef<string[]>([]);
    const historyIndexRef = useRef(-1);
    const isRestoringRef = useRef(false);
    const [contextMenu, setContextMenu] = useState({
        visible: false,
        x: 0,
        y: 0,
    });

    const fitToBundle = (targetCanvas: fabric.Canvas) => {
        const viewportWidth = targetCanvas.getWidth();
        const viewportHeight = targetCanvas.getHeight();
        const contentWidth = Math.max(1, sizeRef.current.width);
        const contentHeight = Math.max(1, sizeRef.current.height);

        const fitZoom = Math.min(viewportWidth / contentWidth, viewportHeight / contentHeight);
        const offsetX = (viewportWidth - contentWidth * fitZoom) / 2;
        const offsetY = (viewportHeight - contentHeight * fitZoom) / 2;

        targetCanvas.setViewportTransform([fitZoom, 0, 0, fitZoom, offsetX, offsetY]);
        syncBackgroundLayer(targetCanvas);
        targetCanvas.requestRenderAll();
    };

    const resizeCanvasToContainer = (targetCanvas: fabric.Canvas) => {
        const container = containerRef.current;
        if (!container) return;
        const width = Math.max(1, container.clientWidth);
        const height = Math.max(1, container.clientHeight);
        targetCanvas.setDimensions({ width, height });
        targetCanvas.calcOffset();
    };

    const syncBackgroundLayer = (targetCanvas: fabric.Canvas) => {
        const layer = bgLayerRef.current;
        if (!layer) return;
        const vpt = targetCanvas.viewportTransform ?? [1, 0, 0, 1, 0, 0];
        layer.style.width = `${sizeRef.current.width}px`;
        layer.style.height = `${sizeRef.current.height}px`;
        layer.style.transform = `matrix(${vpt[0]}, ${vpt[1]}, ${vpt[2]}, ${vpt[3]}, ${vpt[4]}, ${vpt[5]})`;
    };

    useEffect(() => {
        if (!canvasRef.current) {
            console.log("Canvas ref not ready");
            return;
        }

        const canvas = new fabric.Canvas(canvasRef.current, {
            backgroundColor: "transparent",
            selection: true,
        });

        resizeCanvasToContainer(canvas);
        fitToBundle(canvas);

        setCanvas(canvas);

        const saveSnapshot = () => {
            if (isRestoringRef.current) return;
            const json = JSON.stringify(canvas.toJSON());
            historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
            historyRef.current.push(json);
            historyIndexRef.current = historyRef.current.length - 1;
        };

        // Zoom functionality with Ctrl+mouse wheel
        const handleWheel = (event: any) => {
            const e = (event as any).e;
            // Only zoom if Ctrl (or Cmd on Mac) is pressed
            if (!e.ctrlKey && !e.metaKey) return;

            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            const zoom = canvas.getZoom() + delta;
            const clampedZoom = Math.max(0.1, Math.min(5, zoom));
            canvas.setZoom(clampedZoom);
            canvas.setViewportTransform(canvas.viewportTransform!);
            syncBackgroundLayer(canvas);
            canvas.requestRenderAll();
        };

        // Panning functionality using Fabric canvas events
        const handleMouseDown = (event: any) => {
            // Middle mouse button (wheel button) = 1
            if (event.e.button === 1) {
                panningRef.current = true;
                lastPosRef.current = { x: event.e.x, y: event.e.y };
                canvas.defaultCursor = "move";
            }
        };

        const handleMouseMove = (event: any) => {
            const pointer = event.e;

            // Always track mouse position
            mousePositionRef.current = { x: pointer.x, y: pointer.y };
            if (!panningRef.current) return;

            const deltaX = pointer.x - lastPosRef.current.x;
            const deltaY = pointer.y - lastPosRef.current.y;

            lastPosRef.current = { x: pointer.x, y: pointer.y };

            const vpt = canvas.viewportTransform!;
            const zoom = canvas.getZoom();

            const viewportWidth = canvas.getWidth();
            const viewportHeight = canvas.getHeight();
            const zoomedWidth = sizeRef.current.width * zoom;
            const zoomedHeight = sizeRef.current.height * zoom;

            // Update viewport position
            vpt[4] += deltaX;
            vpt[5] += deltaY;

            // Clamp viewport to content bounds; keep content centered if smaller than viewport.
            if (zoomedWidth <= viewportWidth) {
                vpt[4] = (viewportWidth - zoomedWidth) / 2;
            } else {
                vpt[4] = Math.max(viewportWidth - zoomedWidth, Math.min(vpt[4], 0));
            }
            if (zoomedHeight <= viewportHeight) {
                vpt[5] = (viewportHeight - zoomedHeight) / 2;
            } else {
                vpt[5] = Math.max(viewportHeight - zoomedHeight, Math.min(vpt[5], 0));
            }
            canvas.setViewportTransform(vpt);
            syncBackgroundLayer(canvas);
            canvas.requestRenderAll();
        };

        const handleMouseUp = (event: any) => {
            // Middle mouse button (wheel button) = 1
            if (event.e.button === 1) {
                panningRef.current = false;
                canvas.defaultCursor = "default";
            }
            if (event.e.button === 2) {
                handleContextMenu(event);
            }
        };
        // Right-click context menu handler
        const handleContextMenu = (event: any) => {
            event.e.preventDefault();
            const activeObject = canvas.getActiveObject();

            if (activeObject) {
                setContextMenu({
                    visible: true,
                    x: event.e.clientX,
                    y: event.e.clientY,
                });
            } else {
                setContextMenu({ visible: false, x: 0, y: 0 });
            }
        };

        const handleResize = () => {
            resizeCanvasToContainer(canvas);
            fitToBundle(canvas);
        };

        window.addEventListener("resize", handleResize);

        // Keyboard event handler for nudging and deletion
        const handleKeyDown = (e: KeyboardEvent) => {
            // Handle Ctrl/Cmd key press
            if (e.ctrlKey || e.metaKey) {
                ctrlModRef.current = true;
            }
            if (textEditRef.current) return;

            switch (e.key) {
                case " ":
                    if (!panningRef.current) {
                        panningRef.current = true;
                        lastPosRef.current = mousePositionRef.current;
                    }
                    canvas.defaultCursor = "move";
                    canvas.requestRenderAll();
                    e.preventDefault();
                    break;
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                if (!isRestoringRef.current && historyIndexRef.current > 0) {
                    historyIndexRef.current--;
                    isRestoringRef.current = true;
                    canvas.loadFromJSON(JSON.parse(historyRef.current[historyIndexRef.current])).then(() => {
                        canvas.requestRenderAll();
                        isRestoringRef.current = false;
                    });
                }
                return;
            }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Z')) {
                e.preventDefault();
                if (!isRestoringRef.current && historyIndexRef.current < historyRef.current.length - 1) {
                    historyIndexRef.current++;
                    isRestoringRef.current = true;
                    canvas.loadFromJSON(JSON.parse(historyRef.current[historyIndexRef.current])).then(() => {
                        canvas.requestRenderAll();
                        isRestoringRef.current = false;
                    });
                }
                return;
            }
            const activeObject = canvas.getActiveObject();
            if (!activeObject) return;


            // Get current mouse position relative to canvas
            // const mousePos = mousePositionRef.current;
            // console.log(`Mouse position: x=${mousePos.x}, y=${mousePos.y}`);

            const nudgeDistance = (e.ctrlKey || e.metaKey) ? 50 : 5; // 50 with Ctrl, 5 without

            switch (e.key) {
                case "ArrowUp":
                    e.preventDefault();
                    activeObject.set({ top: (activeObject.top || 0) - nudgeDistance });

                    break;
                case "ArrowDown":
                    e.preventDefault();
                    activeObject.set({ top: (activeObject.top || 0) + nudgeDistance });

                    break;
                case "ArrowLeft":
                    e.preventDefault();
                    activeObject.set({ left: (activeObject.left || 0) - nudgeDistance });

                    break;
                case "ArrowRight":
                    e.preventDefault();
                    activeObject.set({ left: (activeObject.left || 0) + nudgeDistance });

                    break;
                case "Delete":
                case "Backspace":
                    e.preventDefault();
                    canvas.remove(activeObject);

                    break;
            }
            canvas.requestRenderAll();
        };

        // Keyboard event handler for key release
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === "Control" || e.key === "Meta") {
                ctrlModRef.current = false;
            }
            if (e.key === " ") {
                panningRef.current = false;
                canvas.defaultCursor = "default";
                canvas.requestRenderAll()
            }
        };

        const handleScaling = (event: any) => {
            if (event.target instanceof fabric.Textbox) {
                event.target.scaleX = 1;
                event.target.scaleY = 1;
                return;
            }
        };



        // Add keyboard event listeners
        document.addEventListener("keydown", handleKeyDown);
        document.addEventListener("keyup", handleKeyUp);

        // Use Fabric canvas events for pan
        canvas.on("mouse:wheel", handleWheel)
        canvas.on("mouse:down", handleMouseDown);
        canvas.on("mouse:move", handleMouseMove);
        canvas.on("mouse:up", handleMouseUp);
        canvas.on("object:scaling", handleScaling);
        const handleAfterRender = () => syncBackgroundLayer(canvas);
        canvas.on("after:render", handleAfterRender);

        canvas.on("text:editing:entered", () => {
            textEditRef.current = true;
        });
        canvas.on("text:editing:exited", () => {
            textEditRef.current = false;
            saveSnapshot();
        });
        canvas.on("object:added", saveSnapshot);
        canvas.on("object:removed", saveSnapshot);
        canvas.on("object:modified", saveSnapshot);

        fabric.util.requestAnimFrame(function render() {
            canvas.requestRenderAll();
            fabric.util.requestAnimFrame(render);
        });
        return () => {
            console.log("Cleaning up canvas");
            document.removeEventListener("keydown", handleKeyDown);
            document.removeEventListener("keyup", handleKeyUp);
            window.removeEventListener("resize", handleResize);
            canvas.off("mouse:wheel", handleWheel);
            canvas.off("mouse:down", handleMouseDown);
            canvas.off("mouse:move", handleMouseMove);
            canvas.off("mouse:up", handleMouseUp);
            canvas.off("object:scaling", handleScaling);
            canvas.off("after:render", handleAfterRender);
            canvas.off("object:added", saveSnapshot);
            canvas.off("object:removed", saveSnapshot);
            canvas.off("object:modified", saveSnapshot);
            canvas.dispose();
        };
    }, []);

    const handleUndo = async () => {
        if (!canvas || isRestoringRef.current || historyIndexRef.current <= 0) return;
        historyIndexRef.current--;
        isRestoringRef.current = true;
        await canvas.loadFromJSON(JSON.parse(historyRef.current[historyIndexRef.current]));
        canvas.requestRenderAll();
        isRestoringRef.current = false;
    };

    const handleRedo = async () => {
        if (!canvas || isRestoringRef.current || historyIndexRef.current >= historyRef.current.length - 1) return;
        historyIndexRef.current++;
        isRestoringRef.current = true;
        await canvas.loadFromJSON(JSON.parse(historyRef.current[historyIndexRef.current]));
        canvas.requestRenderAll();
        isRestoringRef.current = false;
    };

    const handleZoomIn = () => {
        if (!canvas) return;
        const zoom = canvas.getZoom();
        const newZoom = Math.min(5, zoom + 0.2);
        canvas.setZoom(newZoom);
        syncBackgroundLayer(canvas);
        canvas.requestRenderAll();
    };

    const handleZoomOut = () => {
        if (!canvas) return;
        const zoom = canvas.getZoom();
        const newZoom = Math.max(0.1, zoom - 0.2);
        canvas.setZoom(newZoom);
        syncBackgroundLayer(canvas);
        canvas.requestRenderAll();
    };

    const handleClearCanvas = () => {
        if (!canvas) return;
        isRestoringRef.current = true;
        canvas.clear();
        isRestoringRef.current = false;
        // Save the empty canvas as a new undo snapshot
        const json = JSON.stringify(canvas.toJSON());
        historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
        historyRef.current.push(json);
        historyIndexRef.current = historyRef.current.length - 1;
        canvas.requestRenderAll();
    };

    const handleResetZoom = () => {
        if (!canvas) return;
        fitToBundle(canvas);
    };

    return (
        <>
            <Toolbar
                canvas={canvas}
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                onResetZoom={handleResetZoom}
                onUndo={handleUndo}
                onRedo={handleRedo}
                onClearCanvas={handleClearCanvas}
                onBundleMeta={(meta) => {
                    sizeRef.current = {
                        width: meta.width ?? 1920,
                        height: meta.height ?? 1080,
                    };
                    setBundleBackground({ color: meta.backgroundColor, file: meta.backgroundFile });
                    if (canvas) fitToBundle(canvas);
                }}
                showBackground={showBackground}
                onToggleBackground={() => setShowBackground((v) => !v)}
                initialBundle={initialBundle}
                initialSlide={initialSlide}
            />
            <div ref={containerRef} className="editorAreaContainer">
                <div ref={bgLayerRef} className="editor-bg-layer">
                    {!showBackground ? (
                        <div className="editor-bg-checker" />
                    ) : bundleBackground.file ? (
                        <video
                            key={bundleBackground.file}
                            src={`/api/files/backgrounds/${encodeURIComponent(bundleBackground.file)}`}
                            autoPlay loop muted playsInline
                            className="editor-bg-media"
                        />
                    ) : bundleBackground.color ? (
                        <div className="editor-bg-color" style={{ background: bundleBackground.color }} />
                    ) : null}
                </div>
                <canvas
                    ref={canvasRef}
                    className="editorArea"
                    width={1280}
                    height={720}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        if (canvas) {
                            const activeObject = canvas.getActiveObject();
                            if (activeObject) {
                                setContextMenu({
                                    visible: true,
                                    x: e.clientX,
                                    y: e.clientY,
                                });
                            }
                        }
                    }}
                />
            </div>
            <ContextMenu
                visible={contextMenu.visible}
                x={contextMenu.x}
                y={contextMenu.y}
                onClose={() => setContextMenu({ ...contextMenu, visible: false })}
                canvas={canvas}
            />
        </>
    );
}
