FROM node:24-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 PLAYWRIGHT_BROWSERS_PATH=/opt/playwright

FROM base AS dependencies
COPY package.json package-lock.json ./
RUN npm ci && node_modules/.bin/playwright install --with-deps chromium

FROM dependencies AS build
COPY . .
# Build-only placeholders; runtime credentials are supplied by the deployment.
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build BETTER_AUTH_URL=http://localhost:3000 BETTER_AUTH_SECRET=build_only_placeholder_secret_123456789 npm run build -- --webpack

FROM dependencies AS runtime
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/src ./src
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/prisma.config.ts /app/next.config.ts /app/tsconfig.json ./
COPY --from=build --chown=node:node /app/scripts ./scripts
USER node
EXPOSE 3000
CMD ["npm", "run", "start"]
