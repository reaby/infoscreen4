import { createHash, timingSafeEqual } from "crypto";

/** Constant-time string comparison. Hashing first makes inputs equal length, so length isn't leaked either. */
export function safeEqual(a: string, b: string): boolean {
    const digestA = createHash("sha256").update(a).digest();
    const digestB = createHash("sha256").update(b).digest();
    return timingSafeEqual(digestA, digestB);
}
