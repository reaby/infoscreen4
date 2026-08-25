import { NextResponse } from "next/server";
import { readdir, mkdir } from "fs/promises";
import { getFontsDir } from "@/app/lib/paths";
import { listGoogleFonts } from "@/app/lib/googleFonts";
import { BUILT_IN_FONTS } from "@/app/lib/builtInFonts";

const FONT_EXT_RE = /\.(woff2?|ttf|otf)$/i;

export async function GET() {
    const fontsDir = getFontsDir();
    let uploaded: string[] = [];
    try {
        await mkdir(fontsDir, { recursive: true });
        uploaded = (await readdir(fontsDir)).filter((f) => FONT_EXT_RE.test(f));
    } catch {
        uploaded = [];
    }

    return NextResponse.json({
        builtIn: BUILT_IN_FONTS,
        uploaded,
        google: listGoogleFonts(),
    });
}
