FROM node:20-alpine

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

COPY artifacts/discord-bot/package.json ./artifacts/discord-bot/package.json

RUN pnpm install --frozen-lockfile --filter @workspace/discord-bot

COPY artifacts/discord-bot/src ./artifacts/discord-bot/src

WORKDIR /app/artifacts/discord-bot

CMD ["node", "src/index.js"]
