import type { IncomingMessage } from "http";

// Route handlers can't see the TCP peer address, so server.ts copies it into
// this request header (overwriting any value the client sent).
export const CLIENT_ADDRESS_HEADER = "x-infoscreen-client-address";

export function getClientAddress(req: Request): string {
    return req.headers.get(CLIENT_ADDRESS_HEADER) ?? "unknown";
}

/**
 * How many reverse proxies in front of the server to trust, from TRUST_PROXY:
 * "true" means one, a positive number means that many, anything else means none.
 */
export function getTrustedProxyHops(): number {
    const value = (process.env.TRUST_PROXY ?? "").trim().toLowerCase();
    if (value === "true") return 1;
    const hops = Number(value);
    return Number.isInteger(hops) && hops > 0 ? hops : 0;
}

/**
 * The address of the client that sent the request. Behind trusted proxies it comes
 * from X-Forwarded-For: each proxy appends the address it received the request
 * from, so the entry `trustedHops` from the end was added by the outermost trusted
 * proxy. Entries further left are whatever the client sent and can't be trusted.
 */
export function resolveClientAddress(req: IncomingMessage, trustedHops: number): string {
    const peerAddress = req.socket.remoteAddress ?? "unknown";
    if (trustedHops === 0) return peerAddress;

    const forwardedFor = [req.headers["x-forwarded-for"] ?? []].flat().join(",");
    const chain = forwardedFor.split(",").map((entry) => entry.trim()).filter(Boolean);
    if (chain.length === 0) return peerAddress;
    return chain[Math.max(0, chain.length - trustedHops)];
}
