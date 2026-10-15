import { NextResponse } from "next/server";
import { authorize } from "@/app/lib/authorization";
import { removeGoogleFont } from "@/app/lib/googleFonts";

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ family: string }> }
) {
    const denied = await authorize(req);
    if (denied) return denied;
    const { family } = await params;
    removeGoogleFont(decodeURIComponent(family));
    return NextResponse.json({ ok: true });
}
