FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install
RUN npm install --save-dev @types/bcrypt
RUN npx prisma generate

COPY . .

RUN npm run build

EXPOSE 3000

CMD npx prisma migrate deploy && npx prisma db push && node dist/server.js