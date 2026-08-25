"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, Trash2, Pencil, Check, X, FolderOpen } from "lucide-react";

export interface FileManagerProps {
    /** API base path, e.g. "/api/files/backgrounds" */
    basePath: string;
    /** Called when the user clicks "Load" on a file */
    onSelect?: (filename: string, url: string, duration?: number) => void;
    onClose: () => void;
    /** When set, treats listed/uploaded files as videos: probes .duration client-side
     *  (on upload, and lazily on select if missing) and persists it via the API. */
    probeVideoDuration?: boolean;
}

interface FileEntry {
    name: string;
    duration?: number | null;
    /** Inline rename value; undefined = not editing */
    renaming?: string;
}

function formatDuration(seconds: number): string {
    const total = Math.round(seconds);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
}

function readVideoDuration(url: string): Promise<number | null> {
    return new Promise((resolve) => {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.muted = true;
        video.src = url;
        const cleanup = () => {
            video.removeAttribute("src");
            video.load();
        };
        video.onloadedmetadata = () => {
            const d = video.duration;
            cleanup();
            resolve(Number.isFinite(d) ? d : null);
        };
        video.onerror = () => {
            cleanup();
            resolve(null);
        };
    });
}

export default function FileManagerDialog({ basePath, onSelect, onClose, probeVideoDuration }: FileManagerProps) {
    const [files, setFiles] = useState<FileEntry[]>([]);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const load = useCallback(async () => {
        setError(null);
        try {
            const data: Array<string | { name: string; duration?: number | null }> = await fetch(basePath).then((r) => r.json());
            setFiles(data.map((item) => typeof item === "string" ? { name: item } : { name: item.name, duration: item.duration ?? undefined }));
        } catch {
            setError("Failed to load files");
        }
    }, [basePath]);

    useEffect(() => { void load(); }, [load]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        setError(null);
        try {
            const form = new FormData();
            form.append("file", file);
            if (probeVideoDuration) {
                const duration = await readVideoDuration(URL.createObjectURL(file));
                if (duration !== null) form.append("duration", String(duration));
            }
            const res = await fetch(basePath, { method: "POST", body: form });
            if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                throw new Error(j.error ?? "Upload failed");
            }
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Upload failed");
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleSelect = async (f: FileEntry) => {
        const url = `${basePath}/${encodeURIComponent(f.name)}`;
        let duration = f.duration ?? undefined;
        if (probeVideoDuration && duration === undefined) {
            const probed = await readVideoDuration(url);
            if (probed !== null) {
                duration = probed;
                fetch(`${basePath}/${encodeURIComponent(f.name)}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ duration: probed }),
                }).catch(() => { /* best-effort sidecar write */ });
            }
        }
        onSelect?.(f.name, url, duration);
        onClose();
    };

    const handleDelete = async (name: string) => {
        if (!confirm(`Delete "${name}"?`)) return;
        setError(null);
        try {
            await fetch(`${basePath}/${encodeURIComponent(name)}`, { method: "DELETE" });
            await load();
        } catch {
            setError("Delete failed");
        }
    };

    const startRename = (name: string) => {
        setFiles((prev) => prev.map((f) => f.name === name ? { ...f, renaming: f.name } : f));
    };

    const commitRename = async (oldName: string, newName: string) => {
        newName = newName.trim();
        if (!newName || newName === oldName) {
            cancelRename(oldName);
            return;
        }
        setError(null);
        try {
            const res = await fetch(`${basePath}/${encodeURIComponent(oldName)}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ newName }),
            });
            if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                throw new Error(j.error ?? "Rename failed");
            }
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Rename failed");
            cancelRename(oldName);
        }
    };

    const cancelRename = (name: string) => {
        setFiles((prev) => prev.map((f) => f.name === name ? { ...f, renaming: undefined } : f));
    };

    return (
        <div className="fm-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="fm-dialog">
                <div className="fm-header">
                    <span className="fm-title"><FolderOpen size={14} /> File Manager</span>
                    <button className="fm-close" onClick={onClose} title="Close"><X size={15} /></button>
                </div>

                {error && <div className="fm-error">{error}</div>}

                <ul className="fm-list">
                    {files.length === 0 && <li className="fm-empty">No files</li>}
                    {files.map((f) => (
                        <li key={f.name} className="fm-item">
                            {f.renaming !== undefined ? (
                                <input
                                    className="fm-rename-input"
                                    autoFocus
                                    value={f.renaming}
                                    onChange={(e) =>
                                        setFiles((prev) => prev.map((x) =>
                                            x.name === f.name ? { ...x, renaming: e.target.value } : x
                                        ))
                                    }
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") commitRename(f.name, f.renaming!);
                                        if (e.key === "Escape") cancelRename(f.name);
                                    }}
                                />
                            ) : (
                                <span
                                    className="fm-name"
                                    title={onSelect ? `Load "${f.name}"` : f.name}
                                    onClick={onSelect ? () => void handleSelect(f) : undefined}
                                    style={onSelect ? { cursor: "pointer" } : undefined}
                                >
                                    {f.name}
                                    {probeVideoDuration && typeof f.duration === "number" && (
                                        <span className="fm-duration"> ({formatDuration(f.duration)})</span>
                                    )}
                                </span>
                            )}

                            <div className="fm-actions">
                                {f.renaming !== undefined ? (
                                    <>
                                        <button className="fm-btn ok" onClick={() => commitRename(f.name, f.renaming!)} title="Confirm"><Check size={13} /></button>
                                        <button className="fm-btn" onClick={() => cancelRename(f.name)} title="Cancel"><X size={13} /></button>
                                    </>
                                ) : (
                                    <>
                                        {onSelect && (
                                            <button
                                                className="fm-btn primary"
                                                onClick={() => void handleSelect(f)}
                                                title="Use this file"
                                            >Load</button>
                                        )}
                                        <button className="fm-btn" onClick={() => startRename(f.name)} title="Rename"><Pencil size={13} /></button>
                                        <button className="fm-btn danger" onClick={() => handleDelete(f.name)} title="Delete"><Trash2 size={13} /></button>
                                    </>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>

                <div className="fm-footer">
                    <input
                        ref={fileInputRef}
                        type="file"
                        style={{ display: "none" }}
                        onChange={handleUpload}
                    />
                    <button
                        className="fm-upload-btn"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                    >
                        <Upload size={13} /> {uploading ? "Uploading…" : "Upload file"}
                    </button>
                </div>
            </div>
        </div>
    );
}
