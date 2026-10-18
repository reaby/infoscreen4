"use client";

import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";

export interface DrawerTab<T extends string> {
    id: T;
    label: ReactNode;
    disabled?: boolean;
    content: ReactNode;
}

interface Props<T extends string> {
    tabs: DrawerTab<T>[];
    activeTab: T;
    onTabChange: (tab: T) => void;
    onClose: () => void;
}

/** Slide-over panel for configuration that isn't part of running the show. */
export default function SettingsDrawer<T extends string>({ tabs, activeTab, onTabChange, onClose }: Props<T>) {
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [onClose]);

    const active = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

    return (
        <>
            <div className="admin-drawer-scrim" onClick={onClose} />
            <aside className="admin-drawer" aria-label="Settings">
                <div className="admin-drawer-tabs">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            className={`admin-drawer-tab${tab.id === active.id ? " active" : ""}`}
                            onClick={() => onTabChange(tab.id)}
                            disabled={tab.disabled}
                        >
                            {tab.label}
                        </button>
                    ))}
                    <button type="button" className="admin-icon-btn admin-drawer-close" onClick={onClose} title="Close (Esc)">
                        <X size={14} />
                    </button>
                </div>
                <div className="admin-drawer-body">{active.content}</div>
            </aside>
        </>
    );
}
