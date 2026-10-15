import { randomBytes } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { getUserByUsername, UserRole } from "./auth";
import { getDataDir } from "./paths";

// Server-side session store. The cookie only carries a random, unguessable token;
// the token maps to a username here. Persisted to data/sessions.json so logins
// survive restarts. Kept on globalThis because route handlers are bundled
// separately from server.ts and don't share module instances.

export const SESSION_COOKIE = "session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

interface SessionRecord {
    username: string;
    expiresAt: number; // epoch ms
}

type SessionStore = Map<string, SessionRecord>;

const STORE_KEY = Symbol.for("infoscreen.sessions");

type StoreHolder = { [STORE_KEY]?: SessionStore };

function sessionsFilePath(): string {
    return path.join(getDataDir(), "sessions.json");
}

function loadStore(): SessionStore {
    try {
        const raw = JSON.parse(readFileSync(sessionsFilePath(), "utf8")) as Record<string, SessionRecord>;
        return new Map(Object.entries(raw));
    } catch {
        return new Map();
    }
}

function getStore(): SessionStore {
    const holder = globalThis as StoreHolder;
    holder[STORE_KEY] ??= loadStore();
    return holder[STORE_KEY];
}

function persistStore(store: SessionStore): void {
    const file = sessionsFilePath();
    const dir = path.dirname(file);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(file, JSON.stringify(Object.fromEntries(store), null, 2), "utf8");
}

function pruneExpired(store: SessionStore, now: number): boolean {
    let changed = false;
    for (const [token, record] of store) {
        if (record.expiresAt <= now) {
            store.delete(token);
            changed = true;
        }
    }
    return changed;
}

export function createSession(username: string): string {
    const store = getStore();
    pruneExpired(store, Date.now());
    const token = randomBytes(32).toString("hex");
    store.set(token, { username, expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000 });
    persistStore(store);
    return token;
}

/** Returns the username for a valid, unexpired session token, otherwise null. */
export function getSessionUsername(token: string | null | undefined): string | null {
    if (!token) return null;
    const store = getStore();
    const record = store.get(token);
    if (!record) return null;
    if (record.expiresAt <= Date.now()) {
        store.delete(token);
        persistStore(store);
        return null;
    }
    return record.username;
}

export interface SessionUser {
    username: string;
    role: UserRole;
}

/** Resolves a session token to its user. Returns null for unknown/expired sessions or deleted users. */
export async function getSessionUser(token: string | null | undefined): Promise<SessionUser | null> {
    const username = getSessionUsername(token);
    if (!username) return null;
    const user = await getUserByUsername(username);
    return user ? { username: user.username, role: user.role } : null;
}

export function destroySession(token: string | null | undefined): void {
    if (!token) return;
    const store = getStore();
    if (store.delete(token)) persistStore(store);
}

export function destroyUserSessions(username: string): void {
    const store = getStore();
    let changed = false;
    for (const [token, record] of store) {
        if (record.username === username) {
            store.delete(token);
            changed = true;
        }
    }
    if (changed) persistStore(store);
}

/** Extracts the session token from a raw Cookie header. */
export function getSessionTokenFromCookieHeader(cookieHeader: string | null | undefined): string | null {
    if (!cookieHeader) return null;
    for (const part of cookieHeader.split(";")) {
        const separator = part.indexOf("=");
        if (separator < 0) continue;
        if (part.slice(0, separator).trim() !== SESSION_COOKIE) continue;
        const value = part.slice(separator + 1).trim();
        try {
            return decodeURIComponent(value) || null;
        } catch {
            return null;
        }
    }
    return null;
}
