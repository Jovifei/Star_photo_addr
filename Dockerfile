ARG BUILD_REVISION=local

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS build
ARG BUILD_REVISION
ARG NEXT_PUBLIC_TIANDITU_TOKEN=""
ARG NEXT_PUBLIC_LIGHT_POLLUTION_TILE_URL=""
ARG NEXT_PUBLIC_ASSET_VIIRS_TILES=false
ARG NEXT_PUBLIC_ASSET_WORLD_ATLAS=false
ARG NEXT_PUBLIC_ASSET_CITY_CANDIDATES=false
ARG NEXT_PUBLIC_ASSET_BOUNDARIES=false
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_BUILD_REVISION=${BUILD_REVISION} \
    NEXT_PUBLIC_TIANDITU_TOKEN=${NEXT_PUBLIC_TIANDITU_TOKEN} \
    NEXT_PUBLIC_LIGHT_POLLUTION_TILE_URL=${NEXT_PUBLIC_LIGHT_POLLUTION_TILE_URL} \
    NEXT_PUBLIC_ASSET_VIIRS_TILES=${NEXT_PUBLIC_ASSET_VIIRS_TILES} \
    NEXT_PUBLIC_ASSET_WORLD_ATLAS=${NEXT_PUBLIC_ASSET_WORLD_ATLAS} \
    NEXT_PUBLIC_ASSET_CITY_CANDIDATES=${NEXT_PUBLIC_ASSET_CITY_CANDIDATES} \
    NEXT_PUBLIC_ASSET_BOUNDARIES=${NEXT_PUBLIC_ASSET_BOUNDARIES}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-alpine AS runner
ARG BUILD_REVISION
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_BUILD_REVISION=${BUILD_REVISION} \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    NODE_OPTIONS=--max-old-space-size=768
RUN apk add --no-cache tini \
    && addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs \
    && mkdir -p /app/data/snapshots \
    && chown -R nextjs:nodejs /app/data
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/scripts/observing-snapshot-worker.mjs ./scripts/observing-snapshot-worker.mjs
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
