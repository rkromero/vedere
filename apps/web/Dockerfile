# Vedere Web — build desde la raíz del monorepo (Railway: Dockerfile path = apps/web/Dockerfile)
FROM node:20-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN npm install -g pnpm@9.15.9
WORKDIR /app

# ---- deps ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY packages/ui/package.json packages/ui/
RUN pnpm install --frozen-lockfile --filter @vedere/web...

# ---- build ----
FROM deps AS build
# Las NEXT_PUBLIC_* se inyectan en build time. Railway pasa las variables del servicio como build args.
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_PROMO_ENABLED
ARG NEXT_PUBLIC_PROMO_TEXT
ARG NEXT_PUBLIC_PROMO_LINK
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_PROMO_ENABLED=$NEXT_PUBLIC_PROMO_ENABLED
ENV NEXT_PUBLIC_PROMO_TEXT=$NEXT_PUBLIC_PROMO_TEXT
ENV NEXT_PUBLIC_PROMO_LINK=$NEXT_PUBLIC_PROMO_LINK
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_STANDALONE=1
COPY packages/ui packages/ui
COPY apps/web apps/web
RUN pnpm --filter @vedere/web build

# ---- runtime (output standalone) ----
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
