"use client";

import { useEffect, useRef, useState } from "react";
import "../styles/contextmenu.css";

interface AdminContextMenuProps {
    x: number;
    y: number;
    visible: boolean;
    onClose: () => void;
    items: {
        label: string;
        onClick: () => void;
        danger?: boolean;
    }[];
}

export default function AdminContextMenu({
    x,
    y,
    visible,
    onClose,
    items
}: AdminContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        if (visible) {
            document.addEventListener("mousedown", handleClickOutside);
            return () => {
                document.removeEventListener("mousedown", handleClickOutside);
            };
        }
    }, [visible, onClose]);

    if (!visible) return null;

    return (
        <div
            ref={menuRef}
            className="context-menu"
            style={{
                position: "fixed",
                left: `${x}px`,
                top: `${y}px`,
            }}
        >
            {items.map((item, idx) => (
                <button
                    key={idx}
                    onClick={() => {
                        item.onClick();
                        onClose();
                    }}
                    className={`context-menu-item ${item.danger ? "context-menu-item-danger" : ""}`}
                >
                    {item.label}
                </button>
            ))}
        </div>
    );
}
