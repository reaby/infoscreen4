"use client";

import { useEffect, useRef, type VideoHTMLAttributes } from "react";
import { releaseVideoElement } from "../lib/mediaRelease";

type Props = Omit<VideoHTMLAttributes<HTMLVideoElement>, "src"> & { src: string };

/**
 * A <video> that frees its decoder and buffered frames as soon as it is removed or
 * its source changes, instead of when the browser next collects garbage.
 * The source is set from an effect so a remount (e.g. React Strict Mode) reloads it.
 */
export default function ManagedVideo({ src, ...videoProps }: Props) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        video.src = src;
        return () => releaseVideoElement(video);
    }, [src]);

    return <video ref={videoRef} {...videoProps} />;
}
