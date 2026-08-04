import { NextResponse } from "next/server";
import { readFile, unlink, rename, stat } from "fs/promises";
import path from "path";
import { getFontsDir } from "@/app/lib/paths";

const NAME_RE = /^[a-zA-Z0-9._\- ]+$/;

const MIME: Record<string, string> = {
    woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf",
};
function mimeFor(filename: string) {
    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    return MIME[ext] ?? "application/octet-stream";
}

function safePath(file: string): string | null {
    const fontsDir = getFontsDir();
    if (!NAME_RE.test(file)) return null;
    const resolved = path.resolve(path.join(fontsDir, file));
    if (!resolved.startsWith(path.resolve(fontsDir))) return null;
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
        return new NextResponse(buf, {
            headers: {
                "Content-Type": mimeFor(file),
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
