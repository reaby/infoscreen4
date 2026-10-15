---
title: Security
parent: Reference
nav_order: 4
---

# Security

Infoscreen4 is designed for a **trusted local network** at an event. Its sign-in keeps casual visitors out of the admin interface, but it is not a hardened security boundary.

## What to know

- **Plain-text passwords.** `data/users.json` stores passwords unencrypted.
- **Demo accounts.** The repository ships with `admin` / `admin` and `user` / `user`. Remove them before your event.
- **Simple session cookie.** The session cookie holds the username and is not signed.
- **API and sockets are not protected.** Only `/api/auth` checks the session. The other REST endpoints and the Socket.IO roles (`admin`, `display`, `streamer`) are not authenticated on the server. Anyone who can reach the server can change content.

## Recommendations

- Run Infoscreen4 on a network segment that only staff and display machines can reach, for example a separate VLAN or firewall rules on the port.
- Do **not** expose it directly to the internet. If you need remote access, use a VPN, or a reverse proxy with its own authentication (basic auth, SSO) in front of the whole site.
- Use unique passwords and restrict file permissions on `data/users.json`.
- Use HTTPS when people sign in over Wi-Fi.

Found a security issue? Please report it privately to the maintainers, for example on [Discord](https://discord.gg/Ru59wMVDyd), instead of opening a public issue.
