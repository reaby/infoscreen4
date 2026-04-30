import { NextResponse } from "next/server";
import { readFile, unlink, rename, stat } from "fs/promises";
import path from "path";

const NAME_RE = /^[a-zA-Z0-9._\- ]+$/;
const IMAGES_DIR = process.env.INFOSCREEN_DATA_DIR
    ? path.join(path.resolve(process.env.INFOSCREEN_DATA_DIR), "images")
    : path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "images");

const MIME: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
    gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
    bmp: "image/bmp", avif: "image/avif",
};
function mimeFor(filename: string) {
    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    return MIME[ext] ?? "application/octet-stream";
}

function safePath(file: string): string | null {
    if (!NAME_RE.test(file)) return null;
    const resolved = path.resolve(path.join(IMAGES_DIR, file));
    if (!resolved.startsWith(path.resolve(IMAGES_DIR))) return null;
    return resolved;
}

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ file: string }> }
) {
    const { file } = await params;
    const filePath = safePath(file);
    if (!filePath) return NextResponse.json({ error: "Invalid filename" }, { status: 400 });

    try {
        const info = await stat(filePath);
        const buf = await readFile(filePath);
        const mime = mimeFor(file);
        return new NextResponse(buf, {
            headers: {
                "Content-Type": mime,
                "Content-Length": String(info.size),
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
