# Add Rule vs libnftables-json: матрица покрытия и размещение в UI (RU)

Документ нужен для двух задач:

1. Понять, что уже покрыто относительно `libnftables-json-ManPage.md`.
2. Понять, **куда именно в Add Rule UI** добавлять недостающие возможности.

---

## 1) Быстрый итог по покрытию

- Оценка текущего покрытия полной модели `libnftables-json`: **~27%**.
- Покрытие “частых практических кейсов” firewall: **~45–55%**.

Почему разница:
- Практический слой (типовые filter/nat/mangle/raw правила) у нас уже сильный.
- Полный JSON AST/grammar `libnftables` значительно шире (выражения, stateful objects, named objects, транзакционные команды, расширенные statement-типы).

---

## 2) Матрица по крупным блокам

### A. Rule core (match/action)

- Статус: **partial-high**
- Что есть:
  - table/chain/action
  - proto/src/dst/sport/dport
  - ct state
  - jump/goto/reject/nat core
  - mark set/match
- Что не хватает:
  - полноценная логика операторов сравнения (не только implicit match)
  - часть редких statement/action вариантов

Куда в UI:
- `Base match` — простые match (ip/proto/port/interface/state/time/uid/dscp/marks)
- `Action` — verdict/nat/reject/log/mark-set

---

### B. Advanced match expressions (meta/ct/fib/socket/exthdr/L2)

- Статус: **partial**
- Что есть:
  - значимая часть meta/ct/L2/fib/socket/exthdr полей
- Что не хватает:
  - более полная параметризация выражений
  - дополнительные редкие поля и режимы сравнения

Куда в UI:
- `Advanced match` (подсекции):
  - `Meta`
  - `Conntrack`
  - `Routing / socket / fib`
  - `L2`

---

### C. Full expression tree (AST)

- Статус: **low**
- Что не хватает:
  - `concat`, `range`, `map expr`, `set expr`
  - бинарные операции (`&`, `|`, `^`, `<<`, `>>`)
  - вложенные составные выражения

Куда в UI:
- Новый блок внутри `Advanced match`:
  - `Expression Builder (AST)` с режимами:
    - `Simple` (текущие поля)
    - `Advanced JSON/AST` (структурный редактор)
- Важно: не смешивать AST-конструктор с простыми полями в одном визуальном слое.

---

### D. Stateful objects (named ct/helper/timeout/expectation, named limit/quota/counter/flowtable)

- Статус: **low**
- Что не хватает:
  - полноценный lifecycle named objects
  - безопасная привязка из rules к этим объектам

Куда в UI:
- Отдельные вкладки справа от `tables/maps/sets`:
  - `Objects`
  - Внутренние табы:
    - `ct helper`
    - `ct timeout`
    - `ct expectation`
    - `limit`
    - `quota`
    - `counter`
    - `flowtable`
- В `Add Rule` оставить только reference-поля (выбор созданного объекта).

---

### E. Logging / limit / queue / meter / dup / fwd / queue

- Статус: **low-mid**
- Что есть:
  - log (базовый), limit (базовый), counter
- Что не хватает:
  - расширенные параметры log/limit
  - `queue`, `meter`, `dup`, `fwd`, другие action statements

Куда в UI:
- `Action`:
  - существующий блок `Logging`
  - новый блок `Traffic actions` (`queue`, `dup`, `fwd`, `meter`)
  - новый блок `Rate/limit advanced`

---

### F. Set/map/vmap data model (типы/flags/policy/timeout/comment)

- Статус: **partial-low**
- Что есть:
  - базовые sets/maps/vmaps CRUD
- Что не хватает:
  - полный типовой конструктор
  - flags/policy/timeout/expires/comment lifecycle
  - строгая проверка key/value типов

Куда в UI:
- Вкладки `sets` и `maps`:
  - добавить режимы:
    - `Basic`
    - `Advanced options`
  - в `Advanced` вынести flags/typeof/policy/timeout/comment.

---

### G. JSON command plane (generic libnftables commands)

- Статус: **low**
- Что не хватает:
  - полный слой команд `add/create/insert/replace/delete/list/reset/flush/rename` как универсальный JSON-интерфейс

Куда в UI:
- Не в `Add Rule`.
- Отдельный “power-user” раздел:
  - `JSON Console` (подтверждения/валидация/preview)
  - только для админ-режима.

---

## 3) Куда добавлять функции в Add Rule: финальная схема

Чтобы UI не развалился, придерживаемся жёсткой раскладки:

1. `Base match`
- Простейшие и самые частые условия:
  - ip/proto/port/interface/state
  - uid/hour/dscp
  - packet/ct mark match

2. `Advanced match`
- Всё, что требует специфики nft:
  - meta/ct расширенные
  - fib/socket/rt/exthdr
  - L2
  - AST builder (отдельный режим)

3. `Action`
- Что происходит при match:
  - verdict/nat/reject
  - log/limit/counter
  - queue/dup/fwd/meter (после внедрения)
  - set/ct-object references

4. `Statistics`
- Только наблюдаемость:
  - counter runtime
  - pps/bps
  - график/сброс

---

## 4) Приоритетный roadmap до 50%+

### Этап 1 (быстрый прирост, низкий риск)

- Доделать расширенные log/limit параметры.
- Доработать sets/maps advanced options (flags/policy/timeout/comment).
- Добавить references на named objects (без полного AST).

Ожидаемое покрытие: **~35–40%**.

### Этап 2 (средний риск, большой прирост)

- Вкладка `Objects` (ct helper/timeout/expectation, limit/quota/counter/flowtable).
- Action integration с reference-полями.

Ожидаемое покрытие: **~45–50%**.

### Этап 3 (сложный)

- `Expression Builder (AST)` для сложных выражений.
- Частичный round-trip JSON для rules.

Ожидаемое покрытие: **~55–65%**.

---

## 5) Что важно не делать

- Не добавлять всё подряд в `Base match` — он должен оставаться простым.
- Не смешивать raw JSON с обычными полями без режима/переключателя.
- Не добавлять stateful objects в Add Rule “вручную строкой”; сначала нужен lifecycle этих объектов во вкладке `Objects`.

---

## 6) Связанные документы

- [libnftables-json-ManPage.md](../../reference/libnftables-json-ManPage.md)
- [NFT.md](../../reference/NFT.md)
- [FIREWALL_ADD_RULE_FIELDS_INVENTORY.md](FIREWALL_ADD_RULE_FIELDS_INVENTORY.md)
- [FIREWALL_ADD_RULE_IMPLEMENTATION_PLAN.md](../../archive/firewall-plans/FIREWALL_ADD_RULE_IMPLEMENTATION_PLAN.md)
- [FIREWALL_ADD_RULE_TESTPLAN.md](../../testing/FIREWALL_ADD_RULE_TESTPLAN.md)
- [FIREWALL_LIBNFTABLES_FULL_COVERAGE_PLAN.ru.md](FIREWALL_LIBNFTABLES_FULL_COVERAGE_PLAN.ru.md)

---

## Зафиксированное архитектурное решение (priority first)

Перед следующими крупными расширениями зафиксировано решение:
- объединить `sets` и `maps` в единую вкладку **`Collections`**.

Причина:
- это единый класс сущностей для policy-data и lookup-логики;
- снижает дублирование UI/API-логики;
- упрощает дальнейшее покрытие `libnftables-json` (types/flags/policy/timeout/comment).
