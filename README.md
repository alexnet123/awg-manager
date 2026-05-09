# AWG Manager

AWG Manager is a management tool for AmneziaWG (AWG) interfaces and clients with:

- CLI
- HTTP API
- Web UI (`/ui/`)
- client `.conf` + QR generation
- AWG v1/v2 parameter support

## Project Structure

- `awg_core.py` — core logic (DB, crypto, runtime, CRUD services)
- `awg_manager.py` — CLI entrypoint
- `awg_api.py` — API + static UI server
- `webui/` — React/Vite frontend
- `docs/API.md` — API reference
- `docs/DEPLOY.md` — deployment/systemd notes

## Requirements

- Python 3.9+
- `awg` binary
- `ip` (`iproute2`)
- root privileges for runtime interface operations

Install Python dependencies:

```bash
python3 -m pip install -r requirements.txt
```

## Run

### CLI

```bash
python3 awg_manager.py
```

Restore runtime from DB:

```bash
python3 awg_manager.py -r /etc/wg-manager/encryption.key
```

### API

```bash
python3 awg_api.py 0.0.0.0 8787 -r /etc/wg-manager/encryption.key
```

Open Web UI:

```text
http://SERVER_IP:8787/ui/
```

## Authentication

API uses one header:

- `X-API-Key`

Key source:

- `/etc/wg-manager/api.key` (or env `AWG_MANAGER_API_KEY`)

## AWG Versions

- `v1`: `Jc Jmin Jmax S1 S2 H1 H2 H3 H4`
- `v2`: `v1 + S3 S4 I1 I2 I3 I4 I5`

`v2` defaults are generated automatically, including dynamic `H1-H4` ranges.

## Web UI Build

```bash
cd webui
npm install
npm run build
```

## Tests

### API contract tests

```bash
python3 -m pip install -r requirements-dev.txt
pytest -q tests/test_api_contract.py
```

### UI E2E (Playwright)

```bash
cd webui
npm install
npx playwright install chromium
PLAYWRIGHT_BASE_URL="http://127.0.0.1:8787/ui/" \
PLAYWRIGHT_API_KEY="YOUR_API_KEY" \
npm run test:e2e
```

Notes:

- `globalSetup` cleans interfaces/clients before each run.
- `auth-rotate` scenario is skipped by default.

## Documentation

- [API reference](docs/API.md)
- [Deployment guide](docs/DEPLOY.md)

## Deployment

See:

- `docs/DEPLOY.md`
- `deploy/awg-manager-api.service`
- `deploy/awg-manager-restore.service`

Quick test stand install:

```bash
sudo ./scripts/install_test_stand.sh --project-dir /root/awg_manager --host 0.0.0.0 --port 8787
```

## Prepare and Push to GitHub

Repository target:

`https://github.com/alexnet123/awg-manager.git`

If current folder has no `.git`:

```bash
cd awg_manager
git init
git branch -M main
git remote add origin https://github.com/alexnet123/awg-manager.git
git add .
git commit -m "Refactor AWG manager: API/UI/tests/docs update"
git push -u origin main
```

If remote already has history:

```bash
git pull --rebase origin main
git push
```
