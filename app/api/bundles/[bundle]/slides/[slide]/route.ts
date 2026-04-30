import { NextResponse } from "next/server";
import { readFile, writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { bundleManager } from "@/app/lib/BundleManager";
import { getBundlesDir } from "@/app/lib/paths";

type Ctx = { params: Promise<{ bundle: string; slide: string }> };

export async function GET(_req: Request, { params }: Ctx) {
    const { bundle, slide: id } = await params;
    const meta = bundleManager.getMeta(bundle);
    const entry = meta.slides?.find((s) => s.id === id);
    if (!entry) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (entry.type !== "fabric") {
        return NextResponse.json({ error: "Slide is not fabric format" }, { status: 400 });
    }

    const file = path.join(getBundlesDir(), bundle, "slides", entry.data);
    try {
        const content = await readFile(file, "utf8");
        return new NextResponse(content, {
            headers: { "Content-Type": "application/json" },
        });
    } catch {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
}

export async function POST(req: Request, { params }: Ctx) {
    const { bundle, slide: id } = await params;
    const body = await req.text();
    // Validate it's JSON
    try { JSON.parse(body); } catch {
        return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
    }

    const meta = bundleManager.getMeta(bundle);
    const entry = meta.slides?.find((s) => s.id === id);

    const slidesDir = path.join(getBundlesDir(), bundle, "slides");
    await mkdir(slidesDir, { recursive: true });

    const filename = entry && entry.type === "fabric" ? entry.data : `${id}.json`;
    await writeFile(path.join(slidesDir, filename), body, "utf8");

    // Ensure entry exists
    if (!entry) {
        bundleManager.ensureSlideEntry(bundle, "fabric", filename);
    }

    return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
    const { bundle, slide: id } = await params;

    const meta = bundleManager.getMeta(bundle);
    const entry = meta.slides?.find((s) => s.id === id);

    if (entry && entry.type === "fabric") {
        const file = path.join(getBundlesDir(), bundle, "slides", entry.data);
        try {
            await unlink(file);
        } catch {
            // Ignore missing file
        }
    }

    bundleManager.removeSlideEntry(bundle, id);
    return NextResponse.json({ ok: true });
}
