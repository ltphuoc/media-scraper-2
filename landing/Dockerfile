FROM node:22-bookworm-slim AS builder
WORKDIR /app

RUN npm install -g pnpm


COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM node:22-bookworm-slim AS runner
WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

COPY --from=builder /app ./

EXPOSE 3000

CMD ["pnpm", "start"]
