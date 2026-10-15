import type { IncomingMessage } from "http";
import type { Socket } from "socket.io";
import { getSessionTokenFromCookieHeader, getSessionUser } from "./session";

export type SocketRole = "display" | "admin" | "streamer";

const extraAllowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

/**
 * Rejects cross-site socket connections. Browsers send cookies on WebSocket
 * handshakes regardless of CORS, so without this check any website could open
 * an admin socket using a signed-in admin's session.
 */
export function isAllowedOrigin(req: IncomingMessage): boolean {
    const origin = req.headers.origin;
    // Non-browser clients send no Origin header and cannot use a browser's cookies.
    if (!origin) return true;
    if (extraAllowedOrigins.includes(origin)) return true;

    let originHost: string;
    try {
        originHost = new URL(origin).host;
    } catch {
        return false;
    }
    // X-Forwarded-Host covers reverse proxies that rewrite Host. A browser cannot
    // set this header on a cross-site WebSocket, so it cannot be used to bypass the check.
    const forwardedHost = String(req.headers["x-forwarded-host"] ?? "").split(",")[0].trim();
    return originHost === req.headers.host || originHost === forwardedHost;
}

/**
 * Determines the role a socket is allowed to act as. Displays are read-only
 * receivers and need no sign-in; admin and streamer roles require a session.
 * Returns null when the requested role is not permitted.
 */
export async function resolveSocketRole(socket: Socket): Promise<SocketRole | null> {
    const requested = socket.handshake.query.role;
    if (requested === "display") return "display";
    if (requested !== "admin" && requested !== "streamer") return null;

    const token = getSessionTokenFromCookieHeader(socket.handshake.headers.cookie);
    const user = await getSessionUser(token);
    if (!user) return null;

    if (requested === "admin") return user.role === "admin" ? "admin" : null;
    return "streamer"; // both streamers and admins may broadcast
}
