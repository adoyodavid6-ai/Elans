#!/usr/bin/env bash
# Vercel build: when a database is connected, apply migrations and (re)seed before building.
# Seeding is idempotent: content edited in the console is kept; the illustrative demo tenant is rebuilt.
set -euo pipefail
if [ -n "${DATABASE_ADMIN_URL:-}" ] && [ -n "${DATABASE_URL:-}" ]; then
  echo "Database configured: applying migrations and seeding"
  npm run db:migrate
  npm run db:seed
else
  echo "No DATABASE_URL / DATABASE_ADMIN_URL: skipping migrations and seed."
  echo "The public site works from built-in content; the client portal, demo, staff console and forms need a database."
fi
npx next build
