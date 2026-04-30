"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2, Copy } from "lucide-react";

interface Props {
    bundle: string;
    onSelect: (slide: string) => void;
    onClose: () => void;
}

export default function SlidePickerModal({ bundle, onSelect, onClose }: Props) {
    const defer = (fn: () => void) => queueMicrotask(fn);
    const [slides, setSlides] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

    const loadSlides = useCallback(() => {
        setLoading(true);
        fetch(`/api/bundles/${encodeURIComponent(bundle)}/slides`)
            .then((r) => r.json())
            .then((data) => { setSlides(Array.isArray(data) ? data : []); })
            .catch(() => setSlides([]))
            .finally(() => setLoading(false));
    }, [bundle]);

    useEffect(() => {
        defer(loadSlides);
    }, [loadSlides]);

    const handleDelete = async (name: string) => {
        await fetch(`/api/bundles/${encodeURIComponent(bundle)}/slides/${encodeURIComponent(name)}`, {
            method: "DELETE",
        });
        setConfirmDelete(null);
        loadSlides();
    };

    const handleDuplicate = async (name: string) => {
        const newName = window.prompt("Duplicate as:", `${name}-copy`)?.trim().replace(/[^a-zA-Z0-9_\- ]/g, "-");
        if (!newName) return;
        const res = await fetch(`/api/bundles/${encodeURIComponent(bundle)}/slides/${encodeURIComponent(name)}`);
        if (!res.ok) return;
        const body = await res.text();
        await fetch(`/api/bundles/${encodeURIComponent(bundle)}/slides/${encodeURIComponent(newName)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
        });
        loadSlides();
    };

    return (
        <div className="slide-picker-overlay" onClick={onClose}>
            <div className="slide-picker-modal" onClick={(e) => e.stopPropagation()}>
                <div className="slide-picker-header">
                    <span>Load slide — <strong>{bundle}</strong></span>
                    <button className="toolbar-btn toolbar-btn-icon" onClick={onClose} title="Close">✕</button>
                </div>
                <div className="slide-picker-body">
                    {loading && <span className="toolbar-label">Loading…</span>}
                    {!loading && slides.length === 0 && (
                        <span className="toolbar-label">No slides saved in this bundle yet.</span>
                    )}
                    {!loading && slides.map((name) => (
                        <div key={name} className="slide-picker-row">
                            <button className="slide-picker-item" onClick={() => onSelect(name)}>
                                {name}
                            </button>
                            {confirmDelete === name ? (
                                <div className="slide-picker-confirm">
                                    <span className="toolbar-label">Delete?</span>
                                    <button className="toolbar-btn toolbar-btn-icon toolbar-btn-danger" onClick={() => handleDelete(name)} title="Confirm delete">Yes</button>
                                    <button className="toolbar-btn toolbar-btn-icon" onClick={() => setConfirmDelete(null)} title="Cancel">No</button>
                                </div>
                            ) : (
                                <>
                                    <button
                                        className="toolbar-btn toolbar-btn-icon slide-picker-action"
                                        onClick={() => handleDuplicate(name)}
                                        title="Duplicate slide"
                                    >
                                        <Copy size={13} />
                                    </button>
                                    <button
                                        className="toolbar-btn toolbar-btn-icon toolbar-btn-danger slide-picker-action"
                                        onClick={() => setConfirmDelete(name)}
                                        title="Delete slide"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
