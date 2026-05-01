"use client";

import { useEffect, useState, useCallback } from "react";

type UserRole = "admin" | "streamer";
type User = { username: string; role: UserRole };
type StatusMessage = { type: "success" | "error"; text: string } | null;

export default function UserManager() {
    const [users, setUsers] = useState<User[]>([]);
    const [newUserName, setNewUserName] = useState("");
    const [newUserPassword, setNewUserPassword] = useState("");
    const [newUserRole, setNewUserRole] = useState<UserRole>("admin");
    const [status, setStatus] = useState<StatusMessage>(null);
    const [loading, setLoading] = useState(false);

    const loadUsers = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetch("/api/users").then((r) => r.json()).catch(() => []);
            setUsers(Array.isArray(data) ? data : []);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadUsers();
    }, [loadUsers]);

    const handleCreateUser = useCallback(async () => {
        setStatus(null);
        const username = newUserName.trim();
        const password = newUserPassword;
        if (!username || !password) {
            setStatus({ type: "error", text: "Username and password are required." });
            return;
        }

        setLoading(true);
        try {
            const response = await fetch("/api/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password, role: newUserRole }),
            });
            const result = await response.json();
            if (!response.ok) {
                setStatus({ type: "error", text: result.message || "Unable to create user." });
                return;
            }
            setStatus({ type: "success", text: "User created." });
            setNewUserName("");
            setNewUserPassword("");
            setNewUserRole("admin");
            await loadUsers();
        } catch {
            setStatus({ type: "error", text: "Network error while creating user." });
        } finally {
            setLoading(false);
        }
    }, [loadUsers, newUserName, newUserPassword, newUserRole]);

    const handleDeleteUser = useCallback(async (username: string) => {
        if (users.length <= 1) {
            setStatus({ type: "error", text: "At least one user must remain." });
            return;
        }
        if (!window.confirm(`Delete user "${username}"?`)) return;

        setStatus(null);
        setLoading(true);
        try {
            const response = await fetch("/api/users", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username }),
            });
            const result = await response.json();
            if (!response.ok) {
                setStatus({ type: "error", text: result.message || "Unable to delete user." });
                return;
            }
            setStatus({ type: "success", text: `Deleted ${username}.` });
            await loadUsers();
        } catch {
            setStatus({ type: "error", text: "Network error while deleting user." });
        } finally {
            setLoading(false);
        }
    }, [loadUsers, users.length]);

    return (
        <div className="admin-settings-panel admin-user-panel">
            <div className="admin-user-panel-header">
                <div>
                    <div className="admin-user-panel-title">User management</div>
                    <div className="admin-user-panel-subtitle">Create and remove local users stored in <code>data/users.json</code>.</div>
                </div>
                <span className="admin-user-badge">{users.length} user{users.length === 1 ? "" : "s"}</span>
            </div>

            <div className="admin-user-form">
                <label className="admin-user-field">
                    Username
                    <input
                        type="text"
                        className="admin-settings-input"
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        disabled={loading}
                    />
                </label>
                <label className="admin-user-field">
                    Password
                    <input
                        type="password"
                        className="admin-settings-input"
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        disabled={loading}
                    />
                </label>
                <label className="admin-user-field">
                    Role
                    <select
                        className="admin-settings-input"
                        value={newUserRole}
                        onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                        disabled={loading}
                    >
                        <option value="admin">Admin</option>
                        <option value="streamer">Streamer</option>
                    </select>
                </label>
                <button
                    className="home-btn home-btn-primary"
                    type="button"
                    onClick={handleCreateUser}
                    disabled={loading}
                >
                    Create user
                </button>
            </div>

            <div className="admin-user-list">
                {loading ? (
                    <div className="admin-user-empty">Loading users…</div>
                ) : users.length === 0 ? (
                    <div className="admin-user-empty">No users found.</div>
                ) : (
                    <ul>
                        {users.map((user) => (
                            <li key={user.username} className="admin-user-row">
                                <span>{user.username}</span>
                                <span style={{ fontSize: 11, opacity: 0.5, marginLeft: 4 }}>{user.role}</span>
                                <button
                                    className="admin-user-delete-btn"
                                    type="button"
                                    disabled={loading || users.length <= 1}
                                    onClick={() => handleDeleteUser(user.username)}
                                    title={users.length <= 1 ? "Keep at least one user" : `Delete ${user.username}`}
                                >
                                    Delete
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            {status && <div className={`home-status ${status.type}`}>{status.text}</div>}
        </div>
    );
}
