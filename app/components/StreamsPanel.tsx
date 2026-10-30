"use client";

import { useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";
import { StreamInfo, DisplayConfig } from "../hooks/useSocket";

const PC_CONFIG: RTCConfiguration = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

interface StreamEntry {
    socketId: string; // the streamer connection this peer connection talks to
    pc: RTCPeerConnection;
}

interface ReceivedMedia {
    socketId: string; // the streamer connection it came from; stale once the streamer reconnects
    stream: MediaStream;
}

function StreamPreview({ mediaStream }: { mediaStream: MediaStream | null }) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current) videoRef.current.srcObject = mediaStream;
    }, [mediaStream]);

    return <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-contain" />;
}

interface Props {
    streams: StreamInfo[];
    socketRef: React.RefObject<Socket | null>;
    displayConfigs: DisplayConfig[];
    selectedDisplay: string | null;
    onShowStream: (streamId: string, displayId: string) => void;
    onClearStream: (displayId: string, streamId: string) => void;
    onDisplayOptionsChange: (displayId: string, options: StreamDisplayOptions) => void;
    displayActiveStreams: Record<string, string[]>; // displayId → streamIds shown
}

export type StreamDisplayOptions = Pick<DisplayConfig, "autoShowStreams" | "streamMultiview">;

function OptionCheckbox({ checked, onChange, children }: { checked: boolean; onChange: (checked: boolean) => void; children: React.ReactNode }) {
    return (
        <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer select-none">
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="w-3.5 h-3.5 accent-blue-500"
            />
            {children}
        </label>
    );
}

function DisplayStreamOptions({ display, onChange }: { display: DisplayConfig; onChange: (options: StreamDisplayOptions) => void }) {
    return (
        <div className="flex flex-col gap-1">
            <OptionCheckbox checked={display.autoShowStreams === true} onChange={(autoShowStreams) => onChange({ autoShowStreams })}>
                Auto-show new streams on {display.name}
            </OptionCheckbox>
            <OptionCheckbox checked={display.streamMultiview === true} onChange={(streamMultiview) => onChange({ streamMultiview })}>
                Multiview: show several streams as a grid
            </OptionCheckbox>
        </div>
    );
}

export default function StreamsPanel({
    streams,
    socketRef,
    displayConfigs,
    selectedDisplay,
    onShowStream,
    onClearStream,
    onDisplayOptionsChange,
    displayActiveStreams,
}: Props) {
    const entriesRef = useRef<Map<string, StreamEntry>>(new Map());
    const streamsRef = useRef(streams);
    const [receivedMedia, setReceivedMedia] = useState<Record<string, ReceivedMedia>>({});

    useEffect(() => { streamsRef.current = streams; }, [streams]);

    // Depend on stream IDs only — not the array reference — so a slide change
    // (which recreates the streams array with identical content) doesn't reconnect.
    const streamIds = streams.map((s) => s.streamId + s.socketId).join(",");

    // When streams are added or removed, set up or tear down peer connections.
    // Also registers the signal handler here so it's always registered when
    // the socket is ready (socketRef.current is null on first mount with [] deps).
    useEffect(() => {
        const socket = socketRef.current;
        if (!socket) return;

        const currentSocketIds = new Map(streamsRef.current.map((s) => [s.streamId, s.socketId]));

        // Tear down connections for streams that are gone, or whose streamer
        // reconnected — the old peer connection points at a dead socket.
        for (const [streamId, entry] of entriesRef.current.entries()) {
            if (currentSocketIds.get(streamId) !== entry.socketId) {
                entry.pc.close();
                socket.emit("stream:unwatch", { streamId });
                entriesRef.current.delete(streamId);
            }
        }

        // Set up connections for new streams
        for (const stream of streamsRef.current) {
            if (entriesRef.current.has(stream.streamId)) continue;

            const pc = new RTCPeerConnection(PC_CONFIG);
            entriesRef.current.set(stream.streamId, { socketId: stream.socketId, pc });

            pc.ontrack = (e) => {
                const ms = e.streams[0] ?? new MediaStream([e.track]);
                setReceivedMedia((prev) => {
                    // Drop media of connections that were torn down since.
                    const live = Object.fromEntries(Object.entries(prev).filter(([streamId, media]) =>
                        entriesRef.current.get(streamId)?.socketId === media.socketId));
                    return { ...live, [stream.streamId]: { socketId: stream.socketId, stream: ms } };
                });
            };

            pc.onicecandidate = (e) => {
                if (e.candidate) {
                    socket.emit("stream:signal", {
                        to: stream.socketId,
                        data: { type: "candidate", candidate: e.candidate },
                    });
                }
            };

            socket.emit("stream:watch", { streamId: stream.streamId });
        }

        // Signal handler — uses refs so it doesn't need streams/entries in its closure
        const onSignal = ({ from, data }: { from: string; data: RTCSessionDescriptionInit | { type: "candidate"; candidate: RTCIceCandidateInit } }) => {
            const stream = streamsRef.current.find((s) => s.socketId === from);
            if (!stream) return;
            const entry = entriesRef.current.get(stream.streamId);
            if (!entry) return;

            if (data.type === "offer") {
                entry.pc.setRemoteDescription(new RTCSessionDescription(data as RTCSessionDescriptionInit))
                    .then(() => entry.pc.createAnswer())
                    .then((answer) => entry.pc.setLocalDescription(answer))
                    .then(() => { socket.emit("stream:signal", { to: from, data: entry.pc.localDescription }); });
            } else if (data.type === "candidate" && "candidate" in data && data.candidate) {
                entry.pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            }
        };

        socket.on("stream:signal", onSignal);

        return () => { socket.off("stream:signal", onSignal); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [streamIds]);

    // Cleanup all connections on unmount
    useEffect(() => {
        const socket = socketRef.current;
        const entries = entriesRef.current;
        return () => {
            for (const [streamId, entry] of entries.entries()) {
                entry.pc.close();
                socket?.emit("stream:unwatch", { streamId });
            }
            entries.clear();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const targetDisplay = selectedDisplay ?? displayConfigs[0]?.id ?? null;
    const targetDisplayConfig = displayConfigs.find((conf) => conf.id === targetDisplay) ?? null;
    const shownOnTarget = targetDisplay ? displayActiveStreams[targetDisplay] ?? [] : [];
    const displayOptions = targetDisplayConfig && (
        <DisplayStreamOptions display={targetDisplayConfig} onChange={(options) => onDisplayOptionsChange(targetDisplayConfig.id, options)} />
    );

    if (streams.length === 0) {
        return (
            <div className="flex flex-col gap-2">
                {displayOptions}
                <div className="text-xs text-gray-500 text-center py-6">
                    No active streams.{" "}
                    <a href="/send" target="_blank" className="text-blue-400 hover:underline">
                        Open /send
                    </a>{" "}
                    to start one.
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            {displayOptions}
            {streams.map((stream) => {
                const received = receivedMedia[stream.streamId];
                const mediaStream = received?.socketId === stream.socketId ? received.stream : null;
                const isActive = shownOnTarget.includes(stream.streamId);

                return (
                    <div key={stream.streamId} className="border border-gray-700 rounded-lg overflow-hidden bg-gray-900">
                        <div className="relative bg-black" style={{ height: 250 }}>
                            <StreamPreview mediaStream={mediaStream} />
                            {!mediaStream && (
                                <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-sm">
                                    Connecting…
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2 px-3 py-2">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                            <span className="text-sm font-medium flex-1 truncate">{stream.name}</span>
                            {targetDisplay && (
                                isActive ? (
                                    <button
                                        className="text-xs bg-red-700 hover:bg-red-600 rounded px-2 py-1 transition-colors"
                                        onClick={() => onClearStream(targetDisplay, stream.streamId)}
                                    >
                                        Clear
                                    </button>
                                ) : (
                                    <button
                                        className="text-xs bg-blue-600 hover:bg-blue-500 rounded px-2 py-1 transition-colors"
                                        onClick={() => onShowStream(stream.streamId, targetDisplay)}
                                    >
                                        Show on display
                                    </button>
                                )
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
