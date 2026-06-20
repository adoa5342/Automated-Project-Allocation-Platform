FROM node:20-alpine

WORKDIR /app/admin-dashboard

COPY package.json ./

RUN npm install
# RUN npx prisma generate

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# CMD npx prisma db push && node dist/server.js