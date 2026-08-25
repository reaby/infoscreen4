import { NextResponse } from "next/server";
import { listGoogleFonts, addGoogleFont } from "@/app/lib/googleFonts";

export async function GET() {
    return NextResponse.json(listGoogleFonts());
}

export async function POST(req: Request) {
    const body = await req.json().catch(() => null);
    const family: unknown = body?.family;
    if (typeof family !== "string" || !family.trim()) {
        return NextResponse.json({ error: "Missing font family" }, { status: 400 });
    }

    const result = await addGoogleFont(family);
    if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
}
