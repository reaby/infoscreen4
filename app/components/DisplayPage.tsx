"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSocket } from "../hooks/useSocket";
import { BundleMeta } from "../interfaces/BundleMeta";

const DisplaySlide = dynamic(() => import("./DisplaySlide"), { ssr: false });

const PC_CONFIG: RTCConfiguration = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

interface ActiveStream {
    streamId: string;
    streamName: string;
    streamSocketId: string;
}

interface DisplayPageProps {
    displayId?: string;
}

export default function DisplayPage({ displayId = "1" }: DisplayPageProps) {
    const defer = (fn: () => void) => queueMicrotask(fn);
    const { state, bundleMetaUpdate, socketRef, connected } = useSocket("display", displayId);
    const [displayJson, setDisplayJson] = useState<object | null>(null);
    const [bundleMeta, setBundleMeta] = useState<BundleMeta>({});
    const loadSeqRef = useRef(0);

    // WebRTC stream state
    const [activeStream, setActiveStream] = useState<ActiveStream | null>(null);
    const streamVideoRef = useRef<HTMLVideoElement>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);

    // Slide loading
    useEffect(() => {
        const active = state.activeSlide;
        if (!active) {
            defer(() => {
                setDisplayJson(null);
                setBundleMeta({});
            });
            return;
        }

        const hasSocketJson = active.json != null;
        const hasSocketMeta = active.bundleMeta != null;
        if (hasSocketJson && hasSocketMeta) {
            defer(() => {
                setBundleMeta(active.bundleMeta as BundleMeta);
                setDisplayJson(active.json as object);
            });
            return;
        }

        const seq = ++loadSeqRef.current;

        Promise.all([
            hasSocketMeta
                ? Promise.resolve(active.bundleMeta as BundleMeta)
                : fetch(`/api/bundles/${encodeURIComponent(active.bundle)}`)
                    .then((r) => r.json()).catch(() => ({})),
            hasSocketJson
                ? Promise.resolve(active.json)
                : fetch(`/api/bundles/${encodeURIComponent(active.bundle)}/slides/${encodeURIComponent(active.slide)}`)
                    .then((r) => r.json()).catch(() => null),
        ]).then(([meta, json]) => {
            if (loadSeqRef.current !== seq) return;
            setBundleMeta((meta ?? {}) as BundleMeta);
            if (json) setDisplayJson(json);
        });
    }, [state.activeSlide]);

    useEffect(() => {
        if (!bundleMetaUpdate) return;
        const active = state.activeSlide;
        if (!active || active.bundle !== bundleMetaUpdate.bundle) return;
        defer(() => setBundleMeta(bundleMetaUpdate.meta as BundleMeta));
    }, [bundleMetaUpdate, state.activeSlide]);

    // WebRTC stream handling
    useEffect(() => {
        const socket = socketRef.current;
        if (!socket) return;

        function teardown() {
            pcRef.current?.close();
            pcRef.current = null;
            if (streamVideoRef.current) streamVideoRef.current.srcObject = null;
            setActiveStream(null);
        }

        function onStreamIncoming(data: ActiveStream) {
            teardown();
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
    }, [connected]); // re-run when socket connects/reconnects

    return (
        <div className="display-root">
            {!state.activeSlide && !activeStream && (
                <div className="display-standby">
                    <span className="display-standby-text">Standby</span>
                </div>
            )}
            <DisplaySlide
                json={displayJson}
                bundleMeta={bundleMeta}
                activeEntry={bundleMeta.slides?.find(s => s.id === state.activeSlide?.slide) ?? null}
            />
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
        </div>
    );
}
