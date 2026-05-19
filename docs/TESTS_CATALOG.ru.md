# Каталог тестов (RU)

Этот документ описывает все текущие тесты проекта: расположение, назначение и команды запуска.

## 1) Backend/API тесты (Python)

Путь:
- `tests/test_api_contract.py`

Назначение:
- контрактные проверки API;
- базовая проверка форматов ответов/ошибок.

Запуск:
```bash
cd /path/to/awg-manager
python3 -m pytest tests/test_api_contract.py -q
```

## 2) Recovery-тест (shell)

Путь:
- `scripts/test_firewall_add_rule_recovery.sh`

Назначение:
- проверка восстановления firewall-правил после рестарта сервиса/перезагрузки сценария.

Запуск:
```bash
cd /path/to/awg-manager
bash scripts/test_firewall_add_rule_recovery.sh
```

## 3) Web UI E2E (Playwright)

Путь:
- `webui/tests/*.spec.ts`

Базовая конфигурация:
- `webui/playwright.config.ts`
- `webui/tests/global-setup.ts`
- `webui/tests/helpers.ts`

### 3.1 Auth / Navigation / Lifecycle

- `auth-and-nav.spec.ts` — вход и базовая навигация UI.
- `auth-rotate.spec.ts` — rotate API key, повторный вход/валидность ключа.
- `full-lifecycle.spec.ts` — интеграционный жизненный цикл (интерфейсы/клиенты/API/UI).

### 3.2 Interfaces / Clients

- `interfaces-form.spec.ts` — форма создания/валидация интерфейсов.
- `interfaces-edge.spec.ts` — edge-кейсы интерфейсов (дубли, конфликты, ошибки).
- `clients-edge.spec.ts` — edge-кейсы клиентов (IP, конфиги, удаление и т.д.).

### 3.3 Firewall — core tabs

- `firewall-rules.spec.ts` — smoke по правилам firewall.
- `firewall-maps.spec.ts` — CRUD/enable/disable для maps.
- `firewall-tables.spec.ts` — CRUD таблиц/цепочек firewall.
- `firewall-policy-dnd.spec.ts` — drag&drop reorder правил в `filter`/`nat`/`raw`/`mangle` с проверкой фактического порядка через API.

### 3.4 Firewall Add Rule — strict suite

- `firewall-add-rule-fields-completeness.spec.ts` — структура модалки/вкладок/контролов.
- `firewall-add-rule-validation.spec.ts` — строгая валидация невалидных input.
- `firewall-add-rule-context.spec.ts` — матрица table/chain/action.
- `firewall-add-rule-toggle-semantics.spec.ts` — поведение `+/-` контролов.
- `firewall-add-rule-action-stats.spec.ts` — Action/Statistics слой.
- `firewall-add-rule-runtime-fields.spec.ts` — runtime-поля и их сохранение.
- `firewall-add-rule-nft-equivalence.spec.ts` — эквивалентность payload ↔ `nft list ruleset`.
- `firewall-add-rule-negative-fuzz.spec.ts` — batch-негативные сценарии.
- `firewall-add-rule-race.spec.ts` — race/double-click/параллельные create.
- `firewall-add-rule-wired-fields.spec.ts` — проверка wired-полей.
- `firewall-add-rule-stats-visual.spec.ts` — визуальная часть статистики.
- `firewall-add-rule-block-a.spec.ts` — Block A (`raw_expr`, `nftrace`, `notrack`).
- `firewall-add-rule-block-b.spec.ts` — Block B базовый.
- `firewall-add-rule-block-b2.spec.ts` ... `block-b12.spec.ts` — расширенные блоки Add Rule (meta/ct/L2/time и др.).

## 4) Как запускать тесты

### 4.1 Локально (UI E2E)

```bash
cd /path/to/awg-manager/webui
npm install
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8787/ui/ \
PLAYWRIGHT_API_KEY="$(cat /etc/wg-manager/api.key)" \
npx playwright test
```

### 4.2 На малом VPS (рекомендованный режим)

```bash
cd /root/awg-manager/webui
PLAYWRIGHT_LOW_MEM=1 \
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8787/ui/ \
PLAYWRIGHT_API_KEY="$(cat /etc/wg-manager/api.key)" \
npx playwright test --workers=1
```

### 4.3 Только Firewall Add Rule suite

```bash
cd /root/awg-manager/webui
PLAYWRIGHT_LOW_MEM=1 \
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8787/ui/ \
PLAYWRIGHT_API_KEY="$(cat /etc/wg-manager/api.key)" \
npx playwright test tests/firewall-add-rule-*.spec.ts
```

### 4.4 Полный Firewall пакет (как на стенде)

```bash
cd /root/awg-manager/webui
PLAYWRIGHT_LOW_MEM=1 \
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8787/ui/ \
PLAYWRIGHT_API_KEY="$(cat /etc/wg-manager/api.key)" \
npx playwright test \
  tests/firewall-add-rule-*.spec.ts \
  tests/firewall-rules.spec.ts \
  tests/firewall-maps.spec.ts \
  tests/firewall-tables.spec.ts \
  tests/firewall-policy-dnd.spec.ts
```

## 5) Интерпретация результатов

- Если падает 1–2 теста по timeout в длинном общем прогоне, обязательно перезапустить их изолированно.
- Если изолированно зелёные, чаще всего это infra-flake (нагрузка/память), а не функциональный регресс.
- Для стабильности использовать:
  - `PLAYWRIGHT_LOW_MEM=1`
  - `--workers=1`
  - timeout из `webui/playwright.config.ts` (сейчас `60s`).
