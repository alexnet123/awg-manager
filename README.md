# AWG Manager

AWG Manager is a management toolkit for AmneziaWG:

- CLI
- HTTP API
- Web UI (`/ui/`)
- Firewall tab (nftables rule manager)
- client `.conf` and QR export
- AWG v1 + v2 support (v2 by default)

Russian README: [README.ru.md](README.ru.md)

## 10-Minute Deploy

```bash
git clone https://github.com/alexnet123/awg-manager.git
cd awg-manager
sudo ./scripts/install_test_stand.sh --project-dir /root/awg-manager --host 0.0.0.0 --port 8787
```

Then open:

`http://SERVER_IP:8787/ui/`

Credentials:

- API key: `/root/key/api.key`
- Encryption key: `/root/key/encryption.key`

Server runtime copies (used by services):

- API key: `/etc/wg-manager/api.key`
- Encryption key: `/etc/wg-manager/encryption.key`

## Keys: View and Regenerate

Show current keys:

```bash
cat /root/key/api.key
cat /root/key/encryption.key
```

Regenerate both keys:

```bash
install -d -m 700 /root/key /etc/wg-manager
python3 - <<'PY'
import secrets, pathlib
api = secrets.token_hex(32)
enc = secrets.token_hex(32)
pathlib.Path('/root/key/api.key').write_text(api + '\n')
pathlib.Path('/root/key/encryption.key').write_text(enc + '\n')
print('API_KEY=', api)
print('ENC_KEY=', enc)
PY
cp /root/key/api.key /etc/wg-manager/api.key
cp /root/key/encryption.key /etc/wg-manager/encryption.key
chmod 600 /root/key/api.key /root/key/encryption.key /etc/wg-manager/api.key /etc/wg-manager/encryption.key
systemctl restart awg-manager-api.service awg-manager-restore.service
```

## Important UI Note

`webui/dist` is committed in the repository for fast deployments.
So `/ui/` works right after install, without extra frontend build steps.

Rebuild UI only when you change frontend code:

```bash
cd webui
npm install
npm run build
```

## Requirements

- Python 3.9+
- `awg` + `ip` binaries
- root privileges

Install dependencies:

```bash
python3 -m pip install -r requirements.txt
```

## Main Commands

CLI:

```bash
python3 awg_manager.py
```

Restore runtime after reboot:

```bash
python3 awg_manager.py -r /etc/wg-manager/encryption.key
```

API:

```bash
python3 api_core.py 0.0.0.0 8787 -r /etc/wg-manager/encryption.key
```

## Auth

Use header:

- `X-API-Key`

Source:

- `/etc/wg-manager/api.key`
- or env `AWG_MANAGER_API_KEY`

## AWG Versions

- v1: `Jc Jmin Jmax S1 S2 H1 H2 H3 H4`
- v2: `v1 + S3 S4 I1 I2 I3 I4 I5`

## Docs

- [docs/API.md](docs/API.md)
- [docs/DEPLOY.md](docs/DEPLOY.md)
- [docs/STAND_SETUP_FIXES.md](docs/STAND_SETUP_FIXES.md) (stand setup issues and fixes log)
- [docs/README.md](docs/README.md) (full docs index)
- [docs/development/README.md](docs/development/README.md) (development docs index: module ownership and refactor rules)
- [docs/development/MODULE_MAP.md](docs/development/MODULE_MAP.md) (module ownership map, EN)
- [docs/development/MODULE_MAP.ru.md](docs/development/MODULE_MAP.ru.md) (module ownership map, RU)
- [docs/TESTS_CATALOG.ru.md](docs/TESTS_CATALOG.ru.md) (complete tests catalog, RU)
