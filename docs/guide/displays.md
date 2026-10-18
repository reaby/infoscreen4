---
title: Displays
parent: User guide
nav_order: 4
---

# Displays
{: .no_toc }

1. TOC
{:toc}

## Display IDs

Displays are listed in `data/display.json`. Add, rename or remove them in the admin's **Displays** tab, then click **Save**.

![Display configuration]({{ '/assets/images/screenshots/display-settings.png' | relative_url }})

Each screen opens:

```
http://<server-ip>:3000/display/<display-id>
```

For example: `/display/display-1`.

- If the ID does not exist, the client falls back to the **first configured display**.
- `/display` with no ID also shows the first display.
- Several browsers can open the same ID. They all show the same content, which is useful for mirrored screens.

The admin shows how many clients are connected to each display.

A display shows only the slide content, full-screen:

![A display client showing a slide]({{ '/assets/images/screenshots/display.png' | relative_url }})

## Kiosk setup

Run the display browser full-screen, with no browser UI, and start it at boot.

**Chromium / Chrome**

```bash
chromium --kiosk --noerrdialogs --disable-infobars \
  --autoplay-policy=no-user-gesture-required \
  http://<server-ip>:3000/display/display-1
```

`--autoplay-policy=no-user-gesture-required` lets videos with sound start without a click.

**Firefox**

```bash
firefox --kiosk http://<server-ip>:3000/display/display-1
```

{: .tip }
If the server uses a self-signed certificate, open the display URL once by hand and accept the certificate before switching to kiosk mode.

## Reconnects

Display clients reconnect automatically. After a network drop or a server restart, a display picks up its current slide, active stream and announcement without a reload.
