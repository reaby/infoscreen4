"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, Trash2, Pencil, Check, X, FolderOpen } from "lucide-react";

export interface FileManagerProps {
    /** API base path, e.g. "/api/files/backgrounds" */
    basePath: string;
    /** Called when the user clicks "Load" on a file */
    onSelect?: (filename: string, url: string) => void;
    onClose: () => void;
}

interface FileEntry {
    name: string;
    /** Inline rename value; undefined = not editing */
    renaming?: string;
}

export default function FileManagerDialog({ basePath, onSelect, onClose }: FileManagerProps) {
    const [files, setFiles] = useState<FileEntry[]>([]);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const load = async () => {
        setError(null);
        try {
            const data: string[] = await fetch(basePath).then((r) => r.json());
            setFiles(data.map((name) => ({ name })));
        } catch {
            setError("Failed to load files");
        }
    };

    useEffect(() => { load(); }, [basePath]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        setError(null);
        try {
            const form = new FormData();
            form.append("file", file);
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
                                    onClick={onSelect ? () => { onSelect(f.name, `${basePath}/${encodeURIComponent(f.name)}`); onClose(); } : undefined}
                                    style={onSelect ? { cursor: "pointer" } : undefined}
                                >{f.name}</span>
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
                                                onClick={() => { onSelect(f.name, `${basePath}/${encodeURIComponent(f.name)}`); onClose(); }}
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
