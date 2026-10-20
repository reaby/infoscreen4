"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { TransitionConfig } from "../lib/transitions";

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
    transition?: TransitionConfig;
}

export interface BundleMetaUpdate {
    bundle: string;
    meta: Record<string, unknown>;
}

export interface StreamInfo {
    streamId: string;
    name: string;
    socketId: string;
}

export interface DisplayAnnouncement {
    line1: string;
    line2: string;
    color: string;
}

export interface ServerState {
    activeSlide: ActiveSlide | null;
    connectedDisplays: number;
    isCycling: boolean;
    displayConfigs: DisplayConfig[];
    displayStates: Record<string, ActiveSlide | null>;
    displayConnections: Record<string, number>;
    displayCycling: Record<string, boolean>;
    displayQueuedNext: Record<string, string | null>;
    displayAnnouncements: Record<string, DisplayAnnouncement | null>;
    streams: StreamInfo[];
}

interface DisplaySlideUpdate {
    displayId: string;
    slide: ActiveSlide;
}

type DisplayStates = ServerState["displayStates"];

/**
 * state:sync carries only which slide each display shows; its content (JSON, bundle
 * meta) arrives separately in display:slide. Attaches the content to every display
 * state that still shows that slide.
 */
function withSlideContent(states: DisplayStates, content: Record<string, ActiveSlide>): DisplayStates {
    return Object.fromEntries(Object.entries(states).map(([id, state]) => {
        const known = content[id];
        const matches = state && known && known.bundle === state.bundle && known.slide === state.slide;
        return [id, matches ? { ...state, json: known.json, bundleMeta: known.bundleMeta } : state];
    }));
}

export function useSocket(role: SocketRole, displayId?: string) {
    const socketRef = useRef<Socket | null>(null);
    const slideContentRef = useRef<Record<string, ActiveSlide>>({});
    const [connected, setConnected] = useState(false);
    const [state, setState] = useState<ServerState>({
        activeSlide: null,
        connectedDisplays: 0,
        isCycling: false,
        displayConfigs: [],
        displayStates: {},
        displayConnections: {},
        displayCycling: {},
        displayQueuedNext: {},
        displayAnnouncements: {},
        streams: [],
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

        socket.on("state:sync", (s: ServerState) => setState(prev => {
            // Keep existing streams reference if the content hasn't changed,
            // so StreamsPanel doesn't rebuild peer connections on every slide event.
            const incoming = s.streams ?? [];
            const same = prev.streams.length === incoming.length &&
                prev.streams.every((p, i) => p.streamId === incoming[i]?.streamId && p.socketId === incoming[i]?.socketId);
            return {
                ...s,
                displayStates: withSlideContent(s.displayStates ?? {}, slideContentRef.current),
                streams: same ? prev.streams : incoming,
            };
        }));
        socket.on("display:slide", ({ displayId: id, slide }: DisplaySlideUpdate) => {
            slideContentRef.current = { ...slideContentRef.current, [id]: slide };
            setState((prev) => ({
                ...prev,
                displayStates: withSlideContent(prev.displayStates, slideContentRef.current),
            }));
        });
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
        socket.on("streams:update", (streams: StreamInfo[]) =>
            setState((prev) => ({ ...prev, streams }))
        );

        return () => { socket.disconnect(); };
    }, [role, displayId]);

    const showSlide = (displayId: string, slide: ActiveSlide) => {
        socketRef.current?.emit("slide:show", { displayId, ...slide });
    };

    const clearSlide = (displayId: string) => {
        socketRef.current?.emit("slide:clear", { displayId });
    };

    const stopCycle = (displayId: string) => {
        socketRef.current?.emit("cycle:stop", { displayId });
    };

    const queueNextSlide = (displayId: string, slideId: string | null) => {
        socketRef.current?.emit("cycle:queueNext", { displayId, slideId });
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

    const showStream = (streamId: string, displayId: string) => {
        socketRef.current?.emit("stream:show", { streamId, displayId });
    };

    const clearStream = (displayId: string) => {
        socketRef.current?.emit("stream:clear", { displayId });
    };

    const showAnnouncement = (displayId: string, line1: string, line2: string, color: string) => {
        socketRef.current?.emit("announce:show", { displayId, line1, line2, color });
    };

    const showAnnouncementAll = (line1: string, line2: string, color: string) => {
        socketRef.current?.emit("announce:showAll", { line1, line2, color });
    };

    const clearAnnouncementAll = () => {
        socketRef.current?.emit("announce:clearAll");
    };

    return {
        connected,
        state,
        showSlide,
        clearSlide,
        stopCycle,
        queueNextSlide,
        updateBundleMeta,
        activateBundle,
        updateDisplayConfig,
        bundleMetaUpdate,
        showStream,
        clearStream,
        showAnnouncement,
        showAnnouncementAll,
        clearAnnouncementAll,
        socketRef,
    };
}
