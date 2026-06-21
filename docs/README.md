# Документация AWG Manager

Этот файл — единственный верхнеуровневый индекс документации.

## Для разработки и AI-агентов

- [development/START_HERE.ru.md](development/START_HERE.ru.md) — быстрый онбординг;
- [development/START_HERE.md](development/START_HERE.md) — development onboarding, EN;
- [development/MODULE_MAP.ru.md](development/MODULE_MAP.ru.md) — границы и владение модулями, RU;
- [development/MODULE_MAP.md](development/MODULE_MAP.md) — module ownership, EN;
- [agents/PRODUCT_UI.ru.md](agents/PRODUCT_UI.ru.md) — устойчивые UI-правила;
- [agents/MODULE_WORKFLOW.ru.md](agents/MODULE_WORKFLOW.ru.md) — стандарт новой функции;
- [agents/DOCUMENTATION_POLICY.ru.md](agents/DOCUMENTATION_POLICY.ru.md) — правила создания и обновления `.md`.

## Для пользователей

- [user/README.md](user/README.md) — индекс руководства пользователя;
- [user/firewall/admin-guide.ru.md](user/firewall/admin-guide.ru.md) — руководство администратора Firewall, RU;
- [user/firewall/add-rule.ru.md](user/firewall/add-rule.ru.md) — добавление firewall rule, RU;
- [user/firewall/add-rule.md](user/firewall/add-rule.md) — Add Firewall Rule, EN;
- [user/firewall/add-rule-field-reference.ru.md](user/firewall/add-rule-field-reference.ru.md) — справочник полей Add Rule, RU;
- [user/GUIDE_TEMPLATE.ru.md](user/GUIDE_TEMPLATE.ru.md) — шаблон пользовательского guide, RU.

Новые пользовательские guides добавляются в этот раздел после реализации функции.

## API и технические справочники

- [reference/API.md](reference/API.md) — HTTP API;
- [reference/NFT.md](reference/NFT.md) — nftables reference проекта;
- [reference/libnftables-json-ManPage.md](reference/libnftables-json-ManPage.md) — внешний libnftables JSON reference.

## Тестирование и релиз

- [testing/TESTS_CATALOG.ru.md](testing/TESTS_CATALOG.ru.md) — каталог тестов;
- [testing/PRE_RELEASE_CHECKLIST.md](testing/PRE_RELEASE_CHECKLIST.md) — release checklist;
- [testing/FIREWALL_TESTPLAN.md](testing/FIREWALL_TESTPLAN.md) — общий firewall test plan;
- [testing/FIREWALL_ADD_RULE_TESTPLAN.md](testing/FIREWALL_ADD_RULE_TESTPLAN.md) — Add Rule test plan;
- [testing/FIREWALL_ADMIN_WALKTHROUGH_TESTPLAN.ru.md](testing/FIREWALL_ADMIN_WALKTHROUGH_TESTPLAN.ru.md) — walkthrough test plan для инструкции администратора;
- [testing/IPSEC_LIVE_VALIDATION.md](testing/IPSEC_LIVE_VALIDATION.md) — live IPsec validation.

## Эксплуатация и стенды

- [operations/DEPLOY.md](operations/DEPLOY.md) — deploy, systemd, restore workflow;
- [operations/PARALLEL_DEVELOPMENT.md](operations/PARALLEL_DEVELOPMENT.md) — параллельная разработка и стенды;
- [operations/STAND_SETUP_FIXES.md](operations/STAND_SETUP_FIXES.md) — реальные проблемы стенда и исправления.

## Активные development-материалы Firewall

- [development/firewall/FIREWALL_CAPABILITY_MATRIX.ru.md](development/firewall/FIREWALL_CAPABILITY_MATRIX.ru.md) — capability matrix;
- [development/firewall/FIREWALL_ADD_RULE_FIELDS_INVENTORY.md](development/firewall/FIREWALL_ADD_RULE_FIELDS_INVENTORY.md) — inventory полей Add Rule;
- [development/firewall/FIREWALL_ADD_RULE_LIBNFTABLES_GAP_MATRIX.ru.md](development/firewall/FIREWALL_ADD_RULE_LIBNFTABLES_GAP_MATRIX.ru.md) — gap matrix по libnftables;
- [development/firewall/FIREWALL_LIBNFTABLES_FULL_COVERAGE_PLAN.ru.md](development/firewall/FIREWALL_LIBNFTABLES_FULL_COVERAGE_PLAN.ru.md) — roadmap покрытия libnftables;
- [development/firewall/FIREWALL_BRIDGE_100_PLAN.ru.md](development/firewall/FIREWALL_BRIDGE_100_PLAN.ru.md) — bridge roadmap;
- [development/firewall/FIREWALL_POLICY3_NETDEV_PLAN.ru.md](development/firewall/FIREWALL_POLICY3_NETDEV_PLAN.ru.md) — netdev roadmap;
- [development/firewall/FIREWALL_OBJECTS_UI_PLAN.ru.md](development/firewall/FIREWALL_OBJECTS_UI_PLAN.ru.md) — objects UI roadmap;
- [development/firewall/FIREWALL_PERFORMANCE_BACKLOG.ru.md](development/firewall/FIREWALL_PERFORMANCE_BACKLOG.ru.md) — performance backlog;
- [development/firewall/FIREWALL_DYNAMIC_SET_STATEMENTS_DESIGN.ru.md](development/firewall/FIREWALL_DYNAMIC_SET_STATEMENTS_DESIGN.ru.md) — dynamic set statements design;
- [development/firewall/FIREWALL_VMAP_RULE_STATEMENTS_DESIGN.ru.md](development/firewall/FIREWALL_VMAP_RULE_STATEMENTS_DESIGN.ru.md) — vmap rule statements design;
- [development/firewall/FIREWALL_FLOWTABLE_DESIGN.ru.md](development/firewall/FIREWALL_FLOWTABLE_DESIGN.ru.md) — flowtable design.

## Архив

- [archive/DOCS_INDEX.ru.md](archive/DOCS_INDEX.ru.md) — прежний индекс документации;
- [archive/firewall-plans/](archive/firewall-plans/) — завершённые планы и исторические buglists Firewall;
- [archive/refactor/](archive/refactor/) — завершённые материалы рефакторинга;
- [archive/superpowers/](archive/superpowers/) — исторические superpowers plans/specs.

`archive/` содержит завершённые планы, исторические buglists, gap matrices и материалы прошлых этапов. Архив не входит в обязательный контекст агента.

## Правило нового документа

Сначала обновить существующий канонический документ. Новый `.md` допустим только по правилам [agents/DOCUMENTATION_POLICY.ru.md](agents/DOCUMENTATION_POLICY.ru.md) и должен быть добавлен в этот индекс.
