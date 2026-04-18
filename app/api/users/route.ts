import { NextRequest, NextResponse } from "next/server";
import { createUser, deleteUser, getAllUsers } from "../../lib/auth";

export async function GET() {
    const users = await getAllUsers();
    return NextResponse.json(users.map(({ username }) => ({ username })));
}

export async function POST(req: NextRequest) {
    const body = await req.json();
    const username = String(body?.username ?? "").trim();
    const password = String(body?.password ?? "");

    if (!username || !password) {
        return NextResponse.json({ message: "Username and password are required." }, { status: 400 });
    }

    try {
        await createUser(username, password);
        return NextResponse.json({ created: true });
    } catch (error) {
        return NextResponse.json(
            { message: error instanceof Error ? error.message : "Could not create user." },
            { status: 409 }
        );
    }
}

export async function DELETE(req: NextRequest) {
    const body = await req.json();
    const username = String(body?.username ?? "").trim();

    if (!username) {
        return NextResponse.json({ message: "Username is required." }, { status: 400 });
    }

    try {
        await deleteUser(username);
        return NextResponse.json({ deleted: true });
    } catch (error) {
        return NextResponse.json(
            { message: error instanceof Error ? error.message : "Could not delete user." },
            { status: 404 }
        );
    }
}
