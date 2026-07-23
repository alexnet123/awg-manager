# Задачи агентов

`tasks/` — это рабочая зона для стандартизации задач, а не постоянная
документация проекта.

В Git хранятся только шаблоны и этот регламент. Реальные задачи и промежуточные
результаты обычно игнорируются Git.

## Когда использовать `tasks/`

Используйте `tasks/active/<ID>.md`, если задача:

- затрагивает backend и frontend одновременно;
- добавляет новый модуль или меняет архитектурные границы;
- включает runtime side effects: `Apply`, `Restart`, `Reload`, изменение ОС;
- требует стенда, Playwright или нескольких итераций UX;
- может быть продолжена другим агентом позже.

Для маленьких одношаговых правок достаточно чата или issue.

## Быстрый старт

```bash
cp tasks/TASK_TEMPLATE.md tasks/active/<task-id>.md
```

Пример:

```bash
cp tasks/TASK_TEMPLATE.md tasks/active/ntp-clients-status.md
```

Потом заполните файл и дайте агенту команду:

```text
Прочитай AGENTS.md и tasks/active/<task-id>.md.
Работай строго в рамках этой задачи.
Не создавай дополнительные документы.
В конце ответь по tasks/RESULT_TEMPLATE.md.
```

## Минимум, который нужно заполнить

В задаче должны быть понятны:

1. **Цель** — что пользователь сможет сделать.
2. **Контекст и аналог** — ближайший backend/frontend-аналог в проекте.
3. **Scope** — что делаем.
4. **Out of scope** — что точно не трогаем.
5. **Storage** — что сохраняется как desired config и где.
6. **Runtime** — какие действия меняют ОС или сервисы.
7. **API** — новые/изменённые endpoints или `API не меняется`.
8. **UI** — экран, вкладка, primary action, состояния.
9. **Acceptance criteria** — чеклист готовности.
10. **Проверки** — команды тестов/build/стенда.

Если runtime не нужен, укажите явно:

```text
Только storage/UI. Не изменять конфигурацию ОС и не имитировать Apply.
```

## Skills

Если задаче нужен конкретный skill, укажите его прямо в начале task-файла.

Пример:

```text
Skills:
- $awg-manager-ui-style — для AWG Manager UI и компактного operator-стиля.
- @superpowers — внешний Codex plugin для discovery/design, планирования,
  systematic debugging, review и verification сложной реализации.
```

Правило:

- UI-задачи AWG Manager должны ссылаться на `$awg-manager-ui-style`;
- новые модули, крупные UI/backend изменения и неоднозначные bugfix лучше
  начинать с `@superpowers`: сначала design/approval, затем план и реализация;
- для расследования багов указывайте `@superpowers`, если нужен systematic
  debugging вместо быстрого очевидного патча;
- если skill недоступен, агент должен использовать ближайший кодовый аналог:
  Firewall, IPsec, Interfaces, Clients или NTP.

## Каркас нового модуля

Перед реализацией нового модуля в задаче нужно зафиксировать:

- ближайший backend-аналог;
- ближайший frontend-аналог;
- scope и out-of-scope;
- desired config;
- runtime status;
- runtime actions;
- API-контракт;
- UI-сценарий;
- документацию, которую нужно обновить.

### Backend

Ориентировочный каркас домена:

```text
backend/domains/<domain>/
├── __init__.py
├── service.py
├── store.py или repository.py
├── validation_ops.py
├── schema.py
└── runtime_adapter.py
```

Не каждый модуль обязан иметь все файлы. Маленький модуль может начаться с
`service.py` и `store.py`, если границы ясны.

Правила:

- HTTP остаётся в `backend/app/*`;
- домен должен быть HTTP-neutral;
- домен не импортирует другие домены;
- side effects ОС выполняются только через runtime adapter;
- `Save` и `Apply` разделяются, если их эффект отличается.

### Frontend

Ориентировочный каркас:

```text
webui/src/frontend/domains/<domain>/api.ts
webui/src/pages/<domain>.tsx
webui/src/pages/<domain>/*
webui/tests/<domain>.spec.ts
```

Правила:

- API details держать в domain API client;
- UI собирать из `webui/src/components/ui`;
- визуальный аналог указывать в задаче;
- не менять sidebar/layout/theme без явного scope;
- после frontend-изменений обновлять `webui/dist`, если задача не ограничена
  локальными исходниками.

## Документация модуля

Детали модуля не нужно дублировать в `AGENTS.md`.

Куда писать:

- ownership и границы: `docs/development/MODULE_MAP.md` и
  `docs/development/MODULE_MAP.ru.md`;
- wire/API-контракт: `docs/reference/API.md`;
- пользовательский смысл полей и сценариев: `docs/user/`;
- правила разработки модулей: `docs/agents/MODULE_WORKFLOW.ru.md`.

Новые постоянные `.md` создаются только если нет канонического места и документ
будет поддерживаться.

## UX feedback

Для серии замечаний по экрану используйте `tasks/UX_FEEDBACK_TEMPLATE.md`.

Один файл/сообщение может покрывать несколько связанных замечаний одного экрана.
Не создавайте отдельный документ на каждую кнопку.

## Рабочий цикл

```text
Issue или tasks/active/<ID>.md
        ↓
один агент / один workspace / одна ветка
        ↓
дизайн и approval, если задача продуктовая или неоднозначная
        ↓
код + тесты + стенд, если нужно
        ↓
результат по RESULT_TEMPLATE в PR/чате
        ↓
до 3 продуктовых вопросов владельцу
        ↓
правки по UX_FEEDBACK_TEMPLATE
        ↓
merge или локальное завершение
```

## Результат задачи

Не коммитьте отдельный report-файл.

Финальный ответ агент пишет по `tasks/RESULT_TEMPLATE.md`:

- что сделано;
- ключевые файлы;
- API;
- storage/runtime semantics;
- проверки с фактическими командами;
- стенд, если был deploy;
- известные ограничения;
- что должен оценить владелец продукта.

## Что не хранить в Git

Не превращайте временную работу в постоянную документацию.

Обычно не коммитятся:

- `tasks/active/*`;
- `tasks/results/*`;
- промежуточные планы;
- отчёты одного запуска тестов;
- временные UX-заметки;
- черновики решений, которые ещё не приняты.
