# Stand Setup Fixes Log

This document captures real issues we hit while installing test stands and the exact fixes we applied.

## 2026-05-22 — Kernel Pinning Drift After Reboot

### Symptom
- Server rebooted into a newer kernel (`5.10.0-43-amd64`) instead of AWG-tested kernel (`5.10.0-32-amd64`).

### Root Cause
- GRUB behavior on cloud image + mixed defaults (`GRUB_DEFAULT=0` / `saved`) allowed boot selection drift.

### Fix
- In installer, pin GRUB to explicit menu path:
  - `GRUB_DEFAULT="Advanced options for Debian GNU/Linux>Debian GNU/Linux, with Linux <running-kernel>"`
  - `GRUB_SAVEDEFAULT=false`
- Keep kernel packages on hold.
- Run `update-grub`.

### Verification
```bash
uname -r
grub-editenv list
apt-mark showhold | grep -E 'linux-image|linux-headers'
```

## 2026-05-22 — UI Served Old Frontend Bundle

### Symptom
- `/ui/` opened, but showed outdated frontend behavior.

### Root Cause
- Stale `webui/dist` was being served by API service.

### Fix
- Rebuild frontend and restart API service:
```bash
cd /root/awg-manager/webui
npm install
npm run build
systemctl restart awg-manager-api.service
```

### Verification
```bash
curl -s http://127.0.0.1:8787/ui/ | grep -E 'assets/index-.*\\.(js|css)'
```
- Then hard-refresh browser (`Ctrl+Shift+R`).

## 2026-05-22 — Frontend Build Failed on Node 12

### Symptom
- `npm run build` failed (`tsc` syntax/engine errors).

### Root Cause
- Server had old runtime (`node v12`), while project toolchain requires newer Node.

### Fix
- Upgrade Node to 20 and rebuild:
```bash
npm install -g n
n 20
hash -r
node -v
npm -v
cd /root/awg-manager/webui
npm run build
```

## 2026-05-22 — Restore Service Dependency Issue

### Symptom
- Restore startup initially failed or logged runtime restore errors.

### Root Cause
- Missing runtime dependency (`nftables`) on fresh stand.

### Fix
```bash
apt-get update -y
apt-get install -y nftables
systemctl restart awg-manager-restore.service
```

### Verification
```bash
systemctl is-active awg-manager-restore.service
journalctl -u awg-manager-restore.service -n 100 --no-pager
```

