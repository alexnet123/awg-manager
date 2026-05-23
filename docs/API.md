# AWG Manager API

## Purpose

`api_core.py` exposes HTTP API methods for managing:

- AmneziaWG interfaces
- clients
- client config download
- client QR code preview and download
- the built-in Web UI assets at `/ui/` and `/static/...`

The API uses the same core logic as the CLI and works on the same SQLite database and runtime commands.

## Authentication

Every request must include:

- `X-API-Key`
 
Authentication works as a single-key check:

- `X-API-Key` must match the API key from env var `AWG_MANAGER_API_KEY` or file `/etc/wg-manager/api.key`

If the header is missing or invalid, the API returns `401`.

## Start

Run through the CLI entrypoint:

```bash
python3 awg_manager.py --api
```

Run the API module directly:

```bash
python3 api_core.py
```

Bind custom host and port:

```bash
python3 api_core.py 0.0.0.0 8787
```

Use encryption key from file:

```bash
python3 api_core.py 127.0.0.1 8787 -r /path/to/key.txt
```

Open the browser UI on the same server:

```text
http://127.0.0.1:8787/ui/
```

Important:

- request authentication is API-key based (`X-API-Key`)
- a server reboot does not restore runtime AWG interfaces by itself
- restore is performed by `python3 awg_manager.py -r /etc/wg-manager/encryption.key`
- for automatic restore, use the systemd unit documented in [DEPLOY.md](DEPLOY.md)

## Common Headers

Example shell variables:

```bash
export AWG_API_URL="http://127.0.0.1:8787"
export AWG_API_KEY="YOUR_API_KEY"
```

Reusable headers in `curl`:

```bash
-H "X-API-Key: $AWG_API_KEY" \
```

For JSON requests also add:

```bash
-H "Content-Type: application/json"
```

## Routes

### Health

`GET /health`

Returns API status.

Example:

```bash
curl \
  -H "X-API-Key: $AWG_API_KEY" \
  "$AWG_API_URL/health"
```

### Interfaces

`GET /interfaces`

Returns all interfaces.

`GET /interfaces/{id}`

Returns one interface by id.

`POST /interfaces`

Creates an interface.

Required JSON fields:

- `wg_interface`
- `awg_version`
- `port_number`
- `wg_ip_addr`
- `wg_ip_cidr`
- `srv_ip`
- `srv_dns`

Optional JSON fields:

- `private_key`
- `public_key`
- `awg_params`

If `private_key` and `public_key` are omitted, they are generated automatically.

`PUT /interfaces/{id}`

Updates an existing interface. You may send only the fields you want to change.

`DELETE /interfaces/{id}`

Deletes an interface.

Important:

- interface deletion fails if clients are attached
- `awg_version` supports `1` and `2`
- version `1` means `Jc/Jmin/Jmax`, `S1/S2`, `H1-H4`
- version `2` means version `1` plus `S3/S4` and `I1-I5`

Create interface example:

```bash
curl -X POST "$AWG_API_URL/interfaces" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $AWG_API_KEY" \
  -d '{
    "wg_interface": "awg0",
    "awg_version": "2",
    "port_number": 51820,
    "wg_ip_addr": "10.8.0.1",
    "wg_ip_cidr": 24,
    "srv_ip": "1.2.3.4",
    "srv_dns": "1.1.1.1"
  }'
```

Create interface with explicit version 2 params:

```bash
curl -X POST "$AWG_API_URL/interfaces" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $AWG_API_KEY" \
  -d '{
    "wg_interface": "awg1",
    "awg_version": "2",
    "port_number": 51821,
    "wg_ip_addr": "10.9.0.1",
    "wg_ip_cidr": 24,
    "srv_ip": "1.2.3.4",
    "srv_dns": "1.1.1.1",
    "awg_params": {
      "S3": 20,
      "S4": 10,
      "I1": "<b 0xd100000001><rc 8><t><r 50>",
      "I2": "<r 32>"
    }
  }'
```

Update interface example:

```bash
curl -X PUT "$AWG_API_URL/interfaces/1" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $AWG_API_KEY" \
  -d '{
    "port_number": 51830,
    "srv_dns": "8.8.8.8"
  }'
```

Delete interface example:

```bash
curl -X DELETE \
  -H "X-API-Key: $AWG_API_KEY" \
  "$AWG_API_URL/interfaces/1"
```

### Clients

`GET /clients`

Returns all clients.

`GET /clients/{id}`

Returns one client by id, including decrypted private key.

`POST /clients`

Creates a client.

Required JSON fields:

- `name`
- `wg_interface`

Optional JSON fields:

- `ip`
- `privkey`
- `pubkey`

If `ip` is omitted, the next available IP is assigned automatically.

If `privkey` and `pubkey` are omitted, they are generated automatically.

`PUT /clients/{id}`

Updates an existing client.

`DELETE /clients/{id}`

Deletes a client and removes the peer from runtime config.

### Interface server config

`GET /interfaces/{id}/config`

Returns full server-side interface config preview, including attached peers.

### API Key

`POST /api-key/rotate`

Rotates the API key and returns the new value. The old API key stops working immediately.

### Firewall (nftables)

`GET /firewall`

Returns AWG Manager nftables state:

- `active` (table exists/applied)
- `rules` (stored managed rules)
- `ruleset` (text output of `nft list table inet awg_manager`)

`GET /firewall/rules?family=<family>&table=<table>`

Returns managed rules list filtered by `family` and `table`.
Examples:
- `GET /firewall/rules?family=bridge&table=br_lan`
- `GET /firewall/rules?family=inet&table=filter`

`POST /firewall/rules`

Creates one managed rule and applies rules immediately.
Rule object includes table selector: `filter | nat | raw | mangle`.
Supported fields (inet policy):
- common: `family`, `table`, `chain`, `action`, `proto`, `src`, `dst`, `in_interface`, `out_interface`, `sport`, `dport`, `ct_state`, `comment`, `enabled`
- nat: `nat_type` (`masquerade|snat|dnat|redirect`), `to_addr`, `to_port`
- raw: `notrack`
- mangle: `mark_set`, `ct_mark_set`
- extra matching/statements: `log_prefix`, `log_level`, `limit_rate` (e.g. `10/second`), `counter`

Bridge MVP (`family=bridge`, used by Firewall → Policy v2):
- base: `family`, `table`, `chain`, `action`, `enabled`, `comment`
- bridge/L2: `ibrname`, `obrname`, `ether_src`, `ether_dst`, `ether_type`, `vlan_id`
- bridge L3/L4: `proto`, `sport`, `dport`, `ct_state`
- ops: `counter`, `log_prefix`, `log_level`, `log_flags`, `log_group`, `log_snaplen`, `log_queue_threshold`

Important:
- for `family=bridge`, unsupported fields are rejected with a field-specific error.
- `action=reject` is accepted only when selected bridge chain has hook `input` or `prerouting`.
- `vlan_id` must be integer `1..4095`.
- `ether_type` must be hex/integer Ethertype (`0x0000..0xffff` or `0..65535`).
- `log_snaplen` and `log_queue_threshold` require `log_group`.
- `log_group` and `log_flags` are mutually exclusive.

`PUT /firewall/rules/{id}`

Updates rule by id and applies immediately.

`DELETE /firewall/rules/{id}`

Deletes rule by id and applies immediately.

`POST /firewall/apply`

Re-applies all stored managed rules to table `inet awg_manager`.

Example:

```bash
curl -X POST "$AWG_API_URL/api-key/rotate" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $AWG_API_KEY" \
  -d '{}'
```

Create client example:

```bash
curl -X POST "$AWG_API_URL/clients" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $AWG_API_KEY" \
  -d '{
    "name": "client1",
    "wg_interface": "awg0"
  }'
```

Update client example:

```bash
curl -X PUT "$AWG_API_URL/clients/1" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $AWG_API_KEY" \
  -d '{
    "name": "client1-renamed",
    "ip": "10.8.0.10"
  }'
```

Delete client example:

```bash
curl -X DELETE \
  -H "X-API-Key: $AWG_API_KEY" \
  "$AWG_API_URL/clients/1"
```

### Client Config

`GET /clients/{id}/config`

Returns JSON with the generated client config.

Example:

```bash
curl \
  -H "X-API-Key: $AWG_API_KEY" \
  "$AWG_API_URL/clients/1/config"
```

`GET /clients/{id}/config/download`

Downloads the generated `.conf` file.

Example:

```bash
curl \
  -H "X-API-Key: $AWG_API_KEY" \
  -o client-1.conf \
  "$AWG_API_URL/clients/1/config/download"
```

### Client QR

`GET /clients/{id}/qr?format=svg`

Returns QR code as inline SVG.

`GET /clients/{id}/qr/download?format=svg`

Downloads QR code as SVG file.

Currently supported QR format:

- `svg`

Inline QR example:

```bash
curl \
  -H "X-API-Key: $AWG_API_KEY" \
  "$AWG_API_URL/clients/1/qr?format=svg"
```

Download QR example:

```bash
curl \
  -H "X-API-Key: $AWG_API_KEY" \
  -o client-1.svg \
  "$AWG_API_URL/clients/1/qr/download?format=svg"
```

## Response Shape

Most JSON responses use one of these forms:

Success with one object:

```json
{
  "ok": true,
  "item": {}
}
```

Success with many objects:

```json
{
  "ok": true,
  "items": []
}
```

Error:

```json
{
  "ok": false,
  "error": "message"
}
```

## Notes

- The API executes the same runtime operations as the CLI, including `ip` and `awg` commands.
- Interface creation, update and deletion affect live runtime state.
- Client creation, update and deletion affect live runtime peer state.
- The API uses the same encryption secret and database as the CLI.
- Direct SVG output is generated with `segno`.

### IPsec (strongSwan/VICI)

Namespace:

- `/api/ipsec/*`

Configuration endpoints (draft storage):

- `GET /api/ipsec/peers`
- `POST /api/ipsec/peers`
- `PUT /api/ipsec/peers/{name}`
- `DELETE /api/ipsec/peers/{name}`
- `GET /api/ipsec/identities`
- `POST /api/ipsec/identities`
- `GET /api/ipsec/policies`
- `POST /api/ipsec/policies`
- `PUT /api/ipsec/policies/{name}`
- `DELETE /api/ipsec/policies/{name}`
- `GET /api/ipsec/phase1-profiles`
- `POST /api/ipsec/phase1-profiles`
- `GET /api/ipsec/phase2-proposals`
- `POST /api/ipsec/phase2-proposals`

Runtime/actions:

- `POST /api/ipsec/apply`
- `POST /api/ipsec/load/{peer}`
- `POST /api/ipsec/initiate/{policy}`
- `POST /api/ipsec/terminate/{peer}`

Read-only runtime state:

- `GET /api/ipsec/active-peers`
- `GET /api/ipsec/installed-sas`
- `GET /api/ipsec/events`

Security notes:

- Frontend never talks to VICI directly.
- PSK is not returned back after save; API returns `has_psk` marker.
- Runtime mutations are done only via explicit `Apply` or action endpoints.
