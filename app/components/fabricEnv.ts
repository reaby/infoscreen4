"use client";

import * as fabric from "fabric";
import { releaseCanvasElement, releaseImageElement } from "../lib/mediaRelease";

// Fabric hands every element it is done with (the slide canvas, per-object cache
// canvases, image elements) to its environment's dispose(), which is a no-op in the
// browser. Release them instead, so their GPU memory doesn't wait for a GC.
// Elements still in the document are skipped: React may hand the same <canvas>
// to a new Fabric instance when it remounts.
function releaseDetachedElement(element: unknown): void {
    if (element instanceof HTMLCanvasElement && !element.isConnected) releaseCanvasElement(element);
    else if (element instanceof HTMLImageElement && !element.isConnected) releaseImageElement(element);
}

let installed = false;

function installFabricElementRelease(): void {
    if (installed || typeof window === "undefined") return;
    installed = true;
    fabric.setEnv({ ...fabric.getEnv(), dispose: releaseDetachedElement });
}

installFabricElementRelease();
