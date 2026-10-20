import { NextResponse } from "next/server";
import { authorize } from "@/app/lib/authorization";
import { getFontsDir, isValidFileName, resolveFileIn } from "@/app/lib/paths";
import { readFile, unlink, rename, stat } from "fs/promises";
import { notModifiedResponse, validatorHeaders } from "@/app/lib/fileValidators";

const MIME: Record<string, string> = {
    woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf",
};
function mimeFor(filename: string) {
    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    return MIME[ext] ?? "application/octet-stream";
}

function safePath(file: string): string | null {
    return resolveFileIn(getFontsDir(), file);
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
        const buf = await readFile(filePath);
        return new NextResponse(buf, {
            headers: {
                "Content-Type": mimeFor(file),
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
