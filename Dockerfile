FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm i -g supergateway@latest
COPY --from=build /app/dist ./dist

EXPOSE 8000
ENTRYPOINT ["supergateway", "--stdio", "node dist/index.js", "--outputTransport", "streamableHttp", "--stateful", "--port", "8000", "--streamableHttpPath", "/mcp", "--cors"]
