# Firewall flowtable design

Дата: 2026-06-07

Статус: backend-first design зафиксирован; runtime/API/UI реализация еще не включена.

## Цель

Подготовить безопасную модель для nftables flowtables:

```nft
add flowtable inet filter ft_lan { hook ingress priority 0; devices = { eth0, eth1 }; }
add rule inet filter forward ip protocol tcp flow add @ft_lan
```

Flowtable не является обычным rule action. Это отдельный named resource в table context плюс rule-level statement, который выбирает flows для offload.

## Основание в NFT/libnftables

`docs/NFT.md` описывает flowtables как ресурс:

```nft
{add | create} flowtable [family] table flowtable { hook hook priority priority ; devices = { device[, ...] } ; }
list flowtables [family]
{delete | destroy | list} flowtable [family] table flowtable
```

И rule statement:

```nft
flow add @flowtable
```

`docs/libnftables-json-ManPage.md` описывает JSON object:

```json
{
  "flowtable": {
    "family": "inet",
    "table": "filter",
    "name": "ft_lan",
    "hook": "ingress",
    "prio": 0,
    "dev": ["eth0", "eth1"]
  }
}
```

Важное ограничение из NFT-документа: flowtables поддерживают address family `ip`, `ip6`, `inet`. `bridge` и `netdev` не включаем.

## Текущая база

Сейчас firewall уже умеет:

- создавать custom tables/chains для `inet/ip/ip6/bridge/netdev`;
- хранить и рендерить named objects/collections;
- валидировать rule context по `(family, table, chain)`;
- добавлять optional rule fields без breaking API;
- показывать family-aware Policy selector;
- держать `bridge/netdev` out-of-scope через why-disabled hints.

Сейчас firewall не умеет:

- хранить flowtable resources;
- рендерить `add flowtable ...`;
- валидировать devices для flowtable;
- добавлять rule statement `flow add @name`;
- проверять runtime acceptance на текущем стенде;
- показывать flowtable в UI.

## Safety invariants

Flowtable включаем только при выполнении ограничений:

- `family` только `inet`, `ip`, `ip6`.
- `table` должен существовать в managed table context.
- `hook` на первом этапе только `ingress`.
- `priority` integer.
- `devices` обязателен, минимум один device.
- `devices` нормализуются как список уникальных interface names.
- Flowtable name уникален внутри `(family, table)`.
- Rule statement `flow add @name` разрешается только в том же `(family, table)`, где объявлен flowtable.
- Начальный rule scope: chain `forward`, потому что flowtable offload выбирает flows для forwarding path.
- Не разрешаем `bridge/netdev` flowtable resources и rule statements.
- Не добавляем raw flowtable expression.
- Не меняем обязательную форму существующих `/firewall/rules` payload.

## Proposed resource model

Новый managed resource можно хранить рядом с firewall tables/objects как отдельную коллекцию `flowtables`.

Минимальный item:

```json
{
  "id": "ft_...",
  "family": "inet",
  "table": "filter",
  "name": "ft_lan",
  "hook": "ingress",
  "priority": 0,
  "devices": ["eth0", "eth1"],
  "enabled": true,
  "comment": "LAN offload"
}
```

Validation:

- `name`: same identifier rules as tables/objects.
- `family`: `inet | ip | ip6`.
- `table`: existing built-in or custom table for that family.
- `hook`: `ingress`.
- `priority`: integer.
- `devices`: non-empty list, each item interface-name-like; duplicates removed preserving order.
- `enabled=false`: keep in manager state but skip runtime render.

## Proposed API shape

Новый endpoint без breaking change:

```text
GET    /firewall/flowtables?family=inet&table=filter
POST   /firewall/flowtables
PUT    /firewall/flowtables/<id>
DELETE /firewall/flowtables/<id>
```

Response shape should follow existing firewall resources:

```json
{ "ok": true, "item": { "...": "..." } }
{ "ok": true, "items": [ ... ] }
```

Если хотим избежать нового top-level endpoint на первом этапе, можно начать с backend domain/store functions and tests only, then expose API in a separate step. Но UI eventually needs first-class CRUD, so explicit endpoint is cleaner.

## Proposed rule payload

Optional fields on existing rule payload:

```json
{
  "flow_stmt_name": "ft_lan"
}
```

Optional future fields:

```json
{
  "flow_stmt_name": "ft_lan",
  "flow_stmt_enabled": true
}
```

Первый scope:

- `flow_stmt_name`: existing enabled flowtable in same `(family, table)`.
- `family`: `inet/ip/ip6`.
- `chain`: `forward`.
- terminal action allowed? First implementation should prefer no terminal action or preserve current action only after renderer-order tests. Safest initial rule render:

```nft
add rule inet filter forward ip protocol tcp flow add @ft_lan
```

Если UI needs an action value, use a dedicated statement toggle rather than overloading `Action = accept/drop`.

## Rendering draft

Flowtable declaration:

```nft
add flowtable inet filter ft_lan { hook ingress priority 0; devices = { eth0, eth1 }; }
```

Rule statement:

```nft
add rule inet filter forward flow add @ft_lan
```

With match fields:

```nft
add rule inet filter forward ip protocol tcp tcp dport 443 flow add @ft_lan
```

Runtime assembly order:

1. Add table/chain.
2. Add flowtables.
3. Add collections/maps/objects.
4. Add rules that may reference flowtables.

## Backend implementation order

- [ ] Add store tests for flowtable normalization:
  - valid `inet/ip/ip6`;
  - reject `bridge/netdev`;
  - require non-empty devices;
  - unique `(family, table, name)`.
- [ ] Add domain operations tests:
  - list/upsert/delete;
  - rollback on apply failure;
  - deletion blocked while referenced by enabled rule, or automatically clears references only after explicit decision.
- [ ] Add renderer tests for `add flowtable ... devices = { ... }`.
- [ ] Add rule normalization tests for `flow_stmt_name`.
- [ ] Add renderer tests for `flow add @name`.
- [ ] Add runtime apply ordering test: flowtable declaration appears before referencing rule.
- [ ] Add API contract tests proving old payloads remain valid.
- [ ] Run stand nft smoke with temporary flowtable and cleanup.
- [ ] Only after backend/runtime green, expose UI controls.

## UI placement after backend is green

Keep existing UI shape.

Suggested placement:

- New sub-area in `table builder` or new section inside `objects`? Prefer `table builder` because flowtable is a table-scoped runtime resource, not a stateful object binding.
- Add Rule -> `Action` or `Advanced`: compact `Flow offload` section.
- Show only for `family=inet/ip/ip6` and compatible table/chain.
- Dropdown lists enabled flowtables from the same `(family, table)`.
- Show why-disabled hints for:
  - unsupported family `bridge/netdev`;
  - no flowtables in this table;
  - chain not `forward`;
  - missing/disabled flowtable.

## Open decisions

- Should flowtables live under `table builder`, `objects`, or a new `resources` subpanel?
- Should deleting a flowtable be blocked when referenced by any rule, or should UI offer a guarded “delete and clear references” action?
- Should first rule scope require protocol/L4 matches to avoid broad offload rules?
- Should `devices` be free text or selected from system interfaces if available?
- Should runtime-only flowtables from `nft -j list ruleset` be ignored, shown as read-only overlay, or imported?

## Non-goals for first implementation

- No bridge/netdev flowtables.
- No generic raw expression for flow statements.
- No automatic offload rules.
- No JSON-native renderer replacement.
- No Policy UI redesign.
- No API breaking changes.
- No IPsec-domain changes.
