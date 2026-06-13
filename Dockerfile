# syntax=docker/dockerfile:1

FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY web/package.json web/package-lock.json ./web/
WORKDIR /app/web
RUN npm ci

WORKDIR /app
COPY crm ./crm
COPY books ./books
COPY web ./web

WORKDIR /app/web
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4173

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY web/package.json web/package-lock.json ./web/
WORKDIR /app/web
RUN npm ci

WORKDIR /app
COPY crm ./crm
COPY books ./books
COPY web/vite.config.ts web/vite-plugin-crm-validate.ts ./web/
COPY --from=builder /app/web/dist ./web/dist

WORKDIR /app/web

EXPOSE 4173

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 4173) + '/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "4173"]
