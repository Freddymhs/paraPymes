# Contexto de build: RAÍZ del monorepo (usa el pnpm-lock.yaml de la raíz).
#   docker build -f apps/ct-core-api/Dockerfile -t ct-core-api .
ARG NODE_VERSION=22
ARG PNPM_VERSION=9.15.0
# Debe coincidir con "turbo" en el package.json de la raíz.
ARG TURBO_VERSION=2.9.14

FROM node:${NODE_VERSION}-alpine AS base
ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app

# Subconjunto del workspace que necesita @parapymes/ct-core-api, con su lockfile podado desde el de la raíz.
FROM base AS pruner
ARG TURBO_VERSION
COPY . .
RUN pnpm dlx turbo@${TURBO_VERSION} prune @parapymes/ct-core-api --docker

FROM base AS build
ENV HUSKY=0
COPY --from=pruner /app/out/json/ ./
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ ./
RUN pnpm --filter @parapymes/ct-core-api build
RUN pnpm --filter @parapymes/ct-core-api deploy --prod /prod

FROM node:${NODE_VERSION}-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /prod ./
COPY --from=build --chown=node:node /app/apps/ct-core-api/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
