This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Environment Variables (VPS)

This project reads runtime settings from environment variables (or `.env` when using the npm scripts).

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
