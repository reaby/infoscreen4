import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { getFontsDir } from "./paths";

function registryPath(): string {
    return path.join(getFontsDir(), "google-fonts.json");
}

function readRegistry(): string[] {
    try {
        const raw = JSON.parse(readFileSync(registryPath(), "utf8"));
        return Array.isArray(raw?.families) ? raw.families.filter((f: unknown) => typeof f === "string") : [];
    } catch {
        return [];
    }
}

function writeRegistry(families: string[]): void {
    const dir = getFontsDir();
    mkdirSync(dir, { recursive: true });
    writeFileSync(registryPath(), JSON.stringify({ families }, null, 2), "utf8");
}

export function cssUrlFor(family: string): string {
    return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}&display=swap`;
}

export function listGoogleFonts(): string[] {
    return readRegistry();
}

export async function addGoogleFont(family: string): Promise<{ ok: true } | { ok: false; error: string }> {
    const trimmed = family.trim();
    if (!trimmed || trimmed.length > 100) return { ok: false, error: "Invalid font name" };

    const existing = readRegistry();
    if (existing.some((f) => f.toLowerCase() === trimmed.toLowerCase())) {
        return { ok: true };
    }

    try {
        const res = await fetch(cssUrlFor(trimmed), {
            headers: { "User-Agent": "Mozilla/5.0" },
        });
        if (!res.ok) return { ok: false, error: "Font not found on Google Fonts" };
    } catch {
        return { ok: false, error: "Could not reach Google Fonts" };
    }

    writeRegistry([...existing, trimmed]);
    return { ok: true };
}

export function removeGoogleFont(family: string): void {
    const existing = readRegistry();
    writeRegistry(existing.filter((f) => f.toLowerCase() !== family.toLowerCase()));
}
