# Build context is the repo root (see fly.toml's [build] context = "..") so
# this stage can reach the packages/shared workspace agent/ depends on.

# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:22-slim AS builder

WORKDIR /app

# Manifests only first, so the npm-install layer stays cached across
# source-only changes. npm workspaces needs every declared workspace's
# package.json present to resolve, even ones this image doesn't run.
COPY package.json package-lock.json ./
COPY agent/package.json ./agent/package.json
COPY app/package.json ./app/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN npm install

COPY packages/shared ./packages/shared
COPY agent/src ./agent/src
COPY agent/tsconfig.json ./agent/tsconfig.json

RUN npm run build --workspace=packages/shared
# build: tsc → dist/  +  cp -r src/knowledge dist/knowledge
RUN npm run build --workspace=agent

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:22-slim AS runner

WORKDIR /app

COPY package.json package-lock.json ./
COPY agent/package.json ./agent/package.json
COPY app/package.json ./app/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN npm install --omit=dev

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/agent/dist ./agent/dist

EXPOSE 3000
CMD ["node", "agent/dist/index.js"]
