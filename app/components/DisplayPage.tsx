"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ActiveSlide, useSocket } from "../hooks/useSocket";
import { DisplayStream, useDisplayStreams } from "../hooks/useDisplayStreams";
import { BundleMeta } from "../interfaces/BundleMeta";
import { DEFAULT_TRANSITION } from "../lib/transitions";
import SlideTransition from "./SlideTransition";

const DisplaySlide = dynamic(() => import("./DisplaySlide"), { ssr: false });

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

function StreamVideo({ mediaStream }: { mediaStream: MediaStream | null }) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current) videoRef.current.srcObject = mediaStream;
    }, [mediaStream]);

    return <video ref={videoRef} autoPlay playsInline className="w-full h-full object-contain" />;
}

/** As square as possible: 2 streams side by side, 3–4 as 2×2, 5–6 as 3×2 and so on. */
function gridColumnsFor(count: number): number {
    return Math.ceil(Math.sqrt(count));
}

function StreamGrid({ streams }: { streams: DisplayStream[] }) {
    const columns = gridColumnsFor(streams.length);
    const rows = Math.ceil(streams.length / columns);
    return (
        <div
            className="absolute inset-0 z-50 bg-black grid"
            style={{ gridTemplateColumns: `repeat(${columns}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}
        >
            {streams.map((stream) => (
                <div key={stream.streamId} className="min-w-0 min-h-0">
                    <StreamVideo mediaStream={stream.mediaStream} />
                </div>
            ))}
        </div>
    );
}

export default function DisplayPage({ displayId = "1" }: DisplayPageProps) {
    const defer = (fn: () => void) => queueMicrotask(fn);
    const { state, bundleMetaUpdate, socketRef, connected } = useSocket("display", displayId);
    const [shown, setShown] = useState<ShownSlide>(STANDBY);
    const loadSeqRef = useRef(0);
    const streams = useDisplayStreams(socketRef);

    // Lower-third announcement overlay
    const [announcement, setAnnouncement] = useState<Announcement | null>(null);

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
            {!shown.slide && streams.length === 0 && (
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
            {streams.length > 0 && <StreamGrid streams={streams} />}
            {announcement && (announcement.line1 || announcement.line2) && (
                <div className="lower-third" style={{ background: announcement.color }}>
                    {announcement.line1 && <div className="lower-third-line">{announcement.line1}</div>}
                    {announcement.line2 && <div className="lower-third-line">{announcement.line2}</div>}
                </div>
            )}
        </div>
    );
}
