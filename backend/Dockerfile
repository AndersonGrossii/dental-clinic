FROM node:20-alpine

WORKDIR /app

# Instalar dependencias del sistema para bcrypt
RUN apk add --no-cache python3 make g++

COPY package*.json ./

RUN npm ci --only=production && npm cache clean --force

COPY . .

# Crear directorios necesarios
RUN mkdir -p uploads logs

EXPOSE 4000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/v1/health || exit 1

CMD ["node", "server.js"]
