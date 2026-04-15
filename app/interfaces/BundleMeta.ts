export interface BundleSlideEntry {
    file: string;          // slide filename, e.g. "welcome.json"
    active?: boolean;      // defaults to true
    duration?: number;     // optional per-slide override (seconds)
}

export interface BundleMeta {
    backgroundColor?: string;
    backgroundFile?: string;  // filename from /api/files/backgrounds/[file] or /api/files/videos/[file] for video backgrounds
    width?: number;           // design canvas width  (default 1920)
    height?: number;          // design canvas height (default 1080)
    autoScale?: boolean;      // scale to fit display (default false)
    defaultDuration?: number; // default slide duration in seconds (<=0 = manual)
    slides?: BundleSlideEntry[]; // ordered slide definitions used for cycling/order
    activeSlides?: string[];     // legacy field (migrated to slides automatically)
}
