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
