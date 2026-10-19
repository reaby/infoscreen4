"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { TransitionConfig } from "../lib/transitions";

interface Layer {
    key: string;
    phase: "entering" | "active" | "exiting";
    node: ReactNode; // snapshot of what an exiting layer showed; other layers render the live children
}

interface Props {
    transitionKey: string;
    transition: TransitionConfig;
    children: ReactNode;
}

// Without a transition the content stays in one layer, so it isn't remounted on every slide change.
const NONE_LAYER_KEY = "none";

function layersForNewKey(prev: Layer[], previousChildren: ReactNode, transitionKey: string, transition: TransitionConfig): Layer[] {
    if (transition.type === "none") {
        return [{ key: NONE_LAYER_KEY, phase: "active", node: null }];
    }
    // Keep at most one outgoing layer. If a transition is interrupted by another
    // before it finished cleaning up, drop the older stale layers immediately instead
    // of letting them pile up (each holds a live DisplaySlide — iframes/videos/canvas).
    const outgoing = prev.find((l) => l.phase !== "exiting") ?? prev[prev.length - 1];
    const exiting: Layer[] = outgoing
        ? [{ key: outgoing.key, phase: "exiting", node: outgoing.phase === "exiting" ? outgoing.node : previousChildren }]
        : [];
    return [...exiting, { key: transitionKey, phase: "entering", node: null }];
}

export default function SlideTransition({ transitionKey, transition, children }: Props) {
    const [layers, setLayers] = useState<Layer[]>([{ key: NONE_LAYER_KEY, phase: "active", node: null }]);
    // What was rendered last, so the outgoing layer can keep showing it.
    const [rendered, setRendered] = useState({ key: transitionKey, children });

    if (transitionKey !== rendered.key) {
        setLayers((prev) => layersForNewKey(prev, rendered.children, transitionKey, transition));
        setRendered({ key: transitionKey, children });
    } else if (children !== rendered.children) {
        setRendered({ key: transitionKey, children });
    }

    // Start the entering layer's animation on the next frame, and drop the
    // outgoing layer once the transition has finished.
    useEffect(() => {
        const raf = requestAnimationFrame(() => {
            setLayers((prev) => prev.map((l) => (l.phase === "entering" ? { ...l, phase: "active" } : l)));
        });
        const cleanupTimer = setTimeout(() => {
            setLayers((prev) => prev.filter((l) => l.phase !== "exiting"));
        }, transition.duration);
        return () => {
            cancelAnimationFrame(raf);
            clearTimeout(cleanupTimer);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [transitionKey]);

    const style = { "--stx-duration": `${transition.duration}ms` } as CSSProperties;

    return (
        <div className="slide-transition-root" style={style}>
            {layers.map((layer) => (
                <div key={layer.key} className={`slide-transition-layer ${transition.type} ${layer.phase}`}>
                    {layer.phase === "exiting" ? layer.node : children}
                </div>
            ))}
        </div>
    );
}
