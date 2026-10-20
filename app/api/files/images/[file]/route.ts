import { NextResponse } from "next/server";
import { authorize } from "@/app/lib/authorization";
import { getImagesDir, isValidFileName, resolveFileIn } from "@/app/lib/paths";
import { unlink, rename, stat } from "fs/promises";
import { notModifiedResponse, validatorHeaders } from "@/app/lib/fileValidators";
import { streamFile } from "@/app/lib/fileStream";

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
    return resolveFileIn(getImagesDir(), file);
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
        const mime = mimeFor(file);
        return new NextResponse(streamFile(filePath), {
            headers: {
                "Content-Type": mime,
                "Content-Length": String(info.size),
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
    if (typeof newName !== "string" || !isValidFileName(newName)) {
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
