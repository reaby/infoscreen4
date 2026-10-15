---
title: REST API
parent: Reference
nav_order: 2
---

# REST API

The admin interface uses these HTTP endpoints. They are internal and may change between versions.

| Endpoint | Methods | Purpose |
|:--|:--|:--|
| `/api/auth` | `GET` `POST` `DELETE` | Session status, sign in, sign out |
| `/api/users` | `GET` `POST` `DELETE` | List, create and delete users |
| `/api/displays` | `GET` | Display configuration |
| `/api/bundles` | `GET` `POST` | List and create bundles |
| `/api/bundles/[bundle]` | `GET` `PATCH` `POST` `DELETE` | Read, update, rename/duplicate and delete a bundle |
| `/api/bundles/[bundle]/slides` | `GET` | Slides of a bundle |
| `/api/bundles/[bundle]/slides/[slide]` | `GET` `POST` `DELETE` | Read, save and remove a slide |
| `/api/bundles/[bundle]/slides/[slide]/rename` | `POST` | Rename a slide |
| `/api/slides` | `GET` | Global slide library |
| `/api/files/images` | `GET` `POST` | List and upload images |
| `/api/files/images/[file]` | `GET` `PATCH` `DELETE` | Serve, rename and delete an image |
| `/api/files/videos` | `GET` `POST` | List and upload videos |
| `/api/files/videos/[file]` | `GET` `PATCH` `DELETE` | Serve, rename and delete a video |
| `/api/files/backgrounds` | `GET` `POST` | List and upload backgrounds |
| `/api/files/backgrounds/[file]` | `GET` `PATCH` `DELETE` | Serve, rename and delete a background |
| `/api/files/fonts` | `GET` `POST` | List and upload fonts |
| `/api/files/fonts/[file]` | `GET` `PATCH` `DELETE` | Serve, rename and delete a font |
| `/api/fonts` | `GET` | All available fonts (built-in, custom, Google) |
| `/api/google-fonts` | `GET` `POST` | List and add Google Font families |
| `/api/google-fonts/[family]` | `DELETE` | Remove a Google Font family |

## Authentication

`POST /api/auth` with `{ "username": "...", "password": "..." }` sets an HTTP-only `session` cookie that is valid for 7 days. `GET /api/auth` returns:

```json
{ "authenticated": true, "username": "admin", "role": "admin" }
```

{: .warning }
Only `/api/auth` checks the session. The other endpoints do not enforce authentication. See [Security](security).
