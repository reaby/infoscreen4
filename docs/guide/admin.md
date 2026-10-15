---
title: Admin interface
parent: User guide
nav_order: 1
---

# Admin interface
{: .no_toc }

Open `/admin` and sign in. Everything you need while the event runs is on this page.

1. TOC
{:toc}

## Layout

- **Display selector**: choose which display you are controlling. Each display has its own active bundle and playback state.
- **Bundles**: list of bundles. Right-click a bundle to **rename**, **duplicate** or **delete** it.
- **Slides**: the slides of the selected bundle, in playback order. Drag to reorder.
- **Preview**: a preview of the selected slide.
- **Footer controls**: **previous / next slide** and **Blackout**.

Changes made by one admin appear immediately for all other admins who have `/admin` open.

## Bundles

### Create a bundle

Click **New bundle** and enter a name.

### Make a bundle live

Select a bundle and confirm it as the **active bundle** for the selected display. The display starts playing the bundle.

### Bundle settings

Open **Bundle settings** to configure:

| Setting | Description |
|:--|:--|
| **Display dimensions** | Design canvas size in pixels (default 1920 × 1080). |
| **Auto-scale to fit display** | Scale the canvas to the screen size. |
| **Background colour / CSS** | A color, or any CSS `background` value (for example a gradient). |
| **Background media file** | An image or looping video shown behind every slide. |
| **Global slide duration** | Default seconds per slide. `0` means manual: slides only change when you click next or previous. |
| **Default transition** | Transition used between slides (see [Transitions](#transitions)). |
| **Local Time Display** | Show a clock overlay in one of the four corners. |

## Slides

### Add slides

From the slides panel you can add:

- **New slide**: create an empty editor slide and open it in the [slide editor](editor).
- **Global slide**: assign an existing editor slide from the shared library to this bundle.
- **Video slide**: a full-screen video from the video library.
- **Website slide**: a URL shown full-screen in an iframe. If you leave out `https://`, it is added for you.

{: .warning }
Many websites block embedding with `X-Frame-Options` or `Content-Security-Policy` headers. In that case the display shows a load-failure indicator instead of the page.

### Enable and disable slides

Each slide has an on/off toggle. Disabled slides stay in the bundle but are skipped during playback.

### Slide context menu

Right-click a slide to:

- **Queue Next**: play this slide right after the current one, then continue in normal order. **Cancel Queued Next** undoes it.
- **Edit Title**, or edit the URL of a website slide
- **Replace Video** (video slides only)
- **Duplicate Slide** / **Delete Slide**

### Per-slide overrides

With a slide selected you can override the bundle defaults:

- **Slide duration**: seconds for this slide. Leave it blank to use the bundle default.
- **Slide transition**: transition type and duration. Leave it blank to use the bundle default.
- **Slide schedule**: see below.

### Scheduling

A scheduled slide only plays during its window. At other times the display skips it.

| Mode | Behavior |
|:--|:--|
| **Date range** | A one-off window with an optional start and an optional end. Example: show "Tournament starts soon" from Friday 18:00 to Friday 20:00. |
| **Daily time** | Repeats every day between two times (24-hour, server local time). If the end is earlier than the start, the window runs past midnight, for example `22:00`–`06:00`. The same start and end time means all day. |

Slides with a schedule have a schedule icon in the slide list.

## Transitions

Available transitions: **None** (instant cut), **Fade**, **Slide left / right / up / down** and **Zoom**. Each has a duration in milliseconds (default 600 ms).

A per-slide transition overrides the bundle default, which overrides the built-in default (none, 600 ms).

## Playback control

- **Next / Previous** step through the bundle on the selected display.
- Clicking a slide shows it immediately.
- **Blackout** clears the selected display until you show a slide again.

Playback runs on the server, so displays keep cycling when no admin is connected, and a display that reconnects resumes the current slide.

## Announcements

The **announcement** button opens the lower-third dialog. Enter up to two lines of text and a background color, then show it on:

- the selected display, or
- **all displays** at once.

The announcement stays on top of the slides until you clear it. While an announcement is active, the button is highlighted.

## Live streams

The **Live Streams** panel lists everyone currently broadcasting from [`/send`](streaming). Pick a stream to show it full-screen on the selected display, and clear it to return to the slides.
