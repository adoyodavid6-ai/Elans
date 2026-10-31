#!/usr/bin/env bash
# Vercel build: when a database is connected, apply migrations and (re)seed before building.
# Seeding is idempotent: content edited in the console is kept; the illustrative demo tenant is rebuilt.
set -euo pipefail
DB="${DATABASE_URL:-${POSTGRES_URL:-}}"
if [ -n "$DB" ]; then
  echo "Database configured: applying migrations and seeding"
  SECRET="${SESSION_SECRET:-}"
  if [ -z "${DATABASE_ADMIN_URL:-}" ] && [ "${#SECRET}" -lt 32 ]; then
    echo "ERROR: SESSION_SECRET is missing or shorter than 32 characters."
    echo "       With Vercel's Neon integration it is required: it derives the app's restricted database password."
    echo "       Add it in Vercel → Settings → Environment Variables (Production), then redeploy."
    exit 1
  fi
  if [ -z "${ELANS_ADMIN_PASSWORD:-}" ]; then
    echo "NOTE: ELANS_ADMIN_EMAIL / ELANS_ADMIN_PASSWORD not set: no staff console admin will be created."
  fi
  npm run db:migrate
  npm run db:seed
else
  echo "No DATABASE_URL (or POSTGRES_URL): skipping migrations and seed."
  echo "The public site works from built-in content; the client portal, demo, staff console and forms need a database."
fi
npx next build
