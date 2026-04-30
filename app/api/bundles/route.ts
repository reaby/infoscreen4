import { NextResponse } from "next/server";
import { readdir, mkdir } from "fs/promises";
import path from "path";
import { getBundlesDir } from "@/app/lib/paths";

const NAME_RE = /^[a-zA-Z0-9_\- ]+$/;

export async function GET() {
    const bundlesDir = getBundlesDir();
    try {
        const entries = await readdir(bundlesDir, { withFileTypes: true });
        const bundles = entries.filter((e) => e.isDirectory()).map((e) => e.name);
        return NextResponse.json(bundles);
    } catch {
        return NextResponse.json([]);
    }
}

export async function POST(req: Request) {
    const bundlesDir = getBundlesDir();
    const body = await req.json().catch(() => null);
    const name: unknown = body?.name;
    if (typeof name !== "string" || !NAME_RE.test(name) || name.length > 64) {
        return NextResponse.json({ error: "Invalid bundle name" }, { status: 400 });
    }
    const target = path.join(bundlesDir, name, "slides");
    await mkdir(target, { recursive: true });
    return NextResponse.json({ name });
}
