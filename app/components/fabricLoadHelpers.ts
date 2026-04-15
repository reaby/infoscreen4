"use client";

import * as fabric from "fabric";

type FabricJsonInput = object | string;

async function checkImageExists(url: string, cache: Map<string, boolean>) {
    if (cache.has(url)) {
        return cache.get(url)!;
    }

    const exists = await new Promise<boolean>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
    });

    cache.set(url, exists);
    return exists;
}

async function cleanFabricValue(value: unknown, cache: Map<string, boolean>, stats: { missingAssets: boolean }): Promise<unknown> {
    if (Array.isArray(value)) {
        const cleaned = await Promise.all(value.map((item) => cleanFabricValue(item, cache, stats)));
        return cleaned.filter((item) => item !== null);
    }

    if (value && typeof value === "object") {
        const objectValue = value as Record<string, unknown>;
        const type = typeof objectValue.type === "string" ? objectValue.type.toLowerCase() : null;
        const src = typeof objectValue.src === "string" ? objectValue.src : null;

        if (type === "image" && src) {
            const exists = await checkImageExists(src, cache);
            if (!exists) {
                stats.missingAssets = true;
                return null;
            }
        }

        const cleanedObject: Record<string, unknown> = {};
        for (const [key, nestedValue] of Object.entries(objectValue)) {
            const cleanedNested = await cleanFabricValue(nestedValue, cache, stats);
            if (cleanedNested !== null) {
                cleanedObject[key] = cleanedNested;
            }
        }
        return cleanedObject;
    }

    return value;
}

export async function loadFabricJsonSafely(canvas: fabric.Canvas | fabric.StaticCanvas, json: FabricJsonInput) {
    const stats = { missingAssets: false };
    try {
        const parsed = typeof json === "string" ? JSON.parse(json) : json;
        const cleaned = await cleanFabricValue(parsed, new Map(), stats);
        await canvas.loadFromJSON(cleaned);
        return { loaded: true, missingAssets: stats.missingAssets };
    } catch (error) {
        console.warn("Fabric JSON load failed; clearing canvas and ignoring missing image assets.", error);
        try {
            canvas.clear();
        } catch {
            // ignore
        }
        return { loaded: false, missingAssets: stats.missingAssets };
    }
}
