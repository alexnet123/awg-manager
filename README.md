# AWG Manager

AWG Manager is a management toolkit for AmneziaWG:

- CLI
- HTTP API
- Web UI (`/ui/`)
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
python3 awg_api.py 0.0.0.0 8787 -r /etc/wg-manager/encryption.key
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
