"use client";

import { FormEvent, useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";

type ApiResult = {
    authenticated?: boolean;
    username?: string | null;
    role?: string | null;
    needsSetup?: boolean;
    message?: string;
};

type DisplayOption = { id: string; name: string };

const emptyForm = { username: "", password: "", setupCode: "" };
const FALLBACK_DISPLAYS: DisplayOption[] = [{ id: "1", name: "Display 1" }];

/** Resolves to the configured displays, the fallback on failure, or null when there are none to show. */
async function fetchDisplayOptions(): Promise<DisplayOption[] | null> {
    try {
        const response = await fetch("/api/displays");
        if (!response.ok) throw new Error("Failed to load display configs");
        const data = await response.json();
        return Array.isArray(data) && data.length > 0 ? data : null;
    } catch {
        return FALLBACK_DISPLAYS;
    }
}

const subscribeNever = () => () => {};

/** False during server rendering and hydration, true once running in the browser. */
function useIsClient(): boolean {
    return useSyncExternalStore(subscribeNever, () => true, () => false);
}

export default function Home() {
    const [form, setForm] = useState(emptyForm);
    const [loggedInUser, setLoggedInUser] = useState<string | null>(null);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [displayOptions, setDisplayOptions] = useState<DisplayOption[]>([]);
    const [selectedDisplay, setSelectedDisplay] = useState("");
    const [isRegister, setIsRegister] = useState(false);
    const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [working, setWorking] = useState(false);
    const mounted = useIsClient();

    const refreshDisplayOptions = useCallback(() => {
        void fetchDisplayOptions().then((options) => {
            if (!options) return;
            setDisplayOptions(options);
            setSelectedDisplay((current) => current || options[0].id);
        });
    }, []);

    useEffect(() => {
        fetch("/api/auth")
            .then((response) => response.json())
            .then((data: ApiResult) => {
                if (data.authenticated && data.username) {
                    setLoggedInUser(data.username);
                    setUserRole(data.role ?? null);
                } else if (data.needsSetup) {
                    setIsRegister(true);
                }
            })
            .catch(() => null);

        refreshDisplayOptions();
    }, [refreshDisplayOptions]);

    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState === "visible") {
                refreshDisplayOptions();
            }
        };

        document.addEventListener("visibilitychange", handleVisibility);
        return () => document.removeEventListener("visibilitychange", handleVisibility);
    }, [refreshDisplayOptions]);

    const updateField = (field: keyof typeof emptyForm, value: string) => {
        setForm((current) => ({ ...current, [field]: value }));
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setStatus(null);

        const username = form.username.trim();
        const password = form.password;
        if (!username || !password) {
            setStatus({ type: "error", text: "Please enter both username and password." });
            return;
        }

        setWorking(true);
        const url = isRegister ? "/api/users" : "/api/auth";
        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(isRegister ? { username, password, setupCode: form.setupCode } : { username, password }),
            });
            const result = (await response.json()) as ApiResult;

            if (!response.ok) {
                setStatus({ type: "error", text: result.message || "Unable to process request." });
                return;
            }

            if (isRegister) {
                setStatus({ type: "success", text: "User created successfully. Sign in with the new account." });
                setIsRegister(false);
                setForm(emptyForm);
                return;
            }

            if (result.authenticated && result.username) {
                setLoggedInUser(result.username);
                setUserRole(result.role ?? null);
                setStatus({ type: "success", text: `Signed in as ${result.username}.` });
                setForm(emptyForm);
            }
        } catch {
            setStatus({ type: "error", text: "Network error while communicating with the server." });
        } finally {
            setWorking(false);
        }
    };

    const handleLogout = async () => {
        await fetch("/api/auth", { method: "DELETE" });
        setLoggedInUser(null);
        setUserRole(null);
        setStatus({ type: "success", text: "Logged out." });
    };

    return loggedInUser ? (
        <main className="home-page">
            <div className="home-hero">
                <h1 className="home-title">Infoscreen<span>4</span></h1>
                <p className="home-subtitle">Welcome back, {loggedInUser}.</p>
                <div className="home-actions">
                    <select
                        className="home-display-select"
                        value={selectedDisplay}
                        onChange={(event) => setSelectedDisplay(event.target.value)}
                        title="Select display"
                    >
                        {displayOptions.length > 0 ? displayOptions.map((display) => (
                            <option key={display.id} value={display.id}>{display.name}</option>
                        )) : (
                            <option value="1">Display 1</option>
                        )}
                    </select>
                    <Link href={`/display/${selectedDisplay || displayOptions[0]?.id || "1"}`} className="home-btn home-btn-primary">Display</Link>
                    <Link href="/send" className="home-btn home-btn-primary">Send Stream</Link>

                </div>
                <div style={{display: "flex", gap: 12}}>
                    {userRole === "admin" && <Link href="/admin" className="home-btn home-btn-secondary">Admin</Link>}
                    <button className="home-btn home-btn-outlined" type="button" onClick={handleLogout}>Logout</button>
                </div>
            </div>
        </main>
    ) : (
        <main className="home-page">
            <div className="home-hero">
                <h1 className="home-title">Infoscreen<span>4</span></h1>
                <p className="home-subtitle">{isRegister ? "Create account" : "Sign in to continue"}</p>

                {mounted ? (
                    <form className="auth-form" suppressHydrationWarning onSubmit={handleSubmit}>
                        <label className="auth-label">
                            Username
                            <input
                                className="auth-input"
                                type="text"
                                value={form.username}
                                onChange={(event) => updateField("username", event.target.value)}
                                disabled={working}
                            />
                        </label>
                        <label className="auth-label">
                            Password
                            <input
                                className="auth-input"
                                type="password"
                                value={form.password}
                                onChange={(event) => updateField("password", event.target.value)}
                                disabled={working}
                            />
                        </label>
                        {isRegister && (
                            <label className="auth-label">
                                Setup code (shown in the server console)
                                <input
                                    className="auth-input"
                                    type="text"
                                    autoComplete="off"
                                    value={form.setupCode}
                                    onChange={(event) => updateField("setupCode", event.target.value)}
                                    disabled={working}
                                />
                            </label>
                        )}
                        {status &&<div className={`home-status ${status.type}`}>{status.text}</div>}
                        <button className="home-btn home-btn-primary" type="submit" disabled={working}>
                            {isRegister ? "Create account" : "Sign in"}
                        </button>
                        {/* <button
                            className="home-btn home-btn-secondary"
                            type="button"
                            disabled={working}
                            onClick={() => {
                                setIsRegister((current) => !current);
                                setStatus(null);
                            }}
                        >
                            {isRegister ? "Have an account? Sign in" : "Create a new account"}
                        </button> */}
                    </form>
                ) : (
                    <div className="auth-form-placeholder" />
                )}

            </div>
        </main>
    );
}
