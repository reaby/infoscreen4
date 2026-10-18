import { NextResponse } from "next/server";
import { authorize } from "@/app/lib/authorization";
import { readdir, mkdir } from "fs/promises";
import path from "path";
import { getSlidesDir } from "@/app/lib/paths";

export async function GET(req: Request) {
    const denied = await authorize(req);
    if (denied) return denied;
    const slidesDir = getSlidesDir();
    try {
        const entries = await readdir(slidesDir, { withFileTypes: true });
        const slides = entries
            .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
            .map((entry) => entry.name.slice(0, -5))
            .sort((a, b) => a.localeCompare(b));
        return NextResponse.json(slides);
    } catch {
        await mkdir(slidesDir, { recursive: true });
        return NextResponse.json([]);
    }
}
