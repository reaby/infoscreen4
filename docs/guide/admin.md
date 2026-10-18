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

![The admin interface with a slide selected for preview]({{ '/assets/images/screenshots/admin-overview.png' | relative_url }})

- **Header**: connection status, number of connected displays, the selected display, and the bundle and slide it is showing now. On the right are the **display selector**, **Refresh**, the **announcement** button and the **user menu**.
- **Bundles**: list of bundles. The badge shows the number of slides. The ⚡ button makes the bundle active on the selected display. Right-click a bundle to **rename**, **duplicate** or **delete** it.
- **Slides**: the slides of the selected bundle, in playback order. Drag to reorder. The ▷ icon marks the slide on screen now.
- **Main area** with tabs:
  - **Preview**: the selected slide.
  - **Settings**: [bundle settings](#bundle-settings).
  - **Displays**: [display configuration](displays#display-ids).
  - **Streams**: [live streams](streaming).
  - **Live**: what the selected display is showing right now.
- **Slide options** under the preview: **Edit slide**, plus [per-slide overrides](#per-slide-overrides).
- **Footer**: [playback controls](#playback-control).

Changes made by one admin appear immediately for all other admins who have `/admin` open.

## Bundles

### Create a bundle

Click the **New bundle** button at the top of the bundle list and enter a name.

### Make a bundle live

Choose the display in the display selector, then click the ⚡ button on the bundle. The display starts playing the bundle from its first slide.

### Bundle settings

Open the **Settings** tab to configure the selected bundle.

![Bundle settings]({{ '/assets/images/screenshots/bundle-settings.png' | relative_url }})

| Setting | Description |
|:--|:--|
| **Display dimensions** | Design canvas size in pixels (default 1920 × 1080). |
| **Auto-scale to fit display** | Off: the display renders at exact pixel size. On: the canvas scales to fill the screen. |
| **Global slide duration** | Default seconds per slide. `0` or less means manual: slides only change when you use the playback controls. |
| **Default transition** | Transition used between slides (see [Transitions](#transitions)). |
| **Local time display** | Show a clock overlay in one of the four corners. |
| **Background colour / CSS** | A color, or any CSS `background` value (for example a gradient). |
| **Background media file** | An image or looping video shown behind every slide. It takes priority over the background colour. |

Click **Save** to apply. **Reset** discards unsaved changes.

## Slides

### Add slides

The buttons at the top of the slide list add:

- **Create new slide**: an empty editor slide, opened in the [slide editor](editor).
- **Assign existing global slide**: an editor slide from the shared library.
- **Add website slide**: a URL shown full-screen in an iframe. If you leave out `https://`, it is added for you.
- **Add video slide**: a full-screen video from the video library.

{: .warning }
Many websites block embedding with `X-Frame-Options` or `Content-Security-Policy` headers. In that case the display shows a load-failure indicator instead of the page.

To change an editor slide, select it and click **Edit slide** under the preview.

### Enable and disable slides

The checkbox on each slide adds it to or removes it from the cycle. Disabled slides stay in the bundle but are skipped during playback.

### Slide context menu

Right-click a slide for more actions:

![Slide context menu]({{ '/assets/images/screenshots/slide-context-menu.png' | relative_url }})

- **Queue Next**: play this slide right after the current one, then continue in normal order. **Cancel Queued Next** undoes it.
- **Edit Title**: change the name shown in the list. For website slides, this edits the URL.
- **Rename File**: rename the slide's JSON file (editor slides).
- **Replace Video**: pick a different video (video slides).
- **Duplicate Slide** / **Delete Slide**

### Per-slide overrides

Under the preview you can override the bundle defaults for the selected slide. Click **Save** next to each one.

- **Slide duration**: seconds for this slide. Leave it blank to use the bundle default.
- **Slide transition**: leave it on **Use bundle default**, or pick a different transition.
- **Slide schedule**: see below.

### Scheduling

A scheduled slide only plays during its window. At other times the display skips it.

| Mode | Behavior |
|:--|:--|
| **Date range** | A one-off window with an optional start and an optional end. Example: show "Tournament starts soon" from Friday 18:00 to Friday 20:00. |
| **Daily time** | Repeats every day between two times (24-hour, server local time). If the end is earlier than the start, the window runs past midnight, for example `22:00`–`06:00`. The same start and end time means all day. |

Slides with a schedule have a clock icon in the slide list.

## Transitions

Available transitions: **None** (instant cut), **Fade**, **Slide left / right / up / down** and **Zoom**. Each has a duration in milliseconds (default 600 ms).

A per-slide transition overrides the bundle default, which overrides the built-in default (none, 600 ms).

## Playback control

Selecting a slide in the list only previews it. The footer controls change what the selected display shows:

| Button | Action |
|:--|:--|
| **Previous slide** / **Next slide** | Step through the bundle. |
| **Show selected slide** (play) | Show the selected slide on the display and start cycling from it. |
| **Pause cycling** | Stay on the current slide. |
| **Blackout** | Clear the display until you show a slide again. |
| **Reload bundles** | Reload the bundle and slide lists. |

Use the **Live** tab to see exactly what the display shows:

![Live tab]({{ '/assets/images/screenshots/live.png' | relative_url }})

Playback runs on the server, so displays keep cycling when no admin is connected, and a display that reconnects resumes the current slide.

## Announcements

The **announcement** button in the header opens the lower-third dialog.

![Announcement dialog]({{ '/assets/images/screenshots/announcement.png' | relative_url }})

Enter up to two lines of text and choose a background color, then click:

- **Show Display**: show it on the selected display.
- **Show All Displays**: show it on every display.
- **Clear**: remove the announcement from all displays.

The announcement stays on top of the slides until you clear it. While an announcement is active, the button is highlighted.

## Live streams

The **Streams** tab lists everyone currently broadcasting from [`/send`](streaming). Click **Show on display** to show a stream full-screen on the selected display, and **Clear** to return to the slides.
