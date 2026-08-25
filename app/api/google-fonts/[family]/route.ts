import { NextResponse } from "next/server";
import { removeGoogleFont } from "@/app/lib/googleFonts";

export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ family: string }> }
) {
    const { family } = await params;
    removeGoogleFont(decodeURIComponent(family));
    return NextResponse.json({ ok: true });
}
