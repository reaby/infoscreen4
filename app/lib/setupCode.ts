import { randomBytes } from "crypto";
import { safeEqual } from "./safeEqual";

// One-time code required to create the first admin account. It is printed to the
// server console, so only someone with access to the server (or its logs) can
// claim a fresh installation. Kept on globalThis so server.ts and the route
// handlers share it.

const CODE_KEY = Symbol.for("infoscreen.setupCode");

type CodeHolder = { [CODE_KEY]?: string };

export function getOrCreateSetupCode(): string {
    const holder = globalThis as CodeHolder;
    if (!holder[CODE_KEY]) {
        holder[CODE_KEY] = randomBytes(4).toString("hex").toUpperCase();
        console.log(`> No users exist yet. Initial setup code: ${holder[CODE_KEY]}`);
    }
    return holder[CODE_KEY];
}

export function isValidSetupCode(input: unknown): boolean {
    if (typeof input !== "string") return false;
    return safeEqual(input.trim().toUpperCase(), getOrCreateSetupCode());
}

export function clearSetupCode(): void {
    delete (globalThis as CodeHolder)[CODE_KEY];
}
