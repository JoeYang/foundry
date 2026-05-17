#!/bin/sh
set -e
echo "==> Running migrations against ${DB_URL_MIGRATE:-not set}"
node --import tsx packages/db/src/scripts/migrate.ts
echo "==> Starting api"
exec "$@"
