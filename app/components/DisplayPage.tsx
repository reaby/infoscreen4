"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ActiveSlide, useSocket } from "../hooks/useSocket";
import { BundleMeta } from "../interfaces/BundleMeta";
import { DEFAULT_TRANSITION } from "../lib/transitions";
import SlideTransition from "./SlideTransition";

const DisplaySlide = dynamic(() => import("./DisplaySlide"), { ssr: false });

const PC_CONFIG: RTCConfiguration = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

interface ActiveStream {
    streamId: string;
    streamName: string;
    streamSocketId: string;
}

interface Announcement {
    line1: string;
    line2: string;
    color: string;
}

interface DisplayPageProps {
    displayId?: string;
}

// The slide on screen together with its loaded content. They are committed as one
// unit so a transition never starts with the previous slide's content in the new layer.
interface ShownSlide {
    slide: ActiveSlide | null;
    json: object | null;
    meta: BundleMeta;
}

const STANDBY: ShownSlide = { slide: null, json: null, meta: {} };

function transitionKeyOf(slide: ActiveSlide | null): string {
    return slide ? `${slide.bundle}:${slide.slide}` : "__standby__";
}

function toggleFullscreen() {
    if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
    } else {
        document.documentElement.requestFullscreen().catch(() => {});
    }
}

export default function DisplayPage({ displayId = "1" }: DisplayPageProps) {
    const defer = (fn: () => void) => queueMicrotask(fn);
    const { state, bundleMetaUpdate, socketRef, connected } = useSocket("display", displayId);
    const [shown, setShown] = useState<ShownSlide>(STANDBY);
    const loadSeqRef = useRef(0);

    // WebRTC stream state
    const [activeStream, setActiveStream] = useState<ActiveStream | null>(null);
    const activeStreamRef = useRef<ActiveStream | null>(null);
    const streamVideoRef = useRef<HTMLVideoElement>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);

    // Lower-third announcement overlay
    const [announcement, setAnnouncement] = useState<Announcement | null>(null);

    useEffect(() => {
        activeStreamRef.current = activeStream;
    }, [activeStream]);

    // Slide loading
    useEffect(() => {
        const active = state.activeSlide;
        const seq = ++loadSeqRef.current;
        const show = (json: object | null, meta: BundleMeta) => {
            if (loadSeqRef.current !== seq) return;
            setShown({ slide: active, json, meta });
        };

        if (!active) {
            defer(() => setShown(STANDBY));
            return;
        }

        const hasSocketJson = active.json != null;
        const hasSocketMeta = active.bundleMeta != null;
        if (hasSocketJson && hasSocketMeta) {
            defer(() => show(active.json as object, active.bundleMeta as BundleMeta));
            return;
        }

        const metaPromise = hasSocketMeta
            ? Promise.resolve(active.bundleMeta as BundleMeta)
            : fetch(`/api/bundles/${encodeURIComponent(active.bundle)}`)
                .then((r) => r.json()).catch(() => ({}));

        metaPromise.then((meta) => {
            const resolvedMeta = (meta ?? {}) as BundleMeta;

            if (hasSocketJson) {
                show(active.json as object, resolvedMeta);
                return;
            }
            // Website/video/image slides have no fabric JSON on disk — fetching it always 400s.
            const entryType = resolvedMeta.slides?.find((s) => s.id === active.slide)?.type;
            if (entryType && entryType !== "fabric") {
                show(null, resolvedMeta);
                return;
            }

            fetch(`/api/bundles/${encodeURIComponent(active.bundle)}/slides/${encodeURIComponent(active.slide)}`)
                .then((r) => r.json()).catch(() => null)
                .then((json) => show(json, resolvedMeta));
        });
    }, [state.activeSlide]);

    useEffect(() => {
        if (!bundleMetaUpdate) return;
        defer(() => setShown((prev) => (
            prev.slide?.bundle === bundleMetaUpdate.bundle
                ? { ...prev, meta: bundleMetaUpdate.meta as BundleMeta }
                : prev
        )));
    }, [bundleMetaUpdate]);

    // WebRTC stream handling
    useEffect(() => {
        const socket = socketRef.current;
        if (!socket) return;

        function teardown() {
            const currentStream = activeStreamRef.current;
            if (currentStream) {
                socket?.emit("stream:unwatch", { streamId: currentStream.streamId });
            }
            pcRef.current?.close();
            pcRef.current = null;
            if (streamVideoRef.current) streamVideoRef.current.srcObject = null;
            activeStreamRef.current = null;
            setActiveStream(null);
        }

        function onStreamIncoming(data: ActiveStream) {
            teardown();
            activeStreamRef.current = data;
            setActiveStream(data);

            const pc = new RTCPeerConnection(PC_CONFIG);
            pcRef.current = pc;

            pc.ontrack = (e) => {
                const ms = e.streams[0] ?? new MediaStream([e.track]);
                if (streamVideoRef.current) streamVideoRef.current.srcObject = ms;
            };

            const sock = socketRef.current;
            pc.onicecandidate = (e) => {
                if (e.candidate) {
                    sock?.emit("stream:signal", {
                        to: data.streamSocketId,
                        data: { type: "candidate", candidate: e.candidate },
                    });
                }
            };

            sock?.emit("stream:watch", { streamId: data.streamId });
        }

        function onStreamSignal({ from, data: sigData }: { from: string; data: RTCSessionDescriptionInit | { type: "candidate"; candidate: RTCIceCandidateInit } }) {
            const pc = pcRef.current;
            if (!pc) return;
            if (sigData.type === "offer") {
                pc.setRemoteDescription(new RTCSessionDescription(sigData as RTCSessionDescriptionInit))
                    .then(() => pc.createAnswer())
                    .then((answer) => pc.setLocalDescription(answer))
                    .then(() => {
                        socketRef.current?.emit("stream:signal", { to: from, data: pc.localDescription });
                    });
            } else if (sigData.type === "candidate" && "candidate" in sigData && sigData.candidate) {
                pc.addIceCandidate(new RTCIceCandidate(sigData.candidate));
            }
        }

        function onStreamCleared() { teardown(); }
        function onStreamEnded() { teardown(); }

        socket.on("stream:incoming", onStreamIncoming);
        socket.on("stream:signal", onStreamSignal);
        socket.on("stream:cleared", onStreamCleared);
        socket.on("stream:ended", onStreamEnded);

        return () => {
            socket.off("stream:incoming", onStreamIncoming);
            socket.off("stream:signal", onStreamSignal);
            socket.off("stream:cleared", onStreamCleared);
            socket.off("stream:ended", onStreamEnded);
            teardown();
        };
    }, [connected, socketRef]); // re-run when socket connects/reconnects

    // Lower-third announcement handling
    useEffect(() => {
        const socket = socketRef.current;
        if (!socket) return;

        const onAnnounceShow = (data: Announcement) => setAnnouncement(data);
        const onAnnounceClear = () => setAnnouncement(null);

        socket.on("announce:show", onAnnounceShow);
        socket.on("announce:clear", onAnnounceClear);

        return () => {
            socket.off("announce:show", onAnnounceShow);
            socket.off("announce:clear", onAnnounceClear);
        };
    }, [connected, socketRef]);

    return (
        <div className="display-root" onDoubleClick={toggleFullscreen}>
            {!shown.slide && !activeStream && (
                <div className="display-standby">
                    <span className="display-standby-text">Standby</span>
                </div>
            )}
            <SlideTransition
                transitionKey={transitionKeyOf(shown.slide)}
                transition={shown.slide?.transition ?? DEFAULT_TRANSITION}
            >
                <DisplaySlide
                    json={shown.json}
                    bundleMeta={shown.meta}
                    activeEntry={shown.meta.slides?.find(s => s.id === shown.slide?.slide) ?? null}
                    announcementActive={!!announcement && (!!announcement.line1 || !!announcement.line2)}
                />
            </SlideTransition>
            {activeStream && (
                <div className="absolute inset-0 z-50 bg-black flex items-center justify-center">
                    <video
                        ref={streamVideoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-contain"
                    />
                </div>
            )}
            {announcement && (announcement.line1 || announcement.line2) && (
                <div className="lower-third" style={{ background: announcement.color }}>
                    {announcement.line1 && <div className="lower-third-line">{announcement.line1}</div>}
                    {announcement.line2 && <div className="lower-third-line">{announcement.line2}</div>}
                </div>
            )}
        </div>
    );
}
