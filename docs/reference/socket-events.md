---
title: Socket.IO events
parent: Reference
nav_order: 3
---

# Socket.IO events
{: .no_toc }

Real-time communication uses Socket.IO on the same port as the web server. Clients declare a role in the handshake query:

```js
io({ query: { role: "display", displayId: "display-1" } });
```

| Role | Requirement |
|:--|:--|
| `display` | None. Receive-only. |
| `admin` | Session cookie of an admin user. |
| `streamer` | Session cookie of any user. |

Connections with any other role, a missing or invalid session, or a foreign `Origin` header are rejected with a connect error.

1. TOC
{:toc}

## Display clients

Displays join the room for their display ID and receive:

| Event | Payload | Description |
|:--|:--|:--|
| `slide:show` | `{ bundle, slide, duration, json, bundleMeta, transition }` | Show a slide. `json` is the Fabric.js data for editor slides. |
| `slide:clear` | — | Blackout. |
| `display:state:sync` | display state | Current state for this display. |
| `bundle:meta` | `{ bundle, meta }` | Bundle settings changed. |
| `announce:show` | `{ line1, line2, color }` | Show a lower-third announcement. |
| `announce:clear` | — | Remove the announcement. |
| `stream:incoming` | `{ streamId, streamName, streamSocketId }` | Start watching a live stream. |
| `stream:cleared` | — | Stop showing the stream. |
| `stream:ended` | `{ streamId }` | The sender stopped. |

## Admin clients

Admins join the `admins` room.

**Client → server**

| Event | Payload |
|:--|:--|
| `slide:show` | `{ displayId, bundle, slide, duration }` |
| `slide:clear` | `{ displayId }` |
| `cycle:stop` | `{ displayId }` |
| `cycle:queueNext` | `{ displayId, slideId \| null }` |
| `bundle:activate` | `{ displayId, bundle }` |
| `bundle:meta` | `{ bundle, meta, displayId? }` |
| `display:config` | `{ configs: [{ id, name, activeBundle? }] }` |
| `announce:show` | `{ displayId, line1, line2, color }` |
| `announce:showAll` | `{ line1, line2, color }` |
| `announce:clearAll` | — |
| `stream:show` | `{ streamId, displayId }` |
| `stream:clear` | `{ displayId }` |

**Server → client**

| Event | Description |
|:--|:--|
| `state:sync` | Full server state: displays, per-display slide, cycling, queued slide, announcements, connection counts, streams. |
| `streams:update` | List of active streams. |
| `content:changed` | Bundles or slides changed on disk; reload lists. |

## Streaming (WebRTC signaling)

Admins may watch any stream. A display may only watch the stream assigned to it with `stream:show`. `stream:signal` is only relayed between a streamer and the viewers of its stream.

| Event | Direction | Payload |
|:--|:--|:--|
| `stream:register` | streamer → server | `{ streamId, name }` |
| `stream:unregister` | streamer → server | `{ streamId }` |
| `stream:watch` / `stream:unwatch` | viewer → server | `{ streamId }` |
| `stream:viewer:joined` / `stream:viewer:left` | server → streamer | `{ viewerSocketId }` |
| `stream:signal` | both ways | `{ to, data }` sent, `{ from, data }` received |
