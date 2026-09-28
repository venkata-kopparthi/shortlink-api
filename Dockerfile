FROM node:22-slim AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY tsconfig*.json ./
COPY src ./src
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
RUN mkdir -p /data && chown node:node /data
USER node
ENV DATABASE_PATH=/data/shortlink.db
EXPOSE 3000
CMD ["node", "dist/server.js"]
