# syntax=docker/dockerfile:1

FROM oven/bun:1-alpine AS build

WORKDIR /app

COPY package.json bun.lock ./
COPY src/apps/api/package.json src/apps/api/
COPY src/apps/web/package.json src/apps/web/
COPY src/apps/copilot/package.json src/apps/copilot/
COPY src/packages/auth/package.json src/packages/auth/
COPY src/packages/bootstrap/package.json src/packages/bootstrap/
COPY src/packages/core/package.json src/packages/core/
COPY src/packages/database/package.json src/packages/database/
COPY src/packages/encryption/package.json src/packages/encryption/
COPY src/packages/logger/package.json src/packages/logger/
COPY src/packages/mcp/package.json src/packages/mcp/
COPY src/packages/middleware/package.json src/packages/middleware/
COPY src/packages/notifications/package.json src/packages/notifications/
COPY src/packages/platform/package.json src/packages/platform/
COPY src/packages/statements/package.json src/packages/statements/

COPY src ./src
COPY tsconfig.json ./

RUN bun install --frozen-lockfile
RUN bun run --filter @ndb/web build

FROM oven/bun:1-alpine AS app

RUN apk add --no-cache qpdf su-exec wget

WORKDIR /app

COPY package.json bun.lock ./
COPY src/apps/api/package.json src/apps/api/
COPY src/apps/copilot/package.json src/apps/copilot/
COPY src/packages/auth/package.json src/packages/auth/
COPY src/packages/bootstrap/package.json src/packages/bootstrap/
COPY src/packages/core/package.json src/packages/core/
COPY src/packages/database/package.json src/packages/database/
COPY src/packages/encryption/package.json src/packages/encryption/
COPY src/packages/logger/package.json src/packages/logger/
COPY src/packages/mcp/package.json src/packages/mcp/
COPY src/packages/middleware/package.json src/packages/middleware/
COPY src/packages/notifications/package.json src/packages/notifications/
COPY src/packages/platform/package.json src/packages/platform/
COPY src/packages/statements/package.json src/packages/statements/

COPY src ./src
COPY deploy ./deploy
COPY tsconfig.json ./

RUN bun install --frozen-lockfile --filter @ndb/api --filter @ndb/copilot

RUN chmod +x /app/deploy/entrypoint.app.sh

VOLUME ["/var/lib/networthdb"]

EXPOSE 8000 8002

ENTRYPOINT ["/app/deploy/entrypoint.app.sh"]
CMD ["bun", "src/apps/api/src/server.ts"]

FROM nginx:1-alpine AS web

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/src/apps/web/dist /usr/share/nginx/html

EXPOSE 80

FROM postgres:18.3-alpine AS postgres

RUN apk add --no-cache openssl

COPY deploy/entrypoint.postgres.sh /usr/local/bin/entrypoint.postgres.sh
RUN chmod +x /usr/local/bin/entrypoint.postgres.sh

VOLUME ["/var/lib/postgresql/data", "/var/lib/postgresql/ssl"]

ENTRYPOINT ["/usr/local/bin/entrypoint.postgres.sh"]
