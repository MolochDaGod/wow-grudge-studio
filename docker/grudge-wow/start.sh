#!/bin/sh
set -e
cd /app/pipeline && node index.js &
cd /app/gateway && exec node index.js