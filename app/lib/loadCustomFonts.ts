import type { FontRegistry } from "../hooks/useFontRegistry";

function familyFromFilename(filename: string): string {
    return filename.replace(/\.(woff2?|ttf|otf)$/i, "");
}

function googleFontsCssUrl(family: string): string {
    return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}&display=swap`;
}

// One pending/finished load per font, so repeated calls share the same promise.
const uploadedLoads = new Map<string, Promise<void>>();
const googleLoads = new Map<string, Promise<void>>();

function loadUploadedFont(filename: string): Promise<void> {
    const face = new FontFace(familyFromFilename(filename), `url(/api/files/fonts/${encodeURIComponent(filename)})`);
    return face.load()
        .then((loaded) => { document.fonts.add(loaded); })
        .catch(() => { uploadedLoads.delete(filename); });
}

/** Resolves when the Google Fonts stylesheet has loaded, i.e. its @font-face rules are declared. */
function loadGoogleFontStylesheet(family: string): Promise<void> {
    const existing = document.head.querySelector<HTMLLinkElement>(`link[data-google-font="${CSS.escape(family)}"]`);
    if (existing?.sheet) return Promise.resolve();

    return new Promise<void>((resolve) => {
        const link = existing ?? document.createElement("link");
        link.addEventListener("load", () => resolve(), { once: true });
        link.addEventListener("error", () => { googleLoads.delete(family); resolve(); }, { once: true });
        if (!existing) {
            link.rel = "stylesheet";
            link.href = googleFontsCssUrl(family);
            link.setAttribute("data-google-font", family);
            document.head.appendChild(link);
        }
    });
}

/**
 * Registers uploaded and Google fonts with the document. The returned promise
 * resolves once they are available, so canvases can re-render their text.
 */
export function loadFontsIntoDocument(registry: Pick<FontRegistry, "uploaded" | "google">): Promise<void> {
    if (typeof document === "undefined") return Promise.resolve();

    const pending: Promise<void>[] = [];
    for (const filename of registry.uploaded) {
        if (!uploadedLoads.has(filename)) uploadedLoads.set(filename, loadUploadedFont(filename));
        pending.push(uploadedLoads.get(filename)!);
    }
    for (const family of registry.google) {
        if (!googleLoads.has(family)) googleLoads.set(family, loadGoogleFontStylesheet(family));
        pending.push(googleLoads.get(family)!);
    }
    return Promise.all(pending).then(() => undefined);
}
