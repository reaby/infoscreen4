import { NextResponse } from "next/server";
import { readdir, mkdir } from "fs/promises";
import path from "path";

const BUNDLES_DIR = path.join(process.cwd(), "data", "bundles");
const NAME_RE = /^[a-zA-Z0-9_-]+$/;

export async function GET() {
    try {
        const entries = await readdir(BUNDLES_DIR, { withFileTypes: true });
        const bundles = entries.filter((e) => e.isDirectory()).map((e) => e.name);
        return NextResponse.json(bundles);
    } catch {
        return NextResponse.json([]);
    }
}

export async function POST(req: Request) {
    const body = await req.json().catch(() => null);
    const name: unknown = body?.name;
    if (typeof name !== "string" || !NAME_RE.test(name) || name.length > 64) {
        return NextResponse.json({ error: "Invalid bundle name" }, { status: 400 });
    }
    const target = path.join(BUNDLES_DIR, name, "slides");
    await mkdir(target, { recursive: true });
    return NextResponse.json({ name });
}
