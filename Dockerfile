FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY server/package.json server/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY server server
RUN pnpm --filter @amm/server build && pnpm --filter @amm/server deploy --prod /app/deploy

FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/deploy ./
EXPOSE 3000
CMD ["node", "dist/index.js"]
