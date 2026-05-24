# Bridge 100% Plan (RU)

## Статус
- Sprint 1 (B1+ hardening): завершён в `dev` (commit `230a16e`) — bridge-only `Policy v2`, strict validation, E2E/API gate, reboot-restore проверка на стенде `132.243.237.120`.
- B2 (`limit/quota/named counter`, `ct helper/timeout/expectation`): в работе.
  - готово: `counter_name`, `limit_name`, `quota_name`, `ct_helper_set`, `ct_timeout_set`;
  - временно отключено для bridge: `ct_expectation_set` и объект `ct_expectation` (статус planned).

## Этап Сейчас (Коротко)
- Текущий рабочий этап: **B3 (Expert)**
- Что делаем прямо сейчас: стабилизация bridge advanced-полей + тестовый gate.
- Следующий контрольный рубеж: закрыть оставшиеся пункты B3 и зафиксировать повторный e2e/runtime прогон на старом стенде.

## Прогресс По Этапам

| Этап | Статус | Прогресс | Что уже закрыто | Что осталось |
|---|---|---:|---|---|
| B1 (Core+) | ✅ done | 100% | bridge policy v2 MVP, строгие валидации, reject/hook ограничения, базовые e2e/api/regression | — |
| B2 (Stateful) | 🟡 in progress | 85% | named objects (`counter/limit/quota`), ссылки `counter_name/limit_name/quota_name`, `ct_helper_set`, `ct_timeout_set`, object->rule UX | `ct_expectation` для bridge (runtime planned/disabled), финальный док+gate по B2 |
| B3 (Expert) | ✅ done (current runtime profile) | 100% | `queue` + валидации (`fanout` -> range), bridge meta/mark (`meta_pkttype`, `meta_iifgroup`, `meta_oifgroup`, `mark_match`, `ct_mark_match`), planned-ограничения для structured expressions + `dup/fwd` с UX-пояснениями, расширенный стенд-gate пройден | runtime-enable structured expressions/`dup` при подтверждении совместимости nft на отдельном этапе |

## B3 Чеклист (Оперативный)
- [x] `queue` (UI/API/backend/runtime) + негативные проверки
- [x] bridge `meta/mark` поля в форме и API (`meta_pkttype`, `meta_iifgroup`, `meta_oifgroup`, `mark_match`, `ct_mark_match`)
- [x] structured expression-builder (без raw-only сценария) / либо финальная planned-логика при runtime-ограничении
- [x] решение по `dup/fwd` (либо runtime-enable, либо окончательная policy/planned-логика с UX-пояснением)
- [x] финальный B3 gate: API + UI e2e + apply/reboot/restore на старом стенде

## Журнал этапов
- 2026-05-24: B3 финальный стенд-gate (`132.243.237.120`):
  - `webui build`: ✅ (`NODE_OPTIONS=--max-old-space-size=2048 npm run build`);
  - `webui/tests/firewall-policy-v2-bridge.spec.ts`: ✅ `25/25`;
  - runtime: ✅ `POST /firewall/apply`;
  - recovery: ✅ `scripts/test_firewall_add_rule_recovery.sh`;
  - reboot/restore: ✅ `scripts/reboot_smoke.sh root@132.243.237.120 180`.
- 2026-05-24: B3 runtime уточнение по structured expressions:
  - на стенде `132.243.237.120` bridge structured expressions (`fib_check`, `socket_match`, `rt_nexthop`, `ipv6_exthdrs`) проходят базовую валидацию, но падают на `nft -f -` apply;
  - временное product-решение: для bridge вернуть их в planned/disabled с явной backend-ошибкой до apply и UX-пояснением в редакторе;
  - оставшийся пункт B3: либо runtime-enable после подтверждения совместимости, либо окончательная фиксация planned-стратегии в gate.
- 2026-05-24: B3 (dup/fwd strategy finalized as planned):
  - решение: для bridge сохраняем planned-режим (`dup` отключён из-за runtime-ограничений, `fwd` остаётся netdev-only);
  - UI: в модалке `Add/Edit Bridge Rule` добавлено явное UX-пояснение по `dup/fwd`;
  - тесты: добавлен UI e2e-кейс, проверяющий видимость planned-статуса и пояснений.
- 2026-05-24: B3 (structured expert expressions for bridge):
  - backend: для `family=bridge` разрешены structured expression-поля `fib_check`, `socket_match`, `rt_nexthop`, `ipv6_exthdrs` (без `raw_expr`);
  - UI/API: в `Policy v2` (bridge rules) добавлен structured expression-блок в модалке `Add/Edit Bridge Rule`, а в таблице правил добавлена колонка `Expr`;
  - тесты: добавлен API-тест на позитив/негатив для structured expression-полей.
- 2026-05-24: B3 (bridge meta/mark hardening):
  - backend (Policy v2 bridge): включены `meta_pkttype`, `meta_iifgroup`, `meta_oifgroup`, `mark_match`, `ct_mark_match` (убраны из bridge-disallowed);
  - UI/API: поля добавлены в форму `Add/Edit Bridge Rule` и в типы API;
  - тесты: добавлен API-тест на позитив/негатив для `meta_pkttype` и `mark_match`.
- 2026-05-24: B3 (частично) для bridge:
  - backend: добавлены `action=queue`, поля `queue_num`, `queue_flags` (`bypass|fanout`);
  - backend: добавлены строгие проверки для `queue` (включая `fanout` -> обязательный диапазон), несовместимые `dup_*`/`fwd_*` в bridge отклоняются как planned/runtime-limited;
  - UI/API: в `Policy v2` (bridge rules) добавлены поля Queue и отображение queue в таблице правил; `dup`/`fwd` отмечены planned;
  - тесты: добавлены API/e2e кейсы для queue и отрицательные кейсы для `dup`/`fwd` в bridge.
- 2026-05-23: старт B2:
  - backend: включены `limit_rate` для `family=bridge`, именованные поля `counter_name/limit_name/quota_name`;
  - backend: включены ссылки `ct_helper_set/ct_timeout_set/ct_expectation_set` с runtime-проверкой существования named objects в выбранной bridge-таблице;
  - UI/API: в `Policy v2` добавлены поля B2 и взаимные ограничения (`counter` vs `counter_name`, `limit_rate` vs `limit_name`);
  - тесты: добавлены e2e кейсы для `limit_rate` и ошибок отсутствующих named objects.
- 2026-05-23: B2 уточнение по runtime:
  - подтверждено, что `ct_expectation` в bridge-контексте на текущем ядре/стеке даёт `nft Invalid argument`;
  - решение: в `Policy v2` для bridge оставить `ct_expectation` в состоянии planned (UI disabled + backend reject с явной ошибкой), чтобы не было ложного ощущения, что поле рабочее;
  - рабочими остаются `ct_helper_set` и `ct_timeout_set`.
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
