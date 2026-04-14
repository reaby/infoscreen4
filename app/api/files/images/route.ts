import { NextResponse } from "next/server";
import { readdir, writeFile, mkdir } from "fs/promises";
import path from "path";
import { getImagesDir } from "@/app/lib/paths";

const MAX_SIZE = 200 * 1024 * 1024; // 200 MB

export async function GET() {
    const imagesDir = getImagesDir();
    try {
        await mkdir(imagesDir, { recursive: true });
        const files = await readdir(imagesDir);
        return NextResponse.json(files.filter((f) => !f.startsWith(".")));
    } catch {
        return NextResponse.json([]);
    }
}

export async function POST(req: Request) {
    const imagesDir = getImagesDir();
    const ct = req.headers.get("content-type") ?? "";
    if (!ct.includes("multipart/form-data")) {
        return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
    }
    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: "Invalid form data" }, { status: 400 });

    const file = form.get("file");
    if (!(file instanceof File)) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
        return NextResponse.json({ error: "File too large (max 200 MB)" }, { status: 413 });
    }

    const safeName = path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, "_");
    if (!safeName) return NextResponse.json({ error: "Invalid filename" }, { status: 400 });

    await mkdir(imagesDir, { recursive: true });
    const dest = path.join(imagesDir, safeName);
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(dest, buf);
    return NextResponse.json({ name: safeName });
}
