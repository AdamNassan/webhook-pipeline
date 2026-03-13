FROM node:20-bookworm-slim AS base
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src
COPY eslint.config.mjs ./eslint.config.mjs

RUN npm run prisma:generate
RUN npm run build

EXPOSE 3000
