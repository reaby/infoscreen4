import { NextResponse } from "next/server";
import { bundleManager } from "@/app/lib/BundleManager";

const NAME_RE = /^[a-zA-Z0-9_\- ]+$/;

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ bundle: string }> }
) {
    const { bundle } = await params;
    if (!NAME_RE.test(bundle)) {
        return NextResponse.json({ error: "Invalid bundle name" }, { status: 400 });
    }
    return NextResponse.json(bundleManager.getOrderedSlideNames(bundle, { activeOnly: false }));
}
