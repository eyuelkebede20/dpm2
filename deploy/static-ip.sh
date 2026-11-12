#!/usr/bin/env bash
# ============================================================
#  deploy/static-ip.sh
#  Displays the host's current LAN IP and configuration guide.
# ============================================================
set -euo pipefail

echo
echo "  ====================================================="
echo "    DPM2 Production - Static IP Info / Setup (Linux)"
echo "  ====================================================="
echo

DEV=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="dev"){print $(i+1); exit}}')
IP=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src"){print $(i+1); exit}}')
GATEWAY=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="via"){print $(i+1); exit}}')

echo "  Detected active interface : ${DEV:-unknown}"
echo "  Current IP address        : ${IP:-unknown}"
echo "  Default Gateway           : ${GATEWAY:-unknown}"
echo
echo "  To make this IP permanent on the factory/clinic LAN:"
echo "   1. Configure DHCP Reservation on your router for this PC's MAC address (Recommended)."
echo "   2. Or edit /etc/netplan/*.yaml or use 'nmcli con mod <conn> ipv4.method manual'."
echo
echo "  LAN Web URL: http://${IP:-localhost}:3000"
echo "  ====================================================="
echo
