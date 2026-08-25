import type { FontRegistry } from "../hooks/useFontRegistry";

function familyFromFilename(filename: string): string {
    return filename.replace(/\.(woff2?|ttf|otf)$/i, "");
}

function googleFontsCssUrl(family: string): string {
    return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}&display=swap`;
}

const loadedUploaded = new Set<string>();
const loadedGoogle = new Set<string>();

export function loadFontsIntoDocument(registry: Pick<FontRegistry, "uploaded" | "google">): void {
    if (typeof document === "undefined") return;

    for (const filename of registry.uploaded) {
        if (loadedUploaded.has(filename)) continue;
        loadedUploaded.add(filename);
        const family = familyFromFilename(filename);
        const face = new FontFace(family, `url(/api/files/fonts/${encodeURIComponent(filename)})`);
        face.load()
            .then((loaded) => { document.fonts.add(loaded); })
            .catch(() => { loadedUploaded.delete(filename); });
    }

    for (const family of registry.google) {
        if (loadedGoogle.has(family)) continue;
        loadedGoogle.add(family);
        if (document.head.querySelector(`link[data-google-font="${CSS.escape(family)}"]`)) continue;
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = googleFontsCssUrl(family);
        link.setAttribute("data-google-font", family);
        document.head.appendChild(link);
    }
}
