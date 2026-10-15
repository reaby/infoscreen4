import { NextRequest, NextResponse } from "next/server";
import { createUser, deleteUser, getAllUsers, UserRole } from "../../lib/auth";
import { authorize } from "../../lib/authorization";
import { destroyUserSessions } from "../../lib/session";
import { clearSetupCode, isValidSetupCode } from "../../lib/setupCode";

export async function GET(req: NextRequest) {
    const denied = await authorize(req);
    if (denied) return denied;

    const users = await getAllUsers();
    return NextResponse.json(users.map(({ username, role }) => ({ username, role })));
}

export async function POST(req: NextRequest) {
    // The very first account may be created without signing in, using the
    // one-time setup code printed in the server console.
    const isInitialSetup = (await getAllUsers()).length === 0;
    const body = await req.json().catch(() => null);

    if (isInitialSetup) {
        if (!isValidSetupCode(body?.setupCode)) {
            return NextResponse.json(
                { message: "Invalid setup code. The code is printed in the server console." },
                { status: 403 }
            );
        }
    } else {
        const denied = await authorize(req);
        if (denied) return denied;
    }

    const username = String(body?.username ?? "").trim();
    const password = String(body?.password ?? "");
    const role: UserRole = !isInitialSetup && body?.role === "streamer" ? "streamer" : "admin";

    if (!username || !password) {
        return NextResponse.json({ message: "Username and password are required." }, { status: 400 });
    }

    try {
        await createUser(username, password, role);
        if (isInitialSetup) clearSetupCode();
        return NextResponse.json({ created: true });
    } catch (error) {
        return NextResponse.json(
            { message: error instanceof Error ? error.message : "Could not create user." },
            { status: 409 }
        );
    }
}

export async function DELETE(req: NextRequest) {
    const denied = await authorize(req);
    if (denied) return denied;

    const body = await req.json().catch(() => null);
    const username = String(body?.username ?? "").trim();

    if (!username) {
        return NextResponse.json({ message: "Username is required." }, { status: 400 });
    }

    try {
        await deleteUser(username);
        destroyUserSessions(username);
        return NextResponse.json({ deleted: true });
    } catch (error) {
        return NextResponse.json(
            { message: error instanceof Error ? error.message : "Could not delete user." },
            { status: 404 }
        );
    }
}
