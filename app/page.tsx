"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

type ApiResult = {
    authenticated?: boolean;
    username?: string | null;
    message?: string;
};

const emptyForm = { username: "", password: "" };

export default function Home() {
    const [form, setForm] = useState(emptyForm);
    const [loggedInUser, setLoggedInUser] = useState<string | null>(null);
    const [isRegister, setIsRegister] = useState(false);
    const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [working, setWorking] = useState(false);

    useEffect(() => {
        void fetch("/api/auth")
            .then((response) => response.json())
            .then((data: ApiResult) => {
                if (data.authenticated && data.username) {
                    setLoggedInUser(data.username);
                }
            })
            .catch(() => null);
    }, []);

    const updateField = (field: "username" | "password", value: string) => {
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
                body: JSON.stringify({ username, password }),
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
        setStatus({ type: "success", text: "Logged out." });
    };

    return loggedInUser ? (
        <main className="home-page">
            <div className="home-hero">
                <h1 className="home-title">Infoscreen<span>4</span></h1>
                <p className="home-subtitle">Welcome back, {loggedInUser}.</p>
                <div className="home-actions">
                    <Link href="/display" className="home-btn home-btn-primary">Display</Link>
                    <Link href="/admin" className="home-btn home-btn-secondary">Admin</Link>
                    <button className="home-btn" type="button" onClick={handleLogout}>Logout</button>
                </div>
                {status && <div className={`home-status ${status.type}`}>{status.text}</div>}
            </div>
        </main>
    ) : (
        <main className="home-page">
            <div className="home-hero">
                <h1 className="home-title">Infoscreen<span>4</span></h1>
                <p className="home-subtitle">Sign in to continue.</p>
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
                    <button className="home-btn home-btn-primary" type="submit" disabled={working}>
                        {isRegister ? "Create account" : "Sign in"}
                    </button>
                    <button
                        className="home-btn home-btn-secondary"
                        type="button"
                        disabled={working}
                        onClick={() => {
                            setIsRegister((current) => !current);
                            setStatus(null);
                        }}
                    >
                        {isRegister ? "Have an account? Sign in" : "Create a new account"}
                    </button>
                </form>
                {status && <div className={`home-status ${status.type}`}>{status.text}</div>}
            </div>
        </main>
    );
}
