# Add Firewall Rule Guide (EN)

This guide explains how to use **Firewall → Add Firewall Rule** in AWG Manager.

## 0) Policy vs Policy v2
- `policy` tab is intentionally **inet-only** (classic flow).
- For non-inet families, use **Firewall → policy v2**.
- Current MVP in `policy v2`: `Family=bridge` with 2-step selector `Family -> Table`.
- `Table` list in `policy v2` shows only enabled custom tables from selected family.
- Bridge `policy v2` supports: `ibrname/obrname`, `ether src/dst/type`, `vlan id`, `proto`, `sport`, `dport`, `ct state`, `meta pkttype`, `meta iifgroup`, `meta oifgroup`, `mark match`, `ct mark match`, `counter`, named `counter/limit/quota`, `limit rate`, extended `log` options, and `action=queue` (`queue_num`, `queue_flags`).
- Bridge `reject` is allowed only on chains with hook `input` or `prerouting`.
- Bridge `vlan id` range is `1..4095`.
- Bridge `ether type` accepts Ethertype as hex/integer: `0x0000..0xffff` or `0..65535`.
- In bridge MVP logging, `log_group` and `log_flags` cannot be used together.

## 1) Rule tables and intent
- `filter`: allow/deny traffic (`accept`, `drop`, `reject`, `jump`, `goto`, `return`)
- `nat`: address/port translation (`dnat`, `snat`, `masquerade`, `redirect`)
- `raw`: early processing (`notrack`-style workflows)
- `mangle`: packet/connection mark manipulation

Pick the table first, then open **Add**.

## 2) Base match tab
- `enabled`: if off, rule is stored but not applied in runtime.
- `Chain`: where the rule is attached.
- `Source address` / `Destination address`: CIDR or address.
- `Protocol`: tcp/udp/icmp/icmpv6.
- `Source port` / `Destination port`: single port or range.
- `Input interface` / `Output interface`: e.g. `eth0`, `awg1`.
- `Connection state`: `new`, `established`, `related`, `invalid`, `untracked`.
- `Connection mark` / `Packet mark`: ct mark and packet mark match (`0x1` or decimal).
- `Rate limit`: format like `10/second`.
- `User ID`: socket uid match (`meta skuid`), positive integer.
- `Hour`: `HH:MM` or `HH:MM-HH:MM` (24h).
- `DSCP`: `cs0..cs7`, `af11..af43`, `ef`, or integer `0..63`.

Tip: fields with `+` are inactive until enabled. `-` disables and removes the value from payload.

## 3) Advanced match tab
Currently active:
- `fib expression`
- `socket expression`
- `rt expression`
- `exthdr expression`
- `fib check`
- `socket match`
- `rt nexthop`
- `ipv6 extension headers`
- `raw expression` (raw table only)
- `nftrace` (raw table only)
- `notrack` advanced toggle (raw table only)
- `tcp flags`
- `icmp type` / `icmp code`
- `icmpv6 type` / `icmpv6 code`
- `meta length`
- `meta priority`
- `meta cpu`
- `meta pkttype`
- `meta iifgroup`
- `meta oifgroup`
- `ct status`
- `ct direction`
- `ct expiration`
- `ct helper`
- `ct label`
- `ct event`
- `ct original saddr` / `ct original daddr`
- `ct reply saddr` / `ct reply daddr`
- `vlan id`
- `ether src` / `ether dst` / `ether type`

### 3.1 Advanced matcher quick cookbook
Working examples:
- `tcp flags`: `syn,ack` (requires `proto=tcp`)
- `icmp type/code`: `echo-request` + `0` (requires `proto=icmp`)
- `icmpv6 type/code`: `echo-request` + `0` (requires `proto=icmpv6`)
- `meta length`: `64-1500`
- `meta priority`: `1:10`
- `meta cpu`: `0`
- `meta pkttype`: `host`
- `meta iifgroup`: `10`
- `meta oifgroup`: `20`
- `ct status`: `assured,confirmed`
- `ct direction`: `original`
- `ct expiration`: `30s`
- `ct helper`: `ftp`
- `ct label`: `0x1`
- `ct event`: `new,related`
- `ct original/reply saddr`: `10.8.0.2` / `10.8.0.1`
- `fib check`: `daddr . iif type`
- `socket match`: `transparent 1`
- `rt nexthop`: `10.0.0.1`
- `ipv6 exthdrs`: `frag`
- `vlan id`: `10`
- `ether type`: `0x0800`

Common rejects (expected):
- `tcp_flags` with non-tcp protocol.
- `icmp_type/icmp_code` with non-icmp protocol.
- `icmpv6_type/icmpv6_code` with non-icmpv6 protocol.
- `vlan id` outside `1..4095`.
- `ether type` outside Ethertype range.
- invalid `ct_direction` (must be `original` or `reply`).
- invalid `ct_expiration` format (must be like `30s`, `1m`, `2h`, `1d`).
- invalid mark/meta token formats.

## 4) Action tab
- `Action`: verdict or control action.
- `Target / to`: for jump/goto/nat target fields.
- `Reject type`: only for `action=reject`.
- `NAT options`: `random`, `fully-random`, `persistent`.
- `meta mark set`, `ct mark set`: mark operations.
- `log prefix`, `log level`: logging controls.

Bridge Policy v2 B2 notes:
- `counter` and `counter_name` are mutually exclusive.
- `limit_rate` and `limit_name` are mutually exclusive.
- `ct_helper_set`, `ct_timeout_set`, `counter_name`, `limit_name`, `quota_name` require existing named objects in the selected bridge table.
- `ct_expectation_set` is planned for bridge and temporarily disabled.
- The form loads named objects from API `GET /firewall/objects?family=bridge&table=<table>` and offers them in dropdowns.
- Expert expressions (`fib_check`, `socket_match`, `rt_nexthop`, `ipv6_exthdrs`) are currently planned/disabled for bridge on this runtime.
- `dup_to/dup_dev` and `fwd_to/fwd_dev/fwd_family` stay planned in bridge mode on current runtime.
- Editor shows explicit runtime notes for `structured expressions`, `dup`, and `fwd` to make planned limits visible before save.
- Named objects lifecycle is available via API: `POST/PUT/DELETE /firewall/objects`.
- UI shortcut:
  - In `Policy v2 -> objects`, each row has a `use` button that opens `Add Bridge Rule` with this object binding prefilled.
  - If you select multiple objects of different kinds (`counter`, `limit`, `quota`, `ct_helper`, `ct_timeout`) and click `Use in rule`, the form opens with multiple bindings prefilled at once.
  - Constraint: only one object per `kind` can be prefilled in one click (duplicate kinds are blocked by UI validation).
  - In `Edit Bridge Rule`, the `Linked objects (quick actions)` block provides `open` (jump to object in objects tab) and `unlink` (remove a specific binding).

Named object examples (why they matter):
1. SSH counter:
- Object: `kind=counter`, `name=cnt_ssh_attempts`.
- Rule: `proto=tcp`, `dport=22`, `counter_name=cnt_ssh_attempts`, `action=accept`.
- Why: track SSH hit volume and detect scanning pressure.

2. DNS rate limiter:
- Object: `kind=limit`, `name=lim_dns`, `rate=30/second`, `burst=100 packets`.
- Rule: `proto=udp`, `dport=53`, `limit_name=lim_dns`, `action=accept`.
- Why: smooth DNS bursts and reduce flood impact.

## 5) Statistics tab
- `counter`: enable nft counter for the rule.
- `counter name`: use existing named counter object from selected bridge table.
- Runtime fields show packets/bytes and chart preview.
- Chart can switch between packets/sec and bytes/sec.

## 6) Validation rules (important)
- Invalid table/chain/action combinations are rejected.
- Ports require tcp/udp protocol context.
- TCP/ICMP/ICMPv6 matcher fields require matching protocol context.
- Invalid CIDR/port formats are rejected before apply.
- Unsafe jump target usage is blocked (base hook chains are not valid jump targets).

## 7) Practical examples
1. Allow SSH:
- table `filter`, chain `input`, proto `tcp`, dport `22`, action `accept`.

2. DNAT web traffic:
- table `nat`, chain `prerouting`, proto `tcp`, dport `443`, nat type `dnat`, to `10.8.0.2:8443`.

3. Mark forwarded VPN traffic:
- table `mangle`, chain `forward`, in interface `awg1`, action `accept`, `meta mark set=0x10`.

4. Business-hours access:
- table `filter`, chain `input`, proto `tcp`, dport `443`, `hour=08:00-18:00`, `action=accept`.

5. UID-based egress control:
- table `filter`, chain `output`, `user_id=1001`, proto `tcp`, dport `443`, action `accept`.

6. Conntrack tuple match:
- table `filter`, chain `forward`, `ct original saddr=10.8.0.2`, `ct reply daddr=10.8.0.2`, action `accept`.

7. L2 match example:
- table `filter`, chain `input`, `vlan id=10`, `ether type=0x0800`, action `accept`.

## 8) Troubleshooting
- If runtime apply fails, check:
  - `/firewall` API error text
  - `journalctl -u awg-manager-api.service -n 200`
  - `nft list ruleset`
- On low-RAM VPS, run UI E2E with `PLAYWRIGHT_LOW_MEM=1`.
