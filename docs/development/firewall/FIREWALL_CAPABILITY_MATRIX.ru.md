# Firewall capability matrix по NFT/libnftables JSON

Дата: 2026-05-31

Цель: зафиксировать, что уже покрыто в firewall, что покрыто частично, что запланировано, и что не добавляем без отдельного согласования. Матрица опирается на `docs/reference/NFT.md`, `docs/reference/libnftables-json-ManPage.md`, текущие backend modules `backend/domains/firewall/*`, UI `webui/src/pages/firewall/*` и активные тесты.

Статусы:

- `supported` — есть backend/runtime path, UI/API путь и тестовое покрытие.
- `limited` — есть рабочая часть, но покрытие/UX/runtime parity неполные.
- `planned` — логичный следующий шаг без breaking API, но реализации еще нет.
- `not planned without approval` — требует отдельного решения, потому что меняет модель, повышает риск или выходит за текущий agreed scope.

## 1. Families, tables, chains

| Feature | NFT/libnftables reference | Current status | Backend | UI | Tests | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `inet` family | tables/chains/rules families | supported | `FIREWALL_TABLE_FAMILY`, built-in table defs | Policy built-ins `filter/nat/raw/mangle` | `test_firewall_rule_ops.py`, `firewall-rules.spec.ts` | Main quick path. |
| `ip` family | table family | supported | custom table context in `resolve_table_chain_context` | Policy custom selector | bridge spec custom L3 coverage | Used for custom L3 filter/nat tables. |
| `ip6` family | table family | supported | custom table context | Policy custom selector | bridge spec custom L3 coverage | Same as `ip`, with l3proto guards for objects. |
| `bridge` family | bridge family/filter chains | supported | family-specific validation and render with runtime renderer guards | unified Policy custom selector + bridge fields | `firewall-policy-v2-bridge.spec.ts`, `test_firewall_rule_ops.py` | NAT/raw/L3-only fields intentionally disabled; renderer rejects bridge NAT/raw/dup if stale data reaches apply. |
| `netdev` family ingress | netdev ingress hook | supported | device-aware custom table context, `fwd` render | unified Policy custom selector + netdev fields | `firewall-policy-v3-netdev.spec.ts`, `test_firewall_rule_ops.py` | Primary netdev path. |
| `netdev` family egress | netdev egress hook | planned | explicitly rejected by current runtime-profile guards | not exposed | `test_firewall_store.py`, `test_firewall_rule_ops.py`, stand `nft` check | Stand kernel `5.10.0-42-amd64` + `nftables v0.9.8` returns `unknown chain hook`; keep disabled until runtime is upgraded/confirmed. |
| `arp` family | ARP family | not planned without approval | not in `FIREWALL_SUPPORTED_TABLE_FAMILIES`; runtime list ignores unsupported families | not exposed | runtime adapter ignores `arp` table | Adding ARP changes field model and UI. |
| Built-in `filter/nat/raw/mangle` | common nft table patterns | supported | `FIREWALL_DEFAULT_TABLE_DEFS`, schema supports lists | Policy tabs | built-in Policy smoke | These remain `inet` quick modes. |
| Custom table builder | add/create/delete table/chain | supported | `table_ops`, `store.normalize_firewall_table_item`, `store.collect_table_defs` | Table builder | `test_firewall_store.py`, e2e bridge/netdev/custom L3 | Existing API shape preserved. Backend coverage now explicitly checks bridge/netdev chain constraints and `device/policy` runtime definition preservation. |

## 2. libnftables commands and operations

| Feature | NFT/libnftables reference | Current status | Backend | UI | Tests | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `add` table/chain/rule/object/set/map | `add` command | supported | script assembly uses `add ...` lines | Create flows | `test_firewall_rule_ops.py`, `test_firewall_table_ops.py`, unit/e2e | Main apply path. Backend coverage checks rule create idempotence, collection upsert rollback, and rule rollback on apply failure. |
| `create` semantic idempotence | `create` command | limited | API upsert/create normalizes and de-duplicates app state | Create/update forms | store/service tests | Runtime script mostly emits `add`, not JSON-native `create`. |
| `delete` table/rule/object/set/map | `delete` command | supported | delete service paths + runtime table delete | delete buttons/bulk actions | `test_firewall_table_ops.py`, `test_firewall_named_object_ops.py`, `test_firewall_collection_ops.py`, unit/e2e | Table delete is best-effort runtime. Backend coverage checks table-row removal, related object cleanup, missing-id error, no-op object-store write avoidance, named-object reference guard, named-object rollback, and collection delete rollback on apply failure. |
| `list` rules/tables/objects/runtime state | `list` command | supported | list APIs + runtime adapter list helpers | tables/panels | runtime adapter/collection tests | Runtime import/reconciliation is partial. Collection list cleanup rolls back store if runtime apply fails after removing expired active rows. |
| `reset` counters/quotas | `reset` command | supported | `reset_table_named_counters`, `reset_table_named_quotas`, `runtime_ops.reset_counters` | reset counters action | `test_firewall_runtime_ops.py`; runtime adapter tests cover success/error reset paths | Named counters/quotas have runtime reset helpers. Backend coverage includes full reset, built-in single-table partial reapply, custom `inet` table partial reapply, and unknown table rejection. |
| `insert` rule | `insert` command | planned | app reorder exists, nft insert semantics not first-class | no explicit insert UI | no dedicated tests | Could be added with optional handle/index fields, no breaking API. |
| `replace` rule | `replace` command | planned | update app state exists, runtime replace-by-handle not first-class | edit rule | no dedicated nft replace tests | Needs handle strategy if matching live nft handles. |
| reorder app-state rules | manager ordering operation | supported | `rule_ops.reorder_rules` | table drag/order action if exposed | `test_firewall_rule_ops.py` | App-state reorder validates exact table ids and now rolls back if apply fails. |
| `flush` ruleset/table/chain/set/map | `flush` command | planned | not exposed as user operation | no guarded UI | none | Must be explicit bulk action with confirmation. |
| `rename` chain/table/object | `rename` command | not planned without approval | not exposed | not exposed | none | Dangerous because rules/object refs can break. |
| JSON-native renderer | libnftables JSON schema | planned | current renderer outputs nft script lines | no UI impact | snapshot tests missing | Add behind feature flag if needed; do not replace script renderer blindly. |

## 3. Rules and base statements

| Feature | NFT/libnftables reference | Current status | Backend | UI | Tests | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| verdict actions `accept/drop/reject/jump/goto/return` | verdict statements | supported | `render_firewall_rule`, validation | Action tab | rule ops tests/e2e | `reject_type` has guarded variants. |
| `queue` action | queue statement | supported | queue num/flags normalize + render | Action tab | rule ops tests/e2e | Supports `fanout,bypass`. |
| NAT `snat/dnat/masquerade/redirect` | NAT statements | supported for L3 NAT | `normalize_nat_raw_fields`, render, bridge renderer guard | Action tab in nat contexts | rule ops tests/e2e | Guarded by family/table/chain; bridge renderer rejects stale NAT payloads. |
| `notrack` | notrack statement | supported | raw table guard + render | Advanced tab raw | block A/API tests | Raw-only. |
| `nftrace` | meta nftrace | supported | raw table guard + render | Advanced tab raw | block A/API tests | Raw-only. |
| raw expression escape hatch | nft expression syntax | limited | raw table guard + direct render + bridge renderer guard | Advanced tab raw | block A/API tests, rule ops renderer guard | Useful but intentionally constrained; bridge raw payloads are rejected before runtime apply. |
| `counter` anonymous | counter statement | supported | render | Stats tab | rule ops tests/e2e | Can coexist with named counter rules only through guarded form logic. |
| named counter/limit/quota binding | named stateful statements | supported for non-netdev | reference validation + render | Objects + Add Rule selectors | named object/rule/e2e tests cover non-netdev validation and netdev skip | `netdev` binding disabled. |
| `log` statement | log statement | supported | log prefix/level/flags/group/snaplen/threshold | Advanced/Action fields | rule ops tests | Guarded combinations. |
| `dup` statement | dup statement | limited | render/validation exists, bridge/netdev restrictions active, bridge renderer guard | not broadly exposed | rule ops tests cover inet render/normalize and bridge guard | Bridge dup remains disabled until runtime parity is agreed; stale bridge dup payloads are rejected before runtime apply. |
| `fwd` statement | fwd statement | supported for netdev | netdev-only render | Action tab netdev-only | netdev unit/e2e | Supports `fwd ip/ip6 to ... device ...`. |
| `flow add @flowtable` | flow statement | planned/design documented | not implemented | not exposed | design doc only | Depends on flowtable resource support; backend-first design is in `docs/FIREWALL_FLOWTABLE_DESIGN.ru.md`. |
| `meter` statement | meter statement | planned | not implemented | not exposed | none | Needs backend-first statement model. |
| dynamic set `add @set` / `update @set` | set statement | limited backend/runtime/UI | collection declaration fields + rule normalization/render for `inet` addr/port sets; stand accepts rules without key-expression comment | Add Rule -> Action, only for dynamic addr/port collections in `inet` scope | `test_firewall_store.py`, `test_firewall_collection_ops.py`, `test_firewall_rule_ops.py` including family guard for `ip/ip6/bridge/netdev`, Playwright dynamic set statement e2e, stand smoke | `set_stmt_comment`, `ip6`, `meta mark`, `bridge`, and `netdev` remain blocked until matching runtime support is verified. |
| `vmap` rule-level statement | verdict map statement | limited backend/runtime/UI | named `vmap` collection reference via optional `vmap_stmt_*`; first safe scope `inet` + `meta l4proto vmap @name` | Add Rule -> Action, only for enabled protocol-key `vmap` collections in `inet` scope | `test_firewall_rule_ops.py` including family guard for `ip/ip6/bridge/netdev`, `test_firewall_collection_ops.py`, collection/store tests, stand nft smoke, Playwright verdict map e2e | Stand `kernel=5.10.0-42-amd64`, `nftables v0.9.8` accepts named `inet_proto : verdict` map + rule; inline/raw vmap, `jump/goto`, bridge/netdev deferred. |
| `tproxy` | tproxy statement | planned | not implemented | not exposed | none | Requires proto/family guards and likely routing prerequisites. |
| `synproxy` | synproxy statement | planned | not implemented | not exposed | none | Needs advanced action/object design. |

Инвентаризация F1 закрыта 2026-05-31: реализованные statements и match-группы выше имеют явный статус, владельца backend/UI и ссылку на текущее тестовое покрытие. Незаполненные области остаются отдельными planned-пунктами (`meter`, расширение dynamic set statements за пределы текущего `inet` addr/port scope, flowtable, rule-level `vmap`, `tproxy`, `synproxy`) и не считаются скрытой частью текущего Policy collapse.

## 4. Matches and expressions

| Feature | NFT/libnftables reference | Current status | Backend | UI | Tests | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| L3/L4 basics `src/dst/proto/sport/dport` | payload matches | supported | normalize/render | Base tab | rule ops/e2e | L3 fields disabled for bridge where unsafe. |
| interfaces `iifname/oifname` | meta interface matches | supported | normalize/render | Base tab | rule ops/e2e | Hook-aware visibility in Policy. |
| bridge interfaces `ibrname/obrname` | bridge meta | supported | bridge-specific validation/render | Base tab bridge fields | bridge e2e | Generic L3 interface fields hidden for bridge. |
| TCP flags, ICMP/ICMPv6 literals | protocol matches | supported | validate/render | Advanced tab | rule ops | Family/proto guards apply. |
| conntrack state/status/direction/expiration/labels/events/original/reply | ct expressions | supported/limited | normalize/render | Advanced tab | rule ops cover normalize and final render | Some advanced ct fields disabled by bridge/netdev restrictions. |
| meta length/priority/cpu/pkttype/iiftype/oiftype/groups | meta expressions | supported/limited | normalize/render | Advanced tab | rule ops cover normalize and final render | Family restrictions apply. |
| mark/ct mark match/set | meta/ct mark | supported | normalize/render | Advanced/mangle | rule ops/e2e | Set path belongs to mangle-like contexts. |
| fib/socket/rt/exthdr matches | fib/socket/rt/exthdr expressions | supported/limited | normalize/render | Advanced tab | rule ops cover normalize and final render | Netdev/bridge restrictions apply. |
| VLAN/ether fields | L2 payload/meta | supported/limited | schema/render | Advanced tab | rule ops cover normalize and final render | Useful for bridge/netdev but still guarded by family rules. |
| ARP payload fields | ARP expressions | not planned without approval | not modeled | not exposed | none | Needs `arp` family decision first. |

## 5. Collections, maps, objects

| Feature | NFT/libnftables reference | Current status | Backend | UI | Tests | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| address sets | set object | supported | collection ops add set/element | Collections | collection tests/e2e | Supports interval when CIDR elements exist. |
| port sets | set object | supported | collection ops | Collections | collection tests/e2e | Type `inet_service`. |
| interface sets | set object | supported | collection ops | Collections | collection tests/e2e | Type `ifname`. |
| maps | map object | supported | map declaration/elements | Collections | collection tests cover declaration, elements, timeout, disabled skip | Type inferred from first pair. |
| verdict maps (`vmap`) as collection | map with verdict values | supported as collection | value type `verdict`; backend validates verdict values by allowlist | Collections | collection/store tests cover declaration, elements, timeout, disabled skip, verdict validation | Rule-level vmap statement still limited. |
| timeout on sets/maps | timeout flag | supported/limited | normalized timeout + cleanup | Collections | collection tests cover set/map/vmap timeout render | Dynamic packet-path update not implemented. |
| runtime-only set/map/vmap overlay | `nft -j list ruleset` set/map/vmap objects | not used now | parser helper exists but is not wired into API/UI | not exposed | `test_firewall_runtime_adapter.py` | Product decision: externally-created nft collections outside manager are not a supported workflow now. |
| named `counter` | stateful object | supported | object normalize/render/list/reset | Objects | object/runtime tests/e2e cover family matrix, list/reset/counter-index, and rule binding guards | `netdev` object listing OK, binding disabled. |
| named `limit` | stateful object | supported | object normalize/render/list | Objects | object tests/e2e cover family matrix and rule binding guards | Binding disabled for netdev. |
| named `quota` | stateful object | supported | object normalize/render/list/reset | Objects | object/runtime tests/e2e cover family matrix, list/reset, and rule binding guards | Binding disabled for netdev. |
| `ct helper` | ct object | supported except netdev | object normalize/render/list/binding | Objects + Add Rule | object/rule/e2e tests cover family matrix and rule binding guards | Allowed for `inet/ip/ip6/bridge`, not `netdev`. |
| `ct timeout` | ct object | supported except netdev | object normalize/render/list/binding | Objects + Add Rule | object/rule/e2e tests cover family matrix and rule binding guards | Allowed for `inet/ip/ip6/bridge`, not `netdev`. |
| `ct expectation` | ct object | supported for `inet/ip/ip6` | object normalize/render/list/binding | Objects + Add Rule | object/rule/e2e tests cover family matrix and bridge/netdev rejection | Explicitly disabled for `bridge/netdev`. |
| flowtables | flowtable object | planned/design documented | not implemented | not exposed | design doc only | NFT allows `ip/ip6/inet`; not `bridge/netdev`; first implementation plan is in `docs/FIREWALL_FLOWTABLE_DESIGN.ru.md`. |

## 6. Current strongest test gates

| Area | Command | Last known result |
| --- | --- | --- |
| Runtime collection parser | `python3 -m pytest -q tests/test_firewall_runtime_adapter.py` | 19 passed |
| Runtime operations | `python3 -m pytest -q tests/test_firewall_runtime_ops.py` | 5 passed |
| Collection operations | `python3 -m pytest -q tests/test_firewall_collection_ops.py` | 9 passed |
| Named object operations | `python3 -m pytest -q tests/test_firewall_named_object_ops.py` | 10 passed |
| Firewall store/table operations | `python3 -m pytest -q tests/test_firewall_store.py` | 29 passed |
| Firewall table operations | `python3 -m pytest -q tests/test_firewall_table_ops.py` | 5 passed |
| Rule normalization/render/script | `python3 -m pytest -q tests/test_firewall_rule_ops.py` | 26 passed |
| API contract | `python3 -m pytest -q tests/test_api_contract.py` | 9 passed |
| Facade compatibility | `python3 -m pytest -q tests/test_manager_access_facade.py` | 47 passed |
| Full Python suite | `python3 -m pytest -q tests` | 304 passed |
| Frontend build | `npm run build` | passed |
| Built-in Policy stand smoke | `npx playwright test tests/firewall-rules.spec.ts tests/firewall-add-rule-fields-completeness.spec.ts --project=chromium` | 7 passed |
| Bridge unified Policy stand e2e | `npx playwright test tests/firewall-policy-v2-bridge.spec.ts --project=chromium` | 31 passed |
| Netdev unified Policy stand e2e | `npx playwright test tests/firewall-policy-v3-netdev.spec.ts --project=chromium` | 6 passed |

## 7. Suggested next implementation order

- [x] 1. Add backend tests for documented `limited` capabilities that already render but lack direct dedicated assertions.
- [x] 2. Close `netdev egress` runtime decision for the current stand: blocked by nft/kernel (`unknown chain hook`), keep UI disabled.
- [ ] 2.1. Re-check `netdev egress` only after kernel/nft runtime upgrade or separate compatible stand is available.
- [x] 3. Design `flowtable` as a new firewall resource for `ip/ip6/inet` (`docs/FIREWALL_FLOWTABLE_DESIGN.ru.md`).
- [ ] 3.1. Implement flowtable backend store/domain tests before any API/UI exposure.
- [x] 4. Design dynamic set statements with safety limits (`dynamic`, `timeout`, `size`) before any UI.
- [x] 5. Design rule-level `vmap` usage from existing `vmap` collections (`docs/FIREWALL_VMAP_RULE_STATEMENTS_DESIGN.ru.md`).
- [ ] 6. Only after the above, consider JSON-native renderer behind a feature flag.
