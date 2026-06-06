"use client";

import { useEffect, useState } from "react";

interface Props {
    onSelect: (slide: string) => void;
    onClose: () => void;
}

export default function GlobalSlidePickerModal({ onSelect, onClose }: Props) {
    const [slides, setSlides] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;

        fetch("/api/slides")
            .then((r) => r.json())
            .then((data) => {
                if (!active) return;
                setSlides(Array.isArray(data) ? data : []);
            })
            .catch(() => {
                if (!active) return;
                setSlides([]);
            })
            .finally(() => {
                if (!active) return;
                setLoading(false);
            });

        return () => {
            active = false;
        };
    }, []);

    return (
        <div className="slide-picker-overlay" onClick={onClose}>
            <div className="slide-picker-modal" onClick={(e) => e.stopPropagation()}>
                <div className="slide-picker-header">
                    <span>Assign global slide</span>
                    <button className="toolbar-btn toolbar-btn-icon" onClick={onClose} title="Close">✕</button>
                </div>
                <div className="slide-picker-body">
                    {loading && <span className="toolbar-label">Loading…</span>}
                    {!loading && slides.length === 0 && (
                        <span className="toolbar-label">No global slides available yet.</span>
                    )}
                    {!loading && slides.map((name) => (
                        <button
                            key={name}
                            className="slide-picker-item"
                            onClick={() => onSelect(name)}
                        >
                            {name}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
