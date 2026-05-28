# START HERE (RU)

Обновлено: 2026-05-28

Эта страница — быстрый онбординг для любого инженера/агента, который подключается к разработке в этом репозитории.

## 1) Цель и ограничения

- Сохранять внешнее поведение стабильным (без wire/API breaking changes без явного согласования).
- Работать в текущем изолированном workspace и текущей ветке.
- Параллельная разработка — базовый режим (`firewall` и `ipsec` могут развиваться независимо).

Источники истины:
- `AGENTS.md`
- `docs/development/MODULE_MAP.md`
- `docs/development/MODULE_MAP.ru.md`
- `docs/REFRACTOR_PROGRESS.ru.md`

## 2) Чеклист первых 5 минут

1. Полностью прочитать `AGENTS.md`.
2. Прочитать `docs/development/MODULE_MAP.md` (владение и границы).
3. Запустить базовые проверки:
   - `git branch --show-current`
   - `git status --short`
   - `python3 -m pytest -q tests/test_api_contract.py`
4. Подтвердить свой контур задачи:
   - изменение поведения `firewall`
   - структурный рефакторинг `ipsec` (feature-поток на паузе)
   - cleanup legacy-compat (`backend/app/legacy_manager_compat.py`)

## 3) Архитектурные ограничения

- `backend/app/*` — единственная граница HTTP и ошибок.
- Доменные модули HTTP-neutral.
- Междоменные импорты запрещены.
- Доменам разрешены импорты только из `backend/common` и собственного пакета.
- Новая логика идет в `backend/common` или `backend/domains/*`, а не в legacy compatibility модули.

## 4) Definition Of Done (DoD)

Шаг рефакторинга считается завершенным только если выполнено все:

1. Кодовые изменения завершены и ограничены по объему.
2. Обновлена документация владения (RU+EN для `docs/development/`).
3. В `docs/REFRACTOR_PROGRESS.ru.md` добавлена запись о прогрессе.
4. Выполнены проверки:
   - `python3 -m pytest -q tests/test_firewall_rule_ops.py` (или релевантная целевая замена)
   - `python3 -m pytest -q tests/test_api_contract.py`
   - `python3 -m pytest -q tests`
   - Если менялись `backend/app/legacy_manager_compat.py` или `backend/app/manager_facade.py`:
     - `python3 -m pytest -q tests/test_manager_access_facade.py`
5. Если какая-то проверка пропущена, причина явно зафиксирована в прогресс-заметке.

## 5) Playbook-ы

### A) Playbook для изменений Firewall

1. Найти код в `backend/domains/firewall/*` и связанном frontend domain API.
2. Если затрагивается поведение, сначала добавить/обновить узкий тест.
3. Внести минимальное изменение в domain/common слои.
4. Проверить, что router/wire-контракт не изменился.
5. Прогнать test gate и зафиксировать прогресс.

### B) Playbook для структурных изменений IPsec (без новых фич)

1. Ограничить работу структурным split/adapter/boundary улучшением.
2. Сохранить wire-формат и статусы `/api/ipsec/*`.
3. Не добавлять новое IPsec-поведение в этом цикле.
4. Прогнать контрактные и полный набор тестов.
5. Обновить module maps и progress log.

### C) Playbook для `legacy_manager_compat.py` / `manager_facade.py`

1. Предпочитать прямую доменную проводку вместо новых локальных wrapper-ов.
2. Сохранять fallback-поведение через существующие facade-паттерны.
3. Не добавлять новую бизнес-логику в `backend/app/legacy_manager_compat.py`.
4. Прогнать `tests/test_manager_access_facade.py` и стандартный gate.
5. Зафиксировать перенос ответственности в module map и progress log.

## 6) Частые ошибки

- Смешивание структурного рефакторинга и несвязанных feature-изменений в одном шаге.
- Случайное изменение формата payload или текстов/кодов ответов API.
- Обновление только RU или только EN документации в `docs/development/`.
- Использование legacy-путей, когда уже есть domain-first путь.

## 7) Мини-шаблон записи прогресса

Использовать в `docs/REFRACTOR_PROGRESS.ru.md`:

- Scope шага:
- Что перенесено по ответственности:
- Какой legacy entrypoint теперь делегирует куда:
- Команды верификации:
- Краткий итог:
- Что пропущено и почему (если есть):
