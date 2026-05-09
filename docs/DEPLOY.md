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

AWG Manager stores persistent state in:

- `/etc/wg-manager/clients.db`
- `/etc/wg-manager/api.key`

Create the encryption key file used for startup restore:

```bash
install -d -m 700 /etc/wg-manager
printf '%s\n' 'YOUR_ENCRYPTION_SECRET' > /etc/wg-manager/encryption.key
chmod 600 /etc/wg-manager/encryption.key
```

## Manual Restore After Reboot

To restore all interfaces and peers from the database:

```bash
python3 awg_manager.py -r /etc/wg-manager/encryption.key
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

Generated credentials are saved to:

- `/root/key/api.key`
- `/root/key/encryption.key`

Service runtime keys:

- `/etc/wg-manager/api.key`
- `/etc/wg-manager/encryption.key`

View keys:

```bash
cat /root/key/api.key
cat /root/key/encryption.key
```

Regenerate keys:

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

## Web UI Artifacts

`webui/dist` is stored in the repository for quick deployment.
This allows `/ui/` to work immediately after install.

Rebuild only after frontend changes:

```bash
cd webui
npm install
npm run build
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
python3 api_core.py 0.0.0.0 8787 -r /etc/wg-manager/encryption.key
```

Requests must include:

- `X-API-Key`

Detailed route documentation is available in [API.md](API.md).
