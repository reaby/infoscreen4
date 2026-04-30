import { NextResponse } from "next/server";
import { rename } from "fs/promises";
import path from "path";
import { bundleManager } from "@/app/lib/BundleManager";
import { getBundlesDir } from "@/app/lib/paths";

const NAME_RE = /^[a-zA-Z0-9_\- ]+$/;

type Ctx = { params: Promise<{ bundle: string; slide: string }> };

export async function POST(req: Request, { params }: Ctx) {
    const { bundle, slide } = await params;
    if (!NAME_RE.test(bundle) || !NAME_RE.test(slide)) {
        return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }
    const body = await req.json().catch(() => null);
    if (!body || !body.newName || !NAME_RE.test(body.newName)) {
        return NextResponse.json({ error: "Invalid newName" }, { status: 400 });
    }

    const newName = body.newName;
    const slidesDir = path.join(getBundlesDir(), bundle, "slides");

    try {
        await rename(
            path.join(slidesDir, `${slide}.json`),
            path.join(slidesDir, `${newName}.json`)
        );
        bundleManager.renameSlideEntry(bundle, slide, newName);
        return NextResponse.json({ success: true, newName });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || "Rename failed" }, { status: 500 });
    }
}
