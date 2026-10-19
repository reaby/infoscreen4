// Stops the server on a Node.js older than package.json "engines.node" requires,
// with a clear message instead of an obscure failure somewhere later.
// Import this module first: imports run before any other code in a file.

import packageJson from "../../package.json";

type Version = [major: number, minor: number, patch: number];

/** Parses a ">=X", ">=X.Y" or ">=X.Y.Z" range into its minimum version; null for other forms. */
function minimumVersion(range: string): Version | null {
    const match = /^>=\s*v?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(range.trim());
    if (!match) return null;
    return [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)];
}

function parseVersion(version: string): Version {
    const [major = 0, minor = 0, patch = 0] = version.replace(/^v/, "").split(".").map(Number);
    return [major, minor, patch];
}

function isOlder(version: Version, minimum: Version): boolean {
    for (let i = 0; i < version.length; i++) {
        if (version[i] !== minimum[i]) return version[i] < minimum[i];
    }
    return false;
}

function ensureSupportedNodeVersion(): void {
    const required = packageJson.engines?.node;
    if (!required) return;

    const minimum = minimumVersion(required);
    if (!minimum) {
        console.warn(`> Cannot check the Node.js version: unsupported "engines.node" range "${required}" in package.json.`);
        return;
    }

    if (isOlder(parseVersion(process.versions.node), minimum)) {
        console.error(`> Infoscreen4 requires Node.js ${required}, but this is ${process.version}. Please upgrade Node.js.`);
        process.exit(1);
    }
}

ensureSupportedNodeVersion();
