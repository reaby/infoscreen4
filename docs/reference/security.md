---
title: Security
parent: Reference
nav_order: 4
---

# Security
{: .no_toc }

Infoscreen4 was built for event LANs, but it can also run on a public server. This page describes how access is controlled and how to deploy it safely.

1. TOC
{:toc}

## Access model

| Who | Access |
|:--|:--|
| **Anyone** | Display pages (`/display/<id>`), the media and slide data those pages load, the display list, and the sign-in page. |
| **Streamer** | Broadcast from `/send`. |
| **Admin** | Everything else: admin interface, editor, uploads, users, playback control. |

- **Sessions.** Signing in creates a random session token. The cookie holds only that token; the server maps it to the user in `data/sessions.json`. Sessions last 7 days and survive restarts. Signing out or deleting a user ends their sessions.
- **REST API.** Every endpoint that changes data or lists content requires an admin session. See [REST API](rest-api#access).
- **Socket.IO.** The `admin` role requires an admin session, and `streamer` requires any session. The `display` role is open but can only receive. Connections from other websites are rejected (see `ALLOWED_ORIGINS` below).
- **Streams.** A display can only watch the stream an admin assigned to it. WebRTC signaling is only relayed between a streamer and its own viewers.

## First-run setup

When no users exist, the server prints a one-time **setup code** in its console:

```
> No users exist yet. Initial setup code: 3F9A12C4
```

Creating the first admin account requires this code, so a stranger can't claim a freshly installed server. With Docker, run `docker compose logs app` to see the code.

## Sign-in protection

- After 5 failed sign-ins for the same username from the same address, further attempts are refused for 60 seconds.
- Passwords are compared in constant time.

## Passwords are stored in plain text

`data/users.json` stores passwords unencrypted. This is intentional: it keeps the file easy to edit by hand. It also means:

- Anyone who can read `data/` (or a backup of it) can read every password.
- Use passwords that aren't used anywhere else.
- Restrict file permissions: `chmod 600 data/users.json data/sessions.json`.

## Deploying on the internet

- **Use HTTPS.** Without it, passwords and session cookies travel unencrypted. Use a reverse proxy with a real certificate (Caddy, nginx + Let's Encrypt), or set `SSL_KEY` / `SSL_CERT`.
- **Forward headers from the proxy.** The proxy must pass the original `Host` (or `X-Forwarded-Host`), `X-Forwarded-Proto` and `X-Forwarded-For` headers, and forward WebSocket upgrades. See [Behind a reverse proxy](../getting-started/configuration#behind-a-reverse-proxy).
- **Allowed origins.** Socket connections are only accepted from the server's own host. If admins reach the server through a different hostname than the one the server sees, list it in `ALLOWED_ORIGINS`.
- **Content is public.** Anyone who knows a bundle or file name can load it, because display pages need no sign-in. Don't put confidential material in slides.
- **Rate limiting behind a proxy.** Behind a reverse proxy, every client shares the proxy's address, so the sign-in lock would apply per username across all clients. Set `TRUST_PROXY=true` to take each client's address from `X-Forwarded-For` instead, and make sure the server can't be reached except through the proxy: a client connecting directly could otherwise send a fake address and get around the lock.

## Reporting a vulnerability

Please report security issues privately to the maintainers, for example on [Discord](https://discord.gg/Ru59wMVDyd), instead of opening a public issue.
