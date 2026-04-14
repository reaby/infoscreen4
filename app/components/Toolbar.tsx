"use client";

import { useState, useEffect, useRef } from "react";
import * as fabric from "fabric";
import { RgbaColorPicker } from "react-colorful";
import type { RgbaColor } from "react-colorful";
import { AlignLeft, AlignCenter, AlignRight, AlignJustify, AlignHorizontalJustifyCenter, AlignVerticalJustifyCenter, Crosshair, AlignStartVertical, AlignEndVertical, Undo2, Redo2, Bold, Italic, Underline, RectangleHorizontal, Type, ZoomIn, ZoomOut, Maximize2, Trash2, Save, FolderOpen, FolderPlus, ChevronDown, ImageIcon, Film } from "lucide-react";
import SlidePickerModal from "./SlidePickerModal";
import FileManagerDialog from "./FileManagerDialog";
import { FabricVideo } from "./FabricVideo";

interface ToolbarProps {
    canvas: fabric.Canvas | null;
    onZoomIn?: () => void;
    onZoomOut?: () => void;
    onResetZoom?: () => void;
    onUndo?: () => void;
    onRedo?: () => void;
    onClearCanvas?: () => void;
    onBundleMeta?: (meta: { width?: number; height?: number; backgroundColor?: string; backgroundFile?: string }) => void;
    initialBundle?: string;
    initialSlide?: string;
    showBackground?: boolean;
    onToggleBackground?: () => void;
}

export default function Toolbar({ canvas, onZoomIn, onZoomOut, onResetZoom, onUndo, onRedo, onClearCanvas, onBundleMeta, initialBundle, initialSlide, showBackground, onToggleBackground }: ToolbarProps) {
    const [fillColor, setFillColor] = useState<RgbaColor>({ r: 56, g: 189, b: 248, a: 1 });
    const [strokeColor, setStrokeColor] = useState<RgbaColor>({ r: 0, g: 0, b: 0, a: 1 });
    const [strokeWidth, setStrokeWidth] = useState(0);
    const [fontFamily, setFontFamily] = useState("Arial");
    const [fontSize, setFontSize] = useState(24);
    const [bold, setBold] = useState(false);
    const [italic, setItalic] = useState(false);
    const [underline, setUnderline] = useState(false);
    const [fillPresetsOpen, setFillPresetsOpen] = useState(false);
    const [strokePresetsOpen, setStrokePresetsOpen] = useState(false);

    // Bundle / slide state
    const [bundles, setBundles] = useState<string[]>([]);
    const [activeBundle, setActiveBundle] = useState(initialBundle ?? "default");
    const [slidePickerOpen, setSlidePickerOpen] = useState(false);
    const [mediaPickerMode, setMediaPickerMode] = useState<"image" | "video" | null>(null);
    const [bundleSize, setBundleSize] = useState({ width: 1920, height: 1080 });

    const isVideoFile = (name: string) => /\.(mp4|webm|ogg)$/i.test(name);

    const fetchBundles = () =>
        fetch("/api/bundles").then((r) => r.json()).then((d) => {
            if (Array.isArray(d)) setBundles(d);
        }).catch(() => {});

    useEffect(() => { fetchBundles(); }, []);

    // Auto-load initialSlide when canvas becomes available
    useEffect(() => {
        if (!canvas || !initialSlide) return;
        fetch(`/api/bundles/${encodeURIComponent(initialBundle ?? "default")}/slides/${encodeURIComponent(initialSlide)}`)
            .then((r) => r.ok ? r.json() : null)
            .then((json) => { if (json) { canvas.loadFromJSON(json).then(() => canvas.requestRenderAll()); } })
            .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canvas]);

    useEffect(() => {
        if (!onBundleMeta) return;
        fetch(`/api/bundles/${encodeURIComponent(activeBundle)}`)
            .then((r) => r.json())
            .then((m) => {
                const width = m?.width ?? 1920;
                const height = m?.height ?? 1080;
                setBundleSize({ width, height });
                onBundleMeta({ width, height, backgroundColor: m?.backgroundColor, backgroundFile: m?.backgroundFile });
            })
            .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeBundle]);

    const handleSave = async () => {
        if (!canvas) return;
        const defaultName = `slide-${Date.now()}`;
        const name = window.prompt("Slide name:", defaultName)?.trim().replace(/[^a-zA-Z0-9_-]/g, "-");
        if (!name) return;
        await fetch(`/api/bundles/${encodeURIComponent(activeBundle)}/slides/${encodeURIComponent(name)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(canvas.toJSON()),
        });
    };

    const handleLoad = () => {
        if (!canvas) return;
        setSlidePickerOpen(true);
    };

    const handleSlideSelect = async (slide: string) => {
        setSlidePickerOpen(false);
        if (!canvas) return;
        const res = await fetch(`/api/bundles/${encodeURIComponent(activeBundle)}/slides/${encodeURIComponent(slide)}`);
        if (!res.ok) return;
        const json = await res.json();
        await canvas.loadFromJSON(json);
        canvas.requestRenderAll();
    };

    const handleNewBundle = () => {
        const name = window.prompt("New bundle name:")?.trim().replace(/[^a-zA-Z0-9_-]/g, "-");
        if (!name) return;
        fetch("/api/bundles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
        }).then(() => { fetchBundles(); setActiveBundle(name); }).catch(() => {});
    };

    const rgbaToString = ({ r, g, b, a }: RgbaColor) => `rgba(${r},${g},${b},${a})`;
    const parseToRgba = (color: string): RgbaColor | null => {
        try {
            const [r, g, b, a] = new fabric.Color(color).getSource();
            return { r, g, b, a };
        } catch {
            return null;
        }
    };
    const hexToRgba = (hex: string): RgbaColor => parseToRgba(hex) ?? { r: 0, g: 0, b: 0, a: 1 };
    const fillDropdownRef = useRef<HTMLDivElement>(null);
    const strokeDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleOutsideClick = (e: MouseEvent) => {
            if (fillDropdownRef.current && !fillDropdownRef.current.contains(e.target as Node)) {
                setFillPresetsOpen(false);
            }
            if (strokeDropdownRef.current && !strokeDropdownRef.current.contains(e.target as Node)) {
                setStrokePresetsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleOutsideClick);
        return () => document.removeEventListener("mousedown", handleOutsideClick);
    }, []);

    useEffect(() => {
        if (!canvas) return;

        const syncFromObject = () => {
            const obj = canvas.getActiveObject();
            if (!obj) return;
            const fill = obj.get("fill");
            if (typeof fill === "string") { const c = parseToRgba(fill); if (c) setFillColor(c); }
            const stroke = obj.get("stroke");
            if (typeof stroke === "string") { const c = parseToRgba(stroke); if (c) setStrokeColor(c); }
            setStrokeWidth(obj.get("strokeWidth") ?? 0);
            if (obj instanceof fabric.IText) {
                setFontFamily(obj.get("fontFamily") ?? "Arial");
                setFontSize(obj.get("fontSize") ?? 24);
                setBold(obj.get("fontWeight") === "bold");
                setItalic(obj.get("fontStyle") === "italic");
                setUnderline(obj.get("underline") ?? false);
            }
        };

        canvas.on("selection:created", syncFromObject);
        canvas.on("selection:updated", syncFromObject);

        return () => {
            canvas.off("selection:created", syncFromObject);
            canvas.off("selection:updated", syncFromObject);
        };
    }, [canvas]);

    const colorPresets = [
        // Row 1: neutrals
        "#000000", "#ffffff", "#374151", "#6b7280", "#e2e8f0",
        // Row 2: red range (~350°→25°)
        "#f43f5e", "#ef4444", "#92400e", "#f97316", "#f59e0b",
        // Row 3: yellow→teal (~45°→174°)
        "#eab308", "#84cc16", "#22c55e", "#10b981", "#14b8a6",
        // Row 4: blue→pink (~199°→330°)
        "#38bdf8", "#3b82f6", "#6366f1", "#a855f7", "#ec4899",
    ];
    const addRectangle = () => {
        if (!canvas) return;

        const rect = new fabric.Rect({
            left: 100,
            top: 100,
            width: 150,
            height: 100,
            fill: "#38bdf8",
        });
        canvas.add(rect);
        canvas.requestRenderAll();
    };

    const addCircle = () => {
        if (!canvas) return;

        const circle = new fabric.Circle({
            left: 150,
            top: 150,
            radius: 50,
            fill: "#fb7185",
        });
        canvas.add(circle);
        canvas.requestRenderAll();
    };

    const addText = () => {

        if (!canvas) return;

        const text = new fabric.IText("Text", {
            left: 100,
            top: 100,
            fontSize: 24,
            fill: "#000000",
            lockScalingX: true,
            lockScalingY: true,
        });
        canvas.add(text);
        canvas.requestRenderAll();
    };

    const addImageFromFile = async (filename: string) => {
        if (!canvas) return;
        const fileUrl = `/api/files/images/${encodeURIComponent(filename)}`;
        const image = await fabric.FabricImage.fromURL(fileUrl);
        const center = canvas.getCenterPoint();
        image.set({
            left: center.x,
            top: center.y,
            originX: "center",
            originY: "center",
        });
        canvas.add(image);
        canvas.setActiveObject(image);
        canvas.requestRenderAll();
    };

    const addVideoFromFile = (filename: string) => {
        if (!canvas) return;
        const fileUrl = `/api/files/backgrounds/${encodeURIComponent(filename)}`;
        const videoEl = document.createElement("video");
        videoEl.src = fileUrl;
        videoEl.loop = true;
        videoEl.muted = true;
        videoEl.playsInline = true;
        videoEl.width = 640;
        videoEl.height = 360;
        videoEl.play().catch(() => {});

        const center = canvas.getCenterPoint();
        const video = new FabricVideo(videoEl, {
            left: center.x,
            top: center.y,
            originX: "center",
            originY: "center",
            videoSrc: fileUrl,
            videoElWidth: 640,
            videoElHeight: 360,
            loop: true,
            muted: true,
        });
        canvas.add(video);
        canvas.setActiveObject(video);
        canvas.requestRenderAll();
    };

    const handleMediaSelect = async (filename: string) => {
        const mode = mediaPickerMode;
        setMediaPickerMode(null);
        if (!mode) return;

        if (mode === "image") {
            if (isVideoFile(filename)) return;
            await addImageFromFile(filename);
            return;
        }

        if (!isVideoFile(filename)) return;
        addVideoFromFile(filename);
    };

    const clearCanvas = () => {
        if (!canvas) return;
        if (onClearCanvas) {
            onClearCanvas();
        } else {
            canvas.clear();
        }
    };

    const handleColorChange = (color: RgbaColor) => {
        setFillColor(color);
        const css = rgbaToString(color);

        if (!canvas) return;

        const activeObject = canvas.getActiveObject();
        if (!activeObject) return;

        if (activeObject instanceof fabric.Textbox) {
            const selectionStart = activeObject.selectionStart ?? 0;
            const selectionEnd = activeObject.selectionEnd ?? 0;

            if (selectionStart !== selectionEnd) {
                activeObject.setSelectionStyles({ fill: css }, selectionStart, selectionEnd);
                activeObject.dirty = true;
                canvas.requestRenderAll();
                if (activeObject.isEditing) {
                    activeObject.initDimensions();
                    activeObject.setCoords();
                }
                canvas.requestRenderAll();
                return;
            }
        }

        activeObject.set({ fill: css });
        canvas.requestRenderAll();
    };

    const handleStrokeColorChange = (color: RgbaColor) => {
        setStrokeColor(color);
        const css = rgbaToString(color);
        if (!canvas) return;
        const activeObject = canvas.getActiveObject();
        if (!activeObject) return;
        if (activeObject instanceof fabric.Textbox) {
            const selectionStart = activeObject.selectionStart ?? 0;
            const selectionEnd = activeObject.selectionEnd ?? 0;
            if (selectionStart !== selectionEnd) {
                activeObject.setSelectionStyles({ stroke: css }, selectionStart, selectionEnd);
                activeObject.dirty = true;
                if (activeObject.isEditing) {
                    activeObject.initDimensions();
                    activeObject.setCoords();
                }
                canvas.requestRenderAll();
                return;
            }
        }
        activeObject.set({ stroke: css, paintFirst: "stroke" });
        canvas.requestRenderAll();
    };

    const handleStrokeWidthChange = (width: number) => {
        setStrokeWidth(width);
        if (!canvas) return;
        const activeObject = canvas.getActiveObject();
        if (!activeObject) return;
        activeObject.set({ strokeWidth: width, paintFirst: "stroke" });
        canvas.requestRenderAll();
    };

    const fontFamilies = [
        "Arial", "Arial Black", "Verdana", "Tahoma", "Trebuchet MS",
        "Georgia", "Times New Roman", "Courier New", "Impact",
        "Comic Sans MS", "Palatino", "Garamond", "Bookman",
    ];

    const handleFontFamily = (family: string) => {
        setFontFamily(family);
        if (!canvas) return;
        const obj = canvas.getActiveObject();
        if (!obj || !(obj instanceof fabric.IText)) return;
        obj.set({ fontFamily: family });
        canvas.requestRenderAll();
    };

    const handleFontSize = (size: number) => {
        setFontSize(size);
        if (!canvas) return;
        const obj = canvas.getActiveObject();
        if (!obj || !(obj instanceof fabric.IText)) return;
        obj.set({ fontSize: size });
        canvas.requestRenderAll();
    };

    const handleToggleBold = () => {
        if (!canvas) return;
        const obj = canvas.getActiveObject();
        if (!obj || !(obj instanceof fabric.IText)) return;
        const next = obj.get("fontWeight") === "bold" ? "normal" : "bold";
        obj.set({ fontWeight: next });
        setBold(next === "bold");
        canvas.requestRenderAll();
    };

    const handleToggleItalic = () => {
        if (!canvas) return;
        const obj = canvas.getActiveObject();
        if (!obj || !(obj instanceof fabric.IText)) return;
        const next = obj.get("fontStyle") === "italic" ? "normal" : "italic";
        obj.set({ fontStyle: next });
        setItalic(next === "italic");
        canvas.requestRenderAll();
    };

    const handleToggleUnderline = () => {
        if (!canvas) return;
        const obj = canvas.getActiveObject();
        if (!obj || !(obj instanceof fabric.IText)) return;
        const next = !obj.get("underline");
        obj.set({ underline: next });
        setUnderline(next);
        canvas.requestRenderAll();
    };

    const handleCenterObject = (axis: "h" | "v" | "both") => {
        if (!canvas) return;
        const activeObjects = canvas.getActiveObjects();
        if (activeObjects.length === 0) return;

        if (activeObjects.length === 1) {
            const obj = activeObjects[0];
            const center = obj.getCenterPoint();
            const targetX = (axis === "h" || axis === "both") ? (bundleSize.width / 2) : center.x;
            const targetY = (axis === "v" || axis === "both") ? (bundleSize.height / 2) : center.y;
            obj.setPositionByOrigin(new fabric.Point(targetX, targetY), "center", "center");
            obj.setCoords();
        } else {
            // In an ActiveSelection, (0,0) is the center of the selection's bounding box.
            // Moving each object's center there aligns it within the group.
            activeObjects.forEach(obj => {
                // getRelativeCenterPoint() returns center in parent-local (AS) space,
                // which is what setPositionByOrigin expects. getCenterPoint() would
                // return canvas-space coords and produce wrong results.
                const center = obj.getRelativeCenterPoint();
                const newX = (axis === "h" || axis === "both") ? 0 : center.x;
                const newY = (axis === "v" || axis === "both") ? 0 : center.y;
                obj.setPositionByOrigin(new fabric.Point(newX, newY), "center", "center");
                obj.setCoords();
            });
            // canvas.getActiveObject()?.setCoords();
        }
        canvas.requestRenderAll();
    };

    const handleAlignEdge = (edge: "left" | "right") => {
        if (!canvas) return;
        const activeObjects = canvas.getActiveObjects();
        if (activeObjects.length < 2) return;
        const selection = canvas.getActiveObject() as fabric.ActiveSelection;
        const halfW = selection.width / 2;
        activeObjects.forEach(obj => {
            const relCenter = obj.getRelativeCenterPoint();
            const halfObjW = obj.getScaledWidth() / 2;
            const newX = edge === "left" ? -halfW + halfObjW : halfW - halfObjW;
            obj.setPositionByOrigin(new fabric.Point(newX, relCenter.y), "center", "center");
            obj.setCoords();
        });
        canvas.getActiveObject()?.setCoords();
        canvas.requestRenderAll();
    };

    const handleTextAlign = (align: string) => {
        if (!canvas) return;
        const activeObject = canvas.getActiveObject();
        if (!activeObject || !(activeObject instanceof fabric.Textbox)) return;
        activeObject.set({ textAlign: align });
        canvas.requestRenderAll();
    };

    return (
        <>
        <div className="toolbar">
            <button onClick={onUndo} className="toolbar-btn toolbar-btn-icon" disabled={!canvas} title="Undo (Ctrl+Z)"><Undo2 size={15} /></button>
            <button onClick={onRedo} className="toolbar-btn toolbar-btn-icon" disabled={!canvas} title="Redo (Ctrl+Y)"><Redo2 size={15} /></button>
            <div className="toolbar-separator" />
            <button onClick={addRectangle} className="toolbar-btn toolbar-btn-icon" title="Add Rectangle"><RectangleHorizontal size={15} /></button>
            <button onClick={addText} className="toolbar-btn toolbar-btn-icon" title="Add Text"><Type size={15} /></button>
            <button onClick={() => setMediaPickerMode("image")} className="toolbar-btn toolbar-btn-icon" disabled={!canvas} title="Add Image from file"><ImageIcon size={15} /></button>
            <button onClick={() => setMediaPickerMode("video")} className="toolbar-btn toolbar-btn-icon" disabled={!canvas} title="Add Video from file"><Film size={15} /></button>
            <div className="toolbar-separator" />
            <button onClick={onZoomIn} className="toolbar-btn toolbar-btn-icon" disabled={!canvas} title="Zoom In"><ZoomIn size={15} /></button>
            <button onClick={onZoomOut} className="toolbar-btn toolbar-btn-icon" disabled={!canvas} title="Zoom Out"><ZoomOut size={15} /></button>
            <button onClick={onResetZoom} className="toolbar-btn toolbar-btn-icon" disabled={!canvas} title="Reset Zoom"><Maximize2 size={15} /></button>
            <div className="toolbar-separator" />
            <button
                onClick={onToggleBackground}
                className={`toolbar-btn toolbar-btn-icon${showBackground ? " toolbar-btn-active" : ""}`}
                title={showBackground ? "Hide bundle background" : "Show bundle background"}
            ><ImageIcon size={15} /></button>
            <div className="toolbar-separator" />
            <div className="toolbar-group">
                <label className="toolbar-label">Fill</label>
                <div className="toolbar-presets-dropdown" ref={fillDropdownRef}>
                    <button className="toolbar-color-swatch" onClick={() => setFillPresetsOpen(o => !o)} disabled={!canvas} title="Fill color">
                        <span className="toolbar-color-swatch-inner" style={{ background: rgbaToString(fillColor) }} />
                    </button>
                    {fillPresetsOpen && (
                        <div className="toolbar-presets-popover">
                            <RgbaColorPicker color={fillColor} onChange={handleColorChange} />
                            <div className="toolbar-color-presets">
                                {colorPresets.map((color) => (
                                    <button key={color} className="toolbar-color-preset" style={{ "--preset-color": color } as React.CSSProperties} onClick={() => { handleColorChange(hexToRgba(color)); setFillPresetsOpen(false); }} title={color} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <div className="toolbar-group">
                <label className="toolbar-label">Stroke</label>
                <div className="toolbar-presets-dropdown" ref={strokeDropdownRef}>
                    <button className="toolbar-color-swatch" onClick={() => setStrokePresetsOpen(o => !o)} disabled={!canvas} title="Stroke color">
                        <span className="toolbar-color-swatch-inner" style={{ background: rgbaToString(strokeColor) }} />
                    </button>
                    {strokePresetsOpen && (
                        <div className="toolbar-presets-popover">
                            <RgbaColorPicker color={strokeColor} onChange={handleStrokeColorChange} />
                            <div className="toolbar-color-presets">
                                {colorPresets.map((color) => (
                                    <button key={color} className="toolbar-color-preset" style={{ "--preset-color": color } as React.CSSProperties} onClick={() => { handleStrokeColorChange(hexToRgba(color)); setStrokePresetsOpen(false); }} title={color} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <input type="number" min={0} max={100} value={strokeWidth} onChange={(e) => handleStrokeWidthChange(Number(e.target.value))} className="toolbar-number-input" disabled={!canvas} title="Stroke width" />
            </div>
            <div className="toolbar-separator" />
            <div className="toolbar-group">
                <button onClick={() => handleCenterObject("h")} className="toolbar-btn toolbar-btn-icon" disabled={!canvas} title="Center Horizontally"><AlignHorizontalJustifyCenter size={15} /></button>
                <button onClick={() => handleCenterObject("v")} className="toolbar-btn toolbar-btn-icon" disabled={!canvas} title="Center Vertically"><AlignVerticalJustifyCenter size={15} /></button>
                <button onClick={() => handleCenterObject("both")} className="toolbar-btn toolbar-btn-icon" disabled={!canvas} title="Center Both"><Crosshair size={15} /></button>
                <button onClick={() => handleAlignEdge("left")} className="toolbar-btn toolbar-btn-icon" disabled={!canvas} title="Align Left Edges"><AlignStartVertical size={15} /></button>
                <button onClick={() => handleAlignEdge("right")} className="toolbar-btn toolbar-btn-icon" disabled={!canvas} title="Align Right Edges"><AlignEndVertical size={15} /></button>
            </div>
            <div className="toolbar-separator" />
            <div className="toolbar-group">
                <select value={fontFamily} onChange={(e) => handleFontFamily(e.target.value)} className="toolbar-select" disabled={!canvas}>
                    {fontFamilies.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                </select>
                <input type="number" min={6} max={400} value={fontSize} onChange={(e) => handleFontSize(Number(e.target.value))} className="toolbar-number-input" disabled={!canvas} title="Font size" />
                <button onClick={handleToggleBold} className={`toolbar-btn toolbar-btn-icon${bold ? " toolbar-btn-active" : ""}`} disabled={!canvas} title="Bold"><Bold size={15} /></button>
                <button onClick={handleToggleItalic} className={`toolbar-btn toolbar-btn-icon${italic ? " toolbar-btn-active" : ""}`} disabled={!canvas} title="Italic"><Italic size={15} /></button>
                <button onClick={handleToggleUnderline} className={`toolbar-btn toolbar-btn-icon${underline ? " toolbar-btn-active" : ""}`} disabled={!canvas} title="Underline"><Underline size={15} /></button>
            </div>
            <div className="toolbar-separator" />
            <div className="toolbar-group">
                <button onClick={() => handleTextAlign("left")} className="toolbar-btn toolbar-btn-icon" disabled={!canvas} title="Align Left"><AlignLeft size={15} /></button>
                <button onClick={() => handleTextAlign("center")} className="toolbar-btn toolbar-btn-icon" disabled={!canvas} title="Align Center"><AlignCenter size={15} /></button>
                <button onClick={() => handleTextAlign("right")} className="toolbar-btn toolbar-btn-icon" disabled={!canvas} title="Align Right"><AlignRight size={15} /></button>
                <button onClick={() => handleTextAlign("justify")} className="toolbar-btn toolbar-btn-icon" disabled={!canvas} title="Justify"><AlignJustify size={15} /></button>
            </div>
            <div className="toolbar-separator" />
            <button onClick={clearCanvas} className="toolbar-btn toolbar-btn-icon toolbar-btn-danger" title="Clear canvas"><Trash2 size={15} /></button>
            <div className="toolbar-separator" />
            <div className="toolbar-group">
                <div className="toolbar-bundle-select-wrapper">
                    <select
                        value={activeBundle}
                        onChange={(e) => setActiveBundle(e.target.value)}
                        className="toolbar-select"
                        title="Active bundle"
                    >
                        {bundles.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                    <ChevronDown size={12} className="toolbar-bundle-chevron" />
                </div>
                <button onClick={handleNewBundle} className="toolbar-btn toolbar-btn-icon" title="New bundle"><FolderPlus size={15} /></button>
                <button onClick={handleSave} className="toolbar-btn toolbar-btn-icon" disabled={!canvas} title="Save slide"><Save size={15} /></button>
                <button onClick={handleLoad} className="toolbar-btn toolbar-btn-icon" disabled={!canvas} title="Load slide"><FolderOpen size={15} /></button>
            </div>
        </div>
        {slidePickerOpen && (
            <SlidePickerModal
                bundle={activeBundle}
                onSelect={handleSlideSelect}
                onClose={() => setSlidePickerOpen(false)}
            />
        )}
        {mediaPickerMode && (
            <FileManagerDialog
                basePath={mediaPickerMode === "image" ? "/api/files/images" : "/api/files/backgrounds"}
                onSelect={(filename) => { handleMediaSelect(filename).catch(() => {}); }}
                onClose={() => setMediaPickerMode(null)}
            />
        )}
    </>
    );
}
