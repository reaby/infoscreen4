import { NextResponse } from "next/server";
import { readFile, writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { bundleManager } from "@/app/lib/BundleManager";

const BUNDLES_DIR = path.join(process.cwd(), "data", "bundles");
const NAME_RE = /^[a-zA-Z0-9_-]+$/;

type Ctx = { params: Promise<{ bundle: string; slide: string }> };

export async function GET(_req: Request, { params }: Ctx) {
    const { bundle, slide } = await params;
    if (!NAME_RE.test(bundle) || !NAME_RE.test(slide)) {
        return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }
    const file = path.join(BUNDLES_DIR, bundle, "slides", `${slide}.json`);
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
    const { bundle, slide } = await params;
    if (!NAME_RE.test(bundle) || !NAME_RE.test(slide)) {
        return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }
    const body = await req.text();
    // Validate it's JSON
    try { JSON.parse(body); } catch {
        return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
    }
    const slidesDir = path.join(BUNDLES_DIR, bundle, "slides");
    await mkdir(slidesDir, { recursive: true });
    await writeFile(path.join(slidesDir, `${slide}.json`), body, "utf8");
    bundleManager.ensureSlideEntry(bundle, slide);
    return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
    const { bundle, slide } = await params;
    if (!NAME_RE.test(bundle) || !NAME_RE.test(slide)) {
        return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }
    const file = path.join(BUNDLES_DIR, bundle, "slides", `${slide}.json`);
    try {
        await unlink(file);
        bundleManager.removeSlideEntry(bundle, slide);
        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
}
