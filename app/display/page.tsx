"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useSocket } from "../hooks/useSocket";
import { BundleMeta } from "../interfaces/BundleMeta";

const DisplaySlide = dynamic(() => import("../components/DisplaySlide"), { ssr: false });

export default function DisplayPage() {
    const { state, bundleMetaUpdate } = useSocket("display");
    const [displayJson, setDisplayJson] = useState<object | null>(null);
    const [bundleMeta, setBundleMeta] = useState<BundleMeta>({});

    useEffect(() => {
        const active = state.activeSlide;
        if (!active) { setDisplayJson(null); setBundleMeta({}); return; }

        // Fetch bundle meta and slide JSON in parallel
        Promise.all([
            fetch(`/api/bundles/${encodeURIComponent(active.bundle)}`)
                .then((r) => r.json()).catch(() => ({})),
            fetch(`/api/bundles/${encodeURIComponent(active.bundle)}/slides/${encodeURIComponent(active.slide)}`)
                .then((r) => r.json()).catch(() => null),
        ]).then(([meta, json]) => {
            setBundleMeta(meta ?? {});
            setDisplayJson(json);
        });
    }, [state.activeSlide]);

    // Apply live meta updates pushed from admin (only when it's the active bundle)
    useEffect(() => {
        if (!bundleMetaUpdate) return;
        const active = state.activeSlide;
        if (!active || active.bundle !== bundleMetaUpdate.bundle) return;
        setBundleMeta(bundleMetaUpdate.meta as BundleMeta);
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
            />
        </div>
    );
}
