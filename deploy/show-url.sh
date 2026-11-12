#!/usr/bin/env bash
# ============================================================
#  deploy/show-url.sh
#  Prints the DPM2 LAN URL and status to the console.
# ============================================================
set -uo pipefail

ROOT="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)"
cd "$ROOT" || exit 1

if [ -t 1 ]; then
  G=$'\e[92m'; R=$'\e[91m'; Y=$'\e[93m'; C=$'\e[96m'; Z=$'\e[0m'
else
  G=''; R=''; Y=''; C=''; Z=''
fi

APP_PORT=3000
if [ -f .env ]; then
  PARSED_PORT=$(grep -E '^APP_PORT=' .env | tail -n1 | cut -d= -f2- | tr -d '\r" ' || true)
  [ -n "$PARSED_PORT" ] && APP_PORT="$PARSED_PORT"
fi

LAN_IP=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src"){print $(i+1); exit}}')
[ -z "$LAN_IP" ] && LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
LAN_IP="${LAN_IP:-localhost}"

echo
echo "  ${C}=====================================================${Z}"
echo "    ${G}Open this address on ANY PC or tablet on the LAN:${Z}"
echo
echo "        ${C}http://${LAN_IP}:${APP_PORT}${Z}"
echo
if [ "$LAN_IP" != "localhost" ]; then
  echo "    On this host computer you can also use:"
  echo "        ${C}http://localhost:${APP_PORT}${Z}"
  echo
fi
echo "  ${C}=====================================================${Z}"
echo

# Health check probe
if curl -sf "http://127.0.0.1:${APP_PORT}/api/health" >/dev/null 2>&1 || curl -sf "http://${LAN_IP}:${APP_PORT}/api/health" >/dev/null 2>&1; then
  echo "    App Status: ${G}ONLINE & HEALTHY${Z}"
else
  echo "    App Status: ${Y}Starting up / Initializing${Z} (Docker may still be compiling/starting)"
fi
echo
