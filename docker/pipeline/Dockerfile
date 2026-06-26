FROM node:22-alpine
WORKDIR /app
COPY server/pipeline/package.json server/pipeline/package-lock.json* ./
RUN npm install --omit=dev --no-fund --no-audit
COPY server/pipeline/index.js ./
COPY frontend/wowser-client/public ./wowser-public
EXPOSE 3000
CMD ["node", "index.js"]