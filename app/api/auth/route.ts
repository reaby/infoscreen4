import { NextRequest, NextResponse } from "next/server";
import { getAllUsers, getUserByUsername, validateUser } from "../../lib/auth";
import { getRequestUser } from "../../lib/authorization";
import { getClientAddress } from "../../lib/clientAddress";
import { clearFailedLogins, getLockoutSeconds, recordFailedLogin } from "../../lib/loginThrottle";
import { createSession, destroySession, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "../../lib/session";

function getCookieOptions(req: NextRequest) {
    const forwardedProto = req.headers.get("x-forwarded-proto") ?? "";
    const isSecureRequest = req.nextUrl.protocol === "https:" || forwardedProto.split(",").some((value) => value.trim() === "https");
    return {
        httpOnly: true,
        path: "/",
        sameSite: "lax" as const,
        secure: process.env.NODE_ENV === "production" && isSecureRequest,
        maxAge: SESSION_MAX_AGE_SECONDS,
    };
}

function signedInResponse(req: NextRequest, body: Record<string, unknown>, username: string) {
    const response = NextResponse.json(body);
    response.cookies.set(SESSION_COOKIE, createSession(username), getCookieOptions(req));
    return response;
}

export async function GET(req: NextRequest) {
    const user = await getRequestUser(req);
    if (!user) {
        const needsSetup = (await getAllUsers()).length === 0;
        return NextResponse.json({ authenticated: false, needsSetup });
    }
    return NextResponse.json({ authenticated: true, username: user.username, role: user.role });
}

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null);
    const username = String(body?.username ?? "").trim();
    const password = String(body?.password ?? "");

    if (!username || !password) {
        return NextResponse.json({ message: "Username and password are required." }, { status: 400 });
    }

    const clientAddress = getClientAddress(req);
    const lockoutSeconds = getLockoutSeconds(clientAddress, username);
    if (lockoutSeconds > 0) {
        return NextResponse.json(
            { message: `Too many failed attempts. Try again in ${lockoutSeconds} seconds.` },
            { status: 429, headers: { "Retry-After": String(lockoutSeconds) } }
        );
    }

    const isValid = await validateUser(username, password);
    if (!isValid) {
        recordFailedLogin(clientAddress, username);
        return NextResponse.json({ message: "Invalid username or password." }, { status: 401 });
    }

    clearFailedLogins(clientAddress, username);
    const user = await getUserByUsername(username);
    return signedInResponse(req, { authenticated: true, username, role: user?.role ?? "admin" }, username);
}

export async function DELETE(req: NextRequest) {
    destroySession(req.cookies.get(SESSION_COOKIE)?.value);
    const response = NextResponse.json({ authenticated: false });
    response.cookies.set(SESSION_COOKIE, "", { ...getCookieOptions(req), maxAge: 0 });
    return response;
}
