"use client";

import * as fabric from "fabric";

type FabricVideoOptions = fabric.TOptions<fabric.ImageProps> & {
    videoSrc?: string;
    videoElWidth?: number;
    videoElHeight?: number;
    loop?: boolean;
    muted?: boolean;
};

export class FabricVideo extends fabric.FabricImage {
    static type = "FabricVideo";

    declare videoSrc: string;
    declare videoElWidth: number;
    declare videoElHeight: number;
    declare loop: boolean;
    declare muted: boolean;

    constructor(element: HTMLVideoElement, options: FabricVideoOptions = {}) {
        super(element as unknown as fabric.ImageSource, options);
        this.videoSrc = options.videoSrc ?? element.currentSrc ?? element.src ?? "";
        this.videoElWidth = options.videoElWidth ?? element.width;
        this.videoElHeight = options.videoElHeight ?? element.height;
        this.loop = options.loop ?? element.loop;
        this.muted = options.muted ?? element.muted;
    }

    // @ts-expect-error — Fabric's toObject has a complex generic constraint that TypeScript
    // cannot reconcile across subclasses. Runtime behavior is correct.
    toObject(propertiesToInclude: string[] = []): Record<string, any> {
        return {
            ...super.toObject(propertiesToInclude as any),
            videoSrc: this.videoSrc,
            videoElWidth: this.videoElWidth,
            videoElHeight: this.videoElHeight,
            loop: this.loop,
            muted: this.muted,
        };
    }

    // Called by Fabric's enlivenObjects during loadFromJSON
    static fromObject(options: any, _context?: any): Promise<FabricVideo> {
        const {
            videoSrc,
            videoElWidth = 1280,
            videoElHeight = 720,
            loop = true,
            muted = true,
            // Strip parent fields that don't apply to video
            type: _type,
            src: _src,
            filters: _filters,
            resizeFilter: _resizeFilter,
            ...fabricProps
        } = options;

        const videoEl = document.createElement("video");
        const source = document.createElement("source");
        source.src = videoSrc;
        videoEl.appendChild(source);
        videoEl.width = 1280;
        videoEl.height = 720;
        videoEl.loop = loop;
        videoEl.muted = muted;
        videoEl.playsInline = true;
        videoEl.play().catch(() => {});

        const instance = new FabricVideo(videoEl, {
            ...fabricProps,
            videoSrc,
            videoElWidth,
            videoElHeight,
            loop,
            muted,
        });

        return Promise.resolve(instance);
    }
}

// Register so loadFromJSON can reconstruct FabricVideo by type name
fabric.classRegistry.setClass(FabricVideo);
