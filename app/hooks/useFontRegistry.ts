"use client";

import { useCallback, useEffect, useState } from "react";

export interface FontRegistry {
    builtIn: string[];
    uploaded: string[]; // filenames, e.g. "MyFont.woff2"
    google: string[]; // family names
}

const EMPTY: FontRegistry = { builtIn: [], uploaded: [], google: [] };

// One registry shared by every hook user, so pages that render several slides
// (e.g. the admin preview and live monitors) fetch /api/fonts only once.
let pending: Promise<FontRegistry> | null = null;
const listeners = new Set<(registry: FontRegistry) => void>();

async function fetchRegistry(): Promise<FontRegistry> {
    try {
        const data = await fetch("/api/fonts").then((r) => r.json());
        return {
            builtIn: Array.isArray(data.builtIn) ? data.builtIn : [],
            uploaded: Array.isArray(data.uploaded) ? data.uploaded : [],
            google: Array.isArray(data.google) ? data.google : [],
        };
    } catch {
        pending = null; // let the next caller retry instead of caching the failure
        return EMPTY;
    }
}

function loadRegistry(): Promise<FontRegistry> {
    pending ??= fetchRegistry();
    return pending;
}

async function reloadRegistry(): Promise<void> {
    pending = fetchRegistry();
    const registry = await pending;
    listeners.forEach((notify) => notify(registry));
}

export function useFontRegistry() {
    const [registry, setRegistry] = useState<FontRegistry>(EMPTY);

    useEffect(() => {
        let active = true;
        const notify = (next: FontRegistry) => { if (active) setRegistry(next); };
        listeners.add(notify);
        void loadRegistry().then(notify);
        return () => {
            active = false;
            listeners.delete(notify);
        };
    }, []);

    const refresh = useCallback(() => reloadRegistry(), []);

    return { ...registry, refresh };
}
