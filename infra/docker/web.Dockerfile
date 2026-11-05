# The web app (docs/13 §5.2, simplified for a local machine: docs/15 §3). It proxies /api/v1 to the api container.
FROM node:22-bookworm-slim
RUN corepack enable
ENV HUSKY=0
ARG HUB_API_ORIGIN=http://api:7310
ARG HUB_LAB_ORIGIN=http://lab:7320
ENV HUB_API_ORIGIN=$HUB_API_ORIGIN HUB_LAB_ORIGIN=$HUB_LAB_ORIGIN NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile --filter @hub/web... --filter hub --ignore-scripts \
 && pnpm --filter @hub/contracts build \
 && pnpm --filter @hub/web build \
 && chown -R node:node /app/apps/web
USER node
WORKDIR /app/apps/web
ENV NODE_ENV=production
EXPOSE 7300
CMD ["pnpm", "exec", "next", "start", "-p", "7300"]
