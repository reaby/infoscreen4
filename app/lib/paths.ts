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

export function getImagesDir(): string {
    return path.join(getDataDir(), "images");
}

export function getBackgroundsDir(): string {
    return path.join(getDataDir(), "backgrounds");
}

export function getVideosDir(): string {
    return path.join(getDataDir(), "videos");
}
