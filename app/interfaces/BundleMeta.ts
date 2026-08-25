import { TransitionConfig } from "../lib/transitions";
import { SlideSchedule } from "../lib/schedule";

export interface BundleSlideEntry {
    id: string;            // unique identifier (e.g. timestamp or file slug)
    type: "fabric" | "website";
    data: string;          // filename for fabric type, or URL for website type
    title?: string;        // display name
    active?: boolean;      // defaults to true
    duration?: number;     // optional per-slide override (seconds)
    transition?: TransitionConfig; // optional per-slide transition override
    schedule?: SlideSchedule; // optional date/time window during which this slide cycles in
}

export interface BundleMeta {
    backgroundColor?: string;
    backgroundFile?: string;  // filename from /api/files/backgrounds/[file] or /api/files/videos/[file] for video backgrounds
    width?: number;           // design canvas width  (default 1920)
    height?: number;          // design canvas height (default 1080)
    autoScale?: boolean;      // scale to fit display (default false)
    showLocalTime?: boolean;  // show optional local time
    localTimePosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    defaultDuration?: number; // default slide duration in seconds (<=0 = manual)
    defaultTransition?: TransitionConfig; // default transition applied between slides
    slides?: BundleSlideEntry[]; // ordered slide definitions used for cycling/order
}
