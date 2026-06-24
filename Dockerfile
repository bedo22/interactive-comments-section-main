FROM node:20-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@11.8.0 --activate
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

EXPOSE 3000

ENV NODE_ENV=production
CMD ["node", "server/index.js"]
