// Bridges Next.js route handlers and the custom socket.io server in server.ts.
// Route handlers are bundled separately from server.ts, so they don't share
// module instances — the listener is stored on globalThis, which they do share.

type ContentChangedListener = () => void;

const LISTENER_KEY = Symbol.for("infoscreen.contentChangedListener");

type ListenerHolder = { [LISTENER_KEY]?: ContentChangedListener };

export function setContentChangedListener(listener: ContentChangedListener): void {
    (globalThis as ListenerHolder)[LISTENER_KEY] = listener;
}

/** Call after any bundle or slide mutation so connected admins can refresh. */
export function notifyContentChanged(): void {
    (globalThis as ListenerHolder)[LISTENER_KEY]?.();
}
