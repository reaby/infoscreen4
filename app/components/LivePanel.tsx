"use client";

import { ReactNode, useEffect, useState } from "react";
import { CircleOff, Pause, Play, StepBack, StepForward } from "lucide-react";

interface Props {
    /** The small monitor (live by default, preview while swapped). */
    children: ReactNode;
    displayName: string;
    liveBundle: string | null;
    liveSlideTitle: string | null;
    /** Seconds the current slide stays up while cycling. */
    slideDuration: number | null;
    cycling: boolean;
    connected: boolean;
    canStep: boolean;
    canResume: boolean;
    onSwap: () => void;
    onPrev: () => void;
    onNext: () => void;
    onTogglePause: () => void;
    onBlackout: () => void;
}

/**
 * Remembers when the current live slide started, so the panel can show a
 * countdown. The server doesn't send start times, so the first slide seen
 * after page load has an unknown start and gets no countdown.
 */
function useSlideStartTime(slideKey: string | null, cycling: boolean) {
    const [initialKey] = useState(slideKey);
    const [initialCycling] = useState(cycling);
    const [startedAt, setStartedAt] = useState<number | null>(null);

    useEffect(() => {
        const unchangedSinceLoad = slideKey === initialKey && cycling === initialCycling;
        const next = cycling && slideKey && !unchangedSinceLoad ? Date.now() : null;
        queueMicrotask(() => setStartedAt(next));
    }, [slideKey, cycling, initialKey, initialCycling]);

    return startedAt;
}

function useSecondsLeft(startedAt: number | null, duration: number | null) {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (startedAt === null) return;
        const timer = setInterval(() => setNow(Date.now()), 500);
        return () => clearInterval(timer);
    }, [startedAt]);

    if (startedAt === null || !duration) return null;
    return Math.max(0, Math.ceil(duration - (now - startedAt) / 1000));
}

export default function LivePanel({
    children, displayName, liveBundle, liveSlideTitle, slideDuration, cycling, connected,
    canStep, canResume, onSwap, onPrev, onNext, onTogglePause, onBlackout,
}: Props) {
    const isOnAir = liveBundle !== null;
    const slideKey = isOnAir ? `${liveBundle}/${liveSlideTitle}` : null;
    const startedAt = useSlideStartTime(slideKey, cycling);
    const secondsLeft = useSecondsLeft(startedAt, slideDuration);

    const stateText = !isOnAir
        ? "blacked out"
        : !cycling
            ? "paused"
            : secondsLeft !== null ? `next in ${secondsLeft}s` : "cycling";

    return (
        <div className="admin-live-panel">
            <div className="admin-live-meta">
                <span className="admin-live-what" title={displayName}>
                    {isOnAir
                        ? <>{liveBundle} › <strong>{liveSlideTitle}</strong></>
                        : <strong>{displayName} is blacked out</strong>}
                </span>
                <span className="admin-live-state">{stateText}</span>
            </div>

            <div className="admin-live-swap">
                {children}
                {/* Covers the monitor so clicks reach us even over website/video slides. */}
                <button type="button" className="admin-live-swap-hint" onClick={onSwap} title="Swap preview and live">
                    ⇄ Swap
                </button>
            </div>

            <div className="admin-live-progress">
                {startedAt !== null && slideDuration ? (
                    <i key={startedAt} style={{ animationDuration: `${slideDuration}s` }} />
                ) : null}
            </div>

            <div className="admin-live-controls">
                <button className="admin-live-btn" onClick={onPrev} disabled={!connected || !canStep} title="Previous slide on live">
                    <StepBack size={16} />
                </button>
                <button
                    className="admin-live-btn wide"
                    onClick={onTogglePause}
                    disabled={!connected || (!cycling && !canResume)}
                    title={cycling ? "Stop cycling and keep the current slide" : "Start cycling from the current slide"}
                >
                    {cycling
                        ? <><Pause size={15} /><span className="admin-live-btn-label">Pause cycle</span></>
                        : <><Play size={15} /><span className="admin-live-btn-label">Resume cycle</span></>}
                </button>
                <button className="admin-live-btn" onClick={onNext} disabled={!connected || !canStep} title="Next slide on live">
                    <StepForward size={16} />
                </button>
                <button className="admin-live-btn danger" onClick={onBlackout} disabled={!connected || !isOnAir} title="Blackout">
                    <CircleOff size={16} />
                </button>
            </div>
        </div>
    );
}
