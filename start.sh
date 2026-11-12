#!/usr/bin/env bash
# ============================================================
#  start.sh  -  Start / update the DPM2 production system on Linux
#  Place: repo root (same folder as docker-compose.yml)
#  Run:   ./start.sh        (first time: chmod +x start.sh)
#
#  Uses Docker Engine (docker-ce) and the compose plugin.
#
#  FULL START (default), in order:
#    0. Pulls the latest code from Git (never blocks startup
#       if the server is offline) and restarts itself
#    1. Checks Docker Engine, the compose plugin and the daemon
#    2. Creates run, backups and logs folders, checks project files
#    3. Makes sure .env exists and has real passwords
#    4. Installs the update watcher daemon (systemd / cron)
#    5. Starts the database and the app (live build output)
#    6. Waits until the database and app report healthy
#    7. Shows the working LAN IP address to open from client PCs
#
#  QUICK UPDATE:  ./start.sh --quick
#    Fast app-only update after a code change:
#    pulls code, backs up the database, builds new app image
#    WHILE THE OLD ONE KEEPS RUNNING, swaps it, waits until
#    healthy, and ROLLS BACK automatically if it is not.
#
#  Options:
#    --quick        fast app-only update with automatic rollback
#    --no-backup    with --quick: skip the database backup
#    --rebuild      clean rebuild of the image (no cache)
#    --update       require the git pull to succeed
#    --no-update    skip the git pull
#    --quiet        spinner instead of live build output
#    --stop         stop the system (equivalent to docker compose down)
#    --no-color     plain output
#    --pause        wait for a key at the end (desktop launchers)
#    --help         show this text
# ============================================================

set -uo pipefail

ROOT="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
SELF="$ROOT/$(basename "${BASH_SOURCE[0]}")"
cd "$ROOT" || exit 1
mkdir -p logs run backups

USE_COLOR=1; NO_UPDATE=0; PAUSE=0; CHILD=0; NEEDS_BUILD=0
STOP=0
QUICK=0; NO_BACKUP=0; REBUILD=0; QUIET=0
REQUIRE_UPDATE="${REQUIRE_UPDATE:-0}"
QUICK_TIMEOUT="${QUICK_TIMEOUT:-90}"

for a in "$@"; do
  case "$a" in
    --child)      CHILD=1 ;;
    --updated)    NEEDS_BUILD=1 ;;
    --quick)      QUICK=1 ;;
    --no-backup)  NO_BACKUP=1 ;;
    --rebuild)    REBUILD=1 ;;
    --update)     REQUIRE_UPDATE=1 ;;
    --no-update)  NO_UPDATE=1 ;;
    --quiet)      QUIET=1 ;;
    --stop)       STOP=1 ;;
    -v|--verbose) : ;;
    --no-color)   USE_COLOR=0 ;;
    --pause)      PAUSE=1 ;;
    -h|--help)    awk 'NR>1 && /^#/ {sub(/^# ?/,""); print; next} NR>1 {exit}' "$SELF"; exit 0 ;;
    *)            echo "Unknown option: $a   (try --help)"; exit 2 ;;
  esac
done

if [ "$USE_COLOR" = 1 ] && [ -t 1 ]; then
  G=$'\e[92m'; R=$'\e[91m'; Y=$'\e[93m'; C=$'\e[96m'; Z=$'\e[0m'
else
  G=''; R=''; Y=''; C=''; Z=''
fi

if [ "$STOP" = 1 ]; then
  echo "  ${C}Stopping DPM2 system...${Z}"
  docker compose down
  echo "  ${G}System stopped successfully.${Z}"
  exit 0
fi

log() { printf '%s - %s\n' "$(date '+%F %T')" "$*" >> "$ROOT/logs/startup-history.log"; }

# ------------------------------------------------------------
#  0. Self-update from Git, then restart this script.
# ------------------------------------------------------------
if [ "$CHILD" -eq 0 ] && [ "$NO_UPDATE" -eq 0 ] && [ -d .git ] && command -v git >/dev/null 2>&1; then
  {
    echo
    echo "  ${Y}[..]${Z} Checking for system updates from Git repository..."
    git config --global --add safe.directory "$ROOT" 2>/dev/null || true
    OLD_HEAD=$(git rev-parse HEAD 2>/dev/null || echo none)
    git stash --include-untracked >/dev/null 2>&1 || git stash >/dev/null 2>&1 || true
    if GIT_TERMINAL_PROMPT=0 timeout 30 git pull --ff-only; then
      log "git pull OK"
      NEW_HEAD=$(git rev-parse HEAD 2>/dev/null || echo none)
      if [ "$OLD_HEAD" != "$NEW_HEAD" ]; then UPDATED_ARG="--updated"; else UPDATED_ARG=""; fi
    else
      log "git pull failed"
      if [ "$REQUIRE_UPDATE" = 1 ]; then
        echo "  ${R}[!] Could not pull latest changes. Stopping.${Z}"
        exit 1
      fi
      echo "  ${Y}[!] Could not reach remote repository or pull failed.${Z}"
      echo "      Continuing with the version already installed on this server."
      UPDATED_ARG=""
    fi
    exec bash "$SELF" --child $UPDATED_ARG "$@"
  }
fi

log "START requested ($([ "$QUICK" = 1 ] && echo quick || echo full))"

# ------------------------------------------------------------
#  Helpers & Formatting
# ------------------------------------------------------------
IS_TTY=0; [ -t 1 ] && IS_TTY=1
if [ "$IS_TTY" = 1 ]; then printf '\e[?25l'; fi
trap '[ "$IS_TTY" = 1 ] && printf "\e[?25h"' EXIT
trap 'echo; echo "  Interrupted."; log "interrupted"; exit 130' INT TERM

SPIN='|/-\'
PAT='..........##..........'
FULLS='#######'; EMPTYS='.......'
F=0; T0=$SECONDS

mark()      { T0=$SECONDS; }
fmt_el()    { local e=$(( SECONDS - T0 )); printf '%d:%02d' $((e/60)) $((e%60)); }
clearline() { [ "$IS_TTY" = 1 ] && printf '\r\e[K'; return 0; }
frame() {
  [ "$IS_TTY" = 1 ] || return 0
  F=$(( (F + 1) % 20 ))
  local pos=$F; [ "$pos" -gt 10 ] && pos=$(( 20 - pos ))
  printf '\r   %s%s%s %s  [%s] %s    \e[K' "$C" "${SPIN:$((F % 4)):1}" "$Z" "$1" "${PAT:$pos:12}" "$(fmt_el)"
}
step() {
  local n=$1
  echo; echo "  ${C}[${FULLS:0:n}${EMPTYS:n}]${Z} Step $n of 7 - $2"
  log "step $n: $2"
}
qstep() {
  local n=$1
  echo; echo "  ${C}[${FULLS:0:n}${EMPTYS:0:$((4-n))}]${Z} Quick update $n of 4 - $2"
  log "quick $n: $2"
}
ok()   { echo "  ${G}[OK]${Z} $*"; }
warn() { echo "  ${Y}[!]${Z} $*"; }
info() { echo "  ${Y}[..]${Z} $*"; }
pause_if() { if [ "$PAUSE" = 1 ] && [ -t 0 ]; then read -rsn1 -p "  Press any key to close..." _; echo; fi; return 0; }
die() {
  local head=$1; shift
  clearline; echo
  echo "  ${R}[!] ${head}${Z}"
  for l in "$@"; do echo "      $l"; done
  log "FAILED: $head"
  echo; pause_if; exit 1
}
spin_pid() {
  local pid=$1 msg=$2; mark
  while kill -0 "$pid" 2>/dev/null; do frame "$msg"; sleep 0.25; done
  clearline; wait "$pid"
}

DOCKER=(docker)
PROG=()
dc() { "${DOCKER[@]}" compose "$@"; }
docker_up() { "${DOCKER[@]}" info >/dev/null 2>&1; }
svc_status() {
  local cid
  cid=$(dc ps -q "$1" 2>/dev/null | head -n1)
  [ -z "$cid" ] && { echo starting; return; }
  "${DOCKER[@]}" inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$cid" 2>/dev/null || echo starting
}
wait_healthy() {
  local limit=$1 n=0; DBS=starting; APS=starting; mark
  while :; do
    if [ $(( n % 20 )) -eq 0 ]; then DBS=$(svc_status db); APS=$(svc_status app); fi
    if [ "$APS" = healthy ]; then clearline; return 0; fi
    if [ $(( SECONDS - T0 )) -ge "$limit" ]; then clearline; return 1; fi
    frame "Database: $DBS  App: $APS"
    sleep 0.25; n=$(( n + 1 ))
  done
}
run_logged() {
  local msg=$1; shift
  : > logs/compose.log
  if [ "$QUIET" = 1 ]; then
    "$@" > logs/compose.log 2>&1 &
    spin_pid $! "$msg"; return $?
  fi
  echo "  ------------------------------------------------------------"
  mark
  "$@" 2>&1 | tee logs/compose.log
  local rc=${PIPESTATUS[0]}
  echo "  ------------------------------------------------------------"
  return "$rc"
}
show_failure() {
  echo "  ${R}[!] docker compose failed (exit code $1).${Z}"
  echo
  echo "      Lines indicating error:"
  grep -iE 'error|failed|cannot|not found|denied|no such|unable' logs/compose.log | tail -n 10 | sed 's/^/        /'
  if [ "$QUIET" = 1 ]; then
    echo; echo "      Last 40 lines of the log:"; echo
    tail -n 40 logs/compose.log | sed 's/^/        /'
  fi
  echo
  echo "      Full log file: logs/compose.log"
  echo "      Clean rebuild: ./start.sh --rebuild"
}
lan_ip() {
  local addr
  addr=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src"){print $(i+1); exit}}')
  [ -z "$addr" ] && addr=$(hostname -I 2>/dev/null | awk '{print $1}')
  echo "${addr:-localhost}"
}

# ------------------------------------------------------------
#  --quick : zero-downtime app update with automatic rollback
# ------------------------------------------------------------
quick_update() {
  [ -f .env ] || die ".env was not found." "Run ./start.sh once for the first full start."
  local cid old_id app_ref repo bfile rc

  qstep 2 "Preserving current version and backing up database"
  cid=$(dc ps -q app 2>/dev/null | head -n1)
  [ -n "$cid" ] || die "DPM2 is not running." "Use ./start.sh for a full initial start."
  old_id=$("${DOCKER[@]}" inspect -f '{{.Image}}' "$cid")
  app_ref=$("${DOCKER[@]}" inspect -f '{{.Config.Image}}' "$cid")
  repo=${app_ref%%:*}
  "${DOCKER[@]}" tag "$old_id" "${repo}:previous" 2>/dev/null || true
  ok "Current image preserved as ${repo}:previous"

  bfile=""
  if [ "$NO_BACKUP" = 1 ]; then
    warn "Database backup skipped (--no-backup)."
  else
    mkdir -p backups
    bfile="backups/pre-quick-$(date +%F_%H%M%S).sql.gz"
    dc exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' 2>logs/backup.err | gzip > "$bfile"
    rc=${PIPESTATUS[0]}
    if [ "$rc" -eq 0 ] && [ "$(stat -c %s "$bfile")" -gt 100 ]; then
      ok "Database backed up to $bfile"
      ls -1t backups/pre-quick-*.sql.gz 2>/dev/null | tail -n +11 | xargs -r rm -f
    else
      rm -f "$bfile"
      die "Database backup failed. Update cancelled." \
        "The running system was not modified. See logs/backup.err" \
        "To bypass backup: ./start.sh --quick --no-backup"
    fi
  fi

  qstep 3 "Building new version (running container serves users meanwhile)"
  local bargs=(build); [ "$REBUILD" = 1 ] && bargs+=(--no-cache)
  run_logged "Building new DPM2 app image" dc ${PROG[@]+"${PROG[@]}"} "${bargs[@]}" app; rc=$?
  if [ "$rc" -ne 0 ]; then
    show_failure "$rc"
    echo
    echo "      ${G}Running system was untouched. Production operations unaffected.${Z}"
    log "FAILED: quick build (exit $rc)"
    echo; pause_if; exit 1
  fi
  ok "New image built in $(fmt_el)."

  qstep 4 "Switching to new container version"
  mark
  if dc up -d --no-deps --no-build --force-recreate app && wait_healthy "$QUICK_TIMEOUT"; then
    "${DOCKER[@]}" image prune -f >/dev/null 2>&1 || true
    ok "New version is healthy. Switch time: $(fmt_el)."
    log "OK: quick update healthy"
    echo
    echo " ${G}=====================================================${Z}"
    echo " ${G}   DPM2 UPDATE COMPLETE${Z}"
    echo " ${G}=====================================================${Z}"
    echo "  Tip: Press Ctrl+F5 in web browsers to reload new static assets."
    echo; pause_if; exit 0
  fi

  # ---- New version unhealthy -> Roll back ----
  clearline
  echo "  ${R}[!] New version did not become healthy within $QUICK_TIMEOUT seconds.${Z}"
  echo "      Recent app log output:"; echo
  dc logs --tail 40 app 2>&1 | tee logs/quick-failed-app.log | sed 's/^/        /'
  echo
  warn "Rolling back to previous stable version..."
  "${DOCKER[@]}" tag "$old_id" "$app_ref"
  if dc up -d --no-deps --no-build --force-recreate app && wait_healthy 90; then
    ok "Rolled back successfully. Previous version is running."
    log "ROLLED BACK: new version unhealthy"
  else
    echo "  ${R}[!] Rollback failed. Check: docker compose logs app${Z}"
    log "FAILED: rollback unhealthy"
  fi
  [ -n "$bfile" ] && echo "      Database backup available for restore at: $bfile"
  echo; pause_if; exit 1
}

echo
echo " ${C}=====================================================${Z}"
echo " ${C}  DPM2 Production System  -  $([ "$QUICK" = 1 ] && echo 'Quick Update' || echo Startup)${Z}"
echo " ${C}=====================================================${Z}"

# ------------------------------------------------------------
#  1. Docker Engine check
# ------------------------------------------------------------
if [ "$QUICK" = 1 ]; then qstep 1 "Checking Docker Engine"; else step 1 "Checking Docker Engine"; fi

command -v docker >/dev/null 2>&1 || die "Docker is not installed on this host." \
  "Install Docker Engine from https://docs.docker.com/engine/install/ and rerun."
docker compose version >/dev/null 2>&1 || die "Docker Compose plugin is missing." \
  "Install it: sudo apt-get install docker-compose-plugin"

if ! docker_up; then
  out=$(docker info 2>&1 || true)
  if grep -qi 'permission denied' <<<"$out"; then
    if command -v sudo >/dev/null 2>&1; then
      DOCKER=(sudo docker)
      warn "User is not in docker group; using sudo."
      echo "      Fix permanently: sudo usermod -aG docker \$USER && newgrp docker"
    else
      die "Permission denied to Docker socket." "Add user to docker group or run as root."
    fi
  fi
fi

if ! docker_up; then
  command -v systemctl >/dev/null 2>&1 || die "Docker is not running and systemctl is unavailable."
  info "Docker daemon is not running. Starting service now..."
  sudo -v || die "sudo required to start Docker service." "Run: sudo systemctl start docker"
  sudo systemctl start docker >/dev/null 2>&1 &
  spin_pid $! "Starting Docker daemon" || true
  mark
  while ! docker_up; do
    [ $(( SECONDS - T0 )) -ge 120 ] && die "Docker service could not be started." \
      "Check: sudo systemctl status docker"
    frame "Waiting for Docker daemon"; sleep 0.25
  done
  clearline
fi
ok "Docker Engine is active."

if command -v systemctl >/dev/null 2>&1 && ! systemctl is-enabled --quiet docker 2>/dev/null; then
  warn "Docker is not set to auto-start on boot."
  echo "      Enable: sudo systemctl enable docker"
fi

dc --progress=plain version >/dev/null 2>&1 && PROG=(--progress=plain)

if [ "$QUICK" = 1 ]; then quick_update; fi

# ------------------------------------------------------------
#  2. Folders and project files
# ------------------------------------------------------------
step 2 "Preparing runtime folders"
mkdir -p run backups logs
chmod 777 run backups logs 2>/dev/null || true
rm -f run/update.request 2>/dev/null || true
chown -R 1000:1000 run 2>/dev/null || sudo chown -R 1000:1000 run 2>/dev/null || true
chmod -R 777 run 2>/dev/null || sudo chmod -R 777 run 2>/dev/null || true
chmod +x update.sh deploy/*.sh *.sh 2>/dev/null || true
ok "Runtime folders ready (run, backups, logs)."

if ! { [ -f docker-compose.yml ] || [ -f docker-compose.yaml ]; }; then
  die "docker-compose.yml not found in $ROOT"
fi
if [ ! -f Dockerfile ]; then
  die "Dockerfile not found in $ROOT"
fi
ok "Docker configuration files verified."

# ------------------------------------------------------------
#  3. .env check & secret validation
# ------------------------------------------------------------
step 3 "Validating environment settings (.env)"

if [ ! -f .env ]; then
  [ -f .env.example ] || die "Neither .env nor .env.example found."
  cp .env.example .env
  warn ".env was missing - created from .env.example."
  echo "      Please set a strong DB_PASSWORD and BETTER_AUTH_SECRET."
  ED="${EDITOR:-}"
  [ -z "$ED" ] && for e in nano vim vi; do command -v "$e" >/dev/null 2>&1 && { ED=$e; break; }; done
  if [ -t 0 ] && [ -n "$ED" ]; then "$ED" .env; else
    die ".env needs real secrets." "Edit .env with production passwords, then rerun."
  fi
fi
chmod 600 .env 2>/dev/null || true

if grep -qi 'change-me' .env; then
  die '.env contains default "change-me" placeholder values.' \
    "Replace placeholder passwords in .env with real secrets before hosting."
fi
missing=0
for v in DB_USER DB_PASSWORD DB_NAME; do
  if ! grep -Eq "^${v}=.+" .env; then warn ".env is missing setting: $v"; missing=1; fi
done
[ "$missing" = 1 ] && die ".env is missing required variables."

ok "Environment variables validated."

# ------------------------------------------------------------
#  4. Update Watcher Daemon
# ------------------------------------------------------------
step 4 "Checking update watcher daemon"

chmod +x update.sh deploy/*.sh *.sh 2>/dev/null || true

if [ -f "$ROOT/deploy/install-watcher.sh" ]; then
  /bin/bash "$ROOT/deploy/install-watcher.sh" silent || true
fi

if [ -f "$ROOT/deploy/dpm-watcher.sh" ]; then
  if "$ROOT/deploy/dpm-watcher.sh" --status >/dev/null 2>&1; then
    ok "Update watcher is active and monitoring for updates."
  else
    info "Starting dpm-watcher.sh in background..."
    "$ROOT/deploy/dpm-watcher.sh" --daemon || true
    if "$ROOT/deploy/dpm-watcher.sh" --status >/dev/null 2>&1; then
      ok "Update watcher running in daemon mode."
    else
      warn "Update watcher daemon could not start automatically."
    fi
  fi
fi

# ------------------------------------------------------------
#  5. Start container stack
# ------------------------------------------------------------
step 5 "Building and launching containers"

LAN_IP=$(lan_ip)
export LAN_IP
info "Detected server LAN IP: $LAN_IP"

compose_job() {
  if [ "$REBUILD" = 1 ]; then
    echo ">>> docker compose build --no-cache"
    dc ${PROG[@]+"${PROG[@]}"} build --no-cache || return $?
  fi
  echo ">>> docker compose up -d --build"
  dc ${PROG[@]+"${PROG[@]}"} up -d --build
}

run_logged "Building and starting DPM2 containers" compose_job; rc=$?
if [ "$rc" -eq 0 ]; then
  ok "Containers initialized in $(fmt_el)."
else
  show_failure "$rc"
  echo "      Container status:"; dc ps 2>/dev/null | sed 's/^/        /'
  log "FAILED: docker compose up (exit $rc)"
  echo; pause_if; exit 1
fi

# ------------------------------------------------------------
#  6. Wait for Healthy (Database & App)
# ------------------------------------------------------------
step 6 "Waiting for database and app healthcheck"
echo

if wait_healthy 150; then
  ok "Database and app healthy after $(fmt_el)."
  log "OK: app healthy"
else
  echo "  ${R}[!] App did not become healthy within 2.5 minutes.${Z}"
  echo "      App logs:"; echo
  dc logs --tail 30 app
  echo
  log "FAILED: app not healthy"
  echo; pause_if; exit 1
fi

# ------------------------------------------------------------
#  7. Display access URL
# ------------------------------------------------------------
step 7 "Access address & network endpoints"

if [ -x deploy/show-url.sh ]; then
  ./deploy/show-url.sh
else
  APP_PORT=$(grep -E '^APP_PORT=' .env | tail -n1 | cut -d= -f2- | tr -d '\r" ')
  APP_PORT=${APP_PORT:-3000}
  echo
  echo "  Open on ANY PC/device on this network:"
  echo "        ${C}http://${LAN_IP}:${APP_PORT}${Z}"
  echo
  echo "  Localhost on this PC:"
  echo "        ${C}http://localhost:${APP_PORT}${Z}"
  echo
fi

echo " ${G}=====================================================${Z}"
echo " ${G}   DPM2 PRODUCTION SYSTEM IS ONLINE${Z}"
echo " ${G}=====================================================${Z}"
echo "  Tip: Set a static DHCP reservation in your router for this host"
echo "       so the IP address http://${LAN_IP}:${APP_PORT} stays permanent."
echo

pause_if
exit 0
