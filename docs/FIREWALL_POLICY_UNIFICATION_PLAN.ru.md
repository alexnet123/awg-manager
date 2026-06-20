# План схлопывания Policy1/Policy2/Policy3 в единый Policy

Дата: 2026-05-28

## Решение по UI

Внешний интерфейс **не редизайним**.

Сохраняем текущий Policy1:

- верхняя навигация Firewall остается в текущем стиле;
- вкладки `filter`, `nat`, `raw`, `mangle` остаются как есть;
- таблица правил остается как есть;
- форма `Add Rule` остается той же формой с вкладками `Base`, `Advanced`, `Action`, `Stats`;
- все возможности Policy2/Policy3 переезжают функционально внутрь текущей формы `Add Rule`;
- отдельные экраны Policy2/Policy3 удаляются только после того, как их функции доступны из Policy1.

## Ключевая модель nftables

`filter`, `nat`, `raw`, `mangle` в текущем UI являются быстрыми встроенными режимами для обычных `inet` tables.

`bridge` и `netdev` не надо помещать внутрь `filter/nat/raw/mangle` как отдельные вкладки. Они должны работать через выбранный контекст правила:

- `family`;
- `table`;
- `chain`;
- `chain_type`;
- `hook`;
- `device` для `netdev`/`ingress`.

Практически:

- `inet/ip/ip6` могут использовать обычные `filter/nat/raw/mangle`-подобные сценарии;
- `bridge` работает как отдельная nftables family с `filter` chains и bridge-specific полями;
- `netdev` работает как отдельная nftables family с `filter` chain, `hook=ingress` и обязательным `device`;
- NAT statements допустимы только в `nat` chain type, поэтому не должны включаться для `bridge/netdev`;
- `fwd` должен оставаться netdev-only;
- bridge objects из Policy2 должны быть доступны в контексте выбранной bridge table.

## План работ

- [x] 1. Зафиксировать правило: UI остается как Policy1, без визуального редизайна.
- [x] 2. Проверить текущие repo-инструкции, ветку и firewall-границы.
- [x] 3. Инвентаризировать текущие frontend-точки: `PolicyRuleEditor*`, `PolicyAdvanced*`, `PolicySectionToolbar`, table builder, objects.
- [x] 4. Сверить nftables-модель по `docs/NFT.md` и `docs/libnftables-json-ManPage.md`.
- [x] 5. Добавить shared frontend context helper для Policy1: вычислять `family/table/chain/chain_type/hook/device` для текущего выбора.
- [x] 6. Расширить Policy1 custom table selection: показывать не только `inet`, но и `bridge/netdev`, не меняя внешний стиль контролов.
- [x] 7. Перенести create/edit bridge/netdev rules из `PolicyAdvancedRuleEditor*` в текущий `PolicyRuleEditorDialog`.
- [x] 8. Перенести Policy2 objects в контекст выбранной bridge table внутри Policy1, без изменения backend API `/firewall/objects`.
- [x] 9. После parity-проверки убрать отдельные вкладки `policy2`/`policy3` и удалить мертвые advanced-компоненты.
  - [x] 9.1. Обновить bridge/netdev e2e specs под unified `Policy` selector и названия `Add/Edit Firewall Rule`.
  - [x] 9.2. Вернуть активное bridge object UI coverage для unified `Policy`: object usage -> rule filter, use-in-rule prefill, quick unlink.
  - [x] 9.3. Удалить skipped legacy UI coverage старого `policy v2` advanced editor для `dup/fwd`; planned/rejected поведение остается покрытым API-тестами.
  - [x] 9.4. Удалить старый `PolicyAdvancedRuleEditor*` rule modal path из UI bundle; object compatibility panel/modal пока оставлены.
  - [x] 9.5. Удалить скрытый `PolicyAdvancedPage/Section` object/rules экран из UI bundle; bridge objects остаются через единый `FirewallObjectsPanel`.
  - [x] 9.6. Переименовать оставшиеся bridge object helper-ы с `PolicyV2/PolicyAdvanced` naming на `PolicyBridgeObject*`/`bridge*`, без изменения API и поведения.
  - [x] 9.7. Вынести named objects из bridge-only панели в отдельную вкладку `objects` после `collections`, scoped по выбранной `family/table`.
- [x] 10. Обновить ownership-документацию RU/EN и прогресс-лог, когда начнется фактический перенос ответственности между frontend-модулями.

Примечание 2026-05-28: первый безопасный шаг сделан через compatibility-мост. Верхние вкладки `policy2`/`policy3` скрыты, bridge/netdev custom tables выбираются из `Policy`, а Add/Edit для bridge/netdev пока открывает существующий advanced editor с нейтральными подписями. Полный перенос полей в `PolicyRuleEditorDialog` остается следующим этапом.

Примечание 2026-05-29: Add/Edit правил bridge/netdev переведен в обычный `PolicyRuleEditorDialog`. В текущую форму добавлены bridge interface поля (`ibrname`/`obrname`), shared `queue` action и netdev-only `fwd` action. Bridge objects остаются следующим отдельным этапом.

Примечание 2026-05-29: bridge objects перенесены в единый `Policy` shell для выбранной bridge custom table. Форма `Add Rule` подгружает `/firewall/objects` и позволяет выбрать counter/limit/quota/ct helper/ct timeout object; отдельная панель bridge objects в `Policy` поддерживает add/delete/filter/use-in-rule. API `/firewall/objects` не менялся.

Примечание 2026-05-29: оставшиеся object helper-ы переименованы в bridge-owned naming (`firewallObjectForm`, `useFirewallObjectActions`, `useFirewallObjectEditor`, `useFirewallObjectBindings`, `useFirewallObjectState`). Это только cleanup владения после схлопывания Policy2 в единый Policy; wire/API и видимый UI не менялись.

Примечание 2026-05-29: objects вынесены из `policy` в отдельную вкладку `objects` после `collections`. Таблица выбирается как `family/table`; создание/list/delete объектов использует прежний `/firewall/objects` API. `Use in rule` включен для `inet/ip/ip6/bridge`; `netdev` остается выключенным.

Примечание 2026-05-29: backend rule validation расширен для named-object bindings в `inet/ip/ip6/bridge`; `netdev` остается запрещенным для object bindings. `ct_expectation_set` включен для `inet/ip/ip6` и остается выключенным для `bridge/netdev`.

## Статус на 2026-05-31

Схлопывание Policy считается функционально закрытым:

- [x] В UI остался единый верхний раздел `Policy`; отдельные `Policy2`/`Policy3` больше не выставляются пользователю.
- [x] Внешний стиль Policy1 сохранен: те же верхние секции Firewall, те же built-in вкладки `filter`/`nat`/`raw`/`mangle`, та же форма `Add/Edit Rule` с вкладками.
- [x] `filter`/`nat`/`raw`/`mangle` остаются быстрыми `inet`-сценариями и не смешиваются с `bridge`/`netdev`.
- [x] `bridge` и `netdev` работают через custom table context: `family/table/chain/chain_type/hook/device`.
- [x] Bridge/netdev Add/Edit rules перенесены в общий `PolicyRuleEditorDialog`.
- [x] Objects вынесены в отдельный раздел `objects` после `collections`, с выбором `family/table`.
- [x] Object bindings доступны для `inet/ip/ip6/bridge`; для `netdev` привязка object к rule намеренно выключена.
- [x] `ct_expectation` ограничен `inet/ip/ip6`; `bridge` и `netdev` получают явную валидацию/disabled UI.
- [x] Backend validation больше не уходит в legacy fallback на firewall `ValueError`/`LookupError`.

Проверенная матрица:

- [x] Built-in `inet` Policy smoke: `firewall-rules.spec.ts` + `firewall-add-rule-fields-completeness.spec.ts` — 7/7 passed на стенде.
- [x] Unified bridge Policy e2e: `firewall-policy-v2-bridge.spec.ts` — 31/31 passed на стенде.
- [x] Unified netdev Policy e2e: `firewall-policy-v3-netdev.spec.ts` — 6/6 passed на стенде.
- [x] Python backend gate: `test_firewall_rule_ops.py`, `test_api_contract.py`, `test_manager_access_facade.py`, полный `tests` — green на последнем проверенном шаге.

## Roadmap до 100% firewall по NFT/libnftables JSON

Цель roadmap: довести firewall-функционал до максимально полного покрытия nftables, сохраняя текущий wire/API contract и развивая UI без редизайна Policy1.

### A. Матрица возможностей и runtime parity

- [x] A1. Завести явную capability matrix: `docs/NFT.md` / `docs/libnftables-json-ManPage.md` feature -> текущий backend -> UI -> tests -> статус (`docs/FIREWALL_CAPABILITY_MATRIX.ru.md`).
- [x] A2. Разделить статусы на `supported`, `limited`, `planned`, `not planned without approval`.
- [x] A3. Зафиксировать family compatibility для `inet/ip/ip6/bridge/netdev` по table/chain/rule/object/collection/statement.
- [ ] A4. Добавить backend tests для каждой строки matrix, где поведение уже реализовано, но покрыто только e2e или не покрыто явно.
  - [x] A4.1. Усилить backend coverage для `vmap` collections: нормализация entries и allowlist verdict values.
  - [x] A4.2. Усилить backend coverage для dynamic set statement family guard: `ip/ip6/bridge/netdev` остаются заблокированы, первый runtime-safe scope только `inet`.
  - [x] A4.3. Усилить backend coverage для rule-level `vmap` statement family guard: `ip/ip6/bridge/netdev` остаются заблокированы, первый runtime-safe scope только `inet`.

### B. Table/chain/rule operations

- [x] B1. Проверить и допокрыть операции nft `add/create/delete/list/reset` для table/chain/rule/set/map/object.
  - [x] B1.1. Усилить backend coverage для custom table/chain add/create path: `bridge` остается `filter`-only без `ingress/device`, `netdev` принимает только `filter ingress + device`, а runtime table definitions сохраняют `device/policy`.
  - [x] B1.2. Усилить backend coverage для delete table path: удаление custom table чистит только связанные named objects и не пишет objects store, если связанных объектов нет.
  - [x] B1.3. Усилить backend coverage для create rule rollback: при ошибке apply после записи нового правила rules store откатывается к прежнему состоянию.
  - [x] B1.4. Закрыть rollback для reorder rules: при ошибке apply после reorder rules store откатывается к прежнему порядку.
  - [x] B1.5. Усилить backend coverage для reset counters custom table path: custom `inet` table частично пересобирается, а stats очищаются только для правил выбранной table.
  - [x] B1.6. Усилить backend coverage для delete object rollback: при ошибке apply после удаления named object objects store откатывается к прежнему состоянию.
  - [x] B1.7. Закрыть rollback для delete set/map collection: при ошибке apply после удаления active collection store откатывается к прежнему состоянию.
  - [x] B1.8. Закрыть rollback для upsert set/map collection: при ошибке apply после записи active collection store откатывается к прежнему состоянию выбранного kind.
  - [x] B1.9. Закрыть rollback для list/cleanup set/map collection: при ошибке apply после auto-cleanup expired active rows collections store откатывается к прежнему состоянию выбранных kinds.
- [ ] B2. Спроектировать без breaking API поддержку `insert`/`replace` rule через существующие rule payload поля `position/handle` или отдельные совместимые optional fields.
- [ ] B3. Спроектировать `flush` для rules/table/family как явную bulk-action с confirmation guard, не как скрытый побочный эффект.
- [ ] B4. Спроектировать `rename chain/table/object` только после отдельного UX/API согласования, потому что rename опасен для ссылок rules/objects.

### C. Families and hooks

- [x] C1. Довести `netdev` matrix до полного ingress/egress понимания для текущего стенда: рабочий путь — `ingress`; `egress` из NFT.md на текущем runtime заблокирован.
  - [x] C1.1. Backend-first spike: проверить возможность `netdev` `filter` chain с `hook=egress` и обязательным `device`.
  - [x] C1.2. Проверить `netdev egress` на стенде/runtime: `kernel=5.10.0-42-amd64`, `nftables v0.9.8` возвращает `unknown chain hook`; UI exposure не включаем.
  - [x] C1.3. Зафиксировать runtime-safe backend guard: `egress` явно отклоняется до появления совместимого runtime.
- [ ] C2. Оставить `arp` family в статусе `not planned without approval`: она есть в NFT.md, но сейчас backend schema поддерживает `inet/ip/ip6/bridge/netdev`, а добавление `arp` меняет модель полей и UI.
- [x] C3. Проверить bridge-specific ограничения для NAT/dup/raw expr и зафиксировать в tests, чтобы UI не обещал то, что runtime не применит.
  - [x] C3.1. Backend normalization запрещает bridge `nat_type/raw_expr/dup_to/dup_dev`.
  - [x] C3.2. Runtime renderer дополнительно отклоняет stale bridge NAT/raw/dup payloads перед генерацией nft script.

### D. Collections, maps, verdict maps

- [x] D1. Уточнить текущее покрытие `set/map/vmap`: declarations, element formatting, timeout/expires/comment, interval/dynamic flags.
- [x] D2. Добавить UI/backend путь для dynamic set statements (`add @set`, `update @set`) только после backend-first дизайна, потому что это packet-path mutation.
  - [x] D2.1. Зафиксировать backend-first safety/design: `docs/FIREWALL_DYNAMIC_SET_STATEMENTS_DESIGN.ru.md`.
  - [x] D2.2. Реализовать collection normalization/render tests для `dynamic`, `size`, `gc_interval`.
  - [x] D2.3. Реализовать rule normalization/render tests для `add @set` / `update @set`.
  - [x] D2.4. Провести stand runtime gate; UI controls включать отдельным шагом после сохранения runtime-safe ограничений.
  - [x] D2.5. Включить controls в существующей форме Add Rule -> Action для runtime-safe `inet` addr/port scope; `set_stmt_comment`, `ip6`, `meta mark`, `bridge`, `netdev` остаются заблокированы.
  - [x] D2.6. Закрепить backend tests для family guard dynamic set statement: `ip/ip6/bridge/netdev` не принимают `set_stmt_*`.
- [ ] D3. Усилить `vmap` как first-class rule action/match, а не только collection type, если NFT parity требует rule-level `expression vmap { verdicts }`.
  - [x] D3.1. Зафиксировать backend-first дизайн rule-level `vmap`: named-vmap only, optional `vmap_stmt_*`, первый safe scope `inet` + `meta l4proto`, без inline raw и без `jump/goto`.
  - [x] D3.2. Реализовать backend-only normalization/render для named `vmap` statement: `vmap_stmt_expr=meta l4proto`, `vmap_stmt_name=<enabled vmap>`, target key type `inet_proto`.
  - [x] D3.3. Провести stand runtime gate для временного `inet` table/vmap/rule и cleanup.
  - [x] D3.4. После runtime green добавить controls в существующую Add Rule форму без редизайна Policy1.
  - [x] D3.5. Закрепить backend tests для family guard rule-level `vmap`: `ip/ip6/bridge/netdev` не принимают `vmap_stmt_*`.
- [ ] D4. Проверить import/list reconciliation для sets/maps/vmaps из runtime, чтобы UI не терял externally-created nft state.
  - [x] D4.1. Добавить backend parser для runtime-only overlay sets/maps/vmaps из `nft -j list ruleset`, без авто-merge в manager state.
  - [ ] D4.2. Paused/not needed now: не подключать runtime-only collections в API/UI, потому что внешние nft collections вне manager-а не являются поддерживаемым рабочим сценарием.
  - [ ] D4.3. Не добавлять UI read-only rows для externally-created runtime collections.
  - [ ] D4.4. Explicit import action не планируется без отдельного продуктового решения.

### E. Stateful objects and flowtables

- [x] E1. Закрыть object matrix для `counter/limit/quota/ct_helper/ct_timeout/ct_expectation` по families и rule bindings.
- [ ] E2. Спроектировать `flowtable` как новый firewall resource только для `ip/ip6/inet`, с отдельным table context и rule statement `flow add @flowtable`.
- [x] E3. Проверить reset/list counters/quotas behavior для named objects и anonymous statements.

### F. Advanced statements

- [x] F1. Инвентаризировать уже реализованные statements: `counter`, `log`, `limit`, `quota`, `notrack`, `nftrace`, `mark set`, `ct mark set`, NAT, `reject`, `queue`, `dup`, `fwd`, ct object bindings, L2/meta/ct/fib/socket/rt/exthdr matches.
- [ ] F2. Спроектировать backend-first support для `meter` statement из libnftables JSON.
- [ ] F3. Спроектировать backend-first support для `tproxy` и `synproxy` из NFT.md как отдельные advanced actions с family/proto guards.
- [ ] F4. Перевести часть raw/expert expressions в структурированные поля там, где это безопасно и часто используется.
- [ ] F5. Оставить raw expression как expert escape hatch, но ограничивать его по family/hook, чтобы он не ломал bridge/netdev.

### G. JSON/libnftables parity

- [ ] G1. Описать текущую модель генерации nft CLI/script lines и отличия от libnftables JSON.
- [ ] G2. Решить, нужен ли JSON-native backend renderer; если да, добавить параллельный renderer за feature flag без изменения wire/API.
- [ ] G3. Добавить snapshot tests: UI/backend payload -> nft script/json -> ожидаемый nftables construct.
- [ ] G4. Добавить best-effort runtime import/list normalization для externally-created nft objects.

### H. UX and safety

- [ ] H1. Не редизайнить Policy: новые поля добавлять в существующие вкладки `Base`/`Advanced`/`Action`/`Stats`.
- [ ] H2. Включать поля только при правильном выборе `family/table/chain_type/hook/device`.
- [ ] H3. Для опасных bulk/runtime операций (`flush`, mass delete, import overwrite) требовать явное подтверждение.
- [ ] H4. Поддерживать подсказки "why disabled" для bridge/netdev/NAT/object-binding ограничений.
  - [x] H4.1. Action tab объясняет, что dynamic set update и verdict map доступны только для `inet`, когда форма открыта в bridge/netdev контексте.
  - [x] H4.2. Action tab объясняет доступность NAT actions: для `bridge/netdev` они недоступны, для `inet/ip/ip6` показываются только в поддержанном context family/table/chain.
  - [x] H4.3. Action tab объясняет, что named-object bindings отключены для `netdev`, вместо молчаливого скрытия блока.
  - [x] H4.4. Action tab объясняет, что `ct_expectation` object доступен только для `inet/ip/ip6`, когда форма открыта в `bridge` контексте.

### I. Release hardening

- [ ] I1. Поддерживать обязательный Python gate после каждого backend шага.
- [ ] I2. Поддерживать stand e2e smoke отдельно для built-in `inet`, `bridge`, `netdev`.
- [ ] I3. Перед финальной приемкой развернуть единый стенд из `main`, без ad-hoc snapshot.

## Что не делаем без отдельного согласования

- Breaking changes в `/api/firewall/*` payload/status shape.
- Редизайн Policy UI вместо сохранения Policy1-стиля.
- Возврат отдельных пользовательских экранов `Policy2`/`Policy3`.
- Расширение firewall в IPsec domain или domain-to-domain imports.
- Добавление `arp` family как полноценного UI/runtime направления.
- JSON-native renderer как замена текущего script renderer без feature flag и тестовой матрицы.

## Первый безопасный кодовый шаг

Первый шаг должен быть без изменения поведения:

- создать/расширить frontend helper для вычисления rule context;
- покрыть текущую модель unit-level проверками, если в проекте есть frontend test harness;
- не удалять `PolicyAdvanced*`;
- не менять payload API;
- не менять backend validation.

Ожидаемый результат первого шага:

- Policy1 по-прежнему работает как сейчас;
- появляется единое место, которое знает, что выбранная table может быть `inet`, `bridge` или `netdev`;
- следующий шаг сможет включить bridge/netdev в текущую форму без переписывания UI.

## Что делать с filter/nat/raw/mangle

Оставить как быстрые built-in вкладки для обычного `inet` режима.

Для custom tables логика должна смотреть на metadata выбранной chain:

- если `family=inet|ip|ip6` и `chain_type=nat`, включать NAT-поля;
- если `family=inet|ip|ip6` и priority/hook соответствуют raw-like сценарию, включать raw/debug поля;
- если `family=bridge`, включать bridge/L2 поля и bridge objects, но выключать NAT;
- если `family=netdev`, включать ingress/device/netdev поля, но выключать NAT и bridge objects.

## Риски

- Нельзя удалить Policy2/Policy3 до функционального parity, иначе потеряем управление bridge/netdev rules.
- Нельзя расширять UI только визуально: backend validation уже содержит ограничения для bridge/netdev, и frontend должен им соответствовать.
- Нельзя менять wire/API payload без отдельного согласования.
- При переносе objects нужно сохранить table/family scoping, иначе можно случайно привязать object к неверной table.

## Test gate

Перед завершением кодового этапа:

```bash
python3 -m pytest -q tests/test_firewall_rule_ops.py
python3 -m pytest -q tests/test_api_contract.py
python3 -m pytest -q tests
```

Если будет изменен `backend/app/manager_facade.py` или `backend/app/legacy_manager_compat.py`, дополнительно:

```bash
python3 -m pytest -q tests/test_manager_access_facade.py
```
