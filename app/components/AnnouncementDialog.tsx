"use client";

import { useState } from "react";
import { X } from "lucide-react";

const DEFAULT_COLOR = "#d32f2f";

export interface AnnouncementDialogProps {
    selectedDisplayName?: string | null;
    initialLine1?: string;
    initialLine2?: string;
    initialColor?: string;
    onShow: (line1: string, line2: string, color: string) => void;
    onShowAll: (line1: string, line2: string, color: string) => void;
    onClearAll: () => void;
    onClose: () => void;
}

export default function AnnouncementDialog({
    selectedDisplayName,
    initialLine1,
    initialLine2,
    initialColor,
    onShow,
    onShowAll,
    onClearAll,
    onClose,
}: AnnouncementDialogProps) {
    const [line1, setLine1] = useState(initialLine1 ?? "");
    const [line2, setLine2] = useState(initialLine2 ?? "");
    const [color, setColor] = useState(initialColor ?? DEFAULT_COLOR);

    const hasText = line1.trim() !== "" || line2.trim() !== "";

    return (
        <div className="slide-picker-overlay" onClick={onClose}>
            <div className="slide-picker-modal" onClick={(e) => e.stopPropagation()} style={{ width: 420 }}>
                <div className="slide-picker-header">
                    <span>Announcement</span>
                    <button className="toolbar-btn toolbar-btn-icon" onClick={onClose} title="Close">
                        <X size={14} />
                    </button>
                </div>
                <div className="slide-picker-body" style={{ gap: 10 }}>
                    <input
                        type="text"
                        placeholder="Line 1"
                        value={line1}
                        onChange={(e) => setLine1(e.target.value)}
                        style={{ width: "100%", padding: "8px", background: "#3a3a3a", color: "white", border: "1px solid #555", fontSize: 14 }}
                        autoFocus
                    />
                    <input
                        type="text"
                        placeholder="Line 2 (optional)"
                        value={line2}
                        onChange={(e) => setLine2(e.target.value)}
                        style={{ width: "100%", padding: "8px", background: "#3a3a3a", color: "white", border: "1px solid #555", fontSize: 14 }}
                    />
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className="toolbar-label">Background color</span>
                        <input
                            type="color"
                            value={color}
                            onChange={(e) => setColor(e.target.value)}
                            style={{ width: 40, height: 28, padding: 0, border: "1px solid #555", background: "none" }}
                        />
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                        <button
                            className="fm-btn primary"
                            disabled={!hasText}
                            onClick={() => { onShow(line1, line2, color); onClose(); }}
                            title={selectedDisplayName ? `Show on ${selectedDisplayName}` : "Show on selected display"}
                        >
                            Show Display
                        </button>
                        <button
                            className="fm-btn primary"
                            disabled={!hasText}
                            onClick={() => { onShowAll(line1, line2, color); onClose(); }}
                        >
                            Show All Displays
                        </button>
                        <button className="fm-btn danger" onClick={() => { onClearAll(); onClose(); }}>
                            Clear
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
