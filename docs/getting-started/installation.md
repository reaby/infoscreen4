---
title: Installation
parent: Getting started
nav_order: 1
---

# Installation
{: .no_toc }

1. TOC
{:toc}

## Requirements

- Node.js 20 or newer (the Docker image uses Node.js 24)
- pnpm 9 or newer (npm also works)
- A browser on each screen. Any modern Chromium, Firefox or Safari will do.

## Option 1: Node.js

```bash
git clone https://github.com/reaby/infoscreen4.git
cd infoscreen4
pnpm install
pnpm run build
```

Create a `.env` file in the project root. You can copy `.env.example` as a starting point:

```env
NODE_ENV=production
HOST=0.0.0.0
PORT=3000
```

Start the server:

```bash
pnpm run start
```

The server prints its address when it is ready. Open `http://<server-ip>:3000/admin`.

{: .note }
Infoscreen4 runs its own server (`server.ts`), which hosts Next.js and Socket.IO together. Start it with `pnpm run start`, not `next start`.

## Option 2: Docker Compose

The repository includes a `Dockerfile` and a `docker-compose.yml`:

```bash
docker compose up -d --build
```

- The image builds the app and creates a self-signed certificate, so the container serves **HTTPS** on port 3000.
- `./data` is mounted into the container, so your slides, media and users persist across rebuilds.

## Option 3: PM2

```bash
pm2 start "pnpm run start" --name infoscreen4 --cwd /path/to/infoscreen4 --update-env
pm2 save
```

## First login

Open `/admin` and sign in.

- If `data/users.json` contains no users, the first username and password you enter **becomes the first admin account**.
- The repository ships with demo accounts (`admin` / `admin` and `user` / `user`). **Delete them, or replace them with your own, before the event.** See [Users and roles](../guide/users).

## Connect a screen

On each screen's computer, open a browser in full-screen or kiosk mode on:

```
http://<server-ip>:3000/display/display-1
```

See [Displays](../guide/displays) for more on display IDs and kiosk setup.

## Updating

```bash
git pull
pnpm install
pnpm run build
# then restart the server (pm2 restart infoscreen4, docker compose up -d --build, ...)
```

Your content lives in `data/`, so updating does not touch it. Back up `data/` before large upgrades anyway.
