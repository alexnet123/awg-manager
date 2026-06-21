# Firewall dynamic set statements design

Дата: 2026-05-31

Статус: runtime-safe backend + UI controls включены для ограниченного `inet` addr/port scope.

## Цель

Подготовить backend-first модель для nftables packet-path mutations:

- `add @set { expression [timeout ...] }`
- `update @set { expression [timeout ...] }`

Это не обычное редактирование Collections. Это rule statement, который меняет set/map state во время прохождения пакетов, поэтому он должен включаться только после отдельного TDD-шага и runtime gate.

## Текущая база

Сейчас firewall уже умеет:

- объявлять address/port/interface sets;
- объявлять maps и verdict maps;
- добавлять initial elements;
- включать `flags timeout` при заданном `timeout`;
- очищать временные rows на уровне manager-state;
- применять Collections через существующий runtime script path.

Сейчас firewall не умеет:

- `flags dynamic` для runtime-mutated sets;
- `size` и `gc-interval` как обязательные safety-limits;
- rule-level statements `add @set` / `update @set`;
- structured source expression для динамического элемента (`ip saddr`, `ip daddr`, `meta mark`, etc.);
- runtime import/reconciliation элементов, созданных packet path.

## Safety invariants

Dynamic set statements нельзя включать без этих ограничений:

- Dynamic target должен ссылаться только на существующий set в том же `(family, table)`.
- Target set должен быть отдельным managed set с `flags dynamic`.
- Для `update @set` target set должен иметь timeout support: set-level `timeout` или statement-level `timeout`.
- Для `add @set` timeout тоже обязателен, если set может расти без ручного лимита.
- Target set должен иметь `size`; без size не разрешаем packet-path mutation.
- `comment` внутри key expression запрещен для текущего runtime profile: stand `kernel=5.10.0-42-amd64`, `nftables v0.9.8` возвращает `Key expression comments are not supported`.
- Expression должен быть allowlist-based, без raw string на первом этапе.
- `bridge`/`netdev` включаются только после отдельных runtime tests; начальный scope — `inet/ip/ip6`.
- UI exposure включается только после backend tests + stand runtime apply smoke.

## Proposed data model

Не ломаем текущий `/api/firewall/rules` payload. Новые поля должны быть optional.

Минимальный rule payload draft:

```json
{
  "set_stmt_op": "add",
  "set_stmt_name": "ssh_flood",
  "set_stmt_expr": "ip saddr",
  "set_stmt_timeout": "10s"
}
```

Allowed values:

- `set_stmt_op`: `add` или `update`.
- `set_stmt_name`: имя managed set в выбранном `(family, table)`.
- `set_stmt_expr`: только allowlist на первом этапе:
  - `ip saddr`
  - `ip daddr`
  - `ip6 saddr`
  - `ip6 daddr`
  - `meta mark`
  - `tcp dport`
  - `udp dport`
- `set_stmt_timeout`: nft timeout syntax через существующий `normalize_nft_timeout`.
- `set_stmt_comment`: reserved optional field, currently rejected by backend for the current nft runtime profile.

Не добавляем generic raw expression для dynamic statements на первом этапе.

## Collection model extension draft

Существующие `addr/port/iface` sets можно расширить optional полями без breaking change:

```json
{
  "dynamic": true,
  "size": 65536,
  "gc_interval": "30s"
}
```

Guards:

- `dynamic=true` требует `timeout` или explicit statement timeout plan.
- `dynamic=true` требует `size`.
- `size` должен быть положительным integer, с верхней границей, например `1000000`.
- `gc_interval` разрешать только если включен timeout.
- Для `iface` dynamic sets пока не включать до отдельной runtime проверки.

## Rendering draft

Set declaration:

```nft
add set inet filter ssh_flood { type ipv4_addr; flags dynamic,timeout; timeout 10s; size 65536; }
```

Rule statement:

```nft
add rule inet filter input tcp dport 22 add @ssh_flood { ip saddr timeout 10s } accept
```

`update @set` должен разрешаться только когда target set гарантированно timeout-capable.

## Backend implementation order

- [x] Add focused tests for dynamic set declaration rendering with `flags dynamic,timeout`, `size`, and optional `gc-interval`.
- [x] Add domain normalization for collection fields: `dynamic`, `size`, `gc_interval`.
- [x] Add focused tests for rejecting unsafe dynamic sets: no timeout, no size, invalid size, unsupported kind/family.
- [x] Add rule normalization tests for optional `set_stmt_*` fields.
- [x] Add renderer tests for `add @set` and `update @set` statements.
- [x] Add validation that referenced set exists and is dynamic-capable in the current backend scope.
- [x] Add API contract test proving old payloads remain valid and new optional fields do not change existing wire shape.
- [x] Run stand nft apply smoke with temporary table/set/rule and cleanup.
- [x] Only after backend/runtime green, expose UI controls in existing Add Rule `Action` or `Advanced` tab.

Current D2.5 backend/runtime/UI scope is intentionally narrow: `family=inet`, `addr` sets with `ip saddr`/`ip daddr`, and `port` sets with `tcp dport`/`udp dport`. `set_stmt_comment`, `ip6`, `meta mark`, `bridge`, and `netdev` remain blocked until matching runtime support is verified.

## UI placement after backend is green

Keep Policy1 UI shape.

Suggested placement:

- Add Rule -> `Action` tab: section `Dynamic set update` below verdict/action controls.
- Show only for `inet` initially.
- Target set dropdown lists only dynamic-capable addr/port sets loaded from Collections.
- `add/update`, expression, and timeout fields stay disabled until a valid target set is selected; comment controls stay hidden/disabled on the current runtime profile.
- Add explicit why-disabled hints for missing `dynamic`, missing `size`, missing timeout, unsupported family.

## Open decisions

- Whether `dynamic` belongs to existing Collections rows or a dedicated `dynamic_sets` kind.
- Whether `set_stmt_expr` should stay enum-based forever or later move to structured expression objects.
- Whether `update @set` should require statement-level timeout even when set-level timeout exists.
- Runtime import policy for packet-created elements: list-only, reconcile into manager state, or show as runtime-only overlay.

## Non-goals for first implementation

- No raw expression injection for dynamic set statements.
- No `bridge/netdev` dynamic set statements.
- No UI redesign.
- No breaking changes to `/api/firewall/*`.
- No automatic migration of existing Collections into dynamic sets.
