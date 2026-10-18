"use client";

import { ChevronRight } from "lucide-react";
import { TRANSITION_TYPES, TransitionConfig } from "../lib/transitions";

export interface SlideScheduleDraft { mode: "range" | "daily"; start: string; end: string; dailyStart: string; dailyEnd: string }

interface Props {
    open: boolean;
    onToggle: () => void;
    hasSlide: boolean;
    summary: string;

    durationDraft: string;
    setDurationDraft: (value: string) => void;
    durationDirty: boolean;
    onSaveDuration: () => void;

    transitionDraft: TransitionConfig | null;
    setTransitionDraft: React.Dispatch<React.SetStateAction<TransitionConfig | null>>;
    transitionDirty: boolean;
    onSaveTransition: () => void;

    scheduleDraft: SlideScheduleDraft;
    setScheduleDraft: React.Dispatch<React.SetStateAction<SlideScheduleDraft>>;
    scheduleDirty: boolean;
    onSaveSchedule: () => void;
}

const UnsavedMark = () => <span className="admin-label admin-unsaved">Unsaved</span>;

/** Collapsible per-slide settings that open as an overlay above the bottom of the studio. */
export default function SlideInspector({
    open, onToggle, hasSlide, summary,
    durationDraft, setDurationDraft, durationDirty, onSaveDuration,
    transitionDraft, setTransitionDraft, transitionDirty, onSaveTransition,
    scheduleDraft, setScheduleDraft, scheduleDirty, onSaveSchedule,
}: Props) {
    return (
        <div className={`admin-inspector${open ? " open" : ""}`}>
            {open && (
                <div className="admin-inspector-body">
                    <div className="admin-inspector-field">
                        <label className="admin-label">Duration</label>
                        <div className="admin-inspector-row">
                            <input
                                type="number" min={0} max={3600}
                                value={durationDraft}
                                onChange={(e) => setDurationDraft(e.target.value)}
                                className="toolbar-number-input"
                                style={{ width: 64 }}
                                title="Slide duration override (blank = use bundle default)"
                                disabled={!hasSlide}
                            />
                            <span className="admin-label">s</span>
                            <button className="admin-nav-btn" onClick={onSaveDuration} disabled={!durationDirty}>Save</button>
                            {durationDirty && <UnsavedMark />}
                        </div>
                    </div>

                    <div className="admin-inspector-field">
                        <label className="admin-label">Transition</label>
                        <div className="admin-inspector-row">
                            <select
                                value={transitionDraft?.type ?? ""}
                                onChange={(e) => {
                                    const type = e.target.value;
                                    if (type === "") { setTransitionDraft(null); return; }
                                    setTransitionDraft({
                                        type: type as TransitionConfig["type"],
                                        duration: transitionDraft?.duration ?? 600,
                                    });
                                }}
                                className="toolbar-number-input"
                                style={{ width: 150 }}
                                title="Slide transition override (blank = use bundle default)"
                                disabled={!hasSlide}
                            >
                                <option value="">Use bundle default</option>
                                {TRANSITION_TYPES.map((t) => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>
                            {transitionDraft && (
                                <>
                                    <input
                                        type="number" min={0} max={5000}
                                        value={transitionDraft.duration}
                                        onChange={(e) => {
                                            const value = Number(e.target.value);
                                            setTransitionDraft((prev) => prev && ({
                                                ...prev,
                                                duration: Number.isFinite(value) ? value : prev.duration,
                                            }));
                                        }}
                                        className="toolbar-number-input"
                                        style={{ width: 64 }}
                                        title="Transition duration"
                                    />
                                    <span className="admin-label">ms</span>
                                </>
                            )}
                            <button className="admin-nav-btn" onClick={onSaveTransition} disabled={!transitionDirty}>Save</button>
                            {transitionDirty && <UnsavedMark />}
                        </div>
                    </div>

                    <div className="admin-inspector-field">
                        <label className="admin-label">Schedule</label>
                        <div className="admin-inspector-row">
                            <select
                                value={scheduleDraft.mode}
                                onChange={(e) => setScheduleDraft((prev) => ({ ...prev, mode: e.target.value as "range" | "daily" }))}
                                className="toolbar-number-input"
                                style={{ width: 110 }}
                                title="Date range = a one-off window. Daily time = recurring every day."
                                disabled={!hasSlide}
                            >
                                <option value="range">Date range</option>
                                <option value="daily">Daily time</option>
                            </select>
                            {scheduleDraft.mode === "range" ? (
                                <>
                                    <input
                                        type="datetime-local"
                                        value={scheduleDraft.start}
                                        onChange={(e) => setScheduleDraft((prev) => ({ ...prev, start: e.target.value }))}
                                        className="toolbar-number-input"
                                        style={{ width: 190 }}
                                        title="Slide becomes eligible for cycling from this date/time (blank = no start restriction)"
                                        disabled={!hasSlide}
                                    />
                                    <span className="admin-label">to</span>
                                    <input
                                        type="datetime-local"
                                        value={scheduleDraft.end}
                                        onChange={(e) => setScheduleDraft((prev) => ({ ...prev, end: e.target.value }))}
                                        className="toolbar-number-input"
                                        style={{ width: 190 }}
                                        title="Slide stops being eligible for cycling after this date/time (blank = no end restriction)"
                                        disabled={!hasSlide}
                                    />
                                </>
                            ) : (
                                <>
                                    <input
                                        type="time"
                                        value={scheduleDraft.dailyStart}
                                        onChange={(e) => setScheduleDraft((prev) => ({ ...prev, dailyStart: e.target.value }))}
                                        className="toolbar-number-input"
                                        style={{ width: 90 }}
                                        title="Slide cycles in every day from this time"
                                        disabled={!hasSlide}
                                    />
                                    <span className="admin-label">to</span>
                                    <input
                                        type="time"
                                        value={scheduleDraft.dailyEnd}
                                        onChange={(e) => setScheduleDraft((prev) => ({ ...prev, dailyEnd: e.target.value }))}
                                        className="toolbar-number-input"
                                        style={{ width: 90 }}
                                        title="Slide cycles out every day at this time (earlier than start = wraps past midnight)"
                                        disabled={!hasSlide}
                                    />
                                </>
                            )}
                            <button className="admin-nav-btn" onClick={onSaveSchedule} disabled={!scheduleDirty}>Save</button>
                            {scheduleDirty && <UnsavedMark />}
                        </div>
                    </div>
                </div>
            )}

            <button type="button" className="admin-inspector-head" onClick={onToggle} aria-expanded={open}>
                <ChevronRight size={12} className="admin-inspector-chevron" />
                Slide properties
                <span className="admin-inspector-summary">{summary}</span>
            </button>
        </div>
    );
}
