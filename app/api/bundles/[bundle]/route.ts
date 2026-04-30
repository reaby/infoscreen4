import { NextResponse } from "next/server";
import { bundleManager } from "@/app/lib/BundleManager";
import type { BundleMeta } from "@/app/interfaces/BundleMeta";

const NAME_RE = /^[a-zA-Z0-9_\- ]+$/;

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ bundle: string }> }
) {
    const { bundle } = await params;
    if (!NAME_RE.test(bundle)) {
        return NextResponse.json({ error: "Invalid bundle name" }, { status: 400 });
    }
    return NextResponse.json(bundleManager.getMeta(bundle));
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ bundle: string }> }
) {
    const { bundle } = await params;
    if (!NAME_RE.test(bundle)) {
        return NextResponse.json({ error: "Invalid bundle name" }, { status: 400 });
    }
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const replaced = bundleManager.replaceMeta(bundle, body as Partial<BundleMeta>);
    return NextResponse.json(replaced);
}

export async function POST(
    req: Request,
    { params }: { params: Promise<{ bundle: string }> }
) {
    const { bundle } = await params;
    if (!NAME_RE.test(bundle)) {
        return NextResponse.json({ error: "Invalid bundle name" }, { status: 400 });
    }
    const body = await req.json().catch(() => null);
    if (!body || body.action !== "rename" || !body.newName || !NAME_RE.test(body.newName)) {
        return NextResponse.json({ error: "Invalid rename payload" }, { status: 400 });
    }

    const fs = await import("fs/promises");
    const path = await import("path");
    const { getBundlesDir } = await import("@/app/lib/paths");

    const oldPath = path.join(getBundlesDir(), bundle);
    const newPath = path.join(getBundlesDir(), body.newName);

    try {
        await fs.rename(oldPath, newPath);
        return NextResponse.json({ success: true, newName: body.newName });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || "Rename failed" }, { status: 500 });
    }
}

export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ bundle: string }> }
) {
    const { bundle } = await params;
    if (!NAME_RE.test(bundle)) {
        return NextResponse.json({ error: "Invalid bundle name" }, { status: 400 });
    }

    // We should safely delete the bundle directory
    const fs = await import("fs/promises");
    const path = await import("path");
    const { getBundlesDir } = await import("@/app/lib/paths");

    const bundlePath = path.join(getBundlesDir(), bundle);
    try {
        await fs.rm(bundlePath, { recursive: true, force: true });
        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
