#!/usr/bin/env bash
set -euo pipefail

# Reboot smoke test for AWG Manager server.
# Usage:
#   scripts/reboot_smoke.sh root@132.243.237.120 60
# Args:
#   $1 - SSH target (default: root@127.0.0.1)
#   $2 - Wait timeout seconds after reboot command (default: 90)

TARGET="${1:-root@127.0.0.1}"
WAIT_SECS="${2:-90}"

echo "[1/6] capture pre-reboot state"
PRE_COUNTS=$(ssh "$TARGET" "python3 - <<'PY'
import sqlite3
db='/etc/wg-manager/clients.db'
conn=sqlite3.connect(db); c=conn.cursor()
ifs=c.execute('select count(*) from wg_interfaces').fetchone()[0]
cls=c.execute('select count(*) from clients').fetchone()[0]
print(f'{ifs},{cls}')
conn.close()
PY")
echo "pre: $PRE_COUNTS"

echo "[2/6] verify services before reboot"
ssh "$TARGET" "systemctl is-active awg-manager-api.service awg-manager-restore.service"

echo "[3/6] trigger reboot"
ssh "$TARGET" "nohup bash -lc 'sleep 1; reboot' >/dev/null 2>&1 &" || true

echo "[4/6] wait for host to come back"
sleep 5
for i in $(seq 1 "$WAIT_SECS"); do
  if ssh -o ConnectTimeout=2 "$TARGET" "echo up" >/dev/null 2>&1; then
    echo "host is back in ${i}s"
    break
  fi
  sleep 1
done

echo "[5/6] verify services and runtime after reboot"
ssh "$TARGET" "systemctl is-active awg-manager-api.service awg-manager-restore.service"
ssh "$TARGET" "modprobe amneziawg; ip -o link show | grep -E ': awg' || true"

echo "[6/6] compare post-reboot DB counts"
POST_COUNTS=$(ssh "$TARGET" "python3 - <<'PY'
import sqlite3
db='/etc/wg-manager/clients.db'
conn=sqlite3.connect(db); c=conn.cursor()
ifs=c.execute('select count(*) from wg_interfaces').fetchone()[0]
cls=c.execute('select count(*) from clients').fetchone()[0]
print(f'{ifs},{cls}')
conn.close()
PY")
echo "post: $POST_COUNTS"

if [[ "$PRE_COUNTS" != "$POST_COUNTS" ]]; then
  echo "ERROR: DB counts changed across reboot: $PRE_COUNTS -> $POST_COUNTS"
  exit 1
fi

echo "OK: reboot smoke passed"
