import path from "path";

function getProjectRoot(): string {
    const fromEnv = process.env.INFOSCREEN_ROOT;
    if (fromEnv && fromEnv.trim()) {
        return path.resolve(fromEnv);
    }

    // When started via absolute script path (common on VPS), use that script's directory.
    const scriptArg = process.argv[1];
    if (scriptArg && path.isAbsolute(scriptArg)) {
        return path.dirname(scriptArg);
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
