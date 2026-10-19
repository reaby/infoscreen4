---
title: Configuration
parent: Getting started
nav_order: 2
---

# Configuration
{: .no_toc }

1. TOC
{:toc}

## Environment variables

Set these in `.env` (loaded by `pnpm run dev` / `pnpm run start`) or through your process manager or container.

| Variable | Default | Description |
|:--|:--|:--|
| `NODE_ENV` | — | Set to `production` for production builds. Any other value runs in development mode. |
| `HOST` | `0.0.0.0` | Address to bind to. `0.0.0.0` listens on all interfaces. |
| `PORT` | `3000` | Port for HTTP/HTTPS and WebSockets. |
| `SSL_KEY` | `key.pem` | Path to the TLS private key. |
| `SSL_CERT` | `cert.pem` | Path to the TLS certificate. |
| `INFOSCREEN_ROOT` | current directory | Project root override. `data/` is resolved relative to this. |
| `INFOSCREEN_DATA_DIR` | `<root>/data` | Absolute data directory. Takes precedence over `INFOSCREEN_ROOT`. |
| `ALLOWED_ORIGINS` | — | Comma-separated extra origins allowed to open socket connections, e.g. `https://screens.example.com`. Only needed when the browser's address differs from the host the server sees. |

{: .note }
`data/users.json` and `data/display.json` are always read relative to the server's working directory, even if `INFOSCREEN_ROOT` or `INFOSCREEN_DATA_DIR` is set.

## HTTPS

The server switches to HTTPS automatically when both the key and the certificate files exist.

To generate a self-signed certificate for local use (requires `openssl`):

```bash
pnpm run gen-cert
```

This creates `key.pem` and `cert.pem` in the project root, valid for 365 days.

### When do you need HTTPS?

Browsers only allow camera and screen capture on a **secure context**: `https://` or `http://localhost`. If you use [live streaming](../guide/streaming) from another machine on the LAN, run the server over HTTPS.

With a self-signed certificate, every browser (including display clients) must accept the certificate warning once.

### Behind a reverse proxy

You can also terminate TLS in a reverse proxy (nginx, Caddy, Traefik) and run Infoscreen4 over plain HTTP behind it. The proxy must:

- forward WebSocket upgrades for `/socket.io/`
- set `X-Forwarded-Proto: https`, so the session cookie is marked `Secure`
- pass the original `Host` header, or set `X-Forwarded-Host`, so socket connections pass the origin check. Otherwise, add the public address to `ALLOWED_ORIGINS`.

Example for nginx:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

See [Security](../reference/security) before exposing the server to the internet.

## Data directory

All runtime state is plain files:

```
data/
├── bundles/<name>/bundle.json   # bundle settings and slide order
├── slides/*.json                # editor (Fabric.js) slides, shared by all bundles
├── images/                      # images for image slides and image objects
├── videos/                      # videos for video slides and video objects
├── backgrounds/                 # bundle background images/videos
├── fonts/                       # uploaded fonts + google-fonts.json
├── display.json                 # display list and active bundle per display
├── users.json                   # user accounts (not tracked in git)
└── sessions.json                # active sign-in sessions (not tracked in git)
```

To back up Infoscreen4, copy this directory. See [Data format](../reference/data-format) for the file schemas.
