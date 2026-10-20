import { NextResponse } from "next/server";
import { authorize } from "@/app/lib/authorization";
import { getVideosDir, isValidFileName, resolveFileIn } from "@/app/lib/paths";
import { writeFile, unlink, rename, stat } from "fs/promises";
import { isRangeStillValid, notModifiedResponse, validatorHeaders } from "@/app/lib/fileValidators";
import { streamFile } from "@/app/lib/fileStream";

function sidecarFor(filePath: string): string {
    return `${filePath}.json`;
}

const MIME: Record<string, string> = {
    mp4: "video/mp4", webm: "video/webm", ogg: "video/ogg",
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
    gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
};
function mimeFor(filename: string) {
    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    return MIME[ext] ?? "application/octet-stream";
}

function safePath(file: string): string | null {
    return resolveFileIn(getVideosDir(), file);
}

export async function GET(
    req: Request,
    { params }: { params: Promise<{ file: string }> }
) {
    const { file } = await params;
    const filePath = safePath(file);
    if (!filePath) return NextResponse.json({ error: "Invalid filename" }, { status: 400 });

    try {
        const info = await stat(filePath);
        const notModified = notModifiedResponse(req, info);
        if (notModified) return notModified;
        const total = info.size;
        const mime = mimeFor(file);

        const range = req.headers.get("range");
        if (range && range.startsWith("bytes=") && isRangeStillValid(req, info)) {
            const raw = range.replace("bytes=", "");
            const [startRaw, endRaw] = raw.split("-");
            const start = Number(startRaw);
            const end = endRaw ? Number(endRaw) : total - 1;

            if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || end >= total) {
                return new NextResponse(null, {
                    status: 416,
                    headers: {
                        "Content-Range": `bytes */${total}`,
                        "Accept-Ranges": "bytes",
                    },
                });
            }

            return new NextResponse(streamFile(filePath, start, end), {
                status: 206,
                headers: {
                    "Content-Type": mime,
                    "Content-Length": String(end - start + 1),
                    "Content-Range": `bytes ${start}-${end}/${total}`,
                    "Accept-Ranges": "bytes",
                    "Cache-Control": "public, max-age=3600",
                    ...validatorHeaders(info),
                },
            });
        }

        return new NextResponse(streamFile(filePath), {
            headers: {
                "Content-Type": mime,
                "Content-Length": String(info.size),
                "Accept-Ranges": "bytes",
                "Cache-Control": "public, max-age=3600",
                ...validatorHeaders(info),
            },
        });
    } catch {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ file: string }> }
) {
    const denied = await authorize(req);
    if (denied) return denied;
    const { file } = await params;
    const filePath = safePath(file);
    if (!filePath) return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    try {
        await unlink(filePath);
        try { await unlink(sidecarFor(filePath)); } catch { /* no sidecar to remove */ }
        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ file: string }> }
) {
    const denied = await authorize(req);
    if (denied) return denied;
    const { file } = await params;
    const filePath = safePath(file);
    if (!filePath) return NextResponse.json({ error: "Invalid filename" }, { status: 400 });

    const body = await req.json().catch(() => null);
    const newName: unknown = body?.newName;
    const durationRaw: unknown = body?.duration;

    if (newName === undefined && typeof durationRaw === "number" && Number.isFinite(durationRaw) && durationRaw >= 0) {
        try {
            await writeFile(sidecarFor(filePath), JSON.stringify({ duration: durationRaw }), "utf8");
            return NextResponse.json({ ok: true, duration: durationRaw });
        } catch {
            return NextResponse.json({ error: "Failed to write metadata" }, { status: 500 });
        }
    }

    if (typeof newName !== "string" || !isValidFileName(newName)) {
        return NextResponse.json({ error: "Invalid new filename" }, { status: 400 });
    }

    const newPath = safePath(newName);
    if (!newPath) return NextResponse.json({ error: "Invalid new filename" }, { status: 400 });

    try {
        await rename(filePath, newPath);
        try { await rename(sidecarFor(filePath), sidecarFor(newPath)); } catch { /* no sidecar to rename */ }
        return NextResponse.json({ name: newName });
    } catch {
        return NextResponse.json({ error: "Rename failed" }, { status: 500 });
    }
}
