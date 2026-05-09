#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR_DEFAULT="/opt/awg_manager"
LISTEN_HOST_DEFAULT="0.0.0.0"
LISTEN_PORT_DEFAULT="8787"

usage() {
  cat <<'USAGE'
install_test_stand.sh [--project-dir DIR] [--host HOST] [--port PORT]

Installs a test stand on Debian/Ubuntu-like systems:
- installs AmneziaWG kernel module + tools via the official repo instructions
- installs Python dependencies from requirements.txt
- generates API/encryption keys into /root/key
- configures /etc/wg-manager/{api.key,encryption.key}
- installs and starts systemd services:
  - awg-manager-restore.service (restore after reboot)
  - awg-manager-api.service (API + Web UI)

Examples:
  ./scripts/install_test_stand.sh
  ./scripts/install_test_stand.sh --project-dir /root/awg_manager --port 8787
USAGE
}

require_root() {
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    echo "ERROR: must run as root" >&2
    exit 1
  fi
}

log() { printf '[%s] %s\n' "$(date -Is)" "$*"; }

rand_token() {
  # 32 bytes -> 64 hex chars
  python3 - <<'PY'
import secrets
print(secrets.token_hex(32))
PY
}

apt_update_or_fix_backports() {
  # Some hosts ship with stale backports entries that can break apt-get update.
  if apt-get update -y; then
    return 0
  fi
  if [[ -f /etc/apt/sources.list.d/backports.list ]]; then
    log "Disabling /etc/apt/sources.list.d/backports.list (apt-get update failed)"
    mv /etc/apt/sources.list.d/backports.list /etc/apt/sources.list.d/backports.list.disabled || true
  fi
  apt-get update -y
}

install_amneziawg_debian_like() {
  if command -v awg >/dev/null 2>&1; then
    log "amneziawg tools already present (awg found), skipping install"
    return
  fi

  log "Installing AmneziaWG (Debian/Ubuntu method)"
  export DEBIAN_FRONTEND=noninteractive
  apt_update_or_fix_backports
  apt-get install -y software-properties-common python3-launchpadlib gnupg2 "linux-headers-$(uname -r)"

  # Key + repo lines follow the official instructions.
  apt-key adv --keyserver keyserver.ubuntu.com --recv-keys 57290828
  echo "deb https://ppa.launchpadcontent.net/amnezia/ppa/ubuntu focal main" >> /etc/apt/sources.list
  echo "deb-src https://ppa.launchpadcontent.net/amnezia/ppa/ubuntu focal main" >> /etc/apt/sources.list
  apt_update_or_fix_backports
  apt-get install -y amneziawg
}

ensure_awg_module_for_running_kernel() {
  local running_kernel
  running_kernel="$(uname -r)"
  log "Ensuring AWG module for running kernel: ${running_kernel}"

  apt_update_or_fix_backports
  apt-get install -y "linux-headers-${running_kernel}" dkms || true
  dkms autoinstall || true

  if ! modprobe amneziawg 2>/dev/null; then
    log "WARN: modprobe amneziawg failed for kernel ${running_kernel}"
  fi

  # Ensure module auto-load on next boots.
  install -d -m 755 /etc/modules-load.d
  printf 'amneziawg\n' > /etc/modules-load.d/amneziawg.conf
}

ensure_python_deps() {
  log "Installing Python dependencies"
  apt_update_or_fix_backports
  apt-get install -y python3 python3-pip
  python3 -m pip install -r requirements.txt
}

disable_auto_updates() {
  log "Disabling apt auto-updates (apt-daily timers + periodic config)"
  systemctl disable --now apt-daily.timer apt-daily-upgrade.timer >/dev/null 2>&1 || true
  systemctl mask apt-daily.service apt-daily-upgrade.service apt-daily.timer apt-daily-upgrade.timer >/dev/null 2>&1 || true

  mkdir -p /etc/apt/apt.conf.d
  cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "0";
APT::Periodic::Unattended-Upgrade "0";
EOF
  cat > /etc/apt/apt.conf.d/10periodic <<'EOF'
APT::Periodic::Enable "0";
APT::Periodic::Download-Upgradeable-Packages "0";
APT::Periodic::AutocleanInterval "0";
EOF
}

pin_running_kernel() {
  local running_kernel base_ver saved_entry
  running_kernel="$(uname -r)"
  base_ver="${running_kernel%-amd64}"

  log "Pinning running kernel: ${running_kernel}"
  apt-mark hold \
    "linux-image-amd64" \
    "linux-image-${running_kernel}" \
    "linux-headers-${running_kernel}" \
    "linux-headers-${base_ver}-common" \
    >/dev/null 2>&1 || true

  # Hold all currently installed kernel image/header packages to avoid
  # silent boot switch to another kernel after unattended package changes.
  mapfile -t installed_kernel_pkgs < <(
    dpkg-query -W -f='${Package}\n' \
      'linux-image-[0-9]*-amd64' \
      'linux-headers-[0-9]*-amd64' \
      'linux-headers-[0-9]*-common' 2>/dev/null || true
  )
  if [[ ${#installed_kernel_pkgs[@]} -gt 0 ]]; then
    apt-mark hold "${installed_kernel_pkgs[@]}" >/dev/null 2>&1 || true
  fi

  # Persist kernel choice for next boot. Prefer entry id if we can find it.
  if [[ -f /boot/grub/grub.cfg ]]; then
    saved_entry="$(grep -m1 "with Linux ${running_kernel}'" /boot/grub/grub.cfg | sed -n "s/.*menuentry_id_option '\([^']*\)'.*/\1/p")"
    if [[ -n "${saved_entry:-}" ]]; then
      if ! grep -q '^GRUB_DEFAULT=saved' /etc/default/grub 2>/dev/null; then echo 'GRUB_DEFAULT=saved' >> /etc/default/grub; fi
      if ! grep -q '^GRUB_SAVEDEFAULT=true' /etc/default/grub 2>/dev/null; then echo 'GRUB_SAVEDEFAULT=true' >> /etc/default/grub; fi
      update-grub >/dev/null 2>&1 || true
      grub-set-default "${saved_entry}" >/dev/null 2>&1 || true
      log "GRUB saved_entry set: ${saved_entry}"
    else
      log "WARN: could not detect GRUB entry id for ${running_kernel}; kernel is held but GRUB default was not changed"
    fi
  else
    log "WARN: /boot/grub/grub.cfg not found; kernel is held but GRUB default was not changed"
  fi
}

install_systemd_units() {
  log "Installing systemd unit files"
  cp deploy/awg-manager-restore.service /etc/systemd/system/awg-manager-restore.service
  cp deploy/awg-manager-api.service /etc/systemd/system/awg-manager-api.service

  install -d -m 700 /etc/wg-manager
  cp deploy/awg-manager-restore.env.example /etc/wg-manager/awg-manager-restore.env
  cp deploy/awg-manager-api.env.example /etc/wg-manager/awg-manager-api.env
  chmod 600 /etc/wg-manager/awg-manager-restore.env /etc/wg-manager/awg-manager-api.env

  systemctl daemon-reload
}

configure_keys() {
  log "Generating keys into /root/key and configuring /etc/wg-manager"
  install -d -m 700 /root/key
  chmod 700 /root/key
  install -d -m 700 /etc/wg-manager

  local api_token encryption_secret
  api_token="$(rand_token)"
  encryption_secret="$(rand_token)"

  printf '%s\n' "$api_token" > /root/key/api.key
  printf '%s\n' "$encryption_secret" > /root/key/encryption.key
  chmod 600 /root/key/api.key /root/key/encryption.key

  cp /root/key/api.key /etc/wg-manager/api.key
  cp /root/key/encryption.key /etc/wg-manager/encryption.key
  chmod 600 /etc/wg-manager/api.key /etc/wg-manager/encryption.key
}

configure_ip_forward() {
  log "Enabling persistent IPv4 forwarding"
  mkdir -p /etc/sysctl.d
  cat > /etc/sysctl.d/99-awg-manager.conf <<'EOF'
net.ipv4.ip_forward=1
EOF
  sysctl -w net.ipv4.ip_forward=1 >/dev/null
  sysctl --system >/dev/null 2>&1 || true
}

enable_services() {
  log "Enabling services"
  systemctl enable --now awg-manager-restore.service
  systemctl enable --now awg-manager-api.service
}

main() {
  require_root

  local project_dir="$PROJECT_DIR_DEFAULT"
  local listen_host="$LISTEN_HOST_DEFAULT"
  local listen_port="$LISTEN_PORT_DEFAULT"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --project-dir) project_dir="${2:-}"; shift 2;;
      --host) listen_host="${2:-}"; shift 2;;
      --port) listen_port="${2:-}"; shift 2;;
      -h|--help) usage; exit 0;;
      *) echo "Unknown arg: $1" >&2; usage; exit 2;;
    esac
  done

  if [[ ! -f "$project_dir/api_core.py" ]]; then
    log "Project dir doesn't look like an AWG Manager checkout: $project_dir"
    log "Hint: upload the repo to $project_dir first"
    exit 2
  fi

  cd "$project_dir"

  install_amneziawg_debian_like
  ensure_awg_module_for_running_kernel
  ensure_python_deps
  configure_keys

  # Make systemd units point to the chosen project dir and listen host/port.
  install_systemd_units
  sed -i "s|WorkingDirectory=/opt/awg_manager|WorkingDirectory=${project_dir}|g" /etc/systemd/system/awg-manager-api.service
  sed -i "s|/opt/awg_manager/api_core.py|${project_dir}/api_core.py|g" /etc/systemd/system/awg-manager-api.service
  sed -i "s|/opt/awg_manager/awg_manager.py|${project_dir}/awg_manager.py|g" /etc/systemd/system/awg-manager-restore.service
  sed -i "s|WorkingDirectory=/opt/awg_manager|WorkingDirectory=${project_dir}|g" /etc/systemd/system/awg-manager-restore.service

  # Update listen host/port.
  sed -i "s|/usr/bin/python3 .* api_core.py 0.0.0.0 8787 -r|/usr/bin/python3 ${project_dir}/api_core.py ${listen_host} ${listen_port} -r|g" /etc/systemd/system/awg-manager-api.service

  systemctl daemon-reload
  disable_auto_updates
  pin_running_kernel
  configure_ip_forward
  enable_services

  log "Done."
  log "UI: http://${listen_host}:${listen_port}/ui/ (if listen_host is 0.0.0.0, use the server IP)"
  log "API token file: /root/key/api.key"
  log "Encryption key file: /root/key/encryption.key"
}

main "$@"
