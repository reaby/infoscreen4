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
        setLayers((prev) => [
            ...prev.map((l) => ({ ...l, phase: "exiting" as const })),
            { key: transitionKey, node: children, phase: "entering" },
        ]);

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
