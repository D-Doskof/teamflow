FROM node:20-alpine

# Обновляем пакеты Alpine (openssl, busybox и т.д.) до последних доступных
# в репозитории версий — закрывает CVE в базовом образе на момент сборки.
RUN apk update && apk upgrade --no-cache && apk add --no-cache openssl

# npm, встроенный в образ node:20-alpine, тянет за собой устаревшие
# версии tar/glob/minimatch/sigstore и т.д. со своими CVE. Обновляем
# сам npm CLI, чтобы заменить эти вендоренные зависимости.
RUN npm install -g npm@11.18.0

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npx prisma generate

EXPOSE 5000

# Применяет миграции и запускает сервер
CMD ["sh", "-c", "npx prisma migrate deploy && npm run dev"]
