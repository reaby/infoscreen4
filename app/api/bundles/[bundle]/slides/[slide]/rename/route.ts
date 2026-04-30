import { NextResponse } from "next/server";
import { rename } from "fs/promises";
import path from "path";
import { bundleManager } from "@/app/lib/BundleManager";
import { getBundlesDir } from "@/app/lib/paths";

type Ctx = { params: Promise<{ bundle: string; slide: string }> };

export async function POST(req: Request, { params }: Ctx) {
    const { bundle, slide: id } = await params;
    const body = await req.json().catch(() => ({}));
    const newName = body.newName as string;

    if (!newName) {
        return NextResponse.json({ error: "Missing newName" }, { status: 400 });
    }

    const meta = bundleManager.getMeta(bundle);
    const entry = meta.slides?.find((s) => s.id === id);

    if (!entry) {
        return NextResponse.json({ error: "Slide not found" }, { status: 404 });
    }

    if (entry.type === "fabric") {
        const oldFile = path.join(getBundlesDir(), bundle, "slides", entry.data);
        const newFile = path.join(getBundlesDir(), bundle, "slides", bundleManager.normalizeJsonFile(newName));

        try {
            await rename(oldFile, newFile);
            bundleManager.renameSlideEntry(bundle, id, bundleManager.normalizeJsonFile(newName));
        } catch {
            return NextResponse.json({ error: "Rename failed" }, { status: 500 });
        }
    } else {
        bundleManager.renameSlideEntry(bundle, id, newName);
    }

    return NextResponse.json({ ok: true });
}
