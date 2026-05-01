# Infoscreen4

Digital signage system built for LAN parties, events, and dynamic displays. Infoscreen4 allows you to manage multiple networked displays from a centralized admin panel in real-time.

## Features

- **Real-Time Display Sync**: Push live updates to all connected screens instantly via WebSockets.
- **Advanced Slide Editor**: Web-based WYSIWYG editor using Fabric.js.
  - Support for text with customizable Google Fonts.
  - Image and Video elements.
  - Shapes, customizable colors, outlines, and dropshadows.
- **Bundle Management**: Create "Bundles" consisting of multiple slides, and assign different bundles to different physical displays.
- **Media Manager**: Built-in file management for uploading background images, videos, and generic assets.
- **Live WebRTC Streaming**: Stream a screen or webcam directly to any display in real-time.
- **Internal JSON Database**: Simple filesystem-based JSON storage under `/data`. No complex external database setup required.

## Getting Started

Make sure you have [Node.js](https://nodejs.org/) installed. This project uses `pnpm`, but you can use `npm` or `yarn` as well.

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Start the development server (runs with `tsx` to support the custom WebSocket server):
   ```bash
   pnpm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) with your browser.
   - Access the main dashboard at `/`
   - Access the admin panel at `/admin`
   - Access a specific display endpoint at `/display/[id]`
   - Open the stream sender at `/send`

## Live WebRTC Streaming

Infoscreen4 supports pushing a live screen share or webcam feed to any display using WebRTC. Signaling is handled over the existing Socket.IO connection — no separate media server is required.

### How it works

1. A logged-in user opens `/send`, enters a stream name, and clicks **Share Screen** or **Use Camera**.
2. The stream appears in the admin panel under the **Streams** tab with a live preview thumbnail.
3. The admin clicks **Show on display** to push the stream to a selected display. The display renders it fullscreen, pausing any running slide cycle.
4. When the stream stops (or admin clicks **Clear**), the display resumes normal slide playback.

### HTTPS requirement

Browsers only allow screen capture and camera access in **secure contexts** (HTTPS or `localhost`). Accessing the app over a plain HTTP LAN address will block the `/send` page from capturing media.

**Generate a self-signed certificate** (requires OpenSSL — included with Git for Windows):

```bash
pnpm run gen-cert
```

This creates `key.pem` and `cert.pem` in the project root. The server automatically detects these files on startup and switches to HTTPS:

```
> Ready on https://0.0.0.0:3000 [dev]
```

On first visit, browsers will show an "insecure certificate" warning because the cert is self-signed. Click **Advanced → Proceed** once per browser. After that, screen/camera capture works normally on any LAN client.

You can override the default cert paths with environment variables:

```env
SSL_KEY=/path/to/key.pem
SSL_CERT=/path/to/cert.pem
```

If no cert files are found, the server falls back to plain HTTP (fine for `localhost` development).

## Deployment (Production)

Running in production requires building the Next.js frontend, then running the custom `server.ts` entrypoint.

1. Build the optimal production bundle:
   ```bash
   pnpm run build
   ```

2. Run the production server:
   ```bash
   pnpm run start
   ```

## Environment Variables (VPS)

This project reads runtime settings from environment variables (or `.env` when using the script commands).

Copy the example file:

```bash
cp .env.example .env
```

Variables:

- `HOST` (default `0.0.0.0`): server bind host. Use `0.0.0.0` on VPS.
- `PORT` (default `3000`): server bind port.
- `INFOSCREEN_ROOT` (optional): absolute project root used to resolve `data/`.
- `INFOSCREEN_DATA_DIR` (optional): absolute data directory; overrides `INFOSCREEN_ROOT`.

Example `.env` for VPS:

```env
HOST=0.0.0.0
PORT=3000
INFOSCREEN_ROOT=/home/reaby/infoscreen4
# INFOSCREEN_DATA_DIR=/home/reaby/infoscreen4/data
```

### systemd example

```ini
[Service]
WorkingDirectory=/home/reaby/infoscreen4
Environment=NODE_ENV=production
Environment=HOST=0.0.0.0
Environment=PORT=3000
Environment=INFOSCREEN_ROOT=/home/reaby/infoscreen4
ExecStart=/usr/bin/pnpm run start
Restart=always
```

### PM2 example

```bash
pm2 start "pnpm run start" --name infoscreen4 --cwd /home/reaby/infoscreen4 --update-env
pm2 set pm2:autodump true
pm2 save
```
