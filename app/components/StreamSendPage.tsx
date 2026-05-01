"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import Link from "next/link";

const PC_CONFIG: RTCConfiguration = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

function generateId() {
    return Math.random().toString(36).slice(2, 10);
}

export default function StreamSendPage() {
    const router = useRouter();
    const [authChecked, setAuthChecked] = useState(false);
    const [username, setUsername] = useState("");
    const [streamName, setStreamName] = useState("");
    const [streaming, setStreaming] = useState(false);
    const [sourceType, setSourceType] = useState<"screen" | "camera" | null>(null);
    const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
    const [audioEnabled, setAudioEnabled] = useState(false);
    const [audioMuted, setAudioMuted] = useState(false);
    const [viewerCount, setViewerCount] = useState(0);
    const [status, setStatus] = useState("");

    const socketRef = useRef<Socket | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const previewRef = useRef<HTMLVideoElement>(null);
    const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
    const streamIdRef = useRef<string>(generateId());
    const flippingRef = useRef(false);

    // Auth check
    useEffect(() => {
        fetch("/api/auth")
            .then((r) => r.json())
            .then((data) => {
                if (!data.authenticated) {
                    router.replace("/");
                    return;
                }
                setUsername(data.username ?? "");
                setStreamName(data.username ?? "Stream");
                setAuthChecked(true);
            })
            .catch(() => router.replace("/"));
    }, [router]);

    // Socket setup
    useEffect(() => {
        if (!authChecked) return;

        const socket = io({ query: { role: "streamer" }, transports: ["websocket", "polling"] });
        socketRef.current = socket;

        socket.on("stream:viewer:joined", ({ viewerSocketId }: { viewerSocketId: string }) => {
            if (!streamRef.current) return;
            setViewerCount((n) => n + 1);

            const pc = new RTCPeerConnection(PC_CONFIG);
            pcsRef.current.set(viewerSocketId, pc);

            for (const track of streamRef.current.getTracks()) {
                pc.addTrack(track, streamRef.current);
            }

            pc.onicecandidate = (e) => {
                if (e.candidate) {
                    socket.emit("stream:signal", { to: viewerSocketId, data: { type: "candidate", candidate: e.candidate } });
                }
            };

            pc.createOffer()
                .then((offer) => pc.setLocalDescription(offer))
                .then(() => {
                    socket.emit("stream:signal", { to: viewerSocketId, data: pc.localDescription });
                });
        });

        socket.on("stream:viewer:left", ({ viewerSocketId }: { viewerSocketId: string }) => {
            const pc = pcsRef.current.get(viewerSocketId);
            if (pc) { pc.close(); pcsRef.current.delete(viewerSocketId); }
            setViewerCount((n) => Math.max(0, n - 1));
        });

        socket.on("stream:signal", ({ from, data }: { from: string; data: RTCSessionDescriptionInit | { type: "candidate"; candidate: RTCIceCandidateInit } }) => {
            const pc = pcsRef.current.get(from);
            if (!pc) return;
            if (data.type === "answer") {
                pc.setRemoteDescription(new RTCSessionDescription(data as RTCSessionDescriptionInit));
            } else if (data.type === "candidate" && "candidate" in data && data.candidate) {
                pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            }
        });

        return () => { socket.disconnect(); };
    }, [authChecked]);

    function attachEndedHandler(media: MediaStream) {
        media.getTracks().forEach((t) => {
            t.onended = () => {
                if (!flippingRef.current) stopStream();
            };
        });
    }

    async function startStream(type: "screen" | "camera", facing: "user" | "environment" = "environment") {
        if (!window.isSecureContext) {
            setStatus("Camera/screen access requires HTTPS. Run \"npm run gen-cert\", then open this page over https://");
            return;
        }
        if (!navigator.mediaDevices?.getUserMedia) {
            setStatus("Your browser does not support media capture on this connection. Make sure you're using HTTPS.");
            return;
        }
        try {
            const media =
                type === "screen"
                    ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: audioEnabled })
                    : await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing } }, audio: audioEnabled });

            streamRef.current = media;
            attachEndedHandler(media);
            if (previewRef.current) previewRef.current.srcObject = media;

            streamIdRef.current = generateId();
            socketRef.current?.emit("stream:register", {
                streamId: streamIdRef.current,
                name: streamName || username || "Stream",
            });

            setSourceType(type);
            setFacingMode(facing);
            setStreaming(true);
            setViewerCount(0);
            setStatus("");
        } catch (err) {
            setStatus(`Could not start capture: ${(err as Error).message}`);
        }
    }

    async function flipCamera() {
        const nextFacing = facingMode === "user" ? "environment" : "user";
        flippingRef.current = true;
        try {
            const newStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: nextFacing } },
                audio: audioEnabled,
            });

            const newVideoTrack = newStream.getVideoTracks()[0];
            const newAudioTrack = newStream.getAudioTracks()[0];

            // Seamlessly replace tracks in all active peer connections
            await Promise.all(
                [...pcsRef.current.values()].flatMap((pc) =>
                    pc.getSenders().map((sender) => {
                        if (sender.track?.kind === "video" && newVideoTrack) return sender.replaceTrack(newVideoTrack);
                        if (sender.track?.kind === "audio" && newAudioTrack) return sender.replaceTrack(newAudioTrack);
                        return Promise.resolve();
                    })
                )
            );

            streamRef.current?.getTracks().forEach((t) => t.stop());
            streamRef.current = newStream;
            attachEndedHandler(newStream);
            if (previewRef.current) previewRef.current.srcObject = newStream;
            setFacingMode(nextFacing);
        } catch (err) {
            setStatus(`Could not switch camera: ${(err as Error).message}`);
        } finally {
            flippingRef.current = false;
        }
    }

    function stopStream() {
        socketRef.current?.emit("stream:unregister", { streamId: streamIdRef.current });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (previewRef.current) previewRef.current.srcObject = null;
        pcsRef.current.forEach((pc) => pc.close());
        pcsRef.current.clear();
        setStreaming(false);
        setSourceType(null);
        setAudioMuted(false);
        setViewerCount(0);
    }

    if (!authChecked) return null;

    return (
        <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6 gap-6">
            <h1 className="text-2xl font-bold">Stream to Infoscreen</h1>

            {!streaming ? (
                <div className="flex flex-col gap-4 w-full max-w-sm">
                    <div className="flex flex-col gap-1">
                        <label className="text-sm text-gray-400">Stream name</label>
                        <input
                            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                            value={streamName}
                            onChange={(e) => setStreamName(e.target.value)}
                            placeholder="Enter a name for your stream"
                        />
                    </div>
                    <div className="flex gap-3">
                        <button
                            className="flex-1 bg-blue-600 hover:bg-blue-500 rounded px-4 py-2 font-medium transition-colors"
                            onClick={() => startStream("screen")}
                        >
                            Share Screen
                        </button>
                        <button
                            className="flex-1 bg-gray-700 hover:bg-gray-600 rounded px-4 py-2 font-medium transition-colors"
                            onClick={() => startStream("camera")}
                        >
                            Use Camera
                        </button>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={audioEnabled}
                            onChange={(e) => setAudioEnabled(e.target.checked)}
                            className="w-4 h-4 accent-blue-500"
                        />
                        Include microphone audio
                    </label>
                    {status && <p className="text-red-400 text-sm">{status}</p>}
                </div>
            ) : (
                <div className="flex flex-col gap-4 w-full max-w-2xl items-center">
                    <div className="flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="font-medium">{streamName}</span>
                        <span className="text-gray-400 text-sm">{viewerCount} viewer{viewerCount !== 1 ? "s" : ""}</span>
                    </div>
                    <video
                        ref={previewRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full rounded-lg border border-gray-700 bg-black max-h-96 object-contain"
                    />
                    <div className="flex gap-3">
                        {sourceType === "camera" && (
                            <button
                                className="bg-gray-700 hover:bg-gray-600 rounded px-4 py-2 font-medium transition-colors"
                                onClick={flipCamera}
                                title="Switch camera"
                            >
                                Flip Camera
                            </button>
                        )}
                        {audioEnabled && (
                            <button
                                className="bg-gray-700 hover:bg-gray-600 rounded px-4 py-2 font-medium transition-colors"
                                onClick={() => {
                                    const audioTrack = streamRef.current?.getAudioTracks()[0];
                                    if (!audioTrack) return;
                                    audioTrack.enabled = !audioTrack.enabled;
                                    setAudioMuted(!audioTrack.enabled);
                                }}
                                title={audioMuted ? "Unmute microphone" : "Mute microphone"}
                            >
                                {audioMuted ? "Unmute" : "Mute"}
                            </button>
                        )}
                        <button
                            className="bg-red-600 hover:bg-red-500 rounded px-6 py-2 font-medium transition-colors"
                            onClick={stopStream}
                        >
                            Stop Streaming
                        </button>
                    </div>
                    {status && <p className="text-red-400 text-sm">{status}</p>}
                </div>
            )}

            <Link href="/" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">
                ← Back
            </Link>
        </div>
    );
}
