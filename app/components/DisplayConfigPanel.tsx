"use client";

import { useState } from "react";
import { DisplayConfig } from "../hooks/useSocket";

interface Props {
    configs: DisplayConfig[];
    onSave: (configs: DisplayConfig[]) => void;
    onClose: () => void;
}

/** Edits display ids and names. Changes stay local until saved. */
export default function DisplayConfigPanel({ configs, onSave, onClose }: Props) {
    const [drafts, setDrafts] = useState<DisplayConfig[]>(configs);

    const updateDraft = (index: number, patch: Partial<DisplayConfig>) =>
        setDrafts((current) => current.map((item, idx) => idx === index ? { ...item, ...patch } : item));

    return (
        <div className="admin-display-config-panel">
            <div className="admin-display-config-header">
                <strong>Display configuration</strong>
            </div>
            {drafts.map((config, index) => (
                <div className="admin-display-config-row" key={index}>
                    <div className="admin-display-config-field">
                        <label className="admin-label">ID</label>
                        <input
                            value={config.id}
                            onChange={(e) => updateDraft(index, { id: e.target.value.trim() || config.id })}
                            className="admin-settings-input"
                            style={{ width: 100 }}
                        />
                    </div>
                    <div className="admin-display-config-field">
                        <label className="admin-label">Name</label>
                        <input
                            value={config.name}
                            onChange={(e) => updateDraft(index, { name: e.target.value })}
                            className="admin-settings-input"
                            style={{ width: 180 }}
                        />
                    </div>
                    <button
                        className="admin-nav-btn"
                        type="button"
                        onClick={() => setDrafts((current) => current.filter((_, idx) => idx !== index))}
                        disabled={drafts.length <= 1}
                        title="Remove display"
                    >
                        ✕
                    </button>
                </div>
            ))}
            <div className="admin-display-config-actions">
                <button
                    className="admin-nav-btn"
                    type="button"
                    onClick={() => setDrafts((current) => [
                        ...current,
                        { id: `display-${current.length + 1}`, name: `Display ${current.length + 1}` },
                    ])}
                >
                    Add display
                </button>
                <button className="admin-nav-btn" type="button" onClick={() => { onSave(drafts); onClose(); }}>
                    Save
                </button>
                <button className="admin-nav-btn" type="button" onClick={onClose}>
                    Cancel
                </button>
            </div>
        </div>
    );
}
