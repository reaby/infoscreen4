export interface BundleSlideEntry {
    id: string;            // unique identifier (e.g. timestamp or file slug)
    type: "fabric" | "website";
    data: string;          // filename for fabric type, or URL for website type
    title?: string;        // display name
    active?: boolean;      // defaults to true
    duration?: number;     // optional per-slide override (seconds)
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
    slides?: BundleSlideEntry[]; // ordered slide definitions used for cycling/order
}
