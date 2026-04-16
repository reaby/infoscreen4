"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

export type SocketRole = "admin" | "display";

export interface DisplayConfig {
    id: string;
    name: string;
}

export interface ActiveSlide {
    bundle: string;
    slide: string;
    duration: number;
    json?: object | null;
    bundleMeta?: unknown;
}

export interface BundleMetaUpdate {
    bundle: string;
    meta: Record<string, unknown>;
}

export interface ServerState {
    activeSlide: ActiveSlide | null;
    connectedDisplays: number;
    isCycling: boolean;
    displayConfigs: DisplayConfig[];
    displayStates: Record<string, ActiveSlide | null>;
    displayConnections: Record<string, number>;
    displayCycling: Record<string, boolean>;
}

export function useSocket(role: SocketRole, displayId?: string) {
    const socketRef = useRef<Socket | null>(null);
    const [connected, setConnected] = useState(false);
    const [state, setState] = useState<ServerState>({
        activeSlide: null,
        connectedDisplays: 0,
        isCycling: false,
        displayConfigs: [],
        displayStates: {},
        displayConnections: {},
        displayCycling: {},
    });
    const [bundleMetaUpdate, setBundleMetaUpdate] = useState<BundleMetaUpdate | null>(null);

    useEffect(() => {
        const socket = io({
            query: { role, displayId },
            transports: ["websocket", "polling"],
            upgrade: true,
            rememberUpgrade: true,
        });
        socketRef.current = socket;

        socket.on("connect", () => setConnected(true));
        socket.on("disconnect", () => setConnected(false));

        socket.on("state:sync", (s: ServerState) => setState(s));
        socket.on("display:state:sync", (s: ServerState) => setState(s));
        socket.on("displays:count", (count: number) =>
            setState((prev) => ({ ...prev, connectedDisplays: count }))
        );
        socket.on("slide:show", (slide: ActiveSlide) =>
            setState((prev) => ({ ...prev, activeSlide: slide }))
        );
        socket.on("slide:clear", () =>
            setState((prev) => ({ ...prev, activeSlide: null }))
        );

        socket.on("bundle:meta", (update: BundleMetaUpdate) =>
            setBundleMetaUpdate(update)
        );

        return () => { socket.disconnect(); };
    }, [role]);

    const showSlide = (displayId: string, slide: ActiveSlide) => {
        socketRef.current?.emit("slide:show", { displayId, ...slide });
    };

    const clearSlide = (displayId: string) => {
        socketRef.current?.emit("slide:clear", { displayId });
    };

    const stopCycle = (displayId: string) => {
        socketRef.current?.emit("cycle:stop", { displayId });
    };

    const updateBundleMeta = (bundle: string, meta: Record<string, unknown>, displayId?: string) => {
        socketRef.current?.emit("bundle:meta", { bundle, meta, displayId });
    };

    const activateBundle = (bundle: string, displayId: string) => {
        socketRef.current?.emit("bundle:activate", { bundle, displayId });
    };

    const updateDisplayConfig = (configs: DisplayConfig[]) => {
        socketRef.current?.emit("display:config", { configs });
    };

    return { connected, state, showSlide, clearSlide, stopCycle, updateBundleMeta, activateBundle, updateDisplayConfig, bundleMetaUpdate };
}
