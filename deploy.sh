#!/usr/bin/env bash
# ═══════════════════════════════════════════
# RIDDIM POS — Deploy to Terminals
# Run from Mac: ./deploy.sh
# ═══════════════════════════════════════════
set -euo pipefail

TERM02="cipher@10.77.2.53"
TERM03="cipher@10.77.2.68"
REPO_DIR="/opt/riddim-pos"
AGENT_DIR="/home/cipher/print-agent"

echo "═══ RIDDIM POS Deploy ═══"
echo ""

# ── TERM02 (server + kiosk) ──────────────────
echo "[TERM02] Pulling latest and restarting server..."
ssh "$TERM02" "cd $REPO_DIR && git pull && sudo systemctl restart riddim-pos" && \
  echo "[TERM02] Done" || echo "[TERM02] FAILED"

# ── TERM03 (kiosk + print agent) ─────────────
echo "[TERM03] Updating print agent..."
scp -q print-agent/agent.js print-agent/escpos.js print-agent/package.json \
  "$TERM03:$AGENT_DIR/"
ssh "$TERM03" "sudo systemctl restart riddim-print-agent && sudo systemctl restart lightdm" && \
  echo "[TERM03] Done" || echo "[TERM03] FAILED"

echo ""
echo "═══ Deploy complete ═══"
