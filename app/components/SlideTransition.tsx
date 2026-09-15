"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { TransitionConfig } from "../lib/transitions";

interface Layer {
    key: string;
    node: ReactNode;
    phase: "entering" | "active" | "exiting";
}

interface Props {
    transitionKey: string;
    transition: TransitionConfig;
    children: ReactNode;
}

const NONE_LAYER_KEY = "none";

export default function SlideTransition({ transitionKey, transition, children }: Props) {
    const [layers, setLayers] = useState<Layer[]>([{ key: NONE_LAYER_KEY, node: children, phase: "active" }]);
    const prevKeyRef = useRef(transitionKey);
    const activeLayerKeyRef = useRef(NONE_LAYER_KEY);
    const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

    useEffect(() => {
        if (transitionKey === prevKeyRef.current) return;
        prevKeyRef.current = transitionKey;
        timersRef.current.forEach(clearTimeout);
        timersRef.current = [];

        if (transition.type === "none") {
            activeLayerKeyRef.current = NONE_LAYER_KEY;
            setLayers([{ key: NONE_LAYER_KEY, node: children, phase: "active" }]);
            return;
        }

        activeLayerKeyRef.current = transitionKey;
        setLayers((prev) => {
            // Keep at most one outgoing layer. If a transition is interrupted by
            // another before it finished cleaning up, drop the older stale layers
            // immediately instead of letting them pile up (each holds a live
            // DisplaySlide — iframes/videos/canvas — so accumulating them leaks).
            const outgoing = prev.find((l) => l.phase !== "exiting") ?? prev[prev.length - 1];
            const base = outgoing ? [{ ...outgoing, phase: "exiting" as const }] : [];
            return [...base, { key: transitionKey, node: children, phase: "entering" }];
        });

        const raf = requestAnimationFrame(() => {
            setLayers((prev) => prev.map((l) => (l.key === transitionKey ? { ...l, phase: "active" } : l)));
        });

        const cleanupTimer = setTimeout(() => {
            setLayers((prev) => prev.filter((l) => l.key === transitionKey));
        }, transition.duration);
        timersRef.current.push(cleanupTimer);

        return () => cancelAnimationFrame(raf);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [transitionKey]);

    useEffect(() => {
        setLayers((prev) => prev.map((l) => (l.key === activeLayerKeyRef.current ? { ...l, node: children } : l)));
    }, [children]);

    useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

    const style = { "--stx-duration": `${transition.duration}ms` } as CSSProperties;

    return (
        <div className="slide-transition-root" style={style}>
            {layers.map((layer) => (
                <div key={layer.key} className={`slide-transition-layer ${transition.type} ${layer.phase}`}>
                    {layer.node}
                </div>
            ))}
        </div>
    );
}
