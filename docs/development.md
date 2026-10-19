---
title: Development
nav_order: 5
---

# Development
{: .no_toc }

1. TOC
{:toc}

## Set up

```bash
pnpm install
pnpm run dev
```

Open `http://localhost:3000`.

`pnpm run dev` runs the custom `server.ts` with `tsx watch`, not plain `next dev`. The server hosts Next.js and Socket.IO on the same port.

| Route | Purpose |
|:--|:--|
| `/` | Landing page |
| `/admin` | Admin interface |
| `/admin/editor` | Slide editor |
| `/display/[displayId]` | Display client |
| `/send` | Stream sender |

{: .note }
Camera and screen capture only work on `localhost` or over HTTPS. Run `pnpm run gen-cert` to test streaming from other devices.

## Scripts

| Script | Description |
|:--|:--|
| `pnpm run dev` | Development server with reload |
| `pnpm run build` | Production build |
| `pnpm run build:webpack` | Production build with webpack |
| `pnpm run start` | Production server (reads `.env`) |
| `pnpm run start-docker` | Production server without `.env` (Docker) |
| `pnpm run lint` | ESLint |
| `pnpm run gen-cert` | Create a local CA (`data/ca.pem`, first run only) and a server `data/key.pem` / `data/cert.pem` signed by it |

## Project layout

```
server.ts              # HTTP(S) server, Socket.IO, playback and stream signaling
app/
├── admin/             # admin interface and editor pages
├── display/           # display client pages
├── send/              # stream sender page
├── api/               # REST endpoints (route handlers)
├── components/        # React components (editor, dialogs, display, ...)
├── hooks/             # useSocket, useFontRegistry
├── interfaces/        # shared types (BundleMeta, ...)
└── lib/               # BundleManager, auth, schedule, transitions, paths, ...
data/                  # runtime content (see Data format)
```

{: .warning }
This project uses Next.js 16, which differs from older versions in APIs and conventions. Check `node_modules/next/dist/docs/` before relying on older Next.js knowledge.

## Contributing

Contributions are welcome. Open an issue to discuss ideas or report bugs, and send focused pull requests that are easy to test. Please follow the existing code style and update these docs when behavior changes.

## Editing these docs

The documentation lives in the `docs/` folder and is published with GitHub Pages using the [Just the Docs](https://just-the-docs.com) theme.

To preview it locally (requires Ruby):

```bash
cd docs
bundle install
bundle exec jekyll serve
```

Then open `http://localhost:4000/infoscreen4/`.
