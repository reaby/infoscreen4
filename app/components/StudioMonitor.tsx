"use client";

import dynamic from "next/dynamic";
import { BundleMeta, BundleSlideEntry } from "../interfaces/BundleMeta";
import { DisplayAnnouncement } from "../hooks/useSocket";

const DisplaySlide = dynamic(() => import("./DisplaySlide"), { ssr: false });

const DEFAULT_ASPECT_RATIO = 1920 / 1080;

export type MonitorVariant = "preview" | "live";

interface Props {
    variant: MonitorVariant;
    json: object | null;
    bundleMeta: BundleMeta;
    activeEntry: BundleSlideEntry | null;
    /** Message laid over the frame, e.g. "Loading…" or "Nothing broadcasting". */
    overlay?: string | null;
    announcement?: DisplayAnnouncement | null;
}

const hasText = (announcement?: DisplayAnnouncement | null): announcement is DisplayAnnouncement =>
    !!announcement && (!!announcement.line1 || !!announcement.line2);

/** A slide rendered inside a labelled frame: neutral for preview, red for live. */
export default function StudioMonitor({ variant, json, bundleMeta, activeEntry, overlay, announcement }: Props) {
    const aspectRatio = bundleMeta.width && bundleMeta.height
        ? bundleMeta.width / bundleMeta.height
        : DEFAULT_ASPECT_RATIO;
    const showAnnouncement = hasText(announcement);

    return (
        <div
            className={`admin-monitor admin-monitor-${variant}`}
            style={{ "--monitor-ar": aspectRatio } as React.CSSProperties}
        >
            <span className={`admin-monitor-tag ${variant}`}>{variant === "live" ? "Live" : "Preview"}</span>
            {overlay && <div className="admin-preview-overlay">{overlay}</div>}
            <DisplaySlide
                json={json}
                bundleMeta={bundleMeta}
                activeEntry={activeEntry}
                autoScale={true}
                showMissingAssetWarning={variant === "preview"}
                announcementActive={showAnnouncement}
            />
            {showAnnouncement && (
                <div className="lower-third admin-preview-lower-third" style={{ background: announcement.color }}>
                    {announcement.line1 && <div className="lower-third-line">{announcement.line1}</div>}
                    {announcement.line2 && <div className="lower-third-line">{announcement.line2}</div>}
                </div>
            )}
        </div>
    );
}
