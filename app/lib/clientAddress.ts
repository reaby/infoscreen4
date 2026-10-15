// Route handlers can't see the TCP peer address, so server.ts copies it into
// this request header (overwriting any value the client sent).
export const CLIENT_ADDRESS_HEADER = "x-infoscreen-client-address";

export function getClientAddress(req: Request): string {
    return req.headers.get(CLIENT_ADDRESS_HEADER) ?? "unknown";
}
