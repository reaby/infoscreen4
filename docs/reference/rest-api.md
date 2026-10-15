---
title: REST API
parent: Reference
nav_order: 2
---

# REST API
{: .no_toc }

The admin interface uses these HTTP endpoints. They are internal and may change between versions.

1. TOC
{:toc}

## Endpoints

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

## Access

All endpoints require an **admin** session, except:

| Public endpoint | Why |
|:--|:--|
| `GET` `POST` `DELETE /api/auth` | Signing in and out |
| `GET /api/displays` | Display picker on the start page |
| `GET /api/bundles/[bundle]` | Bundle settings for display clients |
| `GET /api/bundles/[bundle]/slides/[slide]` | Slide content for display clients |
| `GET /api/files/*/[file]` | Media served to display clients |
| `GET /api/fonts` | Fonts for display clients |
| `POST /api/users` | Only while no users exist, with the setup code |

Requests without a valid session get `401`. Requests from a signed-in user with the wrong role get `403`.

## Authentication

`POST /api/auth` with `{ "username": "...", "password": "..." }` sets an HTTP-only `session` cookie holding a random token, valid for 7 days. After 5 failed attempts it returns `429` with a `Retry-After` header.

`GET /api/auth` returns:

```json
{ "authenticated": true, "username": "admin", "role": "admin" }
```

or, when not signed in:

```json
{ "authenticated": false, "needsSetup": false }
```

`needsSetup` is `true` when no users exist yet. Create the first admin with:

```http
POST /api/users
{ "username": "...", "password": "...", "setupCode": "<code from the server console>" }
```
