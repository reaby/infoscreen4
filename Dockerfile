# Use Node.js 24 on Alpine for a small, production-ready image.
FROM node:24-alpine AS builder

WORKDIR /app

# Install build tools
RUN apk add --no-cache openssl

# Install dependencies using npm
COPY package.json ./
RUN npm install

# Build the Next.js app
COPY . ./
RUN npm run build
RUN npm run gen-cert

# Final runtime image
FROM node:24-alpine AS runner
WORKDIR /app

COPY --from=builder /app .

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

EXPOSE 3000

CMD ["npm", "run", "start-docker"]
