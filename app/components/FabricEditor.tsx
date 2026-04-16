
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import * as fabric from "fabric";
import Toolbar from "./Toolbar";
import ContextMenu from "./ContextMenu";
import ShortcutHelpPopup from "./ShortcutHelpPopup";
import { loadFabricJsonSafely } from "./fabricLoadHelpers";
import { FabricVideo } from "./FabricVideo";

const isVideoFile = (name: string) => /\.(mp4|webm|ogg)$/i.test(name);

export default function FabricEditor({ initialBundle, initialSlide }: { initialBundle?: string; initialSlide?: string }) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const bgLayerRef = useRef<HTMLDivElement | null>(null);
    const sizeRef = useRef({ width: 1920, height: 1080 });
    const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
    const [showBackground, setShowBackground] = useState(false);
    const [bundleBackground, setBundleBackground] = useState<{ color?: string; file?: string }>({});
    const [zoomLevel, setZoomLevel] = useState(1);
    const [showHelp, setShowHelp] = useState(false);
    const [missingAssetNoticeCount, setMissingAssetNoticeCount] = useState(0);
    const [missingAssetNoticeVisible, setMissingAssetNoticeVisible] = useState(false);
    const missingAssetTimeoutRef = useRef<number | null>(null);
    const panningRef = useRef(false);
    const ctrlModRef = useRef(false);
    const textEditRef = useRef(false);
    const lastPosRef = useRef({ x: 0, y: 0 });
    const mousePositionRef = useRef({ x: 0, y: 0 });
    const historyRef = useRef<string[]>([]);
    const historyIndexRef = useRef(-1);
    const isRestoringRef = useRef(false);
    const [scrollbars, setScrollbars] = useState({
        horizontalVisible: false,
        verticalVisible: false,
        thumbLeft: 0,
        thumbTop: 0,
        thumbWidth: 0,
        thumbHeight: 0,
    });
    const scrollbarDragRef = useRef<{
        type: "horizontal" | "vertical" | null;
        startX: number;
        startY: number;
        startThumbLeft: number;
        startThumbTop: number;
    }>({
        type: null,
        startX: 0,
        startY: 0,
        startThumbLeft: 0,
        startThumbTop: 0,
    });
    const [contextMenu, setContextMenu] = useState({
        visible: false,
        x: 0,
        y: 0,
    });

    const syncBackgroundLayer = useCallback((targetCanvas: fabric.Canvas) => {
        const layer = bgLayerRef.current;
        if (!layer) return;
        const vpt = targetCanvas.viewportTransform ?? [1, 0, 0, 1, 0, 0];
        layer.style.width = `${sizeRef.current.width}px`;
        layer.style.height = `${sizeRef.current.height}px`;
        layer.style.transform = `matrix(${vpt[0]}, ${vpt[1]}, ${vpt[2]}, ${vpt[3]}, ${vpt[4]}, ${vpt[5]})`;
    }, []);

    const resizeCanvasToContainer = useCallback((targetCanvas: fabric.Canvas) => {
        const container = containerRef.current;
        if (!container) return;
        const width = Math.max(1, container.clientWidth);
        const height = Math.max(1, container.clientHeight);
        targetCanvas.setDimensions({ width, height });
        targetCanvas.calcOffset();
        targetCanvas.requestRenderAll();
    }, []);

    const fitToBundle = useCallback((targetCanvas: fabric.Canvas) => {
        const viewportWidth = targetCanvas.getWidth();
        const viewportHeight = targetCanvas.getHeight();
        const contentWidth = Math.max(1, sizeRef.current.width);
        const contentHeight = Math.max(1, sizeRef.current.height);

        const fitZoom = Math.min(viewportWidth / contentWidth, viewportHeight / contentHeight);
        const offsetX = (viewportWidth - contentWidth * fitZoom) / 2;
        const offsetY = (viewportHeight - contentHeight * fitZoom) / 2;

        targetCanvas.setViewportTransform([fitZoom, 0, 0, fitZoom, offsetX, offsetY]);
        setZoomLevel(fitZoom);
        syncBackgroundLayer(targetCanvas);
        targetCanvas.requestRenderAll();
    }, [syncBackgroundLayer]);

    const zoomCanvasToCenter = useCallback((targetCanvas: fabric.Canvas, zoom: number) => {
        const viewportWidth = targetCanvas.getWidth();
        const viewportHeight = targetCanvas.getHeight();
        const centerPoint = new fabric.Point(viewportWidth / 2, viewportHeight / 2);
        targetCanvas.zoomToPoint(centerPoint, zoom);

        const contentWidth = Math.max(1, sizeRef.current.width) * zoom;
        const contentHeight = Math.max(1, sizeRef.current.height) * zoom;
        const vpt = targetCanvas.viewportTransform!;

        if (contentWidth <= viewportWidth) {
            vpt[4] = (viewportWidth - contentWidth) / 2;
        }
        if (contentHeight <= viewportHeight) {
            vpt[5] = (viewportHeight - contentHeight) / 2;
        }

        targetCanvas.setViewportTransform(vpt);
        setZoomLevel(zoom);
        syncBackgroundLayer(targetCanvas);
        targetCanvas.requestRenderAll();
    }, [syncBackgroundLayer]);

    const clampCanvasViewport = useCallback((targetCanvas: fabric.Canvas) => {
        const zoom = targetCanvas.getZoom();
        const viewportWidth = targetCanvas.getWidth();
        const viewportHeight = targetCanvas.getHeight();
        const contentWidth = Math.max(1, sizeRef.current.width) * zoom;
        const contentHeight = Math.max(1, sizeRef.current.height) * zoom;
        const vpt = targetCanvas.viewportTransform ?? [1, 0, 0, 1, 0, 0];

        if (contentWidth <= viewportWidth) {
            vpt[4] = (viewportWidth - contentWidth) / 2;
        } else {
            vpt[4] = Math.max(viewportWidth - contentWidth, Math.min(vpt[4], 0));
        }
        if (contentHeight <= viewportHeight) {
            vpt[5] = (viewportHeight - contentHeight) / 2;
        } else {
            vpt[5] = Math.max(viewportHeight - contentHeight, Math.min(vpt[5], 0));
        }

        targetCanvas.setViewportTransform(vpt);
        return vpt;
    }, []);

    const updateScrollbars = useCallback((targetCanvas: fabric.Canvas) => {
        const viewportWidth = targetCanvas.getWidth();
        const viewportHeight = targetCanvas.getHeight();
        const zoom = targetCanvas.getZoom();
        const contentWidth = Math.max(1, sizeRef.current.width) * zoom;
        const contentHeight = Math.max(1, sizeRef.current.height) * zoom;
        const vpt = targetCanvas.viewportTransform ?? [1, 0, 0, 1, 0, 0];

        const horizontalVisible = contentWidth > viewportWidth + 1;
        const verticalVisible = contentHeight > viewportHeight + 1;
        const thumbWidth = horizontalVisible ? Math.max(24, (viewportWidth / contentWidth) * viewportWidth) : viewportWidth;
        const thumbHeight = verticalVisible ? Math.max(24, (viewportHeight / contentHeight) * viewportHeight) : viewportHeight;
        const maxScrollX = Math.max(0, contentWidth - viewportWidth);
        const maxScrollY = Math.max(0, contentHeight - viewportHeight);
        const thumbLeft = horizontalVisible ? Math.round(((-vpt[4]) / maxScrollX) * (viewportWidth - thumbWidth)) : 0;
        const thumbTop = verticalVisible ? Math.round(((-vpt[5]) / maxScrollY) * (viewportHeight - thumbHeight)) : 0;

        setScrollbars({
            horizontalVisible,
            verticalVisible,
            thumbLeft,
            thumbTop,
            thumbWidth,
            thumbHeight,
        });
    }, []);

    const handleScrollbarPointerMove = useCallback((event: PointerEvent) => {
        if (!canvas) return;
        if (!scrollbarDragRef.current.type) return;

        const zoom = canvas.getZoom();
        const viewportWidth = canvas.getWidth();
        const viewportHeight = canvas.getHeight();
        const contentWidth = Math.max(1, sizeRef.current.width) * zoom;
        const contentHeight = Math.max(1, sizeRef.current.height) * zoom;
        const vpt = canvas.viewportTransform!;

        if (scrollbarDragRef.current.type === "horizontal") {
            const thumbWidth = Math.max(24, (viewportWidth / contentWidth) * viewportWidth);
            const maxThumbLeft = viewportWidth - thumbWidth;
            const nextLeft = Math.min(maxThumbLeft, Math.max(0, scrollbarDragRef.current.startThumbLeft + (event.clientX - scrollbarDragRef.current.startX)));
            const ratio = maxThumbLeft > 0 ? nextLeft / maxThumbLeft : 0;
            vpt[4] = -ratio * Math.max(0, contentWidth - viewportWidth);
        }
        if (scrollbarDragRef.current.type === "vertical") {
            const thumbHeight = Math.max(24, (viewportHeight / contentHeight) * viewportHeight);
            const maxThumbTop = viewportHeight - thumbHeight;
            const nextTop = Math.min(maxThumbTop, Math.max(0, scrollbarDragRef.current.startThumbTop + (event.clientY - scrollbarDragRef.current.startY)));
            const ratio = maxThumbTop > 0 ? nextTop / maxThumbTop : 0;
            vpt[5] = -ratio * Math.max(0, contentHeight - viewportHeight);
        }

        canvas.setViewportTransform(vpt);
        syncBackgroundLayer(canvas);
        canvas.requestRenderAll();
        updateScrollbars(canvas);
    }, [canvas, syncBackgroundLayer, updateScrollbars]);

    const handleScrollbarPointerUp = useCallback(() => {
        scrollbarDragRef.current.type = null;
        window.removeEventListener("pointermove", handleScrollbarPointerMove);
        window.removeEventListener("pointerup", handleScrollbarPointerUp);
    }, [handleScrollbarPointerMove]);

    const handleScrollbarPointerDown = useCallback((type: "horizontal" | "vertical") => (event: any) => {
        event.preventDefault();
        const startThumbLeft = scrollbars.thumbLeft;
        const startThumbTop = scrollbars.thumbTop;
        scrollbarDragRef.current = {
            type,
            startX: event.clientX,
            startY: event.clientY,
            startThumbLeft,
            startThumbTop,
        };
        window.addEventListener("pointermove", handleScrollbarPointerMove);
        window.addEventListener("pointerup", handleScrollbarPointerUp);
    }, [handleScrollbarPointerMove, handleScrollbarPointerUp, scrollbars.thumbLeft, scrollbars.thumbTop]);

    const handleScrollbarTrackPointerDown = useCallback((type: "horizontal" | "vertical") => (event: any) => {
        event.preventDefault();
        if (!canvas) return;
        const zoom = canvas.getZoom();
        const viewportWidth = canvas.getWidth();
        const viewportHeight = canvas.getHeight();
        const contentWidth = Math.max(1, sizeRef.current.width) * zoom;
        const contentHeight = Math.max(1, sizeRef.current.height) * zoom;
        const vpt = canvas.viewportTransform!;

        if (type === "horizontal") {
            const thumbWidth = Math.max(24, (viewportWidth / contentWidth) * viewportWidth);
            const rect = event.currentTarget.getBoundingClientRect();
            const clickX = event.clientX - rect.left;
            const maxThumbLeft = Math.max(0, viewportWidth - thumbWidth);
            const nextLeft = Math.min(maxThumbLeft, Math.max(0, clickX - thumbWidth / 2));
            const ratio = maxThumbLeft > 0 ? nextLeft / maxThumbLeft : 0;
            vpt[4] = -ratio * Math.max(0, contentWidth - viewportWidth);
        }

        if (type === "vertical") {
            const thumbHeight = Math.max(24, (viewportHeight / contentHeight) * viewportHeight);
            const rect = event.currentTarget.getBoundingClientRect();
            const clickY = event.clientY - rect.top;
            const maxThumbTop = Math.max(0, viewportHeight - thumbHeight);
            const nextTop = Math.min(maxThumbTop, Math.max(0, clickY - thumbHeight / 2));
            const ratio = maxThumbTop > 0 ? nextTop / maxThumbTop : 0;
            vpt[5] = -ratio * Math.max(0, contentHeight - viewportHeight);
        }

        canvas.setViewportTransform(vpt);
        syncBackgroundLayer(canvas);
        canvas.requestRenderAll();
        updateScrollbars(canvas);
    }, [canvas, syncBackgroundLayer, updateScrollbars]);

    useEffect(() => {
        if (!canvasRef.current) {
            console.log("Canvas ref not ready");
            return;
        }

        const canvas = new fabric.Canvas(canvasRef.current, {
            backgroundColor: "transparent",
            selection: true,
        });

        fabric.InteractiveFabricObject.ownDefaults = {
            ...fabric.InteractiveFabricObject.ownDefaults,
            cornerStrokeColor: '#123',
            transparentCorners: true,
            padding: 0,
            borderColor: "#123",
        };

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

        // Zoom or pan functionality with mouse wheel
        const handleWheel = (event: any) => {
            const e = (event as any).e;
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                const zoom = canvas.getZoom() + delta;
                const clampedZoom = Math.max(0.1, Math.min(5, zoom));
                zoomCanvasToCenter(canvas, clampedZoom);
                return;
            }

            // Normal wheel scroll pans the canvas viewport
            e.preventDefault();
            const vpt = canvas.viewportTransform!;
            vpt[4] -= e.deltaX*0.33;
            vpt[5] -= e.deltaY*0.33

            const zoom = canvas.getZoom();
            const viewportWidth = canvas.getWidth();
            const viewportHeight = canvas.getHeight();
            const zoomedWidth = sizeRef.current.width * zoom;
            const zoomedHeight = sizeRef.current.height * zoom;

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
            updateScrollbars(canvas);
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
            updateScrollbars(canvas);
            zoomCanvasToCenter(canvas, canvas.getZoom());
            resizeCanvasToContainer(canvas);
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
            if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === 'Add' || e.key === '-' || e.key === 'Subtract' || e.code === 'Digit0')) {
                e.preventDefault();
                const zoom = canvas.getZoom();
                let newZoom = (e.key === '-' || e.key === 'Subtract')
                    ? Math.max(0.1, zoom - 0.1)
                    : Math.min(5, zoom + 0.1);
                if (e.code === 'Digit0') {
                    newZoom = 1;
                }
                zoomCanvasToCenter(canvas, newZoom);
                return;
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                if (!isRestoringRef.current && historyIndexRef.current > 0) {
                    historyIndexRef.current--;
                    isRestoringRef.current = true;
                    loadFabricJsonSafely(canvas, JSON.parse(historyRef.current[historyIndexRef.current])).then(() => {
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
                    loadFabricJsonSafely(canvas, JSON.parse(historyRef.current[historyIndexRef.current])).then(() => {
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
            const target = event.target as any | null;
            if (!target || !(target instanceof fabric.Textbox || target instanceof fabric.Rect)) return;
            target.lockScalingFlip = true;
            target.width = Math.max(1, target.width * target.scaleX);
            target.height = Math.max(1, target.height * target.scaleY);
            target.scaleX = 1;
            target.scaleY = 1;
            target.setCoords();
            target.dirty = true;


        };

        const handleRotating = (event: any) => {
            const target = event.target as fabric.Object | null;
            if (!target) return;
            if (!ctrlModRef.current) return;
            const angle = target.angle ?? 0;
            const snapped = Math.round(angle / 15) * 15;
            target.set("angle", snapped);
            target.setCoords();
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
        canvas.on("object:rotating", handleRotating);
        const handleAfterRender = () => {
            syncBackgroundLayer(canvas);
            updateScrollbars(canvas);
        };
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
            canvas.off("object:rotating", handleRotating);
            canvas.off("after:render", handleAfterRender);
            canvas.off("object:added", saveSnapshot);
            canvas.off("object:removed", saveSnapshot);
            canvas.off("object:modified", saveSnapshot);
            canvas.dispose();
        };
    }, [fitToBundle, resizeCanvasToContainer, syncBackgroundLayer, updateScrollbars, zoomCanvasToCenter]);

    const handleUndo = async () => {
        if (!canvas || isRestoringRef.current || historyIndexRef.current <= 0) return;
        historyIndexRef.current--;
        isRestoringRef.current = true;
        const result = await loadFabricJsonSafely(canvas, JSON.parse(historyRef.current[historyIndexRef.current]));
        if (result.missingAssets) setMissingAssetNoticeCount((count) => count + 1);
        canvas.requestRenderAll();
        isRestoringRef.current = false;
    };

    const handleRedo = async () => {
        if (!canvas || isRestoringRef.current || historyIndexRef.current >= historyRef.current.length - 1) return;
        historyIndexRef.current++;
        isRestoringRef.current = true;
        const result = await loadFabricJsonSafely(canvas, JSON.parse(historyRef.current[historyIndexRef.current]));
        if (result.missingAssets) setMissingAssetNoticeCount((count) => count + 1);
        canvas.requestRenderAll();
        isRestoringRef.current = false;
    };

    useEffect(() => {
        if (missingAssetNoticeCount === 0) return;
        setMissingAssetNoticeVisible(true);
        if (missingAssetTimeoutRef.current) {
            window.clearTimeout(missingAssetTimeoutRef.current);
        }
        missingAssetTimeoutRef.current = window.setTimeout(() => {
            setMissingAssetNoticeVisible(false);
            missingAssetTimeoutRef.current = null;
        }, 7000);
        return () => {
            if (missingAssetTimeoutRef.current) {
                window.clearTimeout(missingAssetTimeoutRef.current);
                missingAssetTimeoutRef.current = null;
            }
        };
    }, [missingAssetNoticeCount]);

    const closeMissingAssetNotice = () => {
        if (missingAssetTimeoutRef.current) {
            window.clearTimeout(missingAssetTimeoutRef.current);
            missingAssetTimeoutRef.current = null;
        }
        setMissingAssetNoticeVisible(false);
    };

    const handleZoomIn = () => {
        if (!canvas) return;
        const zoom = canvas.getZoom();
        const newZoom = Math.min(5, zoom + 0.1);
        zoomCanvasToCenter(canvas, newZoom);
    };

    const handleZoomOut = () => {
        if (!canvas) return;
        const zoom = canvas.getZoom();
        const newZoom = Math.max(0.1, zoom - 0.1);
        zoomCanvasToCenter(canvas, newZoom);
    };

    const handleActualZoom = () => {
        if (!canvas) return;
        zoomCanvasToCenter(canvas, 1);
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
        <div className="editor-root">
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
                onMissingAssets={(hasMissing) => {
                    if (hasMissing) setMissingAssetNoticeCount((count) => count + 1);
                }}
                zoomLevel={zoomLevel}
                onActualZoom={handleActualZoom}
                onHelp={() => setShowHelp(true)}
                showBackground={showBackground}
                onToggleBackground={() => setShowBackground((v) => !v)}
                initialBundle={initialBundle}
                initialSlide={initialSlide}
            />
            <div ref={containerRef} className="editorAreaContainer" style={{ position: "relative" }}>
                <div ref={bgLayerRef} className="editor-bg-layer">
                    {!showBackground ? (
                        <div className="editor-bg-checker" />
                    ) : bundleBackground.file ? (
                        isVideoFile(bundleBackground.file) ? (
                            <video
                                key={bundleBackground.file}
                                src={`/api/files/backgrounds/${encodeURIComponent(bundleBackground.file)}`}
                                autoPlay loop muted playsInline
                                className="editor-bg-media"
                            />
                        ) : (
                            <Image
                                src={`/api/files/backgrounds/${encodeURIComponent(bundleBackground.file)}`}
                                className="editor-bg-media"
                                alt="Background"
                                fill
                                sizes="100vw"
                            />
                        )
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
                {scrollbars.horizontalVisible && (
                    <div className="editor-scrollbar editor-scrollbar-horizontal" onPointerDown={handleScrollbarTrackPointerDown("horizontal")}>
                        <div
                            className="editor-scrollbar-thumb"
                            style={{
                                width: `${scrollbars.thumbWidth}px`,
                                transform: `translateX(${scrollbars.thumbLeft}px)`,
                            }}
                            onPointerDown={(event) => {
                                event.stopPropagation();
                                handleScrollbarPointerDown("horizontal")(event);
                            }}
                        />
                    </div>
                )}
                {scrollbars.verticalVisible && (
                    <div className="editor-scrollbar editor-scrollbar-vertical" onPointerDown={handleScrollbarTrackPointerDown("vertical")}>
                        <div
                            className="editor-scrollbar-thumb"
                            style={{
                                height: `${scrollbars.thumbHeight}px`,
                                transform: `translateY(${scrollbars.thumbTop}px)`,
                            }}
                            onPointerDown={(event) => {
                                event.stopPropagation();
                                handleScrollbarPointerDown("vertical")(event);
                            }}
                        />
                    </div>
                )}
                {missingAssetNoticeVisible && (
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "flex-start",
                            padding: 16,
                            zIndex: 20,
                            pointerEvents: "auto",
                        }}
                    >
                        <div
                            style={{
                                maxWidth: 420,
                                width: "100%",
                                background: "rgba(220, 38, 38, 0.96)",
                                border: "1px solid rgba(248, 113, 113, 0.95)",
                                boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
                                borderRadius: 16,
                                padding: "14px 16px 14px 18px",
                                color: "white",
                                position: "relative",
                                display: "flex",
                                alignItems: "center",
                                gap: 12,
                            }}
                        >
                            <div style={{ flex: 1, lineHeight: 1.4, fontSize: 14, fontWeight: 500 }}>
                                Missing image assets were skipped while loading this slide.
                                The editor content is still available.
                            </div>
                            <button
                                type="button"
                                onClick={closeMissingAssetNotice}
                                style={{
                                    background: "transparent",
                                    border: "none",
                                    color: "white",
                                    fontSize: 20,
                                    lineHeight: 1,
                                    cursor: "pointer",
                                    padding: 0,
                                }}
                                aria-label="Dismiss missing assets notice"
                            >
                                ×
                            </button>
                        </div>
                    </div>
                )}
            </div>
            <ContextMenu
                visible={contextMenu.visible}
                x={contextMenu.x}
                y={contextMenu.y}
                onClose={() => setContextMenu({ ...contextMenu, visible: false })}
                canvas={canvas}
            />
            {showHelp && (
                <ShortcutHelpPopup onClose={() => setShowHelp(false)}>
                    <div className="slide-picker-item" style={{ cursor: "default" }}>
                        <strong>Additional shortcuts</strong>
                        <p>Esc: close shortcut help</p>
                    </div>
                </ShortcutHelpPopup>
            )}
        </div>
    );
}
