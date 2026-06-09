#!/usr/bin/env bash
#
# start.sh — boots the chess-ebook-webparser dev stack (PHP API + React web).
#
# What it does:
#   1. Installs PHP (composer) and JS (pnpm) dependencies if missing.
#   2. Runs DB migrations and seeds an initial admin user (idempotent).
#   3. Starts the PHP backend on :8080 and the Vite frontend on :5173.
#   4. Vite proxies /api -> the backend, so the app works out of the box.
#
# Stop everything with Ctrl-C.
#
# Override defaults via env: API_PORT, WEB_PORT, ADMIN_EMAIL, ADMIN_PASSWORD.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$ROOT_DIR/apps/api"
WEB_FILTER="@chess-ebook/web"

API_PORT="${API_PORT:-8080}"
WEB_PORT="${WEB_PORT:-5173}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@chess.local}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-changeme}"

info()  { printf '\033[1;34m[start]\033[0m %s\n' "$1"; }
ok()    { printf '\033[1;32m[ ok ]\033[0m %s\n' "$1"; }
fail()  { printf '\033[1;31m[fail]\033[0m %s\n' "$1" >&2; exit 1; }

# --- prerequisite checks ---------------------------------------------------
command -v php       >/dev/null 2>&1 || fail "php not found (need PHP 8.x)"
command -v composer  >/dev/null 2>&1 || fail "composer not found"
command -v pnpm      >/dev/null 2>&1 || fail "pnpm not found (npm i -g pnpm)"

# --- dependencies ----------------------------------------------------------
if [ ! -d "$API_DIR/vendor" ]; then
  info "Installing PHP dependencies (composer install)..."
  composer install --working-dir="$API_DIR"
  ok "PHP dependencies installed"
else
  ok "PHP dependencies present"
fi

if [ ! -d "$ROOT_DIR/node_modules" ]; then
  info "Installing JS dependencies (pnpm install)..."
  (cd "$ROOT_DIR" && pnpm install)
  ok "JS dependencies installed"
else
  ok "JS dependencies present"
fi

# --- database: migrate + seed admin ---------------------------------------
info "Running database migrations..."
php "$API_DIR/bin/migrate.php"
ok "Migrations applied"

info "Seeding admin user ($ADMIN_EMAIL)..."
ADMIN_EMAIL="$ADMIN_EMAIL" ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  php "$API_DIR/bin/seed-admin.php" "$ADMIN_EMAIL" "$ADMIN_PASSWORD"

# --- process management ----------------------------------------------------
PIDS=()
cleanup() {
  info "Shutting down..."
  for pid in "${PIDS[@]:-}"; do
    kill "$pid" >/dev/null 2>&1 || true
  done
  wait >/dev/null 2>&1 || true
  ok "Stopped"
}
trap cleanup INT TERM EXIT

# Backend: PHP built-in server with public/ as docroot.
# AUTH_DEV_BYPASS=1 makes login optional in dev (tokenless requests = synthetic admin).
info "Starting PHP API on http://127.0.0.1:$API_PORT ..."
AUTH_DEV_BYPASS="${AUTH_DEV_BYPASS:-1}" \
  php -S "127.0.0.1:$API_PORT" -t "$API_DIR/public" >/tmp/chess-api.log 2>&1 &
PIDS+=("$!")

# Frontend: Vite dev server (proxies /api -> the backend).
info "Starting Vite web on http://127.0.0.1:$WEB_PORT ..."
VITE_API_TARGET="http://127.0.0.1:$API_PORT" \
  pnpm --filter "$WEB_FILTER" dev --port "$WEB_PORT" --host 127.0.0.1 &
PIDS+=("$!")

ok "Stack up."
echo
echo "    Web:    http://127.0.0.1:$WEB_PORT"
echo "    API:    http://127.0.0.1:$API_PORT/api/health"
echo "    Admin:  $ADMIN_EMAIL / $ADMIN_PASSWORD"
echo "    Logs:   /tmp/chess-api.log (backend)"
echo
info "Press Ctrl-C to stop."

# Wait on the background jobs; if one dies, cleanup runs via the trap.
wait
