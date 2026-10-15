---
title: Live streaming
parent: User guide
nav_order: 5
---

# Live streaming
{: .no_toc }

Stream a camera or a screen from any browser to any display. Video travels peer-to-peer over WebRTC. The server only relays the connection setup.

1. TOC
{:toc}

## Requirements

- A user account with the **streamer** or **admin** role.
- A **secure context**: the sender must use `https://`, or `http://localhost` on the server machine itself. See [HTTPS](../getting-started/configuration#https).
- The sender and the display machines must be able to reach each other on the network. This is normally the case inside a LAN.

## Send a stream

1. Open `/send` and sign in.
2. Enter a **Stream name**.
3. Choose a camera (front or back on phones) or screen sharing.
4. Optionally pick a **Target bitrate** and enable **Include microphone audio**.
5. Start the stream.

The stream now appears in the admin's **Live Streams** panel.

## Show a stream on a display

In `/admin`, select the display, open **Live Streams** and pick the stream. It covers the slides until you clear it or the sender stops.

The target bitrate is best effort. The actual quality depends on the browser and the network.
