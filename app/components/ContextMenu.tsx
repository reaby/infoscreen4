"use client";

import { useEffect, useRef, useState } from "react";
import * as fabric from "fabric";
import { FabricVideo } from "./FabricVideo";
import "../styles/contextmenu.css";

interface ContextMenuProps {
    x: number;
    y: number;
    visible: boolean;
    onClose: () => void;
    canvas: fabric.Canvas | null;
}

export default function ContextMenu({
    x,
    y,
    visible,
    onClose,
    canvas,
}: ContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);
    const [submenuOpen, setSubmenuOpen] = useState(false);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        if (visible) {
            document.addEventListener("mousedown", handleClickOutside);
            return () => {
                document.removeEventListener("mousedown", handleClickOutside);
            };
        }
    }, [visible, onClose]);

    if (!visible || !canvas) return null;

    const handleDuplicate = async () => {
        const activeObjects = canvas.getActiveObjects();
        if (!activeObjects || activeObjects.length == 0) return;

        for (const activeObject of activeObjects) {
            try {
                // `clone()` can fail for custom/media objects (e.g. FabricVideo).
                // Use a type-aware fallback to avoid runtime crashes in Fabric internals.
                let cloned: fabric.FabricObject;
                const raw = activeObject.toObject();
                if ((raw as { type?: string }).type === "FabricVideo") {
                    cloned = await FabricVideo.fromObject(raw as Record<string, unknown>);
                } else if ((raw as { type?: string }).type === "image") {
                    cloned = await fabric.FabricImage.fromObject(raw as Record<string, unknown>);
                } else {
                    cloned = await activeObject.clone();
                }

                cloned.set({
                    left: (cloned.left || 0) + 10,
                    top: (cloned.top || 0) + 10,
                });
                canvas.add(cloned);
            } catch {
                // Ignore objects that cannot be duplicated safely.
            }
        }
        canvas.requestRenderAll();
        onClose();
    };

    const handleDelete = () => {
        const activeObjects = canvas.getActiveObjects();
        if (!activeObjects || activeObjects.length == 0) return;
        for (const activeObject of activeObjects) {
            canvas.remove(activeObject);
        }
        canvas.requestRenderAll();
        onClose();
    };

    const handleBringToFront = () => {
        const activeObject = canvas.getActiveObject();
        if (!activeObject) return;

        canvas.bringObjectToFront(activeObject);
        canvas.requestRenderAll();
        onClose();
    };

    const handleSendToBack = () => {
        const activeObject = canvas.getActiveObject();
        if (!activeObject) return;

        canvas.sendObjectToBack(activeObject);
        canvas.requestRenderAll();
        onClose();
    };

    const handleSendForward = () => {
        const activeObject = canvas.getActiveObject();
        if (!activeObject) return;

        canvas.bringObjectForward(activeObject);
        canvas.requestRenderAll();
        onClose();
    };

    const handleSendBackward = () => {
        const activeObject = canvas.getActiveObject();
        if (!activeObject) return;

        canvas.sendObjectBackwards(activeObject);
        canvas.requestRenderAll();
        onClose();
    };

    return (
        <div
            ref={menuRef}
            className="context-menu"
            style={{
                position: "fixed",
                left: `${x}px`,
                top: `${y}px`,
            }}
        >
            <button onClick={handleDuplicate} className="context-menu-item">
                Duplicate
            </button>
            <div className="context-menu-separator" />
            <div
                className="context-menu-submenu-wrapper"
                onMouseEnter={() => setSubmenuOpen(true)}
                onMouseLeave={() => setSubmenuOpen(false)}
            >
                <button className="context-menu-item context-menu-submenu-trigger">
                    Arrange ▶
                </button>
                {submenuOpen && (
                    <div className="context-menu-submenu">
                        <button onClick={handleBringToFront} className="context-menu-item">
                            Bring to Front
                        </button>
                        <button onClick={handleSendForward} className="context-menu-item">
                            Send Forward
                        </button>
                        <button onClick={handleSendBackward} className="context-menu-item">
                            Send Backward
                        </button>
                        <button onClick={handleSendToBack} className="context-menu-item">
                            Send to Back
                        </button>
                    </div>
                )}
            </div>
            <div className="context-menu-separator" />
            <button
                onClick={handleDelete}
                className="context-menu-item context-menu-item-danger"
            >
                Delete
            </button>
        </div>
    );
}
