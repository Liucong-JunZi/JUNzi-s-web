# Server-side rendering service for public pages.
#
# Builds the client bundle and the SSR bundle from source so `docker compose
# build` works from a clean checkout (dist/ and dist-ssr/ are not committed).
FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/ ./
RUN pnpm build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist-ssr ./ssr
COPY --from=build /app/dist ./dist
EXPOSE 3001
USER node
CMD ["node", "ssr/server.mjs"]
