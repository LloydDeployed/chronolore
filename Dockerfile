# ── Build stage ──
FROM node:22-alpine AS build

RUN corepack enable && corepack prepare pnpm@10.30.1 --activate

WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/

RUN pnpm install --frozen-lockfile

# Copy source
COPY tsconfig.base.json ./
COPY packages/shared/ packages/shared/
COPY packages/server/ packages/server/
COPY packages/web/ packages/web/

# Build all packages
RUN pnpm -r build

# ── Production stage ──
FROM node:22-alpine AS production

RUN corepack enable && corepack prepare pnpm@10.30.1 --activate

WORKDIR /app

# Install production deps only
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/

RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/server/dist packages/server/dist
COPY --from=build /app/packages/web/dist packages/web/dist

# Server serves static files from web/dist
ENV NODE_ENV=production
ENV PORT=4001

EXPOSE 4001

CMD ["node", "packages/server/dist/index.js"]
