# NTP-001: настройки NTP через storage, API и Web UI

## Цель

Добавить в AWG Manager отдельную настройку NTP, позволяющую пользователю:

- включить или выключить желаемую NTP-конфигурацию;
- хранить упорядоченный список NTP-серверов;
- прочитать и изменить настройку через HTTP API;
- изменить её через Web UI;
- после перезагрузки страницы получить сохранённые значения.

## Важное продуктовое ограничение

Эта задача — **storage-only MVP**.

Она не должна:

- менять `chrony`, `systemd-timesyncd`, `ntpd` или другой сервис ОС;
- выполнять shell-команды NTP;
- показывать «Applied» или «Synchronized»;
- выдавать сохранённую желаемую конфигурацию за runtime-состояние.

Runtime apply/status сделать отдельной будущей задачей после выбора поддерживаемого
NTP backend.

## Обязательное чтение

- `AGENTS.md`;
- `docs/development/START_HERE.ru.md`;
- `docs/development/MODULE_MAP.ru.md`;
- `docs/agents/PRODUCT_UI.ru.md`;
- `docs/agents/MODULE_WORKFLOW.ru.md`.

## Контекст и аналоги

- backend storage/service boundaries: изучить `backend/domains/firewall` и
  `backend/domains/ipsec`, выбрать минимальный подход;
- HTTP boundary: `backend/app/router.py`;
- frontend API client:
  `webui/src/frontend/domains/<domain>/api.ts`;
- frontend form/layout: выбрать один ближайший текущий экран и повторить его
  паттерн;
- не копировать legacy-код.

## Scope

### Backend

Создать HTTP-neutral домен:

```text
backend/domains/ntp/
├── __init__.py
├── service.py
├── store.py
└── validation_ops.py
```

Допускается другое минимальное разбиение, если обязанности не смешаны.

Хранилище:

```text
${AWG_MANAGER_DATA_DIR}/ntp.json
```

Использовать существующие safe JSON/path helpers из `backend/common`, если они
подходят. Не создавать второй общий helper без необходимости.

Нормализованная модель:

```json
{
  "enabled": false,
  "servers": []
}
```

Правила:

- `enabled` — boolean;
- `servers` — список строк;
- trim пробелов;
- пустые строки удаляются;
- дубликаты удаляются с сохранением первого порядка;
- максимум 8 серверов;
- каждый элемент — hostname, IPv4 или IPv6 разумной длины;
- запись должна быть атомарной;
- отсутствие файла возвращает значения по умолчанию.

### API

Добавить:

```text
GET /ntp
PUT /ntp
```

Пример успешного чтения:

```json
{
  "ok": true,
  "item": {
    "enabled": false,
    "servers": []
  }
}
```

`PUT /ntp` принимает:

```json
{
  "enabled": true,
  "servers": [
    "0.pool.ntp.org",
    "1.pool.ntp.org"
  ]
}
```

После сохранения вернуть нормализованный объект.

Требования:

- использовать текущий `X-API-Key`;
- validation error → понятный `400`;
- не раскрывать storage path в ответе;
- не добавлять `/api/ntp`;
- не добавлять Apply endpoint в этой задаче.

### Frontend

Создать:

```text
webui/src/frontend/domains/ntp/api.ts
webui/src/pages/ntp.tsx
webui/tests/ntp.spec.ts
```

Минимально подключить страницу в `webui/src/App.tsx`.

Для примера задачи разрешён новый верхнеуровневый пункт `NTP` рядом с текущими
разделами. Не менять порядок, стиль, ширину sidebar и другие маршруты.

Экран:

- заголовок `NTP`;
- короткое пояснение, что это сохранённая конфигурация;
- enabled control на существующем UI-паттерне;
- список серверов;
- добавить строку;
- удалить строку;
- одна primary-кнопка `Save`;
- loading/error/saving/success;
- после reload значения сохраняются;
- никакой кнопки `Apply` и статуса синхронизации.

Не подключать новую component library. Переиспользовать текущие компоненты.

### Документация

Обновить существующий API reference:

```text
docs/reference/API.md
```

Создать один новый пользовательский guide, потому что функции раньше не было:

```text
docs/user/ntp.ru.md
```

Использовать `docs/user/GUIDE_TEMPLATE.ru.md`.

Не создавать:

```text
NTP_PLAN.md
NTP_DESIGN.md
NTP_API.md
NTP_UI.md
NTP_REPORT.md
```

## Ожидаемые изменяемые файлы

```text
backend/domains/ntp/*
backend/app/router.py
webui/src/frontend/domains/ntp/api.ts
webui/src/pages/ntp.tsx
webui/src/App.tsx
webui/tests/ntp.spec.ts
webui/dist/*
tests/test_ntp_*.py
tests/test_api_contract.py
docs/reference/API.md
docs/user/ntp.ru.md
docs/development/MODULE_MAP.md
docs/development/MODULE_MAP.ru.md
```

Если фактическая архитектура требует другой файл, объяснить это в результате.
Не менять Firewall, IPsec и AWG behavior.

## Acceptance criteria

- [ ] `GET /ntp` возвращает defaults при отсутствии файла.
- [ ] `PUT /ntp` сохраняет и нормализует значения.
- [ ] Невалидный payload не повреждает предыдущую конфигурацию.
- [ ] Повторный `GET` возвращает сохранённые значения.
- [ ] UI загружает текущую конфигурацию.
- [ ] Пользователь может добавить, удалить и сохранить сервер.
- [ ] Reload сохраняет результат.
- [ ] UI не утверждает, что конфигурация применена к ОС.
- [ ] Соседние маршруты работают как раньше.
- [ ] `webui/dist` обновлён.
- [ ] API и user guide соответствуют фактическому поведению.

## Проверки

Минимум:

```bash
python3 -m pytest -q tests/test_ntp_store.py
python3 -m pytest -q tests/test_ntp_service.py
python3 -m pytest -q tests/test_api_contract.py
python3 -m pytest -q tests

cd webui
npm run build
npx playwright test tests/ntp.spec.ts
```

Если имена тестов отличаются, указать фактические команды.

## Передача владельцу

Владелец не должен повторно проверять API и persistence.

Агент обязан показать только продуктовые вопросы, например:

```text
1. Достаточно ли заметно пояснение, что Save пока не применяет NTP к ОС?
2. Удобно ли расположение списка серверов относительно enabled control?
```

Не придумывать третий вопрос, если его нет.
