import { NextResponse } from "next/server";
import { getDisplayConfigs } from "../../lib/displayState";

export async function GET() {
    return NextResponse.json(getDisplayConfigs(), {
        headers: {
            "Cache-Control": "no-store, max-age=0",
        },
    });
}
