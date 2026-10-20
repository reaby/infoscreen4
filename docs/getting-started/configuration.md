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
| `DISABLE_HTTPS` | `false` | Set to `true` to serve plain HTTP even when certificate files exist. In Docker it also skips creating the certificate on start. Use it behind a reverse proxy that terminates TLS. |
| `TRUST_PROXY` | — | Behind a reverse proxy, set to `true` to read each client's address from `X-Forwarded-For`, or to a number when several proxies are chained. Failed-login lockouts use this address. Only set it when clients can't reach the server except through the proxy. |
| `SSL_KEY` | `<data>/key.pem` | Path to the TLS private key. |
| `SSL_CERT` | `<data>/cert.pem` | Path to the TLS certificate. |
| `CERT_HOSTS` | — | Comma-separated extra hostnames or IP addresses for `pnpm run gen-cert` to put in the certificate, e.g. `infoscreen.lan,192.168.1.10`. |
| `INFOSCREEN_ROOT` | current directory | Project root override. `data/` is resolved relative to this. |
| `INFOSCREEN_DATA_DIR` | `<root>/data` | Absolute data directory. Takes precedence over `INFOSCREEN_ROOT`. |
| `ALLOWED_ORIGINS` | — | Comma-separated extra origins allowed to open socket connections, e.g. `https://screens.example.com`. Only needed when the browser's address differs from the host the server sees. |

{: .note }
`data/users.json` and `data/display.json` are always read relative to the server's working directory, even if `INFOSCREEN_ROOT` or `INFOSCREEN_DATA_DIR` is set.

## HTTPS

The server switches to HTTPS automatically when both the key and the certificate files exist, unless `DISABLE_HTTPS=true` is set.

To generate a certificate for your LAN (requires `openssl`):

```bash
pnpm run gen-cert
```

This creates, in the data directory (`data/` unless `INFOSCREEN_DATA_DIR` is set):

| File | What it is |
|:--|:--|
| `ca.pem` | A local certificate authority (CA), valid for 10 years. Created only on the first run. |
| `ca-key.pem` | The CA's private key. Keep it private: anyone holding it can create certificates your displays trust. |
| `cert.pem`, `key.pem` | The server certificate, signed by the CA. Valid for `localhost`, the machine's hostname and its current LAN IP addresses. |

Add more names or addresses as arguments, for example `pnpm run gen-cert -- infoscreen.lan 10.0.0.5`, or set `CERT_HOSTS="infoscreen.lan,10.0.0.5"`. Re-run the command when the server's hostname or IP address changes, then restart the server. Machines that already trust `ca.pem` accept the new certificate without further steps.

{: .note }
Back up the data directory including these files. If `ca.pem` is lost, every display has to trust a new one.

### Trust the certificate on every machine

Copy `data/ca.pem` to each display and admin machine, and install it there once as a trusted root certificate:

- **Windows (Edge, Chrome):** `certutil -addstore -user Root ca.pem`, or double-click `ca.pem` → *Install Certificate* → *Trusted Root Certification Authorities*.
- **macOS:** open `ca.pem` in Keychain Access, then set it to *Always Trust*.
- **Linux (Chrome):** `certutil -d sql:$HOME/.pki/nssdb -A -t "C,," -n Infoscreen4 -i ca.pem` (from `libnss3-tools`).
- **Firefox (any OS):** *Settings → Privacy & Security → Certificates → View Certificates → Authorities → Import*.

{: .important }
Clicking through the browser's certificate warning is not enough. Browsers never cache files from a site with an untrusted certificate, so displays download every video, image and font again on each slide change.

### When do you need HTTPS?

Browsers only allow camera and screen capture on a **secure context**: `https://` or `http://localhost`. If you use [live streaming](../guide/streaming) from another machine on the LAN, run the server over HTTPS.

### Behind a reverse proxy

You can also terminate TLS in a reverse proxy (nginx, Caddy, Traefik) and run Infoscreen4 over plain HTTP behind it. Set `DISABLE_HTTPS=true`, so the server serves plain HTTP even if certificate files exist and the Docker container doesn't create them. Also set `TRUST_PROXY=true`: otherwise every request appears to come from the proxy, and a few wrong passwords for one username lock that username out for everyone. The proxy must:

- forward WebSocket upgrades for `/socket.io/`
- append the client's address to `X-Forwarded-For` (Caddy and Traefik do this by default)
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
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

{: .warning }
With `TRUST_PROXY` set, make sure clients can only reach the server through the proxy, for example by binding it to `127.0.0.1` or not publishing the container's port. A client that connects directly can put any address in `X-Forwarded-For` and get around the login lockout.

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
