FROM node:22-alpine
WORKDIR /app

# Gateway
WORKDIR /app/gateway
COPY server/gateway/package.json server/gateway/package-lock.json* ./
RUN npm install --omit=dev --no-fund --no-audit
COPY server/gateway/index.js ./
COPY server/gateway/lib ./lib

# Pipeline
WORKDIR /app/pipeline
COPY server/pipeline/package.json server/pipeline/package-lock.json* ./
RUN npm install --omit=dev --no-fund --no-audit
COPY server/pipeline/index.js ./
COPY frontend/wowser-client/public ./wowser-public

# Launcher static site (for live server hosting of https://wow.grudge-studio.com)
# Includes index.html, screen.* , /client/ built wowser, auth callback etc.
COPY frontend/site /app/launcher

WORKDIR /app
COPY docker/grudge-wow/start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 8787 3000
CMD ["/start.sh"]