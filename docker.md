# DPM2 Docker Hosting & Deployment Manual

> **Purpose:** Comprehensive architecture, operational guide, and checklist for hosting DPM2 on Docker with LAN exposure, zero-downtime updates, and automated database backups.

---

## 1. Overview & Architecture

- **Stack:** Next.js 15 (standalone output) + PostgreSQL 16 Alpine + Drizzle ORM + Better Auth.
- **Topology:** Two isolated container services connected via an internal bridge network (`backend`):
  - `db`: PostgreSQL 16 Alpine with 512MB shared memory (`shm_size`), 512MB shared buffers, healthcheck via `pg_isready`, and persistent named volume `pgdata`. **Port 5432 is NOT published to the LAN or host**, ensuring maximum security.
  - `app`: Production Next.js standalone container running as unprivileged `node` user (uid 1000). Runs idempotent migrations (`scripts/migrate.mjs`) on startup, exposes port 3000 mapped to the configurable host `APP_PORT`.
- **LAN Access:** Automatically binds to the server's working IP on the local area network. Any PC, tablet, or mobile phone on the same LAN connects via `http://<HOST_LAN_IP>:<APP_PORT>`.
- **Better Auth Integration:** Server-side dynamic `trustedOrigins` callback inspects incoming headers to allow session cookies and requests originating from any local IP on the network.

---

## 2. Directory Layout

```
DPM2/
├── Dockerfile                  # Multi-stage production build (node:22-alpine)
├── docker-compose.yml          # Production multi-container composition
├── .dockerignore               # Clean Docker build context
├── .env.example                # Documented configuration template
├── start.sh                    # Full Linux startup & zero-downtime updater
├── update.sh                   # Atomic updater script (logs to run/update.status)
├── START.bat                   # Windows double-click launcher
├── UPDATE.bat                  # Windows updater script
├── docker.md                   # This documentation
├── deploy/
│   ├── show-url.sh             # Displays LAN access banner and checks health
│   ├── show-url.bat            # Windows equivalent
│   ├── static-ip.sh            # Detects network adapter & guides static IP lock
│   ├── static-ip.bat           # Windows administrator static IP setup
│   ├── dpm-watcher.sh          # Self-healing host background update daemon
│   └── install-watcher.sh      # Systemd / cron installer for watcher daemon
├── scripts/
│   └── migrate.mjs             # Standalone production migration runner
├── drizzle/                    # Drizzle SQL migration files
├── logs/                       # Compose build & startup history logs
├── backups/                    # Automated pre-update database backups (.sql.gz)
└── run/                        # Shared runtime IPC directory (update flags & status)
```

---

## 3. Quick Start

### On Linux / Ubuntu Server

```bash
# 1. Clone repository
git clone <repo-url> /opt/dpm2 && cd /opt/dpm2

# 2. Make shell scripts executable
chmod +x start.sh update.sh deploy/*.sh

# 3. Configure environment
cp .env.example .env
nano .env   # Replace placeholder passwords with secure secrets

# 4. Start the system
./start.sh
```

`start.sh` automatically:
1. Verifies Docker Engine and Docker Compose plugin.
2. Creates `run`, `backups`, and `logs` folders with correct permissions (`uid 1000`).
3. Validates that `.env` does not contain default `"change-me"` passwords.
4. Activates the update watcher daemon (`deploy/dpm-watcher.sh`).
5. Detects the active LAN IP of the computer (`ip -4 route get 1.1.1.1`).
6. Starts the PostgreSQL database and compiles the standalone Next.js container.
7. Waits for both services to report `healthy`.
8. Displays the exact LAN address: `http://192.168.1.xxx:3000`.

### On Windows

1. Double-click `START.bat`.
2. The script launches Docker Desktop (if closed), validates `.env`, builds the stack, and prints the LAN URL.

---

## 4. Zero-Downtime Updates & Automatic Rollback

DPM2 features a safe zero-downtime update workflow (`./start.sh --quick`):

```bash
./start.sh --quick
```

**What happens during `--quick`:**
1. Preserves the currently running version as image tag `dpm-app:previous`.
2. Creates an automated compressed database backup under `backups/pre-quick-<timestamp>.sql.gz`.
3. Builds the new app container in the background **while the current app continues serving factory users**.
4. Swaps the container instance in milliseconds (`docker compose up -d --no-deps --no-build --force-recreate app`).
5. Monitors container health check `/api/health`.
6. **Automatic Rollback:** If the new version fails to become healthy within 90 seconds, it immediately rolls back to `dpm-app:previous` and restores the running application, keeping downtime at zero.

---

## 5. Security Architecture

1. **No Docker Socket Mounting:** The web app never mounts `/var/run/docker.sock`. Administrative updates write an empty flag file (`run/update.request`), which the host-side daemon (`dpm-watcher.sh`) picks up.
2. **Postgres Network Isolation:** Port 5432 is strictly bound to the internal `backend` bridge network. Client devices on the LAN cannot access PostgreSQL directly.
3. **Unprivileged Runtime:** The Next.js server runs as the unprivileged `node` user (`USER node`).
4. **Cookie Security:** `useSecureCookies` dynamically respects HTTP LAN connections (`COOKIE_SECURE=false`) while supporting HTTPS reverse proxies (`COOKIE_SECURE=true`).

---

## 6. Database Backups & Restore

### Manual Database Backup

```bash
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "backups/manual-$(date +%F_%H%M%S).sql.gz"
```

### Database Restore

```bash
gunzip -c backups/<backup-file>.sql.gz | docker compose exec -T db psql -U postgres dpm
```

### Database Seeding

To seed or re-seed default Homicho munitions complex data:

```bash
docker compose exec app pnpm db:seed
```

---

## 7. Useful Operational Commands

| Command | Description |
| :--- | :--- |
| `./start.sh` | Full initial start or rebuild |
| `./start.sh --quick` | Fast update with automatic rollback |
| `./start.sh --stop` | Cleanly stop all containers |
| `./start.sh --rebuild` | Clean rebuild ignoring cache |
| `./deploy/show-url.sh` | Show current host LAN IP and health status |
| `./deploy/static-ip.sh` | Display network interfaces and static IP guide |
| `docker compose logs -f app` | Stream live application logs |
| `docker compose logs -f db` | Stream live PostgreSQL database logs |
