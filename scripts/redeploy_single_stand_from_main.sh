#!/usr/bin/env bash
set -euo pipefail

# Redeploy single stand from local git branch "main".
#
# This script is intended for final release rollout:
# - packages code from local main branch (git archive)
# - uploads archive to remote stand
# - optionally cleans stand data directory
# - deploys systemd units and starts single API instance
#
# Example:
#   scripts/redeploy_single_stand_from_main.sh \
#     --target root@132.243.237.120 \
#     --project-dir /root/awg-manager \
#     --data-dir /etc/wg-manager \
#     --port 8787 \
#     --clean-data

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

TARGET=""
PROJECT_DIR="/root/awg-manager"
DATA_DIR="/etc/wg-manager"
LISTEN_HOST="0.0.0.0"
LISTEN_PORT="8787"
STAND_PROFILE="firewall"
CLEAN_DATA=0
ALLOW_DIRTY=0
SKIP_DEPENDENCIES=0
SKIP_SMOKE=0

usage() {
  cat <<'USAGE'
redeploy_single_stand_from_main.sh --target USER@HOST [options]

Required:
  --target USER@HOST        SSH target (root access expected)

Options:
  --project-dir DIR         Remote project directory (default: /root/awg-manager)
  --data-dir DIR            Remote data directory (default: /etc/wg-manager)
  --host HOST               API listen host (default: 0.0.0.0)
  --port PORT               API listen port (default: 8787)
  --stand-profile PROFILE   AWG_MANAGER_STAND_PROFILE (default: firewall)
  --clean-data              Wipe remote data directory before deploy
  --allow-dirty             Allow running when local working tree is dirty
  --skip-dependencies       Skip pip install -r requirements.txt on remote
  --skip-smoke              Skip post-deploy health/firewall apply smoke
  -h, --help                Show help

Notes:
  - Code is always packaged from local branch "main".
  - This script does not push git changes. Push/merge must be completed first.
USAGE
}

log() { printf '[%s] %s\n' "$(date -Is)" "$*"; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target) TARGET="${2:-}"; shift 2 ;;
    --project-dir) PROJECT_DIR="${2:-}"; shift 2 ;;
    --data-dir) DATA_DIR="${2:-}"; shift 2 ;;
    --host) LISTEN_HOST="${2:-}"; shift 2 ;;
    --port) LISTEN_PORT="${2:-}"; shift 2 ;;
    --stand-profile) STAND_PROFILE="${2:-}"; shift 2 ;;
    --clean-data) CLEAN_DATA=1; shift ;;
    --allow-dirty) ALLOW_DIRTY=1; shift ;;
    --skip-dependencies) SKIP_DEPENDENCIES=1; shift ;;
    --skip-smoke) SKIP_SMOKE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage; exit 2 ;;
  esac
done

if [[ -z "$TARGET" ]]; then
  echo "ERROR: --target is required" >&2
  usage
  exit 2
fi

if ! command -v git >/dev/null 2>&1; then
  echo "ERROR: git is required" >&2
  exit 1
fi
if ! command -v ssh >/dev/null 2>&1; then
  echo "ERROR: ssh is required" >&2
  exit 1
fi
if ! command -v scp >/dev/null 2>&1; then
  echo "ERROR: scp is required" >&2
  exit 1
fi

if ! git -C "$REPO_ROOT" rev-parse --verify main >/dev/null 2>&1; then
  echo "ERROR: local branch 'main' not found in $REPO_ROOT" >&2
  exit 1
fi

if [[ "$ALLOW_DIRTY" -ne 1 ]] && [[ -n "$(git -C "$REPO_ROOT" status --porcelain)" ]]; then
  echo "ERROR: working tree is dirty. Commit/stash changes or pass --allow-dirty." >&2
  exit 1
fi

TMP_ARCHIVE="$(mktemp /tmp/awg-main-release.XXXXXX.tgz)"
REMOTE_ARCHIVE="/tmp/awg-main-release.tgz"
trap 'rm -f "$TMP_ARCHIVE"' EXIT

log "Packaging local branch main"
git -C "$REPO_ROOT" archive --format=tar.gz --output="$TMP_ARCHIVE" main

log "Uploading archive to $TARGET:$REMOTE_ARCHIVE"
scp "$TMP_ARCHIVE" "$TARGET:$REMOTE_ARCHIVE"

log "Deploying on remote host"
ssh "$TARGET" \
  "PROJECT_DIR='$PROJECT_DIR' DATA_DIR='$DATA_DIR' LISTEN_HOST='$LISTEN_HOST' LISTEN_PORT='$LISTEN_PORT' STAND_PROFILE='$STAND_PROFILE' CLEAN_DATA='$CLEAN_DATA' SKIP_DEPENDENCIES='$SKIP_DEPENDENCIES' SKIP_SMOKE='$SKIP_SMOKE' REMOTE_ARCHIVE='$REMOTE_ARCHIVE' bash -s" <<'REMOTE'
set -euo pipefail

log() { printf '[%s] %s\n' "$(date -Is)" "$*"; }

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "ERROR: remote deploy must run as root" >&2
  exit 1
fi

BACKUP_ROOT="/root/awg-stand-backup-$(date +%Y%m%d-%H%M%S)"
log "Creating backup at ${BACKUP_ROOT}"
mkdir -p "$BACKUP_ROOT"

if [[ -d "$PROJECT_DIR" ]]; then
  cp -a "$PROJECT_DIR" "${BACKUP_ROOT}/project" || true
fi
if [[ -d /etc/wg-manager ]]; then
  cp -a /etc/wg-manager "${BACKUP_ROOT}/wg-manager-env" || true
fi
if [[ -d "$DATA_DIR" ]]; then
  cp -a "$DATA_DIR" "${BACKUP_ROOT}/data-dir" || true
fi

log "Stopping optional validation services (if present)"
systemctl disable --now awg-manager-api-ipsec.service awg-manager-restore-ipsec.service >/dev/null 2>&1 || true

log "Stopping main services"
systemctl stop awg-manager-api.service awg-manager-restore.service >/dev/null 2>&1 || true

log "Deploying project to ${PROJECT_DIR}"
rm -rf "$PROJECT_DIR"
mkdir -p "$PROJECT_DIR"
tar -xzf "$REMOTE_ARCHIVE" -C "$PROJECT_DIR"

if [[ "$SKIP_DEPENDENCIES" != "1" ]]; then
  log "Installing Python dependencies"
  cd "$PROJECT_DIR"
  python3 -m pip install -r requirements.txt
fi

log "Preparing data directory ${DATA_DIR}"
mkdir -p "$DATA_DIR"
chmod 700 "$DATA_DIR"

if [[ "$CLEAN_DATA" == "1" ]]; then
  log "Cleaning data directory"
  find "$DATA_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
fi

if [[ ! -f "${DATA_DIR}/api.key" ]]; then
  python3 - <<'PY'
import secrets, pathlib, os
data_dir = pathlib.Path(os.environ["DATA_DIR"])
data_dir.mkdir(parents=True, exist_ok=True)
(data_dir / "api.key").write_text(secrets.token_hex(32) + "\n", encoding="utf-8")
PY
fi
if [[ ! -f "${DATA_DIR}/encryption.key" ]]; then
  python3 - <<'PY'
import secrets, pathlib, os
data_dir = pathlib.Path(os.environ["DATA_DIR"])
data_dir.mkdir(parents=True, exist_ok=True)
(data_dir / "encryption.key").write_text(secrets.token_hex(32) + "\n", encoding="utf-8")
PY
fi
chmod 600 "${DATA_DIR}/api.key" "${DATA_DIR}/encryption.key"

log "Writing runtime env files"
mkdir -p /etc/wg-manager
cat > /etc/wg-manager/awg-manager-api.env <<EOF
AWG_MANAGER_STAND_PROFILE=${STAND_PROFILE}
AWG_MANAGER_DATA_DIR=${DATA_DIR}
AWG_MANAGER_ENCRYPTION_KEY_FILE=${DATA_DIR}/encryption.key
EOF
cat > /etc/wg-manager/awg-manager-restore.env <<EOF
AWG_MANAGER_STAND_PROFILE=${STAND_PROFILE}
AWG_MANAGER_DATA_DIR=${DATA_DIR}
AWG_MANAGER_ENCRYPTION_KEY_FILE=${DATA_DIR}/encryption.key
EOF
chmod 600 /etc/wg-manager/awg-manager-api.env /etc/wg-manager/awg-manager-restore.env

log "Installing systemd units"
cp "${PROJECT_DIR}/deploy/awg-manager-api.service" /etc/systemd/system/awg-manager-api.service
cp "${PROJECT_DIR}/deploy/awg-manager-restore.service" /etc/systemd/system/awg-manager-restore.service
sed -i "s#^WorkingDirectory=.*#WorkingDirectory=${PROJECT_DIR}#" /etc/systemd/system/awg-manager-api.service
sed -i "s#^ExecStart=.*#ExecStart=/usr/bin/python3 ${PROJECT_DIR}/api_core.py ${LISTEN_HOST} ${LISTEN_PORT} -r \${AWG_MANAGER_ENCRYPTION_KEY_FILE}#" /etc/systemd/system/awg-manager-api.service
sed -i "s#^WorkingDirectory=.*#WorkingDirectory=${PROJECT_DIR}#" /etc/systemd/system/awg-manager-restore.service
sed -i "s#^ExecStart=.*#ExecStart=/usr/bin/python3 ${PROJECT_DIR}/awg_manager.py -r \${AWG_MANAGER_ENCRYPTION_KEY_FILE}#" /etc/systemd/system/awg-manager-restore.service
systemctl daemon-reload

log "Starting services"
systemctl enable --now awg-manager-restore.service
systemctl enable --now awg-manager-api.service

if [[ "$SKIP_SMOKE" != "1" ]]; then
  API_KEY="$(cat "${DATA_DIR}/api.key")"
  log "Health check"
  curl -fsS -H "X-API-Key: ${API_KEY}" "http://127.0.0.1:${LISTEN_PORT}/health" >/dev/null
  log "Firewall apply smoke"
  curl -fsS -X POST -H "X-API-Key: ${API_KEY}" -H "Content-Type: application/json" --data '{}' "http://127.0.0.1:${LISTEN_PORT}/firewall/apply" >/dev/null
fi

log "Deployment complete"
REMOTE

log "Done"
