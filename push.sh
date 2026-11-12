#!/bin/bash
# ==============================================================================
# DPM2 — Database Schema Push & Migration Script
# ==============================================================================
# Pushes pending Drizzle ORM migrations and schema tables to PostgreSQL.
# Works in Docker container, on host system, or standalone.
#
# Usage:
#   ./push.sh           # Push all schema tables and migrations
#   ./push.sh --seed    # Push schema and seed database
# ==============================================================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}   DPM2 — Database Schema Push & Migration Script      ${NC}"
echo -e "${BLUE}======================================================${NC}"

RUN_SEED=false
for arg in "$@"; do
    case "$arg" in
        --seed) RUN_SEED=true ;;
    esac
done

# Strategy 1: If running inside Docker container
if [ -f "/run/updater/update.status" ] || [ -f "/app/.next/standalone/server.js" ] || [ "$HOSTNAME" = "0.0.0.0" ]; then
    echo -e "${YELLOW}[1/2] Running inside container: executing scripts/migrate.mjs...${NC}"
    node scripts/migrate.mjs
    if [ "$RUN_SEED" = true ]; then
        echo -e "${YELLOW}[2/2] Seeding initial dataset...${NC}"
        node -e "import('./src/db/seed.ts').then(m => m.seedDatabase()).catch(console.error)" || true
    fi
    echo -e "${GREEN}✓ Database schema pushed successfully.${NC}"
    exit 0
fi

# Strategy 2: If Docker Compose is running on host
if command -v docker &> /dev/null && docker compose ps &> /dev/null; then
    APP_STATUS=$(docker compose ps -q app 2>/dev/null || true)
    DB_STATUS=$(docker compose ps -q db 2>/dev/null || true)

    if [ -n "$APP_STATUS" ] && [ "$(docker inspect -f '{{.State.Running}}' "$APP_STATUS" 2>/dev/null)" = "true" ]; then
        echo -e "${YELLOW}[1/2] App container is running: executing migration inside container...${NC}"
        docker compose exec -T app node scripts/migrate.mjs
        if [ "$RUN_SEED" = true ]; then
            echo -e "${YELLOW}[2/2] Seeding database inside container...${NC}"
            docker compose exec -T app wget -qO- "http://localhost:3000/api/seed-db?force=true" || true
        fi
        echo -e "${GREEN}✓ Database schema pushed successfully via Docker container.${NC}"
        exit 0
    elif [ -n "$DB_STATUS" ] && [ "$(docker inspect -f '{{.State.Running}}' "$DB_STATUS" 2>/dev/null)" = "true" ]; then
        echo -e "${YELLOW}[1/2] Database container is running: launching ephemeral container to apply migrations...${NC}"
        docker compose run --rm app node scripts/migrate.mjs
        if [ "$RUN_SEED" = true ]; then
            echo -e "${YELLOW}[2/2] Seeding database...${NC}"
            docker compose run --rm app node -e "import('./src/db/seed.ts').then(m => m.seedDatabase()).catch(console.error)" || true
        fi
        echo -e "${GREEN}✓ Database schema pushed successfully.${NC}"
        exit 0
    fi
fi

# Strategy 3: Local Node.js / pnpm execution on host
echo -e "${YELLOW}[1/2] Running locally via Node.js / pnpm...${NC}"
if [ -f "scripts/migrate.mjs" ]; then
    node scripts/migrate.mjs
elif command -v pnpm &> /dev/null; then
    pnpm db:migrate || pnpm db:push
else
    npm run db:migrate || npm run db:push
fi

if [ "$RUN_SEED" = true ]; then
    echo -e "${YELLOW}[2/2] Seeding database...${NC}"
    if command -v pnpm &> /dev/null; then
        pnpm db:seed
    else
        npm run db:seed
    fi
fi

echo -e "${GREEN}======================================================${NC}"
echo -e "${GREEN}   ✓ DATABASE SCHEMA PUSH COMPLETE SUCCESSFULLY!       ${NC}"
echo -e "${GREEN}======================================================${NC}"
