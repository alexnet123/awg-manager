# AWG Manager API

## Purpose

`api_core.py` exposes HTTP API methods for managing:

- AmneziaWG interfaces
- clients
- client config download
- client QR code preview and download
- desired NTP/Chrony configuration and read-only config preview
- the built-in Web UI assets at `/ui/` and `/static/...`

The API uses the same core logic as the CLI and works on the same SQLite database and runtime commands.

## Authentication

Every request must include:

- `X-API-Key`
 
Authentication works as a single-key check:

- `X-API-Key` must match the API key from env var `AWG_MANAGER_API_KEY` or file `${AWG_MANAGER_DATA_DIR}/api.key`

Runtime env defaults:

- `AWG_MANAGER_DATA_DIR=/etc/wg-manager`
- `AWG_MANAGER_STAND_PROFILE=firewall`

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
- restore is performed by `python3 awg_manager.py -r ${AWG_MANAGER_DATA_DIR}/encryption.key`
- for automatic restore, use the systemd unit documented in [DEPLOY.md](../operations/DEPLOY.md)

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

Returns API status and a lightweight device snapshot for the operator header:

- `system.cpu.percent` — CPU usage from `/proc/stat` delta, or `null` until a second sample exists
- `system.cpu.load_average_1m` and `system.cpu.cores` — host load context
- `system.memory.percent`, `used_bytes`, `available_bytes`, `total_bytes` — RAM usage from `/proc/meminfo`
- `system.uptime_seconds` — host uptime from `/proc/uptime`

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

`POST /interfaces/{id}/disable`

Marks an interface as disabled and removes it from runtime.

`POST /interfaces/{id}/enable`

Marks an interface as enabled, applies it to runtime, and restores enabled peers.

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

`POST /clients/{id}/disable`

Marks a peer as disabled and removes it from the runtime AWG interface.

`POST /clients/{id}/enable`

Marks a peer as enabled and adds it back to the runtime AWG interface.

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

`GET /firewall/objects?family=<family>&table=<table>`

Returns named nft objects available in selected table:
- `counter`
- `limit`
- `quota`
- `ct_helper`
- `ct_timeout`
- `ct_expectation` (for `bridge` currently planned/disabled)
- `items` (managed objects persisted by AWG Manager for this table/family)

Example:
- `GET /firewall/objects?family=bridge&table=br_lan`

`POST /firewall/objects`

Creates/updates one managed named object and applies rules immediately.

Required common fields:
- `kind` (`counter|limit|quota|ct_helper|ct_timeout|ct_expectation`)
- `family`
- `table`
- `name`

Optional common fields:
- `enabled` (default `true`)
- `comment`

Kind-specific payload:
- `counter`: `packets`, `bytes`
- `limit`: `rate`, `burst`, `over`
- `quota`: `mode` (`over|until`), `bytes`, `used`
- `ct_helper`: `helper_type`, `l4proto`, `l3proto`
- `ct_timeout`: `l4proto`, `timeout_policy`, `l3proto`
- `ct_expectation`: `l4proto`, `dport`, `timeout`, `size`, `l3proto`
Note:
- `ct_expectation` creation for `family=bridge` is currently disabled (planned).

`PUT /firewall/objects/{id}`

Updates managed named object by id and applies immediately.

`DELETE /firewall/objects/{id}`

Deletes managed named object by id and applies immediately.
Deletion is rejected while object is referenced by existing firewall rule(s).

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
- bridge meta/marks: `meta_pkttype`, `meta_iifgroup`, `meta_oifgroup`, `mark_match`, `ct_mark_match`
- ops: `counter`, `counter_name`, `limit_rate`, `limit_name`, `quota_name`, `ct_helper_set`, `ct_timeout_set`, `log_prefix`, `log_level`, `log_flags`, `log_group`, `log_snaplen`, `log_queue_threshold`, `queue_num`, `queue_flags`

Important:
- for `family=bridge`, unsupported fields are rejected with a field-specific error.
- `action=reject` is accepted only when selected bridge chain has hook `input` or `prerouting`.
- `vlan_id` must be integer `1..4095`.
- `ether_type` must be hex/integer Ethertype (`0x0000..0xffff` or `0..65535`).
- `log_snaplen` and `log_queue_threshold` require `log_group`.
- `log_group` and `log_flags` are mutually exclusive.
- `counter` and `counter_name` are mutually exclusive.
- `limit_rate` and `limit_name` are mutually exclusive.
- `counter_name`, `limit_name`, `quota_name`, `ct_helper_set`, `ct_timeout_set` require existing named objects in selected bridge table.
- `ct_expectation_set` for `bridge` is currently disabled (planned).
- `queue_num`/`queue_flags` are valid only when `action=queue`.
- `queue_flags` supports only `bypass`, `fanout`.
- `queue_flags` with `fanout` requires `queue_num` range (e.g. `0-3`).
- bridge structured expert expressions (`fib_check`, `socket_match`, `rt_nexthop`, `ipv6_exthdrs`) are currently planned/disabled on this runtime and rejected by backend validation.
- `dup_to`/`dup_dev` are currently planned for `family=bridge` on this runtime and rejected by backend validation.
- `fwd_to`/`fwd_dev`/`fwd_family` are netdev-only (planned for future `Policy v2` families).
- UI explicitly shows planned strategy notes for `structured expressions`, `dup`, and `fwd` in bridge rule editor to avoid false runtime expectations.

Netdev Policy3 (`family=netdev`, used by Firewall → Policy3):
- base: `family`, `table`, `chain`, `action`, `enabled`, `comment`.
- table/chain constraint: selected table must be a custom `netdev` table with `chain_type=filter`, `hook=ingress`, and `device` set.
- actions: `accept`, `drop`, `jump`, `goto`, `return`, `queue`, `fwd`.
- L2/L3/L4: `in_interface`, `ether_src`, `ether_dst`, `ether_type`, `vlan_id`, `src`, `dst`, `proto`, `sport`, `dport`, `ct_state`.
- metadata/statements: `meta_pkttype`, `meta_iiftype`, `meta_iifgroup`, `mark_match`, `ct_mark_match`, `counter`, `limit_rate`, `log_prefix`, `log_level`, `log_flags`, `log_group`, `log_snaplen`, `log_queue_threshold`, `queue_num`, `queue_flags`.
- forwarding: `action=fwd` requires `fwd_to` and `fwd_dev`; `fwd_family` is optional and must match the address family when present.
- bridge-only fields (`ibrname`, `obrname`, named objects, `dup_*`) and nat/raw/route-only fields are rejected.

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

### NTP / Chrony

All endpoints require `X-API-Key`.

- `GET /ntp` — returns normalized desired configuration plus `applied_current`, which is `true` only when the rendered desired `chrony.conf` and `chrony.keys` match the currently installed `/etc/chrony/chrony.conf` and `/etc/chrony/chrony.keys`. If no JSON file exists, schema defaults are returned without creating a file.
- `PUT /ntp` — validates, normalizes, and atomically stores desired configuration in `${AWG_MANAGER_DATA_DIR}/ntp_config.json`.
- `GET /ntp/config-preview` — returns a deterministic read-only `chrony.conf` preview as `{ "ok": true, "item": { "content": "...", "warnings": [] } }`.
- `GET /ntp/status` — returns Chrony service state, current host epoch time as `current_time`, `timedatectl show` system clock state, structured `tracking`, `activity`, `sources`, `source_stats`, `clients` from `chronyc -n -c clients`, and partial `errors` collected through fixed `systemctl`, `date`, `timedatectl`, and `chronyc -n -c` commands.
- `GET /ntp/timezones` — returns the host timezone catalog from `timedatectl list-timezones` as `{ "ok": true, "item": { "items": ["UTC", "..."] } }` for the Time tab selector; it is read-only and does not modify system time.
- `POST /ntp/apply` — validates the saved desired configuration with `chronyd -p`, atomically installs `/etc/chrony/chrony.conf` and `/etc/chrony/chrony.keys` when keys are configured, masks competing time synchronization services, and enables/restarts `chrony.service`.
- `POST /ntp/timezone` with `{ "timezone": "Europe/Moscow" }` — validates and applies the system timezone through `timedatectl set-timezone`.
- `POST /ntp/manual-time` with `{ "date": "YYYY-MM-DD", "time": "HH:MM:SS" }` — while desired NTP synchronization is disabled, temporarily stops Chrony, sets system time through `timedatectl`, restarts Chrony and verifies it is active.
- `POST /ntp/sync` — executes `chronyc makestep`.
- `POST /ntp/restart` — restarts Chrony and verifies it is active.
- `POST /ntp/reload` — executes `systemctl reload-or-restart chrony.service` and verifies it is active.

Schema version is `1`; top-level sections are `time`, `sources`, `server`, `access`, and `keys`. The `time` section contains `timezone`, `ntp_enabled`, and `rtcsync`; `rtcsync` controls whether generated `chrony.conf` includes the Chrony `rtcsync` directive. `keys` contains Chrony authentication keys with numeric `id`, `algorithm` (`MD5`, `SHA1`, `SHA256`, `SHA384`, `SHA512`), `secret`, `enabled`, and optional `comment`; source and server `auth_key` fields must reference an enabled key id or `none`. When NTP client mode is enabled, generated `chrony.conf` includes `makestep 1.0 3` so Chrony can step large offsets during initial synchronization. Invalid values return HTTP `400` and do not overwrite the last valid JSON configuration.

Apply keeps `/etc/chrony/chrony.conf.awg-manager.bak` and `/etc/chrony/chrony.keys.awg-manager.bak` and restores them if Chrony activation fails. The endpoint does not execute `chronyc`, directly set system time/timezone, or manage firewall rules.

Competing units are stopped, disabled, and masked when present: `systemd-timesyncd.service`, `ntp.service`, `ntpsec.service`, and `openntpd.service`. Chrony remains the only enabled time synchronization service.
