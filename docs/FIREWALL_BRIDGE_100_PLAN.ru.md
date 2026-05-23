# Bridge 100% Plan (RU)

## Статус
- Sprint 1 (B1+ hardening): завершён в `dev` (commit `230a16e`) — bridge-only `Policy v2`, strict validation, E2E/API gate, reboot-restore проверка на стенде `132.243.237.120`.
- B2 (`limit/quota/named counter`, `ct helper/timeout/expectation`): отложен и будет отдельным этапом.

## Журнал этапов
- 2026-05-23: закрыт Sprint 1 (B1+) по bridge:
  - backend: ужесточены bridge-валидации (`vlan_id`, `ether_type`, `reject` hook constraints, лог-ограничения);
  - UI/API: `Policy` = inet-only, `Policy v2` = bridge-only (в рамках этапа);
  - тесты: зелёные `tests/test_api_contract.py`, `webui/tests/firewall-policy-v2-bridge.spec.ts`, `webui/tests/firewall-tables.spec.ts`;
  - runtime: подтверждены apply/reboot/restore без дрейфа на старом стенде.

## Цель
Довести `Firewall -> policy v2` до практически полного покрытия возможностей `bridge` family из `nft`.

## Что уже реализовано (MVP)
- Base: `table`, `chain`, `action`, `enabled`, `comment`
- L2 match: `ibrname`, `obrname`, `ether src`, `ether dst`, `ether type`, `vlan id`
- Ops: `counter`, `log level`, `log prefix`
- Валидации: MAC, ether type (hex/int), vlan range, iface pattern
- Хранение: единый `firewall_rules.json` с `family=bridge`

## Что еще поддерживает bridge по документации (и у нас пока не полностью)

### 1) Base/action ограничения bridge
- `reject` в bridge допустим только в base chain с hook `input` или `prerouting`.
- Проверка chain/hook-type для bridge должна быть строгой в rule editor.

### 2) L2/L3/L4 match в bridge
- `meta l4proto` (`tcp/udp/icmp/icmpv6`) и портовые матчи `sport/dport`.
- Match по `ct state` и другим conntrack полям (там, где это валидно по hook/context).
- Доп. meta-поля: `pkttype`, `mark`, `priority`, `iif/oifgroup`.

### 3) Logging (расширенный)
- `log flags` (например: `tcp sequence`, `tcp options`, `ip options`, `skuid`, `ether`, `all`)
- `log group`
- `log snaplen`
- `log queue-threshold`

### 4) Stateful/statements
- `limit` / `quota` / named `counter`
- `set`/`map`/`vmap` как match и как action-связывание
- `ct helper/timeout/expectation` (когда включим stateful objects в backend API)

### 5) Доп. advanced statements (экспертный слой)
- `queue`, `dup`, `fwd` (с контекстными ограничениями family/hook)
- expression-блоки через structured-конструктор (не raw string только)

## Рекомендуемая реализация по этапам

### Phase B1 (Core+)
- Добавить `proto/sport/dport` + `ct state` для bridge.
- Ввести bridge-ограничение для `reject` (input/prerouting only).
- Расширить `log` (flags/group/snaplen/queue-threshold).

### Phase B2 (Stateful)
- Включить managed named objects: `counter/quota/limit`.
- Поддержать `ct helper/timeout/expectation` объекты + ссылки в правилах.

### Phase B3 (Expert)
- Добавить `queue/dup/fwd` и расширенный builder expressions.
- Ввести «Expert mode» для редких сценариев.

## UI-решение (рекомендуется)
- Оставить один `Add Bridge Rule (Policy v2)`, но сделать вкладки:
1. Base
2. L2/L3/L4
3. Conntrack/Meta
4. Action/Logging
5. Statistics
- Поля показывать контекстно по chain/hook/family.

## Критерий «bridge 100% для продукта»
- Не «100% всей грамматики nft», а:
1. Все частые production-сценарии покрыты через UI.
2. Валидации и ошибки понятные.
3. Все правила корректно применяются и повторно поднимаются после reboot.
4. E2E тесты закрывают CRUD, apply, reboot, конфликтные комбинации.
