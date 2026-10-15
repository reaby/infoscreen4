import { NextResponse } from "next/server";
import { UserRole } from "./auth";
import { getSessionTokenFromCookieHeader, getSessionUser, SessionUser } from "./session";

export async function getRequestUser(req: Request): Promise<SessionUser | null> {
    return getSessionUser(getSessionTokenFromCookieHeader(req.headers.get("cookie")));
}

/**
 * Guards a route handler. Returns an error response to send back when the request
 * is not allowed, or null when the caller may proceed:
 *
 *     const denied = await authorize(req);
 *     if (denied) return denied;
 */
export async function authorize(req: Request, allowedRoles: UserRole[] = ["admin"]): Promise<NextResponse | null> {
    const user = await getRequestUser(req);
    if (!user) {
        return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }
    if (!allowedRoles.includes(user.role)) {
        return NextResponse.json({ message: "Insufficient permissions." }, { status: 403 });
    }
    return null;
}
