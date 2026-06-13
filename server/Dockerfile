FROM node:18-alpine

RUN apk add --no-cache vips-dev build-base

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
