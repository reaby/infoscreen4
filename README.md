# Infoscreen4

<a href="https://discord.gg/Ru59wMVDyd"><img alt="Discord" src="https://img.shields.io/discord/1173060772956479488?label=Discord&logo=discord&logoColor=fff"></a>

## 1. Introduction

Infoscreen4 for LAN parties. It combines a fast admin experience with real-time display updates, so you can create and publish content to multiple screens from one place.
The project is built with Next.js, React, Socket.IO, and Fabric.js, with a lightweight JSON-based data layer in the local `data/` directory.

## 2. Features

- Real-time display synchronization over WebSockets.
- Multi-display control with per-display assignments.
- Slide bundle management with ordered playback.
- Visual slide editor powered by Fabric.js.
- Rich slide content support: text, images, videos, shapes, colors and more.
- Integrated media management for files under `data/`.
- Live WebRTC streaming from `/send` to display clients.
- Optional HTTPS support for secure media capture workflows.
- No external database required for local/self-hosted usage.

## 3. Setup Guide For Production

### Prerequisites

- Node.js 20+ recommended.
- pnpm 9+ recommended.

### Install and Build

```bash
pnpm install
pnpm run build
```

### Configure Environment

Create a `.env` file in the project root (or provide environment variables via your process manager):

```env
NODE_ENV=production
HOST=<your lan ip>
PORT=3000
```

### Start Server

```bash
pnpm run start
```

### Optional: Generate Local Self-Signed Cert

```bash
pnpm run gen-cert
```

If `key.pem` and `cert.pem` exist (or `SSL_KEY` / `SSL_CERT` are set), the custom server automatically starts in HTTPS mode.

### Optional: PM2 Example

```bash
pm2 start "pnpm run start" --name infoscreen4 --cwd /path/to/infoscreen4 --update-env
pm2 save
```

## 4. Contributing

Contributions are welcome.

If you want to improve Infoscreen4, feel free to open an issue to discuss ideas, report bugs, or propose features. Pull requests are appreciated, especially when they are focused, clearly described, and easy to test.

Please keep changes aligned with the existing coding style and include relevant updates to docs when behavior changes.

## 5. Setup Guide For Development

### Prerequisites

- Node.js 20+ recommended.
- pnpm 9+ recommended.

### Install Dependencies

```bash
pnpm install
```

### Start Development Server

```bash
pnpm run dev
```

Open `http://localhost:3000`.

Helpful routes:

- `/` main screen
- `/admin` admin interface
- `/display/[displayId]` specific display client
- `/send` stream sender page

### Development Notes

- The app uses a custom `server.ts` entrypoint (not plain `next dev`).
- Runtime data is stored under `data/`.
- For camera/screen capture in browser testing, use `localhost` or HTTPS.

## 6. Thanks

Big thanks to the AI tools that helped accelerate this project:

- Gemini: logo generation and code support.
- Claude: code support.
- GitHub LLMs (including Copilot): code support, iteration speed, and overall development flow.

This project became significantly better and faster to build thanks to that collaboration.
