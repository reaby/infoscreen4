"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSocket } from "../hooks/useSocket";
import { BundleMeta } from "../interfaces/BundleMeta";

const DisplaySlide = dynamic(() => import("./DisplaySlide"), { ssr: false });

interface DisplayPageProps {
    displayId?: string;
}

export default function DisplayPage({ displayId = "1" }: DisplayPageProps) {
    const defer = (fn: () => void) => queueMicrotask(fn);
    const { state, bundleMetaUpdate } = useSocket("display", displayId);
    const [displayJson, setDisplayJson] = useState<object | null>(null);
    const [bundleMeta, setBundleMeta] = useState<BundleMeta>({});
    const loadSeqRef = useRef(0);

    useEffect(() => {
        const active = state.activeSlide;
        if (!active) {
            defer(() => {
                setDisplayJson(null);
                setBundleMeta({});
            });
            return;
        }

        const hasSocketJson = active.json != null;
        const hasSocketMeta = active.bundleMeta != null;
        if (hasSocketJson && hasSocketMeta) {
            defer(() => {
                setBundleMeta(active.bundleMeta as BundleMeta);
                setDisplayJson(active.json as object);
            });
            return;
        }

        const seq = ++loadSeqRef.current;

        Promise.all([
            hasSocketMeta
                ? Promise.resolve(active.bundleMeta as BundleMeta)
                : fetch(`/api/bundles/${encodeURIComponent(active.bundle)}`)
                    .then((r) => r.json()).catch(() => ({})),
            hasSocketJson
                ? Promise.resolve(active.json)
                : fetch(`/api/bundles/${encodeURIComponent(active.bundle)}/slides/${encodeURIComponent(active.slide)}`)
                    .then((r) => r.json()).catch(() => null),
        ]).then(([meta, json]) => {
            if (loadSeqRef.current !== seq) return;
            setBundleMeta((meta ?? {}) as BundleMeta);
            if (json) {
                setDisplayJson(json);
            }
        });
    }, [state.activeSlide]);

    useEffect(() => {
        if (!bundleMetaUpdate) return;
        const active = state.activeSlide;
        if (!active || active.bundle !== bundleMetaUpdate.bundle) return;
        defer(() => setBundleMeta(bundleMetaUpdate.meta as BundleMeta));
    }, [bundleMetaUpdate, state.activeSlide]);

    return (
        <div className="display-root">
            {!state.activeSlide && (
                <div className="display-standby">
                    <span className="display-standby-text">Standby</span>
                </div>
            )}
            <DisplaySlide
                json={displayJson}
                bundleMeta={bundleMeta}
                activeEntry={bundleMeta.slides?.find(s => s.id === state.activeSlide?.slide) ?? null}
            />
        </div>
    );
}
