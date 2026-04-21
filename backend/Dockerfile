FROM node:20-alpine

WORKDIR /app

COPY backend/package*.json ./
RUN npm install --omit=dev

COPY backend/src ./src

EXPOSE 3005

CMD ["node", "src/index.js"]
