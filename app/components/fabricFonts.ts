"use client";

import * as fabric from "fabric";

// Canvas text doesn't make the browser download web fonts the way DOM text does,
// so a slide drawn before its fonts are loaded renders in a fallback font.
// These helpers load the fonts a slide uses before drawing, and re-measure text
// when fonts become available later.

const FONT_LOAD_TIMEOUT_MS = 3000;

interface FontSpec {
    family: string;
    weight: string;
    style: string;
}

function toFontShorthand({ family, weight, style }: FontSpec): string {
    const quotedFamily = /[,"']/.test(family) ? family : `"${family}"`;
    return `${style} ${weight} 16px ${quotedFamily}`;
}

/** Walks Fabric JSON (including per-character styles) and collects every font variant used. */
function collectFontShorthands(value: unknown, inherited: FontSpec | null, out: Set<string>): void {
    if (Array.isArray(value)) {
        for (const item of value) collectFontShorthands(item, inherited, out);
        return;
    }
    if (!value || typeof value !== "object") return;

    const obj = value as Record<string, unknown>;
    let spec = inherited;
    const declaresFont = "fontFamily" in obj || "fontWeight" in obj || "fontStyle" in obj;
    const family = typeof obj.fontFamily === "string" ? obj.fontFamily : inherited?.family;
    if (declaresFont && family) {
        spec = {
            family,
            weight: String(obj.fontWeight ?? inherited?.weight ?? "normal"),
            style: typeof obj.fontStyle === "string" ? obj.fontStyle : inherited?.style ?? "normal",
        };
        out.add(toFontShorthand(spec));
    }

    for (const nested of Object.values(obj)) collectFontShorthands(nested, spec, out);
}

/**
 * Loads the fonts used by a slide. Resolves once they are loaded, or after a
 * timeout so an offline display still renders (with fallback fonts).
 */
export async function preloadFabricFonts(json: unknown): Promise<void> {
    if (typeof document === "undefined" || !document.fonts) return;

    const shorthands = new Set<string>();
    collectFontShorthands(json, null, shorthands);
    if (shorthands.size === 0) return;

    const loads = Promise.allSettled([...shorthands].map((font) => document.fonts.load(font)));
    const timeout = new Promise((resolve) => setTimeout(resolve, FONT_LOAD_TIMEOUT_MS));
    await Promise.race([loads, timeout]);
}

/** Re-measures all text objects so they render with fonts that finished loading after the first draw. */
export function refreshTextMetrics(canvas: fabric.StaticCanvas): void {
    fabric.cache?.charWidthsCache?.clear();
    for (const obj of canvas.getObjects()) {
        if (obj instanceof fabric.IText || obj instanceof fabric.Textbox || obj instanceof fabric.Text) {
            (obj as fabric.Text & { _clearCache?: () => void })._clearCache?.();
            obj.initDimensions?.();
            obj.setCoords();
        }
    }
    canvas.requestRenderAll();
}
