# Навигатор по документации (RU)

Этот файл — быстрый указатель по документации проекта: что читать, в каком порядке и для каких задач.

## С чего начать

1. [README.ru.md](../../README.ru.md) — общий обзор, быстрый запуск, ключи, базовые команды.
2. [DEPLOY.md](../operations/DEPLOY.md) — развёртывание, systemd, restore-сервис, прод-поток.
3. [STAND_SETUP_FIXES.md](../operations/STAND_SETUP_FIXES.md) — журнал реальных проблем при развёртывании стенда и точные исправления.
4. [API.md](../reference/API.md) — HTTP API (эндпоинты, форматы, авторизация).

## Документация по Firewall

- [FIREWALL_TESTPLAN.md](../testing/FIREWALL_TESTPLAN.md) — общий жёсткий план тестирования Firewall (UI/API/NFT).
- [FIREWALL_ADD_RULE_TESTPLAN.md](../testing/FIREWALL_ADD_RULE_TESTPLAN.md) — детальный тест-план именно для окна `Add Firewall Rule`.
- [FIREWALL_ADD_RULE_FIELDS_INVENTORY.md](../development/firewall/FIREWALL_ADD_RULE_FIELDS_INVENTORY.md) — матрица полей Add Rule: что реализовано/покрыто/запланировано.
- [FIREWALL_ADD_RULE_GUIDE.ru.md](../user/firewall/add-rule.ru.md) — практическое руководство по полям Add Rule на русском.
- [FIREWALL_ADD_RULE_GUIDE.md](../user/firewall/add-rule.md) — то же на английском.
- [FIREWALL_BRIDGE_100_PLAN.ru.md](../development/firewall/FIREWALL_BRIDGE_100_PLAN.ru.md) — план и текущий статус по `Policy v2 (bridge)` (B1/B2/B3).
- [FIREWALL_OBJECTS_UI_PLAN.ru.md](../development/firewall/FIREWALL_OBJECTS_UI_PLAN.ru.md) — понятный план по вкладке `Objects`: что это за сущности, где кнопки/модалки, как влияет на трафик.

## Документация по IPsec

- [IPSEC_LIVE_VALIDATION.md](../testing/IPSEC_LIVE_VALIDATION.md) — live-проверки IPsec/VICI/MikroTik: какие UI-поля реально работают, какие ограничены режимом, а какие выглядят как бутафория.

## Планирование и контроль качества

- [FIREWALL_ADD_RULE_IMPLEMENTATION_PLAN.md](firewall-plans/FIREWALL_ADD_RULE_IMPLEMENTATION_PLAN.md) — roadmap реализации.
- [FIREWALL_ADD_RULE_PHASE1_BUGLIST.md](firewall-plans/FIREWALL_ADD_RULE_PHASE1_BUGLIST.md) — backlog багов/доработок.
- [PRE_RELEASE_CHECKLIST.md](../testing/PRE_RELEASE_CHECKLIST.md) — чеклист перед релизом.

## Документация по разработке (архитектура/рефакторинг)

- [development/README.md](../development/README.md) — индекс dev-документации.
- [development/MODULE_MAP.ru.md](../development/MODULE_MAP.ru.md) — карта модулей и ответственности функций/методов (RU).
- [development/MODULE_MAP.md](../development/MODULE_MAP.md) — module ownership map (EN).

## Справочные материалы по nftables

- [NFT.md](../reference/NFT.md) — рабочая справка по nft (CLI/синтаксис/выражения).
- [libnftables-json-ManPage.md](../reference/libnftables-json-ManPage.md) — справка по JSON-представлению libnftables.

## Тесты: где смотреть

- [TESTS_CATALOG.ru.md](../testing/TESTS_CATALOG.ru.md) — полный каталог тестов проекта:
  - где лежат;
  - что проверяют;
  - как запускать (локально и на стенде).
