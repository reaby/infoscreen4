// Detached canvases, images and videos keep their decoded data and GPU memory until
// the next garbage collection. GC is driven by JS heap pressure, which stays low on a
// display, so these pile up. The helpers below free that memory right away.

export function releaseVideoElement(video: HTMLVideoElement): void {
    video.pause();
    video.removeAttribute("src");
    video.replaceChildren(); // drop <source> children
    video.load(); // makes the browser release the decoder and buffered frames
}

export function releaseCanvasElement(canvas: HTMLCanvasElement): void {
    canvas.width = 0;
    canvas.height = 0;
}

export function releaseImageElement(image: HTMLImageElement): void {
    image.removeAttribute("src");
}
