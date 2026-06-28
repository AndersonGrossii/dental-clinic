FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY backend/package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY backend/ .
COPY frontend/ ../frontend/

RUN mkdir -p uploads logs

EXPOSE 4000

CMD ["node", "server.js"]
