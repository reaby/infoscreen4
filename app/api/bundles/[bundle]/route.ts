import { NextResponse } from "next/server";
import { bundleManager } from "@/app/lib/BundleManager";
import type { BundleMeta } from "@/app/interfaces/BundleMeta";

const NAME_RE = /^[a-zA-Z0-9_-]+$/;

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
