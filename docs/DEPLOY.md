# Deployment

## Server Requirements

- Python 3
- `python3 -m pip`
- `awg`
- `ip`
- root access for runtime interface management

Install Python dependencies:

```bash
python3 -m pip install -r requirements.txt
```

## Runtime Files

AWG Manager stores persistent state in `AWG_MANAGER_DATA_DIR`:

- default: `/etc/wg-manager`
- override: set `AWG_MANAGER_DATA_DIR` in service env

Typical files:

- `${AWG_MANAGER_DATA_DIR}/clients.db`
- `${AWG_MANAGER_DATA_DIR}/api.key`
- `${AWG_MANAGER_DATA_DIR}/encryption.key`

Create the encryption key file used for startup restore:

```bash
export AWG_MANAGER_DATA_DIR="${AWG_MANAGER_DATA_DIR:-/etc/wg-manager}"
install -d -m 700 "$AWG_MANAGER_DATA_DIR"
printf '%s\n' 'YOUR_ENCRYPTION_SECRET' > "$AWG_MANAGER_DATA_DIR/encryption.key"
chmod 600 "$AWG_MANAGER_DATA_DIR/encryption.key"
```

## Manual Restore After Reboot

To restore all interfaces and peers from the database:

```bash
python3 awg_manager.py -r "${AWG_MANAGER_DATA_DIR:-/etc/wg-manager}/encryption.key"
```

This command loads the encryption secret, decrypts stored client keys, and reapplies runtime AmneziaWG state.

## Systemd Autostart

The project ships with:

- [deploy/awg-manager-restore.service](../deploy/awg-manager-restore.service)
- [deploy/awg-manager-restore.env.example](../deploy/awg-manager-restore.env.example)
- [deploy/awg-manager-api.service](../deploy/awg-manager-api.service)
- [deploy/awg-manager-api.env.example](../deploy/awg-manager-api.env.example)

## One-Command Install

For a fresh server test stand (AmneziaWG + restore + API + Web UI), run:

```bash
sudo ./scripts/install_test_stand.sh --project-dir /root/awg_manager --host 0.0.0.0 --port 8787
```

For explicit runtime isolation/profile:

```bash
sudo ./scripts/install_test_stand.sh \
  --project-dir /root/awg_manager \
  --host 0.0.0.0 \
  --port 8787 \
  --data-dir /etc/wg-manager-firewall \
  --stand-profile firewall
```

What installer fixes now:
- disables auto updates;
- holds installed kernel packages;
- pins GRUB to the running kernel via explicit `Advanced options > kernel` entry;
- enables persistent `net.ipv4.ip_forward=1`;
- installs and starts `awg-manager-api` + `awg-manager-restore`.

Generated credentials are saved to:

- `/root/key/api.key`
- `/root/key/encryption.key`

Service runtime keys (inside configured `AWG_MANAGER_DATA_DIR`):

- `${AWG_MANAGER_DATA_DIR}/api.key`
- `${AWG_MANAGER_DATA_DIR}/encryption.key`

Service env files:

- `/etc/wg-manager/awg-manager-api.env`
- `/etc/wg-manager/awg-manager-restore.env`

View keys:

```bash
cat /root/key/api.key
cat /root/key/encryption.key
```

Regenerate keys:

```bash
export AWG_MANAGER_DATA_DIR="${AWG_MANAGER_DATA_DIR:-/etc/wg-manager}"
install -d -m 700 /root/key "$AWG_MANAGER_DATA_DIR"
python3 - <<'PY'
import secrets, pathlib
api = secrets.token_hex(32)
enc = secrets.token_hex(32)
pathlib.Path('/root/key/api.key').write_text(api + '\n')
pathlib.Path('/root/key/encryption.key').write_text(enc + '\n')
print('API_KEY=', api)
print('ENC_KEY=', enc)
PY
cp /root/key/api.key "$AWG_MANAGER_DATA_DIR/api.key"
cp /root/key/encryption.key "$AWG_MANAGER_DATA_DIR/encryption.key"
chmod 600 /root/key/api.key /root/key/encryption.key "$AWG_MANAGER_DATA_DIR/api.key" "$AWG_MANAGER_DATA_DIR/encryption.key"
systemctl restart awg-manager-api.service awg-manager-restore.service
```

## Web UI Artifacts

`webui/dist` is stored in the repository for quick deployment.
This allows `/ui/` to work immediately after install.

Rebuild only after frontend changes:

```bash
cd webui
npm install
npm run build
```

If build fails due old Node runtime, upgrade first (Node 20+ recommended):

```bash
npm install -g n
n 20
hash -r
node -v
```

Copy the service file:

```bash
cp deploy/awg-manager-restore.service /etc/systemd/system/awg-manager-restore.service
```

Create the environment file:

```bash
cp deploy/awg-manager-restore.env.example /etc/wg-manager/awg-manager-restore.env
chmod 600 /etc/wg-manager/awg-manager-restore.env
```

If your project is installed outside `/opt/awg_manager`, edit `WorkingDirectory` and `ExecStart` in the service file before enabling it.

Enable and start:

```bash
systemctl daemon-reload
systemctl enable awg-manager-restore.service
systemctl start awg-manager-restore.service
```

Check status:

```bash
systemctl status awg-manager-restore.service
journalctl -u awg-manager-restore.service -n 100
```

## API Startup

Start the API manually:

```bash
python3 api_core.py 0.0.0.0 8787 -r "${AWG_MANAGER_DATA_DIR:-/etc/wg-manager}/encryption.key"
```

Requests must include:

- `X-API-Key`

Detailed route documentation is available in [API.md](API.md).

## Parallel Streams (Firewall + IPsec)

Recommended model:

- separate local worktrees/branches per stream (`codex-firewall-*`, `codex-ipsec-*`);
- separate stands for firewall and ipsec;
- explicit stand role marker in env: `AWG_MANAGER_STAND_PROFILE=firewall|ipsec`.

If multiple instances are colocated on one host, use unique:

- API ports;
- `AWG_MANAGER_DATA_DIR` values.

## Post-Reboot Verification (Recommended)

After reboot, verify runtime state:

```bash
uname -r
lsmod | grep -E '^amneziawg' || true
systemctl is-active awg-manager-api.service awg-manager-restore.service
sysctl -n net.ipv4.ip_forward
```

For known stand issues and exact fixes, see:
- [STAND_SETUP_FIXES.md](STAND_SETUP_FIXES.md)

For branch/worktree/stand orchestration across Firewall and IPsec streams, see:
- [PARALLEL_DEVELOPMENT.md](PARALLEL_DEVELOPMENT.md)
