FROM node:20-alpine AS base
RUN corepack enable pnpm

# Build
FROM base AS builder
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/admin/package.json ./apps/admin/
COPY apps/mobile/package.json ./apps/mobile/
COPY apps/landing/package.json ./apps/landing/
COPY packages/ui/package.json ./packages/ui/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @stray/mobile build

# Runtime
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/mobile/.next/standalone ./
COPY --from=builder /app/apps/mobile/.next/static ./apps/mobile/.next/static
COPY --from=builder /app/apps/mobile/public ./apps/mobile/public
EXPOSE 3000
CMD ["node", "apps/mobile/server.js"]
