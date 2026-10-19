// Limits password guessing: after MAX_FAILURES failed sign-ins for the same
// client address and username, further attempts are refused until the lock
// expires. Kept in memory; a restart clears it.

const MAX_FAILURES = 5;
const LOCK_DURATION_MS = 60 * 1000;
// Failures older than this are forgotten, so records for unused usernames don't pile up.
const FAILURE_MEMORY_MS = 15 * 60 * 1000;

interface AttemptRecord {
    failures: number;
    lockedUntil: number; // epoch ms, 0 when not locked
    lastFailureAt: number; // epoch ms
}

const THROTTLE_KEY = Symbol.for("infoscreen.loginThrottle");

type ThrottleHolder = { [THROTTLE_KEY]?: Map<string, AttemptRecord> };

function getAttempts(): Map<string, AttemptRecord> {
    const holder = globalThis as ThrottleHolder;
    holder[THROTTLE_KEY] ??= new Map();
    return holder[THROTTLE_KEY];
}

function attemptKey(clientAddress: string, username: string): string {
    return `${clientAddress}|${username.toLowerCase()}`;
}

/** Seconds until the next attempt is allowed, or 0 when not locked. */
export function getLockoutSeconds(clientAddress: string, username: string): number {
    const record = getAttempts().get(attemptKey(clientAddress, username));
    if (!record) return 0;
    const remaining = record.lockedUntil - Date.now();
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

function pruneStale(attempts: Map<string, AttemptRecord>, now: number): void {
    for (const [key, record] of attempts) {
        if (record.lockedUntil <= now && now - record.lastFailureAt > FAILURE_MEMORY_MS) {
            attempts.delete(key);
        }
    }
}

export function recordFailedLogin(clientAddress: string, username: string): void {
    const attempts = getAttempts();
    const now = Date.now();
    pruneStale(attempts, now);
    const key = attemptKey(clientAddress, username);
    const record = attempts.get(key) ?? { failures: 0, lockedUntil: 0, lastFailureAt: now };
    record.failures += 1;
    record.lastFailureAt = now;
    if (record.failures >= MAX_FAILURES) {
        record.failures = 0;
        record.lockedUntil = now + LOCK_DURATION_MS;
    }
    attempts.set(key, record);
}

export function clearFailedLogins(clientAddress: string, username: string): void {
    getAttempts().delete(attemptKey(clientAddress, username));
}
