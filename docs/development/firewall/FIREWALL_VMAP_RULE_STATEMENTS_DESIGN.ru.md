# Firewall rule-level vmap statements design

Дата: 2026-06-01

Статус: backend-first design зафиксирован; runtime/API/UI реализация еще не включена.

## Цель

Подготовить безопасную first-class модель для nftables verdict map statement:

```nft
expression vmap { key : verdict, ... }
```

и для named verdict map references:

```nft
meta l4proto vmap @proto_verdicts
```

Это не замена существующим Collections. Существующие `vmap` collections остаются источником данных, а rule-level statement должен стать структурированным способом использовать их в правилах.

## Основание в NFT/libnftables

`docs/reference/NFT.md` описывает `vmap` как аналог `map`, где value side содержит verdict:

```nft
expression vmap { VMAP_ELEMENTS }
VMAP_ELEMENT := key : verdict
```

`docs/reference/libnftables-json-ManPage.md` описывает statement:

```json
{ "vmap": { "key": EXPRESSION, "data": EXPRESSION } }
```

и отдельно фиксирует verdict-map values: `accept`, `drop`, `continue`, `return`, `jump`, `goto`.

## Текущая база

Сейчас firewall уже умеет:

- создавать `vmap` collections через существующий `/firewall/maps/vmap` путь;
- рендерить declaration/initial elements для `vmap`;
- валидировать value side `vmap` entries через allowlist `accept/drop/queue/continue/return`;
- показывать `vmap` в Collections.

Сейчас firewall не умеет:

- добавлять в правило structured statement `expression vmap @name`;
- проверять совместимость rule expression и key type конкретной `vmap` collection;
- использовать `jump/goto` внутри `vmap` безопасно, потому что нужен chain-existence guard;
- импортировать externally-created runtime `vmap` statements обратно в manager state.

## Safety invariants

Первый runtime-safe scope должен быть named-vmap only:

- Rule payload ссылается только на существующую enabled `vmap` collection в том же `(family, table)`.
- Inline `vmap { ... }` на первом этапе не включаем, чтобы не открыть raw-expression bypass.
- `vmap_stmt_expr` должен быть enum/allowlist, а не свободная строка.
- `vmap_stmt_name` должен ссылаться на collection kind `vmap`.
- Key type выбранной collection должен соответствовать `vmap_stmt_expr`.
- `jump/goto` values не включаем в первом кодовом scope, пока backend не умеет проверять target chain в выбранном table context.
- `bridge`/`netdev` включаются только после отдельных runtime tests; первый scope лучше держать в `inet`.
- UI exposure включается только после backend tests + runtime apply smoke.

## Proposed rule payload

Не меняем обязательную форму `/api/firewall/rules`. Новые поля optional:

```json
{
  "vmap_stmt_expr": "meta l4proto",
  "vmap_stmt_name": "proto_verdicts"
}
```

Allowed first-scope values:

- `vmap_stmt_expr`: `meta l4proto`.
- `vmap_stmt_name`: имя existing enabled `vmap` collection в текущем `(family, table)`.

Почему `meta l4proto` первым:

- оно подходит для `inet` без разделения на `ip protocol` и `ip6 nexthdr`;
- покрывает частый сценарий protocol -> verdict;
- его можно связать с `inet_proto : verdict` map type.

Следующие выражения стоит добавлять отдельными TDD-шага ми:

- `ip protocol` только для `ip`;
- `ip6 nexthdr` только для `ip6`;
- `tcp dport` / `udp dport` только когда rule context уже гарантирует L4 protocol и collection key type `inet_service`;
- L2/bridge expressions только после runtime gate.

## Collection model implications

Для `meta l4proto` нужно научить collection normalization/rendering понимать protocol-token entries:

```json
{
  "kind": "vmap",
  "name": "proto_verdicts",
  "entries": "tcp:accept,udp:drop,icmp:return"
}
```

Ожидаемый nft type:

```nft
type inet_proto : verdict
```

Текущая `vmap` value allowlist уже закрывает простой verdict scope. `jump/goto` нужно добавлять позже как structured value:

```json
{ "verdict": "jump", "target": "tcp-chain" }
```

а не как raw string, чтобы backend мог проверить target chain.

## Rendering draft

Named-vmap rule statement:

```nft
add rule inet filter input meta l4proto vmap @proto_verdicts
```

Сочетание с обычными match/action полями должно быть осторожным:

- если `vmap_stmt_*` указан, обычный terminal action лучше считать несовместимым в первом scope;
- non-terminal statements вроде `counter`/`log` можно разрешать только после renderer-order тестов;
- первый backend тест должен проверять минимальную строку без дополнительного `accept/drop` в конце.

## Backend implementation order

- [x] Добавить RED tests для `vmap_stmt_expr`/`vmap_stmt_name` optional payload в `tests/test_firewall_rule_ops.py`.
- [x] Добавить в `collection_ops.infer_map_token_type` поддержку `inet_proto` для `tcp/udp/icmp/icmpv6` protocol tokens.
- [x] Добавить domain validation: referenced map exists, enabled, kind `vmap`, same `(family, table)`, key type compatible with expression.
- [x] Добавить `rule_ops` normalization/render для `meta l4proto vmap @name`.
- [x] Прогнать API contract gate, подтверждающий, что старые rule payloads не меняются.
- [x] Провести stand runtime apply smoke на временной `inet` table/map/rule и cleanup.
- [x] Только после backend/runtime green добавить controls в существующую форму Add Rule -> Action/Advanced без редизайна Policy1.

## UI placement after backend is green

Внешний Policy UI не редизайним.

Предлагаемое место:

- Add Rule -> `Action` tab или `Advanced` tab: секция `Verdict map`;
- показывать только когда выбран supported context (`family=inet` на первом этапе);
- dropdown `vmap_stmt_name` показывает только enabled `vmap` collections совместимого key type;
- expression dropdown сначала содержит только `meta l4proto`;
- если collection содержит unsupported verdict values или не тот key type, показывать why-disabled hint.

## Non-goals for first implementation

- No inline raw `vmap { ... }` editor.
- No `jump/goto` until chain-target validation exists.
- No bridge/netdev exposure before runtime gate.
- No API breaking changes.
- No Policy UI redesign.
- No IPsec-domain changes.
