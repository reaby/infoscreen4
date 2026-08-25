"use client";

import { useCallback, useEffect, useState } from "react";

export interface FontRegistry {
    builtIn: string[];
    uploaded: string[]; // filenames, e.g. "MyFont.woff2"
    google: string[]; // family names
}

const EMPTY: FontRegistry = { builtIn: [], uploaded: [], google: [] };

export function useFontRegistry() {
    const [registry, setRegistry] = useState<FontRegistry>(EMPTY);

    const refresh = useCallback(async () => {
        try {
            const data = await fetch("/api/fonts").then((r) => r.json());
            setRegistry({
                builtIn: Array.isArray(data.builtIn) ? data.builtIn : [],
                uploaded: Array.isArray(data.uploaded) ? data.uploaded : [],
                google: Array.isArray(data.google) ? data.google : [],
            });
        } catch {}
    }, []);

    useEffect(() => { void refresh(); }, [refresh]);

    return { ...registry, refresh };
}
