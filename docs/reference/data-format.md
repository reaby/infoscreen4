---
title: Data format
parent: Reference
nav_order: 1
---

# Data format
{: .no_toc }

All content is stored as plain JSON and media files under `data/`. You can edit these files by hand, back them up, or keep them in version control.

1. TOC
{:toc}

## `bundles/<name>/bundle.json`

Bundle settings and the ordered slide list. The folder name is the bundle name.

```json
{
  "width": 1920,
  "height": 1080,
  "autoScale": false,
  "backgroundColor": "#000000",
  "backgroundFile": "waves_bottom.mp4",
  "showLocalTime": false,
  "localTimePosition": "bottom-right",
  "defaultDuration": 20,
  "defaultTransition": { "type": "fade", "duration": 600 },
  "slides": [
    { "id": "welcome", "type": "fabric", "data": "welcome.json", "title": "Welcome", "active": true },
    { "id": "1787681007950", "type": "video", "data": "example.mp4", "title": "Trailer", "duration": 10, "videoDuration": 10.03 },
    { "id": "1234567890", "type": "website", "data": "https://example.com", "title": "Brackets", "active": false }
  ]
}
```

| Field | Type | Default | Description |
|:--|:--|:--|:--|
| `width`, `height` | number | `1920`, `1080` | Design canvas size. |
| `autoScale` | boolean | `false` | Scale the canvas to fit the screen. |
| `backgroundColor` | string | — | Color or CSS background value. |
| `backgroundFile` | string | — | File name from `backgrounds/` or `videos/`. |
| `showLocalTime` | boolean | `false` | Show a clock overlay. |
| `localTimePosition` | string | — | `top-left`, `top-right`, `bottom-left` or `bottom-right`. |
| `defaultDuration` | number | — | Seconds per slide. `0` or less means manual advance. |
| `defaultTransition` | [Transition](#transition) | none, 600 ms | Transition between slides. |
| `slides` | [Slide entry](#slide-entry)[] | `[]` | Playback order. |

### Slide entry

| Field | Type | Description |
|:--|:--|:--|
| `id` | string | Unique ID within the bundle. |
| `type` | `fabric` \| `video` \| `image` \| `website` | Slide type. |
| `data` | string | `fabric`: file name in `slides/`. `video`: file name in `videos/`. `image`: file name in `images/`. `website`: URL. |
| `title` | string | Name shown in the admin. |
| `active` | boolean | Default `true`. `false` skips the slide during playback. |
| `duration` | number | Overrides the bundle duration for this slide (seconds). |
| `videoDuration` | number | Video slides only: the video's real length, for reference. |
| `transition` | [Transition](#transition) | Overrides the bundle transition for this slide. |
| `schedule` | [Schedule](#schedule) | Window during which the slide plays. |

### Transition

```json
{ "type": "fade", "duration": 600 }
```

`type` is one of `none`, `fade`, `slide-left`, `slide-right`, `slide-up`, `slide-down` or `zoom`. `duration` is in milliseconds.

### Schedule

Date range (ISO date-times, both optional):

```json
{ "mode": "range", "start": "2026-11-20T18:00:00", "end": "2026-11-20T20:00:00" }
```

Daily window (`HH:MM`, 24-hour, server local time; wraps past midnight if `dailyEnd` is earlier than `dailyStart`):

```json
{ "mode": "daily", "dailyStart": "22:00", "dailyEnd": "06:00" }
```

## `slides/*.json`

Editor slides, in Fabric.js canvas JSON format. These are global: any bundle can reference them through a `fabric` slide entry's `data` field.

## `display.json`

```json
[
  { "id": "display-1", "name": "Display 1", "activeBundle": "default" }
]
```

| Field | Description |
|:--|:--|
| `id` | Used in the display URL: `/display/<id>`. |
| `name` | Name shown in the admin. |
| `activeBundle` | Bundle the display plays. Updated when a bundle goes on air with ⚡ or Send to LIVE, and restored when the server starts. |

## `users.json`

```json
{
  "users": [
    { "username": "admin", "password": "change-me", "role": "admin" }
  ]
}
```

`role` is `admin` or `streamer`. Passwords are stored in plain text. This file is not tracked in git.

## `sessions.json`

Active sign-in sessions, managed by the server. Each key is a session token:

```json
{ "9f2c…": { "username": "admin", "expiresAt": 1792540800000 } }
```

Delete this file (with the server stopped) to sign everyone out.

## `fonts/google-fonts.json`

```json
{ "families": ["Roboto", "Press Start 2P"] }
```
