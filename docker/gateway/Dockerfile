FROM node:22-alpine
WORKDIR /app
COPY server/gateway/package.json server/gateway/package-lock.json* ./
RUN npm install --omit=dev --no-fund --no-audit
COPY server/gateway/index.js ./
COPY server/gateway/lib ./lib
EXPOSE 8787
CMD ["node", "index.js"]