import path from "path";

function getProjectRoot(): string {
    const fromEnv = process.env.INFOSCREEN_ROOT;
    if (fromEnv && fromEnv.trim()) {
        return path.resolve(fromEnv);
    }

    return process.cwd();
}

export function getDataDir(): string {
    const fromEnv = process.env.INFOSCREEN_DATA_DIR;
    if (fromEnv && fromEnv.trim()) {
        return path.resolve(fromEnv);
    }
    return path.join(getProjectRoot(), "data");
}

export function getBundlesDir(): string {
    return path.join(getDataDir(), "bundles");
}

export function getSlidesDir(): string {
    return path.join(getDataDir(), "slides");
}

export function getImagesDir(): string {
    return path.join(getDataDir(), "images");
}

export function getBackgroundsDir(): string {
    return path.join(getDataDir(), "backgrounds");
}

export function getVideosDir(): string {
    return path.join(getDataDir(), "videos");
}

export function getFontsDir(): string {
    return path.join(getDataDir(), "fonts");
}

const FILE_NAME_RE = /^[a-zA-Z0-9._\- ]+$/;

export function isValidFileName(name: string): boolean {
    return FILE_NAME_RE.test(name);
}

/**
 * Resolves a user-supplied file name inside `dir`, or returns null when the name
 * is invalid or would escape the directory. The paths point at runtime data, not
 * build inputs, so Turbopack is told not to trace them into the server bundle.
 */
export function resolveFileIn(dir: string, file: string): string | null {
    if (!isValidFileName(file)) return null;
    const root = path.resolve(/*turbopackIgnore: true*/ dir);
    const resolved = path.resolve(/*turbopackIgnore: true*/ root, file);
    if (!resolved.startsWith(root + path.sep)) return null;
    return resolved;
}
