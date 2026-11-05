# API and worker, one image (docs/13 §5.1, simplified for a local machine: docs/15 §3).
# The whole workspace stays in the image, dev tools included: migrating and seeding use the Prisma CLI and the swc
# register hook, and an image for one machine does not need to save those megabytes.
FROM node:22-bookworm-slim
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV HUSKY=0
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile --filter @hub/api... --filter hub \
 && pnpm --filter @hub/api build \
 && mkdir -p /data/lab /data/docs /tmp/repos \
 && chown -R node:node /data /tmp/repos /app/apps/api
USER node
WORKDIR /app/apps/api
ENV NODE_ENV=production
EXPOSE 7310
CMD ["node", "dist/main.js"]
