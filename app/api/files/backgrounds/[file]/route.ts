import { NextResponse } from "next/server";
import { readFile, unlink, rename, stat, open } from "fs/promises";
import path from "path";
import { getBackgroundsDir } from "@/app/lib/paths";

const NAME_RE = /^[a-zA-Z0-9._-]+$/;

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
    const bgDir = getBackgroundsDir();
    if (!NAME_RE.test(file)) return null;
    const resolved = path.resolve(path.join(bgDir, file));
    if (!resolved.startsWith(path.resolve(bgDir))) return null;
    return resolved;
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
        const total = info.size;
        const mime = mimeFor(file);

        // Edge is strict about byte-range video responses; support partial content.
        const range = req.headers.get("range");
        if (range && range.startsWith("bytes=")) {
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

            const chunkSize = end - start + 1;
            const handle = await open(filePath, "r");
            try {
                const chunk = Buffer.alloc(chunkSize);
                await handle.read(chunk, 0, chunkSize, start);
                return new NextResponse(chunk, {
                    status: 206,
                    headers: {
                        "Content-Type": mime,
                        "Content-Length": String(chunkSize),
                        "Content-Range": `bytes ${start}-${end}/${total}`,
                        "Accept-Ranges": "bytes",
                        "Cache-Control": "public, max-age=3600",
                    },
                });
            } finally {
                await handle.close();
            }
        }

        const buf = await readFile(filePath);
        return new NextResponse(buf, {
            headers: {
                "Content-Type": mime,
                "Content-Length": String(info.size),
                "Accept-Ranges": "bytes",
                "Cache-Control": "public, max-age=3600",
            },
        });
    } catch {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
}

export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ file: string }> }
) {
    const { file } = await params;
    const filePath = safePath(file);
    if (!filePath) return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    try {
        await unlink(filePath);
        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ file: string }> }
) {
    const { file } = await params;
    const filePath = safePath(file);
    if (!filePath) return NextResponse.json({ error: "Invalid filename" }, { status: 400 });

    const body = await req.json().catch(() => null);
    const newName: unknown = body?.newName;
    if (typeof newName !== "string" || !NAME_RE.test(newName)) {
        return NextResponse.json({ error: "Invalid new filename" }, { status: 400 });
    }

    const newPath = safePath(newName);
    if (!newPath) return NextResponse.json({ error: "Invalid new filename" }, { status: 400 });

    try {
        await rename(filePath, newPath);
        return NextResponse.json({ name: newName });
    } catch {
        return NextResponse.json({ error: "Rename failed" }, { status: 500 });
    }
}
