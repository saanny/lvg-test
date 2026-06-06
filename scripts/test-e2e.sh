#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE="docker compose -f docker-compose.test.yaml"

cleanup() {
  echo "🧹 Removing test database..."
  $COMPOSE down -v --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "🐬 Starting ephemeral test database (port 3307)..."
$COMPOSE down -v --remove-orphans >/dev/null 2>&1 || true   
$COMPOSE up -d --wait                                        

echo "🧪 Running integration tests..."
NODE_ENV=test pnpm jest --config ./test/jest-integration.json "$@"
