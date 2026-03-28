#!/usr/bin/env bash
# ═══════════════════════════════════════════
# RIDDIM POS — Terminal Management
# Run from Mac: ./deploy.sh [command]
#
# Commands:
#   (none)     Full deploy — git pull, restart services, reload kiosks
#   shutdown   Power off both terminals
#   reboot     Reboot both terminals
#   restart    Restart services only (no git pull)
#   status     Check if terminals are reachable
# ═══════════════════════════════════════════
set -euo pipefail

TERM02="cipher@10.77.2.53"
TERM03="cipher@10.77.2.68"
REPO_DIR="/opt/riddim-pos"
AGENT_DIR="/home/cipher/print-agent"
CMD="${1:-deploy}"

both() {
  echo "[TERM02] $1..."
  ssh "$TERM02" "$2" && echo "[TERM02] Done" || echo "[TERM02] FAILED"
  echo "[TERM03] $1..."
  ssh "$TERM03" "$3" && echo "[TERM03] Done" || echo "[TERM03] FAILED"
}

echo "═══ RIDDIM POS — $CMD ═══"
echo ""

case "$CMD" in
  deploy)
    echo "[TERM02] Pulling latest and restarting..."
    ssh "$TERM02" "cd $REPO_DIR && git pull && sudo systemctl restart riddim-pos && sudo systemctl restart lightdm" && \
      echo "[TERM02] Done" || echo "[TERM02] FAILED"

    echo "[TERM03] Updating print agent..."
    scp -q print-agent/agent.js print-agent/escpos.js print-agent/package.json \
      "$TERM03:$AGENT_DIR/"
    ssh "$TERM03" "sudo systemctl restart riddim-print-agent && sudo systemctl restart lightdm" && \
      echo "[TERM03] Done" || echo "[TERM03] FAILED"
    ;;

  shutdown)
    both "Shutting down" "echo cipher | sudo -S shutdown now" "echo cipher | sudo -S shutdown now"
    ;;

  reboot)
    both "Rebooting" "echo cipher | sudo -S reboot" "echo cipher | sudo -S reboot"
    ;;

  restart)
    both "Restarting services" \
      "sudo systemctl restart riddim-pos && sudo systemctl restart lightdm" \
      "sudo systemctl restart riddim-print-agent && sudo systemctl restart lightdm"
    ;;

  status)
    echo -n "[TERM02] "; ssh -o ConnectTimeout=3 "$TERM02" "echo ONLINE — \$(uptime -p)" 2>/dev/null || echo "OFFLINE"
    echo -n "[TERM03] "; ssh -o ConnectTimeout=3 "$TERM03" "echo ONLINE — \$(uptime -p)" 2>/dev/null || echo "OFFLINE"
    ;;

  *)
    echo "Usage: ./deploy.sh [deploy|shutdown|reboot|restart|status]"
    exit 1
    ;;
esac

echo ""
echo "═══ Done ═══"
