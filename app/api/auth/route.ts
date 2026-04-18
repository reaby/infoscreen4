import { NextRequest, NextResponse } from "next/server";
import { createUser, getAllUsers, getUserByUsername, validateUser } from "../../lib/auth";

const COOKIE_NAME = "session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

function getCookieOptions(req: NextRequest) {
    const forwardedProto = req.headers.get("x-forwarded-proto") ?? "";
    const isSecureRequest = req.nextUrl.protocol === "https:" || forwardedProto.split(",").some((value) => value.trim() === "https");
    return {
        httpOnly: true,
        path: "/",
        sameSite: "lax" as const,
        secure: process.env.NODE_ENV === "production" && isSecureRequest,
        maxAge: COOKIE_MAX_AGE,
    };
}

export async function GET(req: NextRequest) {
    const username = req.cookies.get(COOKIE_NAME)?.value;
    if (!username) {
        return NextResponse.json({ authenticated: false });
    }

    const user = await getUserByUsername(username);
    return NextResponse.json({ authenticated: Boolean(user), username: user?.username ?? null });
}

export async function POST(req: NextRequest) {
    const body = await req.json();
    const username = String(body?.username ?? "").trim();
    const password = String(body?.password ?? "");

    if (!username || !password) {
        return NextResponse.json({ message: "Username and password are required." }, { status: 400 });
    }

    const existingUsers = await getAllUsers();
    if (existingUsers.length === 0) {
        const normalized = await createUser(username, password);
        const response = NextResponse.json({ authenticated: true, username: normalized, created: true, message: "First user created and signed in." });
        response.cookies.set(COOKIE_NAME, normalized, getCookieOptions(req));
        return response;
    }

    const isValid = await validateUser(username, password);
    if (!isValid) {
        return NextResponse.json({ message: "Invalid username or password." }, { status: 401 });
    }

    const response = NextResponse.json({ authenticated: true, username });
    response.cookies.set(COOKIE_NAME, username, getCookieOptions(req));
    return response;
}

export async function DELETE(req: NextRequest) {
    const response = NextResponse.json({ authenticated: false });
    response.cookies.set(COOKIE_NAME, "", { ...getCookieOptions(req), maxAge: 0 });
    return response;
}
