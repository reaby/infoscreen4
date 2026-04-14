"use client";

import { useState } from "react";
import { BundleMeta } from "../interfaces/BundleMeta";
import FileManagerDialog from "./FileManagerDialog";

interface Props {
    selectedBundle: string | null;
    bundleMeta: BundleMeta;
    metaDraft: BundleMeta;
    setMetaDraft: React.Dispatch<React.SetStateAction<BundleMeta>>;
    saveMeta: (patch: Partial<BundleMeta>) => Promise<void>;
}

export default function BundleSettingsPanel({ selectedBundle, bundleMeta, metaDraft, setMetaDraft, saveMeta }: Props) {
    const [showFileMgr, setShowFileMgr] = useState(false);

    return (
        <>
            <div className="ad-settings-panel">
                {/* ── Display dimensions ────────────── */}
                <div className="ad-settings-group">
                    <label className="ad-settings-label">Display dimensions</label>
                    <div className="ad-settings-row">
                        <label className="ad-label">W</label>
                        <input
                            type="number" min={1} max={7680}
                            className="ad-settings-input"
                            style={{ width: 80 }}
                            value={metaDraft.width ?? 1920}
                            onChange={(e) => setMetaDraft((d) => ({ ...d, width: Number(e.target.value) || undefined }))}
                        />
                        <label className="ad-label">H</label>
                        <input
                            type="number" min={1} max={4320}
                            className="ad-settings-input"
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
                    <div className="ad-settings-row" style={{ marginTop: 4 }}>
                        <button
                            type="button"
                            className={`ad-slide-toggle ${(metaDraft.autoScale ?? false) ? "on" : ""}`}
                            role="checkbox"
                            aria-checked={metaDraft.autoScale ?? false}
                            aria-label="Auto-scale to fit display"
                            title="Auto-scale to fit display"
                            onClick={() => setMetaDraft((d) => ({ ...d, autoScale: !(d.autoScale ?? false) }))}
                        >
                            {(metaDraft.autoScale ?? false) ? "✓" : "–"}
                        </button>
                        <span className="ad-label">Auto-scale to fit display</span>
                    </div>
                    <p className="ad-settings-hint">When off, the display renders at exact pixel dimensions. When on, scales to fill the screen.</p>
                    <div className="ad-settings-group" style={{ marginTop: 8 }}>
                        <label className="ad-settings-label">Global slide duration</label>
                        <div className="ad-settings-row">
                            <input
                                type="number" max={3600}
                                className="ad-settings-input"
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
                            <span className="ad-label">s (≤0 = manual)</span>
                        </div>
                    </div>
                </div>

                {/* ── Background colour / CSS ────────── */}
                <div className="ad-settings-group">
                    <label className="ad-settings-label">Background colour / CSS</label>
                    <div className="ad-settings-row">
                        <input
                            type="color"
                            className="ad-color-swatch"
                            value={metaDraft.backgroundColor?.match(/^#[0-9a-fA-F]{6}$/) ? metaDraft.backgroundColor : "#000000"}
                            onChange={(e) => setMetaDraft((d) => ({ ...d, backgroundColor: e.target.value }))}
                            title="Pick a solid colour"
                        />
                        <input
                            type="text"
                            className="ad-settings-input"
                            placeholder="#000000 or any CSS value…"
                            value={metaDraft.backgroundColor ?? ""}
                            key={selectedBundle}
                            onChange={(e) => setMetaDraft((d) => ({ ...d, backgroundColor: e.target.value || undefined }))}
                        />
                        {metaDraft.backgroundColor && (
                            <button
                                className="ad-settings-clear"
                                onClick={() => setMetaDraft((d) => ({ ...d, backgroundColor: undefined }))}
                                title="Clear"
                            >✕</button>
                        )}
                    </div>
                    <p className="ad-settings-hint">Any CSS <code>background</code> value — colour, gradient, url(…)</p>
                </div>

                {/* ── Background media file ──────────── */}
                <div className="ad-settings-group">
                    <label className="ad-settings-label">Background media file</label>
                    <div className="ad-settings-row">
                        <button
                            className="ad-settings-input ad-settings-file-display ad-settings-file-pick"
                            onClick={() => setShowFileMgr(true)}
                            title="Click to browse files"
                        >
                            {metaDraft.backgroundFile
                                ? <span className="ad-settings-file-name">{metaDraft.backgroundFile}</span>
                                : <em>None selected — click to browse</em>}
                        </button>
                        {metaDraft.backgroundFile && (<>
                            <a
                                href={`/api/files/backgrounds/${encodeURIComponent(metaDraft.backgroundFile)}`}
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
                    <p className="ad-settings-hint">Takes priority over background colour. Videos loop automatically.</p>
                </div>

                <div className="ad-settings-actions">
                    <button
                        className="ad-show-btn"
                        onClick={() => saveMeta(metaDraft)}
                    >Save</button>
                    <button
                        className="ad-settings-reset"
                        onClick={() => setMetaDraft(bundleMeta)}
                    >Reset</button>
                    {(bundleMeta.backgroundColor || bundleMeta.backgroundFile) && (
                        <button
                            className="ad-stop-btn"
                            onClick={() => saveMeta({ backgroundColor: undefined, backgroundFile: undefined })}
                            title="Remove all backgrounds from this bundle"
                        >Remove background</button>
                    )}
                </div>
            </div>

            {showFileMgr && (
                <FileManagerDialog
                    basePath="/api/files/backgrounds"
                    onSelect={(filename) => {
                        setMetaDraft((d) => ({ ...d, backgroundFile: filename }));
                    }}
                    onClose={() => setShowFileMgr(false)}
                />
            )}
        </>
    );
}
