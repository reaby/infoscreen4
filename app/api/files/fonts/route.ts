import { NextResponse } from "next/server";
import { readdir, writeFile, mkdir } from "fs/promises";
import path from "path";
import { getFontsDir } from "@/app/lib/paths";

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB
const ALLOWED_EXT = new Set(["woff", "woff2", "ttf", "otf"]);

export async function GET() {
    const fontsDir = getFontsDir();
    try {
        await mkdir(fontsDir, { recursive: true });
        const files = await readdir(fontsDir);
        return NextResponse.json(files.filter((f) => !f.startsWith(".")));
    } catch {
        return NextResponse.json([]);
    }
}

export async function POST(req: Request) {
    const fontsDir = getFontsDir();
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
        return NextResponse.json({ error: "File too large (max 20 MB)" }, { status: 413 });
    }

    const safeName = path.basename(file.name).replace(/[^a-zA-Z0-9._\- ]/g, "_");
    if (!safeName) return NextResponse.json({ error: "Invalid filename" }, { status: 400 });

    const ext = safeName.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXT.has(ext)) {
        return NextResponse.json({ error: "Only .woff, .woff2, .ttf, .otf files are allowed" }, { status: 400 });
    }

    await mkdir(fontsDir, { recursive: true });
    const dest = path.join(fontsDir, safeName);
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(dest, buf);
    return NextResponse.json({ name: safeName });
}
