"use client";

import { useState } from "react";
import { BundleMeta } from "../interfaces/BundleMeta";
import FileManagerDialog from "./FileManagerDialog";

const isVideoFile = (name: string) => /\.(mp4|webm|ogg)$/i.test(name);

interface Props {
    selectedBundle: string | null;
    bundleMeta: BundleMeta;
    metaDraft: BundleMeta;
    setMetaDraft: React.Dispatch<React.SetStateAction<BundleMeta>>;
    saveMeta: (patch: Partial<BundleMeta>) => Promise<void>;
}

export default function BundleSettingsPanel({ selectedBundle, bundleMeta, metaDraft, setMetaDraft, saveMeta }: Props) {
    const [showFileMgr, setShowFileMgr] = useState(false);
    const [fileMode, setFileMode] = useState<"backgrounds" | "videos">("backgrounds");

    return (
        <>
            <div className="admin-settings-panel">
                {/* ── Display dimensions ────────────── */}
                <div className="admin-settings-group">
                    <label className="admin-settings-label">Display dimensions</label>
                    <div className="admin-settings-row">
                        <label className="admin-label">W</label>
                        <input
                            type="number" min={1} max={7680}
                            className="admin-settings-input"
                            style={{ width: 80 }}
                            value={metaDraft.width ?? 1920}
                            onChange={(e) => setMetaDraft((d) => ({ ...d, width: Number(e.target.value) || undefined }))}
                        />
                        <label className="admin-label">H</label>
                        <input
                            type="number" min={1} max={4320}
                            className="admin-settings-input"
                            style={{ width: 80 }}
                            value={metaDraft.height ?? 1080}
                            onChange={(e) => setMetaDraft((d) => ({ ...d, height: Number(e.target.value) || undefined }))}
                        />
                        <button
                            className="fm-btn"
                            onClick={() => setMetaDraft((d) => ({ ...d, width: 1920, height: 1080 }))}
                            title="Reset to 1920×1080"
                        >1920×1080</button>
                    </div>
                    <div className="admin-settings-row" style={{ marginTop: 4 }}>
                        <button
                            type="button"
                            className={`admin-slide-toggle ${(metaDraft.autoScale ?? false) ? "on" : ""}`}
                            role="checkbox"
                            aria-checked={metaDraft.autoScale ?? false}
                            aria-label="Auto-scale to fit display"
                            title="Auto-scale to fit display"
                            onClick={() => setMetaDraft((d) => ({ ...d, autoScale: !(d.autoScale ?? false) }))}
                        >
                            {(metaDraft.autoScale ?? false) ? "✓" : "–"}
                        </button>
                        <span className="admin-label">Auto-scale to fit display</span>
                    </div>
                    <p className="admin-settings-hint">When off, the display renders at exact pixel dimensions. When on, scales to fill the screen.</p>
                    <div className="admin-settings-group" style={{ marginTop: 8 }}>
                        <label className="admin-settings-label">Global slide duration</label>
                        <div className="admin-settings-row">
                            <input
                                type="number" max={3600}
                                className="admin-settings-input"
                                style={{ width: 90 }}
                                value={metaDraft.defaultDuration ?? ""}
                                placeholder="10"
                                onChange={(e) => {
                                    const raw = e.target.value;
                                    if (raw === "") {
                                        setMetaDraft((d) => ({ ...d, defaultDuration: undefined }));
                                        return;
                                    }
                                    const value = Number(raw);
                                    setMetaDraft((d) => ({
                                        ...d,
                                        defaultDuration: Number.isFinite(value) ? value : d.defaultDuration,
                                    }));
                                }}
                            />
                            <span className="admin-label">s (≤0 = manual)</span>
                        </div>
                    </div>

                        <div className="admin-settings-group" style={{ marginTop: 8 }}>
                            <label className="admin-settings-label">Local Time Display</label>
                            <div className="admin-settings-row">
                                <label className="admin-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <input
                                        type="checkbox"
                                        checked={metaDraft.showLocalTime ?? false}
                                        onChange={(e) => setMetaDraft((d) => ({ ...d, showLocalTime: e.target.checked }))}
                                    />
                                    Show local time
                                </label>
                            </div>
                            {metaDraft.showLocalTime && (
                                <div className="admin-settings-row" style={{ marginTop: 4 }}>
                                    <label className="admin-label">Position</label>
                                    <select
                                        className="admin-settings-input"
                                        value={metaDraft.localTimePosition ?? "bottom-right"}
                                        onChange={(e) => setMetaDraft((d) => ({ ...d, localTimePosition: e.target.value as any }))}
                                        style={{ width: "120px" }}
                                    >
                                        <option value="top-left">Top Left</option>
                                        <option value="top-right">Top Right</option>
                                        <option value="bottom-left">Bottom Left</option>
                                        <option value="bottom-right">Bottom Right</option>
                                    </select>
                                </div>
                            )}
                        </div>
                    <label className="admin-settings-label">Background colour / CSS</label>
                    <div className="admin-settings-row">
                        <input
                            type="color"
                            className="admin-color-swatch"
                            value={metaDraft.backgroundColor?.match(/^#[0-9a-fA-F]{6}$/) ? metaDraft.backgroundColor : "#000000"}
                            onChange={(e) => setMetaDraft((d) => ({ ...d, backgroundColor: e.target.value }))}
                            title="Pick a solid colour"
                        />
                        <input
                            type="text"
                            className="admin-settings-input"
                            placeholder="#000000 or any CSS value…"
                            value={metaDraft.backgroundColor ?? ""}
                            key={selectedBundle}
                            onChange={(e) => setMetaDraft((d) => ({ ...d, backgroundColor: e.target.value || undefined }))}
                        />
                        {metaDraft.backgroundColor && (
                            <button
                                className="admin-settings-clear"
                                onClick={() => setMetaDraft((d) => ({ ...d, backgroundColor: undefined }))}
                                title="Clear"
                            >✕</button>
                        )}
                    </div>
                    <p className="admin-settings-hint">Any CSS <code>background</code> value — colour, gradient, url(…)</p>
                </div>

                {/* ── Background media file ──────────── */}
                <div className="admin-settings-group">
                    <label className="admin-settings-label">Background media file</label>
                    <div className="admin-settings-row" style={{ gap: 8, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", gap: 4 }}>
                            {(["backgrounds"] as const).map((mode) => (
                                <button
                                    key={mode}
                                    type="button"
                                    className={`fm-btn ${fileMode === mode ? "primary" : ""}`}
                                    onClick={() => setFileMode(mode)}
                                >
                                    {mode === "backgrounds" ? "Backgrounds" : "Videos"}
                                </button>
                            ))}
                        </div>
                        <button
                            className="admin-settings-input admin-settings-file-display admin-settings-file-pick"
                            onClick={() => setShowFileMgr(true)}
                            title="Click to browse files"
                        >
                            {metaDraft.backgroundFile
                                ? <span className="admin-settings-file-name">{metaDraft.backgroundFile}</span>
                                : <em>None selected — click to browse</em>}
                        </button>
                        {metaDraft.backgroundFile && (<>
                            <a
                                href={`/api/files/${isVideoFile(metaDraft.backgroundFile) ? "videos" : "backgrounds"}/${encodeURIComponent(metaDraft.backgroundFile)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="fm-btn"
                                title="Preview file"
                            >Preview</a>
                            <button
                                className="fm-btn danger"
                                onClick={() => setMetaDraft((d) => ({ ...d, backgroundFile: undefined }))}
                                title="Remove file"
                            >Remove</button>
                        </>)}
                    </div>
                    <p className="admin-settings-hint">Takes priority over background colour. Videos loop automatically.</p>
                </div>

                <div className="admin-settings-actions">
                    <button
                        className="admin-show-btn"
                        onClick={() => saveMeta(metaDraft)}
                    >Save</button>
                    <button
                        className="admin-settings-reset"
                        onClick={() => setMetaDraft(bundleMeta)}
                    >Reset</button>
                    {(bundleMeta.backgroundColor || bundleMeta.backgroundFile) && (
                        <button
                            className="admin-stop-btn"
                            onClick={() => saveMeta({ backgroundColor: undefined, backgroundFile: undefined })}
                            title="Remove all backgrounds from this bundle"
                        >Remove background</button>
                    )}
                </div>
            </div>

            {showFileMgr && (
                <FileManagerDialog
                    basePath={`/api/files/${fileMode}`}
                    onSelect={(filename) => {
                        setMetaDraft((d) => ({ ...d, backgroundFile: filename }));
                    }}
                    onClose={() => setShowFileMgr(false)}
                />
            )}
        </>
    );
}
