"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, Trash2, X, Type, Plus } from "lucide-react";

interface Props {
    onClose: () => void;
    onChange: () => void;
}

const FONTS_BASE = "/api/files/fonts";
const GOOGLE_FONTS_BASE = "/api/google-fonts";

function familyFromFilename(filename: string): string {
    return filename.replace(/\.(woff2?|ttf|otf)$/i, "");
}

export default function FontManagerDialog({ onClose, onChange }: Props) {
    const [uploaded, setUploaded] = useState<string[]>([]);
    const [google, setGoogle] = useState<string[]>([]);
    const [googleInput, setGoogleInput] = useState("");
    const [uploading, setUploading] = useState(false);
    const [addingGoogle, setAddingGoogle] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const load = useCallback(async () => {
        setError(null);
        try {
            const [files, families]: [string[], string[]] = await Promise.all([
                fetch(FONTS_BASE).then((r) => r.json()),
                fetch(GOOGLE_FONTS_BASE).then((r) => r.json()),
            ]);
            setUploaded(files);
            setGoogle(families);
        } catch {
            setError("Failed to load fonts");
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        setError(null);
        try {
            const form = new FormData();
            form.append("file", file);
            const res = await fetch(FONTS_BASE, { method: "POST", body: form });
            if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                throw new Error(j.error ?? "Upload failed");
            }
            await load();
            onChange();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Upload failed");
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleDeleteUploaded = async (name: string) => {
        if (!confirm(`Delete "${familyFromFilename(name)}"? Slides already using it will fall back to the default font.`)) return;
        setError(null);
        try {
            await fetch(`${FONTS_BASE}/${encodeURIComponent(name)}`, { method: "DELETE" });
            await load();
            onChange();
        } catch {
            setError("Delete failed");
        }
    };

    const handleAddGoogle = async () => {
        const family = googleInput.trim();
        if (!family) return;
        setAddingGoogle(true);
        setError(null);
        try {
            const res = await fetch(GOOGLE_FONTS_BASE, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ family }),
            });
            if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                throw new Error(j.error ?? "Could not add font");
            }
            setGoogleInput("");
            await load();
            onChange();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not add font");
        } finally {
            setAddingGoogle(false);
        }
    };

    const handleRemoveGoogle = async (family: string) => {
        if (!confirm(`Remove "${family}"? Slides already using it will fall back to the default font.`)) return;
        setError(null);
        try {
            await fetch(`${GOOGLE_FONTS_BASE}/${encodeURIComponent(family)}`, { method: "DELETE" });
            await load();
            onChange();
        } catch {
            setError("Remove failed");
        }
    };

    return (
        <div className="fm-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="fm-dialog">
                <div className="fm-header">
                    <span className="fm-title"><Type size={14} /> Font Manager</span>
                    <button className="fm-close" onClick={onClose} title="Close"><X size={15} /></button>
                </div>

                {error && <div className="fm-error">{error}</div>}

                <div className="fm-section-label">Google Fonts</div>
                <div className="fm-footer fm-footer-row">
                    <input
                        type="text"
                        className="fm-rename-input"
                        placeholder="e.g. Bebas Neue"
                        value={googleInput}
                        onChange={(e) => setGoogleInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleAddGoogle(); }}
                        disabled={addingGoogle}
                    />
                    <button className="fm-upload-btn" onClick={handleAddGoogle} disabled={addingGoogle || !googleInput.trim()}>
                        <Plus size={13} /> {addingGoogle ? "Adding…" : "Add"}
                    </button>
                </div>
                <ul className="fm-list">
                    {google.length === 0 && <li className="fm-empty">No Google Fonts added</li>}
                    {google.map((family) => (
                        <li key={family} className="fm-item">
                            <span className="fm-name" style={{ fontFamily: family }}>{family}</span>
                            <div className="fm-actions">
                                <button className="fm-btn danger" onClick={() => handleRemoveGoogle(family)} title="Remove"><Trash2 size={13} /></button>
                            </div>
                        </li>
                    ))}
                </ul>

                <div className="fm-section-label">Uploaded fonts</div>
                <ul className="fm-list">
                    {uploaded.length === 0 && <li className="fm-empty">No fonts uploaded</li>}
                    {uploaded.map((name) => (
                        <li key={name} className="fm-item">
                            <span className="fm-name" style={{ fontFamily: familyFromFilename(name) }}>{familyFromFilename(name)}</span>
                            <div className="fm-actions">
                                <button className="fm-btn danger" onClick={() => handleDeleteUploaded(name)} title="Delete"><Trash2 size={13} /></button>
                            </div>
                        </li>
                    ))}
                </ul>

                <div className="fm-footer">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".woff,.woff2,.ttf,.otf"
                        style={{ display: "none" }}
                        onChange={handleUpload}
                    />
                    <button
                        className="fm-upload-btn"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                    >
                        <Upload size={13} /> {uploading ? "Uploading…" : "Upload font file"}
                    </button>
                </div>
            </div>
        </div>
    );
}
