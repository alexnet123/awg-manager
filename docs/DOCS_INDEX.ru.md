# Навигатор по документации (RU)

Этот файл — быстрый указатель по документации проекта: что читать, в каком порядке и для каких задач.

## С чего начать

1. [README.ru.md](../README.ru.md) — общий обзор, быстрый запуск, ключи, базовые команды.
2. [DEPLOY.md](DEPLOY.md) — развёртывание, systemd, restore-сервис, прод-поток.
3. [STAND_SETUP_FIXES.md](STAND_SETUP_FIXES.md) — журнал реальных проблем при развёртывании стенда и точные исправления.
4. [API.md](API.md) — HTTP API (эндпоинты, форматы, авторизация).

## Документация по Firewall

- [FIREWALL_TESTPLAN.md](FIREWALL_TESTPLAN.md) — общий жёсткий план тестирования Firewall (UI/API/NFT).
- [FIREWALL_ADD_RULE_TESTPLAN.md](FIREWALL_ADD_RULE_TESTPLAN.md) — детальный тест-план именно для окна `Add Firewall Rule`.
- [FIREWALL_ADD_RULE_FIELDS_INVENTORY.md](FIREWALL_ADD_RULE_FIELDS_INVENTORY.md) — матрица полей Add Rule: что реализовано/покрыто/запланировано.
- [FIREWALL_ADD_RULE_GUIDE.ru.md](FIREWALL_ADD_RULE_GUIDE.ru.md) — практическое руководство по полям Add Rule на русском.
- [FIREWALL_ADD_RULE_GUIDE.md](FIREWALL_ADD_RULE_GUIDE.md) — то же на английском.
- [FIREWALL_BRIDGE_100_PLAN.ru.md](FIREWALL_BRIDGE_100_PLAN.ru.md) — план и текущий статус по `Policy v2 (bridge)` (B1/B2/B3).
- [FIREWALL_OBJECTS_UI_PLAN.ru.md](FIREWALL_OBJECTS_UI_PLAN.ru.md) — понятный план по вкладке `Objects`: что это за сущности, где кнопки/модалки, как влияет на трафик.

## Планирование и контроль качества

- [FIREWALL_ADD_RULE_IMPLEMENTATION_PLAN.md](FIREWALL_ADD_RULE_IMPLEMENTATION_PLAN.md) — roadmap реализации.
- [FIREWALL_ADD_RULE_PHASE1_BUGLIST.md](FIREWALL_ADD_RULE_PHASE1_BUGLIST.md) — backlog багов/доработок.
- [PRE_RELEASE_CHECKLIST.md](PRE_RELEASE_CHECKLIST.md) — чеклист перед релизом.

## Справочные материалы по nftables

- [NFT.md](NFT.md) — рабочая справка по nft (CLI/синтаксис/выражения).
- [libnftables-json-ManPage.md](libnftables-json-ManPage.md) — справка по JSON-представлению libnftables.

## Тесты: где смотреть

- [TESTS_CATALOG.ru.md](TESTS_CATALOG.ru.md) — полный каталог тестов проекта:
  - где лежат;
  - что проверяют;
  - как запускать (локально и на стенде).
