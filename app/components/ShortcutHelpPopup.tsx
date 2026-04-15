"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

interface ShortcutHelpPopupProps {
    onClose: () => void;
    children?: ReactNode;
}

export default function ShortcutHelpPopup({ onClose, children }: ShortcutHelpPopupProps) {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    return (
        <div className="slide-picker-overlay" onClick={onClose}>
            <div className="slide-picker-modal" onClick={(e) => e.stopPropagation()}>
                <div className="slide-picker-header">
                    <span>Keyboard shortcuts</span>
                    <button className="toolbar-btn toolbar-btn-icon" onClick={onClose} title="Close">
                        <X size={15} />
                    </button>
                </div>
                <div className="slide-picker-body">
                    <div className="slide-picker-item" style={{ cursor: "default" }}>
                        <strong>Editor navigation</strong>
                        <p>Ctrl + Mouse Wheel: zoom in/out</p>
                        <p>Ctrl + Plus / Ctrl + Minus: zoom in/out in 10% steps</p>
                        <p>Ctrl + 0 (top-row zero key): reset zoom to 100% — works even if that key is labeled “=” on your layout</p>
                        <p>Middle mouse drag: pan canvas</p>
                    </div>
                    <div className="slide-picker-item" style={{ cursor: "default" }}>
                        <strong>Object editing</strong>
                        <p>Ctrl + Z: undo</p>
                        <p>Ctrl + Y / Ctrl + Shift + Z: redo</p>
                        <p>Delete / Backspace: remove selected object</p>
                        <p>Arrow keys: nudge selected object</p>
                        <p>Ctrl + Arrow: larger nudge</p>
                    </div>
                    <div className="slide-picker-item" style={{ cursor: "default" }}>
                        <strong>Rotate</strong>
                        <p>Free rotate normally</p>
                        <p>Hold Ctrl while rotating: snap to nearest 15°</p>
                    </div>
                    {children}
                </div>
            </div>
        </div>
    );
}
