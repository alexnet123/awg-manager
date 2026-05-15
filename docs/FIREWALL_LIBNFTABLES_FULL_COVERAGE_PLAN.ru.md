# План доработки Firewall до полного покрытия libnftables-json (RU)

Документ фиксирует долгосрочный план, чтобы не потерять договорённости по развитию Firewall и Add Rule.

Связанный baseline:
- [FIREWALL_ADD_RULE_LIBNFTABLES_GAP_MATRIX.ru.md](FIREWALL_ADD_RULE_LIBNFTABLES_GAP_MATRIX.ru.md)

---

## 1) Текущее состояние (ориентир)

- Покрытие полной модели `libnftables-json`: ~27%
- Покрытие частых практических сценариев: ~45–55%

---

## 2) Целевая архитектура

Нужны два режима работы:

1. `Simple UI`  
- быстрые поля для массовых типовых сценариев;
- минимальный риск ошибок.

2. `Advanced UI / AST`  
- полный конструктор выражений/statement-узлов;
- режим для power-user, максимально близкий к `libnftables-json`.

---

## 3) Этапы реализации

## Этап 0 — Priority First: унификация Sets + Maps в UI

Цель:
- убрать раздвоенную модель управления коллекциями;
- подготовить базу под расширенные `set/map/vmap` возможности из libnftables.

Решение:
- объединить текущие разделы `sets` и `maps` в единую вкладку **`Collections`**.

Структура UI:
- вкладка `Collections`
- внутри переключение/фильтр по типу:
  - `set`
  - `map`
  - `vmap`
- единая таблица (базовый состав колонок):
  - `type`
  - `name`
  - `key type`
  - `value type` (для set можно `—`)
  - `entries`
  - `comment`
  - `enabled`

Почему это first-priority:
- одинаковый жизненный цикл объектов;
- проще масштабировать под flags/policy/timeout/comment;
- меньше дублирования кода и расхождения поведения;
- проще тестировать один общий CRUD-поток.

Ограничения/правила:
- backend формат хранения пока можно оставить совместимым (миграция UI-слоя первой);
- удаление “старых” табов `sets/maps` делать только после e2e регрессии;
- на уровне API сохранить обратную совместимость (адаптер на уровне endpoint/service).

Критерии готовности:
- один экран `Collections` покрывает текущие сценарии `sets` + `maps`;
- e2e набор для `sets/maps` переведён на новый экран;
- старые маршруты/кнопки не ломают существующие сценарии (или дают явный redirect).

---

## Этап A — до ~50%

Цель:
- закрыть большой практический разрыв без сильного усложнения интерфейса.

Сделать:
- расширить `Action`:
  - advanced log/limit;
  - queue/meter/dup/fwd (поэтапно).
- расширить `sets/maps`:
  - flags/policy/timeout/comment;
  - строгие проверки типов.
- усилить валидацию table/chain/field сочетаний до apply.

Куда в UI:
- `Action`
- `sets`
- `maps`

---

## Этап B — вкладка Objects, до ~55–60%

Цель:
- включить stateful layer из libnftables.

Сделать:
- отдельный lifecycle для:
  - `ct helper`
  - `ct timeout`
  - `ct expectation`
  - `limit`
  - `quota`
  - `counter`
  - `flowtable`
- в Add Rule использовать references на объекты вместо “сырых строк”.

Куда в UI:
- новая вкладка `Objects` (с внутренними табами по типам).

---

## Этап C — AST-конструктор, до ~60–70%

Цель:
- покрыть сложные expression tree возможности.

Сделать:
- добавить `Expression Builder`:
  - concat/range/set/map;
  - binary ops (`&`, `|`, `^`, `<<`, `>>`);
  - вложенные выражения;
  - импорт/экспорт JSON-узлов.

Куда в UI:
- `Advanced match` -> режим `AST`.

---

## Этап D — Command Plane, до ~75–85%

Цель:
- приблизиться к полной модели команд `libnftables-json`.

Сделать:
- управление:
  - `add/create/insert/replace/delete/list/reset/flush/rename`
- безопасные подтверждения для destructive-команд.

Куда в UI:
- отдельный раздел `JSON Console`/`Operations` (admin-only).

---

## Этап E — “почти 100%” (enterprise сложность)

Цель:
- максимально полная модель без потерь структуры.

Сделать:
- round-trip fidelity:
  - `UI -> JSON -> nft -> JSON -> UI` без деградации структуры.
- транзакционность:
  - atomic apply, preview diff, rollback.
- полный типовой контракт:
  - все object/field/flag combinations по manpage.
- тесты:
  - unit + integration + e2e + property/fuzz для AST и сериализации.

---

## 4) Что нужно для “100%” по-честному

Фактически это отдельный продуктовый уровень:
- полноценный AST editor;
- универсальный JSON command plane;
- полный lifecycle всех nft objects;
- lossless round-trip;
- строгая типизация и расширенные проверки;
- мощная тестовая инфраструктура.

Итог:
- “100%” достижимо, но очень дорого по времени/поддержке.
- реалистичная цель для production-команды: стабильные 60–80% практической ценности.

---

## 5) Правила внедрения (чтобы не сломать UX)

1. Не перегружать `Base match`: только простые и частые поля.
2. Сложное — только в `Advanced`/`AST`.
3. Stateful objects не писать строками в Add Rule, только через `Objects` + reference.
4. Любой новый блок:
   - сначала schema/validation;
   - потом runtime renderer;
   - потом e2e;
   - потом docs.

---

## 6) Зафиксированное UI-решение по дереву Firewall и кастомным таблицам

### 6.1 Левое меню (древо)

Зафиксировано разветвление текущего пункта `Firewall` на два подпункта:

1. **Policy**  
- правила, Add Rule, counters/statistics, Collections (sets/maps/vmaps).

2. **Topology**  
- управление таблицами/цепочками (`family/table/chain/hook/priority/device`), включая `inet/ip/ip6/bridge/netdev`.

Примечание:
- текущий таб `tables` переносится из основного policy-экрана в `Topology`.

### 6.2 Где показывать новую кастомную таблицу

Функциональное ожидание зафиксировано так:
- после создания кастомной таблицы в `Topology`, она должна быть доступна в `Policy` как контекст для правил;
- в `Policy` появляется **отдельный блок табов кастомных таблиц** (рядом по логике с системными табами `filter/nat/raw/mangle`);
- пользователь создаёт таблицу -> сразу видит её в этом блоке и может переключиться в неё для добавления правил.

### 6.3 Визуальное различие системных и кастомных таблиц

Зафиксировано UI-правило:
- системные таблицы: нейтральный стиль (как сейчас);
- кастомные таблицы: акцентный стиль (не серый), рекомендуемый тон — **тёплый жёлтый/amber**.

Рекомендация по UX:
- добавить легенду/подсказку:
  - `System`
  - `Custom`
- чтобы визуальный цвет не был единственным индикатором (доступность).

### 6.4 Критерии готовности

- в левом меню есть `Firewall -> Policy` и `Firewall -> Topology`;
- в `Topology` создаётся кастомная таблица и цепочка;
- в `Policy` кастомная таблица автоматически появляется в отдельном блоке табов;
- правила в `Policy` сохраняются и применяются в выбранную кастомную таблицу;
- e2e покрывает:
  - create table/chain -> visible in policy tabs,
  - add rule to custom table,
  - delete/disable table and корректное поведение policy-вкладки.

---

## 7) Контрольные документы

- [FIREWALL_ADD_RULE_LIBNFTABLES_GAP_MATRIX.ru.md](FIREWALL_ADD_RULE_LIBNFTABLES_GAP_MATRIX.ru.md)
- [FIREWALL_ADD_RULE_FIELDS_INVENTORY.md](FIREWALL_ADD_RULE_FIELDS_INVENTORY.md)
- [FIREWALL_ADD_RULE_TESTPLAN.md](FIREWALL_ADD_RULE_TESTPLAN.md)
- [TESTS_CATALOG.ru.md](TESTS_CATALOG.ru.md)
