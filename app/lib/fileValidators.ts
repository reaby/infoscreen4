import type { Stats } from "fs";
import { NextResponse } from "next/server";

// Size + modification time identifies a file version cheaply, without hashing its contents.
function etagFor(info: Stats): string {
    return `"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`;
}

function etagMatches(header: string | null, etag: string): boolean {
    if (!header) return false;
    return header.split(",").some((tag) => {
        const candidate = tag.trim();
        return candidate === "*" || candidate === etag || candidate === `W/${etag}`;
    });
}

/** Headers that let the browser revalidate a cached file instead of downloading it again. */
export function validatorHeaders(info: Stats): Record<string, string> {
    return {
        "ETag": etagFor(info),
        "Last-Modified": info.mtime.toUTCString(),
    };
}

/** A 304 response when the browser's cached copy is still current, otherwise null. */
export function notModifiedResponse(req: Request, info: Stats): NextResponse | null {
    const ifNoneMatch = req.headers.get("if-none-match");
    if (ifNoneMatch !== null) {
        return etagMatches(ifNoneMatch, etagFor(info))
            ? new NextResponse(null, { status: 304, headers: validatorHeaders(info) })
            : null;
    }

    const ifModifiedSince = req.headers.get("if-modified-since");
    if (ifModifiedSince) {
        const since = Date.parse(ifModifiedSince);
        // HTTP dates have one-second precision.
        if (Number.isFinite(since) && Math.floor(info.mtimeMs / 1000) <= Math.floor(since / 1000)) {
            return new NextResponse(null, { status: 304, headers: validatorHeaders(info) });
        }
    }
    return null;
}

/**
 * A range may only be served when If-Range is absent or still names the current file;
 * otherwise the client holds a stale copy and needs the whole file.
 */
export function isRangeStillValid(req: Request, info: Stats): boolean {
    const ifRange = req.headers.get("if-range");
    if (!ifRange) return true;
    if (ifRange.startsWith("\"") || ifRange.startsWith("W/")) {
        return ifRange.trim() === etagFor(info);
    }
    const since = Date.parse(ifRange);
    return Number.isFinite(since) && Math.floor(info.mtimeMs / 1000) <= Math.floor(since / 1000);
}
