# Use Node.js 24 on Alpine for a small, production-ready image.
FROM node:24-alpine AS builder

WORKDIR /app

# Install dependencies with pnpm from the lockfile, so the image gets the same
# versions (and the security overrides in pnpm-workspace.yaml) as local installs.
RUN npm install -g pnpm@10.26.2
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

# Build the Next.js app
COPY . ./
RUN pnpm run build

# Final runtime image
FROM node:24-alpine AS runner
WORKDIR /app

# The TLS certificate is created on first start in the mounted data directory
# (see the start-docker script), so it survives image rebuilds.
RUN apk add --no-cache openssl

COPY --from=builder /app .

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

EXPOSE 3000

CMD ["npm", "run", "start-docker"]
