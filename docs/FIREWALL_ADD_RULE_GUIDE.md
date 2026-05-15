# Add Firewall Rule Guide (EN)

This guide explains how to use **Firewall → Add Firewall Rule** in AWG Manager.

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

## 4) Action tab
- `Action`: verdict or control action.
- `Target / to`: for jump/goto/nat target fields.
- `Reject type`: only for `action=reject`.
- `NAT options`: `random`, `fully-random`, `persistent`.
- `meta mark set`, `ct mark set`: mark operations.
- `log prefix`, `log level`: logging controls.

Note:
- `ct_helper_set`, `ct_timeout_set`, `ct_expectation_set` are intentionally graceful-rejected until ct objects are enabled.

## 5) Statistics tab
- `counter`: enable nft counter for the rule.
- Runtime fields show packets/bytes and chart preview.
- Chart can switch between packets/sec and bytes/sec.

## 6) Validation rules (important)
- Invalid table/chain/action combinations are rejected.
- Ports require tcp/udp protocol context.
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
