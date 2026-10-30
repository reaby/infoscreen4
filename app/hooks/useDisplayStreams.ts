"use client";

import { useEffect, useState } from "react";
import { Socket } from "socket.io-client";

const PC_CONFIG: RTCConfiguration = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

interface AssignedStream {
    streamId: string;
    streamName: string;
    streamSocketId: string;
}

interface Viewer {
    socketId: string; // the streamer connection this peer connection talks to
    pc: RTCPeerConnection;
}

type Signal = RTCSessionDescriptionInit | { type: "candidate"; candidate: RTCIceCandidateInit };

export interface DisplayStream {
    streamId: string;
    mediaStream: MediaStream | null; // null until the first track arrives
}

/**
 * Watches every stream the server assigns to this display, one peer connection per
 * stream, and returns them in the order they should be shown.
 */
export function useDisplayStreams(socketRef: React.RefObject<Socket | null>): DisplayStream[] {
    const [assigned, setAssigned] = useState<AssignedStream[]>([]);
    const [media, setMedia] = useState<Record<string, MediaStream>>({});

    useEffect(() => {
        const socket = socketRef.current;
        if (!socket) return;
        const viewers = new Map<string, Viewer>(); // streamId → viewer

        function dropMedia(streamId: string) {
            setMedia((prev) => {
                const next = { ...prev };
                delete next[streamId];
                return next;
            });
        }

        function stopWatching(streamId: string, notifyServer = true) {
            viewers.get(streamId)?.pc.close();
            viewers.delete(streamId);
            dropMedia(streamId);
            if (notifyServer) socket?.emit("stream:unwatch", { streamId });
        }

        function startWatching(stream: AssignedStream) {
            const pc = new RTCPeerConnection(PC_CONFIG);
            viewers.set(stream.streamId, { socketId: stream.streamSocketId, pc });

            pc.ontrack = (e) => {
                const ms = e.streams[0] ?? new MediaStream([e.track]);
                setMedia((prev) => ({ ...prev, [stream.streamId]: ms }));
            };
            pc.onicecandidate = (e) => {
                if (!e.candidate) return;
                socket?.emit("stream:signal", {
                    to: stream.streamSocketId,
                    data: { type: "candidate", candidate: e.candidate },
                });
            };

            socket?.emit("stream:watch", { streamId: stream.streamId });
        }

        // A stream whose streamer reconnected has a new socket; its old peer connection is dead.
        function onAssigned({ streams }: { streams: AssignedStream[] }) {
            const wantedSocketIds = new Map(streams.map((s) => [s.streamId, s.streamSocketId]));
            for (const [streamId, viewer] of [...viewers.entries()]) {
                if (wantedSocketIds.get(streamId) !== viewer.socketId) stopWatching(streamId);
            }
            for (const stream of streams) {
                if (!viewers.has(stream.streamId)) startWatching(stream);
            }
            setAssigned(streams);
        }

        function onSignal({ from, data }: { from: string; data: Signal }) {
            const pc = [...viewers.values()].find((viewer) => viewer.socketId === from)?.pc;
            if (!pc) return;
            if (data.type === "offer") {
                pc.setRemoteDescription(new RTCSessionDescription(data as RTCSessionDescriptionInit))
                    .then(() => pc.createAnswer())
                    .then((answer) => pc.setLocalDescription(answer))
                    .then(() => { socket?.emit("stream:signal", { to: from, data: pc.localDescription }); });
            } else if (data.type === "candidate" && "candidate" in data && data.candidate) {
                pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            }
        }

        // The server forgets what a dropped connection watched and re-sends the
        // assignment on reconnect, so start over from nothing.
        function onDisconnect() {
            for (const streamId of [...viewers.keys()]) stopWatching(streamId, false);
        }

        socket.on("streams:assigned", onAssigned);
        socket.on("stream:signal", onSignal);
        socket.on("disconnect", onDisconnect);

        return () => {
            socket.off("streams:assigned", onAssigned);
            socket.off("stream:signal", onSignal);
            socket.off("disconnect", onDisconnect);
            for (const streamId of [...viewers.keys()]) stopWatching(streamId);
            setAssigned([]);
        };
    }, [socketRef]);

    return assigned.map((stream) => ({ streamId: stream.streamId, mediaStream: media[stream.streamId] ?? null }));
}
