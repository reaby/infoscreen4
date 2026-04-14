"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

export type SocketRole = "admin" | "display";

export interface ActiveSlide {
    bundle: string;
    slide: string;
    duration: number;
}

export interface BundleMetaUpdate {
    bundle: string;
    meta: Record<string, unknown>;
}

export interface ServerState {
    activeSlide: ActiveSlide | null;
    activeBundle: string | null;
    connectedDisplays: number;
    isCycling: boolean;
}

export function useSocket(role: SocketRole) {
    const socketRef = useRef<Socket | null>(null);
    const [connected, setConnected] = useState(false);
    const [state, setState] = useState<ServerState>({
        activeSlide: null,
        activeBundle: null,
        connectedDisplays: 0,
        isCycling: false,
    });
    const [bundleMetaUpdate, setBundleMetaUpdate] = useState<BundleMetaUpdate | null>(null);

    useEffect(() => {
        const socket = io({ query: { role } });
        socketRef.current = socket;

        socket.on("connect", () => setConnected(true));
        socket.on("disconnect", () => setConnected(false));

        socket.on("state:sync", (s: ServerState) => setState(s));
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

    const showSlide = (slide: ActiveSlide) => {
        socketRef.current?.emit("slide:show", slide);
    };

    const clearSlide = () => {
        socketRef.current?.emit("slide:clear");
    };

    const stopCycle = () => {
        socketRef.current?.emit("cycle:stop");
    };

    const updateBundleMeta = (bundle: string, meta: Record<string, unknown>) => {
        socketRef.current?.emit("bundle:meta", { bundle, meta });
    };

    const activateBundle = (bundle: string) => {
        socketRef.current?.emit("bundle:activate", { bundle });
    };

    return { connected, state, showSlide, clearSlide, stopCycle, updateBundleMeta, activateBundle, bundleMetaUpdate };
}
