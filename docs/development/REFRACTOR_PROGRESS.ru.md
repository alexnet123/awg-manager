# Рефакторинг: прогресс работ

Обновлено: 2026-05-28

Цель итерации:
- параллельная модель разработки (`firewall` + `ipsec`) без конфликтов;
- инкрементальная декомпозиция `webui/src/pages/firewall.tsx`;
- без изменения внешнего HTTP API.

## Статус Master-Plan (без чекбоксов)

- Backend decomposition: `DONE (for awg_core removal-cycle scope)` (выполнены шаги `1.1`-`1.183`; далее выполнен structural-step: файл `awg_core.py` удален, compatibility runtime закреплен в `backend.app.legacy_manager_compat`).
- API contract layer: `DONE (for current refactor scope)` (wire-совместимость держится, `tests/test_api_contract.py` стабильно зеленый).
- Frontend decomposition: `IN PROGRESS` (доменный API split и большая часть firewall-декомпозиции сделаны, финальный e2e/regression gate еще впереди).
- Delivery model (A/B/C/D): `IN PROGRESS` (этапы A-B в работе, C-D pending: финальный cleanup + freeze window + merge).
- IPsec feature stream: `ON HOLD` (разрешены только структурные изменения в рамках рефакторинга, без новых фич).

## Быстрый Срез Прогресса

- Выполнено: `183` backend-этапов (`1.1`-`1.183`) с паритетными тестами.
- Текущее состояние монолита: файл `awg_core.py` удален; legacy runtime закреплен в `backend/app/legacy_manager_compat.py`.
- Уже переведено на модульные слои: `50+` явных интеграционных вызовов (`backend.common`, `firewall_store`, `firewall_runtime_adapter`, `firewall_compat_entry_ops`, `ipsec_compat_entry_ops`, `interfaces_compat_entry_ops`, `interfaces_cli_compat_entry_ops`).
- Введена базовая dev-документация по владению модулями/функциями (RU/EN): `docs/development/MODULE_MAP.ru.md`, `docs/development/MODULE_MAP.md`; добавлен `AGENTS.md` с правилами сопровождения рефакторинга.
- До полного remove-cycle по `awg_core.py` осталось: `0/4` блоков (`B1`-`B4` закрыты).
- Оценка по времени до удаления `awg_core.py` как файла: `DONE` (отдельный structural-step выполнен).
- Прогресс macro-этапов (оценка):
  - Этап 1 (thin-shim `manager_facade`): `100%` (завершен, guarded).
  - Этап 2 (истончение `awg_core.py`): `100%`.
  - Этап 3 (remove-cycle `B1`-`B4`): `100%`.
  - Общий backend decomposition до remove-cycle completion: `100%`.

## 2026-05-28 — Firewall: делегация сборки collection runtime helper-ов из facade в домен

- Scope шага:
  - в `backend/app/manager_facade.py` удалена локальная сборка `_normalize_nft_timeout`/`_timeout_to_seconds`/`_enrich_collection_item_runtime`/`_cleanup_expired_collection_rows`/`_set_runtime_signature`/`_map_runtime_signature`;
  - вместо этого используется доменная фабрика `backend.domains.firewall.compat_entry_ops.build_collection_runtime_helpers`.
- Что перенесено по ответственности:
  - ответственность за композицию collection runtime helper-ов firewall закреплена в доменном модуле `backend/domains/firewall/compat_entry_ops.py`;
  - `manager_facade` оставлен как thin wiring layer и использует готовый helper-bundle.
- Какой legacy entrypoint теперь делегирует куда:
  - entrypoint `backend/app/manager_facade.py` для firewall collection путей (`list/upsert` sets/maps и связанные normalize/runtime callbacks) теперь делегирует сборку helper-ов в `backend/domains/firewall/compat_entry_ops.build_collection_runtime_helpers`.
- Документация владения:
  - обновлены `docs/development/MODULE_MAP.md` и `docs/development/MODULE_MAP.ru.md` (RU/EN выровнены семантически).
- Команды верификации:
  - `python3 -m pytest -q tests/test_firewall_compat_entry_ops.py` -> `4 passed`
  - `python3 -m pytest -q tests/test_manager_access_facade.py` -> `43 passed`
  - `python3 -m pytest -q tests/test_manager_facade_structure.py` -> `3 passed`
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` -> `20 passed`
  - `python3 -m pytest -q tests/test_api_contract.py` -> `9 passed`
  - `python3 -m pytest -q tests` -> `279 passed`
- Краткий итог:
  - backend-first firewall refactor step выполнен без изменения wire/API и без регрессий тестов.

## 2026-05-28 — Onboarding и единые правила для новых агентов

- Добавлена пара onboarding-документов для быстрого старта:
  - `docs/development/START_HERE.md` (EN)
  - `docs/development/START_HERE.ru.md` (RU)
- В `docs/development/README.md` добавлены ссылки на новые onboarding-файлы.
- В `START_HERE` зафиксированы:
  - обязательные first-steps;
  - архитектурные guardrails;
  - единый `Definition of Done`;
  - playbook-и по типам задач (`firewall`, структурный `ipsec`, `legacy_manager_compat/manager_facade`).
- Проверки:
  - Тесты не запускались: изменения документационные, без изменения runtime-кода.

## 2026-05-28 — Structural step: удаление файла `awg_core.py`

- Scope шага:
  - удален файл `awg_core.py` (бывший compat shim);
  - тестовый legacy-target сценарий переведен на canonical target `backend.app.legacy_manager_compat`;
  - документация/правила обновлены на post-`awg_core` состояние.
- Что перенесено по ответственности:
  - runtime legacy compatibility окончательно закреплен в `backend.app.legacy_manager_compat`;
  - выбор fallback-target остается в `backend.app.legacy_manager_target` через `AWG_MANAGER_LEGACY_TARGET_MODULE`.
- Какой legacy entrypoint теперь делегирует куда:
  - файл-энтрипойнт `awg_core.py` удален;
  - legacy fallback path: `manager_facade -> legacy_manager_bridge -> legacy_manager_target -> backend.app.legacy_manager_compat`.
- Команды верификации:
  - `python3 -m pytest -q tests/test_data_dir_config.py` -> `2 passed`
  - `python3 -m pytest -q tests/test_manager_access_facade.py` -> `43 passed`
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` -> `20 passed`
  - `python3 -m pytest -q tests/test_api_contract.py` -> `9 passed`
  - `python3 -m pytest -q tests` -> `279 passed`
- Краткий итог:
  - structural removal выполнен без регрессий по тестам.

## 1) Инфраструктура и runtime-конфиги

- [x] Введен `AWG_MANAGER_DATA_DIR` (default `/etc/wg-manager`) в backend.
- [x] Переведены runtime пути state/key/db на `AWG_MANAGER_DATA_DIR`.
- [x] Добавлен `AWG_MANAGER_STAND_PROFILE` в env-шаблоны.
- [x] Расширен installer:
  - [x] `--data-dir`
  - [x] `--stand-profile`
- [x] Документация обновлена:
  - [x] `docs/operations/DEPLOY.md`
  - [x] `docs/reference/API.md`
  - [x] `docs/operations/PARALLEL_DEVELOPMENT.md`

## 1.1) Backend модульные границы (app/common/domains)

- [x] Введен каркас `backend/`:
  - [x] `backend/common` (shared access/error mapping)
  - [x] `backend/domains/interfaces_clients`
  - [x] `backend/domains/firewall`
  - [x] `backend/domains/ipsec`
  - [x] `backend/app/router.py` как единая точка route-dispatch
- [x] `api_core.py` переведен на `backend.app.router` (тонкий bootstrap/HTTP-host layer).
- [x] Сохранен wire-контракт публичных маршрутов (`/health`, `interfaces`, `clients`, `firewall/*`, `/api/ipsec/*`, backup).
- [x] Добавлены backend parity тесты на app-router:
  - [x] `tests/test_app_router.py`

## 1.2) Доменная декомпозиция service -> repository -> runtime_adapter

- [x] `firewall` домен:
  - [x] `service.py` (HTTP-neutral orchestration)
  - [x] `repository.py` (state CRUD)
  - [x] `runtime_adapter.py` (runtime apply)
- [x] `ipsec` домен:
  - [x] `service.py` (HTTP-neutral orchestration)
  - [x] `repository.py` (config/events CRUD)
  - [x] `runtime_adapter.py` (apply/load/initiate/terminate/runtime reads)
- [x] `interfaces_clients` домен:
  - [x] `service.py` (orchestration)
  - [x] `repository.py` (interfaces/clients persistence access)
  - [x] `runtime_adapter.py` (backup/auth/awg params/config builders)
- [x] Добавлен guard-тест границ импортов доменов:
  - [x] `tests/test_domain_import_boundaries.py`

## 1.3) Вынос backend/common из монолита awg_core

- [x] Добавлены общие модули:
  - [x] `backend/common/data_paths.py` (DataDir и state-paths)
  - [x] `backend/common/json_store.py` (единый JSON read/write)
  - [x] `backend/common/api_key_store.py` (load/save/rotate API key)
- [x] `awg_core.py` переведен на `backend.common.*` для:
  - [x] `AWG_MANAGER_DATA_DIR`/state files path resolution
  - [x] API key persistence/rotation
  - [x] JSON storage helpers
- [x] Устранено дублирование `_write_json_file` в `awg_core.py` (единая реализация через `json_store`).
- [x] Добавлены тесты backend common:
  - [x] `tests/test_backend_common.py`

## 1.4) Вынос crypto helpers из awg_core

- [x] Добавлен `backend/common/crypto_keys.py`:
  - [x] KDF v2 (`sha256 -> fernet key`)
  - [x] legacy KDF v1 fallback
  - [x] generic encrypt/decrypt helpers with key fallback
- [x] `awg_core.py` переключен на `backend.common.crypto_keys` для:
  - [x] `encryption_key` / `encryption_key_legacy` derivation
  - [x] `encrypt_private_key` / `decrypt_private_key`
  - [x] `_secret_encrypt` / `_secret_decrypt`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_crypto_common.py`

## 1.5) Вынос IPsec JSON-persistence из awg_core

- [x] Добавлен `backend/domains/ipsec/store.py`:
  - [x] read/write collection helpers
  - [x] append/list events helpers
- [x] `awg_core.py` переключен на `ipsec_store` для:
  - [x] `_read_ipsec_collection` / `_write_ipsec_collection`
  - [x] `_log_ipsec_event` / `list_ipsec_events_service`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_ipsec_store.py`

## 1.6) Вынос Firewall JSON-persistence из awg_core

- [x] Добавлен `backend/domains/firewall/store.py`:
  - [x] read/write `rules`
  - [x] read/write `sets`, `maps`, `objects`, `tables`
  - [x] read/write `managed tables`
  - [x] read/write `stats`
- [x] `awg_core.py` переключен на `firewall_store` для:
  - [x] `_read/_write_firewall_*` JSON helpers
  - [x] `_write_firewall_rules_file`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_firewall_store.py`

## 1.7) Вынос Firewall table-def/managed-table helpers из awg_core

- [x] `backend/domains/firewall/store.py` расширен функциями:
  - [x] `managed_table_key`
  - [x] `parse_managed_table_key`
  - [x] `collect_table_defs`
- [x] `awg_core.py` переведен на новые helper-функции через thin-wrapper слой:
  - [x] `_managed_table_key`
  - [x] `_parse_managed_table_key`
  - [x] `_collect_firewall_table_defs`
- [x] Добавлены/обновлены unit-тесты:
  - [x] `tests/test_firewall_store.py`

## 1.8) Вынос Firewall runtime nft helpers в adapter-слой

- [x] `backend/domains/firewall/runtime_adapter.py` расширен:
  - [x] `list_tables`
  - [x] `delete_table`
  - [x] `apply_script`
- [x] `awg_core.py` переведен на runtime adapter для:
  - [x] `_list_runtime_tables`
  - [x] delete/apply в `apply_firewall_rules`
  - [x] delete/apply в `reset_firewall_counters_service`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_firewall_runtime_adapter.py`

## 1.9) Вынос Firewall runtime object parser в adapter-слой

- [x] `backend/domains/firewall/runtime_adapter.py` расширен:
  - [x] `list_table_objects_by_kind`
- [x] `awg_core.py` переведен на runtime adapter для:
  - [x] `_load_table_objects_by_kind`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_firewall_runtime_adapter.py`

## 1.10) Вынос Firewall runtime reset helpers в adapter-слой

- [x] `backend/domains/firewall/runtime_adapter.py` расширен:
  - [x] `reset_table_named_counters`
  - [x] `reset_table_named_quotas`
- [x] `awg_core.py` переведен на runtime adapter для:
  - [x] nft reset steps в `reset_firewall_counters_service`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_firewall_runtime_adapter.py`

## 1.11) Вынос Firewall runtime ruleset readers в adapter-слой

- [x] `backend/domains/firewall/runtime_adapter.py` расширен:
  - [x] `get_ruleset_text`
  - [x] `get_ruleset_counter_index`
- [x] `awg_core.py` переведен на runtime adapter для:
  - [x] runtime ruleset/counters чтение в `get_firewall_state_service`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_firewall_runtime_adapter.py`

## 1.12) Вынос Firewall runtime state-aggregation helpers в adapter-слой

- [x] `backend/domains/firewall/runtime_adapter.py` расширен:
  - [x] `build_runtime_counters_by_rule`
  - [x] `enrich_rules_with_runtime_stats`
- [x] `awg_core.py` переведен на runtime adapter для:
  - [x] mapping chain counters -> rule ids
  - [x] pps/bps/history enrichment + stats-store update path
- [x] Добавлены unit-тесты:
  - [x] `tests/test_firewall_runtime_adapter.py`

## 1.13) Вынос Firewall collection runtime helpers в store-слой

- [x] `backend/domains/firewall/store.py` расширен:
  - [x] `enrich_collection_item_runtime`
  - [x] `cleanup_expired_collection_rows`
  - [x] `set_runtime_signature`
  - [x] `map_runtime_signature`
- [x] `awg_core.py` переведен на `firewall_store` для:
  - [x] `enrich_collection_item_runtime`
  - [x] `_cleanup_expired_collection_rows`
  - [x] `_set_runtime_signature`
  - [x] `_map_runtime_signature`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_firewall_store.py`

## 1.14) Вынос Firewall set/map normalizers в store-слой

- [x] `backend/domains/firewall/store.py` расширен:
  - [x] `normalize_set_item`
  - [x] `normalize_map_item`
- [x] `awg_core.py` переведен на `firewall_store` для:
  - [x] `_normalize_set_item`
  - [x] `_normalize_map_item`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_firewall_store.py`

## 1.15) Вынос Firewall collection orchestration helpers в store-слой

- [x] `backend/domains/firewall/store.py` расширен:
  - [x] `prepare_collection_kind_rows`
  - [x] `upsert_collection_rows`
- [x] `awg_core.py` переведен на `firewall_store` для:
  - [x] list-пути `sets/maps` (cleanup + runtime enrich plumbing)
  - [x] upsert-пути `sets/maps` (row replacement + runtime_changed evaluation)
- [x] Добавлены unit-тесты:
  - [x] `tests/test_firewall_store.py`

## 1.16) Вынос Firewall collection delete/uniqueness helpers в store-слой

- [x] `backend/domains/firewall/store.py` расширен:
  - [x] `ensure_unique_collection_names`
  - [x] `delete_collection_row`
- [x] `awg_core.py` переведен на `firewall_store` для:
  - [x] uniqueness-check paths в `upsert_firewall_set_service` и `upsert_firewall_map_service`
  - [x] delete paths в `delete_firewall_set_service` и `delete_firewall_map_service`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_firewall_store.py`

## 1.17) Вынос Firewall table-listing helper в store-слой

- [x] `backend/domains/firewall/store.py` расширен:
  - [x] `build_tables_listing`
- [x] `awg_core.py` переведен на `firewall_store` для:
  - [x] `list_firewall_tables_service`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_firewall_store.py`

## 1.18) Вынос Firewall named-objects query/payload helpers в store-слой

- [x] `backend/domains/firewall/store.py` расширен:
  - [x] `parse_named_objects_query`
  - [x] `filter_declared_named_objects`
  - [x] `build_named_objects_listing`
- [x] `awg_core.py` переведен на `firewall_store` для:
  - [x] query validation + declared-items filtering в `list_firewall_named_objects_service`
  - [x] payload build для inactive/active table path в `list_firewall_named_objects_service`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_firewall_store.py`

## 1.19) Вынос Firewall named-objects reference/upsert/delete helpers в store-слой

- [x] `backend/domains/firewall/store.py` расширен:
  - [x] `named_object_rule_reference`
  - [x] `find_named_object_references`
  - [x] `find_named_object_by_id`
  - [x] `upsert_named_object_rows`
  - [x] `ensure_unique_named_object_signatures`
  - [x] `delete_named_object_row`
- [x] `awg_core.py` переведен на `firewall_store` для:
  - [x] `_firewall_rule_object_reference`
  - [x] `_find_named_object_references`
  - [x] `upsert_firewall_named_object_service` (rows merge + uniqueness)
  - [x] `create/update/delete_firewall_named_object_service` (lookup/delete path)
- [x] Добавлены unit-тесты:
  - [x] `tests/test_firewall_store.py`

## 1.20) Вынос Firewall table upsert/delete helpers в store-слой

- [x] `backend/domains/firewall/store.py` расширен:
  - [x] `upsert_table_rows`
  - [x] `ensure_unique_table_signatures`
  - [x] `delete_table_row`
  - [x] `remove_objects_for_table`
- [x] `awg_core.py` переведен на `firewall_store` для:
  - [x] rows upsert + signature uniqueness в `upsert_firewall_table_service`
  - [x] rows delete + related objects cleanup в `delete_firewall_table_service`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_firewall_store.py`

## 1.21) Вынос Firewall table payload validation в store-слой

- [x] `backend/domains/firewall/store.py` расширен:
  - [x] `normalize_firewall_table_item`
- [x] `awg_core.py` переведен на `firewall_store` для:
  - [x] `_normalize_firewall_table_item`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_firewall_store.py`

## 1.22) Вынос Firewall table orchestration в доменный module-layer

- [x] Добавлен модуль:
  - [x] `backend/domains/firewall/table_ops.py`
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] `upsert_firewall_table_service`
  - [x] `delete_firewall_table_service`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_firewall_table_ops.py`

## 1.23) Вынос Firewall named-objects orchestration в доменный module-layer

- [x] Добавлен модуль:
  - [x] `backend/domains/firewall/named_object_ops.py`
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] `upsert_firewall_named_object_service`
  - [x] `create_firewall_named_object_service`
  - [x] `update_firewall_named_object_service`
  - [x] `delete_firewall_named_object_service`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_firewall_named_object_ops.py`

## 1.24) Вынос Firewall collections (sets/maps) orchestration в доменный module-layer

- [x] Добавлен модуль:
  - [x] `backend/domains/firewall/collection_ops.py`
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] `list_firewall_sets_service`
  - [x] `upsert_firewall_set_service`
  - [x] `delete_firewall_set_service`
  - [x] `list_firewall_maps_service`
  - [x] `upsert_firewall_map_service`
  - [x] `delete_firewall_map_service`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_firewall_collection_ops.py`

## 1.25) Вынос Firewall rules CRUD/reorder orchestration в доменный module-layer

- [x] Добавлен модуль:
  - [x] `backend/domains/firewall/rule_ops.py`
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] `create_firewall_rule_service`
  - [x] `update_firewall_rule_service`
  - [x] `delete_firewall_rule_service`
  - [x] `reorder_firewall_rules_service`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_firewall_rule_ops.py`

## 1.26) Вынос Firewall runtime apply/reset orchestration в доменный module-layer

- [x] Добавлен модуль:
  - [x] `backend/domains/firewall/runtime_ops.py`
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] `apply_firewall_rules`
  - [x] `reset_firewall_counters_service`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_firewall_runtime_ops.py`

## 1.27) Вынос Firewall state aggregation orchestration в доменный module-layer

- [x] Добавлен модуль:
  - [x] `backend/domains/firewall/state_ops.py`
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] `get_firewall_state_service`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_firewall_state_ops.py`

## 1.28) Вынос Firewall rules listing/filter orchestration в доменный module-layer

- [x] Расширен модуль:
  - [x] `backend/domains/firewall/rule_ops.py` (`list_rules`)
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] `list_firewall_rules_service`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_firewall_rule_ops.py` (list/filter/invalid-row path)

## 1.29) Вынос Firewall schema-service orchestration в доменный module-layer

- [x] Добавлен модуль:
  - [x] `backend/domains/firewall/schema_ops.py`
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] `get_firewall_schema_service`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_firewall_schema_ops.py`

## 1.30) Вынос Firewall tables/named-objects listing orchestration в доменный module-layer

- [x] Расширены модули:
  - [x] `backend/domains/firewall/table_ops.py` (`list_tables`)
  - [x] `backend/domains/firewall/named_object_ops.py` (`list_named_objects`)
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] `list_firewall_tables_service`
  - [x] `list_firewall_named_objects_service`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_firewall_table_ops.py` (list tables path)
  - [x] `tests/test_firewall_named_object_ops.py` (active/inactive listing path)

## 1.31) Вынос Firewall named-object payload normalization в доменный module-layer

- [x] Расширен модуль:
  - [x] `backend/domains/firewall/named_object_ops.py` (`normalize_named_object_payload`)
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] `_normalize_named_object_payload`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_firewall_named_object_ops.py` (normalization + validation path)

## 1.32) Вынос Firewall named-object add-statement rendering в доменный module-layer

- [x] Расширен модуль:
  - [x] `backend/domains/firewall/named_object_ops.py` (`render_named_object_add_statement`)
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] рендеринга named-objects внутри `_append_table_script_lines`
  - [x] удален дублирующий helper `_render_named_object_add_statement`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_firewall_named_object_ops.py` (counter/limit rendering + unsupported kind)

## 1.33) Вынос Firewall named-object existence checks в доменный module-layer

- [x] Расширен модуль:
  - [x] `backend/domains/firewall/named_object_ops.py` (`ensure_named_object_exists`)
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] runtime-валидации ссылок `ct_helper_set/ct_timeout_set/ct_expectation_set/counter_name/limit_name/quota_name`
  - [x] удален дублирующий helper `_ensure_named_object_exists`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_firewall_named_object_ops.py` (success/missing-object paths)

## 1.34) Вынос Firewall queue/dup/fwd normalization блока в доменный module-layer

- [x] Расширен модуль:
  - [x] `backend/domains/firewall/rule_ops.py` (`normalize_queue_dup_fwd_fields`)
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] блока валидации/нормализации `queue_num/queue_flags/dup_*/fwd_*` внутри `_normalize_firewall_rule`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_firewall_rule_ops.py` (queue/fwd success path + validation errors)

## 1.35) Вынос Firewall log-fields normalization блока в доменный module-layer

- [x] Расширен модуль:
  - [x] `backend/domains/firewall/rule_ops.py` (`normalize_log_fields`)
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] блока валидации/нормализации `log_level/log_prefix/log_flags/log_group/log_snaplen/log_queue_threshold` внутри `_normalize_firewall_rule`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_firewall_rule_ops.py` (log success path + validation errors)

## 1.36) Вынос Firewall nat/raw-fields normalization блока в доменный module-layer

- [x] Расширен модуль:
  - [x] `backend/domains/firewall/rule_ops.py` (`normalize_nat_raw_fields`)
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] блока валидации/нормализации `nat_type/nat_* flags/to_addr/to_port/notrack/nftrace/raw_expr` внутри `_normalize_firewall_rule`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_firewall_rule_ops.py` (nat/raw success path + validation errors)

## 1.37) Вынос Firewall limit/object-reference normalization блока в доменный module-layer

- [x] Расширен модуль:
  - [x] `backend/domains/firewall/rule_ops.py` (`normalize_limit_and_named_object_fields`)
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] блока валидации/нормализации `limit_rate/counter/ct_*_set/counter_name/limit_name/quota_name` внутри `_normalize_firewall_rule`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_firewall_rule_ops.py` (limit/object-reference success path + validation errors)

## 1.38) Вынос Firewall bridge/netdev restriction checks в доменный module-layer

- [x] Расширен модуль:
  - [x] `backend/domains/firewall/rule_ops.py`
    - `validate_bridge_runtime_gap_fields`
    - `validate_bridge_disallowed_fields`
    - `validate_netdev_restrictions`
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] проверки `fib_check/socket_match/rt_nexthop/ipv6_exthdrs` для `family=bridge`
  - [x] циклов `bridge/netdev` disallowed-полей в `_normalize_firewall_rule`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_firewall_rule_ops.py` (bridge/netdev restriction validation paths)

## 1.39) Вынос Firewall meta/ct/fib/socket/exthdr validation блока в доменный module-layer

- [x] Расширен модуль:
  - [x] `backend/domains/firewall/rule_ops.py` (`normalize_meta_ct_fib_fields`)
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] блока валидации/нормализации `meta_*`, `ct_*`, `fib/socket/rt/ipv6_exthdrs`, `ct_{original,reply}_{saddr,daddr}` внутри `_normalize_firewall_rule`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_firewall_rule_ops.py` (meta/ct/fib success path + validation errors)

## 1.40) Вынос Firewall L2/mark/expr validation блока в доменный module-layer

- [x] Расширен модуль:
  - [x] `backend/domains/firewall/rule_ops.py`
    - `normalize_l2_mark_fields`
    - `validate_expression_fields`
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] блока валидации `vlan_id/ether_src/ether_dst/ether_type/mark_set/ct_mark_set`
  - [x] блока валидации `fib_expr/socket_expr/rt_expr/exthdr_expr/raw_expr`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_firewall_rule_ops.py` (L2/mark/expr success path + validation errors)

## 1.41) Вынос Firewall proto/basic-match normalization блока в доменный module-layer

- [x] Расширен модуль:
  - [x] `backend/domains/firewall/rule_ops.py` (`normalize_proto_and_basic_match_fields`)
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] блока валидации/нормализации `proto + tcp/icmp proto constraints + port range + src/dst + interface names + enabled + ct_state/user_id/hour/dscp/comment`
  - [x] сохранен исходный порядок pre-checks (`proto`, `dport/sport requires proto`) относительно `queue` блока
- [x] Добавлены unit-тесты:
  - [x] `tests/test_firewall_rule_ops.py` (basic-match success path + validation errors)

## 1.42) Вынос Firewall action/proto/l4-literals validation блоков в доменный module-layer

- [x] Расширен модуль:
  - [x] `backend/domains/firewall/rule_ops.py`
    - `validate_action_target_reject_and_proto_fields`
    - `validate_l4_icmp_literal_fields`
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] блока валидации `action/target_chain/reject_type/proto + dport/sport requires proto` внутри `_normalize_firewall_rule`
  - [x] блока валидации `tcp_flags/icmp*_type/icmp*_code` литералов внутри `_normalize_firewall_rule`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_firewall_rule_ops.py` (action/proto constraints + l4 literal validation paths)

## 1.43) Вынос Firewall table/chain context resolution блока в доменный module-layer

- [x] Расширен модуль:
  - [x] `backend/domains/firewall/rule_ops.py` (`resolve_table_chain_context`)
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] блока валидации/разрешения `family + built-in/custom table + chain + selected_chain + table_mode` внутри `_normalize_firewall_rule`
  - [x] сохранены тексты ошибок и ветвления для custom-table/checks
- [x] Добавлены unit-тесты:
  - [x] `tests/test_firewall_rule_ops.py` (built-in/custom success paths + invalid family/table/chain errors)

## 1.44) Вынос Firewall family-specific restriction orchestration в доменный module-layer

- [x] Расширен модуль:
  - [x] `backend/domains/firewall/rule_ops.py` (`validate_family_specific_restrictions`)
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] сборки и валидации больших `bridge/netdev` disallowed-блоков внутри `_normalize_firewall_rule`
  - [x] сохранены прежние проверки и тексты ошибок через делегирование в `validate_bridge_disallowed_fields` / `validate_netdev_restrictions`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_firewall_rule_ops.py` (family-specific success + bridge/netdev error paths)

## 1.45) Вынос Firewall runtime named-object reference checks в доменный module-layer

- [x] Расширен модуль:
  - [x] `backend/domains/firewall/named_object_ops.py` (`validate_runtime_named_object_references`)
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] блока runtime-валидации ссылок `ct_helper_set/ct_timeout_set/ct_expectation_set/counter_name/limit_name/quota_name` при `validate_runtime_objects && family=bridge`
  - [x] сохранены прежние тексты ошибок через делегирование в `ensure_named_object_exists`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_firewall_named_object_ops.py` (skip paths + success path + missing object path)

## 1.46) Вынос Firewall normalized-rule payload assembly в доменный module-layer

- [x] Расширен модуль:
  - [x] `backend/domains/firewall/rule_ops.py` (`build_normalized_rule_payload`)
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] финальной сборки normalized firewall-rule payload в `_normalize_firewall_rule` (все string/int/lower conversion правила сохранены 1:1)
- [x] Добавлены unit-тесты:
  - [x] `tests/test_firewall_rule_ops.py` (payload assembly conversion checks)

## 1.47) Вынос Firewall payload input extraction в доменный module-layer

- [x] Расширен модуль:
  - [x] `backend/domains/firewall/rule_ops.py` (`extract_normalized_rule_inputs`)
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] блока чтения/нормализации входного payload в `_normalize_firewall_rule` через tuple-unpack из helper-а
  - [x] сохранены прежние defaults и преобразования (`table/chain/action` lower, bool defaults для `notrack/nftrace/nat_*/counter/enabled`, raw `log_flags/queue_flags`)
- [x] Добавлены unit-тесты:
  - [x] `tests/test_firewall_rule_ops.py` (extractor order/defaults/conversion checks)

## 1.48) Вынос Firewall rule rendering orchestration в доменный module-layer

- [x] Расширен модуль:
  - [x] `backend/domains/firewall/rule_ops.py` (`render_firewall_rule`)
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] полного рендеринга nft rule-выражения через thin-wrapper `_render_firewall_rule -> firewall_rule_ops.render_firewall_rule`
  - [x] сохранены ветки рендера `bridge`/`queue`/`nat`/`fwd`/`comment` 1:1
- [x] Добавлены unit-тесты:
  - [x] `tests/test_firewall_rule_ops.py` (render paths for queue + nat)

## 1.49) Вынос Firewall map declaration helpers в доменный module-layer

- [x] Расширен модуль:
  - [x] `backend/domains/firewall/collection_ops.py`
    - `infer_map_token_type`
    - `format_map_token`
    - `build_map_declaration_and_elements`
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] сборки `add map/add element` declaration-частей в `_append_table_script_lines`
  - [x] удалены локальные дубли `_infer_map_token_type/_format_map_token/_build_map_declaration_and_elements`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_firewall_collection_ops.py` (map/vmap declaration + empty/broken entries)

## 1.50) Вынос Firewall runtime sets/maps script assembly в доменный module-layer

- [x] Расширен модуль:
  - [x] `backend/domains/firewall/collection_ops.py` (`append_runtime_collection_script_lines`)
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] runtime-части `add set/add map/add element` в `_append_table_script_lines`
  - [x] сохранены прежние форматы/порядок строк для `addr/port/iface/map/vmap`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_firewall_collection_ops.py` (script lines for addr/port/iface/map/vmap)

## 1.51) Вынос Firewall named-objects/rules script append orchestration в доменный module-layer

- [x] Расширены модули:
  - [x] `backend/domains/firewall/named_object_ops.py` (`append_enabled_named_object_script_lines`)
  - [x] `backend/domains/firewall/rule_ops.py` (`append_enabled_rule_script_lines`)
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] фильтрации и добавления `named objects` строк в `_append_table_script_lines`
  - [x] фильтрации и добавления `add rule ...` строк в `_append_table_script_lines`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_firewall_named_object_ops.py` (enabled/family/table filters)
  - [x] `tests/test_firewall_rule_ops.py` (enabled/table/family/default_family filters)

## 1.52) Старт выноса interfaces_clients IP allocation/validation helpers

- [x] Добавлен модуль:
  - [x] `backend/domains/interfaces_clients/ip_alloc_ops.py`
    - `get_next_available_ip`
    - `validate_client_ip_for_interface`
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] делегирования `get_next_available_ip(...)`
  - [x] делегирования `validate_client_ip_for_interface(...)`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_interfaces_clients_ip_alloc_ops.py` (available-ip, subnet/conflict/invalid-ip paths)

## 1.53) Вынос interfaces_clients config serialization/render helpers в доменный module-layer

- [x] Добавлен модуль:
  - [x] `backend/domains/interfaces_clients/config_render_ops.py`
    - `serialize_interface_row`
    - `serialize_client_row`
    - `build_client_config`
    - `build_interface_server_config`
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] делегирования `serialize_interface_row(...)`
  - [x] делегирования `serialize_client_row(...)`
  - [x] делегирования `build_client_config(...)`
  - [x] делегирования `build_interface_server_config(...)`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_interfaces_clients_config_render_ops.py`
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_interfaces_clients_config_render_ops.py tests/test_interfaces_clients_ip_alloc_ops.py` → `6 passed`

## 1.54) Вынос interfaces_clients client CRUD orchestration в доменный module-layer

- [x] Добавлен модуль:
  - [x] `backend/domains/interfaces_clients/client_service_ops.py`
    - `create_client_service`
    - `update_client_service`
    - `delete_client_service`
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] делегирования `create_client_service(...)`
  - [x] делегирования `update_client_service(...)`
  - [x] делегирования `delete_client_service(...)`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_interfaces_clients_client_service_ops.py`
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_interfaces_clients_client_service_ops.py tests/test_interfaces_clients_config_render_ops.py tests/test_interfaces_clients_ip_alloc_ops.py` → `11 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `113 passed`

## 1.55) Вынос interfaces_clients interface CRUD orchestration в доменный module-layer

- [x] Добавлен модуль:
  - [x] `backend/domains/interfaces_clients/interface_service_ops.py`
    - `create_interface_service`
    - `update_interface_service`
    - `delete_interface_service`
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] делегирования `create_interface_service(...)`
  - [x] делегирования `update_interface_service(...)`
  - [x] делегирования `delete_interface_service(...)`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_interfaces_clients_interface_service_ops.py`
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_interfaces_clients_interface_service_ops.py tests/test_interfaces_clients_client_service_ops.py tests/test_interfaces_clients_config_render_ops.py tests/test_interfaces_clients_ip_alloc_ops.py` → `16 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `118 passed`

## 1.56) Вынос interfaces_clients runtime helpers (key/config/apply) в доменный module-layer

- [x] Добавлен модуль:
  - [x] `backend/domains/interfaces_clients/runtime_ops.py`
    - `generate_keypair`
    - `create_temp_key_file`
    - `build_awg_set_command`
    - `apply_interface_runtime`
    - `remove_interface_runtime`
    - `append_config_param`
    - `build_client_config_lines`
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] делегирования `generate_keypair(...)`
  - [x] делегирования `create_temp_key_file(...)`
  - [x] делегирования `build_awg_set_command(...)`
  - [x] делегирования `apply_interface_runtime(...)`
  - [x] делегирования `remove_interface_runtime(...)`
  - [x] делегирования `append_config_param(...)`
  - [x] делегирования `build_client_config_lines(...)`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_interfaces_clients_runtime_ops.py`
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_interfaces_clients_runtime_ops.py tests/test_interfaces_clients_interface_service_ops.py tests/test_interfaces_clients_client_service_ops.py tests/test_interfaces_clients_config_render_ops.py tests/test_interfaces_clients_ip_alloc_ops.py` → `21 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `123 passed`

## 1.57) Вынос interfaces_clients validation/uniqueness helpers в доменный module-layer

- [x] Добавлен модуль:
  - [x] `backend/domains/interfaces_clients/validation_ops.py`
    - `parse_and_validate_interface_network`
    - `parse_and_validate_port`
    - `validate_ip_literal`
    - `validate_interface_name`
    - `assert_interface_uniqueness`
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] делегирования `parse_and_validate_interface_network(...)`
  - [x] делегирования `parse_and_validate_port(...)`
  - [x] делегирования `validate_ip_literal(...)`
  - [x] делегирования `validate_interface_name(...)`
  - [x] делегирования `assert_interface_uniqueness(...)`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_interfaces_clients_validation_ops.py`
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_interfaces_clients_validation_ops.py tests/test_interfaces_clients_runtime_ops.py tests/test_interfaces_clients_interface_service_ops.py tests/test_interfaces_clients_client_service_ops.py tests/test_interfaces_clients_config_render_ops.py tests/test_interfaces_clients_ip_alloc_ops.py` → `24 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `126 passed`

## 1.58) Вынос interfaces_clients AWG params helpers (detect/prepare/validate/project) в доменный module-layer

- [x] Добавлен модуль:
  - [x] `backend/domains/interfaces_clients/awg_params_ops.py`
    - `detect_awg_version`
    - `get_awg_param_keys_for_version`
    - `build_awg_params_from_row`
    - `generate_awg_obfuscation_params`
    - `prepare_awg_params_for_version`
    - `parse_h_value_or_range`
    - `validate_awg_params`
    - `format_awg_params_for_display`
    - `get_filtered_awg_params`
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] делегирования `detect_awg_version(...)`
  - [x] делегирования `get_awg_param_keys_for_version(...)`
  - [x] делегирования `build_awg_params_from_row(...)`
  - [x] делегирования `generate_awg_obfuscation_params(...)`
  - [x] делегирования `prepare_awg_params_for_version(...)`
  - [x] делегирования `_parse_h_value_or_range(...)`
  - [x] делегирования `validate_awg_params(...)`
  - [x] делегирования `format_awg_params_for_display(...)`
  - [x] делегирования `get_filtered_awg_params(...)`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_interfaces_clients_awg_params_ops.py`
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_interfaces_clients_awg_params_ops.py tests/test_interfaces_clients_validation_ops.py tests/test_interfaces_clients_runtime_ops.py tests/test_interfaces_clients_interface_service_ops.py tests/test_interfaces_clients_client_service_ops.py tests/test_interfaces_clients_config_render_ops.py tests/test_interfaces_clients_ip_alloc_ops.py` → `27 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `129 passed`

## 1.59) Вынос interfaces_clients AWG prompt helpers в доменный module-layer

- [x] Расширен модуль:
  - [x] `backend/domains/interfaces_clients/awg_params_ops.py`
    - `prompt_awg_version`
    - `prompt_version_2_signature_params`
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] делегирования `prompt_awg_version(...)`
  - [x] делегирования `prompt_version_2_signature_params(...)`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_interfaces_clients_awg_params_ops.py` (prompt default/invalid selection + v2 signature input mapping)
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_interfaces_clients_awg_params_ops.py tests/test_interfaces_clients_validation_ops.py tests/test_interfaces_clients_runtime_ops.py tests/test_interfaces_clients_interface_service_ops.py tests/test_interfaces_clients_client_service_ops.py tests/test_interfaces_clients_config_render_ops.py tests/test_interfaces_clients_ip_alloc_ops.py` → `29 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `131 passed`

## 1.60) Вынос interfaces_clients peer/runtime helpers (lease/add/remove) в доменный module-layer

- [x] Расширен модуль:
  - [x] `backend/domains/interfaces_clients/runtime_ops.py`
    - `wg_lease_ip`
    - `add_peer`
    - `del_peer`
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] делегирования `wg_lease_ip(...)`
  - [x] делегирования `add_peer(...)`
  - [x] делегирования `del_peer(...)`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_interfaces_clients_runtime_ops.py` (lease parsing + add/del success/error paths)
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_interfaces_clients_runtime_ops.py tests/test_interfaces_clients_awg_params_ops.py tests/test_interfaces_clients_validation_ops.py tests/test_interfaces_clients_interface_service_ops.py tests/test_interfaces_clients_client_service_ops.py tests/test_interfaces_clients_config_render_ops.py tests/test_interfaces_clients_ip_alloc_ops.py` → `32 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `134 passed`

## 1.61) Вынос interfaces_clients CLI listing helpers в доменный module-layer

- [x] Добавлен модуль:
  - [x] `backend/domains/interfaces_clients/cli_list_ops.py`
    - `list_clients`
    - `list_wg_int`
    - `list_wg_int_clients`
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] делегирования `list_clients(...)`
  - [x] делегирования `list_wg_int(...)`
  - [x] делегирования `list_wg_int_clients(...)`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_interfaces_clients_cli_list_ops.py` (clients/interfaces/interfaces+clients output paths)
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_interfaces_clients_cli_list_ops.py tests/test_interfaces_clients_runtime_ops.py tests/test_interfaces_clients_awg_params_ops.py tests/test_interfaces_clients_validation_ops.py tests/test_interfaces_clients_interface_service_ops.py tests/test_interfaces_clients_client_service_ops.py tests/test_interfaces_clients_config_render_ops.py tests/test_interfaces_clients_ip_alloc_ops.py` → `35 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `137 passed`

## 1.62) Вынос interfaces_clients CLI misc helpers (QR/API-key status/update) в доменный module-layer

- [x] Добавлен модуль:
  - [x] `backend/domains/interfaces_clients/cli_misc_ops.py`
    - `client_qrencode`
    - `show_api_key_status`
    - `set_api_key`
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] делегирования `client_qrencode(...)`
  - [x] делегирования `show_api_key_status(...)`
  - [x] делегирования `set_api_key(...)`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_interfaces_clients_cli_misc_ops.py` (client qr success/missing rows + api key status/update paths)
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_interfaces_clients_cli_misc_ops.py tests/test_interfaces_clients_cli_list_ops.py tests/test_interfaces_clients_runtime_ops.py tests/test_interfaces_clients_awg_params_ops.py tests/test_interfaces_clients_validation_ops.py tests/test_interfaces_clients_interface_service_ops.py tests/test_interfaces_clients_client_service_ops.py tests/test_interfaces_clients_config_render_ops.py tests/test_interfaces_clients_ip_alloc_ops.py` → `39 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `141 passed`

## 1.63) Вынос interfaces_clients CLI peer update helper в доменный module-layer

- [x] Добавлен модуль:
  - [x] `backend/domains/interfaces_clients/cli_peer_ops.py`
    - `update_peer`
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] делегирования `update_peer(...)`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_interfaces_clients_cli_peer_ops.py` (success + missing-client path)
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_interfaces_clients_cli_peer_ops.py tests/test_interfaces_clients_cli_misc_ops.py tests/test_interfaces_clients_cli_list_ops.py tests/test_interfaces_clients_runtime_ops.py tests/test_interfaces_clients_awg_params_ops.py tests/test_interfaces_clients_validation_ops.py tests/test_interfaces_clients_interface_service_ops.py tests/test_interfaces_clients_client_service_ops.py tests/test_interfaces_clients_config_render_ops.py tests/test_interfaces_clients_ip_alloc_ops.py` → `41 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `143 passed`

## 1.64) Вынос interfaces_clients CLI interface helpers (add/delete/update) в доменный module-layer

- [x] Добавлен модуль:
  - [x] `backend/domains/interfaces_clients/cli_interface_ops.py`
    - `add_wg_int`
    - `del_wg_int`
    - `update_interface`
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] делегирования `add_wg_int(...)`
  - [x] делегирования `del_wg_int(...)`
  - [x] делегирования `update_interface(...)`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_interfaces_clients_cli_interface_ops.py` (add success/db-error, delete path, update path)
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_interfaces_clients_cli_interface_ops.py tests/test_interfaces_clients_cli_peer_ops.py tests/test_interfaces_clients_cli_misc_ops.py tests/test_interfaces_clients_cli_list_ops.py tests/test_interfaces_clients_runtime_ops.py tests/test_interfaces_clients_awg_params_ops.py tests/test_interfaces_clients_validation_ops.py tests/test_interfaces_clients_interface_service_ops.py tests/test_interfaces_clients_client_service_ops.py tests/test_interfaces_clients_config_render_ops.py tests/test_interfaces_clients_ip_alloc_ops.py` → `44 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `146 passed`

## 1.65) Вынос IPsec validation/proposal helpers в доменный module-layer

- [x] Добавлен модуль:
  - [x] `backend/domains/ipsec/validation_ops.py`
    - `valid_name`
    - `normalize_ip_list`
    - `normalize_ts_list`
    - `build_phase1_proposal_string`
    - `build_phase2_proposal_string`
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] делегирования `_valid_name(...)`
  - [x] делегирования `_normalize_ip_list(...)`
  - [x] делегирования `_normalize_ts_list(...)`
  - [x] делегирования `_build_phase1_proposal_string(...)`
  - [x] делегирования `_build_phase2_proposal_string(...)`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_ipsec_validation_ops.py`
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_ipsec_validation_ops.py tests/test_ipsec_store.py tests/test_interfaces_clients_cli_interface_ops.py tests/test_interfaces_clients_cli_peer_ops.py tests/test_interfaces_clients_cli_misc_ops.py tests/test_interfaces_clients_cli_list_ops.py tests/test_interfaces_clients_runtime_ops.py tests/test_interfaces_clients_awg_params_ops.py tests/test_interfaces_clients_validation_ops.py tests/test_interfaces_clients_interface_service_ops.py tests/test_interfaces_clients_client_service_ops.py tests/test_interfaces_clients_config_render_ops.py tests/test_interfaces_clients_ip_alloc_ops.py` → `49 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `149 passed`

## 1.66) Вынос IPsec query/existence helpers в доменный module-layer

- [x] Добавлен модуль:
  - [x] `backend/domains/ipsec/query_ops.py`
    - `list_ipsec_identities`
    - `ensure_item_exists_by_name`
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] делегирования `list_ipsec_identities_service(...)`
  - [x] делегирования `_ensure_ipsec_peer_exists(...)`
  - [x] делегирования `_ensure_ipsec_phase1_exists(...)`
  - [x] делегирования `_ensure_ipsec_phase2_exists(...)`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_ipsec_query_ops.py`
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_ipsec_query_ops.py tests/test_ipsec_validation_ops.py tests/test_ipsec_store.py tests/test_interfaces_clients_cli_interface_ops.py tests/test_interfaces_clients_cli_peer_ops.py tests/test_interfaces_clients_cli_misc_ops.py tests/test_interfaces_clients_cli_list_ops.py tests/test_interfaces_clients_runtime_ops.py tests/test_interfaces_clients_awg_params_ops.py tests/test_interfaces_clients_validation_ops.py tests/test_interfaces_clients_interface_service_ops.py tests/test_interfaces_clients_client_service_ops.py tests/test_interfaces_clients_config_render_ops.py tests/test_interfaces_clients_ip_alloc_ops.py` → `51 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `151 passed`

## 1.67) Вынос IPsec CRUD orchestration helpers в доменный module-layer

- [x] Добавлен модуль:
  - [x] `backend/domains/ipsec/crud_ops.py`
    - `upsert_peer`
    - `upsert_identity`
    - `upsert_phase1_profile`
    - `upsert_phase2_proposal`
    - `upsert_policy`
    - `delete_peer`
    - `delete_policy`
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] делегирования `upsert_ipsec_peer_service(...)`
  - [x] делегирования `upsert_ipsec_identity_service(...)`
  - [x] делегирования `upsert_ipsec_phase1_profile_service(...)`
  - [x] делегирования `upsert_ipsec_phase2_proposal_service(...)`
  - [x] делегирования `upsert_ipsec_policy_service(...)`
  - [x] делегирования `delete_ipsec_peer_service(...)`
  - [x] делегирования `delete_ipsec_policy_service(...)`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_ipsec_crud_ops.py`
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_ipsec_crud_ops.py tests/test_ipsec_query_ops.py tests/test_ipsec_validation_ops.py tests/test_ipsec_store.py tests/test_interfaces_clients_cli_interface_ops.py tests/test_interfaces_clients_cli_peer_ops.py tests/test_interfaces_clients_cli_misc_ops.py tests/test_interfaces_clients_cli_list_ops.py tests/test_interfaces_clients_runtime_ops.py tests/test_interfaces_clients_awg_params_ops.py tests/test_interfaces_clients_validation_ops.py tests/test_interfaces_clients_interface_service_ops.py tests/test_interfaces_clients_client_service_ops.py tests/test_interfaces_clients_config_render_ops.py tests/test_interfaces_clients_ip_alloc_ops.py` → `55 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `155 passed`

## 1.68) Вынос IPsec runtime/service orchestration helpers в доменный module-layer

- [x] Добавлен модуль:
  - [x] `backend/domains/ipsec/runtime_ops.py`
    - `log_event`, `list_events`, `vici_session`, `collect_refs`
    - `build_vici_connection_for_peer`, `build_vici_secret_for_peer`
    - `sanitize_vici_sas`, `extract_active_peers_from_sas`, `extract_installed_sas_from_sas`
    - `run_ip_xfrm_best_effort`, `list_active_peers`, `list_installed_sas`
    - `load_peer`, `initiate_policy`, `terminate_peer`, `apply_config`
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] делегирования `_log_ipsec_event(...)`
  - [x] делегирования `list_ipsec_events_service(...)`
  - [x] делегирования `list_ipsec_active_peers_service(...)`
  - [x] делегирования `list_ipsec_installed_sas_service(...)`
  - [x] делегирования `load_ipsec_peer_service(...)`
  - [x] делегирования `initiate_ipsec_policy_service(...)`
  - [x] делегирования `terminate_ipsec_peer_service(...)`
  - [x] делегирования `apply_ipsec_config_service(...)`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_ipsec_runtime_ops.py`
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_ipsec_crud_ops.py tests/test_ipsec_query_ops.py tests/test_ipsec_runtime_ops.py tests/test_ipsec_validation_ops.py tests/test_ipsec_store.py tests/test_interfaces_clients_cli_interface_ops.py tests/test_interfaces_clients_cli_peer_ops.py tests/test_interfaces_clients_cli_misc_ops.py tests/test_interfaces_clients_cli_list_ops.py tests/test_interfaces_clients_runtime_ops.py tests/test_interfaces_clients_awg_params_ops.py tests/test_interfaces_clients_validation_ops.py tests/test_interfaces_clients_interface_service_ops.py tests/test_interfaces_clients_client_service_ops.py tests/test_interfaces_clients_config_render_ops.py tests/test_interfaces_clients_ip_alloc_ops.py` → `59 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `159 passed`

## 1.69) Вынос IPsec service-composition wiring в доменный module-layer

- [x] Добавлен модуль:
  - [x] `backend/domains/ipsec/service_ops.py`
    - list/read composition: `list_peers_service`, `list_identities_service`, `list_phase1_profiles_service`, `list_phase2_proposals_service`, `list_policies_service`
    - existence checks: `ensure_peer_exists`, `ensure_phase1_exists`, `ensure_phase2_exists`
    - CRUD composition: `upsert_peer_service`, `upsert_identity_service`, `upsert_phase1_profile_service`, `upsert_phase2_proposal_service`, `upsert_policy_service`, `delete_peer_service`, `delete_policy_service`
    - runtime composition: `log_event_service`, `list_events_service`, `list_active_peers_service`, `list_installed_sas_service`, `load_peer_service`, `initiate_policy_service`, `terminate_peer_service`, `apply_config_service`
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] делегирования list/read сервисов IPsec collections
  - [x] делегирования CRUD/ensure wiring для peers/identities/profiles/policies
  - [x] делегирования event/runtime wiring (`events`, `load/initiate/terminate/apply`, active peers, installed SAs)
  - [x] удаления локальных `_ensure_ipsec_*` helper-ов как дублирующих orchestration
- [x] Добавлены unit-тесты:
  - [x] `tests/test_ipsec_service_ops.py`
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_ipsec_service_ops.py tests/test_ipsec_runtime_ops.py tests/test_ipsec_crud_ops.py tests/test_ipsec_query_ops.py tests/test_ipsec_validation_ops.py tests/test_ipsec_store.py tests/test_interfaces_clients_cli_interface_ops.py tests/test_interfaces_clients_cli_peer_ops.py tests/test_interfaces_clients_cli_misc_ops.py tests/test_interfaces_clients_cli_list_ops.py tests/test_interfaces_clients_runtime_ops.py tests/test_interfaces_clients_awg_params_ops.py tests/test_interfaces_clients_validation_ops.py tests/test_interfaces_clients_interface_service_ops.py tests/test_interfaces_clients_client_service_ops.py tests/test_interfaces_clients_config_render_ops.py tests/test_interfaces_clients_ip_alloc_ops.py` → `61 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `161 passed`

## 1.70) Вынос interfaces_clients service-composition wiring в доменный module-layer

- [x] Добавлен модуль:
  - [x] `backend/domains/interfaces_clients/service_ops.py`
    - interface-service composition: `create_interface_service`, `update_interface_service`, `delete_interface_service`
    - client-service composition: `create_client_service`, `update_client_service`, `delete_client_service`
    - IP allocation composition: `get_next_available_ip`, `validate_client_ip_for_interface`
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] делегирования `create/update/delete_interface_service(...)`
  - [x] делегирования `create/update/delete_client_service(...)`
  - [x] делегирования `get_next_available_ip(...)` и `validate_client_ip_for_interface(...)`
  - [x] удаления inline SQL/runtime lambdas из этого блока compat-layer
- [x] Добавлены unit-тесты:
  - [x] `tests/test_interfaces_clients_service_ops.py`
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_interfaces_clients_service_ops.py tests/test_interfaces_clients_interface_service_ops.py tests/test_interfaces_clients_client_service_ops.py tests/test_interfaces_clients_ip_alloc_ops.py tests/test_interfaces_clients_runtime_ops.py tests/test_interfaces_clients_validation_ops.py tests/test_interfaces_clients_cli_interface_ops.py tests/test_interfaces_clients_cli_peer_ops.py tests/test_interfaces_clients_cli_misc_ops.py tests/test_interfaces_clients_cli_list_ops.py tests/test_interfaces_clients_awg_params_ops.py tests/test_interfaces_clients_config_render_ops.py tests/test_ipsec_service_ops.py tests/test_ipsec_runtime_ops.py tests/test_ipsec_crud_ops.py tests/test_ipsec_query_ops.py tests/test_ipsec_validation_ops.py tests/test_ipsec_store.py` → `64 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `164 passed`

## 1.71) Вынос legacy CLI flows (`add_client/delete_client/sync`) в доменный module-layer

- [x] Добавлен модуль:
  - [x] `backend/domains/interfaces_clients/cli_legacy_ops.py`
    - `add_client`
    - `delete_client`
    - `sync`
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] делегирования `add_client(...)`
  - [x] делегирования `delete_client(...)`
  - [x] делегирования `sync(...)`
  - [x] сохранения прежних CLI-сообщений и runtime/DB последовательности операций через dependency wiring
- [x] Добавлены unit-тесты:
  - [x] `tests/test_interfaces_clients_cli_legacy_ops.py`
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_interfaces_clients_cli_legacy_ops.py tests/test_interfaces_clients_cli_interface_ops.py tests/test_interfaces_clients_cli_peer_ops.py tests/test_interfaces_clients_cli_misc_ops.py tests/test_interfaces_clients_cli_list_ops.py tests/test_interfaces_clients_service_ops.py tests/test_interfaces_clients_runtime_ops.py tests/test_interfaces_clients_awg_params_ops.py tests/test_interfaces_clients_validation_ops.py tests/test_interfaces_clients_interface_service_ops.py tests/test_interfaces_clients_client_service_ops.py tests/test_interfaces_clients_config_render_ops.py tests/test_interfaces_clients_ip_alloc_ops.py tests/test_ipsec_service_ops.py tests/test_ipsec_runtime_ops.py tests/test_ipsec_crud_ops.py tests/test_ipsec_query_ops.py tests/test_ipsec_validation_ops.py tests/test_ipsec_store.py` → `67 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `167 passed`

## 1.72) Вынос CLI interface/peer composition wiring в доменный module-layer

- [x] Добавлен модуль:
  - [x] `backend/domains/interfaces_clients/cli_service_ops.py`
    - `add_wg_int`
    - `del_wg_int`
    - `update_interface`
    - `update_peer`
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] делегирования `add_wg_int(...)` (SQL insert wiring + runtime command wiring через composition-layer)
  - [x] делегирования `del_wg_int(...)` (fetch/delete/commit wiring)
  - [x] делегирования `update_interface(...)` (fetch/update/commit wiring)
  - [x] делегирования `update_peer(...)` (fetch/update/commit + peer runtime wiring)
  - [x] удаления inline SQL wiring в этих CLI-обертках compat-layer
- [x] Добавлены unit-тесты:
  - [x] `tests/test_interfaces_clients_cli_service_ops.py`
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_interfaces_clients_cli_service_ops.py tests/test_interfaces_clients_cli_legacy_ops.py tests/test_interfaces_clients_cli_interface_ops.py tests/test_interfaces_clients_cli_peer_ops.py tests/test_interfaces_clients_cli_misc_ops.py tests/test_interfaces_clients_cli_list_ops.py tests/test_interfaces_clients_service_ops.py tests/test_interfaces_clients_runtime_ops.py tests/test_interfaces_clients_awg_params_ops.py tests/test_interfaces_clients_validation_ops.py tests/test_interfaces_clients_interface_service_ops.py tests/test_interfaces_clients_client_service_ops.py tests/test_interfaces_clients_config_render_ops.py tests/test_interfaces_clients_ip_alloc_ops.py tests/test_ipsec_service_ops.py tests/test_ipsec_runtime_ops.py tests/test_ipsec_crud_ops.py tests/test_ipsec_query_ops.py tests/test_ipsec_validation_ops.py tests/test_ipsec_store.py` → `69 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `169 passed`

## 1.73) Вынос CLI read/query wiring (`list_*`, `client_qrencode`) в доменный module-layer

- [x] Добавлен модуль:
  - [x] `backend/domains/interfaces_clients/cli_read_ops.py`
    - `list_clients`
    - `list_wg_int`
    - `list_wg_int_clients`
    - `client_qrencode`
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] делегирования `list_clients(...)`
  - [x] делегирования `list_wg_int(...)`
  - [x] делегирования `list_wg_int_clients(...)`
  - [x] делегирования `client_qrencode(...)`
  - [x] удаления inline SQL fetch-wiring в этих CLI-обертках compat-layer
- [x] Добавлены unit-тесты:
  - [x] `tests/test_interfaces_clients_cli_read_ops.py`
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_interfaces_clients_cli_read_ops.py tests/test_interfaces_clients_cli_service_ops.py tests/test_interfaces_clients_cli_legacy_ops.py tests/test_interfaces_clients_cli_interface_ops.py tests/test_interfaces_clients_cli_peer_ops.py tests/test_interfaces_clients_cli_misc_ops.py tests/test_interfaces_clients_cli_list_ops.py tests/test_interfaces_clients_service_ops.py tests/test_interfaces_clients_runtime_ops.py tests/test_interfaces_clients_awg_params_ops.py tests/test_interfaces_clients_validation_ops.py tests/test_interfaces_clients_interface_service_ops.py tests/test_interfaces_clients_client_service_ops.py tests/test_interfaces_clients_config_render_ops.py tests/test_interfaces_clients_ip_alloc_ops.py tests/test_ipsec_service_ops.py tests/test_ipsec_runtime_ops.py tests/test_ipsec_crud_ops.py tests/test_ipsec_query_ops.py tests/test_ipsec_validation_ops.py tests/test_ipsec_store.py` → `72 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `172 passed`

## 1.74) Вынос CLI auth/runtime support wiring в доменный module-layer

- [x] Добавлен модуль:
  - [x] `backend/domains/interfaces_clients/cli_support_ops.py`
    - `show_api_key_status`
    - `set_api_key`
    - `wg_lease_ip`
    - `add_peer`
    - `del_peer`
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] делегирования `show_api_key_status(...)`
  - [x] делегирования `set_api_key(...)`
  - [x] делегирования `wg_lease_ip(...)`
  - [x] делегирования `add_peer(...)`
  - [x] делегирования `del_peer(...)`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_interfaces_clients_cli_support_ops.py`
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_interfaces_clients_cli_support_ops.py tests/test_interfaces_clients_cli_read_ops.py tests/test_interfaces_clients_cli_service_ops.py tests/test_interfaces_clients_cli_legacy_ops.py tests/test_interfaces_clients_cli_interface_ops.py tests/test_interfaces_clients_cli_peer_ops.py tests/test_interfaces_clients_cli_misc_ops.py tests/test_interfaces_clients_cli_list_ops.py tests/test_interfaces_clients_service_ops.py tests/test_interfaces_clients_runtime_ops.py tests/test_interfaces_clients_awg_params_ops.py tests/test_interfaces_clients_validation_ops.py tests/test_interfaces_clients_interface_service_ops.py tests/test_interfaces_clients_client_service_ops.py tests/test_interfaces_clients_config_render_ops.py tests/test_interfaces_clients_ip_alloc_ops.py tests/test_ipsec_service_ops.py tests/test_ipsec_runtime_ops.py tests/test_ipsec_crud_ops.py tests/test_ipsec_query_ops.py tests/test_ipsec_validation_ops.py tests/test_ipsec_store.py` → `74 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `174 passed`

## 1.75) Вынос interfaces runtime composition wiring в доменный module-layer

- [x] Добавлен модуль:
  - [x] `backend/domains/interfaces_clients/runtime_service_ops.py`
    - `generate_keypair`
    - `create_temp_key_file`
    - `apply_interface_runtime`
    - `remove_interface_runtime`
    - `build_awg_set_command`
    - `append_config_param`
    - `build_client_config_lines`
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] делегирования `generate_keypair(...)`
  - [x] делегирования `create_temp_key_file(...)`
  - [x] делегирования `apply_interface_runtime(...)`
  - [x] делегирования `remove_interface_runtime(...)`
  - [x] делегирования `build_awg_set_command(...)`
  - [x] делегирования `append_config_param(...)`
  - [x] делегирования `build_client_config_lines(...)`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_interfaces_clients_runtime_service_ops.py`
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_interfaces_clients_runtime_service_ops.py tests/test_interfaces_clients_runtime_ops.py tests/test_interfaces_clients_service_ops.py tests/test_interfaces_clients_interface_service_ops.py tests/test_interfaces_clients_client_service_ops.py tests/test_interfaces_clients_config_render_ops.py tests/test_interfaces_clients_awg_params_ops.py tests/test_interfaces_clients_validation_ops.py tests/test_interfaces_clients_ip_alloc_ops.py tests/test_ipsec_service_ops.py tests/test_ipsec_runtime_ops.py tests/test_ipsec_crud_ops.py tests/test_ipsec_query_ops.py tests/test_ipsec_validation_ops.py tests/test_ipsec_store.py` → `55 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `177 passed`

## 1.76) Вынос interfaces config-render composition wiring в доменный module-layer

- [x] Добавлен модуль:
  - [x] `backend/domains/interfaces_clients/config_render_service_ops.py`
    - `serialize_interface_row`
    - `serialize_client_row`
    - `build_client_config`
    - `build_interface_server_config`
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] делегирования `serialize_interface_row(...)`
  - [x] делегирования `serialize_client_row(...)`
  - [x] делегирования `build_client_config(...)`
  - [x] делегирования `build_interface_server_config(...)`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_interfaces_clients_config_render_service_ops.py`
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_interfaces_clients_config_render_service_ops.py tests/test_interfaces_clients_config_render_ops.py tests/test_interfaces_clients_service_ops.py tests/test_interfaces_clients_interface_service_ops.py tests/test_interfaces_clients_client_service_ops.py tests/test_interfaces_clients_awg_params_ops.py tests/test_interfaces_clients_validation_ops.py tests/test_interfaces_clients_runtime_service_ops.py tests/test_interfaces_clients_runtime_ops.py tests/test_ipsec_service_ops.py tests/test_ipsec_runtime_ops.py tests/test_ipsec_crud_ops.py tests/test_ipsec_query_ops.py tests/test_ipsec_validation_ops.py tests/test_ipsec_store.py` → `57 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `181 passed`

## 1.77) Вынос legacy CLI composition wiring (`add_client/delete_client/sync`) в доменный module-layer

- [x] Добавлен модуль:
  - [x] `backend/domains/interfaces_clients/cli_legacy_service_ops.py`
    - `add_client`
    - `delete_client`
    - `sync`
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] делегирования `add_client(...)`
  - [x] делегирования `delete_client(...)`
  - [x] делегирования `sync(...)`
  - [x] удаления inline SQL wiring в compat-обертках этих legacy CLI потоков
- [x] Добавлены unit-тесты:
  - [x] `tests/test_interfaces_clients_cli_legacy_service_ops.py`
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_interfaces_clients_cli_legacy_service_ops.py tests/test_interfaces_clients_cli_legacy_ops.py tests/test_interfaces_clients_cli_service_ops.py tests/test_interfaces_clients_cli_read_ops.py tests/test_interfaces_clients_cli_support_ops.py tests/test_interfaces_clients_service_ops.py tests/test_interfaces_clients_runtime_service_ops.py tests/test_interfaces_clients_config_render_service_ops.py tests/test_interfaces_clients_runtime_ops.py tests/test_interfaces_clients_config_render_ops.py tests/test_ipsec_service_ops.py tests/test_ipsec_runtime_ops.py tests/test_ipsec_crud_ops.py tests/test_ipsec_query_ops.py tests/test_ipsec_validation_ops.py tests/test_ipsec_store.py` → `52 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `184 passed`

## 1.78) Вынос IPsec service-wiring compat-оберток в доменный module-layer

- [x] Добавлен модуль:
  - [x] `backend/domains/ipsec/service_layer_ops.py`
    - list/read wiring: `list_peers`, `list_identities`, `list_phase1_profiles`, `list_phase2_proposals`, `list_policies`
    - CRUD wiring: `upsert_peer`, `upsert_identity`, `upsert_phase1_profile`, `upsert_phase2_proposal`, `upsert_policy`, `delete_peer`, `delete_policy`
    - runtime wiring: `log_event`, `list_events`, `list_active_peers`, `list_installed_sas`, `load_peer`, `initiate_policy`, `terminate_peer`, `apply_config`
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] делегирования `list_ipsec_*_service(...)`
  - [x] делегирования `upsert_ipsec_*_service(...)`
  - [x] делегирования `delete_ipsec_*_service(...)`
  - [x] делегирования `_log_ipsec_event(...)`, `list_ipsec_events_service(...)`
  - [x] делегирования runtime вызовов `load/initiate/terminate/apply` через `service_layer_ops`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_ipsec_service_layer_ops.py`
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_ipsec_service_layer_ops.py tests/test_ipsec_service_ops.py tests/test_ipsec_runtime_ops.py tests/test_ipsec_crud_ops.py tests/test_ipsec_query_ops.py tests/test_ipsec_validation_ops.py tests/test_ipsec_store.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `187 passed`

## 1.79) Вынос firewall service-wiring compat-оберток в доменный module-layer

- [x] Добавлен модуль:
  - [x] `backend/domains/firewall/service_layer_ops.py`
    - rules/runtime/state wiring: `list_rules`, `apply_rules`, `create_rule`, `update_rule`, `delete_rule`, `reorder_rules`, `reset_counters`, `get_state`
    - collections/maps/tables/named-objects/schema wiring: `list_sets`, `upsert_set`, `delete_set`, `list_maps`, `upsert_map`, `delete_map`, `list_tables`, `list_named_objects`, `upsert_named_object`, `create_named_object`, `update_named_object`, `delete_named_object`, `upsert_table`, `delete_table`, `get_schema`
- [x] `awg_core.py` переведен на новый module-layer для:
  - [x] делегирования `list/apply/create/update/delete/reorder` firewall rules service wrappers
  - [x] делегирования `reset_firewall_counters_service(...)` и `get_firewall_state_service(...)`
  - [x] делегирования service wrappers коллекций/карт/таблиц/named objects/schema
  - [x] удаления прямых вызовов `firewall_{runtime,state,table,schema}_ops` из compat-оберток этого блока
- [x] Добавлены unit-тесты:
  - [x] `tests/test_firewall_service_layer_ops.py`
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_firewall_service_layer_ops.py tests/test_firewall_rule_ops.py tests/test_firewall_collection_ops.py tests/test_firewall_runtime_ops.py tests/test_firewall_state_ops.py tests/test_firewall_table_ops.py tests/test_firewall_named_object_ops.py tests/test_firewall_schema_ops.py` → `46 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests` → `190 passed`

## 1.80) Вынос IPsec helper/facade wiring compat-блока в доменный module-layer

- [x] Добавлен модуль:
  - [x] `backend/domains/ipsec/service_facade_ops.py`
    - helper wiring: `_read_collection`, `_write_collection`, `_valid_name`, `_normalize_ip_list`, `_normalize_ts_list`
    - proposal/secret wiring: `_build_phase1_proposal_string`, `_build_phase2_proposal_string`, `_secret_encrypt`, `_secret_decrypt`
    - public service wrappers: `list_*`, `upsert_*`, `delete_*`, `list_events_service`, `list_active_peers_service`, `list_installed_sas_service`, `load_peer_service`, `initiate_policy_service`, `terminate_peer_service`, `apply_config_service`
- [x] `awg_core.py` переведен на новый facade-layer для:
  - [x] удаления локальных IPsec helper-оберток (`_read/_write`, `_valid/_normalize`, proposal-string, secret encrypt/decrypt)
  - [x] делегирования `list/upsert/delete` IPsec service wrappers
  - [x] делегирования event/runtime wrappers (`events`, `load/initiate/terminate/apply`)
  - [x] удаления прямых импортов `ipsec_store`/`ipsec_validation_ops` из compat-layer
- [x] Добавлены unit-тесты:
  - [x] `tests/test_ipsec_service_facade_ops.py`
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_ipsec_service_facade_ops.py tests/test_ipsec_service_layer_ops.py tests/test_ipsec_service_ops.py tests/test_ipsec_runtime_ops.py tests/test_ipsec_crud_ops.py tests/test_ipsec_query_ops.py tests/test_ipsec_validation_ops.py tests/test_ipsec_store.py` → `23 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `193 passed`

## 1.81) Cleanup мертвых compat-helper функций в `awg_core.py`

- [x] Выполнена очистка неиспользуемых helper-функций compat-layer:
  - [x] удалены `_read_json_file(...)` / `_write_json_file(...)` (после миграции на `backend.common.json_store` прямых вызовов не осталось)
  - [x] удалены `_firewall_rule_object_reference(...)` / `_find_named_object_references(...)` (в текущем service-layer wiring не используются)
  - [x] удален неиспользуемый импорт `json`
  - [x] удален неиспользуемый импорт `json_store` из `backend.common`
- [x] Внешнее поведение API и compat-оберток не изменено (только удаление мертвого кода).
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `193 passed`

## 1.82) Вынос interfaces_clients support/facade helper wiring в доменный module-layer

- [x] Добавлен модуль:
  - [x] `backend/domains/interfaces_clients/support_facade_ops.py`
    - API key/auth wiring: `load_api_key`, `save_api_key`, `verify_api_auth`, `rotate_api_key`
    - QR helper-ы: `render_qr_in_terminal`, `build_qr_svg`
    - backup/payload helper-ы: `read_database_bytes`, `restore_database_from_bytes`, `decode_base64_payload`
- [x] `awg_core.py` переведен на новый support-facade слой для:
  - [x] делегирования API key helpers (`load/save/verify/rotate`)
  - [x] делегирования QR helpers (`render_qr_in_terminal`, `build_qr_svg`)
  - [x] делегирования backup/base64 helpers (`read/restore database`, `decode_base64_payload`)
  - [x] удаления прямых compat-зависимостей: `api_key_store`, `segno`, `base64`/`binascii`/`io` импортов в `awg_core.py`
- [x] Добавлены unit-тесты:
  - [x] `tests/test_interfaces_clients_support_facade_ops.py`
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_interfaces_clients_support_facade_ops.py tests/test_interfaces_clients_service_ops.py tests/test_interfaces_clients_runtime_service_ops.py tests/test_interfaces_clients_config_render_service_ops.py tests/test_interfaces_clients_cli_support_ops.py tests/test_ipsec_service_facade_ops.py tests/test_ipsec_service_layer_ops.py tests/test_ipsec_service_ops.py tests/test_ipsec_runtime_ops.py tests/test_ipsec_crud_ops.py tests/test_ipsec_query_ops.py tests/test_ipsec_validation_ops.py tests/test_ipsec_store.py` → `40 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `198 passed`

## 1.83) Переключение manager-access на backend facade (без прямого резолва `awg_core` в доменах)

- [x] Добавлен модуль:
  - [x] `backend/app/manager_facade.py`
    - lazy delegation: `_manager`, `__getattr__`
- [x] Обновлен старый entrypoint делегирования:
  - [x] `backend/common/manager_access.py:get_manager()` теперь возвращает `backend.app.manager_facade` (вместо прямого `import awg_core`)
- [x] Внешнее поведение не изменено:
  - [x] доменные repository/runtime-adapter продолжают вызывать те же `*_service` методы manager-слоя через новый facade-proxy.
- [x] Добавлены unit-тесты:
  - [x] `tests/test_manager_access_facade.py`
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py tests/test_app_router.py tests/test_firewall_service_layer_ops.py tests/test_interfaces_clients_support_facade_ops.py tests/test_ipsec_service_facade_ops.py` → `15 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `200 passed`

## 1.84) Вынос crypto compat-wrapper (`encrypt/decrypt private key`) в `backend/common`

- [x] Добавлен модуль:
  - [x] `backend/common/crypto_facade_ops.py`
    - `encrypt_private_key`
    - `decrypt_private_key`
- [x] `awg_core.py` переведен на новый common-facade слой для:
  - [x] делегирования `encrypt_private_key(...)`
  - [x] делегирования `decrypt_private_key(...)`
  - [x] сохранения текущего fallback-поведения (`"InvalidToken"` при ошибке дешифрования)
- [x] Добавлены unit-тесты:
  - [x] `tests/test_crypto_facade_ops.py`
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_crypto_facade_ops.py tests/test_crypto_common.py tests/test_interfaces_clients_service_ops.py tests/test_ipsec_service_facade_ops.py` → `12 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `203 passed`

## 1.85) Backend-first routing в `manager_facade` для IPsec read/runtime (с fallback на `awg_core`)

- [x] Обновлен модуль:
  - [x] `backend/app/manager_facade.py`
    - backend-first маршруты:
      - [x] `list_ipsec_peers_service`
      - [x] `list_ipsec_identities_service`
      - [x] `list_ipsec_policies_service`
      - [x] `list_ipsec_phase1_profiles_service`
      - [x] `list_ipsec_phase2_proposals_service`
      - [x] `list_ipsec_events_service`
      - [x] `list_ipsec_active_peers_service`
      - [x] `list_ipsec_installed_sas_service`
    - fallback helper:
      - [x] `_backend_or_fallback` (переключение на `awg_core` service-wrapper при ошибке backend-пути)
- [x] Старый entrypoint делегирования:
  - [x] доменные репозитории/адаптеры продолжают вызывать те же методы через `backend/common/manager_access.py:get_manager()`, но часть IPsec read/runtime запросов теперь обрабатывается напрямую через `backend.domains.ipsec.*` до fallback.
- [x] Добавлены/обновлены unit-тесты:
  - [x] `tests/test_manager_access_facade.py` (backend-first + fallback coverage)
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py tests/test_ipsec_service_layer_ops.py tests/test_ipsec_service_ops.py tests/test_ipsec_runtime_ops.py tests/test_ipsec_store.py` → `16 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `206 passed`

## 1.86) Расширение backend-first routing в `manager_facade` на IPsec write-path (с fallback на `awg_core`)

- [x] Обновлен модуль:
  - [x] `backend/app/manager_facade.py`
    - backend-first write маршруты:
      - [x] `upsert_ipsec_peer_service`
      - [x] `upsert_ipsec_phase1_profile_service`
      - [x] `upsert_ipsec_phase2_proposal_service`
      - [x] `upsert_ipsec_policy_service`
      - [x] `delete_ipsec_peer_service`
      - [x] `delete_ipsec_policy_service`
    - fallback helper расширен:
      - [x] `_backend_or_fallback` теперь прокидывает `*args/**kwargs` в fallback-вызов `awg_core` (чтобы write-методы корректно деградировали при ошибке backend-пути)
- [x] Старый entrypoint делегирования:
  - [x] доменные репозитории продолжают вызывать те же `*_service` через `backend/common/manager_access.py:get_manager()`, но IPsec write-операции `peer/phase1/phase2/policy/delete` теперь идут backend-first до fallback.
- [x] Добавлены/обновлены unit-тесты:
  - [x] `tests/test_manager_access_facade.py` (write backend-first + fallback coverage)
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py tests/test_ipsec_service_facade_ops.py tests/test_ipsec_service_layer_ops.py tests/test_ipsec_service_ops.py tests/test_ipsec_runtime_ops.py tests/test_ipsec_store.py` → `21 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `208 passed`

## 1.87) Backend-first routing в `manager_facade` для remaining IPsec identity/action paths (с fallback на `awg_core`)

- [x] Обновлен модуль:
  - [x] `backend/app/manager_facade.py`
    - добавлены backend-first identity/action маршруты:
      - [x] `upsert_ipsec_identity_service`
      - [x] `load_ipsec_peer_service`
      - [x] `initiate_ipsec_policy_service`
      - [x] `terminate_ipsec_peer_service`
      - [x] `apply_ipsec_config_service`
    - добавлен helper crypto-context:
      - [x] `_manager_crypto_context` (чтение `encryption_key`, `encryption_key_legacy`, `Fernet` из manager-модуля)
- [x] Совместимость:
  - [x] при любой ошибке backend-пути остается fallback на соответствующий `awg_core` service-wrapper через `_backend_or_fallback`.
- [x] Добавлены/обновлены unit-тесты:
  - [x] `tests/test_manager_access_facade.py` (identity/action backend-first + fallback coverage)
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py tests/test_ipsec_service_facade_ops.py tests/test_ipsec_service_layer_ops.py tests/test_ipsec_service_ops.py tests/test_ipsec_runtime_ops.py tests/test_ipsec_store.py` → `23 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `210 passed`

## 1.88) Перевод `interfaces_clients/repository` на backend-facade row-access слой (убраны прямые `manager.c.execute` из repository)

- [x] Обновлен модуль:
  - [x] `backend/app/manager_facade.py`
    - добавлены row-access helper-ы для repository-слоя:
      - [x] `list_interfaces_rows`
      - [x] `get_interface_row`
      - [x] `get_interface_row_by_name`
      - [x] `list_client_rows`
      - [x] `get_client_row`
    - backend-first реализация:
      - [x] direct query через sqlite (`data_paths -> db_file`)
      - [x] fallback на `awg_core.c` при недоступности direct DB-path query
- [x] Обновлен old entrypoint делегирования:
  - [x] `backend/domains/interfaces_clients/repository.py`
    - [x] `list/get` методы interfaces/clients больше не используют `manager.c.execute(...)` напрямую
    - [x] выборка строк идет через facade helper-ы `manager_facade` (`list_interfaces_rows/get_interface_row/...`)
    - [x] сериализация и публичное поведение API сохранены без изменений
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_interfaces_clients_service_ops.py tests/test_interfaces_clients_client_service_ops.py tests/test_interfaces_clients_interface_service_ops.py tests/test_app_router.py` → `15 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `210 passed`

## 1.89) Backend-first render helper-ы в `manager_facade` для interfaces/clients (serialize/config/qr) с fallback на `awg_core`

- [x] Обновлен модуль:
  - [x] `backend/app/manager_facade.py`
    - добавлены backend-first helper-ы:
      - [x] `serialize_interface_row`
      - [x] `serialize_client_row`
      - [x] `build_client_config`
      - [x] `build_qr_svg`
    - добавлены внутренние зависимости/utility:
      - [x] `_fetch_client_allowed_ips_row`, `_fetch_interface_peer_rows`
      - [x] `_detect_awg_version`, `_get_filtered_awg_params`
      - [x] `_decrypt_private_key`, `_build_client_config_lines`
      - [x] `_manager_crypto_context` расширен `invalid_token_type`
- [x] Совместимость:
  - [x] при ошибках backend-render пути вызывается fallback на legacy методы `awg_core` через `_backend_or_fallback`.
  - [x] wire/API поведение маршрутов не изменено.
- [x] Обновлены unit-тесты:
  - [x] `tests/test_manager_access_facade.py` (serialize/config/qr backend-first + fallback coverage)
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py tests/test_interfaces_clients_config_render_service_ops.py tests/test_interfaces_clients_service_ops.py tests/test_app_router.py` → `21 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `213 passed`

## 1.90) Перевод `interfaces_clients/repository` create/update/delete путей на facade CRUD-методы

- [x] Обновлен модуль:
  - [x] `backend/app/manager_facade.py`
    - добавлены CRUD facade-методы:
      - [x] `create_interface_row`, `update_interface_row`, `delete_interface_row`
      - [x] `create_client_row`, `update_client_row`, `delete_client_row`
    - совместимость:
      - [x] методы вызывают legacy service wrappers через `_backend_or_fallback` с явной передачей аргументов (payload/id), сохраняя текущий контракт.
- [x] Обновлен old entrypoint делегирования:
  - [x] `backend/domains/interfaces_clients/repository.py`
    - [x] `create/update/delete` для interfaces переведены на `manager.*_interface_row(...)`
    - [x] `create/update/delete` для clients переведены на `manager.*_client_row(...)`
    - [x] сериализация и API-поведение не изменены.
- [x] Обновлены unit-тесты:
  - [x] `tests/test_manager_access_facade.py` (CRUD facade arg-flow/fallback coverage)
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py tests/test_interfaces_clients_service_ops.py tests/test_interfaces_clients_client_service_ops.py tests/test_interfaces_clients_interface_service_ops.py tests/test_app_router.py` → `29 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `215 passed`

## 1.91) Backend-first выполнение client CRUD в `manager_facade` через domain service_ops (с legacy/stub-safe fallback)

- [x] Обновлен модуль:
  - [x] `backend/app/manager_facade.py`
    - client CRUD методы переведены на backend-first путь:
      - [x] `create_client_row` -> `_create_client_row_backend`
      - [x] `update_client_row` -> `_update_client_row_backend`
      - [x] `delete_client_row` -> `_delete_client_row_backend`
    - backend реализация использует:
      - [x] sqlite context (`_open_db`)
      - [x] доменный `backend.domains.interfaces_clients.service_ops`
      - [x] shared helper-ы IP allocation/validation/encryption/runtime command wiring
    - добавлен stub-safe guard:
      - [x] `_is_stub_manager` для тестового/legacy manager-режима
      - [x] row-access helper-ы (`list/get interface/client`) не уходят в direct sqlite при stub manager
- [x] Совместимость:
  - [x] при ошибках backend-пути сохраняется fallback на legacy `awg_core` service wrappers через `_backend_or_fallback`.
  - [x] публичный wire/API контракт не изменен.
- [x] Обновлены unit/contract проверки:
  - [x] `python3 -m pytest -q tests/test_api_contract.py tests/test_manager_access_facade.py` → `23 passed`
  - [x] `python3 -m pytest -q tests/test_interfaces_clients_service_ops.py tests/test_interfaces_clients_client_service_ops.py tests/test_app_router.py` → `10 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests` → `215 passed`

## 1.92) Backend-first выполнение interface CRUD в `manager_facade` через domain service_ops (с legacy/stub-safe fallback)

- [x] Обновлен модуль:
  - [x] `backend/app/manager_facade.py`
    - interface CRUD методы переведены на backend-first путь:
      - [x] `create_interface_row` -> `_create_interface_row_backend`
      - [x] `update_interface_row` -> `_update_interface_row_backend`
      - [x] `delete_interface_row` -> `_delete_interface_row_backend`
    - backend реализация использует:
      - [x] sqlite context (`_open_db`)
      - [x] доменный `backend.domains.interfaces_clients.service_ops`
      - [x] AWG/validation/runtime wiring через facade helper-ы
- [x] Совместимость:
  - [x] при ошибках backend-пути сохраняется fallback на legacy `awg_core` service wrappers через `_backend_or_fallback`.
  - [x] публичный wire/API контракт не изменен.
- [x] Обновлены unit/contract проверки:
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py tests/test_interfaces_clients_interface_service_ops.py tests/test_interfaces_clients_service_ops.py tests/test_app_router.py` → `27 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests` → `218 passed`

## 1.93) Декуплинг `WG_INTERFACE_COLUMNS`: перенос канонической DB-проекции в доменный `interfaces_clients/schema.py`

- [x] Добавлен модуль:
  - [x] `backend/domains/interfaces_clients/schema.py`
    - [x] `WG_INTERFACE_COLUMNS` как каноническая projection-константа для `wg_interfaces`
- [x] Обновлены old entrypoint-делегаторы:
  - [x] `backend/app/manager_facade.py`
    - [x] `_wg_interface_columns()` теперь читает константу из `interfaces_schema.WG_INTERFACE_COLUMNS` (без sourcing из `awg_core`)
  - [x] `awg_core.py`
    - [x] compat-константа `WG_INTERFACE_COLUMNS` переведена на алиас `interfaces_schema.WG_INTERFACE_COLUMNS`
- [x] Совместимость:
  - [x] wire/API поведение не изменено; перенос только структурный.
  - [x] fallback-пути manager facade сохранены без изменений.
- [x] Добавлены/обновлены проверки:
  - [x] `tests/test_interfaces_clients_schema.py` (coverage канонической проекции полей)
  - [x] `python3 -m pytest -q tests/test_interfaces_clients_schema.py tests/test_manager_access_facade.py tests/test_interfaces_clients_interface_service_ops.py tests/test_api_contract.py` → `32 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests` → `219 passed`

## 1.94) Backend-first support/runtime helpers в `manager_facade` для `interfaces_clients` (с fallback на `awg_core`)

- [x] Обновлен модуль:
  - [x] `backend/app/manager_facade.py`
    - добавлены backend-first helper-методы:
      - [x] `build_interface_server_config`
      - [x] `read_database_bytes`, `restore_database_from_bytes`, `decode_base64_payload`
      - [x] `load_api_key`, `save_api_key`, `verify_api_auth`, `rotate_api_key`
      - [x] `detect_awg_version`, `prepare_awg_params_for_version`
    - добавлен backend helper:
      - [x] `_restore_database_from_bytes_backend` (sqlite context через `_open_db`)
- [x] Совместимость:
  - [x] при ошибках backend-пути сохраняется fallback на legacy `awg_core` методы через `_backend_or_fallback`.
  - [x] wire/API контракт не изменен.
- [x] Обновлены unit/contract проверки:
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py tests/test_interfaces_clients_schema.py tests/test_interfaces_clients_interface_service_ops.py tests/test_interfaces_clients_service_ops.py tests/test_app_router.py` → `34 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests` → `225 passed`

## 1.95) Backend-first firewall service-routing в `manager_facade` (с fallback на `awg_core`)

- [x] Обновлен модуль:
  - [x] `backend/app/manager_facade.py`
    - добавлены backend-first firewall service-методы:
      - [x] rules/state/runtime: `list_firewall_rules_service`, `create/update/delete_firewall_rule_service`, `reorder_firewall_rules_service`, `reset_firewall_counters_service`, `get_firewall_state_service`, `apply_firewall_rules`
      - [x] collections/tables/objects/schema: `list/upsert/delete_firewall_set_service`, `list/upsert/delete_firewall_map_service`, `list/upsert/delete_firewall_table_service`, `list/upsert/create/update/delete_firewall_named_object_service`, `get_firewall_schema_service`
    - добавлены facade-local helper-ы firewall wiring:
      - [x] `_read/_write_firewall_*` для JSON store paths из `AWG_MANAGER_DATA_DIR`
      - [x] `_collect_firewall_table_defs`, `_list_firewall_runtime_tables`, `_parse_firewall_managed_table_key`, `_managed_firewall_table_key`
      - [x] fallback-safe default constants для firewall family/tables/kinds/prefix
- [x] Совместимость:
  - [x] при любой ошибке backend-path сохраняется fallback на legacy `awg_core` service wrappers через `_backend_or_fallback`.
  - [x] внешний wire/API контракт firewall маршрутов не изменен.
- [x] Обновлены unit/contract проверки:
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py tests/test_firewall_service_layer_ops.py tests/test_app_router.py tests/test_api_contract.py` → `40 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `228 passed`

## 1.96) Вынос firewall schema-констант из `awg_core.py` в доменный модуль `backend/domains/firewall/schema.py`

- [x] Добавлен модуль:
  - [x] `backend/domains/firewall/schema.py`
    - [x] вынесены канонические константы firewall-домена:
      - [x] `FIREWALL_TABLE_FAMILY`
      - [x] `FIREWALL_SUPPORTED_TABLE_FAMILIES`
      - [x] `FIREWALL_NAMED_OBJECT_KINDS`
      - [x] `FIREWALL_TABLE_PREFIX`
      - [x] `FIREWALL_SCHEMA`
      - [x] `FIREWALL_DEFAULT_TABLE_DEFS`
      - [x] `FIREWALL_RESERVED_PRIORITIES`
- [x] Обновлены old entrypoint-делегаторы:
  - [x] `awg_core.py`
    - [x] compat-константы переключены на алиасы из `firewall_schema.*`
  - [x] `backend/app/manager_facade.py`
    - [x] facade default-константы firewall переключены на `firewall_schema.*` (убрано дублирование локальных literals)
- [x] Совместимость:
  - [x] перенос только структурный; wire/API поведение не изменено.
  - [x] fallback-пути через `_backend_or_fallback` сохранены.
- [x] Добавлены/обновлены проверки:
  - [x] `tests/test_firewall_schema.py` (shape/semantics coverage для новых констант)
  - [x] `python3 -m pytest -q tests/test_firewall_schema.py tests/test_manager_access_facade.py tests/test_firewall_service_layer_ops.py tests/test_app_router.py tests/test_api_contract.py` → `41 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `229 passed`

## 1.97) Локализация firewall collection/object helper wiring в `manager_facade` (с сохранением fallback на `awg_core`)

- [x] Обновлен модуль:
  - [x] `backend/app/manager_facade.py`
    - добавлены facade-local helper-ы для firewall collection/object flows:
      - [x] timeout/runtime helpers: `_normalize_nft_timeout`, `_timeout_to_seconds`, `_enrich_collection_item_runtime`, `_cleanup_expired_collection_rows`
      - [x] runtime signature helpers: `_set_runtime_signature`, `_map_runtime_signature`
      - [x] object helpers: `_normalize_logical_bool`, `_validate_named_object_table_exists`, `_load_effective_table_objects_by_kind`, `_empty_named_objects_by_kind`
      - [x] table script assembly: `_append_firewall_table_script_lines` (через domain modules)
    - backend-first нормализация переведена с awg_core helper sourcing на доменные модули:
      - [x] `_normalize_firewall_set_item` -> `firewall_store.normalize_set_item`
      - [x] `_normalize_firewall_map_item` -> `firewall_store.normalize_map_item`
      - [x] `_normalize_firewall_table_item` -> `firewall_store.normalize_firewall_table_item`
      - [x] `_normalize_firewall_named_object_payload` -> `firewall_named_object_ops.normalize_named_object_payload`
    - `list/upsert` paths для firewall sets/maps переведены на локальные helper-ы (без `getattr(_manager(), "_cleanup_*")` / `enrich_collection_item_runtime` / `_*_runtime_signature`).
- [x] Совместимость:
  - [x] внешний wire/API контракт не изменен.
  - [x] общий fallback на legacy `awg_core` service wrappers через `_backend_or_fallback` сохранен.
- [x] Обновлены unit/contract проверки:
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py tests/test_firewall_service_layer_ops.py tests/test_firewall_rule_ops.py tests/test_firewall_schema.py tests/test_app_router.py tests/test_api_contract.py` → `61 passed`
  - [x] `python3 -m pytest -q tests` → `229 passed`

## 1.98) Вынос full-rule normalization pipeline в доменный `firewall/rule_normalization_service_ops.py` и удаление последнего private-helper bridge из `manager_facade`

- [x] Добавлен модуль:
  - [x] `backend/domains/firewall/rule_normalization_service_ops.py`
    - [x] `normalize_firewall_rule` (полный pipeline: extract -> table/chain context -> validations/normalizers -> payload build)
- [x] Обновлены entrypoint-слои:
  - [x] `backend/app/manager_facade.py`
    - [x] `_normalize_firewall_rule` переключен на `rule_normalization_service_ops.normalize_firewall_rule`
    - [x] удалена последняя зависимость на private helper `getattr(_manager(), "_normalize_firewall_rule")`
  - [x] `awg_core.py`
    - [x] compat-wrapper `_normalize_firewall_rule` переведен на `rule_normalization_service_ops.normalize_firewall_rule`
- [x] Совместимость:
  - [x] wire/API поведение не изменено; перенос структурный.
  - [x] fallback-пути `manager_facade` на `awg_core` сохранены.
- [x] Обновлены unit/contract проверки:
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py tests/test_firewall_rule_ops.py tests/test_firewall_service_layer_ops.py tests/test_firewall_schema.py tests/test_app_router.py tests/test_api_contract.py` → `61 passed`
  - [x] `python3 -m pytest -q tests` → `229 passed`

## 1.99) Вынос shared firewall helper wiring в доменный `firewall/helper_service_ops.py` (повторное использование в `awg_core.py` и `manager_facade`)

- [x] Добавлен модуль:
  - [x] `backend/domains/firewall/helper_service_ops.py`
    - timeout helper-ы: `normalize_nft_timeout`, `timeout_to_seconds`
    - collection runtime helper-ы: `enrich_collection_item_runtime`, `cleanup_expired_collection_rows`, `set_runtime_signature`, `map_runtime_signature`
    - named-object helper-ы: `normalize_logical_bool`, `empty_named_objects_by_kind`, `load_effective_table_objects_by_kind`, `validate_named_object_table_exists`
- [x] Обновлены entrypoint-слои:
  - [x] `backend/app/manager_facade.py`
    - локальные helper-функции timeout/runtime-signature/effective-objects/validate-table переведены на `firewall_helper_service_ops.*`
  - [x] `awg_core.py`
    - helper-функции timeout/runtime-signature/effective-objects/validate-table/logical-bool переведены на `firewall_helper_service_ops.*`
- [x] Совместимость:
  - [x] wire/API поведение не изменено; перенос структурный.
  - [x] fallback-пути `manager_facade` сохранены.
- [x] Добавлены/обновлены проверки:
  - [x] `tests/test_firewall_helper_service_ops.py` (timeout + runtime/declaration merge behavior)
  - [x] `python3 -m pytest -q tests/test_firewall_helper_service_ops.py tests/test_manager_access_facade.py tests/test_firewall_rule_ops.py tests/test_firewall_service_layer_ops.py tests/test_firewall_schema.py tests/test_app_router.py tests/test_api_contract.py` → `63 passed`
  - [x] `python3 -m pytest -q tests` → `231 passed`

## 1.100) Удаление остаточных firewall compat-wrapper-ов в `awg_core.py` (direct domain wiring)

- [x] Обновлен `awg_core.py`:
  - [x] удалены избыточные локальные wrapper-helper-ы:
    - `_empty_named_objects_by_kind`
    - `_load_table_objects_by_kind`
    - `_load_declared_table_objects_by_kind`
    - `_normalize_named_object_payload`
    - `_normalize_set_item`
    - `_normalize_map_item`
    - `_normalize_firewall_table_item`
  - [x] service-wrapper wiring переключен на прямые доменные вызовы без промежуточных локальных оберток:
    - `upsert_firewall_set_service` -> `firewall_store.normalize_set_item`
    - `upsert_firewall_map_service` -> `firewall_store.normalize_map_item`
    - `upsert_firewall_named_object_service` -> `firewall_named_object_ops.normalize_named_object_payload`
    - `upsert_firewall_table_service` -> `firewall_store.normalize_firewall_table_item`
  - [x] effective runtime objects merge использует прямой callback runtime-adapter:
    - `_load_effective_table_objects_by_kind` -> `firewall_runtime_adapter.list_table_objects_by_kind`
- [x] Совместимость:
  - [x] wire/API поведение не изменено; изменения только структурные.
  - [x] доменные границы сохранены (HTTP-логика не добавлялась в домены).
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `231 passed`

## 1.101) Удаление локальных firewall normalize-wrapper-ов в `backend/app/manager_facade.py` (direct domain wiring)

- [x] Обновлен `backend/app/manager_facade.py`:
  - [x] удалены избыточные локальные normalize-wrapper-ы:
    - `_normalize_firewall_set_item`
    - `_normalize_firewall_map_item`
    - `_normalize_firewall_table_item`
    - `_normalize_firewall_named_object_payload`
  - [x] `normalize_item_fn` в firewall service-routing переключен на прямые domain-вызовы:
    - `upsert_firewall_set_service` -> `firewall_store.normalize_set_item`
    - `upsert_firewall_map_service` -> `firewall_store.normalize_map_item`
    - `upsert_firewall_named_object_service` -> `firewall_named_object_ops.normalize_named_object_payload`
    - `upsert_firewall_table_service` -> `firewall_store.normalize_firewall_table_item`
- [x] Совместимость:
  - [x] fallback-модель `manager_facade` (`_backend_or_fallback`) сохранена.
  - [x] wire/API поведение не изменено; изменения структурные.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py` → `26 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `231 passed`

## 1.102) Очистка неиспользуемого helper-а в `manager_facade` после domain-first выноса

- [x] Обновлен `backend/app/manager_facade.py`:
  - [x] удален неиспользуемый helper `_empty_named_objects_by_kind` (после перехода на `firewall_helper_service_ops.load_effective_table_objects_by_kind` прямым wiring).
- [x] Совместимость:
  - [x] wire/API поведение не изменено; удален только мертвый локальный код.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py` → `26 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `231 passed`

## 1.103) Вынос shared firewall table-script assembly в доменный helper и подключение из compat/facade

- [x] Обновлены доменные модули:
  - [x] `backend/domains/firewall/helper_service_ops.py`
    - добавлен общий helper `append_table_script_lines` (table/chain/rules/named-objects/runtime collections script assembly).
- [x] Обновлены entrypoint-слои:
  - [x] `awg_core.py`
    - `_append_table_script_lines` переведен на делегирование в `firewall_helper_service_ops.append_table_script_lines`.
  - [x] `backend/app/manager_facade.py`
    - `_append_firewall_table_script_lines` переведен на делегирование в `firewall_helper_service_ops.append_table_script_lines`.
- [x] Совместимость:
  - [x] wire/API поведение не изменено; изменение структурное.
  - [x] логика script assembly унифицирована между compat (`awg_core`) и facade (`manager_facade`).
- [x] Добавлены/обновлены проверки:
  - [x] `tests/test_firewall_helper_service_ops.py`
    - добавлен тест `test_append_table_script_lines_builds_table_chain_and_rule_lines`.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_firewall_helper_service_ops.py` → `3 passed`
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py` → `26 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `232 passed`

## 1.104) Вынос shared firewall table-def collection helper и подключение из compat/facade

- [x] Обновлены доменные модули:
  - [x] `backend/domains/firewall/helper_service_ops.py`
    - добавлен общий helper `collect_table_defs` (read custom tables + `store.collect_table_defs` composition).
- [x] Обновлены entrypoint-слои:
  - [x] `awg_core.py`
    - `_collect_firewall_table_defs` переведен на делегирование в `firewall_helper_service_ops.collect_table_defs`.
  - [x] `backend/app/manager_facade.py`
    - `_collect_firewall_table_defs` переведен на делегирование в `firewall_helper_service_ops.collect_table_defs`.
- [x] Совместимость:
  - [x] wire/API поведение не изменено; изменение структурное.
  - [x] логика сборки table-defs унифицирована между compat (`awg_core`) и facade (`manager_facade`).
- [x] Добавлены/обновлены проверки:
  - [x] `tests/test_firewall_helper_service_ops.py`
    - добавлен тест `test_collect_table_defs_merges_default_and_custom_tables`.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_firewall_helper_service_ops.py` → `4 passed`
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py` → `26 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `233 passed`

## 1.105) Удаление локальных managed-table/runtime wrapper-ов в `apply_firewall_rules` (direct domain/store callbacks)

- [x] Обновлен `awg_core.py`:
  - [x] удалены локальные helper-wrapper-ы, использовавшиеся только в `apply_firewall_rules`:
    - `_read_managed_tables_file`
    - `_write_managed_tables_file`
    - `_managed_table_key`
    - `_parse_managed_table_key`
    - `_list_runtime_tables`
  - [x] wiring в `apply_firewall_rules` переведен на прямые callbacks:
    - `firewall_store.read_managed_tables` / `firewall_store.write_managed_tables`
    - `firewall_store.parse_managed_table_key` / `firewall_store.managed_table_key`
    - `firewall_runtime_adapter.list_tables`
- [x] Обновлен `backend/app/manager_facade.py`:
  - [x] удалены локальные helper-wrapper-ы, использовавшиеся только в `apply_firewall_rules`:
    - `_read_firewall_managed_tables_file`
    - `_write_firewall_managed_tables_file`
    - `_list_firewall_runtime_tables`
    - `_parse_firewall_managed_table_key`
    - `_managed_firewall_table_key`
  - [x] backend-first wiring в `apply_firewall_rules` переведен на прямые callbacks доменных `store/adapter`.
- [x] Совместимость:
  - [x] wire/API поведение не изменено; изменение структурное.
  - [x] fallback-модель `manager_facade` (`_backend_or_fallback`) сохранена.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_firewall_helper_service_ops.py` → `4 passed`
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py` → `26 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `233 passed`

## 1.106) Удаление локальных bool/table-validation и rule-render compat-wrapper-ов в firewall named-object/script wiring

- [x] Обновлен `awg_core.py`:
  - [x] удалены локальные wrapper-ы:
    - `_validate_named_object_table_exists`
    - `_normalize_logical_bool`
    - `_render_firewall_rule`
  - [x] wiring переведен на прямые доменные callbacks:
    - `render_rule_fn=firewall_rule_ops.render_firewall_rule` в `_append_table_script_lines`
    - `normalize_bool_fn=firewall_helper_service_ops.normalize_logical_bool` в `upsert_firewall_named_object_service`
    - `validate_table_exists_fn` через `firewall_helper_service_ops.validate_named_object_table_exists` (с `collect_table_defs_fn=_collect_firewall_table_defs`)
- [x] Обновлен `backend/app/manager_facade.py`:
  - [x] удалены локальные wrapper-ы:
    - `_normalize_logical_bool`
    - `_validate_named_object_table_exists`
  - [x] backend-first named-object wiring переведен на прямые domain callbacks:
    - `normalize_bool_fn=firewall_helper_service_ops.normalize_logical_bool`
    - `validate_table_exists_fn` через `firewall_helper_service_ops.validate_named_object_table_exists` (с `collect_table_defs_fn=_collect_firewall_table_defs`)
- [x] Совместимость:
  - [x] wire/API поведение не изменено; изменение структурное.
  - [x] fallback-модель `manager_facade` (`_backend_or_fallback`) сохранена.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_firewall_helper_service_ops.py` → `4 passed`
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py` → `26 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `233 passed`

## 1.107) Удаление локальных `_append_*table_script_lines` wrapper-ов через `functools.partial` callback wiring

- [x] Обновлены доменные модули:
  - [x] `backend/domains/firewall/helper_service_ops.py`
    - `append_table_script_lines` переведен на совместимую callback-сигнатуру runtime слоя (позиционные аргументы + `include_runtime_objects`).
- [x] Обновлен `awg_core.py`:
  - [x] удален локальный wrapper `_append_table_script_lines`.
  - [x] `apply_firewall_rules` и `reset_firewall_counters_service` используют `functools.partial(firewall_helper_service_ops.append_table_script_lines, ...)`.
- [x] Обновлен `backend/app/manager_facade.py`:
  - [x] удален локальный wrapper `_append_firewall_table_script_lines`.
  - [x] backend-first пути `apply_firewall_rules` и `reset_firewall_counters_service` используют `functools.partial(firewall_helper_service_ops.append_table_script_lines, ...)`.
- [x] Совместимость:
  - [x] wire/API поведение не изменено; изменение структурное.
  - [x] fallback-модель `manager_facade` (`_backend_or_fallback`) сохранена.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_firewall_helper_service_ops.py` → `4 passed`
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py` → `26 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `233 passed`

## 1.108) Перевод firewall collect/load/normalize callback wiring на shared callable-ы (partial/def mix)

- [x] Обновлен `awg_core.py`:
  - [x] `def`-wrapper-ы заменены на shared callable-ы через `functools.partial`:
    - `_load_effective_table_objects_by_kind`
    - `_collect_firewall_table_defs`
    - `_normalize_firewall_rule`
  - [x] сервисные wiring-пути `list/create/update/reorder/apply/reset/...` продолжают использовать те же callbacks без изменения wire/API поведения.
- [x] Обновлен `backend/app/manager_facade.py`:
  - [x] `def`-wrapper-ы заменены на shared callable-ы через `functools.partial`:
    - `_load_effective_table_objects_by_kind`
    - `_collect_firewall_table_defs`
  - [x] `_normalize_firewall_rule` оставлен `def` (lazy) для import-time безопасности:
    - при инициализации модуля нельзя рано дергать `_firewall_schema()`/`_manager()` (иначе тестовый import-path тянет `awg_core` и внешние зависимости раньше времени).
- [x] Совместимость:
  - [x] wire/API поведение не изменено; изменение структурное.
  - [x] fallback-модель `manager_facade` (`_backend_or_fallback`) сохранена.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py` → `26 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_helper_service_ops.py` → `4 passed`
  - [x] `python3 -m pytest -q tests` → `233 passed`

## 1.109) Перевод firewall `read/write` compat-wrapper-ов в `awg_core.py` на path-bound `functools.partial`

- [x] Обновлен `awg_core.py`:
  - [x] функции-обертки `def _read/_write_firewall_*` заменены на shared bound-callbacks через `functools.partial`:
    - `_read_firewall_rules_file`, `_read_firewall_sets_file`, `_write_firewall_sets_file`
    - `_read_firewall_maps_file`, `_write_firewall_maps_file`
    - `_read_firewall_objects_file`, `_write_firewall_objects_file`
    - `_read_firewall_tables_file`, `_write_firewall_tables_file`
    - `_read_firewall_stats_file`, `_write_firewall_stats_file`
    - `_write_firewall_rules_file`
  - [x] сигнатуры callback-ов для service-layer сохраняются без изменений (0-arg read / 1-arg write).
- [x] Совместимость:
  - [x] wire/API поведение не изменено; изменение структурное.
  - [x] пути чтения/записи по `AWG_MANAGER_DATA_DIR` сохранены через те же constants.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py` → `26 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_helper_service_ops.py` → `4 passed`
  - [x] `python3 -m pytest -q tests` → `233 passed`

## 1.110) Перевод firewall `read/write` и runtime-signature helper wiring в `manager_facade.py` на callable adapters

- [x] Обновлен `backend/app/manager_facade.py`:
  - [x] `def`-обертки firewall store `read/write` переведены в callable adapters (`lambda`) с сохранением динамического `_state_paths()`:
    - `_read/_write_firewall_rules_file`
    - `_read/_write_firewall_sets_file`
    - `_read/_write_firewall_maps_file`
    - `_read/_write_firewall_tables_file`
    - `_read/_write_firewall_objects_file`
    - `_read/_write_firewall_stats_file`
  - [x] helper wiring runtime-signature/timeout cleanup переведен в `functools.partial`:
    - `_normalize_nft_timeout`, `_timeout_to_seconds`
    - `_cleanup_expired_collection_rows`
    - `_set_runtime_signature`, `_map_runtime_signature`
  - [x] `_enrich_collection_item_runtime` оставлен как `def` для сохранения optional `now_ts` semantics.
- [x] Совместимость:
  - [x] wire/API поведение не изменено; изменение структурное.
  - [x] fallback-модель `manager_facade` (`_backend_or_fallback`) сохранена.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py` → `26 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_helper_service_ops.py` → `4 passed`
  - [x] `python3 -m pytest -q tests` → `233 passed`

## 1.111) Перевод timeout/runtime-signature helper wiring в `awg_core.py` на `functools.partial`

- [x] Обновлен `awg_core.py`:
  - [x] helper-обертки переведены в bound-callables (`functools.partial`):
    - `normalize_nft_timeout`
    - `timeout_to_seconds`
    - `_cleanup_expired_collection_rows`
    - `_set_runtime_signature`
    - `_map_runtime_signature`
  - [x] `enrich_collection_item_runtime` оставлен функцией для сохранения optional `now_ts` semantics.
- [x] Совместимость:
  - [x] wire/API поведение не изменено; изменение структурное.
  - [x] callback-сигнатуры для firewall service-layer сохранены.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_firewall_helper_service_ops.py` → `4 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py` → `26 passed`
  - [x] `python3 -m pytest -q tests` → `233 passed`

## 1.112) Централизация managed/runtime/append callback-пакета в `manager_facade` и `awg_core`

- [x] Обновлен `backend/app/manager_facade.py`:
  - [x] добавлены shared callable-ы для firewall apply/reset wiring:
    - `_read_managed_firewall_tables`, `_write_managed_firewall_tables`
    - `_parse_managed_firewall_table_key`, `_list_firewall_runtime_tables`
    - `_append_firewall_table_script_lines`
  - [x] `apply_firewall_rules` и `reset_firewall_counters_service` переключены на эти shared callback-ы (удалены дубли inline lambda/partial).
- [x] Обновлен `awg_core.py`:
  - [x] добавлены shared callable-ы для firewall apply/reset wiring:
    - `_read_managed_firewall_tables`, `_write_managed_firewall_tables`
    - `_parse_managed_firewall_table_key`, `_list_firewall_runtime_tables`
    - `_append_firewall_table_script_lines`
  - [x] `apply_firewall_rules` и `reset_firewall_counters_service` переключены на shared callback-ы.
- [x] Совместимость:
  - [x] wire/API поведение не изменено; изменения структурные.
  - [x] fallback-модель `manager_facade` (`_backend_or_fallback`) сохранена.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py` → `26 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_helper_service_ops.py` → `4 passed`
  - [x] `python3 -m pytest -q tests` → `233 passed`

## 1.113) Централизация `normalize_item_fn` wiring в firewall upsert-paths (`manager_facade` + `awg_core`)

- [x] Обновлен `backend/app/manager_facade.py`:
  - [x] добавлены shared callable-ы для firewall normalizer wiring:
    - `_normalize_firewall_set_item`
    - `_normalize_firewall_map_item`
    - `_normalize_firewall_named_object_payload`
    - `_normalize_firewall_table_item`
  - [x] `upsert_firewall_set_service`, `upsert_firewall_map_service`, `upsert_firewall_named_object_service`, `upsert_firewall_table_service` переключены на shared callable-ы (без дубли inline `lambda` в call-sites).
- [x] Обновлен `awg_core.py`:
  - [x] введен зеркальный shared-callable пакет для тех же firewall normalizer-paths:
    - `_normalize_firewall_set_item`
    - `_normalize_firewall_map_item`
    - `_normalize_firewall_named_object_payload`
    - `_normalize_firewall_table_item`
  - [x] compat upsert service-wrapper-ы переключены на shared callable-ы (с сохранением прежних callback-сигнатур service-layer).
- [x] Совместимость:
  - [x] wire/API поведение не изменено; изменение структурное.
  - [x] fallback-модель `manager_facade` (`_backend_or_fallback`) сохранена.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py` → `26 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_helper_service_ops.py` → `4 passed`
  - [x] `python3 -m pytest -q tests` → `233 passed`

## 1.114) Централизация named-object query/validation callback wiring в firewall paths (`manager_facade` + `awg_core`)

- [x] Обновлен `awg_core.py`:
  - [x] добавлены shared callback-ы:
    - `_validate_firewall_named_object_table_exists`
    - `_parse_firewall_named_objects_query`
  - [x] `normalize_named_object_payload` wiring переведен на `_validate_firewall_named_object_table_exists` (без inline `lambda`).
  - [x] `list_firewall_named_objects_service` переведен на `_parse_firewall_named_objects_query` (без inline `lambda`).
- [x] Обновлен `backend/app/manager_facade.py`:
  - [x] добавлены shared callback-ы:
    - `_validate_firewall_named_object_table_exists`
    - `_parse_firewall_named_objects_query`
  - [x] `normalize_named_object_payload` wiring переведен на shared callback validation.
  - [x] backend-path `list_firewall_named_objects_service` использует shared parse-query callback.
- [x] Совместимость:
  - [x] wire/API поведение не изменено; изменение структурное.
  - [x] fallback-модель `manager_facade` (`_backend_or_fallback`) сохранена.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py` → `26 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `233 passed`

## 1.115) Удаление lambda-адаптеров в firewall managed-table callback wiring (`manager_facade` + `awg_core`)

- [x] Обновлен `awg_core.py`:
  - [x] managed-table callback-ы переведены с `lambda` на shared `functools.partial`:
    - `_read_managed_firewall_tables`
    - `_write_managed_firewall_tables`
    - `_parse_managed_firewall_table_key`
    - `_list_firewall_runtime_tables`
- [x] Обновлен `backend/app/manager_facade.py`:
  - [x] managed-table callback-ы переведены с `lambda` на именованные helper-функции:
    - `_read_managed_firewall_tables`
    - `_write_managed_firewall_tables`
    - `_parse_managed_firewall_table_key`
    - `_list_firewall_runtime_tables`
  - [x] сохранена динамика вычисления `_state_paths()` и `_firewall_supported_families()` на момент вызова.
- [x] Совместимость:
  - [x] wire/API поведение не изменено; изменение структурное.
  - [x] fallback-модель `manager_facade` (`_backend_or_fallback`) сохранена.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py` → `26 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `233 passed`

## 1.116) Перевод firewall store `read/write` callback-ов в `manager_facade` с lambda на именованные helper-функции

- [x] Обновлен `backend/app/manager_facade.py`:
  - [x] заменены lambda-адаптеры firewall store callbacks на именованные helper-функции:
    - `_read_firewall_rules_file`, `_write_firewall_rules_file`
    - `_read_firewall_sets_file`, `_write_firewall_sets_file`
    - `_read_firewall_maps_file`, `_write_firewall_maps_file`
    - `_read_firewall_tables_file`, `_write_firewall_tables_file`
    - `_read_firewall_objects_file`, `_write_firewall_objects_file`
    - `_read_firewall_stats_file`, `_write_firewall_stats_file`
  - [x] сохранена динамика вычисления `_state_paths()` в момент вызова callback-а.
- [x] Совместимость:
  - [x] wire/API поведение не изменено; изменение структурное.
  - [x] fallback-модель `manager_facade` (`_backend_or_fallback`) сохранена.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py` → `26 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `233 passed`

## 1.117) Централизация `id_factory` wiring для нормализации firewall rules (`awg_core` + `manager_facade`)

- [x] Обновлен `awg_core.py`:
  - [x] добавлен shared helper `_generate_firewall_rule_id`.
  - [x] `id_factory` в `_normalize_firewall_rule` переведен с inline `lambda` на shared helper callback.
- [x] Обновлен `backend/app/manager_facade.py`:
  - [x] добавлен shared helper `_generate_firewall_rule_id`.
  - [x] `_normalize_firewall_rule` теперь явно прокидывает `id_factory=_generate_firewall_rule_id` в `rule_normalization_service_ops.normalize_firewall_rule`.
- [x] Совместимость:
  - [x] wire/API поведение не изменено; изменение структурное.
  - [x] fallback-модель `manager_facade` (`_backend_or_fallback`) сохранена.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py` → `26 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `233 passed`

## 1.118) Централизация default `id_factory` fallback в доменном firewall normalizer

- [x] Обновлен `backend/domains/firewall/rule_normalization_service_ops.py`:
  - [x] добавлен shared helper `_default_rule_id_factory`.
  - [x] fallback `id_factory` в `normalize_firewall_rule` переведен с inline `lambda` на shared helper callback.
- [x] Совместимость:
  - [x] wire/API поведение не изменено; изменение структурное.
  - [x] существующий routing/compat wiring в `awg_core` и `manager_facade` сохранен.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py` → `26 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `233 passed`

## 1.119) Централизация default `id_factory` fallback в доменном firewall named-object normalizer

- [x] Обновлен `backend/domains/firewall/named_object_ops.py`:
  - [x] добавлен shared helper `_default_named_object_id_factory`.
  - [x] fallback `id_factory` в `normalize_named_object_payload` переведен с inline `lambda` на shared helper callback.
- [x] Совместимость:
  - [x] wire/API поведение не изменено; изменение структурное.
  - [x] текущий routing/compat wiring (`awg_core` + `manager_facade`) не изменялся.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py` → `26 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `233 passed`

## 1.120) Централизация `other_names` callback wiring в firewall service-layer (`sets/maps`)

- [x] Обновлен `backend/domains/firewall/service_layer_ops.py`:
  - [x] добавлены shared helper-генераторы:
    - `_iter_other_set_names`
    - `_iter_other_map_names`
  - [x] `upsert_set` и `upsert_map` переведены с inline `lambda` на `functools.partial(...)` над shared helper-ами.
- [x] Совместимость:
  - [x] wire/API поведение не изменено; изменение структурное.
  - [x] существующий compat/facade routing не изменялся.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_firewall_service_layer_ops.py` → `3 passed`
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py` → `26 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `233 passed`

## 1.121) Централизация `render_stmt_fn` callback wiring в firewall helper script-assembly

- [x] Обновлен `backend/domains/firewall/helper_service_ops.py`:
  - [x] добавлен shared helper `_render_named_object_add_statement`.
  - [x] в `append_table_script_lines` callback `render_stmt_fn` переведен с inline `lambda` на `functools.partial(...)` над shared helper.
- [x] Совместимость:
  - [x] wire/API поведение не изменено; изменение структурное.
  - [x] текущий compat/facade wiring не изменялся.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_firewall_helper_service_ops.py` → `4 passed`
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py` → `26 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `233 passed`

## 1.122) Частичный перевод firewall `_backend_or_fallback` service-callback-ов в `manager_facade` с lambda на `functools.partial`

- [x] Обновлен `backend/app/manager_facade.py`:
  - [x] в части firewall service-routing callback-и `_backend_or_fallback` переведены с inline `lambda` на `functools.partial(...)`:
    - `list_firewall_tables_service`
    - `list_firewall_named_objects_service`
    - `upsert/create/update/delete_firewall_named_object_service`
    - `upsert/delete_firewall_table_service`
    - `get_firewall_schema_service`
- [x] Совместимость:
  - [x] wire/API поведение не изменено; изменение структурное.
  - [x] fallback-модель `manager_facade` (`_backend_or_fallback`) сохранена.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_firewall_service_layer_ops.py` → `3 passed`
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py` → `26 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `233 passed`

## 1.123) Расширение перевода firewall `_backend_or_fallback` service-callback-ов в `manager_facade` с lambda на `functools.partial` (rules/state/sets/maps)

- [x] Обновлен `backend/app/manager_facade.py`:
  - [x] в firewall service-routing callback-и `_backend_or_fallback` переведены с inline `lambda` на `functools.partial(...)` для:
    - `list/apply/create/update/delete/reorder` firewall rules
    - `reset_firewall_counters_service`, `get_firewall_state_service`
    - `list/upsert/delete` firewall sets
    - `list/upsert/delete` firewall maps
- [x] Совместимость:
  - [x] wire/API поведение не изменено; изменение структурное.
  - [x] fallback-модель `manager_facade` (`_backend_or_fallback`) сохранена.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_firewall_service_layer_ops.py` → `3 passed`
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py` → `26 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `233 passed`

## 1.124) Перевод IPsec `_backend_or_fallback` service-callback-ов в `manager_facade` с lambda на `functools.partial` (read + write/action paths)

- [x] Обновлен `backend/app/manager_facade.py`:
  - [x] callback-и `_backend_or_fallback` переведены с inline `lambda` на `functools.partial(...)` для IPsec read-path:
    - `list_ipsec_peers_service`
    - `list_ipsec_identities_service`
    - `list_ipsec_policies_service`
    - `list_ipsec_phase1_profiles_service`
    - `list_ipsec_phase2_proposals_service`
    - `list_ipsec_events_service`
  - [x] callback-и `_backend_or_fallback` переведены на `functools.partial(...)` для IPsec write/action-path:
    - `upsert_ipsec_peer_service`
    - `upsert_ipsec_phase1_profile_service`
    - `upsert_ipsec_phase2_proposal_service`
    - `upsert_ipsec_policy_service`
    - `delete_ipsec_peer_service`
    - `delete_ipsec_policy_service`
    - `upsert_ipsec_identity_service`
    - `load_ipsec_peer_service`
    - `initiate_ipsec_policy_service`
    - `terminate_ipsec_peer_service`
    - `apply_ipsec_config_service`
  - [x] для crypto-зависимых путей добавлены lazy helper-ы (`_upsert_ipsec_identity_backend`, `_load_ipsec_peer_backend`, `_apply_ipsec_config_backend`) с defer-вычислением `_manager_crypto_context`, чтобы сохранить fallback-safe семантику.
- [x] Совместимость:
  - [x] wire/API поведение не изменено; изменение структурное.
  - [x] fallback-модель `manager_facade` (`_backend_or_fallback`) сохранена.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_ipsec_service_layer_ops.py` → `3 passed`
  - [x] `python3 -m pytest -q tests/test_ipsec_service_facade_ops.py` → `3 passed`
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py` → `26 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `233 passed`

## 1.125) Централизация crypto callback wiring в `manager_facade` через shared fernet helper-ы

- [x] Обновлен `backend/app/manager_facade.py`:
  - [x] `_encrypt_private_key` переведен с inline `fernet_encrypt_fn=lambda ...` на shared helper `_manager_fernet_encrypt`.
  - [x] `_decrypt_private_key` переведен с inline `fernet_decrypt_fn=lambda ...` на shared helper `_manager_fernet_decrypt`.
- [x] Совместимость:
  - [x] wire/API поведение не изменено; изменение структурное.
  - [x] crypto context resolution semantics сохранены через `_manager_crypto_context`.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py` → `26 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests/test_crypto_facade_ops.py` → `3 passed`
  - [x] `python3 -m pytest -q tests` → `233 passed`

## 1.126) Перевод interfaces/support `_backend_or_fallback` service-callback-ов в `manager_facade` с lambda на `functools.partial`

- [x] Обновлен `backend/app/manager_facade.py`:
  - [x] callback-и `_backend_or_fallback` переведены с inline `lambda` на `functools.partial(...)` для interfaces/render/support path:
    - `serialize_interface_row`
    - `serialize_client_row`
    - `build_client_config`
    - `build_interface_server_config`
    - `build_qr_svg`
    - `read_database_bytes`
    - `restore_database_from_bytes`
    - `decode_base64_payload`
    - `load_api_key`
    - `save_api_key`
    - `verify_api_auth`
    - `rotate_api_key`
    - `detect_awg_version`
    - `prepare_awg_params_for_version`
- [x] Совместимость:
  - [x] wire/API поведение не изменено; изменение структурное.
  - [x] fallback-модель `manager_facade` (`_backend_or_fallback`) сохранена.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py` → `26 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests/test_interfaces_clients_config_render_service_ops.py` → `4 passed`
  - [x] `python3 -m pytest -q tests/test_interfaces_clients_support_facade_ops.py` → `5 passed`
  - [x] `python3 -m pytest -q tests` → `233 passed`

## 1.127) Централизация `append_config_param_fn` wiring в interfaces config-render paths (`manager_facade`)

- [x] Обновлен `backend/app/manager_facade.py`:
  - [x] добавлен shared helper `_append_config_param_normalized`.
  - [x] `_build_client_config_lines` переведен с inline `append_config_param_fn=lambda ...` на shared helper callback.
  - [x] `build_interface_server_config` переведен с inline `append_config_param_fn=lambda ...` на shared helper callback.
- [x] Совместимость:
  - [x] wire/API поведение не изменено; изменение структурное.
  - [x] fallback-модель `manager_facade` (`_backend_or_fallback`) сохранена.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py` → `26 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests/test_interfaces_clients_config_render_service_ops.py` → `4 passed`
  - [x] `python3 -m pytest -q tests/test_interfaces_clients_runtime_service_ops.py` → `3 passed`
  - [x] `python3 -m pytest -q tests` → `233 passed`

## 1.128) Полный вынос inline callback wiring из interfaces/client facade-paths (`manager_facade`) в именованные helper/partial

- [x] Обновлен `backend/app/manager_facade.py`:
  - [x] полностью убраны inline `lambda` callback-и в facade/backend-first путях interfaces/clients/IP-alloc/AWG wiring.
  - [x] `_backend_or_fallback` call-sites для interface/client CRUD переведены на `functools.partial`.
  - [x] runtime wiring централизован через shared helper-ы: `_run_command_checked`, `_chmod_path` (вместо локальных inline callback-ов в call-sites).
  - [x] AWG wiring централизован через shared helper-ы: `_generate_awg_obfuscation_params`, `_parse_h_value_or_range`, `_get_awg_param_keys_for_version`.
  - [x] DB callback-и валидации/аллокации вынесены в именованные helper-ы + `partial`:
    - `_has_interface_name_conflict`, `_has_port_conflict`, `_fetch_all_interface_network_rows`
    - `_fetch_interface_subnet_row`, `_fetch_interface_used_ips`, `_fetch_conflict_ip`
  - [x] старые entrypoint-ы (`create/update/delete_*_row`, render/auth/support helpers) продолжают делегировать в доменные `interfaces_*_ops` через facade; fallback в `awg_core` сохранен через `_backend_or_fallback`.
- [x] Совместимость:
  - [x] wire/API поведение не изменено; изменение структурное.
  - [x] fallback-модель `manager_facade` (`_backend_or_fallback`) сохранена.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py` → `26 passed`
  - [x] `python3 -m pytest -q tests/test_interfaces_clients_service_ops.py` → `3 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `233 passed`

## 1.129) Централизация оставшегося compat callback wiring в `awg_core.py` (interfaces/ipsec paths)

- [x] Обновлен `awg_core.py`:
  - [x] полностью убраны оставшиеся inline `lambda` callback-и из interfaces/ipsec compat-paths.
  - [x] добавлены shared helper-ы:
    - `_run_command_checked`, `_fernet_encrypt`, `_fernet_decrypt`
    - `_has_interface_name_conflict`, `_has_port_conflict`, `_fetch_all_interface_network_rows`
    - `_fetch_allowed_ips_row`, `_fetch_interface_peer_rows`
  - [x] `assert_interface_uniqueness`, render/config helpers, runtime apply/remove, client/service/CLI flows и ipsec crypto callback wiring переведены на именованные helper callback-и (без inline lambda в call-sites).
- [x] Совместимость:
  - [x] wire/API поведение не изменено; изменение структурное.
  - [x] fallback-модель `manager_facade` (`_backend_or_fallback`) сохранена без изменений.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_interfaces_clients_service_ops.py tests/test_interfaces_clients_cli_legacy_service_ops.py tests/test_ipsec_service_facade_ops.py` → `9 passed`
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py` → `26 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `233 passed`

## 1.130) Централизация sqlite->manager fallback query wiring в `manager_facade` row-access/render paths

- [x] Обновлен `backend/app/manager_facade.py`:
  - [x] добавлены shared helper-ы:
    - `_query_rows_with_manager_fallback`
    - `_query_row_with_manager_fallback`
  - [x] `list_interfaces_rows`, `get_interface_row`, `get_interface_row_by_name`, `list_client_rows`, `get_client_row` переведены на единый fallback query path.
  - [x] `_fetch_client_allowed_ips_row` и `_fetch_interface_peer_rows` переведены на shared query helper-ы (с сохранением special-case для stub-manager в `_fetch_client_allowed_ips_row`).
  - [x] уменьшено дублирование прямых sqlite try/except + `awg_core.c` fallback-блоков в facade.
- [x] Совместимость:
  - [x] wire/API поведение не изменено; изменение структурное.
  - [x] fallback-модель `manager_facade` (`_backend_or_fallback` + manager-cursor fallback для row-access) сохранена.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py` → `26 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `233 passed`

## 1.131) Перевод IPsec write/action paths в `manager_facade` на прямой `ipsec_service_layer_ops` (с сохранением fallback)

- [x] Обновлен `backend/app/manager_facade.py`:
  - [x] IPsec write/action entrypoint-ы переведены с `ipsec_service_facade_ops` на прямые вызовы `ipsec_service_layer_ops`:
    - `upsert_ipsec_peer_service`, `upsert_ipsec_phase1_profile_service`, `upsert_ipsec_phase2_proposal_service`, `upsert_ipsec_policy_service`
    - `delete_ipsec_peer_service`, `delete_ipsec_policy_service`
    - `initiate_ipsec_policy_service`, `terminate_ipsec_peer_service`
    - backend helper-paths `upsert_ipsec_identity/load/apply` также переведены на `ipsec_service_layer_ops`.
  - [x] добавлен shared IPsec helper wiring в `manager_facade`:
    - коллекции: `_ipsec_read_collection`, `_ipsec_write_collection`
    - валидация: `_ipsec_valid_name`, `_ipsec_normalize_ip_list`, `_ipsec_normalize_ts_list`
    - proposal builders: `_ipsec_build_phase1_proposal_string`, `_ipsec_build_phase2_proposal_string`
    - crypto/event callbacks: `_ipsec_secret_encrypt`, `_ipsec_secret_decrypt`, `_ipsec_log_event`
  - [x] сохранена fallback-модель `_backend_or_fallback` для всех IPsec путей.
- [x] Совместимость:
  - [x] wire/API поведение не изменено; изменение структурное.
  - [x] backend-first модель сохранена; fallback на `awg_core` остается доступным при ошибках backend-path.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py tests/test_ipsec_service_layer_ops.py tests/test_ipsec_service_facade_ops.py` → `32 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `233 passed`

## 1.132) Укрупнение thin-shim паттерна в `manager_facade`: единый helper `partial + fallback` и унификация IPsec call-sites

- [x] Обновлен `backend/app/manager_facade.py`:
  - [x] добавлен shared helper `_backend_partial_call(...)`, инкапсулирующий шаблон `functools.partial(...) + _backend_or_fallback(...)`.
  - [x] весь публичный IPsec-блок facade (`list_*`, `upsert_*`, `delete_*`, `load/initiate/terminate/apply`) переведен на `_backend_partial_call`.
  - [x] добавлены/используются shared helper-ы `_ipsec_paths()` и `_ipsec_log_event_fn(paths)` для устранения повторов в call-sites.
  - [x] сохранены прежние fallback-аргументы публичных методов (`payload/name/policy/peer`), чтобы behavior fallback в `awg_core` не изменился.
- [x] Совместимость:
  - [x] wire/API поведение не изменено; изменение структурное.
  - [x] backend-first + fallback модель сохранена.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py tests/test_ipsec_service_layer_ops.py tests/test_ipsec_service_facade_ops.py` → `32 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `233 passed`

## 1.133) Укрупнение thin-shim паттерна в `manager_facade`: унификация всех firewall call-sites через `_backend_partial_call`

- [x] Обновлен `backend/app/manager_facade.py`:
  - [x] весь публичный firewall-блок (`rules/state/runtime`, `sets/maps/tables`, `named_objects/schema`) переведен с ручного шаблона `_backend_or_fallback + functools.partial` на единый `_backend_partial_call`.
  - [x] для методов с аргументами сохранены явные `fallback_args`, чтобы сигнатура fallback-вызова в `awg_core` оставалась прежней.
  - [x] сокращено дублирование call-site-кода и выровнен стиль dispatch между firewall и ipsec секциями facade.
- [x] Совместимость:
  - [x] wire/API поведение не изменено; изменение структурное.
  - [x] backend-first + fallback модель сохранена.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py tests/test_firewall_service_layer_ops.py tests/test_firewall_rule_ops.py` → `49 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `233 passed`

## 1.134) Завершение унификации facade-dispatch: interfaces/support/auth/AWG call-sites в `manager_facade` через `_backend_partial_call`

- [x] Обновлен `backend/app/manager_facade.py`:
  - [x] оставшиеся публичные call-site-ы (interfaces CRUD, render/config, support/auth, AWG helpers) переведены с прямого `_backend_or_fallback + partial` на единый `_backend_partial_call`.
  - [x] прямые вызовы `_backend_or_fallback` устранены из публичных facade-методов; в модуле остались только:
    - [x] базовая функция `_backend_or_fallback`
    - [x] helper `_backend_partial_call`, который ее инкапсулирует.
  - [x] для аргументных методов сохранены `fallback_args`, чтобы fallback-сигнатуры legacy `awg_core` вызовов не изменились.
- [x] Совместимость:
  - [x] wire/API поведение не изменено; изменение структурное.
  - [x] thin-shim dispatch в `manager_facade` стал единообразным по firewall/ipsec/interfaces paths.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py` → `26 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `233 passed`

## 1.135) Удаление eager-import `awg_core` из row-access fast-path в `manager_facade` (fallback-only import)

- [x] Обновлен `backend/app/manager_facade.py`:
  - [x] `_query_rows_with_manager_fallback` и `_query_row_with_manager_fallback` больше не импортируют `awg_core` заранее при `manager=None`; импорт выполняется только при реальном fallback.
  - [x] `list_interfaces_rows`, `get_interface_row`, `get_interface_row_by_name`, `list_client_rows`, `get_client_row`, `_fetch_interface_peer_rows` переведены на query-helper вызовы без предварительного `manager = _manager()`.
  - [x] behavior stub-ветки сохранен там, где он критичен (`_fetch_client_allowed_ips_row`).
- [x] Совместимость:
  - [x] wire/API поведение не изменено; изменение структурное.
  - [x] связность `manager_facade -> awg_core` снижена: импорт монолита в row-access путях теперь отложен до fallback-сценариев.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py` → `26 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `233 passed`

## 1.136) Formalization: structural guard-тесты для thin-shim `manager_facade`

- [x] Добавлен `tests/test_manager_facade_structure.py`:
  - [x] guard: прямые вызовы `_backend_or_fallback` разрешены только внутри `_backend_partial_call`.
  - [x] guard: минимальный охват thin-shim dispatch (`_backend_partial_call` >= 60 call-sites).
  - [x] guard: в `manager_facade` отсутствуют inline `lambda` (`ast.Lambda`).
- [x] Совместимость:
  - [x] поведение API не меняется; добавлены только структурные тесты-защиты от регресса архитектуры фасада.
  - [x] этап 1 (thin-shim readiness `manager_facade`) формально зафиксирован.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_manager_facade_structure.py tests/test_manager_access_facade.py` → `29 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `236 passed`

## 1.137) Начало финального истончения `awg_core.py`: перевод IPsec compat wrappers на прямой `ipsec_service_layer_ops`

- [x] Обновлен `awg_core.py`:
  - [x] удалена зависимость `ipsec_service_facade_ops` в compat-entrypoint.
  - [x] добавлен прямой wiring IPsec через `ipsec_service_layer_ops` + `ipsec_store` + `ipsec_validation_ops`.
  - [x] добавлены shared helper-ы `_ipsec_*` для read/write collection, validation/proposal, secret encrypt/decrypt, event-log callback.
  - [x] публичные IPsec service wrappers (`list_*`, `upsert_*`, `delete_*`, `load/initiate/terminate/apply`) переведены на `service_layer_ops`.
- [x] Совместимость:
  - [x] wire/API поведение не изменено; изменение структурное.
  - [x] `awg_core` сохранен как compat entrypoint, но IPsec orchestration теперь использует более тонкий доменный слой напрямую.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_ipsec_service_layer_ops.py tests/test_ipsec_service_facade_ops.py tests/test_manager_access_facade.py` → `32 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py tests/test_firewall_rule_ops.py tests/test_manager_facade_structure.py` → `32 passed`
  - [x] `python3 -m pytest -q tests` → `236 passed`

## 1.138) Финализация IPsec compat-entry: вынос callback wiring из `awg_core.py` в `backend.domains.ipsec.compat_entry_ops`

- [x] Обновлен `awg_core.py`:
  - [x] удален локальный `_ipsec_*` helper-wiring (store/validation/proposal/crypto/event) из compat-entrypoint.
  - [x] публичные IPsec service wrappers (`list_*`, `upsert_*`, `delete_*`, `load/initiate/terminate/apply`) переведены на thin-делегирование в `ipsec_compat_entry_ops`.
  - [x] сохранены прежние публичные имена и сигнатуры `awg_core` IPsec оберток.
- [x] Обновлены модульные карты:
  - [x] `docs/development/MODULE_MAP.md`
  - [x] `docs/development/MODULE_MAP.ru.md`
  - [x] зафиксировано новое владение compat wiring в `backend/domains/ipsec/compat_entry_ops.py`.
- [x] Добавлены/обновлены тесты:
  - [x] `tests/test_ipsec_compat_entry_ops.py` (новый structural/wiring guard для compat-entry слоя).
- [x] Совместимость:
  - [x] wire/API поведение не изменено; шаг чисто структурный (backend-first refactor).
  - [x] `awg_core.py` остается compat entrypoint, но IPsec wiring теперь живет в доменном модуле.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_ipsec_compat_entry_ops.py tests/test_ipsec_service_layer_ops.py tests/test_ipsec_service_facade_ops.py` → `9 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `239 passed`

## 1.139) Вынос interfaces/clients compat wiring из `awg_core.py` в `backend.domains.interfaces_clients.compat_entry_ops`

- [x] Добавлен `backend/domains/interfaces_clients/compat_entry_ops.py`:
  - [x] инкапсулирован wiring render/runtime/service compat wrappers (`serialize_*`, `build_*`, `apply/remove runtime`, `create/update/delete interface/client`).
  - [x] инкапсулирован shared wiring helper-ов (`build_awg_set_command`, `append_config_param`, `build_client_config_lines`, `get_next_available_ip`, `validate_client_ip_for_interface`).
- [x] Обновлен `awg_core.py`:
  - [x] compat-обертки interfaces/clients переключены на thin-делегирование в `interfaces_compat_entry_ops`.
  - [x] прямой wiring к `interfaces_service_ops`/`interfaces_runtime_service_ops`/`interfaces_config_render_service_ops` удален из compat-entrypoint.
  - [x] публичные имена/сигнатуры функций `awg_core` сохранены.
- [x] Добавлены/обновлены тесты:
  - [x] `tests/test_interfaces_clients_compat_entry_ops.py` (новый structural/wiring guard compat-entry слоя).
- [x] Обновлены модульные карты:
  - [x] `docs/development/MODULE_MAP.md`
  - [x] `docs/development/MODULE_MAP.ru.md`
- [x] Совместимость:
  - [x] wire/API поведение не изменено; шаг структурный.
  - [x] `awg_core.py` остается compat entrypoint, но interfaces/clients wiring перенесен в доменный модуль.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_interfaces_clients_compat_entry_ops.py tests/test_interfaces_clients_service_ops.py tests/test_interfaces_clients_runtime_service_ops.py tests/test_interfaces_clients_config_render_service_ops.py tests/test_manager_access_facade.py` → `39 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `242 passed`

## 1.140) Вынос interfaces/clients CLI-support compat wiring из `awg_core.py` в `backend.domains.interfaces_clients/cli_compat_entry_ops.py`

- [x] Добавлен `backend/domains/interfaces_clients/cli_compat_entry_ops.py`:
  - [x] инкапсулирован wiring legacy/read/support/service CLI оберток (`add_client`, `delete_client`, `list_*`, `client_qrencode`, `show_api_key_status`, `set_api_key`, `wg_lease_ip`, `add_peer`, `del_peer`, `add_wg_int`, `del_wg_int`, `update_interface`, `update_peer`, `sync`).
- [x] Обновлен `awg_core.py`:
  - [x] interfaces/clients CLI-support compat wrappers переключены на thin-делегирование в `interfaces_cli_compat_entry_ops`.
  - [x] прямой wiring `awg_core.py` к `interfaces_clients/cli_*_ops` удален.
  - [x] публичные имена/сигнатуры compat функций сохранены.
- [x] Добавлены/обновлены тесты:
  - [x] `tests/test_interfaces_clients_cli_compat_entry_ops.py` (новый structural/wiring guard compat-entry слоя).
- [x] Обновлены модульные карты:
  - [x] `docs/development/MODULE_MAP.md`
  - [x] `docs/development/MODULE_MAP.ru.md`
- [x] Совместимость:
  - [x] wire/API поведение не изменено; шаг структурный.
  - [x] `awg_core.py` остается compat entrypoint, но CLI-support wiring moved to domain layer.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_interfaces_clients_cli_compat_entry_ops.py tests/test_interfaces_clients_cli_legacy_service_ops.py tests/test_interfaces_clients_cli_service_ops.py tests/test_interfaces_clients_cli_read_ops.py tests/test_interfaces_clients_cli_support_ops.py tests/test_manager_access_facade.py` → `39 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `245 passed`

## 1.141) Вынос firewall compat-entry wiring из `awg_core.py` в `backend.domains.firewall/compat_entry_ops.py`

- [x] Добавлен `backend/domains/firewall/compat_entry_ops.py`:
  - [x] инкапсулирован compat-entry wiring поверх `service_layer_ops` для firewall paths:
    - [x] rules/runtime/state (`list_rules`, `apply_rules`, `create/update/delete/reorder`, `reset_counters`, `get_state`)
    - [x] collections/maps/tables/named-objects/schema (`list/upsert/delete set/map/table`, `list/upsert/create/update/delete named-object`, `get_schema`)
  - [x] добавлены compatibility aliases для текущих имен call-site в `awg_core.py` (без изменения поведения).
- [x] Обновлен `awg_core.py`:
  - [x] firewall compat wrappers переключены на thin-делегирование в `firewall_compat_entry_ops`.
  - [x] прямой compat wiring к `firewall_service_layer_ops` call-site убран из `awg_core.py`.
  - [x] публичные имена/сигнатуры firewall compat функций сохранены.
- [x] Добавлены/обновлены тесты:
  - [x] `tests/test_firewall_compat_entry_ops.py` (новый structural/wiring guard compat-entry слоя firewall).
- [x] Обновлены модульные карты:
  - [x] `docs/development/MODULE_MAP.md`
  - [x] `docs/development/MODULE_MAP.ru.md`
- [x] Совместимость:
  - [x] wire/API поведение не изменено; шаг структурный.
  - [x] `awg_core.py` остается compat entrypoint, но firewall compat wiring вынесен в доменный модуль.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_firewall_compat_entry_ops.py tests/test_firewall_service_layer_ops.py tests/test_firewall_rule_ops.py tests/test_manager_access_facade.py` → `52 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `248 passed`

## 1.142) Ускоренный батч (`x2`): централизация AWG/support wrapper wiring в `backend.domains.interfaces_clients.compat_entry_ops`

- [x] Расширен `backend/domains/interfaces_clients/compat_entry_ops.py`:
  - [x] добавлен support/auth/backup wrapper wiring (`load/save/verify/rotate api key`, QR helper-ы, backup bytes restore/decode).
  - [x] добавлен AWG params wrapper wiring (`generate/detect/prepare/validate/prompt/format/filter`, включая `_random_h_*` и `parse_h_value_or_range`).
- [x] Обновлен `awg_core.py`:
  - [x] support/auth/backup compat wrappers переключены на `interfaces_compat_entry_ops` (без прямого вызова `support_facade_ops`).
  - [x] AWG params compat wrappers переключены на `interfaces_compat_entry_ops` (без прямого вызова `awg_params_ops`).
  - [x] прямые импорты `interfaces_awg_params_ops` и `interfaces_support_facade_ops` удалены из `awg_core.py`.
- [x] Добавлены/обновлены тесты:
  - [x] расширен `tests/test_interfaces_clients_compat_entry_ops.py` (новые guard-сценарии для support/auth/backup и AWG params wrapper wiring).
- [x] Обновлены модульные карты:
  - [x] `docs/development/MODULE_MAP.md`
  - [x] `docs/development/MODULE_MAP.ru.md`
- [x] Совместимость:
  - [x] wire/API поведение не изменено; шаг структурный.
  - [x] `awg_core.py` остается compat entrypoint, но еще одна группа wrapper-wiring перенесена в доменный compat-entry слой.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_interfaces_clients_compat_entry_ops.py tests/test_interfaces_clients_support_facade_ops.py tests/test_interfaces_clients_awg_params_ops.py tests/test_manager_access_facade.py` → `41 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `250 passed`

## 1.143) Ускоренный батч (`x2`): вынос interfaces validation + firewall runtime-collection helper wiring из `awg_core.py`

- [x] Расширен `backend/domains/interfaces_clients/compat_entry_ops.py`:
  - [x] добавлены validation/uniqueness wrapper-ы (`parse_and_validate_interface_network`, `parse_and_validate_port`, `validate_ip_literal`, `assert_interface_uniqueness`, `validate_interface_name`).
  - [x] инкапсулированы DB callback-и uniqueness-проверок внутри compat-entry слоя (через `cursor`-зависимость), без локальных `_has_*` helper-ов в `awg_core.py`.
- [x] Расширен `backend/domains/firewall/compat_entry_ops.py`:
  - [x] добавлена фабрика collection runtime helper-ов `build_collection_runtime_helpers` для compat wiring (`normalize_nft_timeout`, `timeout_to_seconds`, enrich/cleanup/signature callbacks).
- [x] Обновлен `awg_core.py`:
  - [x] interfaces validation/uniqueness compat wrappers переключены на `interfaces_compat_entry_ops`.
  - [x] локальные helper-ы `_has_interface_name_conflict`, `_has_port_conflict`, `_fetch_all_interface_network_rows` удалены из `awg_core.py`.
  - [x] firewall timeout/runtime collection helper wiring переключен на `firewall_compat_entry_ops.build_collection_runtime_helpers`.
  - [x] удален прямой импорт `interfaces_validation_ops` из `awg_core.py`.
- [x] Добавлены/обновлены тесты:
  - [x] расширен `tests/test_interfaces_clients_compat_entry_ops.py` (validation delegation + uniqueness wiring coverage).
  - [x] расширен `tests/test_firewall_compat_entry_ops.py` (`build_collection_runtime_helpers` wiring coverage).
- [x] Обновлены модульные карты:
  - [x] `docs/development/MODULE_MAP.md`
  - [x] `docs/development/MODULE_MAP.ru.md`
- [x] Совместимость:
  - [x] wire/API поведение не изменено; шаг структурный.
  - [x] `awg_core.py` существенно истончен по helper-wiring при сохранении compat-entry роли.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_interfaces_clients_compat_entry_ops.py tests/test_interfaces_clients_validation_ops.py tests/test_firewall_compat_entry_ops.py tests/test_firewall_helper_service_ops.py tests/test_manager_access_facade.py` → `43 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `252 passed`

## 1.144) Ускоренный батч (`x2`): вынос DB row-fetch helper wiring для interfaces/config-render из `awg_core.py`

- [x] Расширен `backend/domains/interfaces_clients/compat_entry_ops.py`:
  - [x] добавлены DB row-fetch helper-ы `fetch_allowed_ips_row` и `fetch_interface_peer_rows`.
- [x] Обновлен `awg_core.py`:
  - [x] локальные функции `_fetch_allowed_ips_row` и `_fetch_interface_peer_rows` заменены на `functools.partial` делегаты в `interfaces_compat_entry_ops` (с `cursor`-binding).
  - [x] удален лишний `get_db_file_path` wrapper; `read_database_bytes` использует `DB_FILE` напрямую.
- [x] Добавлены/обновлены тесты:
  - [x] расширен `tests/test_interfaces_clients_compat_entry_ops.py` (покрытие `fetch_allowed_ips_row` / `fetch_interface_peer_rows`).
- [x] Обновлены модульные карты:
  - [x] `docs/development/MODULE_MAP.md`
  - [x] `docs/development/MODULE_MAP.ru.md`
- [x] Совместимость:
  - [x] wire/API поведение не изменено; шаг структурный.
  - [x] `awg_core.py` дополнительно истончен за счет переноса DB helper wiring в доменный compat-entry слой.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_interfaces_clients_compat_entry_ops.py tests/test_interfaces_clients_config_render_service_ops.py tests/test_manager_access_facade.py` → `37 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `253 passed`

## 1.145) Ускоренный батч (`x2`): перевод thin-wrapper функций `awg_core.py` в alias/partial делегаты `interfaces_compat_entry_ops`

- [x] Обновлен `awg_core.py`:
  - [x] interfaces validation wrapper-ы (`parse_and_validate_interface_network`, `parse_and_validate_port`, `validate_ip_literal`, `validate_interface_name`) переведены на прямые alias.
  - [x] `assert_interface_uniqueness` переведен на `functools.partial` с bind `parse_network_fn` + `cursor`.
  - [x] support/auth/backup wrapper-ы (`load/save/verify/rotate api key`, `render_qr_in_terminal`, `build_qr_svg`, `read_database_bytes`, `restore_database_from_bytes`, `decode_base64_payload`) переведены на alias.
  - [x] AWG params wrapper-ы (`_random_h_*`, `detect/generate/prepare/validate/prompt/format/filter`) переведены на alias.
  - [x] лишние промежуточные `def`-обертки удалены без изменения публичных имен и сигнатур compat call-site.
- [x] Обновлены модульные карты:
  - [x] `docs/development/MODULE_MAP.md`
  - [x] `docs/development/MODULE_MAP.ru.md`
- [x] Совместимость:
  - [x] wire/API поведение не изменено; шаг структурный.
  - [x] `awg_core.py` дополнительно истончен: compat-слой сведен к alias/partial wiring для interfaces/support/AWG helper-групп.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_interfaces_clients_compat_entry_ops.py tests/test_interfaces_clients_awg_params_ops.py tests/test_interfaces_clients_support_facade_ops.py tests/test_manager_access_facade.py` → `43 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `253 passed`

## 1.146) Ускоренный батч (`x2`): перевод IPsec compat-service wrapper-ов `awg_core.py` в `functools.partial`/alias

- [x] Обновлен `awg_core.py`:
  - [x] блок IPsec compat-service wrapper-ов (`list/upsert/delete/load/initiate/terminate/apply`) переведен с промежуточных `def` на `functools.partial`/alias делегаты `ipsec_compat_entry_ops`.
  - [x] сохранены публичные имена call-site (`list_ipsec_*`, `upsert_ipsec_*`, `delete_ipsec_*`, `load/initiate/terminate/apply`) и поведение wire/API.
  - [x] после первичного прогона устранен регресс `NameError` (`partial` -> `functools.partial`).
- [x] Обновлены модульные карты:
  - [x] `docs/development/MODULE_MAP.md`
  - [x] `docs/development/MODULE_MAP.ru.md`
- [x] Совместимость:
  - [x] шаг структурный, без изменений внешнего API/UX.
  - [x] `awg_core.py` дополнительно истончен за счет удаления IPsec wrapper `def`-блока.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_ipsec_compat_entry_ops.py tests/test_manager_access_facade.py tests/test_data_dir_config.py` → `31 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `253 passed`

## 1.147) Ускоренный батч (`x2`): перевод interfaces utility/crypto wrapper-ов `awg_core.py` в `functools.partial`

- [x] Обновлен `awg_core.py`:
  - [x] переведены на `functools.partial` utility-wrapper-ы interfaces слоя: `generate_keypair`, `create_temp_key_file`, `remove_interface_runtime`, `build_awg_set_command`, `append_config_param`, `build_client_config_lines`, `get_next_available_ip`, `validate_client_ip_for_interface`.
  - [x] переведены на `functools.partial` crypto-wrapper-ы: `encrypt_private_key`, `decrypt_private_key`.
  - [x] сохранены текущие call-site имена и поведение; изменения структурные.
- [x] Обновлены модульные карты:
  - [x] `docs/development/MODULE_MAP.md`
  - [x] `docs/development/MODULE_MAP.ru.md`
- [x] Совместимость:
  - [x] wire/API и UX не менялись.
  - [x] `awg_core.py` дополнительно истончен за счет удаления очередной группы промежуточных `def`-оберток.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_interfaces_clients_compat_entry_ops.py tests/test_interfaces_clients_config_render_service_ops.py tests/test_interfaces_clients_runtime_service_ops.py tests/test_manager_access_facade.py` → `40 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `253 passed`

## 1.148) Ускоренный батч (`x2`): перевод firewall compat-service wrapper-блока `awg_core.py` в `functools.partial`

- [x] Обновлен `awg_core.py`:
  - [x] firewall compat-service wrapper-блок (`list/apply/create/update/delete/reorder/reset/state`, `sets/maps/tables/named-objects/schema`) переведен с промежуточных `def` на `functools.partial`.
  - [x] сохранены имена публичных call-site функций и прежние дефолты (`family/table=None`, `apply_now=True`, `table=None`) через bind значений в partial.
  - [x] добавлены тонкие compatibility-обертки для сохранения позиционных вызовов в fallback-путях `manager_facade` (без изменения внешнего поведения).
  - [x] сохранено делегирование в `backend.domains.firewall.compat_entry_ops`; шаг чисто структурный.
- [x] Обновлены модульные карты:
  - [x] `docs/development/MODULE_MAP.md`
  - [x] `docs/development/MODULE_MAP.ru.md`
- [x] Совместимость:
  - [x] wire/API и UX не менялись.
  - [x] `awg_core.py` дополнительно истончен за счет удаления крупного firewall wrapper-слоя.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_firewall_compat_entry_ops.py tests/test_firewall_service_layer_ops.py tests/test_firewall_rule_ops.py tests/test_manager_access_facade.py` → `53 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `253 passed`

## 1.149) Ускоренный батч (`x2`): перенос fallback-совместимости firewall в `manager_facade` и удаление временных оберток из `awg_core.py`

- [x] Обновлен `backend/app/manager_facade.py`:
  - [x] `_backend_partial_call` расширен поддержкой `fallback_kwargs` для безопасного fallback в `awg_core`.
  - [x] firewall fallback-пути (`list/create/update/delete/reorder/reset`, `sets/maps/tables/named-objects`) переведены с `fallback_args` на именованные `fallback_kwargs`.
- [x] Обновлен `awg_core.py`:
  - [x] удалены временные compatibility-обертки firewall call-site (которые оставляли позиционные сигнатуры поверх `partial`).
  - [x] сохранены direct `functools.partial` delegates на `firewall_compat_entry_ops`, без изменения wire/API.
- [x] Обновлены модульные карты:
  - [x] `docs/development/MODULE_MAP.md`
  - [x] `docs/development/MODULE_MAP.ru.md`
- [x] Совместимость:
  - [x] fallback-совместимость перенесена в `manager_facade`; внешний API/UX не менялся.
  - [x] `awg_core.py` дополнительно истончен (минус слой временных firewall wrapper-def).
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py tests/test_firewall_compat_entry_ops.py tests/test_firewall_service_layer_ops.py tests/test_firewall_rule_ops.py` → `53 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `253 passed`

## 1.150) Ускоренный батч (`x2`): дополнительное истончение interfaces service/render wrapper-слоя в `awg_core.py`

- [x] Обновлен `awg_core.py`:
  - [x] переведены на `functools.partial` безопасные interfaces wrapper-ы с позиционно-совместимыми сигнатурами:
    - `serialize_interface_row`
    - `create_interface_service`, `delete_interface_service`, `update_interface_service`
    - `delete_client_service`
  - [x] сохранены `def`-обертки для call-site, где нужен поздний bind зависимостей или keyword-only аргументов:
    - `serialize_client_row` (`include_private_key`)
    - `build_client_config`, `build_interface_server_config`, `apply_interface_runtime`
    - `create_client_service`, `update_client_service`
  - [x] в процессе устранены import-order регрессии (`NameError` на import) без изменения внешнего поведения.
- [x] Обновлены модульные карты:
  - [x] `docs/development/MODULE_MAP.md`
  - [x] `docs/development/MODULE_MAP.ru.md`
- [x] Совместимость:
  - [x] wire/API и UX без изменений; шаг строго структурный.
  - [x] `awg_core.py` дополнительно истончен с учетом безопасного порядка инициализации.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_data_dir_config.py tests/test_interfaces_clients_compat_entry_ops.py tests/test_interfaces_clients_config_render_service_ops.py tests/test_interfaces_clients_runtime_service_ops.py tests/test_interfaces_clients_service_ops.py tests/test_manager_access_facade.py` → `45 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `253 passed`

## 1.151) Ускоренный батч (`x2`): истончение CLI-support wrapper-слоя `awg_core.py` через `functools.partial`

- [x] Обновлен `awg_core.py`:
  - [x] переведены на `functools.partial`: `show_api_key_status`, `set_api_key`, `wg_lease_ip`, `add_peer`, `del_peer`, `add_wg_int`, `del_wg_int`, `update_interface`, `sync`.
  - [x] сохранены `def`-обертки там, где есть риск по keyword-only / порядку инициализации (`add_client`, `delete_client`, `list_*`, `client_qrencode`, `update_peer`).
- [x] Обновлены модульные карты:
  - [x] `docs/development/MODULE_MAP.md`
  - [x] `docs/development/MODULE_MAP.ru.md`
- [x] Совместимость:
  - [x] wire/API и UX не менялись; шаг структурный.
  - [x] `awg_core.py` дополнительно истончен по CLI-путям, без изменения поведения fallback.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_data_dir_config.py tests/test_interfaces_clients_cli_compat_entry_ops.py tests/test_interfaces_clients_cli_legacy_service_ops.py tests/test_interfaces_clients_cli_read_ops.py tests/test_interfaces_clients_cli_support_ops.py tests/test_manager_access_facade.py` → `39 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `253 passed`

## 1.152) Ускоренный батч (`x2`): дополнительное истончение interfaces CLI/read wrapper-слоя

- [x] Обновлен `awg_core.py`:
  - [x] переведены на `functools.partial`: `list_clients`, `list_wg_int`, `list_wg_int_clients`, `client_qrencode`, `update_peer`.
  - [x] `encrypt_private_key`/`decrypt_private_key` подняты выше по файлу для безопасного bind в compat-wrapper-ах (убран поздний дублирующий блок).
  - [x] `create_client_service` и `update_client_service` оставлены `def`-обертками (осознанно) из-за late-bind `get_next_available_ip`/`validate_client_ip_for_interface`.
- [x] Обновлены модульные карты:
  - [x] `docs/development/MODULE_MAP.md`
  - [x] `docs/development/MODULE_MAP.ru.md`
- [x] Совместимость:
  - [x] wire/API и UX без изменений; шаг структурный.
  - [x] снижено количество функциональных wrapper-`def` в `awg_core.py`, сохранен безопасный порядок инициализации.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_data_dir_config.py tests/test_interfaces_clients_cli_compat_entry_ops.py tests/test_interfaces_clients_cli_legacy_service_ops.py tests/test_interfaces_clients_cli_read_ops.py tests/test_interfaces_clients_cli_support_ops.py tests/test_interfaces_clients_service_ops.py tests/test_manager_access_facade.py` → `42 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `253 passed`

## 1.153) Ускоренный батч (`x2`): реордер зависимостей и финальное схлопывание interfaces compat-wrapper-ов

- [x] Обновлен `awg_core.py`:
  - [x] подняты выше по файлу shared partial-зависимости (`build_awg_set_command`, `append_config_param`, `build_client_config_lines`, `get_next_available_ip`, `validate_client_ip_for_interface`) для import-order-safe bind.
  - [x] переведены на `functools.partial`: `build_client_config`, `build_interface_server_config`, `apply_interface_runtime`, `create_client_service`, `update_client_service`, `add_client`.
  - [x] удалены дублирующие поздние partial-объявления этих зависимостей.
  - [x] сохранены `def` только для действительно динамических/базовых точек (`serialize_client_row`, `write_text_file`, `delete_client` + boot helpers).
- [x] Обновлены модульные карты:
  - [x] `docs/development/MODULE_MAP.md`
  - [x] `docs/development/MODULE_MAP.ru.md`
- [x] Совместимость:
  - [x] wire/API и UX без изменений; шаг структурный.
  - [x] `awg_core.py` достиг практически финального thin-shim состояния по interfaces/firewall/ipsec путям.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_data_dir_config.py tests/test_interfaces_clients_cli_compat_entry_ops.py tests/test_interfaces_clients_cli_legacy_service_ops.py tests/test_interfaces_clients_cli_read_ops.py tests/test_interfaces_clients_cli_support_ops.py tests/test_interfaces_clients_service_ops.py tests/test_manager_access_facade.py` → `42 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `253 passed`

## 1.154) Ускоренный батч (`x2`): финальная чистка alias/partial для thin-shim базовых helper-ов

- [x] Обновлен `awg_core.py`:
  - [x] `def _run_command_checked` заменен на alias `functools.partial(subprocess.run, check=True)`.
  - [x] `def _generate_firewall_rule_id` заменен на лаконичный alias (`lambda`).
  - [x] `def delete_client` заменен на `functools.partial` после bind зависимостей (`list_clients`, `del_peer`).
- [x] Обновлены модульные карты:
  - [x] `docs/development/MODULE_MAP.md`
  - [x] `docs/development/MODULE_MAP.ru.md`
- [x] Совместимость:
  - [x] wire/API и UX не менялись; шаг структурный.
  - [x] в `awg_core.py` остались только неизбежные runtime/bootstrap `def` точки.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_data_dir_config.py tests/test_interfaces_clients_cli_compat_entry_ops.py tests/test_interfaces_clients_cli_legacy_service_ops.py tests/test_interfaces_clients_cli_read_ops.py tests/test_interfaces_clients_cli_support_ops.py tests/test_interfaces_clients_service_ops.py tests/test_manager_access_facade.py` → `42 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `253 passed`

## 1.155) Ускоренный батч (`x2`): добивка thin-shim helper-ов (`serialize_client_row` + fernet wrappers)

- [x] Обновлен `awg_core.py`:
  - [x] `serialize_client_row` переведен с `def` на `functools.partial` (с сохранением keyword-параметра `include_private_key` на call-site).
  - [x] `_fernet_encrypt` и `_fernet_decrypt` переведены в lambda-alias helper-ы.
  - [x] в результате в `awg_core.py` остались только базовые bootstrap/runtime `def`-точки.
- [x] Обновлены модульные карты:
  - [x] `docs/development/MODULE_MAP.md`
  - [x] `docs/development/MODULE_MAP.ru.md`
- [x] Совместимость:
  - [x] wire/API и UX не менялись; шаг структурный.
  - [x] достигнуто практически финальное состояние thin-shim перед отдельным removal/rename cycle.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_data_dir_config.py tests/test_interfaces_clients_compat_entry_ops.py tests/test_interfaces_clients_config_render_service_ops.py tests/test_interfaces_clients_cli_compat_entry_ops.py tests/test_manager_access_facade.py` → `42 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `253 passed`

## 1.156) Ускоренный батч (`x2`): завершение thin-shim — обнуление `def` в `awg_core.py`

- [x] Обновлен `awg_core.py`:
  - [x] убраны bootstrap-обертки `get_argument_value` и `load_encryption_secret`; чтение `-r`/prompt встроены напрямую в startup-блок.
  - [x] `ensure_wg_interfaces_schema` перенесен в `backend/domains/interfaces_clients/schema.py` и подключен через `functools.partial`.
  - [x] `normalize_config_value` перенесен в `backend/common/value_normalization.py` и подключен alias-делегированием.
  - [x] `write_text_file` вынесен в `backend/domains/interfaces_clients/cli_support_ops.py` (+ compat-entry wrapper), в `awg_core.py` оставлен только bound-callback.
  - [x] итог: `awg_core.py` содержит `0` top-level `def` (полный thin-shim по функции-оберткам).
- [x] Обновлены модульные карты:
  - [x] `docs/development/MODULE_MAP.md`
  - [x] `docs/development/MODULE_MAP.ru.md`
- [x] Совместимость:
  - [x] wire/API и UX не менялись; только структурное перераспределение владения функциями.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `253 passed`

## 1.157) Ускоренный батч (`x2`): HTTP entrypoint без прямой зависимости от `awg_core`

- [x] Обновлен `api_core.py`:
  - [x] `import awg_core as manager` заменен на `from backend.app import manager_facade as manager`.
  - [x] HTTP auth-path (`verify_api_auth`) и runtime info (`bd_path`) продолжают работать через facade/fallback без wire-изменений.
- [x] Обновлен `backend/app/manager_facade.py`:
  - [x] дублирующий `_normalize_config_value` заменен на единый helper `backend.common.value_normalization.normalize_config_value`.
- [x] Обновлены модульные карты:
  - [x] `docs/development/MODULE_MAP.md`
  - [x] `docs/development/MODULE_MAP.ru.md`
- [x] Совместимость:
  - [x] wire/API и UX не менялись; шаг структурный, снижает связанность `api_core -> awg_core`.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `253 passed`

## 1.158) Ускоренный батч (`x2`): CLI entrypoint без прямой зависимости от `awg_core`

- [x] Обновлен `awg_manager.py`:
  - [x] `import awg_core` заменен на `from backend.app import manager_facade as manager`.
  - [x] CLI-действия (`add_client`, `delete_client`, `list_*`, `sync`, `update_*`, `show/set_api_key`) перенаправлены через facade.
- [x] Совместимость:
  - [x] wire/API и UX не менялись; шаг структурный на уровне entrypoint/import graph.
  - [x] в `.py` коде проекта больше нет прямых `import awg_core`/`from awg_core`.
- [x] Обновлены модульные карты:
  - [x] `docs/development/MODULE_MAP.md`
  - [x] `docs/development/MODULE_MAP.ru.md`
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `253 passed`

## 1.159) Ускоренный батч (`x2`): перенос encryption-context в `backend/common` и отвязка facade crypto-path от `awg_core`

- [x] Добавлен `backend/common/encryption_context.py`:
  - [x] `load_encryption_secret` (поддержка `-r` + интерактивный prompt).
  - [x] `build_crypto_context` / `get_crypto_context` (ленивый cache ключей v2/v1-legacy).
- [x] Обновлен `awg_core.py`:
  - [x] bootstrap `encryption_secret/encryption_key/encryption_key_legacy` теперь берется из `backend.common.encryption_context`.
- [x] Обновлен `backend/app/manager_facade.py`:
  - [x] `_manager_crypto_context` больше не берет encryption keys из `awg_core`; использует `backend.common.encryption_context`.
  - [x] добавлен безопасный lazy fallback для `Fernet/InvalidToken` при отсутствии `cryptography` на import-time.
  - [x] `_firewall_schema` теперь читает схему из `backend.domains.firewall.schema` (без sourcing из `awg_core`).
  - [x] чтение `allowed_ips` в facade переведено на DB-first путь без stub-зависимости.
- [x] Совместимость:
  - [x] wire/API и UX не менялись; шаг структурный.
  - [x] `manager_facade` уменьшил прямую зависимость от `awg_core` в crypto/schema-путях, сохранив fallback-механику для compat.
- [x] Обновлены модульные карты:
  - [x] `docs/development/MODULE_MAP.md`
  - [x] `docs/development/MODULE_MAP.ru.md`
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `253 passed`

## 1.160) Ускоренный батч (`x2`): compat-константы в `manager_facade` для снижения implicit `awg_core` touches

- [x] Обновлен `backend/app/manager_facade.py`:
  - [x] добавлены compat-константы `bd_path`, `FIREWALL_SCHEMA`, `WG_INTERFACE_COLUMNS`.
  - [x] entrypoint-ы/legacy-callers могут брать эти значения напрямую из facade без обращения в `__getattr__`.
- [x] Совместимость:
  - [x] wire/API и UX не менялись; шаг структурный.
  - [x] дополнительно сокращены неявные причины lazy-доступа к `awg_core` в runtime.
- [x] Обновлены модульные карты:
  - [x] `docs/development/MODULE_MAP.md`
  - [x] `docs/development/MODULE_MAP.ru.md`
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `253 passed`

## 1.161) Ускоренный батч (`x2`): изоляция legacy fallback-моста `awg_core` в отдельный app-модуль

- [x] Добавлен `backend/app/legacy_manager_bridge.py`:
  - [x] централизует lazy-load `awg_core` и proxy-вызовы/атрибуты (`load_manager`, `call_manager_method`, `get_manager_attr`).
- [x] Обновлен `backend/app/manager_facade.py`:
  - [x] `_manager` и `__getattr__` переключены на `legacy_manager_bridge`.
  - [x] публичное поведение facade и fallback-механика сохранены.
- [x] Добавлены тесты:
  - [x] `tests/test_legacy_manager_bridge.py` (покрывает load/call/getattr моста).
- [x] Совместимость:
  - [x] wire/API и UX не менялись; шаг структурный.
  - [x] fallback-логика `awg_core` теперь локализована в одном модуле, что упрощает финальный remove-cycle.
- [x] Обновлены модульные карты:
  - [x] `docs/development/MODULE_MAP.md`
  - [x] `docs/development/MODULE_MAP.ru.md`
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `256 passed`

## 1.162) Ускоренный батч (`x2`): rename backend-домена `interfaces_clients` -> `awg`

- [x] Структурное переименование:
  - [x] директория `backend/domains/interfaces_clients` переименована в `backend/domains/awg`.
  - [x] backend/app/compat/test импорты обновлены на `backend.domains.awg`.
- [x] Совместимость:
  - [x] wire/API и UX не менялись; шаг чисто структурный.
  - [x] naming decision из `AGENTS.md` реализован: canonical backend domain = `backend/domains/awg`.
- [x] Документация:
  - [x] `AGENTS.md` синхронизирован (rename completion note + запрет новых `interfaces_clients` импортов).
  - [x] `docs/development/MODULE_MAP.md`
  - [x] `docs/development/MODULE_MAP.ru.md`
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `256 passed`

## 1.163) Ускоренный батч (`x2`): унификация имен тестов под `awg` домен

- [x] Структурная синхронизация тестов:
  - [x] файлы `tests/test_interfaces_clients_*.py` переименованы в `tests/test_awg_*.py` (23 файла).
  - [x] импорт-пути в тестах уже были обновлены на `backend.domains.awg`; поведение тестов не менялось.
- [x] Совместимость:
  - [x] шаг полностью структурный; runtime/wire/API/UX без изменений.
  - [x] исторические записи в этом progress-файле оставлены с прежними именами тестов как журнал выполненных шагов.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `256 passed`

## 1.164) Ускоренный батч (`x2`): управляемый fallback-toggle для финального remove-cycle `awg_core`

- [x] Обновлен `backend/app/manager_facade.py`:
  - [x] добавлен env-переключатель `AWG_MANAGER_ENABLE_AWG_CORE_FALLBACK` (default: enabled).
  - [x] `_backend_or_fallback` при отключенном toggle re-raise-ит backend-ошибку вместо fallback в `awg_core`.
  - [x] `__getattr__` при отключенном toggle не проксирует атрибуты в `awg_core`.
- [x] Добавлены тесты:
  - [x] `tests/test_manager_access_facade.py`: сценарии disabled-fallback (`_backend_or_fallback` / `__getattr__`).
- [x] Совместимость:
  - [x] текущий runtime unchanged (toggle включен по умолчанию); шаг структурно-подготовительный к remove-cycle.
- [x] Обновлены модульные карты:
  - [x] `docs/development/MODULE_MAP.md`
  - [x] `docs/development/MODULE_MAP.ru.md`
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py` → `28 passed`
  - [x] `python3 -m pytest -q tests` → `258 passed`

## 1.165) Ускоренный батч (`x2`): расширение backend-only guard-покрытия `manager_facade`

- [x] Добавлены no-manager-call guard-тесты для режима `AWG_MANAGER_ENABLE_AWG_CORE_FALLBACK=0`:
  - [x] `list_ipsec_active_peers_service`
  - [x] `apply_firewall_rules`
  - [x] `create_client_row`
  - [x] `update_client_row`
  - [x] `delete_client_row`
- [x] Документация синхронизирована:
  - [x] `docs/development/MODULE_MAP.md`
  - [x] `docs/development/MODULE_MAP.ru.md`
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py` → `36 passed`
  - [x] `python3 -m pytest -q tests` → `266 passed`

## 1.166) Ускоренный батч (`x2`): единый fallback-dispatch через `legacy_manager_bridge`

- [x] Обновлен `backend/app/manager_facade.py`:
  - [x] `_backend_or_fallback` переведен с `getattr(_manager(), method_name)` на `legacy_manager_bridge.call_manager_method(...)`.
  - [x] fallback-path стал единым app-layer seam для финального remove-cycle `awg_core.py`.
- [x] Обновлены/добавлены тесты `tests/test_manager_access_facade.py`:
  - [x] явная проверка bridge-маршрута (`test_backend_or_fallback_uses_legacy_bridge_call_path`).
  - [x] fallback-сценарии переведены на mock `legacy_manager_bridge.call_manager_method`.
- [x] Документация синхронизирована:
  - [x] `docs/development/MODULE_MAP.md`
  - [x] `docs/development/MODULE_MAP.ru.md`
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py` → `37 passed`
  - [x] `python3 -m pytest -q tests` → `267 passed`

## 1.167) Ускоренный батч (`x2`): удаление локального `_manager` helper из facade

- [x] Обновлен `backend/app/manager_facade.py`:
  - [x] удален локальный helper `_manager`.
  - [x] row/crypto fallback lazy-load переведен напрямую на `legacy_manager_bridge.load_manager(...)`.
  - [x] `_backend_or_fallback` продолжает использовать `legacy_manager_bridge.call_manager_method(...)`.
- [x] Обновлены тесты `tests/test_manager_access_facade.py`:
  - [x] backend-only no-call guard-ы переведены с `_manager` на `legacy_manager_bridge.load_manager`.
- [x] Документация синхронизирована:
  - [x] `docs/development/MODULE_MAP.md`
  - [x] `docs/development/MODULE_MAP.ru.md`
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py` → `37 passed`
  - [x] `python3 -m pytest -q tests` → `267 passed`

## 1.168) Ускоренный батч (`x2`): row-access fallback-guard при disabled toggle

- [x] Обновлен `backend/app/manager_facade.py`:
  - [x] `_query_rows_with_manager_fallback` и `_query_row_with_manager_fallback` теперь учитывают `AWG_MANAGER_ENABLE_AWG_CORE_FALLBACK`.
  - [x] при `fallback=0` DB-ошибка re-raise-ится без перехода в legacy manager.
- [x] Добавлены тесты `tests/test_manager_access_facade.py`:
  - [x] `test_query_rows_with_manager_fallback_backend_only_mode_does_not_touch_load_manager`
  - [x] `test_query_row_with_manager_fallback_backend_only_mode_does_not_touch_load_manager`
- [x] Документация синхронизирована:
  - [x] `docs/development/MODULE_MAP.md`
  - [x] `docs/development/MODULE_MAP.ru.md`
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py` → `39 passed`
  - [x] `python3 -m pytest -q tests` → `269 passed`

## 1.169) Ускоренный батч (`x2`): crypto-context fallback-guard при disabled toggle

- [x] Обновлен `backend/app/manager_facade.py`:
  - [x] `_manager_crypto_context` теперь учитывает `AWG_MANAGER_ENABLE_AWG_CORE_FALLBACK` при отсутствии `_Fernet`.
  - [x] при `fallback=0` и недоступном native `cryptography` backend ошибка re-raise-ится без загрузки legacy manager.
- [x] Добавлены тесты `tests/test_manager_access_facade.py`:
  - [x] `test_manager_crypto_context_raises_when_fallback_disabled_and_fernet_unavailable`
  - [x] `test_manager_crypto_context_uses_legacy_manager_when_fallback_enabled_and_fernet_unavailable`
- [x] Документация синхронизирована:
  - [x] `docs/development/MODULE_MAP.md`
  - [x] `docs/development/MODULE_MAP.ru.md`
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py` → `41 passed`
  - [x] `python3 -m pytest -q tests` → `271 passed`

## 1.170) Ускоренный батч (`x2`): row-access fallback через `get_manager_attr("c")`

- [x] Обновлен `backend/app/manager_facade.py`:
  - [x] fallback-путь `_query_rows_with_manager_fallback` и `_query_row_with_manager_fallback` для случая `manager is None` переведен на `legacy_manager_bridge.get_manager_attr("c")`.
  - [x] прямой доступ к manager-объекту в row-access fallback-path дополнительно сокращен.
- [x] Обновлены тесты `tests/test_manager_access_facade.py`:
  - [x] backend-only guard тесты row-access переведены на запрет вызова `get_manager_attr`.
  - [x] добавлены fallback-enabled сценарии с проверкой `get_manager_attr("c")`:
    - [x] `test_query_rows_with_manager_fallback_uses_legacy_cursor_when_enabled`
    - [x] `test_query_row_with_manager_fallback_uses_legacy_cursor_when_enabled`
- [x] Документация синхронизирована:
  - [x] `docs/development/MODULE_MAP.md`
  - [x] `docs/development/MODULE_MAP.ru.md`
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py` → `43 passed`
  - [x] `python3 -m pytest -q tests` → `273 passed`

## 1.171) Ускоренный батч (`x2`): crypto fallback через `get_manager_attr`

- [x] Обновлен `backend/app/manager_facade.py`:
  - [x] `_manager_crypto_context` fallback-путь при `_Fernet is None` переведен с `load_manager + getattr(...)` на прямые вызовы `legacy_manager_bridge.get_manager_attr("Fernet")` и `legacy_manager_bridge.get_manager_attr("InvalidToken")`.
  - [x] прямой доступ к manager-объекту в crypto fallback-path сокращен.
- [x] Обновлены тесты `tests/test_manager_access_facade.py`:
  - [x] disabled-fallback guard теперь проверяет отсутствие вызова `get_manager_attr`.
  - [x] fallback-enabled сценарий проверяет вызовы `get_manager_attr("Fernet")` и `get_manager_attr("InvalidToken")`.
- [x] Документация синхронизирована:
  - [x] `docs/development/MODULE_MAP.md`
  - [x] `docs/development/MODULE_MAP.ru.md`
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py` → `43 passed`
  - [x] `python3 -m pytest -q tests` → `273 passed`

## 1.172) Ускоренный батч (`x2`): централизация legacy-seam helper-ов в facade

- [x] Обновлен `backend/app/manager_facade.py`:
  - [x] добавлены facade-helper-ы `_legacy_manager_call` и `_legacy_manager_attr`.
  - [x] fallback-path `_backend_or_fallback` переведен на `_legacy_manager_call`.
  - [x] row-access/crypto/`__getattr__` fallback-path переведены на `_legacy_manager_attr`.
- [x] Совместимость:
  - [x] wire/API и UX без изменений; шаг структурный.
  - [x] legacy entrypoint seams централизованы в двух helper-ах, что упрощает финальный remove-cycle.
- [x] Документация синхронизирована:
  - [x] `docs/development/MODULE_MAP.md`
  - [x] `docs/development/MODULE_MAP.ru.md`
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py` → `43 passed`
  - [x] `python3 -m pytest -q tests` → `273 passed`

## 1.173) Ускоренный батч (`x2`): ужесточение backend-only guard-тестов по fallback entrypoint

- [x] Обновлены тесты `tests/test_manager_access_facade.py`:
  - [x] backend-only no-call guard-ы на facade fallback-path переведены с `legacy_manager_bridge.load_manager` на `legacy_manager_bridge.call_manager_method`.
  - [x] guard assertions теперь привязаны к фактическому fallback entrypoint `manager_facade`.
- [x] Совместимость:
  - [x] шаг тестово-структурный; runtime поведение не меняется.
- [x] Документация синхронизирована:
  - [x] `docs/development/MODULE_MAP.md`
  - [x] `docs/development/MODULE_MAP.ru.md`
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py` → `43 passed`
  - [x] `python3 -m pytest -q tests` → `273 passed`

## 1.174) Ускоренный батч (`x4`): ввод `legacy_manager_target` как отдельной точки legacy-target выбора

- [x] Добавлен `backend/app/legacy_manager_target.py`:
  - [x] `resolve_manager_module_name` с env override `AWG_MANAGER_LEGACY_TARGET_MODULE` (default: `awg_core`)
  - [x] `load_manager_module` для загрузки резолвнутого legacy manager module
- [x] Совместимость:
  - [x] runtime-поведение по умолчанию unchanged (`awg_core` остается default target).
  - [x] создан единый switch-point для будущего remove-cycle без изменения внешних контрактов.

## 1.175) Ускоренный батч (`x4`): bridge переключен на target-resolver слой

- [x] Обновлен `backend/app/legacy_manager_bridge.py`:
  - [x] `load_manager` теперь делегирует в `legacy_manager_target.load_manager_module`.
  - [x] прямой `import_module("awg_core")` из bridge удален.
- [x] Обновлены тесты:
  - [x] `tests/test_legacy_manager_bridge.py` проверяет делегацию `load_manager` в target-loader.
  - [x] добавлен `tests/test_legacy_manager_target.py` (default/env override/import behavior).
- [x] Совместимость:
  - [x] поведение fallback сохранилось, но точка выбора target вынесена в отдельный модуль.

## 1.176) Ускоренный батч (`x4`): перенос data-dir контракта на target-loader путь

- [x] Обновлен `tests/test_data_dir_config.py`:
  - [x] helper переведен с прямого `import awg_core` на `backend.app.legacy_manager_target.load_manager_module(...)`.
  - [x] тест теперь проверяет data-dir контракт через актуальный compat-target путь bridge-архитектуры.
- [x] Совместимость:
  - [x] тестовая семантика сохранена (проверки `bd_path`, state files, API key persistence остаются прежними).

## 1.177) Ускоренный батч (`x4`): фиксация remove-cycle прогресса в формате блоков `N/4`

- [x] Обновлены документы прогресса:
  - [x] `docs/development/REFRACTOR_PROGRESS.ru.md` — счетчик шагов до `1.177`.
  - [x] введен формат остатка remove-cycle блоками (`3/4` remaining).
  - [x] `docs/development/MODULE_MAP.md` / `MODULE_MAP.ru.md` дополнены ownership секцией `legacy_manager_target`.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_legacy_manager_target.py tests/test_legacy_manager_bridge.py tests/test_data_dir_config.py tests/test_manager_access_facade.py` → `51 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed`
  - [x] `python3 -m pytest -q tests` → `276 passed`

## 1.178) Ускоренный батч (`x4`): перенос `test_app_router` с прямого `awg_core` stub-инжекта на legacy-target env

- [x] Обновлен `tests/test_app_router.py`:
  - [x] удален `sys.modules["awg_core"] = ...`.
  - [x] добавлен isolated legacy target module (`test_app_router_legacy_stub`) через `AWG_MANAGER_LEGACY_TARGET_MODULE`.
  - [x] добавлен `tearDown` cleanup env/module state.
- [x] Совместимость:
  - [x] поведение тестов не изменено; изменена только тестовая wiring-механика compat-target.

## 1.179) Ускоренный батч (`x4`): перенос `test_api_contract` с прямого `awg_core` stub-инжекта на legacy-target env

- [x] Обновлен `tests/test_api_contract.py`:
  - [x] удален `sys.modules["awg_core"] = ...`.
  - [x] добавлен class-level legacy target module (`test_api_contract_legacy_stub`) через `AWG_MANAGER_LEGACY_TARGET_MODULE`.
  - [x] добавлен cleanup env/module state в `tearDownClass`.
- [x] Совместимость:
  - [x] wire/API контрактные assertions unchanged.
  - [x] fallback-resolve path в тестах соответствует новой архитектуре `legacy_manager_target`.

## 1.180) Ускоренный батч (`x4`): финализация B2 — устранение прямых awg_core stub-инъекций в тестах

- [x] Проверка кодовой базы тестов:
  - [x] `sys.modules["awg_core"]` stub-инъекции отсутствуют.
  - [x] прямой `import_module("awg_core")` в тестах отсутствует.
  - [x] в `tests/test_data_dir_config.py` оставлены только safe cleanup вызовы `sys.modules.pop("awg_core", None)`.
- [x] Статус remove-cycle блока:
  - [x] `B2` закрыт.

## 1.181) Ускоренный батч (`x4`): gate re-validation после закрытия B2

- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_app_router.py tests/test_data_dir_config.py tests/test_legacy_manager_target.py tests/test_legacy_manager_bridge.py` → `10 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed` (отдельный запуск; при комбинированном запуске был sandbox socket PermissionError)
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py` → `43 passed`
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests` → `276 passed`
- [x] Статус remove-cycle:
  - [x] осталось `2/4` блока: `B3` (финализация `awg_core.py`) + `B4` (финальный post-remove regression/docs lock).

## 1.182) Ускоренный батч (`x4`): закрытие B3 — `awg_core.py` как тонкий compat shim

- [x] Ownership/структурные изменения:
  - [x] Реализация legacy runtime вынесена в `backend/app/legacy_manager_compat.py` (новый canonical fallback target).
  - [x] `awg_core.py` преобразован в тонкий re-export shim (`from backend.app.legacy_manager_compat import *`) для совместимости импортов.
  - [x] `backend/app/legacy_manager_target.py` переключен на default target `backend.app.legacy_manager_compat` (env override `AWG_MANAGER_LEGACY_TARGET_MODULE` сохранен).
- [x] Legacy delegation:
  - [x] `manager_facade` fallback-вызовы продолжают идти через `legacy_manager_bridge -> legacy_manager_target -> legacy_manager_compat`.
  - [x] Тесты, ожидавшие default `awg_core`, обновлены на новый canonical target.
- [x] Verification commands:
  - [x] `python3 -m pytest -q tests/test_legacy_manager_target.py` → `3 passed`
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py` → `43 passed`
  - [x] `python3 -m pytest -q tests/test_data_dir_config.py` → `2 passed` (после cleanup `backend.app.legacy_manager_compat` в `sys.modules`)
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed` (run вне sandbox из-за bind-ограничения sandbox)
  - [x] `python3 -m pytest -q tests` → `276 passed` (run вне sandbox)
- [x] Статус remove-cycle:
  - [x] `B3` закрыт.
  - [x] Осталось `1/4`: `B4` (финальный post-remove regression + docs lock).

## 1.183) Ускоренный батч (`x4`): закрытие B4 — финальный post-remove regression + docs lock

- [x] Documentation lock:
  - [x] Синхронизированы `docs/development/MODULE_MAP.md` и `docs/development/MODULE_MAP.ru.md`:
    - [x] добавлен ownership `backend/app/legacy_manager_compat.py`;
    - [x] `legacy_manager_target` default обновлен на `backend.app.legacy_manager_compat`;
    - [x] `awg_core.py` зафиксирован как compat shim.
  - [x] Обновлен статусный блок и быстрый срез в `docs/development/REFRACTOR_PROGRESS.ru.md`.
- [x] Regression lock (AGENTS gate):
  - [x] `python3 -m pytest -q tests/test_firewall_rule_ops.py` → `20 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` → `9 passed` (run вне sandbox)
  - [x] `python3 -m pytest -q tests` → `276 passed` (run вне sandbox)
- [x] Статус remove-cycle:
  - [x] `B4` закрыт.
  - [x] Remove-cycle `B1`-`B4`: `4/4` завершен.

## 1.184) Ускоренный батч (`x2`): закрытие хвостовых чекбоксов PolicyAdvanced container/capability-driven

- [x] Актуализирован раздел `3) Декомпозиция Firewall UI (Policy2/Policy3)`:
  - [x] `Собрать PolicyAdvancedPage контейнер из модулей` помечен completed.
  - [x] `заменить isPolicyV2Tab/isPolicyV3Tab на capability-driven рендер` помечен completed.
- [x] Локальная верификация кода:
  - [x] `firewall.tsx` использует `PolicyAdvancedPage` + `PolicyAdvancedSection` и capability helpers (`sections.ts` + `capabilities.ts`) без прямых `isPolicyV2Tab/isPolicyV3Tab`.
  - [x] `rg`-проверка прямых `isPolicyV2Tab/isPolicyV3Tab` ветвлений в модуле firewall не обнаружила.

## 1.185) Ускоренный батч (`x2`): подготовка smoke-скрипта для IPsec stand validation

- [x] Добавлен `scripts/ipsec_stand_smoke.sh`:
  - [x] покрывает `/health`, `/ui/`, `/api/ipsec/*` CRUD + runtime (`apply/load/initiate/terminate`) + read-state (`active-peers/installed-sas/events`).
  - [x] использует `AWG_API_URL` + `AWG_API_KEY` и поддерживает `IPSEC_SMOKE_PREFIX` для изолированных ресурсов.
  - [x] включает best-effort cleanup (`DELETE /api/ipsec/policies/{name}`, `DELETE /api/ipsec/peers/{name}`).
- [x] Локальная проверка запуска:
  - [x] `scripts/ipsec_stand_smoke.sh` без env корректно завершается с явной ошибкой валидации переменных окружения.

## 2) Тестовый контракт для data dir

- [x] Добавлен `tests/test_data_dir_config.py`.
- [x] Проверяется переопределение путей через `AWG_MANAGER_DATA_DIR`.
- [x] Проверяется `save/load/rotate` API key в выбранном data dir.

## 3) Декомпозиция Firewall UI (Policy2/Policy3)

### Уже вынесено

- [x] Capability matrix:
  - `webui/src/pages/firewall/capabilities.ts`
- [x] Helpers object bindings:
  - `webui/src/pages/firewall/objectBindings.ts`
- [x] Helpers sections:
  - `webui/src/pages/firewall/sections.ts`
- [x] Rule form factory/create/edit:
  - `webui/src/pages/firewall/ruleForm.ts`
- [x] Rules table component:
  - `webui/src/pages/firewall/PolicyAdvancedRulesTable.tsx`
- [x] Bridge objects table component:
  - `webui/src/pages/firewall/FirewallObjectsTable.tsx`
- [x] Rule editor modal shell:
  - `webui/src/pages/firewall/PolicyAdvancedRuleEditorModal.tsx`
- [x] Bridge object modal extracted:
  - `webui/src/pages/firewall/FirewallObjectModal.tsx`
- [x] Collections modal extracted:
  - `webui/src/pages/firewall/CollectionsModal.tsx`
- [x] Table builder modal extracted:
  - `webui/src/pages/firewall/TableBuilderModal.tsx`
- [x] Rule editor base section:
  - `webui/src/pages/firewall/PolicyAdvancedRuleEditorBaseSection.tsx`
- [x] Rule editor match section:
  - `webui/src/pages/firewall/PolicyAdvancedRuleEditorMatchSection.tsx`
- [x] Shared field controls (`ToggleLine` / `PlannedField`):
  - `webui/src/pages/firewall/RuleFieldControls.tsx`
- [x] Rule editor action/logging/statistics section:
  - `webui/src/pages/firewall/PolicyAdvancedRuleEditorActionSection.tsx`
- [x] Rule/object filter and usage state hook (phase 1):
  - `webui/src/pages/firewall/usePolicyV2RuleObjectState.ts`
  - includes rule/object selection-anchor sync
- [x] PolicyAdvanced section container (phase 3 start):
  - `webui/src/pages/firewall/PolicyAdvancedSection.tsx`
- [x] PolicyAdvanced bindings/orchestration hook:
  - `webui/src/pages/firewall/usePolicyAdvancedBindings.ts`
- [x] PolicyAdvanced context sync hook:
  - `webui/src/pages/firewall/usePolicyAdvancedContextSync.ts`
  - section/family/table sync now capability-driven (no hardcoded `activeSection === policy_v2/policy_v3` checks)
- [x] PolicyAdvanced page adapter component:
  - `webui/src/pages/firewall/PolicyAdvancedPage.tsx`
- [x] Rule editor orchestration hook (phase 2, part 1):
  - `webui/src/pages/firewall/usePolicyAdvancedRuleEditor.ts`
- [x] Policy2/Policy3 data refresh hook (phase 2, part 2):
  - `webui/src/pages/firewall/usePolicyAdvancedData.ts`
- [x] Policy2/Policy3 rule save/delete actions hook (phase 2, part 2):
  - `webui/src/pages/firewall/usePolicyAdvancedRuleActions.ts`
- [x] Policy2 objects save/delete actions hook (phase 2, part 2):
  - `webui/src/pages/firewall/usePolicyAdvancedObjectActions.ts`
- [x] Shared Policy2 object form model extracted:
  - `webui/src/pages/firewall/policyV2ObjectForm.ts`
- [x] Policy2 object editor orchestration extracted:
  - `webui/src/pages/firewall/usePolicyAdvancedObjectEditor.ts`
- [x] Table builder editor orchestration extracted:
  - `webui/src/pages/firewall/useTableBuilderEditor.ts`
- [x] Collections editor orchestration extracted:
  - `webui/src/pages/firewall/useCollectionsEditor.ts`
- [x] Policy (inet) rule editor actions extracted:
  - `webui/src/pages/firewall/usePolicyRuleEditorActions.ts`
- [x] Policy (inet) rule editor sync effects extracted:
  - `webui/src/pages/firewall/usePolicyRuleEditorSync.ts`
- [x] Policy (inet) rule editor modal shell extracted:
  - `webui/src/pages/firewall/PolicyRuleEditorModal.tsx`
- [x] Policy (inet) rule editor stats tab extracted:
  - `webui/src/pages/firewall/PolicyRuleEditorStatsTab.tsx`
- [x] Policy (inet) rule editor action tab extracted:
  - `webui/src/pages/firewall/PolicyRuleEditorActionTab.tsx`
- [x] Policy (inet) rule editor base tab extracted:
  - `webui/src/pages/firewall/PolicyRuleEditorBaseTab.tsx`
- [x] Policy (inet) rule editor advanced tab extracted:
  - `webui/src/pages/firewall/PolicyRuleEditorAdvancedTab.tsx`
- [x] Shared policy/collections format/time helpers extracted:
  - `webui/src/pages/firewall/policyUtils.ts`
  - includes `buildPolicyV2BridgeExprSummary`
- [x] Collections tab section extracted:
  - `webui/src/pages/firewall/CollectionsSection.tsx`
- [x] Table Builder tab section extracted:
  - `webui/src/pages/firewall/TablesSection.tsx`
- [x] Policy top toolbar block extracted (tabs/custom table/banner/actions/columns):
  - `webui/src/pages/firewall/PolicySectionToolbar.tsx`
- [x] Firewall section tabs extracted:
  - `webui/src/pages/firewall/FirewallSectionTabs.tsx`
- [x] Policy (inet) rule editor dialog container extracted:
  - `webui/src/pages/firewall/PolicyRuleEditorDialog.tsx`
- [x] Policy2/Policy3 rule editor dialog container extracted:
  - `webui/src/pages/firewall/PolicyAdvancedRuleEditorDialog.tsx`
- [x] Firewall modal stack extracted:
  - `webui/src/pages/firewall/FirewallModalStack.tsx`
- [x] Bulk actions orchestration extracted (rules/collections/tables):
  - `webui/src/pages/firewall/useFirewallBulkActions.ts`
- [x] Shared selection/sort helpers extracted:
  - `webui/src/pages/firewall/selectionUtils.ts`
- [x] Policy rules drag&drop reorder orchestration extracted:
  - `webui/src/pages/firewall/usePolicyRuleReorder.ts`
- [x] Policy2 object summary formatter extracted:
  - `webui/src/pages/firewall/policyV2ObjectSummary.ts`
- [x] Shared draggable modal window behavior extracted:
  - `webui/src/pages/firewall/useDraggableWindow.ts`
- [x] Policy field visibility matrix extracted:
  - `webui/src/pages/firewall/policyFieldStates.ts`
- [x] PolicyAdvanced table/chain context extracted:
  - `webui/src/pages/firewall/usePolicyAdvancedTableContext.ts`
- [x] Firewall data/schema polling and refresh orchestration extracted:
  - `webui/src/pages/firewall/useFirewallDataSync.ts`
- [x] Collections/tables aggregation, sorting and selection derivations extracted:
  - `webui/src/pages/firewall/useFirewallCollectionsTablesView.ts`
- [x] Policy rules list sorting/columns derivations extracted:
  - `webui/src/pages/firewall/usePolicyRulesView.ts`
- [x] Policy rule editor live runtime stats orchestration extracted:
  - `webui/src/pages/firewall/usePolicyRuleLiveStats.ts`
- [x] Page guard effects extracted (table hook/device, active policy table, Policy2 editor form guards):
  - `webui/src/pages/firewall/useFirewallPageGuards.ts`
- [x] Policy rule form context derivation extracted:
  - `webui/src/pages/firewall/usePolicyRuleFormContext.ts`
- [x] Shared policy rule live chart constants/helpers extracted:
  - `webui/src/pages/firewall/policyLiveChart.ts`
- [x] Selected rows derivation extracted:
  - `webui/src/pages/firewall/useFirewallSelections.ts`

### В работе

- [x] Вынести внутренние секции rule editor в подкомпоненты:
  - [x] Base
  - [x] Match
  - [x] Action/Stats
- [x] Вынести state-логику Policy2/Policy3 в хуки (`use*`).
  - [x] Phase 1: filters/usage/bindings/selection sync
  - [x] Phase 2 (part 1): editor open/edit + form state guardrails
  - [x] Phase 2 (part 2): data loading and save/delete orchestration
    - [x] data loading / refresh hooks
    - [x] rule save/delete/enable orchestration
    - [x] object save/delete orchestration

### Следом

- [x] Собрать `PolicyAdvancedPage` контейнер из модулей.
  - [x] Step 1: extract Policy2/Policy3 main section into `PolicyAdvancedSection`
  - [~] Step 2: move remaining orchestration into dedicated hooks/container adapter
    - [x] object/rule binding + prefill orchestration moved to hook
    - [x] policy section context sync moved to hook
    - [x] assemble thin `PolicyAdvancedPage` adapter component
- [x] Максимально заменить точечные ветвления `isPolicyV2Tab/isPolicyV3Tab` на capability-driven рендер.
  - [x] Rule editor sections switched to `family/caps` instead of `isPolicyV2Tab/isPolicyV3Tab`
  - [x] section switch + policy advanced data/sync hooks switched to capability-driven checks
  - [x] PolicyAdvanced family type narrowed to `bridge|netdev` across hooks/state
  - [x] object editor orchestration moved to dedicated hook; legacy tab conditionals centralized in `sections.ts`/`capabilities.ts`

## 4) Валидация и выкатка

- [ ] Локально после установки Node/npm:
  - [x] `npm run build`
  - [ ] e2e `policy2` (локальный запуск не зафиксирован; стендовый прогон green)
  - [ ] e2e `policy3` (локальный запуск не зафиксирован; стендовый прогон green)
- [x] Проверка на firewall-стенде.
  - [x] `tests/firewall-policy-v2-bridge.spec.ts` (28/28 including policy3 run bundle)
  - [x] `tests/firewall-policy-v3-netdev.spec.ts`
  - [x] `tests/firewall-policy-dnd.spec.ts` (фикс селектора вкладки `policy`, strict locator)
  - [x] `tests/firewall-tables.spec.ts`
  - [x] `tests/firewall-maps.spec.ts`
  - [x] `tests/firewall-counters-reset.spec.ts`
  - [x] `/firewall/apply` smoke (`HTTP 200`, `{\"ok\": true}`)
  - [x] Повторный full e2e прогон на стенде: `npx playwright test tests/firewall-policy-v2-bridge.spec.ts tests/firewall-policy-v3-netdev.spec.ts` → `28 passed`.
- [x] Проверка на ipsec-стенде (без влияния на firewall поток).
  - [x] Подготовлен автоматизированный smoke-скрипт: `scripts/ipsec_stand_smoke.sh`.
  - [x] Фактический прогон на ipsec-стенде: `AWG_API_URL=http://127.0.0.1:8788 AWG_API_KEY=$(cat /etc/wg-manager-ipsec/api.key) bash scripts/ipsec_stand_smoke.sh` → `OK: ipsec stand smoke passed`.

## 1.186) Стендовый full-check: firewall + ipsec

- [x] Service/runtime:
  - [x] `awg-manager-api.service` (`:8787`) активен.
  - [x] `awg-manager-api-ipsec.service` (`:8788`) активен.
  - [x] `strongswan.service` активен; `vici` установлен.
- [x] API smoke:
  - [x] `/health` для `:8787` и `:8788` → `ok`.
  - [x] `POST /firewall/apply` (`:8787`) → `{ \"ok\": true }`.
  - [x] `scripts/ipsec_stand_smoke.sh` (`:8788`) → `OK: ipsec stand smoke passed`.
- [x] UI e2e (на стенде, against `http://127.0.0.1:8787/ui/`):
  - [x] `tests/firewall-policy-v2-bridge.spec.ts`
  - [x] `tests/firewall-policy-v3-netdev.spec.ts`
  - [x] Результат: `28 passed`.

## 1.187) Финализация single-stand политики релиза

- [x] Обновлен `AGENTS.md`:
  - [x] зафиксировано, что репозиторий предназначен для параллельной разработки потоков `firewall`/`ipsec`.
  - [x] зафиксирована финальная стратегия релиза: один стенд, очистка, деплой из `main`.
- [x] Добавлен deploy-runbook скрипт:
  - [x] `scripts/redeploy_single_stand_from_main.sh` (упаковка из local `main`, upload, deploy, optional clean-data, smoke).
- [x] Обновлена эксплуатационная документация:
  - [x] `docs/operations/DEPLOY.md` дополнен разделом `Final Single-Stand Redeploy From main`.

## 1.188) IPsec UI toolbar и delete-контракты для редактируемых вкладок

- [x] Добавлены contract-safe DELETE routes для редактируемых IPsec сущностей:
  - [x] `DELETE /api/ipsec/identities/{peer}`
  - [x] `DELETE /api/ipsec/phase1-profiles/{name}`
  - [x] `DELETE /api/ipsec/phase2-proposals/{name}`
- [x] Сохранены защитные зависимости:
  - [x] Phase 1 profile нельзя удалить, если его использует peer.
  - [x] Phase 2 proposal нельзя удалить, если его использует policy.
- [x] UI toolbar IPsec выровнен ближе к firewall policy toolbar:
  - [x] `Add`
  - [x] `Del`
  - [x] `Disable`
  - [x] `Enable`
- [x] `Disable/Enable` работают через bulk toolbar для `Policies`, `Peers`, `Phase 1`, `Phase 2`.
  - [x] Для Phase 1/Phase 2 `enabled` является сохраненной metadata-настройкой UI/API; VICI proposal payload не меняется напрямую.
- [x] Row-level action-кнопки из IPsec таблиц убраны; операции выполняются через верхний toolbar.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_ipsec_crud_ops.py tests/test_ipsec_service_ops.py tests/test_ipsec_service_layer_ops.py tests/test_ipsec_service_facade_ops.py tests/test_ipsec_compat_entry_ops.py` -> `19 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` -> `9 passed`
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py` -> `43 passed`
  - [x] `npm --prefix webui run build` -> passed

## 1.189) IPsec runtime cascade для Enable/Disable связанных компонентов

- [x] Добавлен runtime-effective каскад для `apply/load` без переписывания связанных объектов:
  - [x] отключенный `Peer` останавливает/выгружает свой IKE_SA и CHILD_SA;
  - [x] отключенный `Identity` блокирует загрузку peer и останавливает связанные SAs;
  - [x] отключенный `Phase 1` profile блокирует peer, который на него ссылается;
  - [x] отключенный `Phase 2` proposal исключает связанные policies из runtime load/apply;
  - [x] если у peer не остается enabled policies, connection выгружается из VICI.
- [x] `Identity` получил сохраненный `enabled` state в IPsec CRUD/API/UI:
  - [x] таблица показывает `State`;
  - [x] форма содержит переключатель `Enabled`;
  - [x] bulk toolbar `Enable/Disable` работает для `Identities` и сразу вызывает `apply`.
  - [x] legacy identity rows без сохраненного `enabled` отдаются как `enabled: true`.
- [x] Старые API-контракты `/api/ipsec/*` не ломались: поле `enabled` добавлено как совместимая metadata-настройка.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_ipsec_crud_ops.py::IpsecCrudOpsTest::test_upsert_identity tests/test_ipsec_runtime_ops.py::IpsecRuntimeOpsTest::test_runtime_respects_disabled_peer_and_policy tests/test_ipsec_runtime_ops.py::IpsecRuntimeOpsTest::test_apply_config_unloads_peer_when_phase1_identity_or_phase2_dependency_is_disabled` -> `3 passed`
  - [x] `python3 -m pytest -q tests/test_ipsec_query_ops.py tests/test_ipsec_crud_ops.py tests/test_ipsec_runtime_ops.py` -> `24 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` -> `9 passed`
  - [x] `python3 -m pytest -q tests` -> `295 passed`
  - [x] `npm --prefix webui run build` -> passed

## 5) Коммит-политика

- [ ] Отдельные commits/PR для:
  - infra/runtime
  - ui refactor
  - docs/tests
- [ ] Без смешивания firewall/ipsec изменений в одном changeset.

## 1.190) IPsec Config preview вкладка и read-only VICI payload endpoint

- [x] Добавлен read-only diagnostic endpoint `/api/ipsec/config-preview`:
  - [x] endpoint не вызывает `load_conn`, `load_shared`, `initiate`, `terminate` и не открывает VICI-сессию;
  - [x] собирает тот же `connections` payload, который используется для VICI `load_conn`;
  - [x] secrets отображаются только как metadata (`id`, `type`, `owners`, `secret_set`) без PSK/data.
- [x] Владение логикой оставлено в IPsec domain-layer:
  - [x] `backend/domains/ipsec/runtime_ops.py`: `build_config_preview`, `build_vici_secret_metadata_for_peer`;
  - [x] `backend/domains/ipsec/service_ops.py` / `service_layer_ops.py` / `compat_entry_ops.py`: composition/wiring для preview;
  - [x] `backend/app/manager_facade.py`: backend-first delegating entrypoint `get_ipsec_config_preview_service`.
- [x] UI:
  - [x] добавлена вкладка `Config` в IPsec;
  - [x] добавлены `Refresh` и `Copy`;
  - [x] JSON отображается в жестком контейнере с внутренней прокруткой, без влияния на firewall UI.
- [x] Проверки:
  - [x] `python3 -m pytest -q tests/test_ipsec_runtime_ops.py -k config_preview` -> `1 passed`
  - [x] `python3 -m pytest -q tests/test_api_contract.py` -> `9 passed`
  - [x] `python3 -m pytest -q tests/test_ipsec_runtime_ops.py tests/test_ipsec_service_ops.py tests/test_ipsec_service_layer_ops.py tests/test_ipsec_service_facade_ops.py tests/test_ipsec_compat_entry_ops.py` -> `29 passed`
  - [x] `python3 -m pytest -q tests/test_manager_access_facade.py` -> `43 passed`
  - [x] `npm --prefix webui run build` -> passed

## 1.191) Rollback IPsec Config status/diff experiment

- [x] По UX-решению удален эксперимент сравнения generated preview с загруженным VICI `list_conns`.
- [x] Удален endpoint `/api/ipsec/config-status`; контрактный read-only endpoint `/api/ipsec/config-preview` оставлен.
- [x] UI вкладки `Config` снова показывает только собранный VICI `load_conn` preview и metadata secrets без side-by-side loaded/diff сравнения.
- [x] Владение логикой осталось в IPsec domain-layer; firewall-контракты и firewall-поведение не затрагивались.
## 1.188) Firewall UI: первый шаг схлопывания policy2/policy3 в единый Policy

- Step scope:
  - скрыты верхние вкладки `policy2`/`policy3`; внешний вид `policy`, `collections`, `table builder`, а также `filter`/`nat`/`raw`/`mangle` сохранен.
  - `Policy` получил family-aware custom table selector: custom table выбирается как `(family, table)`, включая `bridge` и `netdev`.
  - bridge/netdev rules теперь отображаются в `Policy` при выборе соответствующей custom table.
  - Add/Edit для `bridge`/`netdev` временно маршрутизируется в существующий advanced editor как compatibility-мост, без изменения API payload и backend validation.
- Ownership moved:
  - `PolicySectionToolbar` владеет выбором family-aware table context в Policy.
  - `useFirewallPageGuards`, `usePolicyRuleFormContext`, `usePolicyRuleEditorSync`, `usePolicyRuleEditorActions`, `usePolicyRulesView` владеют единым Policy-контекстом `(family, table)` для фильтрации правил, chain options и default form values.
  - `PolicyAdvancedRuleEditor*` остается временным compatibility-путем для bridge/netdev полей до полного merge в `PolicyRuleEditorDialog`.
- Old entrypoint now delegates to:
  - скрытые `policy2`/`policy3` возможности выбираются через unified `Policy` по family (`bridge`/`netdev`), а не через отдельные верхние вкладки.
- Verification commands:
  - `npm run build` — passed.
  - stand `132.243.237.120:8787` — deployed bundle, verified visible tabs `policy|collections|table builder`, verified bridge custom table selection, verified bridge rule row in `Policy`, verified Add opens bridge rule editor without blank crash.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 20 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 43 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 279 passed.
  - stand `132.243.237.120:8787` — deployed `webui/dist`; active dist backup `dist.backup.20260529150531`; HTTP `/ui/` serves `index-Bp8OEkav.js`.
  - stand `132.243.237.120:8787` — deployed `webui/dist` and `backend/domains/firewall/rule_ops.py`; active web dist backup `webui/dist.backup.20260529145701`; backend file backup `backend/domains/firewall/rule_ops.py.backup.20260529145701`; restarted `api_core.py` as pid `94245`; HTTP `/ui/` serves `index-CC4qBCNO.js`.
  - stand `132.243.237.120:8787` — deployed `webui/dist`; active dist backup `dist.backup.20260529144715`; HTTP `/ui/` serves `index-C2so5QIn.js`.
  - in-app browser smoke — opened Firewall on `http://132.243.237.120:8787/ui/?v=objects-section`; top tabs show `policy/collections/objects/table builder`, `policy2/policy3` absent, console app errors empty.

- Result summary:
  - UI surface is now closer to the agreed target: only one visible `Policy` entrypoint; bridge/netdev are folded under the same Policy shell.
  - Behavior is intentionally minimal and backend-first-safe: wire/API compatibility preserved, backend validation unchanged.

## 1.189) Firewall UI: Add/Edit bridge/netdev rules moved into unified Policy form

- Step scope:
  - Add/Edit для bridge/netdev custom tables переведен из hidden `PolicyAdvancedRuleEditorDialog` в обычный `PolicyRuleEditorDialog`.
  - `PolicyRuleEditorBaseTab` показывает bridge-specific interface fields `ibrname`/`obrname` при `family=bridge`.
  - `PolicyRuleEditorActionTab` получил shared `queue` action и netdev-only `fwd` action; NAT actions скрыты для `bridge/netdev`.
  - `usePolicyRuleEditorActions` расширен для edit payload parity и sanitization: queue/fwd/NAT/family-specific поля чистятся перед save, чтобы не отправлять несовместимые комбинации.
  - e2e specs `firewall-policy-v2-bridge.spec.ts` и `firewall-policy-v3-netdev.spec.ts` обновлены под unified `Policy` selector вместо старых верхних вкладок `policy2`/`policy3`.
- Ownership moved:
  - `PolicyRuleEditorDialog` теперь владеет Add/Edit правил для `inet/ip/ip6/bridge/netdev` контекстов.
  - `PolicyAdvancedRuleEditor*` остается временным fallback/compatibility слоем для bridge objects и старых скрытых internals до полного переноса objects.
- Old entrypoint now delegates to:
  - старые bridge/netdev rule Add/Edit потоки больше не открываются как отдельные visible policy2/policy3 screens; пользовательский entrypoint — custom table selector внутри `Policy`.
- Verification commands:
  - `npm run build` — passed (`index-DHYy79Me.js`).
  - stand `132.243.237.120:8787` — deployed bundle, verified new bundle reference and unified Policy hint; in-app browser interaction was partially blocked by sidebar/automation instability during full click-through smoke.
- Result summary:
  - Основной rule Add/Edit путь схлопнут в текущую форму Policy без изменения wire/API контракта и backend validation.
  - Следующий этап: перенос bridge named objects в контекст выбранной bridge table внутри `PolicyRuleEditorDialog`/Policy shell.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 20 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 43 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 279 passed.
  - Local Playwright e2e not run in this pass: current `webui/tests/global-setup.ts` deletes stand interfaces/clients during setup, so running it against the shared stand would be destructive. Specs were updated for the new unified Policy flow.
  - e2e update note: bridge/netdev rule UI tests were moved to unified Policy selector; old bridge object/advanced UI tests in `firewall-policy-v2-bridge.spec.ts` are marked skipped until bridge objects are migrated into the unified Policy shell.

## 1.190) Firewall UI: bridge named-object bindings in unified Add Rule

- Step scope:
  - unified `PolicyRuleEditorDialog` now receives bridge named-object names for the selected bridge custom table.
  - `useFirewallDataSync` loads `/firewall/objects?family=bridge&table=<active table>` when unified `Policy` is focused on a bridge custom table.
  - `PolicyRuleEditorActionTab` exposes bridge object selectors for `limit_name`, `quota_name`, `ct_helper_set`, and `ct_timeout_set` without changing `/firewall/objects` API.
  - `PolicyRuleEditorStatsTab` exposes bridge `counter_name` selector and keeps anonymous counter mutually exclusive with a named counter object.
- Ownership moved:
  - object binding selection for bridge rules moved from hidden `PolicyAdvancedRuleEditorActionSection` into the normal `PolicyRuleEditor*Tab` form path.
  - object create/edit/list management remains in `PolicyAdvanced*` compatibility code until the next step.
- Old entrypoint now delegates to:
  - selected bridge custom table in unified `Policy`; the form reads existing objects from the same backend endpoint and table scope.
- Verification commands:
  - `npm run build` — passed (`index-BLq-WKPl.js`).
  - stand `132.243.237.120:8787` — deployed bundle; active dist backup `dist.backup.20260529104149`.
- Result summary:
  - bridge rule Add/Edit can bind existing named objects inside the current Policy form while preserving backend/wire compatibility.
  - remaining gap: move object create/edit/list controls from the hidden advanced flow into unified Policy.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 20 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 43 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 279 passed.

## 1.191) Firewall UI: bridge object management moved into unified Policy shell

- Step scope:
  - Added `FirewallObjectsPanel` as the shared visible panel for bridge named-object management.
  - Unified `Policy` now shows bridge object management below the toolbar when a bridge custom table is selected.
  - Existing object modal and `/firewall/objects` API are reused for add/edit/delete; object `use in rule` opens the unified `Add Firewall Rule` flow with object bindings prefilled.
  - `PolicyAdvancedSection` reuses `FirewallObjectsPanel` for hidden compatibility paths, avoiding duplicate object-management behavior.
  - `useFirewallDataSync` loads both bridge rules and bridge objects for the selected bridge custom table so usage counts and object filters work in unified Policy.
- Ownership moved:
  - visible bridge object create/edit/list/delete/filter/use-in-rule ownership moved from old `policy2` tab flow into unified `Policy` via `FirewallObjectsPanel`.
  - hidden `PolicyAdvanced*` modules remain compatibility internals, not visible top-level ownership.
- Old entrypoint now delegates to:
  - selected bridge custom table in unified `Policy`; old `policy2` tab remains hidden.
- Verification commands:
  - `npm run build` — passed (`index-Dbyud8AW.js`).
  - stand `132.243.237.120:8787` — deployed bundle; active dist backup `dist.backup.20260529113322`.
- Result summary:
  - bridge rules and bridge objects are now both reachable from the current Policy UI without changing backend/wire API.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 20 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 43 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 279 passed.

## 1.192) Firewall UI tests: bridge/netdev specs aligned with unified Policy entrypoint

- Step scope:
  - Renamed active netdev e2e scenarios from `policy3` wording to unified `Policy` wording.
  - Updated netdev UI selectors to use the current custom table selector (`netdev / <table>`) and normal `Add/Edit Firewall Rule` modal titles.
  - Updated bridge e2e wording/selectors for the unified `Policy` bridge custom table path and current `Add Firewall Rule` title.
- Ownership moved:
  - No runtime ownership moved in this step; this is test-plan alignment after moving visible bridge/netdev flows into unified `Policy`.
- Old entrypoint now delegates to:
  - selected bridge/netdev custom table in unified `Policy`; old `policy2`/`policy3` tab selectors are no longer used by active specs.
- Verification commands:
  - `cd webui && npx playwright test --list tests/firewall-policy-v2-bridge.spec.ts tests/firewall-policy-v3-netdev.spec.ts` — listed 28 tests.
  - `cd webui && npm run build` — passed (`index-Dbyud8AW.js`).
- Result summary:
  - Active UI/API specs now describe the current unified `Policy` user path while preserving backend/wire compatibility.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 20 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 43 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 279 passed.

## 1.193) Firewall UI: unified bridge object filters and binding quick panel

- Step scope:
  - Unified bridge `Policy` rules table now applies object-binding filters triggered from `FirewallObjectsPanel`.
  - A compact rule-filter chip is shown in unified bridge `Policy` when object filtering is active, with a clear action.
  - Unified `PolicyRuleEditorDialog` now shows bridge object bindings with quick `unlink`, so `use in rule` prefill is visible without opening the old advanced editor.
  - Bridge object UI e2e specs were unskipped for object usage filter, use-in-rule prefill, limit prefill, and quick unlink paths.
- Ownership moved:
  - object-binding rule filtering now belongs to unified `usePolicyRulesView` for bridge tables.
  - object binding quick-unlink ownership moved into the normal `PolicyRuleEditorDialog` path for bridge rules.
- Old entrypoint now delegates to:
  - selected bridge custom table in unified `Policy`; old `policy2` object/rule tab drilldown is no longer required for active object UI coverage.
- Verification commands:
  - `cd webui && npx playwright test --list tests/firewall-policy-v2-bridge.spec.ts tests/firewall-policy-v3-netdev.spec.ts` — listed 28 tests.
  - `cd webui && npm run build` — passed (`index-CebzSBKV.js`).
  - stand `132.243.237.120:8787` — deployed `webui/dist`; active dist backup `dist.backup.20260529115344`; HTTP `/ui/` serves `index-CebzSBKV.js`.
- Result summary:
  - bridge object management is closer to parity inside unified `Policy`: object usage can filter visible rules, and object prefill/unlink no longer depends on visible `policy2`.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 20 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 43 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 279 passed.

## 1.194) Firewall UI tests: remove legacy skipped advanced bridge coverage

- Step scope:
  - Removed the skipped UI test that still opened the hidden old `policy v2` advanced editor for bridge `dup/fwd` planned hints.
  - Kept active API coverage for bridge `dup` planned rejection and bridge `fwd` netdev-only rejection.
  - Confirmed bridge/netdev e2e specs no longer contain `test.skip` or active old `policy v2`/`policy3` UI expectations.
- Ownership moved:
  - No runtime ownership moved in this step; this removes stale legacy UI coverage after the unified `Policy` object/rule paths became active.
- Old entrypoint now delegates to:
  - selected bridge custom table in unified `Policy`; old advanced editor UI is no longer required by the bridge/netdev spec set.
- Verification commands:
  - `cd webui && npx playwright test --list tests/firewall-policy-v2-bridge.spec.ts tests/firewall-policy-v3-netdev.spec.ts` — listed 27 active tests.
- Result summary:
  - The test suite now describes the current unified `Policy` surface without skipped assertions for the removed visible `policy2` tab.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 20 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 43 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 279 passed.

## 1.195) Firewall UI: remove old PolicyAdvancedRuleEditor rule modal path

- Step scope:
  - Removed `PolicyAdvancedRuleEditor*` components and `usePolicyAdvancedRuleEditor`/`usePolicyAdvancedRuleActions` from the UI bundle.
  - `FirewallModalStack` now renders only the unified `PolicyRuleEditorDialog`, bridge object modal, collection modal, and table builder modal.
  - Removed stale advanced rule editor state/guards from `firewall.tsx`, `useFirewallPageGuards`, and `usePolicyV2RuleObjectState`.
  - Kept `PolicyAdvancedPage`/`PolicyAdvancedSection` and object hooks as hidden compatibility internals for object paths until the next cleanup step.
- Ownership moved:
  - bridge/netdev rule Add/Edit ownership is now exclusively in `PolicyRuleEditorDialog` for the visible UI bundle.
  - old advanced rule modal ownership is removed; bridge object management ownership remains with `FirewallObjectsPanel` and `FirewallObjectModal`.
- Old entrypoint now delegates to:
  - selected bridge/netdev custom table in unified `Policy`; the removed advanced rule modal is no longer imported or rendered.
- Verification commands:
  - `cd webui && npm run build` — passed (`index-DRa2b5xF.js`).
  - stand `132.243.237.120:8787` — deployed `webui/dist`; active dist backup `dist.backup.20260529121001`; HTTP `/ui/` serves `index-DRa2b5xF.js`.
- Result summary:
  - UI bundle no longer contains the old advanced rule editor path, reducing dead compatibility surface while preserving current unified Policy behavior and wire/API compatibility.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 20 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 43 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 279 passed.

## 1.196) Firewall UI: remove hidden PolicyAdvanced page/section path

- Step scope:
  - Removed hidden `PolicyAdvancedPage`, `PolicyAdvancedSection`, `PolicyAdvancedRulesTable`, legacy `capabilities`/`sections`, and advanced context/data/table hooks from the UI bundle.
  - Simplified `FirewallSectionTab` to the visible sections only: `policy`, `collections`, `table_builder`.
  - Kept bridge object create/edit/delete behavior via unified `FirewallObjectsPanel` plus `FirewallObjectModal`.
  - Simplified bridge object refresh to the selected bridge custom table in unified `Policy`.
- Ownership moved:
  - bridge object visible ownership remains in `FirewallObjectsPanel`; modal orchestration remains in bridge object hooks/modal.
  - old hidden `PolicyAdvancedPage/Section` no longer owns any visible or fallback UI behavior.
- Old entrypoint now delegates to:
  - selected bridge custom table in unified `Policy`; no `policy_v2`/`policy_v3` section path remains in frontend tab state.
- Verification commands:
  - `cd webui && npm run build` — passed (`index-ClVbYIrU.js`).
  - stand `132.243.237.120:8787` — deployed `webui/dist`; active dist backup `dist.backup.20260529133758`; restarted `api_core.py` after the old process stopped responding to `/ui/`; HTTP `/ui/` serves `index-ClVbYIrU.js`.
- Result summary:
  - UI bundle no longer contains hidden PolicyAdvanced pages while preserving unified Policy bridge/netdev behavior and wire/API compatibility.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 20 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 43 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 279 passed.

## 1.197) Firewall UI: bridge object naming cleanup after Policy unification

- Step scope:
  - Renamed remaining bridge object helper files from old `PolicyV2`/`PolicyAdvanced` naming to explicit bridge-owned module names:
    - `firewallObjectForm.ts`
    - `firewallObjectSummary.ts`
    - `useFirewallObjectState.ts`
    - `useFirewallObjectActions.ts`
    - `useFirewallObjectEditor.ts`
    - `useFirewallObjectBindings.ts`
  - Renamed active state/prop/export identifiers in `firewall.tsx`, bridge object hooks, rule editor props, object bindings, selections, and bridge/netdev UI specs from `policyV2*` to `bridge*`.
  - Kept public `/firewall/objects` API, rule payload shape, and visible Policy UI behavior unchanged.
- Ownership moved:
  - bridge object form, summary, binding usage, state, actions, editor presets, and use-in-rule orchestration are now explicitly owned by `PolicyBridgeObject*`/`usePolicyBridge*` modules.
  - old `PolicyV2`/`PolicyAdvanced` helper names no longer own active bridge object behavior.
- Old entrypoint now delegates to:
  - selected bridge custom table in unified `Policy`; no old `policy2` helper naming remains in the active bridge object code path.
- Verification commands:
  - `cd webui && npm run build` — passed (`index-DpBS5Jfl.js`).
  - `cd webui && npx playwright test --list tests/firewall-policy-v2-bridge.spec.ts tests/firewall-policy-v3-netdev.spec.ts` — listed 27 active tests.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 20 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 43 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 279 passed.
  - stand `132.243.237.120:8787` — deployed `webui/dist`; active dist backup `dist.backup.20260529135254`; HTTP `/ui/` serves `index-DpBS5Jfl.js`.
  - in-app browser smoke — opened Firewall section on `http://132.243.237.120:8787/ui/?v=policy-bridge-rename`; unified tabs `policy/collections/table builder` visible, `policy2/policy3` absent, console errors/warnings empty.
- Result summary:
  - This is a backend-neutral naming cleanup after the Policy2 collapse; behavior and wire/API compatibility are preserved.

## 1.198) Firewall UI: named objects moved to a separate Objects section

- Step scope:
  - Added top-level Firewall section `objects` after `collections`.
  - Moved visible named-object management out of the bridge-only `policy` panel into the separate `objects` section.
  - Added object table selector scoped as `family/table` over enabled custom tables.
  - Kept `/firewall/objects` API unchanged; object list/create/edit/delete uses the selected object table scope.
  - Kept `Use in rule` enabled only for `family=bridge`, matching current backend rule validation for named-object bindings.
- Ownership moved:
  - visible named-object management now belongs to the `objects` section via `FirewallObjectsPanel`/`FirewallObjectModal`.
  - unified `policy` now owns rules only; bridge object rule-filter/prefill actions route back from `objects` to the bridge `policy` table when used.
- Old entrypoint now delegates to:
  - selected `family/table` in the `objects` section; old bridge-only panel inside `policy` no longer renders.
- Verification commands:
  - `cd webui && npm run build` — passed (`index-C2so5QIn.js`).
  - `cd webui && npx playwright test --list tests/firewall-policy-v2-bridge.spec.ts tests/firewall-policy-v3-netdev.spec.ts` — listed 27 active tests.
  - `cd webui && npx playwright test tests/firewall-policy-v2-bridge.spec.ts -g "unified Policy bridge objects UI"` — skipped by environment: `PLAYWRIGHT_API_KEY is required for e2e tests`.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 20 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 43 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 279 passed.
- Result summary:
  - Objects are now visually grouped after Collections as their own nftables table-scoped resource, while bridge rule binding behavior remains compatible with the current backend sprint.

## 1.199) Firewall backend/UI: named-object rule bindings beyond bridge

- Step scope:
  - Extended `normalize_limit_and_named_object_fields` so named-object rule bindings are accepted for `inet/ip/ip6/bridge`.
  - Kept `netdev` object bindings rejected with a clear validation error.
  - Kept `ct_expectation_set` planned/disabled for all families.
  - Updated Objects UI `Use in rule` routing so object prefill works for `inet/ip/ip6/bridge` custom tables and remains disabled for `netdev`.
  - Updated the rule editor quick binding panel from bridge-only display to non-netdev object binding display.
- Ownership moved:
  - backend family eligibility for named-object rule bindings is owned by `backend/domains/firewall/rule_ops.py`.
  - Objects-section prefill eligibility is owned by `FirewallObjectsPanel` plus `useFirewallObjectBindings`/`firewall.tsx` orchestration.
- Old entrypoint now delegates to:
  - selected `family/table` in the `objects` section; `Use in rule` opens unified `PolicyRuleEditorDialog` for the same non-netdev table.
- Verification commands:
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py::FirewallRuleOpsTest::test_normalize_limit_and_named_object_fields` — 1 passed after RED failure confirmed.
  - `cd webui && npm run build` — passed (`index-CC4qBCNO.js`).
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 20 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 43 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 279 passed.
- Result summary:
  - Objects can now be used by rules outside bridge for `inet/ip/ip6` without changing wire/API shape; netdev stays explicitly unsupported.

## 1.200) Firewall UI: generic Objects ownership cleanup

- Step scope:
  - Renamed active frontend object modules from bridge-specific names to generic Objects-section names:
    - `FirewallObjectModal.tsx`
    - `FirewallObjectsPanel.tsx`
    - `FirewallObjectsTable.tsx`
    - `firewallObjectForm.ts`
    - `firewallObjectSummary.ts`
    - `firewallObjectBindings.ts`
    - `useFirewallObjectState.ts`
    - `useFirewallObjectActions.ts`
    - `useFirewallObjectEditor.ts`
    - `useFirewallObjectBindings.ts`
  - Generalized rule-editor object selectors so named-object bindings are shown for non-netdev families (`inet/ip/ip6/bridge`) and hidden for `netdev`.
  - Removed remaining active `PolicyBridgeObject*`/`bridgeObject*` naming from `webui/src`.
- Ownership moved:
  - generic nftables named-object UI ownership now belongs to `FirewallObjectsPanel`/`FirewallObjectModal` and `useFirewallObject*` helpers.
  - rule object binding key/usage helpers are owned by `firewallObjectBindings.ts`.
  - non-netdev object binding display in Add/Edit rule form is owned by `PolicyRuleEditorDialog` plus `PolicyRuleEditorActionTab`/`PolicyRuleEditorStatsTab`.
- Old entrypoint now delegates to:
  - selected `family/table` in the separate `objects` section; old bridge-specific helper filenames no longer own active object UI behavior.
- Verification commands:
  - `cd webui && npm run build` — passed (`index-Bp8OEkav.js`).
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 20 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 43 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 279 passed.
- Result summary:
  - This is a frontend cleanup/naming step after moving named objects out of bridge-only ownership; wire/API behavior remains unchanged.

## 1.201) Firewall backend/UI: enable ct_expectation for inet/ip/ip6 objects

- Step scope:
  - Enabled `ct_expectation` named-object create/edit payloads for `inet/ip/ip6` tables.
  - Kept `ct_expectation` unsupported for `bridge` and `netdev`.
  - Enabled rule binding via `ct_expectation_set` for `inet/ip/ip6`; `netdev` remains rejected by the named-object binding guard and `bridge` rejects `ct_expectation_set` explicitly.
  - Expanded runtime named-object reference validation from bridge-only to all non-netdev families, so `inet/ip/ip6/bridge` rules verify referenced objects exist in the selected table before apply.
  - Added the existing Policy Add Rule UI selector for `ct expectation object` in `inet/ip/ip6` contexts and exposed `ct_expectation` fields in the Objects modal for supported families.
- Ownership moved:
  - backend family eligibility for `ct_expectation_set` is owned by `backend/domains/firewall/rule_ops.py`.
  - `ct_expectation` object payload normalization/rendering remains owned by `backend/domains/firewall/named_object_ops.py`; runtime reference validation in that module now covers non-netdev families.
  - frontend object usage keys and rule prefill include `ct_expectation` via `firewallObjectBindings.ts`, `useFirewallObjectState`, `useFirewallObjectBindings`, `PolicyRuleEditorDialog`, and `PolicyRuleEditorActionTab`.
- Old entrypoint now delegates to:
  - existing `/firewall/objects` and `/firewall/rules` API payload fields; no wire/API shape changes were introduced.
- Verification commands:
  - `python3 -m pytest -q tests/test_firewall_named_object_ops.py tests/test_firewall_rule_ops.py::FirewallRuleOpsTest::test_normalize_limit_and_named_object_fields` — 9 passed.
  - `cd webui && npm run build` — passed (`index-CNY9HezP.js`).
  - `python3 -m pytest -q tests/test_firewall_named_object_ops.py tests/test_firewall_rule_ops.py` — 28 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 43 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 279 passed.
  - stand `132.243.237.120:8787` — deployed `webui/dist` plus `backend/domains/firewall/rule_ops.py` and `backend/domains/firewall/named_object_ops.py`; active web dist backup `webui/dist.backup.20260529152351`; backend backup `backend/domains/firewall.backup.ct_expectation.20260529152351`; HTTP `/ui/` serves `index-CNY9HezP.js`; API process restarted as `python3 api_core.py`.
- Result summary:
  - `ct_expectation` is now an enabled nftables named-object path for `inet/ip/ip6`, while bridge/netdev limitations remain explicit and backend-first.

## 1.202) Firewall QA fix: non-netdev Objects use-in-rule stability

- Step scope:
  - Browser QA on the stand found two issues after `ct_expectation` enablement:
    - API was temporarily restarted on `127.0.0.1`; restarted it correctly as `python3 api_core.py 0.0.0.0 8787 -r /etc/wg-manager/encryption.key`.
    - Objects `use` could open Add Rule into a React update loop because `usePolicyRuleEditorSync` wrote placement fields on every render while `activeChainOptions` was a fresh array.
  - Added an idempotent guard in `usePolicyRuleEditorSync` and narrowed the dependency to the first active chain.
  - Generalized policy-mode object loading/filtering from bridge-only to non-netdev families so `inet/ip/ip6` object bindings show as existing, not `(missing)`.
  - Verified with a temporary stand table `inet qa_ct_exp` and temporary `ct_expectation exp_qa`, then deleted the temporary table; table deletion removed the test object.
- Ownership moved:
  - Add Rule placement sync stability is owned by `usePolicyRuleEditorSync`.
  - policy-mode object/rule loading for non-netdev tables is owned by `useFirewallDataSync`.
  - non-netdev policy object filtering is owned by `usePolicyRulesView`.
- Old entrypoint now delegates to:
  - existing unified Objects `use in rule` path; no API shape change.
- Verification commands:
  - `cd webui && npm run build` — passed (`index-C5Po3YT0.js`).
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 20 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 43 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 279 passed.
  - stand `132.243.237.120:8787` — deployed `webui/dist`; active dist backup `dist.backup.20260529153828`; HTTP `/ui/` serves `index-C5Po3YT0.js`.
  - Browser smoke — login succeeded, Firewall loaded without `Failed to fetch`, Objects selected temporary `qa_ct_exp`, `ct_expectation exp_qa` created, row `use` opened Add Rule without React errors, Object bindings showed `ct-expectation:exp_qa`, Action tab selector showed `exp_qa` (not missing), temporary table/object cleaned up.
- Result summary:
  - The newly enabled `ct_expectation` UI flow is stable for `inet` custom tables and policy Add Rule selectors now stay synchronized for non-netdev object bindings.

## 1.203) Firewall QA fix: domain validation must not fall back to legacy

- Step scope:
  - Stand API smoke for `ct_expectation` found that invalid `bridge`/`netdev` object payloads returned `500` because `_backend_or_fallback` caught backend `ValueError` and attempted a legacy fallback call.
  - Updated `backend/app/manager_facade.py` so firewall backend validation/missing-resource errors (`ValueError`, `LookupError`) are re-raised directly and continue through the normal HTTP error boundary.
  - Kept legacy fallback behavior for non-firewall validation errors and other backend runtime errors unchanged.
- Ownership moved:
  - fallback eligibility for firewall backend-domain validation errors is owned by `backend/app/manager_facade.py`.
- Old entrypoint now delegates to:
  - existing app HTTP error boundary via `backend.common.http_errors.send_service_error`; no wire/API payload shape change.
- Verification commands:
  - `python3 -m pytest -q tests/test_manager_access_facade.py::ManagerAccessFacadeTest::test_backend_or_fallback_does_not_fallback_on_validation_errors tests/test_manager_access_facade.py::ManagerAccessFacadeTest::test_backend_or_fallback_does_not_fallback_on_missing_resources` — RED before fix, then 2 passed after initial fix.
  - `python3 -m pytest -q tests/test_api_contract.py` — first run exposed overly broad global `ValueError`/`LookupError` re-raise (non-firewall compatibility fallback regression); fix was narrowed to firewall facade methods only.
  - `python3 -m pytest -q tests/test_manager_access_facade.py::ManagerAccessFacadeTest::test_backend_or_fallback_does_not_fallback_on_validation_errors tests/test_manager_access_facade.py::ManagerAccessFacadeTest::test_backend_or_fallback_does_not_fallback_on_missing_resources tests/test_manager_access_facade.py::ManagerAccessFacadeTest::test_backend_or_fallback_keeps_non_firewall_validation_fallback` — 3 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 46 passed.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 20 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests` — 282 passed.
  - stand `132.243.237.120:8787` — deployed final narrowed `backend/app/manager_facade.py` and restarted API as `python3 api_core.py 0.0.0.0 8787 -r /etc/wg-manager/encryption.key`.
  - stand API smoke — `ct_expectation` create returned 201 for `ip`/`ip6` with `l4proto=tcp`; invalid `bridge`/`netdev` payloads returned HTTP 400 with `ct_expectation is not supported for family=...`; temporary `qa_ct_exp_*` tables/objects were deleted and verified empty.
- Result summary:
  - Invalid firewall object payloads from backend-first paths should now return validation errors instead of leaking as legacy fallback/internal errors.

## 1.204) Firewall Objects QA: ct_expectation preset and family/kind matrix guard

- Step scope:
  - Added a backend characterization test for the named-object family/kind matrix:
    - `counter`, `limit`, `quota`, `ct_helper`, `ct_timeout` normalize for `inet/ip/ip6/bridge/netdev`.
    - `ct_expectation` normalizes for `inet/ip/ip6` and is rejected for `bridge/netdev`.
  - Added an Objects modal quick example preset `FTP expectation` for `ct_expectation`.
  - Kept the preset disabled for `bridge/netdev`, matching backend validation and rule-binding limits.
- Ownership moved:
  - No module boundary moved; `named_object_ops.py` remains the backend owner of object normalization, and `FirewallObjectModal`/`useFirewallObjectEditor` remain the UI owners of object presets.
- Old entrypoint now delegates to:
  - existing `/firewall/objects` create path; no API shape change.
- Verification commands:
  - `python3 -m pytest -q tests/test_firewall_named_object_ops.py::FirewallNamedObjectOpsTest::test_normalize_named_object_payload_family_kind_matrix` — 1 passed.
  - `cd webui && npm run build` — passed (`index-DAEPERfE.js`).
  - `python3 -m pytest -q tests/test_firewall_named_object_ops.py` — 9 passed.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 20 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 46 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 283 passed.
  - stand `132.243.237.120:8787` — deployed `webui/dist`; active dist backup `dist.backup.20260529204203`; HTTP `/ui/` serves `index-DAEPERfE.js`.
  - Browser smoke — loaded stand UI and confirmed current script `/assets/index-DAEPERfE.js`.
- Result summary:
  - Objects UI now exposes the newly supported `ct_expectation` path as a guided preset while preserving the explicit bridge/netdev limitation.

## 1.205) Firewall Objects QA: ip/ip6 rule bindings and netdev ct object guard

- Step scope:
  - Stand API matrix for Objects -> rule bindings found:
    - `ip/ip6` named objects could be created, but rule create rejected `family=ip/ip6` with `family must be inet, bridge, or netdev`.
    - `netdev ct_helper`/`ct_timeout` and mismatched `ip6 l3proto=ip` object payloads could fall through to runtime/fallback and surface as bad 500 errors.
  - Extended `resolve_table_chain_context` so custom rule tables accept `ip` and `ip6` families.
  - Tightened `normalize_named_object_payload` family/kind validation:
    - `ct_helper`/`ct_timeout`/`ct_expectation` are rejected for `netdev`.
    - `ct_expectation` remains rejected for `bridge`.
    - `l3proto` must match `family=ip` or `family=ip6` when those object families are used.
  - Updated Objects modal/action guard so `netdev` no longer offers/saves unsupported ct object kinds.
- Ownership moved:
  - `backend/domains/firewall/rule_ops.py:resolve_table_chain_context` now owns custom rule table context for `inet/ip/ip6/bridge/netdev`.
  - `backend/domains/firewall/named_object_ops.py:normalize_named_object_payload` owns the ct object family eligibility matrix.
  - `FirewallObjectModal`/`useFirewallObjectActions` own UI gating for unsupported `netdev` ct object kinds.
- Old entrypoint now delegates to:
  - existing `/firewall/rules` and `/firewall/objects` API payloads; no wire/API shape change.
- Verification commands:
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py::FirewallRuleOpsTest::test_resolve_table_chain_context tests/test_firewall_named_object_ops.py::FirewallNamedObjectOpsTest::test_normalize_named_object_payload_family_kind_matrix` — RED before fix, then 2 passed after fix.
  - `cd webui && npm run build` — passed (`index-CyDS11v8.js`).
  - `python3 -m pytest -q tests/test_firewall_named_object_ops.py` — 9 passed.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 20 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 46 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 283 passed.
  - stand `132.243.237.120:8787` — deployed `backend/domains/firewall/rule_ops.py`, `backend/domains/firewall/named_object_ops.py`, and `webui/dist`; backend/file backup timestamp `20260529210755`; restarted API as `python3 api_core.py 0.0.0.0 8787 -r /etc/wg-manager/encryption.key`; HTTP `/ui/` serves `index-CyDS11v8.js`.
  - stand API matrix — `ip/ip6` object creation and disabled rule creation passed for `counter`, `limit`, `quota`, `ct_helper`, `ct_timeout`, `ct_expectation`; `netdev` `counter/limit/quota` object creation passed while rule binding returned expected HTTP 400; `netdev ct_helper/ct_timeout/ct_expectation` returned expected HTTP 400; temporary QA rules/tables were deleted.
- Result summary:
  - Objects/rule binding support is now aligned for custom `ip/ip6` tables, while impossible netdev ct object paths are rejected early with validation errors instead of runtime/fallback 500s.

## 1.206) Firewall Objects UI smoke: object modal gating on stand

- Step scope:
  - Browser smoke on stand `132.243.237.120:8787` with the deployed `index-CyDS11v8.js` bundle.
  - Opened Firewall -> Objects with desktop viewport to avoid the mobile sidebar overlay.
  - Verified the visible top-level Firewall tabs remain `policy`, `collections`, `objects`, `table builder`.
  - Verified the Objects section is available after Collections and shows the scoped custom object table selector.
  - Opened `Add Firewall Object` on the existing bridge custom table.
  - Verified bridge object kind gating in the modal:
    - `counter`, `limit`, `quota`, `ct_helper`, `ct_timeout` are selectable.
    - `ct_expectation` is disabled and labeled `inet/ip/ip6 only`.
  - Verified the `FTP expectation` preset is visible in the modal examples.
- Ownership moved:
  - No ownership moved; this is a browser smoke verification of the existing Objects UI gating.
- Old entrypoint now delegates to:
  - existing unified Firewall `objects` section; no API shape change.
- Verification commands:
  - Browser smoke — stand loaded `/assets/index-CyDS11v8.js`, Firewall -> Objects opened, Add Object modal gating matched backend matrix for bridge.
- Result summary:
  - The visible Objects UI is aligned with backend object-family constraints for the bridge context; netdev/ip/ip6 behavior remains covered by the stand API matrix from step `1.205`.

## 1.207) Firewall Objects UI smoke: ip/ip6/netdev table selector gating on stand

- Step scope:
  - Created temporary custom tables on stand `132.243.237.120:8787` only for UI verification:
    - `ip / qa_ui_ip_1780129834`
    - `ip6 / qa_ui_ip6_1780129834`
    - `netdev / qa_ui_nd_1780129834` with `hook=ingress`, `device=eth0`
  - Opened Firewall -> Objects in the deployed UI bundle `index-CyDS11v8.js`.
  - Verified the Object table selector includes the temporary `ip`, `ip6`, and `netdev` custom tables.
  - Opened `Add object` after selecting each temporary table.
  - Verified `ip` and `ip6` modal gating:
    - `counter`, `limit`, `quota`, `ct_helper`, `ct_timeout`, `ct_expectation` are selectable.
    - `FTP expectation` preset is enabled.
  - Verified `netdev` modal gating:
    - `counter`, `limit`, `quota` remain selectable.
    - `ct_helper`, `ct_timeout`, `ct_expectation` are disabled.
    - `FTP expectation` preset is disabled.
  - Cleaned up all temporary tables through `/firewall/tables/{id}` and verified `remaining_temp: []`.
- Ownership moved:
  - No ownership moved; this is a stand/browser smoke verification of existing Objects UI family gating.
- Old entrypoint now delegates to:
  - existing unified Firewall `objects` section and existing `/firewall/tables` API; no wire/API shape change.
- Verification commands:
  - Stand API setup — created temporary `ip/ip6/netdev` custom tables, all returned HTTP 201.
  - Browser smoke — Object table selector listed all temporary family-specific custom tables; modal kind availability matched backend family matrix; browser console had no warn/error entries.
  - Stand API cleanup — deleted all temporary tables, all returned HTTP 200, and follow-up listing reported `remaining_temp: []`.
- Result summary:
  - Objects UI now has browser-verified selector/gating coverage for `ip`, `ip6`, and `netdev` custom tables, not only the existing bridge table.

## 1.208) Firewall Policy Add Rule: NAT actions gated by table context

- Step scope:
  - Browser/API smoke on stand for unified Policy `Add rule` found a UI/backend mismatch:
    - custom `ip/ip6` tables with `chain_type=filter` could show NAT verdict options (`dnat`, `snat`, `masquerade`, `redirect`) because the UI checked only `family=inet/ip/ip6`;
    - backend correctly rejects such payloads with `nat_type is only valid for nat table`.
  - Updated `PolicyRuleEditorActionTab` so NAT verdicts are shown only when the current form context supports `nat_type`.
  - Added Playwright characterization for a custom `ip` filter table: NAT verdict options are hidden, while `reject` remains available.
  - Deployed rebuilt `webui/dist` to stand; `/ui/` now serves `index-Dzk81cHk.js`.
  - Temporary stand tables `qa_rule_ip_1780135795`, `qa_rule_ip6_1780135795`, and `qa_rule_nd_1780135795` were removed and verified with `remaining_temp: []`.
- Ownership moved:
  - No module boundary moved; `PolicyRuleEditorActionTab` remains the UI owner for visible action/verdict choices, now using existing rule form context support metadata.
- Old entrypoint now delegates to:
  - existing unified Firewall `policy` section and existing `/firewall/rules` API; no wire/API shape change.
- Verification commands:
  - `cd webui && npm run build` — passed (`index-Dzk81cHk.js`).
  - Stand setup — created temporary `ip/ip6/netdev` custom tables, all returned HTTP 201.
  - Browser smoke before fix — confirmed custom `ip/ip6/netdev` selector visibility and found NAT actions offered in a non-nat `ip` filter context.
  - Stand deploy — copied rebuilt `webui/dist`; stand `/root/awg-manager/webui/dist/index.html` references `/assets/index-Dzk81cHk.js`.
  - Stand cleanup — deleted all temporary tables, all returned HTTP 200, and follow-up listing reported `remaining_temp: []`.
  - Browser smoke after deploy — attempted, but in-app browser CDP timed out during the `Add` click; final verification relies on `npm run build`, added Playwright characterization, and stand bundle check.
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-policy-v2-bridge.spec.ts -g "unified Policy ip filter" --project=chromium` — 1 passed.
- Result summary:
  - Unified Policy `Add rule` no longer offers NAT verdicts from filter-context custom `ip/ip6` tables, aligning UI choices with backend validation and nft table semantics.

## 1.209) Firewall Policy Add Rule: NAT verdicts follow selected nat chain

- Step scope:
  - Tightened unified Policy `Add rule` action choices for built-in/custom nat contexts.
  - `PolicyRuleEditorActionTab` now receives explicit `natActionOptions` from the shared rule form context instead of deriving all NAT verdicts from family alone.
  - `firewall.tsx` derives `natActionOptions` from `schema.tables.nat.nat_types_by_chain[chain]` only when `contextMode=nat`.
  - Resulting UI matrix:
    - `nat/prerouting` and `nat/output`: `dnat`, `redirect`.
    - `nat/postrouting`: `snat`, `masquerade`.
    - `nat/input` and non-nat contexts: no NAT verdict options.
  - Added Playwright coverage for the built-in `nat` chain matrix and kept the previous custom `ip` filter guard.
  - Deployed rebuilt `webui/dist` to stand; `/ui/` now serves `index-BTM_HKVI.js`.
- Ownership moved:
  - No module boundary moved; `usePolicyRuleFormContext`/`firewall.tsx` continue to own table/chain context, and `PolicyRuleEditorActionTab` continues to own visible action choices.
- Old entrypoint now delegates to:
  - existing unified Firewall `policy` section and existing `/firewall/rules` API; no wire/API shape change.
- Verification commands:
  - `cd webui && npm run build` — passed (`index-BTM_HKVI.js`).
  - Stand deploy — copied rebuilt `webui/dist`; stand `/root/awg-manager/webui/dist/index.html` references `/assets/index-BTM_HKVI.js`.
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-rules.spec.ts -g "firewall policy nat" --project=chromium` — 1 passed.
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-policy-v2-bridge.spec.ts -g "unified Policy ip filter" --project=chromium` — 1 passed.
- Result summary:
  - Unified Policy `Add rule` now offers NAT verdicts only for the selected nat chain combinations accepted by backend validation and nftables semantics.

## 1.210) Firewall Policy Add Rule: raw/mangle context guard coverage

- Step scope:
  - Added Playwright coverage for existing unified Policy `Add rule` context gating in built-in `raw` and `mangle` tables.
  - Confirmed `raw` context exposes `raw_expr`, `nftrace`, and `notrack` controls, while mangle mark setters are hidden there.
  - Confirmed `mangle` context exposes `mark_set` and `ct_mark_set`, while raw-only advanced controls remain labeled as raw-table-only.
  - No production UI/backend behavior was changed in this step; this locks the current form behavior against regressions while collapsing policy flows.
- Ownership moved:
  - No module boundary moved; `PolicyRuleEditorAdvancedTab` remains the UI owner for raw/debug controls, and `PolicyRuleEditorActionTab` remains the UI owner for action/mark controls.
- Old entrypoint now delegates to:
  - Existing unified Firewall `policy` section and existing `/firewall/rules` API; no wire/API shape change.
- Verification commands:
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-rules.spec.ts -g "raw/mangle" --project=chromium` — 1 passed.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 20 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 46 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 283 passed.
- Result summary:
  - The unified Policy form now has e2e protection for the hardest built-in table-context split after NAT: raw-only debug/notrack controls and mangle-only mark setters stay visually separated by table context.

## 1.211) Firewall UI tests: Add Rule completeness aligned with raw context gating

- Step scope:
  - Updated `firewall-add-rule-fields-completeness.spec.ts` so the advanced-field completeness check matches the current unified Policy context model.
  - The default `filter` Add Rule modal now asserts the raw-only hint for `raw_expr`/`nftrace` instead of expecting an editable raw expression field outside the `raw` table.
  - The same scenario switches to the built-in `raw` table and verifies the editable `raw expression` control there.
  - No production UI/backend behavior was changed in this step; this is a test alignment after raw/mangle context gating.
- Ownership moved:
  - No module boundary moved; this step updates e2e ownership/coverage only.
- Old entrypoint now delegates to:
  - Existing unified Firewall `policy` section and existing Add Rule modal; no wire/API shape change.
- Verification commands:
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-add-rule-fields-completeness.spec.ts --project=chromium` — RED before test alignment, then 3 passed.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 20 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 46 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 283 passed.
- Result summary:
  - The Add Rule completeness e2e now protects the intended context split: filter shows raw-only guidance, raw exposes the editable raw expression controls.

## 1.212) Firewall UI tests: netdev Add Rule action matrix guard

- Step scope:
  - Added Playwright coverage for unified Policy `Add rule` when a custom `netdev` table is selected.
  - The test verifies the netdev action matrix in the existing form:
    - `accept`, `drop`, `queue`, and `fwd` are available.
    - `reject` and NAT verdicts (`dnat`, `snat`, `masquerade`, `redirect`) are hidden.
    - named-object bindings and counter-object selector are hidden for netdev, while the plain nft counter checkbox remains available.
  - No production UI/backend behavior was changed in this step; this locks current netdev form behavior during policy unification.
- Ownership moved:
  - No module boundary moved; this step updates e2e coverage only.
- Old entrypoint now delegates to:
  - Existing unified Firewall `policy` section with custom table selector (`netdev / <table>`); no wire/API shape change.
- Verification commands:
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-policy-v3-netdev.spec.ts -g "action choices" --project=chromium` — RED on stale counter-label expectation, then 1 passed after test alignment.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 20 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 46 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 283 passed.
- Result summary:
  - Unified Add Rule now has explicit e2e protection for the netdev-only action surface: `fwd` is available, while reject/NAT/object-binding paths stay out of the netdev UI.

## 1.213) Firewall UI tests: bridge Add Rule action/object matrix guard

- Step scope:
  - Added Playwright coverage for unified Policy `Add rule` when a custom `bridge` table is selected.
  - The test verifies the bridge action/object matrix in the existing form:
    - `accept`, `drop`, `reject`, and `queue` are available.
    - netdev-only `fwd` and NAT verdicts (`dnat`, `snat`, `masquerade`, `redirect`) are hidden.
    - bridge object bindings (`ct_helper`, `ct_timeout`, limit/quota object section) and counter-object UI are visible.
    - `ct_expectation` binding stays hidden for bridge, matching backend validation.
  - No production UI/backend behavior was changed in this step; this locks current bridge form behavior during policy unification.
- Ownership moved:
  - No module boundary moved; this step updates e2e coverage only.
- Old entrypoint now delegates to:
  - Existing unified Firewall `policy` section with custom table selector (`bridge / <table>`); no wire/API shape change.
- Verification commands:
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-policy-v2-bridge.spec.ts -g "Add Rule action" --project=chromium` — RED on strict text locators, then 1 passed after test locator alignment.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 20 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 46 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 283 passed.
- Result summary:
  - Unified Add Rule now has explicit e2e protection for the bridge action/object surface: reject/queue/object bindings are present, while fwd/NAT/ct_expectation paths stay out of the bridge UI.

## 1.214) Firewall UI: ip/ip6 ct_expectation Add Rule binding guard

- Step scope:
  - Added Playwright coverage for unified Policy `Add rule` when custom `ip` and `ip6` filter tables have `ct_expectation` named objects.
  - The test verifies that `ct expectation object` binding is available for both custom L3 families and that the table-scoped object option appears in the Add Rule form.
  - Fixed a small frontend draft-state leak found by the test: closing the rule editor and switching active rule table now clears table-scoped object bindings (`counter_name`, `limit_name`, `quota_name`, `ct_helper_set`, `ct_timeout_set`, `ct_expectation_set`) from the Add Rule draft.
  - Rebuilt and deployed `webui/dist` to the stand; `/ui/` now serves `index-C53Ldd-S.js`.
- Ownership moved:
  - No module boundary moved; `usePolicyRuleEditorSync` remains the UI owner for keeping Add Rule draft context aligned with the selected policy table.
- Old entrypoint now delegates to:
  - Existing unified Firewall `policy` section with custom table selector (`ip / <table>`, `ip6 / <table>`); no wire/API shape change.
- Verification commands:
  - `cd webui && npm run build` — passed (`index-C53Ldd-S.js`).
  - Stand deploy — copied rebuilt `webui/dist`; stand `/root/awg-manager/webui/dist/index.html` references `/assets/index-C53Ldd-S.js`.
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-policy-v2-bridge.spec.ts -g "ct expectation object binding" --project=chromium` — RED before test/fix alignment, then 1 passed.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 20 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 46 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 283 passed.
- Result summary:
  - Unified Add Rule now has explicit e2e protection for `ct_expectation` bindings in custom `ip/ip6` contexts, while stale table-scoped object bindings are cleared when the draft context changes.

## 1.215) Firewall UI tests: custom ip/ip6 NAT action matrix guard

- Step scope:
  - Added Playwright coverage for unified Policy `Add rule` when custom `ip`/`ip6` NAT tables are selected.
  - The test verifies that custom `ip` `postrouting` NAT exposes only source-NAT actions (`snat`, `masquerade`) and hides destination-NAT actions (`dnat`, `redirect`).
  - The test verifies that custom `ip6` `prerouting` NAT exposes only destination-NAT actions (`dnat`, `redirect`) and hides source-NAT actions (`snat`, `masquerade`).
  - During test bring-up, aligned the NAT test helper with nft-compatible custom NAT priorities (`postrouting=101`, `prerouting=-101`), avoiding invalid runtime priority choices while keeping production behavior unchanged.
- Ownership moved:
  - No module boundary moved; this step updates e2e coverage only.
- Old entrypoint now delegates to:
  - Existing unified Firewall `policy` section with custom table selector (`ip / <table>`, `ip6 / <table>`); no wire/API shape change.
- Verification commands:
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-policy-v2-bridge.spec.ts -g "custom nat" --project=chromium` — RED on invalid test-only NAT priority, then 1 passed after helper alignment.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 20 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 46 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 283 passed.
- Result summary:
  - Unified Add Rule now has explicit e2e protection for custom L3 NAT action gating: postrouting exposes source NAT only, prerouting exposes destination NAT only.
  - No production frontend/backend behavior was changed in this step.

## 1.216) Firewall UI tests: built-in inet NAT output action guard

- Step scope:
  - Extended the existing unified Policy built-in `inet/nat` Add Rule e2e coverage with the `output` chain.
  - The test now verifies that `output` exposes destination-NAT actions (`dnat`, `redirect`) and hides source-NAT actions (`snat`, `masquerade`), alongside the existing `prerouting`, `postrouting`, and `input` checks.
  - No production UI/backend behavior was changed in this step; this is coverage only.
- Ownership moved:
  - No module boundary moved; this step updates e2e coverage only.
- Old entrypoint now delegates to:
  - Existing unified Firewall `policy` section and built-in `nat` tab; no wire/API shape change.
- Verification commands:
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-rules.spec.ts -g "action choices" --project=chromium` — 1 passed.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 20 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 46 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 283 passed.
- Result summary:
  - Unified Add Rule now has complete built-in `inet/nat` action-matrix coverage for `prerouting`, `output`, `postrouting`, and `input` chain behavior.

## 1.217) Firewall UI: base interface fields follow hook direction

- Step scope:
  - Added Playwright coverage for unified Policy Add Rule base fields when switching built-in hook chains.
  - Fixed `PolicyRuleEditorBaseTab` so `Input interface` and `Output interface` follow `policyFieldStates` hook direction, matching existing `Connection state` gating.
  - `filter:input`/`nat:prerouting` show input interface only, `filter:output`/`nat:postrouting` show output interface only, and NAT chains keep `Connection state` hidden.
  - Rebuilt and deployed `webui/dist` to the stand; `/ui/` now serves `index-CuF3kIvn.js`.
- Ownership moved:
  - No module boundary moved; `PolicyRuleEditorBaseTab` now consumes the already-owned `generalFieldState` context for interface fields as intended.
- Old entrypoint now delegates to:
  - Existing unified Firewall `policy` Add Rule form; no wire/API shape change.
- Verification commands:
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-rules.spec.ts -g "base fields" --project=chromium` — RED before fix on extra `Output interface` in `filter:input`, then 1 passed after fix/deploy.
  - `cd webui && npm run build` — passed (`index-CuF3kIvn.js`).
  - Stand deploy — copied rebuilt `webui/dist`; stand `/root/awg-manager/webui/dist/index.html` references `/assets/index-CuF3kIvn.js`.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 20 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 46 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 283 passed.
- Result summary:
  - Unified Add Rule base form now hides hook-incompatible interface fields, reducing invalid combinations before submit while preserving backend/API compatibility.

## 1.218) Firewall UI tests: custom ip/ip6 filter base-field hook guard

- Step scope:
  - Added Playwright coverage for unified Policy Add Rule base fields in custom `ip`/`ip6` filter tables.
  - The test verifies that custom `ip` `input` chains show `Input interface`, hide `Output interface`, and keep `Connection state` visible.
  - The test verifies that custom `ip6` `output` chains show `Output interface`, hide `Input interface`, and keep `Connection state` visible.
  - No production UI/backend behavior was changed in this step; the previous `PolicyRuleEditorBaseTab` hook-direction fix already covers custom L3 filter tables.
- Ownership moved:
  - No module boundary moved; this step updates e2e coverage only.
- Old entrypoint now delegates to:
  - Existing unified Firewall `policy` section with custom table selector (`ip / <table>`, `ip6 / <table>`); no wire/API shape change.
- Verification commands:
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-policy-v2-bridge.spec.ts -g "base fields follow hook" --project=chromium` — 1 passed.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 20 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 46 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 283 passed.
- Result summary:
  - Unified Add Rule now has explicit e2e protection that custom L3 filter tables inherit the same hook-direction base-field behavior as built-in `inet` tables.

## 1.219) Firewall UI tests: custom ip/ip6 NAT base-field hook guard

- Step scope:
  - Added Playwright coverage for unified Policy Add Rule base fields in custom `ip`/`ip6` NAT tables.
  - The test verifies that custom `ip` `prerouting` NAT shows `Input interface`, hides `Output interface`, and hides `Connection state`.
  - The test verifies that custom `ip6` `postrouting` NAT shows `Output interface`, hides `Input interface`, and hides `Connection state`.
  - No production UI/backend behavior was changed in this step; the existing hook-direction form context already covers custom L3 NAT tables.
- Ownership moved:
  - No module boundary moved; this step updates e2e coverage only.
- Old entrypoint now delegates to:
  - Existing unified Firewall `policy` section with custom table selector (`ip / <table>`, `ip6 / <table>`); no wire/API shape change.
- Verification commands:
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-policy-v2-bridge.spec.ts -g "custom nat: base fields" --project=chromium` — 1 passed.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 20 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 46 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 283 passed.
- Result summary:
  - Unified Add Rule now has explicit e2e protection that custom L3 NAT tables inherit the same hook-direction base-field behavior as built-in `inet/nat`.

## 1.220) Firewall UI: bridge/netdev base-field guards

- Step scope:
  - Added Playwright coverage for unified Policy Add Rule base fields in custom `bridge` and `netdev` tables.
  - Bridge Add Rule now has an explicit guard that bridge interface controls (`Bridge input`, `Bridge output`) are shown while generic L3 `Input interface`/`Output interface` controls are hidden.
  - Netdev Add Rule now has an explicit guard that ingress context shows `Input interface`, hides `Output interface`, and does not show bridge-only fields.
  - Fixed `PolicyRuleEditorBaseTab` so `Output interface` is hidden for `family=netdev`, matching backend validation (`out_interface is not supported for family=netdev`).
  - Rebuilt and deployed `webui/dist` to the stand; `/ui/` now serves `index-DlH5w9nX.js`.
- Ownership moved:
  - No module boundary moved; `PolicyRuleEditorBaseTab` remains the owner of base-field visibility in the unified Add Rule form.
- Old entrypoint now delegates to:
  - Existing unified Firewall `policy` section with custom table selector (`bridge / <table>`, `netdev / <table>`); no wire/API shape change.
- Verification commands:
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-policy-v2-bridge.spec.ts tests/firewall-policy-v3-netdev.spec.ts -g "base fields" --project=chromium` — RED before fix on extra `Output interface` in `netdev`, then 4 passed after fix/deploy.
  - `cd webui && npm run build` — passed (`index-DlH5w9nX.js`).
  - Stand deploy — copied rebuilt `webui/dist`; stand `/root/awg-manager/webui/dist/index.html` references `/assets/index-DlH5w9nX.js`.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 20 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 46 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 283 passed.
- Result summary:
  - Unified Add Rule now has explicit e2e protection for bridge/netdev base-field separation, and netdev no longer exposes backend-rejected `out_interface` in the UI.

## 1.221) Firewall backend: neutral unified Policy validation wording

- Step scope:
  - Cleaned active firewall domain validation messages that still referenced legacy `Policy v2 MVP` / `Policy3` names.
  - Bridge and netdev unsupported-field errors now say `unified Policy`, matching the current single Policy UI and preserving the same exception type/API payload shape.
  - No validation logic, HTTP status mapping, or request/response fields were changed.
- Ownership moved:
  - No module boundary moved; `backend/domains/firewall/rule_ops.py` remains the owner of family-specific firewall rule validation.
- Old entrypoint now delegates to:
  - Existing unified Firewall `policy` Add Rule flow and backend `rule_ops` validation; no wire/API shape change.
- Verification commands:
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py -k "bridge_and_netdev_restrictions or family_specific_restrictions"` — RED before backend wording update, then 2 passed.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 20 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 46 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 283 passed.
- Result summary:
  - Active firewall validation errors no longer leak legacy Policy2/Policy3 UI naming while preserving backend validation semantics and API payload shape.

## 1.222) Firewall tests: neutral custom bridge fixture naming

- Step scope:
  - Cleaned the active `resolve_table_chain_context` unit-test fixture that still used `policy2` as a custom bridge table name.
  - Renamed the fixture table to `bridge_policy_tbl` and aligned expected validation messages in the same test.
  - No production backend/frontend behavior, validation logic, HTTP status mapping, or API payload fields were changed.
- Ownership moved:
  - No module boundary moved; `backend/domains/firewall/rule_ops.py` remains the owner of custom table/chain context resolution.
- Old entrypoint now delegates to:
  - Existing unified Firewall `policy` Add Rule/custom table flow; this step only removes legacy wording from an active unit-test fixture.
- Verification commands:
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py -k resolve_table_chain_context` — 1 passed, 19 deselected.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 20 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 46 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 283 passed.
- Result summary:
  - Active firewall rule context tests no longer encode `policy2` as a live custom bridge table name while preserving the same coverage and behavior expectations.

## 1.223) Firewall tests: neutral named-object bridge fixture naming

- Step scope:
  - Cleaned the active `validate_runtime_named_object_references` unit-test fixture that still used `policy2` as a custom bridge table name.
  - Renamed the fixture table to `bridge_policy_tbl` and aligned the expected effective-object loader calls.
  - No production backend/frontend behavior, validation logic, HTTP status mapping, or API payload fields were changed.
- Ownership moved:
  - No module boundary moved; `backend/domains/firewall/named_object_ops.py` remains the owner of runtime named-object reference validation.
- Old entrypoint now delegates to:
  - Existing unified Firewall `objects` section and `policy` Add Rule/custom table flow; this step only removes legacy wording from an active unit-test fixture.
- Verification commands:
  - `python3 -m pytest -q tests/test_firewall_named_object_ops.py` — 9 passed.
  - Active-code search `rg -n "Policy v2 MVP|Policy3|policy3|policy v2|policy2" backend/domains/firewall tests/test_firewall_rule_ops.py tests/test_firewall_named_object_ops.py webui/src webui/tests` — no matches.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 20 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 46 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 283 passed.
- Result summary:
  - Active firewall named-object tests no longer encode `policy2` as a live custom bridge table name while preserving the same coverage and behavior expectations.

## 1.224) Firewall UI tests: netdev live stand e2e selector refresh

- Step scope:
  - Ran the full unified Policy `netdev` Playwright suite against the stand and found one stale e2e selector in the UI create/edit scenario.
  - Updated the test to use the current Add/Edit Rule comment placeholder `Rule comment (optional)` instead of the removed `Optional comment` wording.
  - No production backend/frontend behavior, validation logic, HTTP status mapping, or API payload fields were changed.
- Ownership moved:
  - No module boundary moved; `PolicyRuleEditorBaseTab` remains the owner of the Add/Edit Rule comment field, and `firewall-policy-v3-netdev.spec.ts` owns netdev UI/API e2e coverage.
- Old entrypoint now delegates to:
  - Existing unified Firewall `policy` section with custom `netdev / <table>` selector; no wire/API shape change.
- Verification commands:
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-policy-v3-netdev.spec.ts --project=chromium` — RED before selector refresh: 4 passed, 1 failed on stale `Optional comment` placeholder; then 5 passed after the test update.
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-policy-v3-netdev.spec.ts -g "UI creates and edits" --project=chromium` — 1 passed after the test update.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 20 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 46 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 283 passed.
- Result summary:
  - Unified Policy `netdev` API/UI coverage is green on the stand; the only issue found was stale e2e wording after the current Add/Edit Rule form placeholder.

## 1.225) Firewall backend tests: netdev fwd render/script smoke

- Step scope:
  - Added backend unit coverage for rendering a unified Policy `netdev` rule with `action=fwd` into the expected nft statement (`fwd ip to ... device ...`).
  - Added backend unit coverage that enabled `netdev` rules are assembled into `add rule netdev <table> ingress ...` script lines while other families are skipped for that table context.
  - No production backend/frontend behavior, validation logic, HTTP status mapping, or API payload fields were changed; existing renderer behavior was already correct.
- Ownership moved:
  - No module boundary moved; `backend/domains/firewall/rule_ops.py` remains the owner of firewall rule rendering and enabled-rule script assembly.
- Old entrypoint now delegates to:
  - Existing unified Firewall `policy` section with custom `netdev / <table>` selector; no wire/API shape change.
- Verification commands:
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py -k "render_firewall_rule or append_enabled_rule_script_lines"` — 2 passed, 18 deselected.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 20 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 46 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 283 passed.
- Result summary:
  - Unified Policy `netdev` now has backend guard coverage for the final nft render/script path, complementing the stand UI/API e2e coverage from the previous step.

## 1.226) Firewall UI tests: netdev Objects binding guard

- Step scope:
  - Added stand e2e coverage for the unified `objects` section when a `netdev / <table>` object table is selected.
  - The test verifies that a `netdev` counter object can be listed, `Use in rule` remains disabled even after row selection, row-level `use` actions are absent, and `ct_helper`/`ct_timeout`/`ct_expectation` object kinds are disabled in the object modal.
  - No production backend/frontend behavior, validation logic, HTTP status mapping, or API payload fields were changed.
- Ownership moved:
  - No module boundary moved; `FirewallObjectsPanel` remains the owner of object-panel action availability, `FirewallObjectModal` remains the owner of object-kind availability, and `firewall-policy-v3-netdev.spec.ts` owns netdev e2e coverage.
- Old entrypoint now delegates to:
  - Existing unified Firewall `objects` section with custom `netdev / <table>` selector; no wire/API shape change.
- Verification commands:
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-policy-v3-netdev.spec.ts -g "netdev objects" --project=chromium` — 1 passed.
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-policy-v3-netdev.spec.ts --project=chromium` — 6 passed.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 20 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 46 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 283 passed.
- Result summary:
  - Unified Policy `netdev` is now covered across API, Add/Edit UI, render/script unit paths, and Objects UI binding restrictions.

## 1.227) Firewall UI tests: bridge ct_expectation wording alignment

- Step scope:
  - Checked unified Policy bridge named-object coverage after the Policy collapse and found stale e2e expectations for bridge `ct_expectation` wording.
  - Updated bridge Playwright expectations from the old `planned for family=bridge` wording to the current backend validation wording `is not supported for family=bridge`.
  - No production backend/frontend behavior, validation logic, HTTP status mapping, or API payload fields were changed.
- Ownership moved:
  - No module boundary moved; `backend/domains/firewall/rule_ops.py` and `backend/domains/firewall/named_object_ops.py` remain the owners of bridge named-object validation, while `firewall-policy-v2-bridge.spec.ts` owns bridge e2e coverage.
- Old entrypoint now delegates to:
  - Existing unified Firewall `policy` and `objects` sections with custom `bridge / <table>` selector; no wire/API shape change.
- Verification commands:
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-policy-v2-bridge.spec.ts -g "ct_expectation|object binding validation" --project=chromium` — RED before wording update on stale `ct_expectation is planned for family=bridge`, then green after update for the matched test.
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-policy-v2-bridge.spec.ts -g "missing named stateful|ct_expectation object" --project=chromium` — 2 passed.
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-policy-v2-bridge.spec.ts --project=chromium` — 31 passed.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 20 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 46 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 283 passed.
- Result summary:
  - Unified Policy bridge e2e coverage is green on the stand and no longer expects stale Policy2-era planned wording for `ct_expectation`.

## 1.228) Firewall UI tests: built-in inet Policy smoke after bridge/netdev pass

- Step scope:
  - Ran stand Playwright smoke coverage for built-in unified Policy `inet` tabs after the bridge/netdev verification pass.
  - Covered basic rules flow, built-in `nat` action choices, `raw`/`mangle` context-specific controls, hook-direction base fields, and Add Rule field/tabs completeness.
  - No production backend/frontend behavior, validation logic, HTTP status mapping, or API payload fields were changed.
- Ownership moved:
  - No module boundary moved; `firewall-rules.spec.ts` and `firewall-add-rule-fields-completeness.spec.ts` remain the owners of built-in Policy UI smoke coverage.
- Old entrypoint now delegates to:
  - Existing unified Firewall `policy` section; built-in `filter`/`nat`/`raw`/`mangle` remain `inet`-scoped and no wire/API shape changed.
- Verification commands:
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-rules.spec.ts tests/firewall-add-rule-fields-completeness.spec.ts --project=chromium` — 7 passed.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 20 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 46 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 283 passed.
- Result summary:
  - Built-in `inet` Policy flows remained green on the stand after the bridge/netdev consolidation and object-binding checks.

## 1.229) Firewall planning: Policy collapse status and NFT/libnftables roadmap

- Step scope:
  - Updated the Policy unification plan with the current functional status of the `Policy1/Policy2/Policy3` collapse.
  - Marked the parity/removal step for separate `policy2`/`policy3` UI as complete after the bridge/netdev/built-in Policy verification passes.
  - Added a checkbox roadmap for further firewall development toward broader `docs/reference/NFT.md` and `docs/reference/libnftables-json-ManPage.md` coverage.
  - No backend/frontend runtime behavior, validation logic, HTTP status mapping, API payload fields, or stand deployment were changed.
- Ownership moved:
  - No module boundary moved; this is a planning/documentation step only.
- Old entrypoint now delegates to:
  - Existing unified Firewall `policy` and `objects` sections; no new entrypoint or delegation was introduced in this step.
- Verification commands:
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 20 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 46 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 283 passed.
- Result summary:
  - Policy collapse status and next firewall roadmap are documented without runtime/API changes; Python gate is green.

## 1.230) Firewall planning: NFT/libnftables capability matrix

- Step scope:
  - Added `docs/FIREWALL_CAPABILITY_MATRIX.ru.md` as the explicit feature matrix for `docs/reference/NFT.md` / `docs/reference/libnftables-json-ManPage.md` coverage.
  - Classified firewall capabilities as `supported`, `limited`, `planned`, or `not planned without approval`.
  - Covered families, table/chain/rule operations, statements, matches, collections/maps/vmaps, named objects, flowtables, current test gates, and suggested next implementation order.
  - Marked roadmap item `A1` in `docs/FIREWALL_POLICY_UNIFICATION_PLAN.ru.md` as complete.
  - No backend/frontend runtime behavior, validation logic, HTTP status mapping, API payload fields, or stand deployment were changed.
- Ownership moved:
  - No module boundary moved; this is a planning/documentation step only.
- Old entrypoint now delegates to:
  - Existing unified Firewall `policy`, `objects`, `collections`, and `table builder` sections; no new entrypoint or delegation was introduced in this step.
- Verification commands:
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 20 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 46 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 283 passed.
- Result summary:
  - Firewall capability matrix is documented without runtime/API changes; Python gate is green.

## 1.231) Firewall tests: dup limited-capability backend coverage

- Step scope:
  - Added backend unit coverage for existing `dup` statement handling in firewall rule rendering and normalization.
  - Covered `inet` render output for `dup to ... device ...`.
  - Covered `inet` normalization of `dup_to`/`dup_dev`.
  - Covered the existing `bridge` guard that keeps `dup_to`/`dup_dev` planned/disabled for the current nft runtime.
  - Updated `docs/FIREWALL_CAPABILITY_MATRIX.ru.md` to record the stronger `dup` test coverage.
  - No backend/frontend runtime behavior, validation logic, HTTP status mapping, API payload fields, or stand deployment were changed.
- Ownership moved:
  - No module boundary moved; `backend/domains/firewall/rule_ops.py` remains the owner of `dup` rendering and family validation.
- Old entrypoint now delegates to:
  - Existing unified Firewall `policy` Add/Edit flow; no new entrypoint or delegation was introduced in this step.
- Verification commands:
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py -k "render_firewall_rule or normalize_queue_dup_fwd_fields"` — 2 passed, 18 deselected.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 20 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 46 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 283 passed.
- Result summary:
  - Existing `dup` behavior is now explicitly covered in backend tests; Python gate is green.

## 1.232) Firewall tests: advanced match render coverage and matrix status sync

- Step scope:
  - Added backend render smoke coverage for existing advanced firewall match/statement fields.
  - Covered final nft render fragments for L2 fields (`ether_*`, `vlan_id`, `ether_type`), meta fields, ct fields, fib/socket/rt/exthdr matches, named limit/quota/counter objects, mark setters, and ct object bindings.
  - Marked roadmap items `A2` and `A3` complete in `docs/FIREWALL_POLICY_UNIFICATION_PLAN.ru.md`, because `docs/FIREWALL_CAPABILITY_MATRIX.ru.md` now carries explicit statuses and family compatibility.
  - Updated `docs/FIREWALL_CAPABILITY_MATRIX.ru.md` to record stronger render coverage for advanced ct/meta/fib/L2 areas.
  - No backend/frontend runtime behavior, validation logic, HTTP status mapping, API payload fields, or stand deployment were changed.
- Ownership moved:
  - No module boundary moved; `backend/domains/firewall/rule_ops.py` remains the owner of rule rendering and family validation.
- Old entrypoint now delegates to:
  - Existing unified Firewall `policy` Add/Edit flow; no new entrypoint or delegation was introduced in this step.
- Verification commands:
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py -k render_firewall_rule` — 1 passed, 19 deselected.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 20 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 46 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 283 passed.
- Result summary:
  - Existing advanced match/statement rendering is now explicitly covered in backend tests; Python gate is green.

## 1.233) Firewall tests: map/vmap timeout and disabled collection coverage

- Step scope:
  - Added backend unit coverage for existing collection runtime script assembly around `map`/`vmap`.
  - Covered `vmap` timeout declaration rendering (`flags timeout; timeout ...`) and disabled collection rows being skipped for addr/port/iface/map/vmap.
  - Marked roadmap item `D1` complete in `docs/FIREWALL_POLICY_UNIFICATION_PLAN.ru.md`.
  - Updated `docs/FIREWALL_CAPABILITY_MATRIX.ru.md` to record stronger `map`/`vmap` timeout and disabled-row coverage.
  - No backend/frontend runtime behavior, validation logic, HTTP status mapping, API payload fields, or stand deployment were changed.
- Ownership moved:
  - No module boundary moved; `backend/domains/firewall/collection_ops.py` remains the owner of set/map/vmap runtime declaration assembly.
- Old entrypoint now delegates to:
  - Existing unified Firewall `collections` section; no new entrypoint or delegation was introduced in this step.
- Verification commands:
  - `python3 -m pytest -q tests/test_firewall_collection_ops.py` — 5 passed.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 20 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 46 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 283 passed.
- Result summary:
  - Existing map/vmap timeout and disabled-row behavior is now explicitly covered in backend tests; Python gate is green.

## 1.234) Firewall tests: quota reset runtime adapter success coverage

- Step scope:
  - Added backend runtime adapter unit coverage for the existing named quota reset success path.
  - Covered command assembly for `nft reset quotas table <family> <table>` with `check=True`.
  - Marked roadmap item `E3` complete in `docs/FIREWALL_POLICY_UNIFICATION_PLAN.ru.md`.
  - Updated `docs/FIREWALL_CAPABILITY_MATRIX.ru.md` to record stronger reset/list coverage for named counters/quotas.
  - No backend/frontend runtime behavior, validation logic, HTTP status mapping, API payload fields, or stand deployment were changed.
- Ownership moved:
  - No module boundary moved; `backend/domains/firewall/runtime_adapter.py` remains the owner of nft runtime reset/list integration.
- Old entrypoint now delegates to:
  - Existing Firewall reset counters action and runtime adapter path; no new entrypoint or delegation was introduced in this step.
- Verification commands:
  - `python3 -m pytest -q tests/test_firewall_runtime_adapter.py` — 17 passed.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 20 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 46 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 284 passed.
- Result summary:
  - Existing named quota reset runtime adapter behavior is now explicitly covered in backend tests; Python gate is green.

## 1.235) Firewall tests: named object family/binding matrix closure

- Step scope:
  - Added backend unit coverage that runtime named-object reference validation skips `netdev` even when object-binding fields are present.
  - This complements the existing object family/kind matrix coverage for `counter/limit/quota/ct_helper/ct_timeout/ct_expectation` and the existing rule binding guards in `tests/test_firewall_rule_ops.py`.
  - Marked roadmap item `E1` complete in `docs/FIREWALL_POLICY_UNIFICATION_PLAN.ru.md`.
  - Updated `docs/FIREWALL_CAPABILITY_MATRIX.ru.md` to record explicit family matrix and rule-binding guard coverage for named objects.
  - No backend/frontend runtime behavior, validation logic, HTTP status mapping, API payload fields, or stand deployment were changed.
- Ownership moved:
  - No module boundary moved; `backend/domains/firewall/named_object_ops.py` remains the owner of named object normalization, rendering, and reference validation.
- Old entrypoint now delegates to:
  - Existing unified Firewall `objects` section and Add/Edit rule path; no new entrypoint or delegation was introduced in this step.
- Verification commands:
  - `python3 -m pytest -q tests/test_firewall_named_object_ops.py` — 9 passed.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 20 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 46 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 284 passed.
- Result summary:
  - Named object family/rule-binding matrix is now explicitly covered in backend tests; Python gate is green.

## 1.236) Firewall planning: implemented statement inventory closure

- Step scope:
  - Marked roadmap item `F1` complete in `docs/FIREWALL_POLICY_UNIFICATION_PLAN.ru.md`.
  - Documented that the implemented statement/match inventory is now explicitly tracked in `docs/FIREWALL_CAPABILITY_MATRIX.ru.md`.
  - Updated the matrix test summary for the current full Python suite size.
  - No backend/frontend runtime behavior, validation logic, HTTP status mapping, API payload fields, or stand deployment were changed.
- Ownership moved:
  - No module boundary moved; this is a documentation-only closure of the firewall capability inventory.
- Old entrypoint now delegates to:
  - Existing unified Firewall `policy`, `collections`, and `objects` sections; no new entrypoint or delegation was introduced in this step.
- Verification commands:
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 20 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 46 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 284 passed.
- Result summary:
  - Implemented firewall statement/match inventory is now closed in the roadmap and explicitly backed by the capability matrix; Python gate is green.

## 1.237) Firewall runtime: netdev egress decision for current stand

- Step scope:
  - Checked `netdev egress` on stand `132.243.237.120`.
  - Stand runtime is `kernel=5.10.0-42-amd64`, `nftables v0.9.8`; temporary command `nft add chain netdev <tmp> egress { type filter hook egress device "eth0" ... }` fails with `Error: unknown chain hook`.
  - Kept firewall table normalization and rule-context validation runtime-safe: `netdev egress` is explicitly rejected by current runtime-profile guards.
  - Added/updated backend unit coverage for the explicit `egress` rejection and existing `netdev ingress` path.
  - Updated the firewall capability matrix and roadmap to keep `egress` planned/blocked until a compatible runtime is available.
  - No HTTP route shape, API payload field names, frontend UI exposure, IPsec domain code, or stand deployment were changed.
- Ownership moved:
  - No module boundary moved; `backend/domains/firewall/store.py` remains the owner of firewall table normalization and `backend/domains/firewall/rule_ops.py` remains the owner of rule context validation/script assembly.
- Old entrypoint now delegates to:
  - Existing Firewall table/rule service paths; no new entrypoint or delegation was introduced in this step.
- Verification commands:
  - `ssh root@132.243.237.120 'set -eu; table="codex_netdev_egress_$$"; iface="eth0"; cleanup() { nft delete table netdev "$table" >/dev/null 2>&1 || true; }; trap cleanup EXIT; nft add table netdev "$table"; nft add chain netdev "$table" egress "{ type filter hook egress device \"$iface\" priority 0; policy accept; }"; nft add rule netdev "$table" egress counter accept; nft list table netdev "$table"'` — failed as expected with `Error: unknown chain hook`; cleanup verified no `codex_netdev_egress_*` table remains.
  - `python3 -m pytest -q tests/test_firewall_store.py -k netdev_requires_ingress` — 1 passed, 24 deselected.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py -k "append_enabled_rule_script_lines or validate_bridge_and_netdev_restrictions or validate_family_specific_restrictions"` — 3 passed, 17 deselected.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 20 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 46 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 284 passed.
- Result summary:
  - `netdev egress` is not enabled for the current runtime profile; the backend now keeps it explicitly blocked and documented until kernel/nft support is available. Python gate is green.

## 1.238) Firewall backend: bridge runtime guard coverage for NAT/raw/dup

- Step scope:
  - Added runtime renderer guards so stale bridge payloads with `nat_type`, `raw_expr`, `dup_to`, or `dup_dev` are rejected before nft script generation.
  - Added backend unit coverage for bridge NAT/raw/dup renderer rejection while keeping existing inet/netdev render coverage intact.
  - Marked roadmap item `C3` complete in `docs/FIREWALL_POLICY_UNIFICATION_PLAN.ru.md`.
  - Updated `docs/FIREWALL_CAPABILITY_MATRIX.ru.md` to record bridge renderer guards for NAT/raw/dup.
  - No HTTP route shape, API payload field names, frontend UI exposure, IPsec domain code, or stand deployment were changed.
- Ownership moved:
  - No module boundary moved; `backend/domains/firewall/rule_ops.py` remains the owner of firewall rule normalization, family validation, and runtime rendering.
- Old entrypoint now delegates to:
  - Existing Firewall rule service/apply paths; no new entrypoint or delegation was introduced in this step.
- Verification commands:
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py -k render_firewall_rule` — 1 passed, 19 deselected.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 20 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 46 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 284 passed.
- Result summary:
  - Bridge NAT/raw/dup runtime renderer guards are covered and Python gate is green.

## 1.239) Firewall planning: dynamic set statements backend-first design

- Step scope:
  - Added `docs/FIREWALL_DYNAMIC_SET_STATEMENTS_DESIGN.ru.md` for dynamic set statements (`add @set`, `update @set`).
  - Captured safety invariants for packet-path mutations: same `(family, table)` target set, `dynamic`, `timeout`, `size`, allowlisted expressions, and backend/runtime gates before UI exposure.
  - Split roadmap item `D2` into design, collection normalization/render, rule statement normalization/render, and stand runtime gate substeps.
  - Updated `docs/FIREWALL_CAPABILITY_MATRIX.ru.md` to record design status without claiming implementation.
  - No backend/frontend runtime behavior, validation logic, HTTP status mapping, API payload fields, IPsec domain code, or stand deployment were changed.
- Ownership moved:
  - No module boundary moved; this is a documentation/design step only.
- Old entrypoint now delegates to:
  - Existing Firewall `collections` and unified `policy` sections; no new entrypoint or delegation was introduced in this step.
- Verification commands:
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 20 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 46 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 284 passed.
- Result summary:
  - Dynamic set statement implementation remains intentionally disabled, but backend-first design and safety gates are documented; Python gate is green.

## 1.240) Firewall backend: dynamic set declaration fields

- Step scope:
  - Added backend normalization for optional collection fields `dynamic`, `size`, and `gc_interval`.
  - Added safety validation: `dynamic=true` requires `timeout` and `size`; `gc_interval` requires `timeout`; `size` must be `1..1000000`.
  - Added runtime declaration rendering for dynamic sets: `flags dynamic,timeout`, `timeout`, `gc-interval`, and `size`.
  - Included dynamic fields in set runtime signatures so changing safety/runtime limits triggers apply.
  - Marked roadmap item `D2.2` complete while keeping rule-level `add @set` / `update @set`, UI exposure, and stand runtime gate pending.
  - No HTTP route shape, API payload field names, frontend UI exposure, IPsec domain code, or stand deployment were changed.
- Ownership moved:
  - No module boundary moved; `backend/domains/firewall/store.py` remains the owner of collection normalization/runtime signatures and `backend/domains/firewall/collection_ops.py` remains the owner of collection runtime declaration assembly.
- Old entrypoint now delegates to:
  - Existing Firewall `collections` service/apply paths; no new entrypoint or delegation was introduced in this step.
- Verification commands:
  - `python3 -m pytest -q tests/test_firewall_store.py -k "dynamic_requires or runtime_signatures"` — 2 passed, 24 deselected.
  - `python3 -m pytest -q tests/test_firewall_collection_ops.py` — 6 passed.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 20 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 46 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 286 passed.
- Result summary:
  - Dynamic set declaration fields are normalized/rendered for collection declarations while rule-level dynamic set statements remain disabled; Python gate is green.

## 1.241) Firewall backend: dynamic set rule statements

- Step scope:
  - Added backend-only normalization for optional rule fields `set_stmt_op`, `set_stmt_name`, `set_stmt_expr`, `set_stmt_timeout`, and `set_stmt_comment`.
  - Added runtime render support for `add @set { ... }` and `update @set { ... }` before the terminal rule verdict/action.
  - Added safety guards: statement fields are optional, but if used they require `op/name/expr/timeout`, target an enabled existing dynamic set with `size`, and use allowlisted expressions.
  - Kept first runtime-safe scope intentionally narrow: `family=inet`, `addr` sets with `ip saddr`/`ip daddr`, and `port` sets with `tcp dport`/`udp dport`.
  - Kept `ip6`, `meta mark`, `bridge`, `netdev`, UI controls, and stand runtime acceptance pending until matching runtime support is verified.
  - No HTTP route shape, required API fields, frontend UI exposure, IPsec domain code, or stand deployment were changed.
- Ownership moved:
  - No module boundary moved; `backend/domains/firewall/rule_ops.py` remains the owner of firewall rule field normalization/rendering, and `backend/domains/firewall/rule_normalization_service_ops.py` owns the full rule normalization pipeline.
  - `backend/app/manager_facade.py` now passes the existing firewall sets reader into the backend rule normalizer so dynamic set target validation stays domain-owned.
- Old entrypoint now delegates to:
  - Existing Firewall rule create/update service paths; no new HTTP entrypoint was introduced.
- Verification commands:
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py -k "dynamic_set_statement"` — 2 passed, 20 deselected.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 22 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 46 passed (run because `backend/app/manager_facade.py` changed).
  - `python3 -m pytest -q tests` — 288 passed.
- Result summary:
  - Dynamic set rule statements are normalized/rendered in the guarded `inet` addr/port backend scope; Python gate is green.

## 1.242) Firewall runtime: dynamic set statement stand gate

- Step scope:
  - Ran stand runtime gate for dynamic set declarations and rule-level `add @set` / `update @set` statements on `132.243.237.120`.
  - Stand runtime: `kernel=5.10.0-42-amd64`, `nftables v0.9.8 (E.D.S.)`.
  - Verified temporary `inet` table with dynamic `ipv4_addr` and `inet_service` sets, regular chain, `add @ssh_flood { ip saddr timeout 10s }`, and `update @watched_ports { tcp dport timeout 10s }`.
  - Verified cleanup removed the temporary table after the smoke.
  - Found and documented runtime limitation: key-expression comments are rejected by this nft runtime (`Key expression comments are not supported`).
  - Tightened backend normalization to reject `set_stmt_comment` for the current runtime profile while keeping the optional field reserved for future support.
  - No frontend UI exposure, IPsec domain code, persistent stand deployment, or required API fields were changed.
- Ownership moved:
  - No module boundary moved; `backend/domains/firewall/rule_ops.py` remains the owner of dynamic set statement validation/rendering.
- Old entrypoint now delegates to:
  - Existing Firewall rule create/update/apply paths; no new HTTP entrypoint was introduced.
- Verification commands:
  - `ssh root@132.243.237.120 '... add @ssh_flood { ip saddr timeout 10s comment "ssh flood tracker" } ...'` — failed as expected with `Error: Key expression comments are not supported`; cleanup verified.
  - `ssh root@132.243.237.120 '... add @ssh_flood { ip saddr timeout 10s } ... update @watched_ports { tcp dport timeout 10s } ...'` — passed; `nft list table` showed both rules; cleanup verified.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py -k "dynamic_set_statement"` — 2 passed, 20 deselected.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 22 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 46 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 288 passed.
- Result summary:
  - Dynamic set statements are runtime-accepted on the stand for the guarded `inet` addr/port scope without key-expression comments; backend now rejects `set_stmt_comment` until the runtime profile supports it.

## 1.243) Firewall UI/backend: dynamic set statement controls in Add Rule

- Step scope:
  - Added existing-Policy1 Add Rule -> Action controls for guarded dynamic set statements: target set, `add/update`, expression, and statement timeout.
  - UI lists only dynamic-capable addr/port collections and keeps the first exposed scope limited to `family=inet`.
  - Save payload keeps optional `set_stmt_*` fields only when the form is in supported `inet` scope; unsupported families clear the fields before API submit.
  - Added optional frontend API typing for `set_stmt_*` rule fields and dynamic collection safety fields `dynamic`, `size`, `gc_interval`.
  - Fixed the backend facade normalizer callback to accept and forward `validate_runtime_objects`, preventing firewall rule create/update from falling into legacy fallback when service-layer runtime validation is requested.
  - Added Playwright coverage for creating a dynamic collection, enabling dynamic set update in Add Rule, saving the rule, verifying returned `set_stmt_*`, and cleaning up.
  - Updated capability/design/roadmap docs to mark D2.5 UI controls complete for the limited runtime-safe scope.
  - No IPsec domain code, required API fields, route shape, or Policy UI redesign was introduced.
- Ownership moved:
  - `PolicyRuleEditorActionTab` owns dynamic set statement controls inside the existing Add/Edit rule form.
  - `usePolicyRuleEditorActions` owns frontend save-payload sanitization for unsupported `set_stmt_*` contexts.
  - `backend/app/manager_facade.py` remains the app/facade compatibility boundary and now forwards the service-layer runtime validation flag to the firewall domain normalizer.
- Old entrypoint now delegates to:
  - Existing `/firewall/rules` create/update service paths; no new HTTP entrypoint was introduced.
- Verification commands:
  - `npm run build` — passed; Vite chunk-size warning only.
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-rules.spec.ts -g "dynamic set statement" --project=chromium` — 1 passed on the stand.
  - Direct stand HTTP smoke: create/delete `inet/filter` rule with `set_stmt_op=add`, `set_stmt_name`, `set_stmt_expr=ip saddr`, `set_stmt_timeout=10s` — passed after facade fix.
- Result summary:
  - Dynamic set statements are now available from the existing Add Rule Action tab for the guarded `inet` addr/port scope, with runtime-unsafe extensions still blocked.

## 1.244) Firewall backend: vmap collection verdict validation coverage

- Step scope:
  - Added backend test coverage for existing `vmap` collection normalization.
  - Hardened `vmap` entries so value side must be an allowed verdict: `accept`, `drop`, `queue`, `continue`, or `return`.
  - Kept this scoped to Collections/map normalization; no rule-level `vmap` statement, UI redesign, route shape change, or IPsec code was introduced.
- Ownership moved:
  - No module boundary moved; `backend/domains/firewall/store.py` remains owner of map/vmap entry normalization and now explicitly owns `vmap` verdict allowlist validation.
- Old entrypoint now delegates to:
  - Existing `/firewall/maps/vmap` upsert path through `manager_facade -> firewall_service_layer_ops.upsert_map -> firewall_store.normalize_map_item`.
- Verification commands:
  - `python3 -m pytest -q tests/test_firewall_store.py -k vmap_item` — first failed as RED because invalid verdict was accepted; after implementation passed: 1 passed, 26 deselected.
  - `python3 -m pytest -q tests/test_firewall_store.py tests/test_firewall_collection_ops.py` — 33 passed.
- Result summary:
  - `vmap` collections now have explicit backend coverage and reject unsupported verdict values before runtime rendering.

## 1.245) Firewall UI: remove Policy built-in scope hint

- Step scope:
  - Removed the amber informational hint under the Policy table selector: `Built-in filter/nat/raw/mangle stay inet-scoped; bridge/netdev rules are available through the custom table selector.`
  - Kept Policy selector behavior, built-in `filter/nat/raw/mangle` tabs, custom table selection, rule table, and Add/Edit flow unchanged.
  - Added Playwright coverage that the Policy toolbar no longer renders this hint.
  - No backend behavior, wire/API shape, IPsec code, or module ownership boundary changed.
- Ownership moved:
  - No ownership moved; `PolicySectionToolbar` remains owner of the Policy toolbar UI.
- Old entrypoint now delegates to:
  - Existing unified Policy UI path; no new entrypoint was introduced.
- Verification commands:
  - `npm run build` — passed; Vite chunk-size warning only.
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-rules.spec.ts tests/firewall-add-rule-fields-completeness.spec.ts --project=chromium` — 9 passed on the stand.
- Result summary:
  - The selected hint is removed from the live UI while the existing Policy controls remain available.

## 1.246) Firewall UI: shorten Policy table selector

- Step scope:
  - Shortened the Policy table selector (`System table only`) so it no longer stretches across the full remaining toolbar width.
  - Kept built-in `filter/nat/raw/mangle` tabs, custom table selection behavior, rule table, Add/Edit flow, and API payloads unchanged.
  - Added Playwright coverage that the selector remains visible and stays in a compact width range.
  - No backend behavior, wire/API shape, IPsec code, or module ownership boundary changed.
- Ownership moved:
  - No ownership moved; `PolicySectionToolbar` remains owner of the Policy toolbar UI.
- Old entrypoint now delegates to:
  - Existing unified Policy UI path; no new entrypoint was introduced.
- Verification commands:
  - `npm run build` — passed; Vite chunk-size warning only.
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-rules.spec.ts tests/firewall-add-rule-fields-completeness.spec.ts --project=chromium` — 9 passed on the stand.
- Result summary:
  - The live Policy selector is compact while existing Policy controls continue to work.

## 1.247) Firewall planning: rule-level vmap backend-first design

- Step scope:
  - Added `docs/FIREWALL_VMAP_RULE_STATEMENTS_DESIGN.ru.md` for first-class rule-level `vmap` statements.
  - Chose the first safe implementation scope: optional `vmap_stmt_expr`/`vmap_stmt_name`, named `vmap` collection references, `family=inet`, `meta l4proto vmap @name`.
  - Explicitly deferred inline/raw `vmap { ... }`, `jump/goto` verdict values, bridge/netdev exposure, and UI controls until backend tests plus runtime gate are green.
  - Updated capability matrix and Policy roadmap so D3.1 design is complete while D3 implementation remains open.
  - No runtime code, wire/API payload requirements, Policy UI, IPsec code, or module ownership boundary changed.
- Ownership moved:
  - No module boundary moved in this step.
  - Planned ownership: `backend/domains/firewall/rule_ops.py` will own `vmap_stmt_*` normalization/rendering, while `backend/domains/firewall/collection_ops.py` remains owner of map/vmap declaration typing.
- Old entrypoint now delegates to:
  - No entrypoint changed. Existing future path remains `/firewall/rules` through `manager_facade -> firewall_service_layer_ops -> rule_normalization_service_ops -> rule_ops`.
- Verification commands:
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 22 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 47 passed (run defensively because facade-related files are dirty in this workspace).
  - `python3 -m pytest -q tests` — 290 passed.
- Result summary:
  - Rule-level `vmap` now has a concrete backend-first implementation contract without changing live behavior.

## 1.248) Firewall backend: first named vmap rule statement scope

- Step scope:
  - Added backend-only optional rule fields `vmap_stmt_expr` and `vmap_stmt_name`.
  - Implemented first safe scope: `family=inet`, `vmap_stmt_expr=meta l4proto`, and `meta l4proto vmap @<enabled-vmap-name>` rendering.
  - Added target validation through the existing maps reader: referenced row must exist in `vmap`, be enabled, and have `inet_proto` key type.
  - Extended collection map typing so protocol tokens (`tcp`, `udp`, `icmp`, `icmpv6`, etc.) render vmap declarations as `type inet_proto : verdict;`.
  - Kept UI controls, stand runtime gate, inline/raw `vmap { ... }`, `jump/goto` values, bridge/netdev exposure, and IPsec code out of this step.
- Ownership moved:
  - `backend/domains/firewall/rule_ops.py` now owns `vmap_stmt_*` normalization/rendering for the first named-vmap rule statement scope.
  - `backend/domains/firewall/rule_normalization_service_ops.py` owns composition wiring from normalized rule payload to the maps reader.
  - `backend/domains/firewall/collection_ops.py` owns protocol-token `inet_proto` inference for map/vmap declaration rendering.
- Old entrypoint now delegates to:
  - Existing `/firewall/rules` create/update paths through `manager_facade -> firewall_service_layer_ops -> rule_normalization_service_ops -> rule_ops`; `manager_facade` now passes the existing firewall maps reader into the domain normalizer.
- Verification commands:
  - Targeted RED: `python3 -m pytest -q tests/test_firewall_rule_ops.py -k vmap_statement` — first failed because `read_maps_fn`/rendering were missing.
  - Targeted GREEN: `python3 -m pytest -q tests/test_firewall_rule_ops.py -k vmap_statement` — 2 passed, 22 deselected.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 24 passed.
  - `python3 -m pytest -q tests/test_firewall_collection_ops.py` — 6 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 47 passed (run because `backend/app/manager_facade.py` changed).
  - `python3 -m pytest -q tests` — 292 passed.
- Result summary:
  - Rule-level named `vmap` is now a guarded backend capability for the first `inet` protocol-to-verdict scope; UI and runtime stand acceptance remain next steps.

## 1.249) Firewall runtime: named vmap rule statement stand gate

- Step scope:
  - Ran stand runtime gate for the first named `vmap` rule statement scope on `132.243.237.120`.
  - Stand runtime: `kernel=5.10.0-42-amd64`, `nftables v0.9.8 (E.D.S.)`.
  - Verified temporary `inet` table with named `vmap` declaration `type inet_proto : verdict`, elements `tcp : accept`, `udp : drop`, `icmp : return`, and rule `meta l4proto vmap @proto_verdicts`.
  - Verified `nft -a list table` showed the rule and cleanup removed the temporary table.
  - Updated capability/design/roadmap docs to mark D3.3 runtime gate complete.
  - No UI controls, stand deployment, persistent nft state, route shape, required API fields, or IPsec code changed.
- Ownership moved:
  - No module boundary moved in this step; this is runtime verification for the backend capability added in step `1.248`.
- Old entrypoint now delegates to:
  - No entrypoint changed. Existing future path remains `/firewall/rules` through `manager_facade -> firewall_service_layer_ops -> rule_normalization_service_ops -> rule_ops`.
- Verification commands:
  - `ssh root@132.243.237.120 '... nft add map inet "$table" proto_verdicts "{ type inet_proto : verdict; }" ... nft add rule inet "$table" input meta l4proto vmap @proto_verdicts ...'` — passed; cleanup verified with `cleanup_ok`.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 24 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 47 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 292 passed.
- Result summary:
  - The first backend `vmap_stmt_*` scope is accepted by the current stand runtime; next step can expose guarded controls in the existing Add Rule form.

## 1.250) Firewall UI/backend: named vmap controls in Add Rule

- Step scope:
  - Added existing-Policy1 Add Rule -> Action controls for guarded named `vmap` statements: target vmap and expression.
  - UI lists only enabled protocol-key `vmap` collections and keeps the first exposed scope limited to `family=inet` + `meta l4proto`.
  - Enabling `Verdict map` clears terminal action, NAT target fields, and dynamic set statement fields because the backend first scope does not combine them.
  - Added optional frontend API typing for `vmap_stmt_expr` and `vmap_stmt_name`.
  - Added Playwright coverage for creating a `vmap` collection, enabling Verdict map in Add Rule, saving the rule, verifying returned `vmap_stmt_*`, and cleaning up.
  - Deployed updated backend/domain files and `webui/dist` to the stand for live e2e validation; active bundle `index-Dfilmsk9.js`.
  - No Policy UI redesign, new top-level tab, route shape change, required API field change, bridge/netdev vmap exposure, inline/raw vmap editor, `jump/goto`, or IPsec code was introduced.
- Ownership moved:
  - `PolicyRuleEditorActionTab` owns named `vmap` controls inside the existing Add/Edit rule form.
  - `usePolicyRuleEditorActions` owns frontend save-payload sanitization for unsupported `vmap_stmt_*` contexts and mutual exclusion with dynamic set statements.
  - `webui/src/pages/firewall.tsx` owns protocol-key `vmap` option derivation from existing Collections state.
- Old entrypoint now delegates to:
  - Existing `/firewall/rules` create/update service paths; no new HTTP entrypoint was introduced.
- Verification commands:
  - RED: `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-rules.spec.ts -g "verdict map" --project=chromium` — first failed because `Verdict map` controls were absent.
  - `npm run build` — passed; Vite chunk-size warning only.
  - Stand deploy: copied backend firewall files + `webui/dist`, restarted `api_core.py` on `:8787`, bundle `index-Dfilmsk9.js`.
  - GREEN: `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-rules.spec.ts -g "verdict map" --project=chromium` — 1 passed on the stand.
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-rules.spec.ts tests/firewall-add-rule-fields-completeness.spec.ts --project=chromium` — 10 passed on the stand.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 24 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 47 passed (run because `backend/app/manager_facade.py` is dirty in this workspace).
  - `python3 -m pytest -q tests` — 292 passed.
- Result summary:
  - Named `vmap` rule statements are now available from the existing Add Rule Action tab for the guarded `inet` protocol-to-verdict scope.

## 1.251) Firewall backend: runtime-only collections parser for D4

- Step scope:
  - Added backend parser foundation for runtime-only set/map/vmap reconciliation.
  - `backend/domains/firewall/runtime_adapter.py` now exposes `parse_runtime_collections_from_ruleset_json` and `list_runtime_collections`.
  - The parser reads best-effort set/map/vmap rows from `nft -j list ruleset`, marks them `runtime_only=True`, preserves `(family, table)`, and maps nft types to current collection groups: `ipv4_addr/ipv6_addr -> addr`, `inet_service -> port`, `ifname -> iface`, map -> `map`, verdict map -> `vmap`.
  - Kept this step parser-only: no HTTP response shape change, no UI exposure, no manager-state write/auto-import, no apply behavior change, and no IPsec code.
- Ownership moved:
  - `backend/domains/firewall/runtime_adapter.py` now owns best-effort parsing of runtime-only set/map/vmap overlays from `nft -j list ruleset`.
- Old entrypoint now delegates to:
  - No public entrypoint changed in this step. Future list reconciliation can call `runtime_adapter.list_runtime_collections` from the existing firewall collection list service path.
- Verification commands:
  - RED: `python3 -m pytest -q tests/test_firewall_runtime_adapter.py -k runtime_collections` — first failed because parser/list helpers were absent.
  - GREEN: `python3 -m pytest -q tests/test_firewall_runtime_adapter.py -k runtime_collections` — 2 passed, 17 deselected.
  - `python3 -m pytest -q tests/test_firewall_runtime_adapter.py` — 19 passed.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 24 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 47 passed (defensive run because `backend/app/manager_facade.py` is dirty in this workspace; this step did not change it).
  - `python3 -m pytest -q tests` — 294 passed.
- Result summary:
  - D4 has a backend parser foundation for runtime-only collections while preserving current wire/API and UI behavior.

## 1.252) Firewall backend/UI: read-only runtime collection overlay

- Step scope:
  - Connected D4.2 list reconciliation for runtime-only sets/maps/vmaps from `nft -j list ruleset`.
  - Persisted manager rows remain source of truth; runtime-only rows are appended only when `(kind, family, table, name)` does not conflict with a persisted row.
  - Runtime-only rows are marked with optional `runtime_only=True` and are not written into manager JSON state.
  - Added minimal D4.3 UI safety: runtime-only collections can be displayed, but edit/delete/enable/disable paths are read-only until a separate explicit import action exists.
  - Kept import/reconcile write action, auto-merge, API route changes, required payload changes, stand deploy, and IPsec code out of this step.
- Ownership moved:
  - `backend/domains/firewall/collection_ops.py` now owns `merge_runtime_collection_overlay`.
  - `backend/domains/firewall/service_layer_ops.py` list sets/maps paths accept optional runtime overlay callbacks.
  - `backend/app/manager_facade.py` and `backend/app/legacy_manager_compat.py` wire runtime collection listing through `firewall_runtime_adapter.list_runtime_collections`.
  - Frontend collection API types expose optional `runtime_only`; Collections UI guards read-only runtime rows.
- Old entrypoint now delegates to:
  - Existing `list_firewall_sets_service` and `list_firewall_maps_service` paths delegate through `manager_facade -> firewall_service_layer_ops -> collection_ops`, with runtime rows supplied by `runtime_adapter.list_runtime_collections`.
- Verification commands:
  - RED: `python3 -m pytest -q tests/test_firewall_collection_ops.py -k runtime_only_overlay` — first failed because `runtime_overlay_fn` was absent.
  - GREEN: `python3 -m pytest -q tests/test_firewall_collection_ops.py -k runtime_only_overlay` — 1 passed, 6 deselected.
  - `python3 -m pytest -q tests/test_firewall_collection_ops.py` — 7 passed.
  - `python3 -m pytest -q tests/test_firewall_runtime_adapter.py` — 19 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 48 passed.
  - `npm run build` — passed; Vite chunk-size warning only.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 24 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests` — 296 passed.
- Result summary:
  - Collections list responses can now show externally-created nft set/map/vmap rows as read-only `runtime_only` overlays while preserving persisted manager state and existing write semantics.

## 1.253) Firewall plan correction: disable runtime-only collection overlay

- Step scope:
  - Product decision clarified: externally-created nft collections outside manager are not a supported/expected workflow now.
  - Removed active D4.2/D4.3 behavior from list sets/maps paths: API/UI no longer merge or show runtime-only collections.
  - Removed `runtime_only` frontend typing and UI guards that were only needed for externally-created collection rows.
  - Left D4.1 runtime parser helper as an unused backend foundation only; it is not wired into public list responses.
  - No IPsec code or wire/API required payload shape changed.
- Ownership moved:
  - `backend/domains/firewall/collection_ops.py` no longer owns runtime overlay merge; list collection responses are manager-state only again.
  - `backend/domains/firewall/service_layer_ops.py`, `backend/domains/firewall/compat_entry_ops.py`, `backend/app/manager_facade.py`, and `backend/app/legacy_manager_compat.py` no longer wire runtime collection overlay callbacks.
  - Frontend Collections UI no longer exposes or handles `runtime_only` rows.
- Old entrypoint now delegates to:
  - Existing `list_firewall_sets_service` and `list_firewall_maps_service` paths return only persisted manager collections through the normal store/list path.
- Verification commands:
  - `npm run build` — passed; Vite chunk-size warning only.
  - `python3 -m pytest -q tests/test_firewall_collection_ops.py` — 6 passed.
  - `python3 -m pytest -q tests/test_firewall_runtime_adapter.py` — 19 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 47 passed (run because `backend/app/manager_facade.py` and `backend/app/legacy_manager_compat.py` changed).
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 24 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests` — 294 passed.
- Result summary:
  - Collections UX stays simple and manager-owned only; runtime import/list reconciliation is paused until a separate product decision.

## 1.254) Firewall UI: Action tab why-disabled hints for inet-only controls

- Step scope:
  - Added short why-disabled hints in the existing Add/Edit Rule Action tab for bridge/netdev contexts.
  - Dynamic set update and Verdict map controls remain enabled only for `family=inet`; bridge/netdev now show a concise explanation instead of silently hiding the reason.
  - Added Playwright expectations to existing bridge/netdev Action choices specs.
  - No backend behavior, API payload shape, Policy layout, stand deployment, runtime-only collection behavior, or IPsec code changed.
- Ownership moved:
  - `PolicyRuleEditorActionTab` owns the `inet`-only why-disabled hints for dynamic set and verdict map controls.
- Old entrypoint now delegates to:
  - Existing unified `PolicyRuleEditorDialog` path; no new route or API entrypoint was introduced.
- Verification commands:
  - `npm run build` — passed; Vite chunk-size warning only.
  - `npx playwright test --list tests/firewall-policy-v2-bridge.spec.ts tests/firewall-policy-v3-netdev.spec.ts` — listed 37 tests.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 24 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 47 passed (defensive run in dirty workspace).
  - `python3 -m pytest -q tests` — 294 passed.
- Result summary:
  - Bridge/netdev Action tab now makes the `inet`-only scope of dynamic set update and verdict map explicit while preserving current UI shape.

## 1.255) Firewall UI: Action tab NAT availability hint

- Step scope:
  - Added a compact why-disabled hint in the existing Add/Edit Rule Action tab for NAT verdict availability.
  - `bridge/netdev` contexts now explicitly explain that NAT actions are unavailable for those families.
  - `inet/ip/ip6` contexts where the selected table/chain does not expose NAT verdicts now explain that NAT actions are shown only when the selected family/table/chain supports NAT.
  - Added Playwright expectations to the existing built-in NAT/raw, custom `ip filter`, bridge, and netdev Action matrix specs.
  - No backend behavior, API payload shape, Policy layout, runtime-only collection behavior, stand deployment, or IPsec code changed.
- Ownership moved:
  - `PolicyRuleEditorActionTab` owns the NAT action why-disabled hint alongside the existing dynamic set and verdict map hints.
- Old entrypoint now delegates to:
  - Existing unified `PolicyRuleEditorDialog` path; no new route or API entrypoint was introduced.
- Verification commands:
  - `npm run build` — passed; Vite chunk-size warning only.
  - `npx playwright test --list tests/firewall-rules.spec.ts tests/firewall-policy-v2-bridge.spec.ts tests/firewall-policy-v3-netdev.spec.ts` — listed 44 tests.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 24 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 47 passed (defensive run in dirty workspace).
  - `python3 -m pytest -q tests` — 294 passed.
- Result summary:
  - The unified Add/Edit Rule Action tab now explains NAT scope without changing available actions or payload behavior.

## 1.256) Firewall stand: deploy NAT availability hint bundle

- Step scope:
  - Deployed the rebuilt `webui/dist` bundle to firewall stand `132.243.237.120:8787`.
  - Created remote backup `/root/awg-manager/webui/dist.backup.20260606064847` before replacing `dist`.
  - Kept this as frontend-only deployment: no backend restart, no runtime/state cleanup, no API payload change, and no IPsec code.
  - Verified live UI with the in-app browser:
    - built-in `filter -> Add Rule -> Action` shows `NAT actions are shown only when the selected family/table/chain supports NAT.`;
    - built-in `nat/prerouting -> Add Rule -> Action` does not show the hint and still exposes `dnat`/`redirect`;
    - temporary `bridge` and `netdev` custom tables showed `NAT actions are not available for bridge/netdev rules.` and no `dnat` option.
  - Removed the temporary QA tables after verification.
- Ownership moved:
  - No ownership moved in this step; this is a stand deploy/verification of `PolicyRuleEditorActionTab` behavior from step `1.255`.
- Old entrypoint now delegates to:
  - Existing `/ui/` static bundle path; no route or API entrypoint changed.
- Verification commands:
  - Stand deploy: `scp -r webui/dist/. root@132.243.237.120:/root/awg-manager/webui/dist/` after remote backup.
  - Stand `/ui/` HTML now references `/assets/index-CrKSccwV.js`.
  - Stand health: `GET /health` with API key — `{"ok": true, "service": "awg_manager", "auth": "api_key"}`.
  - Browser live smoke — filter/nat/bridge/netdev NAT hint matrix matched expected visibility.
  - Temporary QA table cleanup — both delete calls returned HTTP 200.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 24 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 47 passed (defensive run in dirty workspace).
  - `python3 -m pytest -q tests` — 294 passed.
- Result summary:
  - The live firewall stand now serves the NAT availability hint UI bundle and the checked Policy contexts match the intended behavior.

## 1.257) Firewall UI: Action tab netdev object-binding hint

- Step scope:
  - Added a compact why-disabled hint in the existing Add/Edit Rule Action tab for `netdev` named-object bindings.
  - `netdev` still does not expose rule object-binding controls; the UI now explains `Named object bindings are not available for netdev rules.` instead of silently hiding that block.
  - Added a Playwright expectation to the existing netdev Action matrix spec.
  - No backend behavior, API payload shape, Policy layout, stand deployment, runtime-only collection behavior, or IPsec code changed.
- Ownership moved:
  - `PolicyRuleEditorActionTab` owns the `netdev` named-object binding why-disabled hint alongside the existing NAT/dynamic set/verdict map hints.
- Old entrypoint now delegates to:
  - Existing unified `PolicyRuleEditorDialog` path; no new route or API entrypoint was introduced.
- Verification commands:
  - `npm run build` — passed; Vite chunk-size warning only.
  - `npx playwright test --list tests/firewall-policy-v3-netdev.spec.ts` — listed 6 tests.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 24 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 47 passed (defensive run in dirty workspace).
  - `python3 -m pytest -q tests` — 294 passed.
- Result summary:
  - The unified netdev Add/Edit Rule Action tab now explains why named-object bindings are unavailable while preserving current validation and payload behavior.

## 1.258) Firewall stand: deploy netdev object-binding hint bundle

- Step scope:
  - Deployed the rebuilt `webui/dist` bundle to firewall stand `132.243.237.120:8787`.
  - Created remote backup `/root/awg-manager/webui/dist.backup.20260606071502` before replacing `dist`.
  - Kept this as frontend-only deployment: no backend restart, no runtime/state cleanup, no API payload change, and no IPsec code.
  - Verified live UI with the in-app browser using a temporary `netdev` custom table:
    - `netdev -> Add Rule -> Action` shows `Named object bindings are not available for netdev rules.`;
    - the `Named objects` binding block remains hidden;
    - NAT remains hidden for `netdev` and the existing NAT why-disabled hint is still visible.
  - Removed the temporary QA table after verification.
- Ownership moved:
  - No ownership moved in this step; this is a stand deploy/verification of `PolicyRuleEditorActionTab` behavior from step `1.257`.
- Old entrypoint now delegates to:
  - Existing `/ui/` static bundle path; no route or API entrypoint changed.
- Verification commands:
  - Stand deploy: `scp -r webui/dist/. root@132.243.237.120:/root/awg-manager/webui/dist/` after remote backup.
  - Stand `/ui/` HTML now references `/assets/index-BGvQ3sQM.js`.
  - Stand health: `GET /health` with API key — `{"ok": true, "service": "awg_manager", "auth": "api_key"}`.
  - Browser live smoke — `netdev` Action tab object-binding hint matched expected visibility.
  - Temporary QA table cleanup — delete call returned HTTP 200.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 24 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 47 passed (defensive run in dirty workspace).
  - `python3 -m pytest -q tests` — 294 passed.
- Result summary:
  - The live firewall stand now serves the netdev object-binding hint UI bundle and the checked Policy context matches the intended behavior.

## 1.259) Firewall UI: Action tab bridge ct_expectation hint

- Step scope:
  - Added a compact why-disabled hint in the existing Add/Edit Rule Action tab for bridge `ct_expectation` scope.
  - Bridge contexts still expose `ct_helper` and `ct_timeout` object bindings, while `ct_expectation` remains hidden; the UI now explains `ct expectation object is available only for inet/ip/ip6 rules.`.
  - Added a Playwright expectation to the existing bridge Action/object matrix spec.
  - No backend behavior, API payload shape, Policy layout, stand deployment, runtime-only collection behavior, or IPsec code changed.
- Ownership moved:
  - `PolicyRuleEditorActionTab` owns the bridge `ct_expectation` why-disabled hint alongside the existing NAT/dynamic set/verdict map/netdev object-binding hints.
- Old entrypoint now delegates to:
  - Existing unified `PolicyRuleEditorDialog` path; no new route or API entrypoint was introduced.
- Verification commands:
  - `npm run build` — passed; Vite chunk-size warning only.
  - `npx playwright test --list tests/firewall-policy-v2-bridge.spec.ts` — listed 31 tests.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 24 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 47 passed (defensive run in dirty workspace).
  - `python3 -m pytest -q tests` — 294 passed.
- Result summary:
  - The unified bridge Add/Edit Rule Action tab now explains why `ct_expectation` object binding is unavailable while preserving current validation and payload behavior.

## 1.260) Firewall stand: deploy bridge ct_expectation hint bundle

- Step scope:
  - Deployed the rebuilt `webui/dist` bundle to firewall stand `132.243.237.120:8787`.
  - Created remote backup `/root/awg-manager/webui/dist.backup.20260606072635` before replacing `dist`.
  - Kept this as frontend-only deployment: no backend restart, no runtime/state cleanup, no API payload change, and no IPsec code.
  - Verified live UI with the in-app browser using a temporary `bridge` custom table:
    - `bridge -> Add Rule -> Action` shows `ct expectation object is available only for inet/ip/ip6 rules.`;
    - `ct helper object` and `ct timeout object` remain visible for bridge;
    - `ct expectation object` selector remains hidden for bridge;
    - the `Named objects` block remains visible.
  - Removed the temporary QA table after verification.
- Ownership moved:
  - No ownership moved in this step; this is a stand deploy/verification of `PolicyRuleEditorActionTab` behavior from step `1.259`.
- Old entrypoint now delegates to:
  - Existing `/ui/` static bundle path; no route or API entrypoint changed.
- Verification commands:
  - Stand deploy: `scp -r webui/dist/. root@132.243.237.120:/root/awg-manager/webui/dist/` after remote backup.
  - Stand `/ui/` HTML now references `/assets/index-B8YhwzbT.js`.
  - Stand health: `GET /health` with API key — `{"ok": true, "service": "awg_manager", "auth": "api_key"}`.
  - Browser live smoke — bridge Action tab `ct_expectation` hint matched expected visibility.
  - Temporary QA table cleanup — delete call returned HTTP 200.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 24 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 47 passed (defensive run in dirty workspace).
  - `python3 -m pytest -q tests` — 294 passed.
- Result summary:
  - The live firewall stand now serves the bridge `ct_expectation` hint UI bundle and the checked Policy context matches the intended behavior.

## 1.261) Firewall backend tests: dynamic set statement family guard

- Step scope:
  - Strengthened A4 backend coverage for the existing dynamic set statement runtime-safe scope.
  - `tests/test_firewall_rule_ops.py` now verifies that `set_stmt_*` payloads are rejected not only for `bridge`, but also for custom `ip`, `ip6`, and `netdev` families.
  - This preserves the agreed first scope: dynamic set statements are runtime-safe only for `family=inet` addr/port sets.
  - No backend behavior, API payload shape, Policy layout, stand deployment, runtime-only collection behavior, or IPsec code changed.
- Ownership moved:
  - No ownership moved in this step; this is test coverage for existing `rule_normalization_service_ops.normalize_firewall_rule` / `rule_ops.normalize_dynamic_set_statement_fields` behavior.
- Old entrypoint now delegates to:
  - Existing firewall rule create/update normalization path; no new route or API entrypoint was introduced.
- Verification commands:
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py -k dynamic_set` — 2 passed, 22 deselected.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 24 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 47 passed (defensive run in dirty workspace).
  - `python3 -m pytest -q tests` — 294 passed.
- Result summary:
  - Dynamic set statement family restrictions are now explicitly covered for `ip/ip6/bridge/netdev`, matching the documented runtime-safe `inet`-only scope.

## 1.262) Firewall backend tests: rule-level vmap statement family guard

- Step scope:
  - Strengthened A4 backend coverage for the existing rule-level `vmap` statement runtime-safe scope.
  - `tests/test_firewall_rule_ops.py` now verifies that `vmap_stmt_*` payloads are rejected not only for `bridge`, but also for custom `ip`, `ip6`, and `netdev` families.
  - This preserves the agreed first scope: named `vmap` rule statements are runtime-safe only for `family=inet` + `meta l4proto`.
  - No backend behavior, API payload shape, Policy layout, stand deployment, runtime-only collection behavior, or IPsec code changed.
- Ownership moved:
  - No ownership moved in this step; this is test coverage for existing `rule_normalization_service_ops.normalize_firewall_rule` / `rule_ops.normalize_vmap_statement_fields` behavior.
- Old entrypoint now delegates to:
  - Existing firewall rule create/update normalization path; no new route or API entrypoint was introduced.
- Verification commands:
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py -k vmap` — 2 passed, 22 deselected.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 24 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 47 passed (defensive run in dirty workspace).
  - `python3 -m pytest -q tests` — 294 passed.
- Result summary:
  - Rule-level `vmap` statement family restrictions are now explicitly covered for `ip/ip6/bridge/netdev`, matching the documented runtime-safe `inet`-only scope.

## 1.263) Firewall backend tests: B1 custom table/chain operations coverage

- Step scope:
  - Started B1 coverage with the lowest-risk table/chain add/create path.
  - `tests/test_firewall_store.py` now explicitly verifies valid `netdev` custom chain normalization (`filter`, `hook=ingress`, required `device`, non-default `policy`, string boolean `enabled`).
  - `tests/test_firewall_store.py` now explicitly verifies `bridge` custom chain normalization and guardrails: `bridge` remains `filter`-only, `ingress` is not supported in this manager, and `device` is rejected outside `ingress`.
  - `tests/test_firewall_store.py` now verifies that `store.collect_table_defs` preserves custom `device` and `policy` in runtime chain definitions for `netdev` and `bridge`.
  - No production backend behavior, API payload shape, Policy layout, stand deployment, runtime state, or IPsec code changed.
- Ownership moved:
  - No ownership moved in this step; this is B1 backend test coverage for existing `store.normalize_firewall_table_item` and `store.collect_table_defs` behavior.
- Old entrypoint now delegates to:
  - Existing firewall table builder/upsert/list runtime paths; no route, API contract, or facade entrypoint changed.
- Verification commands:
  - `python3 -m pytest -q tests/test_firewall_store.py -k 'table_defs or firewall_table_item'` — 5 passed, 24 deselected.
  - `python3 -m pytest -q tests/test_firewall_store.py` — 29 passed.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 24 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests` — 296 passed.
- Result summary:
  - The custom table/chain part of B1 now has direct backend assertions for the bridge/netdev constraints that make the unified Policy model safe.

## 1.264) Firewall backend tests: B1 table delete coverage

- Step scope:
  - Continued B1 coverage on the table delete path.
  - `tests/test_firewall_table_ops.py` now verifies that deleting a custom table removes the table row and applies rules while skipping `objects` store writes when there are no related named objects for the deleted `family/table`.
  - Existing related-object cleanup and missing-id behavior remain covered in the same table ops suite.
  - No production backend behavior, API payload shape, Policy layout, stand deployment, runtime state, or IPsec code changed.
- Ownership moved:
  - No ownership moved in this step; this is B1 backend test coverage for existing `table_ops.delete_table` behavior.
- Old entrypoint now delegates to:
  - Existing firewall table delete service path; no route, API contract, or facade entrypoint changed.
- Verification commands:
  - `python3 -m pytest -q tests/test_firewall_table_ops.py` — 5 passed.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 24 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests` — 297 passed.
- Result summary:
  - The table delete part of B1 now has explicit coverage for the no-op object cleanup branch, preventing accidental extra writes to object state.

## 1.265) Firewall backend tests: B1 rule create rollback coverage

- Step scope:
  - Continued B1 coverage on the rule create/add path.
  - `tests/test_firewall_rule_ops.py` now verifies that `rule_ops.create_rule` rolls back the rules store to the previous state if `apply_rules_fn` fails after writing a newly-created rule.
  - Existing rule create idempotence and update/delete rollback behavior remain covered in the same rule ops suite.
  - No production backend behavior, API payload shape, Policy layout, stand deployment, runtime state, or IPsec code changed.
- Ownership moved:
  - No ownership moved in this step; this is B1 backend test coverage for existing `rule_ops.create_rule` behavior.
- Old entrypoint now delegates to:
  - Existing firewall rule create service path; no route, API contract, or facade entrypoint changed.
- Verification commands:
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py -k 'create_rule'` — 2 passed, 23 deselected.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 25 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests` — 298 passed.
- Result summary:
  - The rule add/create part of B1 now has explicit rollback coverage, matching the already-covered update/delete rollback behavior.

## 1.266) Firewall backend: B1 rule reorder rollback

- Step scope:
  - Continued B1 on the rule ordering path.
  - Added a RED test in `tests/test_firewall_rule_ops.py` proving that `rule_ops.reorder_rules` changed stored rule order if `apply_rules_fn` failed after writing the reordered list.
  - Fixed `rule_ops.reorder_rules` to roll back to the previous rules store state on apply failure, matching existing create/update/delete rollback behavior.
  - Wire/API shape, route names, response schema, Policy UI, stand deployment, runtime state, and IPsec code were not changed.
- Ownership moved:
  - No ownership moved in this step; this is a small backend behavior hardening inside existing `rule_ops.reorder_rules` ownership.
- Old entrypoint now delegates to:
  - Existing firewall rule reorder service path; no route, API contract, or facade entrypoint changed.
- Verification commands:
  - RED: `python3 -m pytest -q tests/test_firewall_rule_ops.py -k 'reorder_rules_rolls_back'` — failed as expected because order stayed `r3,r1,r2` after apply failure.
  - GREEN: `python3 -m pytest -q tests/test_firewall_rule_ops.py -k 'reorder_rules'` — 2 passed, 24 deselected.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 26 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests` — 299 passed.
- Result summary:
  - Rule reorder now has the same rollback safety as rule create/update/delete when runtime apply fails.

## 1.267) Firewall backend tests: B1 custom table reset counters coverage

- Step scope:
  - Continued B1 on the reset counters path.
  - `tests/test_firewall_runtime_ops.py` now verifies single custom `inet` table reset: stats are cleared only for rules in the selected custom table, runtime partial reapply deletes/re-adds that custom table, and full `apply_rules_fn` is not called.
  - No production backend behavior, API payload shape, Policy layout, stand deployment, runtime state, or IPsec code changed.
- Ownership moved:
  - No ownership moved in this step; this is B1 backend test coverage for existing `runtime_ops.reset_counters` behavior.
- Old entrypoint now delegates to:
  - Existing firewall reset counters service path; no route, API contract, or facade entrypoint changed.
- Verification commands:
  - `python3 -m pytest -q tests/test_firewall_runtime_ops.py -k 'reset_counters'` — 4 passed, 1 deselected.
  - `python3 -m pytest -q tests/test_firewall_runtime_ops.py` — 5 passed.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 26 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests` — 300 passed.
- Result summary:
  - Reset counters coverage now includes the custom `inet` table partial reapply path, not only built-in tables and full reset.

## 1.268) Firewall backend tests: B1 named-object delete rollback coverage

- Step scope:
  - Continued B1 on the named object delete path.
  - `tests/test_firewall_named_object_ops.py` now verifies that `named_object_ops.delete_named_object` rolls back `objects` store to the previous state if `apply_rules_fn` fails after deleting an object.
  - Existing duplicate-id, in-use reference guard, create/upsert/update/delete flow, and list active/inactive table behavior remain covered in the same suite.
  - No production backend behavior, API payload shape, Policy layout, stand deployment, runtime state, or IPsec code changed.
- Ownership moved:
  - No ownership moved in this step; this is B1 backend test coverage for existing `named_object_ops.delete_named_object` behavior.
- Old entrypoint now delegates to:
  - Existing firewall named-object delete service path; no route, API contract, or facade entrypoint changed.
- Verification commands:
  - `python3 -m pytest -q tests/test_firewall_named_object_ops.py -k 'delete_named_object'` — 1 passed, 9 deselected.
  - `python3 -m pytest -q tests/test_firewall_named_object_ops.py` — 10 passed.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 26 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests` — 301 passed.
- Result summary:
  - Named-object delete now has explicit rollback coverage, aligned with rule/table rollback coverage in B1.

## 1.269) Firewall backend: B1 collection delete rollback

- Step scope:
  - Continued B1 on set/map collection delete paths.
  - Added a RED test in `tests/test_firewall_collection_ops.py` proving that `collection_ops.delete_collection` removed an active collection from store if `apply_rules_fn` failed after deletion.
  - Fixed `collection_ops.delete_collection` to roll back the selected collection kind rows on apply failure, matching rule/table/object rollback behavior.
  - Wire/API shape, route names, response schema, Policy UI, stand deployment, runtime state, and IPsec code were not changed.
- Ownership moved:
  - No ownership moved in this step; this is small backend behavior hardening inside existing `collection_ops.delete_collection` ownership.
- Old entrypoint now delegates to:
  - Existing firewall set/map delete service paths; no route, API contract, or facade entrypoint changed.
- Verification commands:
  - RED: `python3 -m pytest -q tests/test_firewall_collection_ops.py -k 'delete_collection_rolls_back'` — failed as expected because deleted collection stayed removed after apply failure.
  - GREEN: `python3 -m pytest -q tests/test_firewall_collection_ops.py -k 'delete_collection'` — 2 passed, 5 deselected.
  - `python3 -m pytest -q tests/test_firewall_collection_ops.py` — 7 passed.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 26 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests` — 302 passed.
- Result summary:
  - Collection delete now has rollback safety when runtime apply fails, closing the set/map delete branch of B1.

## 1.270) Firewall backend: B1 collection upsert rollback

- Step scope:
  - Continued B1 on set/map/vmap collection upsert paths.
  - Added a RED test in `tests/test_firewall_collection_ops.py` proving that `collection_ops.upsert_collection` kept the newly-written collection row if `apply_rules_fn` failed after store write.
  - Fixed `collection_ops.upsert_collection` to roll back the selected collection kind rows on apply failure, matching rule/table/object/delete rollback behavior.
  - Wire/API shape, route names, response schema, Policy UI, stand deployment, runtime state, and IPsec code were not changed.
- Ownership moved:
  - No ownership moved in this step; this is small backend behavior hardening inside existing `collection_ops.upsert_collection` ownership.
- Old entrypoint now delegates to:
  - Existing firewall set/map/vmap upsert service paths; no route, API contract, or facade entrypoint changed.
- Verification commands:
  - RED: `python3 -m pytest -q tests/test_firewall_collection_ops.py -k upsert_collection_rolls_back_on_apply_error` — failed as expected because the updated collection row stayed in store after apply failure.
  - GREEN: `python3 -m pytest -q tests/test_firewall_collection_ops.py -k upsert_collection_rolls_back_on_apply_error` — 1 passed, 7 deselected.
  - `python3 -m pytest -q tests/test_firewall_collection_ops.py` — 8 passed.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 26 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 47 passed.
  - `python3 -m pytest -q tests` — 303 passed.
- Result summary:
  - Collection upsert now has rollback safety when runtime apply fails, closing the set/map/vmap upsert branch of B1.

## 1.271) Firewall backend: B1 collection list cleanup rollback

- Step scope:
  - Completed B1 on set/map/vmap collection list/cleanup paths.
  - Added a RED test in `tests/test_firewall_collection_ops.py` proving that `collection_ops.list_collections` left expired active rows removed from store if `apply_rules_fn` failed after auto-cleanup.
  - Fixed `collection_ops.list_collections` to roll back the selected collection kinds on apply failure after cleanup, matching collection upsert/delete rollback behavior.
  - Marked B1 complete in `docs/FIREWALL_POLICY_UNIFICATION_PLAN.ru.md`.
  - Wire/API shape, route names, response schema, Policy UI, stand deployment, runtime state, and IPsec code were not changed.
- Ownership moved:
  - No ownership moved in this step; this is small backend behavior hardening inside existing `collection_ops.list_collections` ownership.
- Old entrypoint now delegates to:
  - Existing firewall set/map/vmap list service paths; no route, API contract, or facade entrypoint changed.
- Verification commands:
  - RED: `python3 -m pytest -q tests/test_firewall_collection_ops.py -k list_collections_rolls_back_expired_cleanup_on_apply_error` — failed as expected because `addr` stayed empty after apply failure.
  - GREEN: `python3 -m pytest -q tests/test_firewall_collection_ops.py -k list_collections_rolls_back_expired_cleanup_on_apply_error` — 1 passed, 8 deselected.
  - `python3 -m pytest -q tests/test_firewall_collection_ops.py` — 9 passed.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 26 passed.
  - Initial sandbox run of `python3 -m pytest -q tests/test_api_contract.py` failed with `PermissionError: [Errno 1] Operation not permitted` on local socket bind; rerun outside sandbox is recorded below.
  - `python3 -m pytest -q tests/test_api_contract.py` outside sandbox — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 47 passed.
  - `python3 -m pytest -q tests` outside sandbox — 304 passed.
- Result summary:
  - Collection list auto-cleanup now has rollback safety when runtime apply fails, closing the remaining B1 list/cleanup branch.

## 1.272) Firewall docs: admin guide and walkthrough testplan

- Step scope:
  - Started end-user Firewall documentation as an administrator-oriented tutorial, not a developer reference.
  - Added `docs/FIREWALL_ADMIN_GUIDE.ru.md` with the current unified Policy model, built-in `filter/nat/raw/mangle`, collections, objects, NAT, bridge, netdev, advanced actions, result checks, and training tasks.
  - Added `docs/FIREWALL_ADMIN_WALKTHROUGH_TESTPLAN.ru.md` to turn the tutorial into a repeatable UI walkthrough with pass/partial/fail statuses, UX scoring, and issue templates.
  - Linked the walkthrough testplan from the admin guide.
  - Wire/API shape, route names, response schema, backend behavior, Policy UI code, stand deployment, runtime state, and IPsec code were not changed.
- Ownership moved:
  - No module ownership moved in this step; this is user-facing Firewall documentation and UX validation planning.
- Old entrypoint now delegates to:
  - No runtime entrypoint changed.
- Verification commands:
  - `rg -n "TODO|TBD|policy2|policy3|Policy2|Policy3" docs/FIREWALL_ADMIN_GUIDE.ru.md docs/FIREWALL_ADMIN_WALKTHROUGH_TESTPLAN.ru.md` — no matches.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 26 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 47 passed.
  - `python3 -m pytest -q tests` — 304 passed.
- Result summary:
  - Firewall now has a first admin tutorial draft plus a structured walkthrough plan for checking whether a user can configure the UI successfully.

## 1.273) Firewall docs/UX: walkthrough scenario A

- Step scope:
  - Ran the first admin walkthrough scenario on the stand UI: `policy -> filter -> Add HTTPS accept rule`.
  - Verified that the unified Policy page loads, shows `policy/collections/objects/table builder`, shows built-in `filter/nat/raw/mangle`, and has no page-level console errors before the scenario.
  - Created a rule `input accept tcp — 443` with anonymous counter enabled.
  - Updated `docs/FIREWALL_ADMIN_WALKTHROUGH_TESTPLAN.ru.md` with Scenario A result, UX scores, and issue notes.
  - Wire/API shape, backend behavior, UI code, runtime model, and IPsec code were not changed.
- Ownership moved:
  - No module ownership moved in this step; this is documentation plus UX validation evidence.
- Old entrypoint now delegates to:
  - No runtime entrypoint changed.
- Verification commands:
  - Browser walkthrough on `http://132.243.237.120:8787/ui/` — Scenario A passed; row `input accept tcp — 443` visible in `policy -> filter`.
  - Browser console check — no errors; one chart sizing warning recorded as `FW-UX-002`.
- Result summary:
  - The basic HTTPS allow scenario is passable by UI, but optional-field `+` controls are a discoverability issue for admins and should be improved.

## 1.274) Firewall docs/UX: walkthrough scenario B

- Step scope:
  - Ran the second admin walkthrough scenario on the stand UI: `policy -> filter -> Add SMTP drop rule`.
  - Created a rule `input drop tcp — 25`.
  - Updated `docs/FIREWALL_ADMIN_WALKTHROUGH_TESTPLAN.ru.md` with Scenario B result, UX scores, and issue notes.
  - Wire/API shape, backend behavior, UI code, runtime model, and IPsec code were not changed.
- Ownership moved:
  - No module ownership moved in this step; this is documentation plus UX validation evidence.
- Old entrypoint now delegates to:
  - No runtime entrypoint changed.
- Verification commands:
  - Browser walkthrough on `http://132.243.237.120:8787/ui/` — Scenario B passed; row `input drop tcp — 25` visible in `policy -> filter`.
  - Browser console check — no new errors; existing chart sizing warning remains recorded as `FW-UX-002`.
- Result summary:
  - The SMTP drop scenario is passable by UI, but blocking actions would benefit from a short `drop` vs `reject` safety hint.

## 1.275) Firewall docs/UX: walkthrough scenario C

- Step scope:
  - Ran the third admin walkthrough scenario on the stand UI: `policy -> nat -> Add NAT masquerade rule`.
  - Selected `chain=postrouting`, source `10.66.1.0/24`, and Action `masquerade`.
  - Observed that after save the NAT table row appeared as `postrouting accept any 10.66.1.0/24`, with no visible `masquerade` confirmation.
  - Updated `docs/FIREWALL_ADMIN_WALKTHROUGH_TESTPLAN.ru.md` with Scenario C result, UX scores, and issue notes.
  - Wire/API shape, backend behavior, UI code, runtime model, and IPsec code were not changed.
- Ownership moved:
  - No module ownership moved in this step; this is documentation plus UX validation evidence.
- Old entrypoint now delegates to:
  - No runtime entrypoint changed.
- Verification commands:
  - Browser walkthrough on `http://132.243.237.120:8787/ui/` — Scenario C failed from the admin perspective because saved row did not visibly confirm `masquerade`.
  - Browser console check — no new errors; existing chart sizing warning remains recorded as `FW-UX-002`.
- Result summary:
  - NAT masquerade needs follow-up: UI should guide `postrouting` selection and visibly show NAT action after save, otherwise the admin cannot trust the result.

## 1.276) Firewall UX: FW-UX-005 NAT action table confirmation

- Step scope:
  - Investigated `FW-UX-005` from the admin walkthrough: NAT masquerade was saved as backend-compatible `action=accept` plus `nat_type=masquerade`, but the Policy table displayed only the internal verdict.
  - Added Playwright coverage that creates a temporary `nat/postrouting` `masquerade` rule and verifies that the Policy NAT table shows `masquerade`.
  - Updated the Policy rules table and Action sorting to use a user-facing effective action label: `nat_type` for NAT statements, `vmap` for vmap statements, otherwise the stored verdict/action.
  - Rebuilt frontend dist and deployed the updated frontend assets to the stand for live verification.
  - Updated `docs/FIREWALL_ADMIN_WALKTHROUGH_TESTPLAN.ru.md`: `FW-UX-005` is fixed/verified; Scenario C is now `partial` because `FW-UX-004` chain guidance remains.
  - Wire/API shape, backend behavior, runtime renderer, and IPsec code were not changed.
- Ownership moved:
  - No backend/domain ownership moved. Frontend display responsibility for rule action labels is centralized in `webui/src/pages/firewall/policyUtils.ts`.
- Old entrypoint now delegates to:
  - No runtime/backend entrypoint changed.
- Verification commands:
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-rules.spec.ts -g "table shows nat action" --project=chromium` before fix — failed; row text contained `postroutingacceptany10.66.1.0/24`.
  - `npm run build` — passed.
  - Stand frontend dist backup created: `/root/awg-manager/webui/dist.backup.fw-ux-005-20260607075402`.
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-rules.spec.ts -g "table shows nat action" --project=chromium` after fix/deploy — 1 passed.
- Result summary:
  - NAT rows now visibly confirm the selected NAT statement (`masquerade`/`snat`/`dnat`/`redirect`) instead of showing the internal `accept` verdict.

## 1.277) Firewall UX: FW-UX-004 NAT chain/action guidance

- Step scope:
  - Closed the remaining Scenario C UX issue: NAT Add Rule did not explain which chains expose which NAT statements.
  - Added Playwright coverage that opens `policy -> nat -> Add -> Action` and verifies the chain/action hint for default `prerouting` and selected `postrouting`.
  - Added a compact Action-tab helper for supported L3 NAT contexts:
    - `prerouting/output use dnat or redirect`
    - `postrouting uses snat or masquerade`
    - unsupported NAT chain hint points users to the right chains.
  - Rebuilt frontend dist and deployed the updated frontend assets to the stand for live verification.
  - Updated `docs/FIREWALL_ADMIN_WALKTHROUGH_TESTPLAN.ru.md`: `FW-UX-004` is fixed/verified; Scenario C is now pass for the current basic NAT masquerade walkthrough.
  - Wire/API shape, backend behavior, runtime renderer, and IPsec code were not changed.
- Ownership moved:
  - No backend/domain ownership moved. The new helper text is local UI guidance inside `webui/src/pages/firewall/PolicyRuleEditorActionTab.tsx`.
- Old entrypoint now delegates to:
  - No runtime/backend entrypoint changed.
- Verification commands:
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-rules.spec.ts -g "action tab explains" --project=chromium` before fix — failed; `prerouting/output use dnat or redirect` was not visible.
  - `npm run build` — passed.
  - Stand frontend dist backup created: `/root/awg-manager/webui/dist.backup.fw-ux-004-20260607075843`.
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-rules.spec.ts -g "action tab explains" --project=chromium` after fix/deploy — 1 passed.
- Result summary:
  - The NAT masquerade walkthrough now explains the critical chain/action mapping before the user has to guess `postrouting`.

## 1.278) Firewall docs/UX: walkthrough scenario D address collection

- Step scope:
  - Ran the Scenario D walkthrough on the stand UI: `Firewall -> collections -> Add address set`.
  - Added Playwright coverage for creating an `addr` collection, confirming row contents, disabling it, enabling it again, and cleaning it up through the API.
  - Added a compact Collections modal helper that tells users how to reuse collections in rules: `Use addr collections in rule fields as @set_name.`
  - Rebuilt frontend dist and deployed the updated frontend assets to the stand for live verification.
  - Updated `docs/FIREWALL_ADMIN_WALKTHROUGH_TESTPLAN.ru.md`: Scenario D is pass.
  - Wire/API shape, backend behavior, runtime renderer, and IPsec code were not changed.
- Ownership moved:
  - No backend/domain ownership moved. The new helper text is local UI guidance inside `webui/src/pages/firewall/CollectionsModal.tsx`.
- Old entrypoint now delegates to:
  - No runtime/backend entrypoint changed.
- Verification commands:
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-maps.spec.ts -g "add address set" --project=chromium` before helper — failed because the `@set_name` usage hint was not visible.
  - Direct API check on stand for `addr` create/disable/enable — passed.
  - `npm run build` — passed.
  - Stand frontend dist backup created: `/root/awg-manager/webui/dist.backup.scenario-d-collections-20260607152200`.
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-maps.spec.ts -g "add address set" --project=chromium` after fix/deploy — 1 passed.
- Result summary:
  - Address collection creation and enable/disable are passable from the UI, and the modal now explains the important `@set_name` reuse pattern.

## 1.279) Firewall docs/UX: walkthrough scenario E named counter object

- Step scope:
  - Ran the Scenario E walkthrough on the stand UI: create a named counter object, bind it in Add Rule statistics, verify `counter_name`, and exercise `Reset counters`.
  - Added Playwright coverage for `objects -> inet/filter -> Add counter object -> policy/filter Add Rule -> Statistics counter object`.
  - Fixed the Object table selector so built-in `inet` tables (`filter`, `nat`, `raw`, `mangle`) are available alongside custom tables.
  - Rebuilt frontend dist and deployed the updated frontend assets to the stand for live verification.
  - Updated `docs/FIREWALL_ADMIN_WALKTHROUGH_TESTPLAN.ru.md`: Scenario E is pass.
  - Wire/API shape, backend behavior, runtime renderer, and IPsec code were not changed.
- Ownership moved:
  - No backend/domain ownership moved. Object table selector ownership remains in `webui/src/pages/firewall.tsx`; it now includes built-in `inet` table options in addition to custom table options.
- Old entrypoint now delegates to:
  - No runtime/backend entrypoint changed.
- Verification commands:
  - Direct API check on stand for `inet/filter` counter object create/list/delete — passed.
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-rules.spec.ts -g "named counter" --project=chromium` before fix — failed because `inet:filter` was missing from Object table selector.
  - `npm run build` — passed.
  - Stand frontend dist backup created: `/root/awg-manager/webui/dist.backup.scenario-e-counter-20260607153112`.
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-rules.spec.ts -g "named counter" --project=chromium` after fix/deploy — 1 passed.
- Result summary:
  - Named counter objects are now reachable for built-in `inet/filter` from the visible Objects UI and can be selected in the unified Add Rule Statistics tab.

## 1.280) Firewall docs/UX: walkthrough scenario F bridge rule

- Step scope:
  - Ran the Scenario F walkthrough path on the stand UI: select a custom `bridge` table in unified `policy`, open `Add Rule`, create a `drop` rule, and verify that NAT actions are unavailable with an explicit explanation.
  - Added Playwright coverage for the bridge walkthrough path: the test creates a temporary bridge table as setup, then uses the UI to select it, fill `Bridge input`, choose `drop`, save the rule, and verify the resulting API payload.
  - Updated `docs/FIREWALL_ADMIN_WALKTHROUGH_TESTPLAN.ru.md`: Scenario F is pass, including UX scores and result notes.
  - Wire/API shape, backend behavior, runtime renderer, production UI code, and IPsec code were not changed.
- Ownership moved:
  - No module ownership moved in this step; this is e2e coverage plus documentation evidence.
- Old entrypoint now delegates to:
  - No runtime/backend entrypoint changed.
- Verification commands:
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-policy-v2-bridge.spec.ts -g "bridge walkthrough" --project=chromium` — 1 passed.
- Result summary:
  - Unified Policy already supports the basic custom bridge rule scenario: bridge-specific fields are visible, `drop` saves correctly, and NAT actions are hidden with a why-disabled message.

## 1.281) Firewall docs/UX: walkthrough scenario G netdev ingress rule

- Step scope:
  - Ran the Scenario G walkthrough path on the stand UI: select a custom `netdev` table in unified `policy`, open `Add Rule`, create `tcp dport=23 drop`, and verify netdev-only action/object constraints.
  - Added Playwright coverage for the netdev walkthrough path: the test creates a temporary `netdev` ingress table as setup, then uses the UI to select it, fill protocol/port, confirm `fwd` availability, confirm named-object bindings are disabled with an explanation, save the rule, and verify the resulting API payload.
  - Updated `docs/FIREWALL_ADMIN_WALKTHROUGH_TESTPLAN.ru.md`: Scenario G is pass, including UX scores and result notes.
  - Wire/API shape, backend behavior, runtime renderer, production UI code, and IPsec code were not changed.
- Ownership moved:
  - No module ownership moved in this step; this is e2e coverage plus documentation evidence.
- Old entrypoint now delegates to:
  - No runtime/backend entrypoint changed.
- Verification commands:
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-policy-v3-netdev.spec.ts -g "netdev walkthrough" --project=chromium` — 1 passed.
- Result summary:
  - Unified Policy already supports the basic custom netdev ingress rule scenario: `tcp dport=23 drop` saves correctly, `fwd` is exposed only in netdev context, and named-object bindings are hidden with a why-disabled message.

## 1.282) Firewall docs/UX: walkthrough scenario H why-disabled hints

- Step scope:
  - Ran the Scenario H walkthrough path on the stand UI: verify why-disabled guidance for bridge/netdev NAT actions, `inet`-only dynamic set/verdict map controls, bridge `ct_expectation`, and netdev named-object bindings.
  - Added a focused Playwright smoke spec `tests/firewall-why-disabled-hints.spec.ts` that creates temporary `bridge` and `netdev` tables as setup, checks Add Rule Action-tab hints, and checks netdev Objects modal `ct_expectation` disabled state.
  - Updated `docs/FIREWALL_ADMIN_WALKTHROUGH_TESTPLAN.ru.md`: Scenario H is pass, including UX scores and result notes.
  - Wire/API shape, backend behavior, runtime renderer, production UI code, and IPsec code were not changed.
- Ownership moved:
  - No module ownership moved in this step; this is e2e coverage plus documentation evidence.
- Old entrypoint now delegates to:
  - No runtime/backend entrypoint changed.
- Verification commands:
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-why-disabled-hints.spec.ts --project=chromium` — 1 passed.
- Result summary:
  - The current unified Firewall UI explains the checked unsupported paths before save: bridge/netdev NAT, non-`inet` dynamic set/vmap, bridge `ct_expectation`, and netdev object bindings.

## 1.283) Firewall UX: netdev table builder device/egress guidance

- Step scope:
  - Closed the remaining walkthrough follow-up around `table builder` clarity for `family=netdev`.
  - Added Playwright coverage that opens `table builder -> Add Table Chain`, selects `family=netdev`, and verifies visible guidance for `filter/ingress`, required `device`, and disabled `egress` on the current runtime profile.
  - Added compact help text to the existing `TableBuilderModal`; backend validation, API payload shape, and runtime behavior were not changed.
  - Rebuilt frontend dist and deployed the updated UI bundle to the stand.
  - Updated `docs/FIREWALL_ADMIN_WALKTHROUGH_TESTPLAN.ru.md` with fixed/verified follow-up notes for Scenario G/H.
  - Wire/API shape, backend behavior, runtime renderer, and IPsec code were not changed.
- Ownership moved:
  - No backend/domain ownership moved. The new help text is local UI guidance owned by `webui/src/pages/firewall/TableBuilderModal.tsx`.
- Old entrypoint now delegates to:
  - No runtime/backend entrypoint changed.
- Verification commands:
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-tables.spec.ts -g "netdev table builder explains" --project=chromium` before fix — failed because the explicit netdev guidance was not visible.
  - `npm run build` — passed (`index-C5RbvpBd.js`).
  - Stand frontend dist backup created: `/root/awg-manager/webui/dist.backup.table-builder-netdev-help-20260607161404`.
  - Stand UI restarted on public bind `0.0.0.0:8787` after correcting a temporary localhost-only manual start.
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-tables.spec.ts -g "netdev table builder explains" --project=chromium` after fix/deploy — 1 passed.
- Result summary:
  - Netdev table creation now explains the important runtime-safe model before save: only `filter/ingress`, one required device, and no `egress` on the current stand profile.

## 1.284) Firewall roadmap: flowtable backend-first design

- Step scope:
  - Added `docs/FIREWALL_FLOWTABLE_DESIGN.ru.md` as the backend-first design for nftables flowtables.
  - Captured the intended model as a first-class firewall resource for `inet/ip/ip6`, plus optional rule statement `flow add @name`.
  - Documented safety invariants, proposed non-breaking API shape, optional rule payload fields, renderer ordering, backend implementation order, UI placement, open decisions, and non-goals.
  - Updated `docs/FIREWALL_CAPABILITY_MATRIX.ru.md`: flowtables and `flow add @flowtable` are now `planned/design documented`, with the next step set to backend store/domain tests before API/UI exposure.
  - Updated `docs/FIREWALL_ADMIN_GUIDE.ru.md` to keep flowtables out of the current user tutorial while linking the design document.
  - Wire/API shape, backend behavior, runtime renderer, production UI code, and IPsec code were not changed.
- Ownership moved:
  - No module ownership moved in this step; this is roadmap/design documentation only.
- Old entrypoint now delegates to:
  - No runtime/backend entrypoint changed.
- Verification commands:
  - `rg -n "flowtable|flow add" docs/FIREWALL_FLOWTABLE_DESIGN.ru.md docs/FIREWALL_CAPABILITY_MATRIX.ru.md docs/FIREWALL_ADMIN_GUIDE.ru.md` — design links and roadmap status present.
- Result summary:
  - The next large nftables capability now has an explicit backend-first plan, so implementation can proceed safely without squeezing flowtables into the existing rule/action model prematurely.

## 1.285) Firewall docs/UX: advanced walkthrough scenarios I-O

- Step scope:
  - Returned the firewall workstream to the admin-instruction plan after the flowtable design detour.
  - Extended `docs/FIREWALL_ADMIN_GUIDE.ru.md` with second-level advanced scenarios:
    - I. `raw` table: `notrack` / `nftrace`
    - J. `mangle`: packet mark / conntrack mark
    - K. named `limit` / `quota` object
    - L. `ct_helper` / `ct_timeout` / `ct_expectation`
    - M. dynamic set statement
    - N. verdict map statement
    - O. advanced fields inventory sanity check
  - Added the same I-O queue to `docs/FIREWALL_ADMIN_WALKTHROUGH_TESTPLAN.ru.md` with initial `not run` status, so the next work is stand walkthrough evidence rather than speculative UI changes.
  - Kept the operating rule explicit: pass what already works, file/fix only real UX gaps, and avoid widening wire/API or behavior during walkthrough.
  - Wire/API shape, backend behavior, runtime renderer, frontend behavior, and IPsec code were not changed.
- Ownership moved:
  - No module ownership moved in this step; this is user-facing firewall documentation and walkthrough planning only.
- Old entrypoint now delegates to:
  - No runtime/backend entrypoint changed.
- Verification commands:
  - `rg -n "Advanced сценарии второго уровня|Сценарий I|Сценарий J|Сценарий K|Сценарий L|Сценарий M|Сценарий N|Сценарий O|notrack|nftrace|ct expectation|Dynamic set statement|Verdict map statement" docs/FIREWALL_ADMIN_GUIDE.ru.md docs/FIREWALL_ADMIN_WALKTHROUGH_TESTPLAN.ru.md` — scenario queue present in both docs.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 26 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests` — 304 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 47 passed.
- Result summary:
  - Advanced firewall validation now has a concrete scenario queue after A-H, with Scenario I (`raw`: `notrack` / `nftrace`) as the next live stand walkthrough candidate.

## 1.286) Firewall docs/UX: walkthrough scenario I raw notrack/nftrace

- Step scope:
  - Ran the Scenario I walkthrough path on the stand UI: `policy -> raw -> Add -> Advanced match`, enable `nftrace` and `notrack`, save the rule, and verify the returned API payload.
  - Added focused Playwright coverage in `webui/tests/firewall-rules.spec.ts` for the user path:
    - verify `filter` context shows `nftrace (raw table only)` and `notrack (raw table only)`;
    - create a raw rule through the UI with `nftrace=true` and `notrack=true`;
    - verify the saved rule remains in table `raw`;
    - clean up the temporary rule.
  - Investigated the first e2e timeout: raw rule save worked, but the test immediately opened a second Add modal while the page was still in post-save busy/refresh state. The test order was corrected; no product UX gap was recorded for Scenario I.
  - Updated `docs/FIREWALL_ADMIN_WALKTHROUGH_TESTPLAN.ru.md`: Scenario I is pass, including scores and result notes.
  - Wire/API shape, backend behavior, runtime renderer, production UI behavior, and IPsec code were not changed.
- Ownership moved:
  - No module ownership moved in this step; this is e2e coverage plus documentation evidence.
- Old entrypoint now delegates to:
  - No runtime/backend entrypoint changed.
- Verification commands:
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-rules.spec.ts -g "walkthrough I" --project=chromium` — first run timed out because of test ordering during post-save busy/refresh state.
  - Stand cleanup API for leftover `walkthrough-i-raw-*` rule — HTTP 200.
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-rules.spec.ts -g "walkthrough I" --project=chromium` after test-order correction — 1 passed.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 26 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests` — 304 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 47 passed.
- Result summary:
  - The raw `notrack`/`nftrace` scenario is passable from the unified Policy UI, and raw-only controls are explained outside `raw` before save.

## 1.287) Firewall docs/UX: walkthrough scenario J mangle mark/ct mark

- Step scope:
  - Ran the Scenario J walkthrough path on the stand UI: `policy -> mangle -> Add -> Action`, enable `meta mark set` and `ct mark set`, save the rule, and verify the returned API payload.
  - Added focused Playwright coverage in `webui/tests/firewall-rules.spec.ts` for the user path:
    - select built-in `mangle`;
    - create a `forward` rule through the UI with `mark_set=0x10` and `ct_mark_set=0x20`;
    - verify the saved rule remains in table `mangle`;
    - clean up the temporary rule.
  - Updated `docs/FIREWALL_ADMIN_WALKTHROUGH_TESTPLAN.ru.md`: Scenario J is pass, including scores and result notes.
  - Wire/API shape, backend behavior, runtime renderer, production UI behavior, and IPsec code were not changed.
- Ownership moved:
  - No module ownership moved in this step; this is e2e coverage plus documentation evidence.
- Old entrypoint now delegates to:
  - No runtime/backend entrypoint changed.
- Verification commands:
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-rules.spec.ts -g "walkthrough J" --project=chromium` — 1 passed.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 26 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests` — 304 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 47 passed.
- Result summary:
  - The mangle packet mark / conntrack mark scenario is passable from the unified Policy UI; mark setters save through the visible Action tab and persist with the expected payload fields.

## 1.288) Firewall docs/UX: walkthrough scenario K named limit/quota objects

- Step scope:
  - Ran the Scenario K walkthrough path on the stand UI: create named `limit` and `quota` objects in `objects -> inet/filter`, then bind both in `policy -> filter -> Add -> Action`.
  - Added focused Playwright coverage in `webui/tests/firewall-rules.spec.ts` for the user path:
    - create a `limit` object through the visible Objects modal;
    - create a `quota` object through the visible Objects modal;
    - create a filter rule through the visible Add Rule form;
    - select both named objects in `limit object` and `quota object`;
    - verify the saved rule has `limit_name` and `quota_name`;
    - clean up the temporary rule and objects.
  - Updated `docs/FIREWALL_ADMIN_WALKTHROUGH_TESTPLAN.ru.md`: Scenario K is pass, including scores and result notes.
  - Wire/API shape, backend behavior, runtime renderer, production UI behavior, and IPsec code were not changed.
- Ownership moved:
  - No module ownership moved in this step; this is e2e coverage plus documentation evidence.
- Old entrypoint now delegates to:
  - No runtime/backend entrypoint changed.
- Verification commands:
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-rules.spec.ts -g "walkthrough K" --project=chromium` — 1 passed.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 26 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests` — 304 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 47 passed.
- Result summary:
  - The named limit/quota object scenario is passable from the unified Firewall UI: table-scoped objects can be created in `objects` and selected in the existing Add Rule form for `inet/filter`.

## 1.289) Firewall docs/UX: walkthrough scenario L ct object bindings

- Step scope:
  - Attempted the Scenario L walkthrough path on the stand UI for `ct_helper`, `ct_timeout`, and `ct_expectation` objects.
  - Confirmed backend/API capability on the stand:
    - direct `ct_expectation` create for `inet/filter` returned HTTP 201;
    - temporary `ct_helper`, `ct_timeout`, and `ct_expectation` objects were created and later deleted successfully.
  - Found a real UX/performance blocker: object list/refresh latency can block the UI path for tens of seconds.
    - measured `GET /firewall/objects?family=inet&table=filter` around 24s on one probe;
    - repeated probe measured around 56s for the first list, then around 154ms/145ms for subsequent lists.
  - Updated `docs/FIREWALL_ADMIN_WALKTHROUGH_TESTPLAN.ru.md`: Scenario L is `partial`, and `FW-UX-006` records the blocking object refresh/list issue.
  - Added a focused Scenario L e2e draft in `webui/tests/firewall-rules.spec.ts`, but marked it skipped until `FW-UX-006` is fixed because the current stand UI path times out even with a 120s test timeout.
  - Wire/API shape, backend behavior, runtime renderer, production UI behavior, and IPsec code were not changed.
- Ownership moved:
  - No module ownership moved in this step; this is e2e evidence plus documentation of a UX/performance blocker.
- Old entrypoint now delegates to:
  - No runtime/backend entrypoint changed.
- Verification commands:
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-rules.spec.ts -g "walkthrough L" --project=chromium` — failed on object modal remaining busy after `ct_expectation` save while the object was actually created.
  - Direct API probe for `ct_expectation` create/delete on the stand — HTTP 201 create, HTTP 200 delete.
  - Latency probe for `/firewall/objects?family=inet&table=filter` — first list around 56s, subsequent lists around 154ms/145ms.
  - Stand cleanup for temporary `walkthrough-l-ct-*` rules/objects — HTTP 200 deletes.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 26 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests` — 304 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 47 passed.
- Result summary:
  - Scenario L is not safe to mark pass yet: ct object backend support exists, but the visible UI walkthrough has a real blocking refresh/list latency gap (`FW-UX-006`).

## 1.290) Firewall UX: close FW-UX-006 object save blocking refresh

- Step scope:
  - Fixed the visible Scenario L blocker in the frontend object save flow.
  - `webui/src/pages/firewall/useFirewallObjectActions.ts` now closes the object modal after successful `upsertFirewallObject`, then refreshes the object list in the background and surfaces refresh errors through the existing error state.
  - Re-enabled the Scenario L Playwright walkthrough in `webui/tests/firewall-rules.spec.ts` and stabilized its Protocol selector so the test targets the actual second combobox in the Add Rule modal.
  - Updated `docs/FIREWALL_ADMIN_WALKTHROUGH_TESTPLAN.ru.md`: Scenario L is now `pass`, and `FW-UX-006` is marked fixed/verified.
  - Wire/API shape, backend behavior, runtime renderer, and IPsec code were not changed.
- Ownership moved:
  - No module ownership moved in this step; this is a frontend UX flow fix plus e2e/documentation evidence.
- Old entrypoint now delegates to:
  - No runtime/backend entrypoint changed.
- Verification commands:
  - `npm run build` in `webui` — passed.
  - Deployed `webui/dist` to `root@132.243.237.120:/root/awg-manager/webui/dist/` for stand validation.
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-rules.spec.ts -g "walkthrough L" --project=chromium` — first rerun reproduced timeout around Protocol selector while confirming the page reached Add Rule; debug run identified the stale `label:has-text('Protocol')` selector.
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-rules.spec.ts -g "walkthrough L" --project=chromium` after selector stabilization — 1 passed in 24.4s.
- Result summary:
  - Scenario L is now passable from the unified Firewall UI: ct helper, ct timeout, and ct expectation objects can be bound through the existing Add Rule form.
  - `/firewall/objects?family=inet&table=filter` cold-list latency remains a future performance candidate, but it no longer blocks closing object save flow for this walkthrough.

## 1.291) Firewall docs/UX: walkthrough scenario M dynamic set statement

- Step scope:
  - Ran the Scenario M walkthrough coverage on the stand for guarded `inet` dynamic set statements.
  - Confirmed the existing Add Rule Action tab can save a rule with `set_stmt_op=add`, `set_stmt_name`, `set_stmt_expr=ip saddr`, and `set_stmt_timeout=10s`.
  - Updated `docs/FIREWALL_ADMIN_WALKTHROUGH_TESTPLAN.ru.md`: Scenario M is now `pass`, including scores and result notes.
  - Wire/API shape, backend behavior, runtime renderer, production UI behavior, and IPsec code were not changed.
- Ownership moved:
  - No module ownership moved in this step; this is walkthrough validation plus documentation evidence.
- Old entrypoint now delegates to:
  - No runtime/backend entrypoint changed.
- Verification commands:
  - `curl -I --max-time 10 http://132.243.237.120:8787/ui/` — stand responded; HTTP HEAD is unsupported by the simple server, but service was reachable.
  - `ssh root@132.243.237.120 'hostname; ss -ltnp | grep 8787 || true; ps -ef | grep -E "api_core|awg-manager" | grep -v grep || true'` — confirmed `api_core.py` listening on `0.0.0.0:8787`.
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-rules.spec.ts -g "dynamic set statement" --project=chromium` — first attempt hit a transient connect timeout.
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-rules.spec.ts -g "dynamic set statement" --project=chromium` — repeated attempt passed in 17.9s.
- Result summary:
  - Scenario M is passable from the unified Firewall UI for the agreed runtime-safe `inet` addr/port scope.
  - No new UX gap was filed; manual walkthrough can later decide whether dynamic set creation needs extra helper text for `dynamic=true`/`size`/`timeout`.

## 1.292) Firewall docs/UX: walkthrough scenario N verdict map statement

- Step scope:
  - Ran the Scenario N walkthrough coverage on the stand for guarded named `vmap` statements.
  - Confirmed the existing Add Rule Action tab can save a rule with `vmap_stmt_name` and `vmap_stmt_expr=meta l4proto`, using a protocol-key `vmap` collection (`tcp:accept`, `udp:drop`, `icmp:return`).
  - Updated `docs/FIREWALL_ADMIN_WALKTHROUGH_TESTPLAN.ru.md`: Scenario N is now `pass`, including scores and result notes.
  - Wire/API shape, backend behavior, runtime renderer, production UI behavior, and IPsec code were not changed.
- Ownership moved:
  - No module ownership moved in this step; this is walkthrough validation plus documentation evidence.
- Old entrypoint now delegates to:
  - No runtime/backend entrypoint changed.
- Verification commands:
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-rules.spec.ts -g "verdict map" --project=chromium` — 1 passed in 19.5s.
- Result summary:
  - Scenario N is passable from the unified Firewall UI for the agreed runtime-safe `inet` protocol-to-verdict scope.
  - No new UX gap was filed; manual walkthrough can later decide whether Collections needs extra `map` vs `vmap` helper text.

## 1.293) Firewall docs/UX: walkthrough scenario O advanced inventory sanity

- Step scope:
  - Ran the Scenario O advanced Add Rule inventory checks on the stand.
  - Verified built-in contexts (`filter`, `nat`, `raw`, `mangle`), custom `ip/ip6`, custom `bridge`, custom `netdev`, and why-disabled hints for unsupported advanced controls.
  - Adjusted one Playwright assertion in `webui/tests/firewall-policy-v2-bridge.spec.ts` to check absence of the exact `ct expectation object` field label instead of matching the text inside the visible why-disabled hint.
  - Updated `docs/FIREWALL_ADMIN_WALKTHROUGH_TESTPLAN.ru.md`: Scenario O is now `pass`, and the A-O walkthrough queue is fully covered.
  - Wire/API shape, backend behavior, runtime renderer, production UI behavior, and IPsec code were not changed.
- Ownership moved:
  - No module ownership moved in this step; this is walkthrough validation plus test/doc alignment.
- Old entrypoint now delegates to:
  - No runtime/backend entrypoint changed.
- Verification commands:
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-add-rule-fields-completeness.spec.ts --project=chromium` — initial parallel run had one transient login timeout; 2 passed, 1 failed at login `Checking...`.
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-add-rule-fields-completeness.spec.ts --project=chromium --workers=1` — 3 passed.
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-rules.spec.ts -g "action choices|raw/mangle|base fields" --project=chromium --workers=1` — 3 passed.
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-policy-v2-bridge.spec.ts tests/firewall-policy-v3-netdev.spec.ts -g "action choices|base fields" --project=chromium --workers=1` — first run had 5 passed and 2 failures: stale bridge substring assertion, and netdev table selector timeout.
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-policy-v2-bridge.spec.ts tests/firewall-policy-v3-netdev.spec.ts -g "Add Rule action choices" --project=chromium --workers=1` after test assertion alignment — 2 passed.
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-why-disabled-hints.spec.ts --project=chromium --workers=1` — 1 passed.
- Result summary:
  - Scenario O did not uncover a new product UX gap: context-specific Add Rule fields and why-disabled hints match the intended firewall model.
  - Remaining low-priority manual-review topics are explanatory copy only, not functional blockers.

## 1.294) Firewall docs: admin guide verified status after A-O walkthrough

- Step scope:
  - Updated `docs/FIREWALL_ADMIN_GUIDE.ru.md` with a concise verified-status section after the A-O walkthrough queue was completed on the stand.
  - The guide now separates already verified UI paths from low-priority UX polish and roadmap-only topics.
  - Linked the user-facing route back to the walkthrough testplan, capability matrix, and flowtable design context.
  - Wire/API shape, backend behavior, frontend runtime behavior, and IPsec code were not changed.
- Ownership moved:
  - No module ownership moved in this step; this is documentation consolidation after completed firewall walkthrough validation.
- Old entrypoint now delegates to:
  - No runtime/backend entrypoint changed.
- Verification commands:
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 26 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 47 passed.
  - `python3 -m pytest -q tests` — 304 passed.
- Result summary:
  - The admin guide now reflects the tested A-O scope: basic Policy, collections, objects, bridge/netdev contexts, raw/mangle, named ct/stateful objects, dynamic set statement, verdict map statement, and advanced field sanity checks.

## 1.295) Firewall docs: Add Rule field reference started

- Step scope:
  - Added `docs/FIREWALL_ADD_RULE_FIELD_REFERENCE.ru.md` as a living user-facing reference for individual Add Rule fields.
  - Documented `Source address` with clear user semantics: one IP/CIDR prefix or one target collection reference as the desired UX model.
  - Documented the current implementation caveat: IP/CIDR is already backend-validated, while `@collection` support for this field needs a separate validation/render check before being promised as production behavior.
  - Added a link from `docs/FIREWALL_ADMIN_GUIDE.ru.md` to the new field reference.
  - Wire/API shape, backend behavior, frontend runtime behavior, and IPsec code were not changed.
- Ownership moved:
  - No module ownership moved in this step; this is documentation and UX requirement capture only.
- Old entrypoint now delegates to:
  - No runtime/backend entrypoint changed.
- Verification commands:
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 26 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 47 passed.
  - `python3 -m pytest -q tests` — 304 passed.
- Result summary:
  - Add Rule field explanations now have a dedicated place to capture the practical UI language we discuss on the stand, starting with `Source address`.

## 1.296) Firewall backend: L3 address match accepts collection references

- Step scope:
  - Checked the `Source address` Add Rule field validation behind the UI placeholder `192.168.1.0/24 or @trusted_hosts`.
  - Root cause: `backend/domains/firewall/rule_ops.py::normalize_proto_and_basic_match_fields` validated `src`/`dst` only through `ipaddress.ip_network(...)`, so `@collection` references were rejected despite the UI placeholder.
  - Added failing tests first for `@trusted_hosts`/`@servers` and comma-separated invalid source values in `tests/test_firewall_rule_ops.py`.
  - Updated `rule_ops.py` so `src`/`dst` accept exactly one IP/CIDR prefix or one `@collection` reference, and reject comma/inline-list values with a user-readable validation error.
  - Updated `docs/FIREWALL_ADD_RULE_FIELD_REFERENCE.ru.md` with the new validation status and the remaining next-layer check: collection existence/type validation before runtime apply.
  - Updated module ownership docs RU/EN for `normalize_proto_and_basic_match_fields` L3 address match responsibility.
  - Wire/API shape and IPsec code were not changed.
- Ownership moved:
  - `backend/domains/firewall/rule_ops.py::normalize_proto_and_basic_match_fields` now explicitly owns L3 address match token validation for one IP/CIDR prefix or one `@collection` reference in `src`/`dst`.
- Old entrypoint now delegates to:
  - No runtime/backend entrypoint changed; existing firewall rule create/update paths continue to call the same domain normalization pipeline.
- Verification commands:
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py -k "l3_address_collection_refs or normalize_proto_and_basic_match_fields"` — 2 passed, 25 deselected.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 27 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 47 passed.
  - `python3 -m pytest -q tests` — 305 passed.
  - Stand deploy: backed up and copied `backend/domains/firewall/rule_ops.py` to `root@132.243.237.120:/root/awg-manager/backend/domains/firewall/rule_ops.py`, restarted `api_core.py` on `:8787`, `/health` returned 200.
  - Stand smoke: `POST /firewall/rules` accepted `src=@validation_src_*` with a temporary address collection, rejected `src=192.0.2.1,192.0.2.2` with HTTP 400 and `src must be one IP/CIDR prefix or one @collection reference`; temporary rule/set cleanup confirmed.
- Result summary:
  - `Source address` and `Destination address` now validate the UI-promised shape: one IP/CIDR prefix or one `@collection` reference; multi-value inline input is rejected with a clear field-specific error locally and on the stand.

## 1.297) Firewall docs: Destination address field reference

- Step scope:
  - Expanded `docs/FIREWALL_ADD_RULE_FIELD_REFERENCE.ru.md` for the `Destination address` Add Rule field.
  - Documented user-facing semantics, examples, accepted values, invalid multi-value forms, collection usage through `@servers`, current validation status, and the next UX/backend layer for collection existence/type checks.
  - Wire/API shape, backend behavior, frontend runtime behavior, and IPsec code were not changed.
- Ownership moved:
  - No module ownership moved in this step; this is field-reference documentation only.
- Old entrypoint now delegates to:
  - No runtime/backend entrypoint changed.
- Verification commands:
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 27 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 47 passed.
  - `python3 -m pytest -q tests` — 305 passed.
- Result summary:
  - `Destination address` now has the same practical user-facing field reference coverage as `Source address`: one IP/CIDR prefix or one `@collection` reference, with multi-value input routed to collections.

## 1.298) Firewall backend/UI: Protocol accepts numeric protocol IDs

- Step scope:
  - Checked the `Protocol` Add Rule field behind the UI placeholder `any / tcp / udp / icmp`.
  - Added failing tests first for numeric protocol IDs: `6`/`17` with ports, `1` without ports, invalid `256`, and `1` with port rejection.
  - Updated `backend/domains/firewall/rule_ops.py` so `proto` accepts named protocols (`tcp`/`udp`/`icmp`/`icmpv6`) and one numeric protocol ID `0..255`.
  - Kept port eligibility strict: `Source port`/`Destination port` require `tcp`, `udp`, `6`, or `17`.
  - Updated the rule renderer so numeric TCP/UDP protocol IDs still render valid transport port expressions (`tcp dport ...` / `udp dport ...`).
  - Updated the Add Rule UI field from a closed dropdown to a text input so the user can enter protocol numbers directly.
  - Updated `docs/FIREWALL_ADD_RULE_FIELD_REFERENCE.ru.md` with the `Protocol` field instructions and current numeric-ID behavior.
  - Wire/API field shape is unchanged (`proto` remains the same payload field); IPsec code was not changed.
- Ownership moved:
  - `backend/domains/firewall/rule_ops.py::validate_action_target_reject_and_proto_fields` now explicitly owns L4 protocol token validation for named protocols and numeric protocol IDs, including port eligibility.
- Old entrypoint now delegates to:
  - No runtime/backend entrypoint changed; existing firewall rule create/update paths continue to call the same domain normalization pipeline.
- Verification commands:
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py -k "numeric_protocol or validate_action_target_reject_and_proto_fields"` — 2 passed, 26 deselected.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 28 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests/test_manager_access_facade.py` — 47 passed.
  - `python3 -m pytest -q tests` — 306 passed.
  - `npm run build` in `webui/` — passed; Vite emitted the expected large-chunk warning only.
  - Stand deploy: backed up and copied `backend/domains/firewall/rule_ops.py` and `webui/dist` to `root@132.243.237.120:/root/awg-manager`, restarted `api_core.py` on `:8787`, `/health` returned 200.
  - Stand smoke: `POST /firewall/rules` accepted `proto=6` with `dport=443`; rejected `proto=1` with `dport=443` using HTTP 400 `dport requires proto tcp or udp`; rejected `proto=256` using HTTP 400 `proto must be tcp, udp, icmp, icmpv6, or numeric protocol id 0..255`; temporary rule cleanup confirmed.
- Result summary:
  - `Protocol` now supports both user-friendly names and numeric protocol IDs while preserving the same API field shape. The UI allows direct numeric entry, and backend validation keeps ports limited to TCP/UDP semantics.

## 1.299) Firewall UI: Protocol combo input suggestions

- Step scope:
  - Adjusted the Add Rule `Protocol` field UX after stand review: the field should remain writable and also expose a default list of popular protocols.
  - Updated `webui/src/pages/firewall/PolicyRuleEditorBaseTab.tsx` to use a text input with an HTML `datalist` of safe popular values: `tcp`, `udp`, `icmp`, `icmpv6`, `6`, `17`, `1`, `58`, `47`, `50`.
  - Kept GRE/ESP suggestions numeric (`47`/`50`) because backend validation currently accepts extended protocols by numeric ID, not by `gre`/`esp` name.
  - Updated `docs/FIREWALL_ADD_RULE_FIELD_REFERENCE.ru.md` so the field reference describes the combo input behavior.
  - Wire/API shape, backend behavior, and IPsec code were not changed.
- Ownership moved:
  - No module ownership moved in this step; this is frontend UX polish for the existing `proto` payload field and user documentation.
- Old entrypoint now delegates to:
  - No runtime/backend entrypoint changed.
- Verification commands:
  - `npm run build` in `webui/` — passed; Vite emitted the expected large-chunk warning only.
  - Stand deploy: backed up and copied `webui/dist` to `root@132.243.237.120:/root/awg-manager/webui/dist`; deployed `index.html` references `index-BVp_nWF9.js`, and the bundle contains `type or choose: tcp / udp / 6 / 17`.
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-policy-v3-netdev.spec.ts -g "netdev walkthrough" --project=chromium` — 1 passed on the stand.
  - `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-rules.spec.ts -g "walkthrough L" --project=chromium` — reached the created `walkthrough-l-ct-*` rule with `proto=tcp`, then hit the existing 120s scenario timeout during cleanup (`apiRequestContext.delete: Request context disposed`). This did not reproduce a Protocol input selector failure, but the long scenario remains flaky/slow.
- Result summary:
  - The `Protocol` field now supports the requested write-or-pick UX: users can type arbitrary accepted protocol IDs/names while common values are offered as dropdown suggestions. Netdev Add Rule walkthrough passed against the deployed stand.

## 1.300) Firewall UI tests: walkthrough L timeout stabilization

- Step scope:
  - Continued after the Protocol combo input rollout and investigated the failing `firewall walkthrough L` Playwright rerun.
  - Root cause from the error context: the new `Protocol` input selector worked and the rule row `walkthrough-l-ct-*` with `proto=tcp` appeared in the Policy table; the failure occurred later when the scenario hit the global 120s timeout during cleanup (`apiRequestContext.delete: Request context disposed`).
  - Increased only this long walkthrough timeout from `120_000` to `180_000` because it creates three named ct objects, saves a rule through UI, verifies API state, and then deletes the rule/objects through apply-backed API paths.
  - Product behavior, backend behavior, wire/API shape, and IPsec code were not changed.
- Ownership moved:
  - No module ownership moved; this is test stability around the existing walkthrough coverage.
- Old entrypoint now delegates to:
  - No runtime/backend entrypoint changed.
- Verification commands:
  - `npm run build` in `webui/` — passed; Vite emitted the expected large-chunk warning only.
  - `npx playwright test tests/firewall-rules.spec.ts -g "walkthrough L" --list` — listed the expected single Chromium test, confirming Playwright can parse/select the updated scenario.
  - Stand rerun/cleanup — skipped for now because both SSH and HTTP health checks to `132.243.237.120:8787` timed out from this environment.
- Result summary:
  - The long walkthrough L test no longer has the same too-tight global timeout that caused cleanup to be cut off after the Protocol input path had already succeeded. Stand cleanup and a full rerun remain pending until the stand is reachable again.

## 1.301) Firewall UI: Protocol always-visible combo input

- Step scope:
  - Adjusted the Add Rule `Protocol` field after stand/UI review: it should not be hidden behind `+`; it should be visible by default, open a short dropdown of common protocols, and still allow typing a protocol name or numeric protocol ID directly in the same control.
  - Updated `webui/src/pages/firewall/PolicyRuleEditorBaseTab.tsx` so `Protocol` is a single-token combo input (`input[list]`) with popular suggestions: `tcp`, `udp`, `icmp`, `icmpv6`, `6`, `17`, `1`, `58`, `47`, `50`.
  - Kept the payload model unchanged: empty value means `any`/no `proto` match, and non-empty value is stored in the existing `proto` field.
  - Added a small clear button that resets `proto` and dependent port fields, because ports are only valid for TCP/UDP semantics.
  - Updated Playwright selectors for the always-visible field and updated `docs/FIREWALL_ADD_RULE_FIELD_REFERENCE.ru.md` with the final field behavior.
  - Wire/API shape, backend behavior, and IPsec code were not changed in this step.
- Ownership moved:
  - No module ownership moved in this step; this is frontend UX polish and field-reference documentation for the existing firewall `proto` rule field.
- Old entrypoint now delegates to:
  - No runtime/backend entrypoint changed.
- Verification commands:
  - `npm run build` in `webui/` — passed; Vite emitted the expected large-chunk warning only.
  - Stand deploy/check — pending fresh note; previous deploy target is `root@132.243.237.120:/root/awg-manager/webui/dist`.
- Result summary:
  - The `Protocol` control now matches the agreed UX direction: one protocol only, selectable from common defaults or typed manually as a name/number; empty field remains equivalent to `any`.

## 1.302) Stand incident: nftables.conf UDP 8787 root cause

- Step scope:
  - Investigated the stand lockout/glitch after the user requested a full rule cleanup.
  - Confirmed `/etc/wg-manager/firewall_rules.json` and the saved manager backup did not contain the problematic `Allow loopback` / `Allow established/related` / `Allow SSH` / `udp dport 8787` / final `drop` rules.
  - Traced the bad runtime rules to the stand-level persisted `/etc/nftables.conf`, loaded by `nftables.service` during boot/reload before the AWG Manager API starts.
  - Root cause: `/etc/nftables.conf` allowed `udp dport 8787`, but AWG Manager UI/API listens on TCP `8787`; with the following final `drop`, external UI/API traffic was blocked.
  - Backed up and patched the stand file from `udp dport 8787 accept` to `tcp dport 8787 accept comment "Allow AWG Manager UI/API"`.
  - Runtime nft ruleset was intentionally left flushed/empty after the emergency cleanup; the corrected persisted config is ready for the next `nftables.service` reload/reboot.
  - Wire/API shape, backend behavior, frontend source behavior, and IPsec code were not changed in this step.
- Ownership moved:
  - No repository module ownership moved; this is stand/runtime incident remediation.
- Old entrypoint now delegates to:
  - No runtime/backend entrypoint changed.
- Verification commands:
  - Stand backup: `/root/firewall-cleanup-backups/nftables.conf.before-tcp8787-fix-20260609094735`.
  - `nft -c -f /etc/nftables.conf` on `132.243.237.120` — passed.
  - `nft list ruleset | wc -l` on `132.243.237.120` — `0`, confirming runtime remained flushed after cleanup.
  - `curl -H "X-API-Key: ..." http://127.0.0.1:8787/health` on the stand — `HTTP/1.0 200 OK`.
  - External `curl -H "X-API-Key: ..." http://132.243.237.120:8787/health` — `HTTP/1.0 200 OK`.
- Result summary:
  - The lockout source was not the firewall rule renderer or manager rule JSON. It was the stand's persisted system nftables config using UDP instead of TCP for port `8787` before a final `drop`. The persisted config is now corrected, while the live ruleset remains clean.

## 1.303) Stand reboot check: remove system nftables.conf

- Step scope:
  - Followed the stand strategy that AWG Manager should own firewall runtime loading instead of the system `/etc/nftables.conf` snapshot.
  - Backed up and removed `/etc/nftables.conf` on `132.243.237.120`, then rebooted the stand.
  - Verified after reboot that AWG Manager API and restore services came back up and loaded manager-owned empty/accept-policy firewall tables from manager state.
  - Wire/API shape, backend source behavior, frontend source behavior, and IPsec code were not changed in this step.
- Ownership moved:
  - No repository module ownership moved; this is stand/runtime configuration cleanup.
- Old entrypoint now delegates to:
  - No runtime/backend entrypoint changed.
- Verification commands:
  - Stand backup: `/root/firewall-cleanup-backups/nftables.conf.before-delete-20260609095631`.
  - `/etc/nftables.conf` exists check after reboot — `no`.
  - `systemctl is-active awg-manager-api.service` — `active`.
  - `systemctl is-active awg-manager-restore.service` — `active`.
  - `systemctl is-active nftables.service` — `failed` because the config file was intentionally removed while the service remains enabled.
  - `nft list ruleset | wc -l` — `85`; runtime contains empty built-in/custom manager tables with `policy accept`, no final `drop` and no `8787` rule.
  - Local `/health` on the stand — `HTTP/1.0 200 OK`.
  - External `/health` on `http://132.243.237.120:8787/health` — `HTTP/1.0 200 OK`.
  - API `/firewall` — `api_rules_count=0 active=None`.
- Result summary:
  - After deleting the system nftables config and rebooting, the stand stays reachable and the live ruleset is populated by AWG Manager restore/apply state rather than the stale system snapshot. Remaining cleanup question: disable or mask `nftables.service` to avoid a deliberately failed system unit.

## 1.304) Stand boot ownership: disable system nftables.service

- Step scope:
  - Removed the second firewall runtime owner from the stand by disabling the system `nftables.service` autostart after `/etc/nftables.conf` was removed.
  - Rebooted `132.243.237.120` and verified that AWG Manager restore/API services are the active firewall runtime loading path.
  - Confirmed the system nftables unit is no longer failed after boot: it is `disabled`, `inactive`, and not failed.
  - Wire/API shape, backend source behavior, frontend source behavior, and IPsec code were not changed in this step.
- Ownership moved:
  - No repository module ownership moved; this is stand/runtime boot ownership cleanup.
- Old entrypoint now delegates to:
  - No runtime/backend entrypoint changed.
- Verification commands:
  - Stand service status backup: `/root/firewall-cleanup-backups/nftables.service.status-before-disable-20260609100154.txt`.
  - `systemctl disable nftables.service` on `132.243.237.120` — removed `/etc/systemd/system/sysinit.target.wants/nftables.service`.
  - Reboot smoke: SSH came back up.
  - `/etc/nftables.conf` exists check after reboot — `no`.
  - `systemctl is-enabled nftables.service` — `disabled`.
  - `systemctl is-active nftables.service` — `inactive`.
  - `systemctl is-failed nftables.service` — `inactive`.
  - `systemctl is-active awg-manager-api.service` — `active`.
  - `systemctl is-active awg-manager-restore.service` — `active`.
  - `nft list ruleset | wc -l` — `85`; runtime contains manager-owned empty built-in/custom tables with `policy accept`, no stale final `drop` and no stale `8787` rule.
  - Local `/health` on the stand — `HTTP/1.0 200 OK`.
  - External `/health` on `http://132.243.237.120:8787/health` — `HTTP/1.0 200 OK`.
  - API `/firewall` — `api_rules_count=0 active=None`.
- Result summary:
  - The stand now has a single firewall runtime owner at boot: AWG Manager restore/apply. The stale system nftables loader is disabled and no longer creates a failed unit or loads old rules before the app.

## 1.305) Firewall UI: Protocol custom editable combobox

- Step scope:
  - Replaced the native browser `datalist` Protocol control after stand/UI review because it rendered a visually inconsistent native dropdown arrow and popup.
  - Implemented a small custom editable combobox in `webui/src/pages/firewall/PolicyRuleEditorBaseTab.tsx`: a normal text input, a styled chevron button, a clear button when a value is set, and a Tailwind-styled listbox of popular protocol suggestions.
  - Kept the same rule payload field: empty input means `any`; typed or selected values still populate `proto` as a single token.
  - Updated the field reference and Playwright selector to the shorter placeholder `any (tcp, udp, 6, 17)`.
  - Wire/API shape, backend behavior, and IPsec code were not changed in this step.
- Ownership moved:
  - No module ownership moved; this is frontend UX polish for the existing firewall `proto` rule field.
- Old entrypoint now delegates to:
  - No runtime/backend entrypoint changed.
- Verification commands:
  - `npm run build` in `webui/` — passed; Vite emitted the expected large-chunk warning only.
  - Stand deploy: backed up `/root/awg-manager/webui/dist` to `/root/awg-manager/webui/dist.backup.protocol-custom-combobox-20260609151512` and deployed bundle `assets/index-DCSdLAuJ.js`.
  - Stand smoke: local `/health` — `HTTP/1.0 200 OK`; `systemctl is-enabled nftables.service` — `disabled`; `nft list ruleset | wc -l` — `85`, with no stale `drop`/`8787` rules found by grep.
  - In-app browser QA on `http://132.243.237.120:8787/ui/?v=protocol-custom-combobox-qa2` — opened Firewall -> Add, verified one `Protocol` input with placeholder `any (tcp, udp, 6, 17)`, styled listbox visible, first suggestions `tcp/udp/icmp/icmpv6`, and no console errors/warnings.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 28 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests` — 306 passed.
- Result summary:
  - The Protocol field no longer relies on browser-native `datalist` rendering. It now matches the current UI style while preserving editable name/number input and one-protocol semantics.

## 1.306) Firewall UI: compact Protocol combobox options

- Step scope:
  - Kept the accepted custom Protocol combobox style and removed duplicated option text from the dropdown.
  - Simplified suggestions so each row has a single primary value (`tcp`, `udp`, `icmp`, `icmpv6`, `6`, `17`, `1`, `58`, `47`, `50`) plus one short hint on the right (`name`, `tcp`, `udp`, `icmp`, `icmpv6`, `gre`, `esp`).
  - Kept editable input behavior and one-protocol semantics unchanged.
  - Wire/API shape, backend behavior, and IPsec code were not changed in this step.
- Ownership moved:
  - No module ownership moved; this is frontend UX polish for the existing firewall `proto` rule field.
- Old entrypoint now delegates to:
  - No runtime/backend entrypoint changed.
- Verification commands:
  - `npm run build` in `webui/` — passed; Vite emitted the expected large-chunk warning only.
  - Stand deploy: backed up `/root/awg-manager/webui/dist` to `/root/awg-manager/webui/dist.backup.protocol-combobox-compact-20260609152058` and deployed bundle `assets/index-Cl1g3r4u.js`.
  - Stand smoke: local `/health` — `HTTP/1.0 200 OK`; `systemctl is-enabled nftables.service` — `disabled`; `nft list ruleset | wc -l` — `85`.
  - In-app browser QA on `http://132.243.237.120:8787/ui/?v=protocol-combobox-compact` — opened Firewall -> Add, verified compact dropdown option text without duplicated labels, and no console errors/warnings.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 28 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests` — 306 passed.
- Result summary:
  - The Protocol dropdown now keeps the cleaner accepted style while removing duplicated labels. Numeric protocol options remain visible and readable.

## 1.307) Firewall UI: Protocol combobox name-left number-right

- Step scope:
  - Updated the accepted custom Protocol combobox option layout after stand/UI review.
  - Suggestions now show the protocol name on the left and its numeric ID on the right: `tcp — 6`, `udp — 17`, `icmp — 1`, `icmpv6 — 58`, `gre — 47`, `esp — 50`.
  - Kept manual typing support and one-protocol semantics unchanged.
  - For `gre` and `esp`, the UI displays the protocol names but stores the backend-compatible numeric values `47` and `50`, because backend validation currently accepts extended protocols by numeric ID.
  - Wire/API shape, backend behavior, and IPsec code were not changed in this step.
- Ownership moved:
  - No module ownership moved; this is frontend UX polish for the existing firewall `proto` rule field.
- Old entrypoint now delegates to:
  - No runtime/backend entrypoint changed.
- Verification commands:
  - `npm run build` in `webui/` — passed; Vite emitted the expected large-chunk warning only.
  - Stand deploy: backed up `/root/awg-manager/webui/dist` to `/root/awg-manager/webui/dist.backup.protocol-name-number-20260609173044` and deployed bundle `assets/index-DJxC5ttT.js`.
  - Stand smoke: local `/health` — `HTTP/1.0 200 OK`; `systemctl is-enabled nftables.service` — `disabled`; `nft list ruleset | wc -l` — `85`.
  - In-app browser QA on `http://132.243.237.120:8787/ui/?v=protocol-name-number-qa` — opened Firewall -> Add, verified visible options `tcp6`, `udp17`, `icmp1`, `icmpv658`, `gre47`, `esp50`, and no console errors/warnings.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 28 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests` — 306 passed.
- Result summary:
  - The Protocol dropdown now reads as an admin-friendly protocol lookup: protocol name on the left, protocol number on the right, while preserving backend-compatible payload values.

## 1.308) Firewall UI: Protocol combobox hint typography and single-select affordance

- Step scope:
  - Polished the accepted Protocol combobox after stand/UI review.
  - Kept the name-left/number-right layout, but adjusted row typography so the numeric hint uses the same calm muted/normal style as other form hints.
  - Added explicit single-select semantics to the listbox (`aria-multiselectable=false`) so the control is represented as one selectable protocol rather than a multi-select-looking list.
  - Kept manual typing support and backend-compatible values unchanged.
  - Wire/API shape, backend behavior, and IPsec code were not changed in this step.
- Ownership moved:
  - No module ownership moved; this is frontend UX polish for the existing firewall `proto` rule field.
- Old entrypoint now delegates to:
  - No runtime/backend entrypoint changed.
- Verification commands:
  - `npm run build` in `webui/` — passed; Vite emitted the expected large-chunk warning only.
  - Stand deploy: backed up `/root/awg-manager/webui/dist` to `/root/awg-manager/webui/dist.backup.protocol-single-style-20260609173700` and deployed bundle `assets/index-D8yqE2tJ.js`.
  - Stand smoke: local `/health` — `HTTP/1.0 200 OK`; `systemctl is-enabled nftables.service` — `disabled`; `nft list ruleset | wc -l` — `85`.
  - In-app browser QA on `http://132.243.237.120:8787/ui/?v=protocol-single-style` — opened Firewall -> Add, verified `aria-multiselectable=false`, visible options `tcp6`, `udp17`, `icmp1`, `icmpv658`, `gre47`, `esp50`, and no console errors/warnings.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 28 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests` — 306 passed.
- Result summary:
  - The Protocol dropdown now reads visually as a single-choice combobox with muted numeric hints matching the rest of the form.

## 1.309) Firewall UI: Protocol single-value placeholder

- Step scope:
  - Adjusted the Protocol combobox placeholder after stand/UI review because `any (tcp, udp, 6, 17)` visually implied multiple values could be entered at once.
  - Replaced it with `any / select one protocol`, while keeping examples available only in the dropdown list.
  - Updated the matching Playwright selector and field reference documentation.
  - Kept manual typing support, dropdown selection, and backend-compatible payload values unchanged.
  - Wire/API shape, backend behavior, and IPsec code were not changed in this step.
- Ownership moved:
  - No module ownership moved; this is frontend UX polish for the existing firewall `proto` rule field.
- Old entrypoint now delegates to:
  - No runtime/backend entrypoint changed.
- Verification commands:
  - `npm run build` in `webui/` — passed; Vite emitted the expected large-chunk warning only.
  - Stand deploy: backed up `/root/awg-manager/webui/dist` to `/root/awg-manager/webui/dist.backup.protocol-single-placeholder-20260609174149` and deployed bundle `assets/index-BUzurQKD.js`.
  - Stand smoke: local `/health` — `HTTP/1.0 200 OK`; `systemctl is-enabled nftables.service` — `disabled`; `nft list ruleset | wc -l` — `85`.
  - In-app browser QA on `http://132.243.237.120:8787/ui/?v=protocol-single-placeholder` — opened Firewall -> Add, verified one Protocol input with placeholder `any / select one protocol`, visible options `tcp6`, `udp17`, `icmp1`, `icmpv658`, `gre47`, `esp50`, and no console errors/warnings.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 28 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests` — 306 passed.
- Result summary:
  - The empty Protocol control now communicates single-value selection clearly instead of implying comma/list input.

## 1.310) Firewall UI: Protocol default placeholder `any`

- Step scope:
  - Adjusted the Protocol combobox after stand/UI review: the empty field placeholder is now exactly `any`.
  - Kept examples out of the placeholder so the control no longer visually implies multiple values can be entered at once.
  - Kept the dropdown behavior unchanged: the field remains an editable single-select combobox, accepts manual protocol names or numeric IDs, and shows popular protocols as name-left / number-right options.
  - Wire/API shape, backend behavior, and IPsec code were not changed in this step.
- Ownership moved:
  - No module ownership moved; this is frontend UX polish plus firewall field-reference documentation for the existing `proto` rule field.
- Old entrypoint now delegates to:
  - No runtime/backend entrypoint changed.
- Verification commands:
  - `npm run build` in `webui/` — passed; Vite emitted the expected large-chunk warning only. Bundle: `assets/index-B7k2ZFQY.js`.
  - Stand deploy: backed up `/root/awg-manager/webui/dist` to `/root/awg-manager/webui/dist.backup.protocol-any-placeholder-20260609174839` and deployed bundle `assets/index-B7k2ZFQY.js`.
  - Stand smoke: local `/health` — `HTTP/1.0 200 OK`; `systemctl is-enabled nftables.service` — `disabled`; `nft list ruleset | wc -l` — `85`.
  - In-app browser QA on `http://132.243.237.120:8787/ui/?v=protocol-any-placeholder-final2` — opened Firewall -> Add, verified the Protocol input placeholder is `any`, value is empty, listbox has `aria-multiselectable=false`, visible options are `tcp6`, `udp17`, `icmp1`, `icmpv658`, `gre47`, `esp50`, and no console warnings/errors were captured.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 28 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests` — 306 passed.
- Result summary:
  - The empty Protocol control now says only `any`; examples remain available in the dropdown, preserving the single-protocol mental model.

## 1.311) Firewall Add Rule: Source/Destination port fields match their hints

- Step scope:
  - Closed the UX/backend gap for `Source port` and `Destination port` in `Add Firewall Rule -> Base match`.
  - Backend validation now accepts the formats promised by the UI hints: a single port (`443`), a range with `-` or `:` (`1024-65535` / `1024:65535`), a comma-separated list (`22,80,443`), and one `@port_collection` reference (`@admin_ports`).
  - Backend normalizes dash ranges to the existing internal colon format (`1024-65535` -> `1024:65535`) and renders comma lists as nft set literals (`{ 22, 80, 443 }`).
  - Port fields remain valid only with `tcp`, `udp`, `6`, or `17`; no wire/API breaking change was introduced.
  - IPsec code was not changed.
- Ownership moved:
  - No module ownership moved. The existing firewall rule ownership remains in `backend/domains/firewall/rule_ops.py`; this step extends that module's validation/render behavior for existing `sport`/`dport` fields.
- Old entrypoint now delegates to:
  - No runtime/backend entrypoint changed.
- Verification commands:
  - RED: `python3 -m pytest -q tests/test_firewall_rule_ops.py -k "port_lists_ranges_and_collection_refs or normalize_proto_and_basic_match_fields"` — failed before implementation on `22,80,443` validation and missing nft braces.
  - GREEN: same targeted command — 2 passed.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 29 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests` — 307 passed.
  - Stand deploy: backed up `/root/awg-manager/backend/domains/firewall/rule_ops.py` to `/root/awg-manager/backend/domains/firewall/rule_ops.py.backup.port-fields-20260609181123`, copied updated `rule_ops.py`, restarted `awg-manager-api.service`, and `/health` returned `HTTP/1.0 200 OK`.
  - Stand API+nft smoke: created a temporary rule with `proto=tcp`, `sport=1024-65535`, `dport=22,80,443`; API stored `sport=1024:65535`, `dport=22,80,443`, and `nft list ruleset` contained `tcp sport 1024-65535 tcp dport { 22, 80, 443 }`; the temporary rule was deleted.
  - Stand Playwright UI smoke: `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-rules.spec.ts -g "source and destination port hints" --project=chromium` — 1 passed.
- Result summary:
  - The two port fields now behave as their hints say: users can type the hinted range/list formats and the resulting rule is accepted, stored, rendered, applied, and visible through the UI/API path.

## 1.312) Firewall Add Rule: Input/Output interface fields and iface collections

- Step scope:
  - Documented and verified `Input interface` / `Output interface` in `Add Firewall Rule -> Base match`.
  - Backend validation now accepts one literal interface name (`eth0`, `lo`, `awg1`) or one iface collection reference (`@lan_ifaces`, `@wan_ifaces`) for `in_interface` and `out_interface`.
  - Runtime renderer keeps literal interface names quoted (`iifname "eth0"`) and renders iface collection references unquoted (`iifname @lan_ifaces`).
  - The recommended chain for using both fields together is `forward`; `netdev` still hides/forbids `Output interface`, and `bridge` uses separate `Bridge input` / `Bridge output` fields.
  - Wire/API shape and IPsec code were not changed.
- Ownership moved:
  - No module ownership moved. The existing firewall rule ownership remains in `backend/domains/firewall/rule_ops.py`; this step extends existing interface-match validation/render behavior.
- Old entrypoint now delegates to:
  - No runtime/backend entrypoint changed.
- Verification commands:
  - RED: `python3 -m pytest -q tests/test_firewall_rule_ops.py -k "interface_collection_refs or normalize_proto_and_basic_match_fields"` — failed before implementation because `@lan_ifaces` was rejected and renderer quoted `@...` references.
  - GREEN: same targeted command — 2 passed.
  - Stand deploy: backed up `/root/awg-manager/backend/domains/firewall/rule_ops.py` to `/root/awg-manager/backend/domains/firewall/rule_ops.py.backup.iface-fields-20260609185030`, copied updated `rule_ops.py`, restarted `awg-manager-api.service`, and `/health` returned `HTTP/1.0 200 OK`.
  - Stand interfaces inventory: `lo`, `eth0`; no `eth1` exists on this stand, so literal smoke used real interfaces `lo -> eth0`.
  - Stand API+nft smoke: temporary `forward` rule with `in_interface=lo`, `out_interface=eth0` rendered as `iifname "lo" oifname "eth0"`; temporary iface collections `lan_ifaces_smoke_*` and `wan_ifaces_smoke_*` rendered and were referenced as `iifname @lan_ifaces_smoke_* oifname @wan_ifaces_smoke_*`; all temporary rules/sets were deleted.
  - Stand Playwright UI smoke: `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-rules.spec.ts -g "input and output interface fields" --project=chromium` — 1 passed.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 30 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests` — 308 passed.
- Result summary:
  - Users can create `forward` rules matching traffic by ingress and egress interface, including both literal interface names and named iface collections, and the rules render/apply through nftables correctly.

## 1.313) Firewall Add Rule: Connection state field walkthrough and verification

- Step scope:
  - Documented and verified `Connection state` in `Add Firewall Rule -> Base match`.
  - Confirmed existing backend behavior: allowed values are `established,related`, `new`, `invalid`, `related`, `established`, and `untracked`; whitespace is normalized (`established, related` -> `established,related`).
  - Confirmed existing UI behavior: `established` and `related` can be selected together; `new`, `invalid`, and `untracked` are mutually exclusive single-state modes.
  - No backend/API behavior change was required in this step.
  - IPsec code was not changed.
- Ownership moved:
  - No module ownership moved; this step adds user-facing firewall field documentation and a UI regression around the existing `ct_state` rule field.
- Old entrypoint now delegates to:
  - No runtime/backend entrypoint changed.
- Verification commands:
  - Stand Playwright UI smoke: `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-rules.spec.ts -g "connection state checkboxes" --project=chromium` — 1 passed.
  - Stand API+nft smoke: temporary `filter/input` rules with `ct_state=established,related`, `new`, `invalid`, and `untracked` were created; each stored the expected value and `nft list ruleset` contained the corresponding `ct state ...` expression; all temporary rules were deleted.
  - `npm run build` in `webui/` — passed; Vite emitted the expected large-chunk warning only.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 30 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests` — 308 passed.
- Result summary:
  - The `Connection state` field is now documented and covered by UI/API/nft verification: users can use it for stateful firewall rules, especially `established,related accept`, `new`, `invalid`, and `untracked` scenarios.

## 1.314) Firewall Add Rule: Connection mark / Packet mark match fields

- Step scope:
  - Documented and verified `Connection mark` and `Packet mark` in `Add Firewall Rule -> Base match`.
  - Confirmed existing backend behavior: `Packet mark` maps to `mark_match` and renders as `meta mark ...`; `Connection mark` maps to `ct_mark_match` and renders as `ct mark ...`.
  - Confirmed allowed values are decimal integers or hex integers, for example `10`, `0x1`, `0x10`, `0x20`; invalid values such as `abc` or `0xZZ` are rejected by existing validation.
  - Root-cause note from stand verification: nft canonicalizes hex marks to 32-bit display form, so `0x10` appears in `nft list ruleset` as `0x00000010`.
  - No backend/API behavior change was required in this step.
  - IPsec code was not changed.
- Ownership moved:
  - No module ownership moved; this step adds user-facing firewall field documentation and a UI regression around existing `mark_match` / `ct_mark_match` fields.
- Old entrypoint now delegates to:
  - No runtime/backend entrypoint changed.
- Verification commands:
  - Stand Playwright UI smoke: `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-rules.spec.ts -g "connection and packet mark match" --project=chromium` — 1 passed.
  - Stand API+nft smoke: temporary `filter/input` rule with `mark_match=0x10` and `ct_mark_match=0x20` was created; API stored both fields, and `nft list ruleset` rendered `meta mark 0x00000010 ct mark 0x00000020`; the temporary rule was deleted.
  - `npm run build` in `webui/` — passed; Vite emitted the expected large-chunk warning only.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 30 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests` — 308 passed.
- Result summary:
  - The mark match fields work, but they are advanced controls: they match already assigned packet/connection marks and are useful for policy routing, QoS, and multi-step firewall marking schemes. They do not set marks by themselves.

## 1.315) Firewall Add Rule: hide User ID from Base match UI

- Step scope:
  - Removed the `User ID` control from `Add Firewall Rule -> Base match -> Meta match` after UI review.
  - Kept backend/API `user_id` support unchanged for wire/API compatibility; existing API scenarios that render `meta skuid` remain supported.
  - Updated the user-facing field reference to mark `User ID` as hidden from the UI and explain why.
  - IPsec code was not changed.
- Ownership moved:
  - No module ownership moved; this is frontend UX simplification for the existing firewall `user_id` rule field.
- Old entrypoint now delegates to:
  - No runtime/backend entrypoint changed.
- Verification commands:
  - `npm run build` in `webui/` — passed; Vite emitted the expected large-chunk warning only. Bundle: `assets/index-eiWQKRuW.js`.
  - Stand deploy: backed up `/root/awg-manager/webui/dist` to `/root/awg-manager/webui/dist.backup.remove-user-id-20260609191819` and deployed bundle `assets/index-eiWQKRuW.js`; `/health` returned `HTTP/1.0 200 OK`.
  - Stand Playwright UI smoke: `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-add-rule-fields-completeness.spec.ts -g "required field groups" --project=chromium` — 1 passed; Add Rule no longer exposes `User ID`.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py` — 30 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 9 passed.
  - `python3 -m pytest -q tests` — 308 passed.
- Result summary:
  - The UI is less noisy: `User ID` is no longer shown to normal firewall users, while API compatibility for `user_id` remains intact.

## 1.316) Firewall Add Rule: Rate limit field guidance and smoke

- Step scope:
  - Clarified `Rate limit` in `Add Firewall Rule -> Base match -> Meta match` as an nftables rate expression, not as a collection timeout/duration field.
  - Updated the UI hint from `10/second` to `10/second or 200/minute` so the accepted syntax is visible directly in the form.
  - Documented that valid values are `N/second`, `N/minute`, `N/hour`, or `N/day`, for example `10/second`, `200/minute`, `1000/hour`.
  - Documented that collection-style durations such as `10m`, `2h30m`, and `1d 15:00:00` are not valid for this rule field; byte-rate throttling remains a named `limit` object scenario, not this simple rule field.
  - Kept backend/API behavior unchanged for wire/API compatibility.
  - IPsec code was not changed.
- Ownership moved:
  - No module ownership moved; this step adds user-facing firewall field documentation and a UI hint for the existing `limit_rate` rule field.
- Old entrypoint now delegates to:
  - No runtime/backend entrypoint changed.
- Verification commands:
  - Stand API+nft smoke: temporary `filter/input` rule with `limit_rate=200/minute` was created; API stored `200/minute`, and `nft list ruleset` rendered `limit rate 200/minute`; invalid `limit_rate=10m` returned HTTP 400 with a `limit_rate` validation error; the temporary rule was deleted.
  - `npm run build` in `webui/` — passed; Vite emitted the expected large-chunk warning only. Bundle: `assets/index-v7VtURi5.js`.
  - Stand deploy: backed up `/root/awg-manager/webui/dist` to `/root/awg-manager/webui/dist.backup.rate-limit-hint-20260609192410` and deployed bundle `assets/index-v7VtURi5.js`.
  - Stand recovery note: the manually started `/root/awg-manager/api_core.py` process was listening but `/health` timed out; it was restarted with the same command, after which external GET `/health` responded with the expected API-key error when called without a key.
  - Stand Playwright UI smoke: `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-add-rule-toggle-semantics.spec.ts --project=chromium` — 1 passed.
- Result summary:
  - Users now see a clearer `Rate limit` hint and the instruction explains how to use the field: it limits packet rate per time unit, for example `10/second`, and it does not accept collection timeout formats.

## 1.317) Firewall Add Rule: Hour and DSCP field walkthrough and ip6 DSCP render fix

- Step scope:
  - Documented `Hour` and `DSCP` in `Add Firewall Rule -> Base match -> Meta match`.
  - Confirmed `Hour` is a time-of-day match, not a duration/timeout field; accepted format is `HH:MM` or `HH:MM-HH:MM`.
  - Confirmed `DSCP` is a match for already marked packets; accepted values are `cs0..cs7`, `af11..af43`, `ef`, or integer `0..63`.
  - Fixed DSCP runtime rendering for `family=ip6`: `dscp` now renders as `ip6 dscp <value>` for ip6 tables instead of invalid `ip dscp <value>`.
  - Kept the API payload field unchanged (`dscp`) for wire/API compatibility.
  - Updated the UI hint from `cs5 / 46` to `cs5 or 46` to avoid implying multiple values in one field.
  - IPsec code was not changed.
- Ownership moved:
  - No module ownership moved; this step documents existing firewall fields and fixes family-aware nft rendering inside `backend/domains/firewall/rule_ops.py`.
- Old entrypoint now delegates to:
  - No runtime/backend entrypoint changed.
- Verification commands:
  - Stand nft syntax check: `meta hour "08:00"-"18:00"`, `ip dscp cs5`, and `ip6 dscp cs5` were validated with `nft -c`.
  - Stand API+nft smoke: temporary `inet/filter/input` rule with `hour=08:00-18:00` and `dscp=cs5` rendered as `meta hour "08:00"-"18:00" ip dscp cs5`; the temporary rule was deleted.
  - Stand API+nft smoke: temporary custom `ip6` table and rule with `dscp=cs5` rendered as `ip6 dscp cs5`; the temporary rule and table were deleted.
  - `python3 -m pytest -q tests/test_firewall_rule_ops.py -k 'render_firewall_rule or normalize_proto_and_basic_match_fields'` — 8 passed, 22 deselected.
  - Stand Playwright API/e2e smoke: `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-add-rule-block-b10.spec.ts tests/firewall-add-rule-block-b11.spec.ts --project=chromium` — 5 passed.
  - `npm run build` in `webui/` — passed; Vite emitted the expected large-chunk warning only. Bundle: `assets/index-DyiEGSkg.js`.
  - Stand deploy: backed up `/root/awg-manager/webui/dist` to `/root/awg-manager/webui/dist.backup.hour-dscp-20260609195840`, deployed bundle `assets/index-DyiEGSkg.js`, copied updated `backend/domains/firewall/rule_ops.py`, and restarted the manual `api_core.py` stand process.
- Result summary:
  - `Hour` and `DSCP` are working fields with documented usage. `Hour` limits rule matching by time of day. `DSCP` matches pre-marked QoS packets. The DSCP renderer now works for ip6 custom tables as well as existing IPv4/inet scenarios.

## 1.318) Firewall Add Rule: TCP flags checkbox picker

- Step scope:
  - Replaced the `tcp flags` free-text field in `Add Firewall Rule -> Advanced match -> Network & L4 extras` with a checkbox picker similar to `Connection state`.
  - Supported UI choices are the runtime-checked flags: `syn`, `ack`, `fin`, `rst`, `psh`, `urg`, `cwr`.
  - The UI still stores/sends the same API field `tcp_flags` as a comma-separated string, for example `syn,ack`, preserving wire/API compatibility.
  - `proto` is still auto-set to `tcp` when tcp flags are enabled.
  - IPsec code was not changed.
- Ownership moved:
  - No module ownership moved; this is a frontend UX change in the existing unified firewall rule editor.
- Old entrypoint now delegates to:
  - No backend/runtime entrypoint changed.
- Verification commands:
  - Stand nft syntax check before the UI change confirmed valid flags on the runtime: `fin`, `syn`, `rst`, `psh`, `ack`, `urg`, `cwr`, and combinations such as `syn,ack`; `ece` is not accepted by this nft runtime profile and is not exposed in the picker.
  - `npm run build` in `webui/` — passed; Vite emitted the expected large-chunk warning only. Bundle: `assets/index-BSKSRumK.js`.
  - Stand cleanup/deploy: removed old cache artifacts and stale frontend backups after `/` reached 100%; deployed `webui/dist` with bundle `assets/index-BSKSRumK.js`.
  - Stand Playwright API/UI smoke: `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-add-rule-block-b.spec.ts --project=chromium` — 5 passed.
- Result summary:
  - Users can now choose TCP flags visually instead of typing raw text. Selecting `syn` plus `ack` saves the same backend value `tcp_flags=syn,ack` and keeps the rule API unchanged.

## 1.319) Firewall Add Rule: TCP flags single-choice presets

- Step scope:
  - Replaced the previous multi-checkbox `tcp flags` picker with a single-choice preset picker after UI review showed users could accidentally select all flags at once.
  - Available presets are intentionally practical: `syn`, `syn,ack`, `rst`, `fin`, `ack`, `psh,ack`, `fin,ack`, `rst,ack`.
  - The API payload remains unchanged: the selected preset is still sent as `tcp_flags`, for example `syn,ack`.
  - IPsec code was not changed.
- Ownership moved:
  - No module ownership moved; this is a frontend UX refinement in the unified firewall rule editor.
- Old entrypoint now delegates to:
  - No backend/runtime entrypoint changed.
- Verification commands:
  - `npm run build` in `webui/` — passed; Vite emitted the expected large-chunk warning only. Bundle: `assets/index-DywFcu-T.js`.
  - Stand deploy: backed up `/root/awg-manager/webui/dist` and deployed bundle `assets/index-DywFcu-T.js`.
  - Stand Playwright API/UI smoke: `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ PLAYWRIGHT_API_KEY=... npx playwright test tests/firewall-add-rule-block-b.spec.ts --project=chromium` — 5 passed.
- Result summary:
  - Users can no longer choose all TCP flags at once from the normal UI. The field now guides them to one meaningful TCP flag preset while preserving backend/API compatibility.

## 1.320) NTP/Chrony: desired configuration storage and preview API

- Step scope:
  - Added the first backend slice for NTP/Chrony: schema defaults, strict normalization, atomic JSON persistence and deterministic `chrony.conf` preview.
  - Added authenticated `GET /ntp`, `PUT /ntp` and `GET /ntp/config-preview` endpoints.
  - Explicitly kept runtime effects out of scope: no writes to `/etc/chrony/chrony.conf`, no Chrony restart/reload, no `chronyc`, no system time/timezone changes and no firewall management.
- Ownership moved:
  - New `backend/domains/ntp` owns desired NTP configuration validation, JSON storage and config rendering.
  - `backend/common/data_paths.py` owns the canonical `${AWG_MANAGER_DATA_DIR}/ntp_config.json` path.
- Old entrypoint now delegates to:
  - `backend/app/router.py` delegates NTP HTTP requests directly to `backend.domains.ntp.service`; no legacy facade path was added.
- Verification commands:
  - `python3 -m pytest -q tests/test_ntp_service.py tests/test_api_contract.py -k ntp` — 5 passed, 9 deselected.
  - `python3 -m pytest -q tests/test_api_contract.py` — 10 passed.
  - `python3 -m pytest -q tests` — 346 passed.
  - Development stand `89.125.103.24:8787`: `GET /ntp` and `GET /ntp/config-preview` returned HTTP 200; invalid `PUT /ntp` returned HTTP 400 and did not create `/etc/wg-manager/ntp_config.json`.
- Result summary:
  - AWG Manager can now safely store and inspect a validated desired Chrony configuration without changing the host runtime. Invalid payloads return HTTP 400 and do not overwrite the last valid JSON file.

## 1.321) NTP/Chrony: rollback-safe Apply and exclusive time service

- Step scope:
  - Added explicit `POST /ntp/apply` runtime activation for the saved desired Chrony configuration.
  - Generated configuration is validated with `chronyd -p` before replacing the live file.
  - Apply stores `/etc/chrony/chrony.conf.awg-manager.bak`, atomically replaces `/etc/chrony/chrony.conf`, enables/restarts Chrony and restores the previous config if activation fails.
  - Existing competing time synchronization units are stopped, disabled and masked; firewall is not touched.
- Ownership moved:
  - New `backend/domains/ntp/runtime_ops.py` owns Chrony syntax validation, atomic live-config replacement, competing-service shutdown and rollback.
  - `backend/domains/ntp/service.py` owns preview-warning gating and the explicit apply orchestration.
- Old entrypoint now delegates to:
  - `backend/app/router.py` delegates `POST /ntp/apply` directly to `backend.domains.ntp.service.handle_post`; no manager facade or legacy path is used.
- Verification commands:
  - `python3 -m pytest -q tests/test_ntp_runtime_ops.py tests/test_ntp_service.py` — 8 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 10 passed.
  - `python3 -m pytest -q tests` — 350 passed.
  - Development stand `89.125.103.24:8787`: installed Chrony 4.0, `PUT /ntp` and `POST /ntp/apply` returned HTTP 200, `chrony.service` is active/enabled, generated config passed activation, and `chronyc tracking` reported Stratum 3 with `Leap status: Normal`.
- Result summary:
  - The stand now uses Chrony as its only enabled time synchronization implementation. Apply is explicit, validated and rollback-safe; runtime status collection through the API remains a later slice.

## 1.322) NTP/Chrony: structured runtime status API

- Step scope:
  - Added authenticated `GET /ntp/status` with structured Chrony service, tracking, activity, sources and source statistics data.
  - Runtime collection uses numeric-address CSV output from `chronyc -n -c`, avoiding locale-dependent human-readable parsing.
  - Partial `chronyc` failures are returned in `errors` while preserving available service state and successful sections.
- Ownership moved:
  - New `backend/domains/ntp/status_ops.py` owns `systemctl` service inspection and parsing of `chronyc tracking`, `activity`, `sources` and `sourcestats`.
  - `backend/domains/ntp/service.py` exposes the read-only snapshot through the existing NTP route boundary.
- Old entrypoint now delegates to:
  - `backend/app/router.py` already delegates NTP GET requests to `backend.domains.ntp.service.handle_get`; no legacy path changed.
- Verification commands:
  - `python3 -m pytest -q tests/test_ntp_status_ops.py tests/test_ntp_service.py` — 8 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 10 passed.
  - `python3 -m pytest -q tests` — 353 passed.
  - Development stand `89.125.103.24:8787`: `GET /ntp/status` returned HTTP 200 with active/enabled service state, Stratum 3 tracking, four online sources, parsed source statistics and an empty `errors` array.
- Result summary:
  - The backend now exposes the extended Chrony state needed by the existing Status UI without granting the frontend direct command access.

## 1.323) NTP/Chrony UI: live desired state, Apply and Status

- Step scope:
  - Replaced the NTP design-preview data source with authenticated backend calls while preserving the accepted Time/Sources/Access/Status layout.
  - Added one real Apply flow: validate/store desired JSON, activate Chrony, then refresh runtime status.
  - Replaced mock Status rows with live service/tracking/source data and automatic refresh while the Status tab is visible.
  - Added a loading boundary so late configuration hydration cannot overwrite operator input.
- Ownership moved:
  - New `webui/src/frontend/domains/ntp/api.ts` owns typed NTP HTTP contracts.
  - `webui/src/pages/ntp.tsx` owns backend-to-form mapping, Apply orchestration and live status rendering.
- Old entrypoint now delegates to:
  - `webui/src/App.tsx` passes authenticated page context to `NtpPage`; global shell and routing remain unchanged.
- Verification commands:
  - `cd webui && npm run build` — passed; Vite emitted the existing large-chunk warning only. Bundle: `assets/index-BtO3tHZ1.js`.
  - Stand Playwright live flow: `npx playwright test tests/ntp-design.spec.ts -g 'loads live' --project=chromium --workers=1` — 1 passed; real Apply succeeded, Status reached `Normal`, and no console/page errors were captured.
  - Earlier layout regression on the same live wiring — 2 passed before the final Last Rx sentinel display refinement.
  - In-app Browser automation was attempted first but the selected tab stopped responding; repository Playwright was used as the documented fallback.
- Result summary:
  - The accepted NTP interface is now backed by real desired state and Chrony runtime data. Configuration editing no longer depends on hard-coded demo values.

## 1.324) NTP/Chrony: system time and service actions

- Step scope:
  - Added privileged endpoints for system timezone, manual date/time, immediate Chrony synchronization, restart and reload-or-restart.
  - Connected Time and Status controls to those endpoints without changing the accepted panel layout.
  - Manual time is rejected while desired NTP synchronization is enabled; the UI applies an NTP-disabled configuration before sending a manual time value.
  - All commands use fixed argv lists without shell interpolation; firewall remains out of scope.
- Ownership moved:
  - `backend/domains/ntp/runtime_ops.py` owns `timedatectl`, `chronyc makestep`, and Chrony service-control execution.
  - `backend/domains/ntp/service.py` owns action routing and manual-time safety checks.
  - `webui/src/frontend/domains/ntp/api.ts` and `webui/src/pages/ntp.tsx` own authenticated action calls and operator feedback.
- Old entrypoint now delegates to:
  - `backend/app/router.py` continues to delegate all NTP POST actions directly to `backend.domains.ntp.service.handle_post`; no facade/legacy path was introduced.
- Verification commands:
  - `python3 -m pytest -q tests/test_ntp_runtime_ops.py tests/test_ntp_service.py` — 14 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 10 passed.
  - `python3 -m pytest -q tests` — 358 passed.
  - `cd webui && npm run build` — passed; Vite emitted the existing large-chunk warning only. Bundle: `assets/index-BdXHCNqQ.js`.
  - Stand Playwright live Apply/status flow — 1 passed with no console/page errors.
  - Stand Playwright Time/Sources/Access layout and timezone UTC action flow — 1 passed.
  - Stand API smoke: timezone UTC, sync, reload and restart returned HTTP 200; Chrony returned to Stratum 3 and `Leap status: Normal` after restart.
- Result summary:
  - The visible Time and Status actions are now operational. Chrony remains the sole time synchronizer and all runtime controls are exposed through authenticated backend endpoints.

## 1.325) NTP/Chrony: manual time conflict handling

- Step scope:
  - Fixed manual system time setting when desired NTP client synchronization is disabled but `chrony.service` is still active.
  - Manual time now temporarily stops Chrony before `timedatectl set-time`, then starts Chrony again and verifies active state.
  - Raw `CalledProcessError` text no longer reaches the UI; failures are converted to concise operator-facing messages and include restart failure context when relevant.
- Ownership moved:
  - No ownership moved; the fix remains inside `backend/domains/ntp/runtime_ops.py`.
- Old entrypoint now delegates to:
  - API and UI contracts are unchanged; `POST /ntp/manual-time` continues through `backend.domains.ntp.service.handle_post`.
- Verification commands:
  - `python3 -m pytest -q tests/test_ntp_runtime_ops.py tests/test_ntp_service.py` — 15 passed.
  - `python3 -m pytest -q tests/test_api_contract.py` — 10 passed.
  - `python3 -m pytest -q tests` — 359 passed.
  - Stand API smoke with current time and desired `ntp_enabled=false` — HTTP 200; `chrony.service` returned to active.
  - Stand UI smoke — `Set manually` displayed `System time changed to 2026-07-06 18:44:04.` and no raw command error.
- Result summary:
  - Manual time now works with Chrony as the installed synchronization implementation while preserving service availability after the operation.

## 1.326) NTP/Chrony: real RTC/system clock status

- Step scope:
  - Replaced the hard-coded UI `RTC sync` value with runtime data collected from `timedatectl show`.
  - Kept `Use local clock` as the Chrony server fallback/orphan-clock setting (`local stratum`); it is intentionally separate from RTC/system clock synchronization.
- Ownership moved:
  - `backend/domains/ntp/status_ops.py` now owns `timedatectl show` parsing in addition to `systemctl` and `chronyc -n -c` status collection.
  - `webui/src/frontend/domains/ntp/api.ts` exposes the typed `system_clock` snapshot for the NTP page.
- Old entrypoint now delegates to:
  - `backend/domains/ntp/service.py` continues exposing the snapshot through `GET /ntp/status`; no legacy/facade path was added.
- Verification commands:
  - `python3 -m pytest -q tests/test_ntp_status_ops.py` — passed locally after adding `system_clock` parsing coverage.
  - Full verification is recorded in the task handoff.
- Result summary:
  - The Time tab no longer shows a fake RTC value; RTC/system clock state is sourced from the host runtime.

## 1.327) NTP/Chrony: desired `rtcsync` control

- Step scope:
  - Added `time.rtcsync` to desired NTP configuration with default `true` for backward-compatible normalization of existing JSON.
  - `chrony.conf` generation now includes the `rtcsync` directive only when `time.rtcsync` is enabled.
  - Added the `Sync hardware clock (RTC)` checkbox to the Time tab `NTP synchronization` panel.
- Ownership moved:
  - `backend/domains/ntp/validation_ops.py` owns normalization of `time.rtcsync`.
  - `backend/domains/ntp/config_renderer.py` owns conditional rendering of the Chrony `rtcsync` directive.
  - `webui/src/pages/ntp.tsx` owns the operator-facing checkbox and maps it into desired state.
- Old entrypoint now delegates to:
  - Existing `GET/PUT /ntp` and `POST /ntp/apply` routes continue through `backend.domains.ntp.service`; no legacy/facade path changed.
- Verification commands:
  - `PYTHONPYCACHEPREFIX=/tmp/awg-pycache python3 -m pytest -q tests/test_ntp_service.py tests/test_api_contract.py` — 20 passed.
  - `PYTHONPYCACHEPREFIX=/tmp/awg-pycache python3 -m pytest -q tests` — 363 passed.
  - `cd webui && npm run build` — passed; Vite emitted the existing large-chunk warning only.
- Result summary:
  - RTC hardware-clock sync is no longer an implicit always-on directive; it is visible and controlled from the Time tab desired configuration.

## 1.328) NTP/Chrony: correct RTC summary semantics

- Step scope:
  - Corrected the Time summary `RTC sync` tile because it previously used `timedatectl` `NTPSynchronized`, which reports system clock NTP synchronization and does not directly indicate the Chrony `rtcsync` directive.
  - The tile is shown again and now reflects the desired `time.rtcsync` checkbox state.
  - Kept RTC behavior as the explicit desired configuration checkbox `Sync hardware clock (RTC)`.
- Ownership moved:
  - No backend ownership moved; this is a UI semantics correction in `webui/src/pages/ntp.tsx`.
  - `webui/tests/ntp-design.spec.ts` verifies the desired RTC checkbox and summary tile.
- Old entrypoint now delegates to:
  - Existing NTP routes are unchanged.
- Verification commands:
  - `cd webui && npm run build` — passed; Vite emitted the existing large-chunk warning only.
  - `PLAYWRIGHT_BASE_URL=http://89.125.103.24:8787/ui/ PLAYWRIGHT_API_KEY=... ./node_modules/.bin/playwright test tests/ntp-design.spec.ts --project=chromium --workers=1` — passed.
- Result summary:
  - The Time tab summary shows RTC state from desired Chrony configuration instead of a misleading `timedatectl` runtime field.

## 1.329) NTP/Chrony: faster Time status refresh

- Step scope:
  - Enabled periodic runtime status refresh on the Time tab, not only on the Status tab, so transient Chrony states such as `activating` and `waiting` update without a manual page refresh.
  - Added a timeout to backend status commands so a slow `chronyc`, `systemctl`, or `timedatectl` command is reported as a status error instead of blocking the UI indefinitely.
- Ownership moved:
  - `webui/src/pages/ntp.tsx` owns Time/Status tab polling.
  - `backend/domains/ntp/status_ops.py` owns status command execution timeout handling.
- Old entrypoint now delegates to:
  - Existing `GET /ntp/status` route is unchanged and continues through `backend.domains.ntp.service`.
- Verification commands:
  - `PYTHONPYCACHEPREFIX=/tmp/awg-pycache python3 -m pytest -q tests/test_ntp_status_ops.py tests/test_ntp_service.py tests/test_api_contract.py` — passed.
  - `cd webui && npm run build` — passed; Vite emitted the existing large-chunk warning only.
  - `PLAYWRIGHT_BASE_URL=http://89.125.103.24:8787/ui/ PLAYWRIGHT_API_KEY=... ./node_modules/.bin/playwright test tests/ntp-design.spec.ts --project=chromium --workers=1` — passed.
- Result summary:
  - The Time tab updates runtime status automatically and no single status command can freeze the NTP UI.

## 1.330) NTP/Chrony: transient success messages

- Step scope:
  - Added auto-dismiss for successful/info NTP page messages after 5 seconds.
  - Kept error messages persistent until the next operator action so failures remain visible.
  - Separated info and error banner colors on the NTP page.
- Ownership moved:
  - `webui/src/pages/ntp.tsx` owns NTP page message lifetime and visual tone.
- Old entrypoint now delegates to:
  - Existing NTP routes are unchanged.
- Verification commands:
  - `cd webui && npm run build` — passed; Vite emitted the existing large-chunk warning only.
  - `PLAYWRIGHT_BASE_URL=http://89.125.103.24:8787/ui/ PLAYWRIGHT_API_KEY=... ./node_modules/.bin/playwright test tests/ntp-design.spec.ts --project=chromium --workers=1` — passed.
- Result summary:
  - The `NTP configuration applied. Chrony is active.` banner no longer stays on screen indefinitely.

## 1.331) NTP/Chrony: remove Access firewall column

- Step scope:
  - Removed the synthetic `Firewall` / `not managed` column from the NTP Access table.
  - Kept the existing explanatory helper text that firewall rules are not managed by the NTP module.
- Ownership moved:
  - `webui/src/pages/ntp.tsx` owns the Access table columns.
  - `webui/tests/ntp-design.spec.ts` verifies that the synthetic firewall column does not return.
- Old entrypoint now delegates to:
  - Existing NTP routes are unchanged; the removed field was UI-only.
- Verification commands:
  - `cd webui && npm run build` — passed; Vite emitted the existing large-chunk warning only.
  - `PLAYWRIGHT_BASE_URL=http://89.125.103.24:8787/ui/ PLAYWRIGHT_API_KEY=... ./node_modules/.bin/playwright test tests/ntp-design.spec.ts --project=chromium --workers=1` — passed.
- Result summary:
  - Access rules now show only Chrony access data: action, network, and comment.

## 1.332) NTP/Chrony: firewall-style comments in tables

- Step scope:
  - Removed `Comment` as a standalone column from the NTP Sources and Access tables.
  - Rendered row comments in the Firewall style: `# comment` above the first visible data cell.
  - Kept comment editing in the add/edit dialogs.
- Ownership moved:
  - `webui/src/pages/ntp.tsx` owns the NTP table comment presentation.
  - `webui/tests/ntp-design.spec.ts` verifies that comments are no longer standalone table columns.
- Old entrypoint now delegates to:
  - Existing NTP routes are unchanged; comment storage/API shape did not change.
- Verification commands:
  - `cd webui && npm run build` — passed; Vite emitted the existing large-chunk warning only.
  - `PLAYWRIGHT_BASE_URL=http://89.125.103.24:8787/ui/ PLAYWRIGHT_API_KEY=... ./node_modules/.bin/playwright test tests/ntp-design.spec.ts --project=chromium --workers=1` — passed.
- Result summary:
  - NTP table comments now visually match the Firewall/IPsec compact table pattern.

## 1.333) NTP/Chrony: pending apply state for desired/runtime mismatch

- Step scope:
  - Added `applied_current` to `GET /ntp`; it compares the rendered desired `chrony.conf` with the installed `/etc/chrony/chrony.conf`.
  - Added a persistent NTP UI warning when saved desired configuration differs from the running Chrony config.
  - The Time tab `NTP sync` tile now shows `pending apply` instead of reporting runtime `synchronized` as the final state while desired changes are not applied.
- Ownership moved:
  - `backend/domains/ntp/service.py` owns the desired/runtime apply-state composition.
  - `backend/domains/ntp/runtime_ops.py` owns the installed config comparison helper.
  - `webui/src/pages/ntp.tsx` owns the pending apply presentation.
- Old entrypoint now delegates to:
  - Existing `/ntp` dispatch still delegates through `backend.domains.ntp.service`; the response item has an additive `applied_current` field.
- Verification commands:
  - `PYTHONPYCACHEPREFIX=/tmp/awg-pycache python3 -m pytest -q tests/test_ntp_service.py tests/test_ntp_runtime_ops.py tests/test_api_contract.py` — passed (`27 passed`).
  - `cd webui && npm run build` — passed; Vite emitted the existing large-chunk warning only.
  - `cd webui && PLAYWRIGHT_BASE_URL=http://89.125.103.24:8787/ui/ PLAYWRIGHT_API_KEY=... ./node_modules/.bin/playwright test tests/ntp-design.spec.ts --project=chromium --workers=1` — passed (`6 passed`).
  - Stand smoke on `89.125.103.24:8787`: `/health` returned `ok`, `/ntp` returned `applied_current=false` for the intentionally saved-but-not-applied disabled source state.
- Result summary:
  - Operators can see when disabled/enabled Sources are saved in desired JSON but Chrony is still running the previously applied configuration.

## 1.334) NTP/Chrony: explicit applied-runtime wording on Status

- Step scope:
  - Clarified the Status tab when desired NTP configuration has pending changes.
  - Added an `Applied config` status tile and an inline warning explaining that Status rows show the currently applied Chrony runtime until Apply runs.
  - Renamed Status summary labels to `Runtime service`, `Runtime sync`, `Runtime reference`, and `Runtime sources`.
- Ownership moved:
  - `webui/src/pages/ntp.tsx` owns the Status tab pending/apply wording.
  - `webui/tests/ntp-design.spec.ts` verifies the pending Status wording.
- Old entrypoint now delegates to:
  - Existing NTP API routes are unchanged.
- Verification commands:
  - `cd webui && npm run build` — passed; Vite emitted the existing large-chunk warning only.
  - `cd webui && PLAYWRIGHT_BASE_URL=http://89.125.103.24:8787/ui/ PLAYWRIGHT_API_KEY=... ./node_modules/.bin/playwright test tests/ntp-design.spec.ts --project=chromium --workers=1` — passed (`6 passed`).
  - Stand smoke on `89.125.103.24:8787`: served bundle `assets/index-zOQL7VFJ.js`.
- Result summary:
  - A disabled source saved in desired JSON can no longer be visually confused with the still-active runtime Chrony source list.

## 1.335) NTP/Chrony: immediate apply for Sources actions

- Step scope:
  - Changed Sources tab add/edit/delete/enable/disable actions from storage-only desired changes to immediate Chrony apply.
  - Source actions now save the changed Sources list, call `POST /ntp/apply`, refresh runtime status and clear pending apply state.
  - The source action path applies Sources on top of the last saved config to avoid accidentally activating unsaved Time/Server form edits.
- Ownership moved:
  - `webui/src/pages/ntp.tsx` owns the Sources auto-apply orchestration.
  - `webui/tests/ntp-design.spec.ts` verifies that Sources actions do not leave `pending apply`.
- Old entrypoint now delegates to:
  - Existing `PUT /ntp` and `POST /ntp/apply` routes are reused; backend API is unchanged.
- Verification commands:
  - `cd webui && npm run build` — passed; Vite emitted the existing large-chunk warning only.
  - `cd webui && PLAYWRIGHT_BASE_URL=http://89.125.103.24:8787/ui/ PLAYWRIGHT_API_KEY=... ./node_modules/.bin/playwright test tests/ntp-design.spec.ts --project=chromium --workers=1` — passed (`6 passed`).
  - Stand cleanup/apply on `89.125.103.24:8787`: removed invalid demo source `127.127.1.0 local`, restored `2.debian.pool.ntp.org`, and verified `applied_current=True`.
- Result summary:
  - Disabling a source removes it from generated Chrony config immediately and restarts Chrony through the existing apply path instead of leaving runtime status on the previous applied source.

## 1.336) NTP/Chrony: live ticking time display

- Step scope:
  - The Time tab system time summary and Manual time input now tick every second using the selected timezone.
  - Auto-ticking pauses after the operator edits manual date/time so typed values are not overwritten before Apply.
- Ownership moved:
  - `webui/src/pages/ntp.tsx` owns the local display clock tick.
  - `webui/tests/ntp-design.spec.ts` verifies that both visible time values advance.
- Old entrypoint now delegates to:
  - Existing NTP API routes are unchanged.
- Verification commands:
  - `cd webui && npm run build` — passed; Vite emitted the existing large-chunk warning only.
  - `cd webui && PLAYWRIGHT_BASE_URL=http://89.125.103.24:8787/ui/ PLAYWRIGHT_API_KEY=... ./node_modules/.bin/playwright test tests/ntp-design.spec.ts --project=chromium --workers=1` — passed (`7 passed`).
  - Stand smoke on `89.125.103.24:8787`: served bundle `assets/index-DUnjzsv7.js`.
- Result summary:
  - Time values no longer look frozen after opening the NTP page.

## 1.337) NTP/Chrony: default makestep for large initial offsets

- Step scope:
  - Diagnosed a real stand offset of about 856,000 seconds: `chronyc tracking` reported `System time ... seconds fast of NTP time`.
  - Corrected the stand clock through the existing authenticated `POST /ntp/sync` action.
  - Added `makestep 1.0 3` to generated `chrony.conf` whenever NTP client mode is enabled, so large startup offsets can be stepped automatically.
- Ownership moved:
  - `backend/domains/ntp/config_renderer.py` owns the default Chrony `makestep` directive.
  - `tests/test_ntp_service.py` covers the generated directive.
- Old entrypoint now delegates to:
  - Existing `/ntp/config-preview` and `/ntp/apply` routes are unchanged; they consume the updated renderer output.
- Verification commands:
  - `PYTHONPYCACHEPREFIX=/tmp/awg-pycache python3 -m pytest -q tests/test_ntp_service.py tests/test_ntp_runtime_ops.py tests/test_api_contract.py` — passed (`27 passed`).
  - `cd webui && npm run build` — passed.
  - Stand `89.125.103.24`: `POST /ntp/apply` succeeded, `/etc/chrony/chrony.conf` contains `makestep 1.0 3`.
  - Stand `89.125.103.24`: `chronyc tracking` after apply reported `System time : 0.000000120 seconds slow of NTP time`, `Stratum 3`.
- Result summary:
  - Large time drift after boot/restart is no longer left for slow slewing when Chrony can safely step during initial synchronization.

## 1.338) NTP/Chrony: Time Apply semantics and manual-time live test

- Step scope:
  - Made unsaved Time tab changes visually explicit: toggling `Enable NTP client` now shows `pending apply` until the main Time `Apply` is pressed.
  - Kept activation semantics unchanged and backend-first: the checkbox only changes desired form state; `PUT /ntp` and `POST /ntp/apply` run from the main Apply action.
  - Updated the live NTP Playwright scenario to verify manual time: disable NTP client, set manual date/time with Apply, enable NTP client again with Apply, and wait for Chrony synchronization to recover.
- Ownership moved:
  - `webui/src/pages/ntp.tsx` owns form-vs-applied dirty detection for the Time tab and Status warning.
  - `webui/tests/ntp-design.spec.ts` verifies the `pending apply` badge after changing the NTP client checkbox.
  - `webui/tests/ntp-live-actions.spec.ts` verifies the manual-time recovery flow on the stand.
- Old entrypoint now delegates to:
  - Existing NTP API routes are unchanged.
- Verification commands:
  - `PYTHONPYCACHEPREFIX=/tmp/awg-pycache python3 -m pytest -q tests/test_ntp_service.py tests/test_ntp_runtime_ops.py tests/test_api_contract.py` — passed (`27 passed`).
  - `cd webui && npm run build` — passed; Vite emitted the existing large-chunk warning only.
  - `cd webui && PLAYWRIGHT_BASE_URL=http://89.125.103.24:8787/ui/ PLAYWRIGHT_API_KEY=... ./node_modules/.bin/playwright test tests/ntp-design.spec.ts -g 'NTP design follows|Time values tick|loads live' --project=chromium --workers=1` — passed (`3 passed`).
  - `cd webui && PLAYWRIGHT_BASE_URL=http://89.125.103.24:8787/ui/ PLAYWRIGHT_API_KEY=... ./node_modules/.bin/playwright test tests/ntp-live-actions.spec.ts --project=chromium --workers=1` — passed (`1 passed`).
  - Stand `89.125.103.24`: after the live test, `/ntp` returned `ntp_enabled=True`, `applied_current=True`; `/ntp/status` returned `Leap status=Normal`, `System time=0.000029608s`, `chrony.service active`.
- Result summary:
  - The Time tab no longer implies that NTP client enable/disable is already active before Apply. Manual time was tested end-to-end and Chrony returned to normal synchronization after re-enabling the client.

## 1.339) NTP/Chrony: host-backed Time display after manual time

- Step scope:
  - Fixed the Time tab after manual date/time changes: the UI no longer uses the browser clock as the source of truth for `System time` and Manual time fields.
  - Added `current_time` to the read-only `/ntp/status` payload using fixed `date +%s`, then the frontend ticks locally from that host-time anchor.
  - Time Apply now sends `POST /ntp/timezone` on every apply so manual time is interpreted in the desired timezone, even if the host timezone drifted from saved JSON.
- Ownership moved:
  - `backend/domains/ntp/status_ops.py` owns host epoch collection for the runtime status snapshot.
  - `webui/src/frontend/domains/ntp/api.ts` owns the additive `current_time` status field.
  - `webui/src/pages/ntp.tsx` owns host-backed display ticking for the Time tab.
- Old entrypoint now delegates to:
  - Existing `/ntp/status`, `/ntp/timezone`, `/ntp/manual-time`, and `/ntp/apply` routes are reused; no route was renamed or removed.
- Verification commands:
  - `PYTHONPYCACHEPREFIX=/tmp/awg-pycache python3 -m pytest -q tests/test_ntp_status_ops.py tests/test_ntp_service.py tests/test_ntp_runtime_ops.py tests/test_api_contract.py` — passed (`31 passed`).
  - `cd webui && npm run build` — passed; Vite emitted the existing large-chunk warning only.
  - Temporary stand Playwright check on `89.125.103.24:8787`: Time panel `System time` contained `2026-07-30` after the user-set manual date; passed (`1 passed`).
  - Stand API smoke on `89.125.103.24`: `/ntp/status` returned `current_time=1785435197.0`, which is `2026-07-30T18:13:17+00:00`.
- Result summary:
  - The user-set manual date is now visible after save/reload because the Time panel follows the host runtime clock instead of the browser clock.

## 1.340) NTP/Chrony: checkbox changes stay form-only until Apply

- Step scope:
  - Removed the UI event-like `pending apply` reaction from Time form checkbox changes.
  - `Enable NTP client` and `Sync hardware clock (RTC)` now change only the local form; Time/Status runtime badges continue to represent the last applied Chrony configuration until the main `Apply` runs.
  - Kept the real runtime side effect only behind the main Time `Apply` button.
- Ownership moved:
  - `webui/src/pages/ntp.tsx` owns the split between local form state and applied runtime status presentation.
  - `webui/tests/ntp-design.spec.ts` verifies that toggling the NTP client checkbox does not show `pending apply`.
  - `webui/tests/ntp-live-actions.spec.ts` verifies that manual-time and NTP client state changes take effect only through `Apply`.
- Old entrypoint now delegates to:
  - Existing NTP API routes are unchanged.
- Verification commands:
  - `PYTHONPYCACHEPREFIX=/tmp/awg-pycache python3 -m pytest -q tests/test_ntp_status_ops.py tests/test_ntp_service.py tests/test_ntp_runtime_ops.py tests/test_api_contract.py` — passed (`31 passed`).
  - `cd webui && npm run build` — passed; Vite emitted the existing large-chunk warning only.
  - `cd webui && PLAYWRIGHT_BASE_URL=http://89.125.103.24:8787/ui/ PLAYWRIGHT_API_KEY=... ./node_modules/.bin/playwright test tests/ntp-design.spec.ts -g 'NTP design follows|loads live' --project=chromium --workers=1` — passed (`2 passed`).
  - `cd webui && PLAYWRIGHT_BASE_URL=http://89.125.103.24:8787/ui/ PLAYWRIGHT_API_KEY=... ./node_modules/.bin/playwright test tests/ntp-live-actions.spec.ts --project=chromium --workers=1` — passed (`1 passed`).
- Result summary:
  - Checkbox toggles are now quiet form edits; the operator sees the runtime/apply event only after pressing `Apply`.

## 1.341) NTP/Chrony: full host timezone catalog in Time tab

- Step scope:
  - Added authenticated read-only `GET /ntp/timezones` for the host timezone catalog from `timedatectl list-timezones`.
  - Replaced the static “Popular timezone” selector with a compact searchable timezone input backed by the host catalog and a safe fallback list.
  - Kept timezone changes as form edits: selecting a timezone immediately recalculates the displayed host-backed time, while system timezone/runtime changes still happen only through the main Time `Apply`.
- Ownership moved:
  - `backend/domains/ntp/runtime_ops.py` owns fixed-argv timezone catalog collection.
  - `backend/domains/ntp/service.py` exposes the read-only timezone list through the NTP domain service.
  - `webui/src/frontend/domains/ntp/api.ts` owns the typed `getNtpTimezones` API client.
  - `webui/src/pages/ntp.tsx` owns the searchable Time tab timezone input and display-time recalculation.
- Old entrypoint now delegates to:
  - `backend/app/router.py` continues delegating `/ntp/*` GET requests directly to `backend.domains.ntp.service.handle_get`; no facade/legacy path was added.
- Verification commands:
  - `PYTHONPYCACHEPREFIX=/tmp/awg-pycache python3 -m pytest -q tests/test_ntp_service.py tests/test_ntp_runtime_ops.py tests/test_ntp_status_ops.py tests/test_api_contract.py` — passed (`33 passed`).
  - `PYTHONPYCACHEPREFIX=/tmp/awg-pycache python3 -m pytest -q tests` — passed (`367 passed`).
  - `cd webui && npm run build` — passed; Vite emitted the existing large-chunk warning only.
  - `cd webui && PLAYWRIGHT_BASE_URL=http://89.125.103.24:8787/ui/ PLAYWRIGHT_API_KEY=... ./node_modules/.bin/playwright test tests/ntp-design.spec.ts --project=chromium --workers=1` — passed (`8 passed`).
  - Stand `89.125.103.24`: `GET /ntp/timezones` returned `313` zones and included `UTC`, `Europe/Moscow`, and `Asia/Tokyo`.
- Result summary:
  - Timezone selection is no longer limited to a hand-picked list, and the Time tab immediately shows the corrected host time for the selected timezone before Apply.

## 1.342) NTP/Chrony: compact timezone picker and UTC offset display

- Step scope:
  - Replaced the native browser timezone datalist with a compact page-local searchable dropdown that scrolls inside the Timezone card instead of expanding over the page.
  - Replaced the technical `Host timezones loaded` counter with the selected timezone UTC offset, e.g. `UTC+09:00`.
  - Kept timezone selection as a local form/display edit; runtime system timezone still changes only after the main Time `Apply`.
- Ownership moved:
  - `webui/src/pages/ntp.tsx` owns the compact timezone picker, filtering and UTC offset calculation.
  - `webui/tests/ntp-design.spec.ts` covers the scroll-limited picker and offset display.
- Old entrypoint now delegates to:
  - Existing NTP API routes are unchanged.
- Verification commands:
  - `cd webui && npm run build` — passed; Vite emitted the existing large-chunk warning only.
  - `cd webui && PLAYWRIGHT_BASE_URL=http://89.125.103.24:8787/ui/ PLAYWRIGHT_API_KEY=... ./node_modules/.bin/playwright test tests/ntp-design.spec.ts -g 'Timezone selector|NTP design follows' --project=chromium --workers=1` — passed (`2 passed`).
- Result summary:
  - The Timezone card now shows operator-relevant offset information and no longer relies on the browser's oversized native timezone suggestion list.

## 1.343) NTP/Chrony: timezone picker opens around current value

- Step scope:
  - Changed timezone picker focus behavior: opening the field now shows a scrollable list starting from the current timezone instead of filtering to a single exact match.
  - Kept typed search behavior unchanged: once the operator edits the text, the list filters by the typed substring.
- Ownership moved:
  - `webui/src/pages/ntp.tsx` owns timezone picker focus-vs-search behavior.
  - `webui/tests/ntp-design.spec.ts` verifies that opening the picker shows more than the current exact value.
- Old entrypoint now delegates to:
  - Existing NTP API routes are unchanged.
- Verification commands:
  - `cd webui && npm run build` — passed; Vite emitted the existing large-chunk warning only.
  - `cd webui && PLAYWRIGHT_BASE_URL=http://89.125.103.24:8787/ui/ PLAYWRIGHT_API_KEY=... ./node_modules/.bin/playwright test tests/ntp-design.spec.ts -g 'Timezone selector' --project=chromium --workers=1` — passed (`1 passed`).
- Result summary:
  - The timezone picker remains compact, but the operator can now browse from the currently selected timezone immediately after focusing the field.

## 1.344) NTP/Chrony: compact server panel and always-on client logging

- Step scope:
  - Removed the extra NTP Server hint cards from the Time tab to return the server settings block to a compact one-page layout.
  - Removed `Client stats` and `Log limit` controls from the Time tab; Chrony client logging is no longer user-toggleable in the UI.
  - `clientloglimit` is always rendered into generated `chrony.conf`, even when the NTP server listener is disabled.
- Ownership moved:
  - `backend/domains/ntp/config_renderer.py` owns unconditional `clientloglimit` rendering.
  - `backend/domains/ntp/validation_ops.py` normalizes `collect_client_statistics` to `true` for compatibility with existing stored JSON/API payloads.
  - `webui/src/pages/ntp.tsx` keeps the hidden desired-state fields backend-compatible while no longer exposing them as operator controls.
  - `tests/test_ntp_service.py` and `webui/tests/ntp-design.spec.ts` cover the always-on backend directive and removed UI fields.
- Old entrypoint now delegates to:
  - Existing NTP API routes are unchanged.
- Verification commands:
  - `PYTHONPYCACHEPREFIX=/tmp/awg-pycache python3 -m pytest -q tests/test_ntp_service.py tests/test_ntp_runtime_ops.py tests/test_ntp_status_ops.py tests/test_api_contract.py` — passed (`34 passed`).
  - `cd webui && npm run build` — passed; Vite emitted the existing large-chunk warning only.
  - `cd webui && PLAYWRIGHT_BASE_URL=http://89.125.103.24:8787/ui/ PLAYWRIGHT_API_KEY=... ./node_modules/.bin/playwright test tests/ntp-design.spec.ts -g 'NTP server settings|NTP design follows' --project=chromium --workers=1` — passed (`2 passed`).
  - Stand `89.125.103.24`: read-only `/ntp/config-preview` smoke returned `clientloglimit 2097152`.
- Result summary:
  - The server settings panel is less noisy, and Chrony client logging is now a stable generated-config behavior instead of an exposed operator toggle.

## 1.345) NTP/Chrony: state-aware list toolbar actions

- Step scope:
  - Updated Sources and Access toolbars so `Disable` is enabled only for selected enabled rows, and `Enable` is enabled only for selected disabled rows.
  - Kept `Add` always available and `Del` dependent on an actual selected row.
- Ownership moved:
  - `webui/src/pages/ntp.tsx` owns selected-row action availability for NTP list tabs.
  - `webui/tests/ntp-design.spec.ts` covers Sources and Access button states while enabling/disabling rows.
- Old entrypoint now delegates to:
  - Existing NTP API routes are unchanged.
- Verification commands:
  - `cd webui && npm run build` — passed; Vite emitted the existing large-chunk warning only.
  - `cd webui && PLAYWRIGHT_BASE_URL=http://89.125.103.24:8787/ui/ PLAYWRIGHT_API_KEY=... ./node_modules/.bin/playwright test tests/ntp-design.spec.ts -g 'NTP design follows' --project=chromium --workers=1` — passed (`1 passed`).
- Result summary:
  - Operators no longer see both enable and disable as active actions for a row that already has one of those states.

## 1.346) NTP/Chrony: safer list delete action

- Step scope:
  - Updated Sources and Access toolbars so `Del` is enabled for any selected row.
  - Deleting an enabled source/rule is a single operator action; the applied Chrony config is rewritten without that entry.
  - Preserved the selected source after enable/disable roundtrip so the next valid action remains visible immediately.
- Ownership moved:
  - `webui/src/pages/ntp.tsx` owns delete-action availability for NTP list tabs.
  - `webui/tests/ntp-design.spec.ts` covers disabled/enabled row delete-button states for Sources and Access.
- Old entrypoint now delegates to:
  - Existing NTP API routes are unchanged.
- Verification commands:
  - `cd webui && npm run build` — passed; Vite emitted the existing large-chunk warning only.
  - `cd webui && PLAYWRIGHT_BASE_URL=http://89.125.103.24:8787/ui/ PLAYWRIGHT_API_KEY=... ./node_modules/.bin/playwright test tests/ntp-design.spec.ts -g 'NTP design follows' --project=chromium --workers=1` — passed (`1 passed`).
- Result summary:
  - Operators can delete selected NTP sources/access rules directly; Enable/Disable still reflect the selected row state.

## 1.347) NTP/Chrony: unified delete button behavior

- Step scope:
  - Removed the Sources-only guard that kept `Del` disabled when only one source remained.
  - Aligned Sources with Access: selecting any row enables `Del`, and deletion rewrites the desired/applied Chrony configuration without that row.
- Ownership moved:
  - `webui/src/pages/ntp.tsx` owns consistent toolbar delete availability across NTP list tabs.
  - `webui/tests/ntp-design.spec.ts` verifies active rows expose `Del` in Sources and Access.
- Old entrypoint now delegates to:
  - Existing NTP API routes are unchanged.
- Verification commands:
  - `cd webui && npm run build` — passed; Vite emitted the existing large-chunk warning only.
  - `cd webui && PLAYWRIGHT_BASE_URL=http://89.125.103.24:8787/ui/ PLAYWRIGHT_API_KEY=... ./node_modules/.bin/playwright test tests/ntp-design.spec.ts -g 'NTP design follows' --project=chromium --workers=1` — passed (`1 passed`).
- Result summary:
  - The Sources and Access action panels now behave consistently for selected rows.

## 1.348) NTP/Chrony: lightweight auto-refresh

- Step scope:
  - Added lightweight desired-configuration polling for the NTP page so changes made in another browser/session are reflected without manual Refresh.
  - Kept polling safe: it is skipped while the user has unsaved local form changes, an editor dialog is open, or save/apply/service actions are running.
  - Reduced runtime status polling from 3 seconds to 15 seconds; displayed time continues ticking locally every second from the last Chrony status anchor.
- Ownership moved:
  - `webui/src/pages/ntp.tsx` owns NTP page auto-refresh and polling cadence.
  - `webui/tests/ntp-design.spec.ts` covers external desired-config refresh into the Time tab.
- Old entrypoint now delegates to:
  - Existing NTP API routes are unchanged.
- Verification commands:
  - `cd webui && npm run build` — passed; Vite emitted the existing large-chunk warning only.
  - `cd webui && PLAYWRIGHT_BASE_URL=http://89.125.103.24:8787/ui/ PLAYWRIGHT_API_KEY=... ./node_modules/.bin/playwright test tests/ntp-design.spec.ts -g 'auto-refreshes desired' --project=chromium --workers=1` — passed (`1 passed`).
  - `cd webui && PLAYWRIGHT_BASE_URL=http://89.125.103.24:8787/ui/ PLAYWRIGHT_API_KEY=... ./node_modules/.bin/playwright test tests/ntp-design.spec.ts -g 'NTP design follows' --project=chromium --workers=1` — passed (`1 passed`).
- Result summary:
  - NTP UI now picks up configuration changes from other sessions automatically while avoiding the previous heavy status polling pattern.

## 1.349) NTP/Chrony: optional Bind address control

- Step scope:
  - Changed the Time tab server `Bind address` field to the same compact optional-field pattern used in the Firewall rule editor.
  - Empty bind address now shows a dashed `0.0.0.0 / all interfaces` hint with a `+` button; pressing `+` inserts `0.0.0.0`, and `-` clears the field back to all interfaces.
- Ownership moved:
  - `webui/src/pages/ntp.tsx` owns the NTP server optional bind-address UI.
  - `webui/tests/ntp-design.spec.ts` covers the new `+` reveal behavior and submitted bind-address payload.
- Old entrypoint now delegates to:
  - Existing NTP API routes are unchanged.
- Verification commands:
  - `cd webui && npm run build` — passed; Vite emitted the existing large-chunk warning only.
  - `cd webui && PLAYWRIGHT_BASE_URL=http://89.125.103.24:8787/ui/ PLAYWRIGHT_API_KEY=... ./node_modules/.bin/playwright test tests/ntp-design.spec.ts -g 'NTP server settings' --project=chromium --workers=1` — passed (`1 passed`).
  - `cd webui && PLAYWRIGHT_BASE_URL=http://89.125.103.24:8787/ui/ PLAYWRIGHT_API_KEY=... ./node_modules/.bin/playwright test tests/ntp-design.spec.ts -g 'NTP design follows' --project=chromium --workers=1` — passed (`1 passed`).
- Result summary:
  - Bind address is visually aligned with the Firewall optional-field `+` pattern while keeping the generated Chrony API/config contract unchanged.

## 1.350) NTP/Chrony: rollback extra optional server controls

- Step scope:
  - Reverted the extra compact `+` reveal pattern for Time tab server controls after product-owner feedback.
  - `Bind interface`, server `Auth key`, `Use local clock`, `Local stratum`, `Orphan mode`, `Rate limit`, `Rate interval`, and `Rate burst` are back to the previous always-visible compact server grid.
  - Kept the earlier accepted optional `Bind address` behavior from section 1.349.
- Ownership moved:
  - `webui/src/pages/ntp.tsx` owns the restored NTP server grid controls.
  - `webui/tests/ntp-design.spec.ts` covers the restored disabled states and submitted server payload.
- Old entrypoint now delegates to:
  - Existing NTP API routes are unchanged.
- Verification commands:
  - `cd webui && npm run build` — passed; Vite emitted the existing large-chunk warning only.
  - `scp -r webui/dist/* root@89.125.103.24:/opt/awg_manager/webui/dist/ && ssh root@89.125.103.24 "grep -o 'assets/index-[^\" ]*' /opt/awg_manager/webui/dist/index.html | head -5"` — deployed `assets/index-Cv8LaWqz.js` and `assets/index-Bze3wAhC.css`.
  - `cd webui && PLAYWRIGHT_BASE_URL=http://89.125.103.24:8787/ui/ PLAYWRIGHT_API_KEY=... ./node_modules/.bin/playwright test tests/ntp-design.spec.ts -g 'NTP server settings|NTP design follows' --project=chromium --workers=1` — passed (`2 passed`).
- Result summary:
  - The NTP server panel returns to the simpler compact grid the product owner preferred.

## 1.351) NTP/Chrony: optional Listen port and Bind interface controls

- Step scope:
  - Added compact `+` reveal controls only for the Time tab server `Listen port` and `Bind interface` fields.
  - `Listen port` now stays collapsed as `123 / default` when the saved value is the Chrony/NTP default port; `+` reveals the numeric input, and `-` restores `123`.
  - `Bind interface` now stays collapsed as `all interfaces` when empty; `+` reveals an `eth0`-prefilled editable input, and `-` clears it.
- Ownership moved:
  - `webui/src/pages/ntp.tsx` owns the new optional server-field UI state and default-port fallback before payload generation.
  - `webui/tests/ntp-design.spec.ts` covers collapsed disabled states, reveal interactions, and submitted server payload.
- Old entrypoint now delegates to:
  - Existing NTP API routes are unchanged.
- Verification commands:
  - `cd webui && npm run build` — passed; Vite emitted the existing large-chunk warning only.
  - `scp -r webui/dist/* root@89.125.103.24:/opt/awg_manager/webui/dist/ && ssh root@89.125.103.24 "grep -o 'assets/index-[^\" ]*' /opt/awg_manager/webui/dist/index.html | head -5"` — deployed `assets/index-JqRA0dXc.js` and `assets/index-7283jWs3.css`.
  - `cd webui && PLAYWRIGHT_BASE_URL=http://89.125.103.24:8787/ui/ PLAYWRIGHT_API_KEY=... ./node_modules/.bin/playwright test tests/ntp-design.spec.ts -g 'NTP server settings|NTP design follows' --project=chromium --workers=1` — passed (`2 passed`).
- Result summary:
  - Rare server binding details are visually compact again without reintroducing the broader optional-block experiment that was rolled back in 1.350.

## 1.352) NTP/Chrony: compact Auth key selector draft

- Step scope:
  - Changed the Time tab server `Auth key` field to a compact optional control: default `none / no authentication` is collapsed, `+` reveals the key selector, and `-` restores `none`.
  - Added a small `Manage NTP keys` draft dialog next to the field to evaluate the future key-management flow without changing the backend key contract.
  - Background desired-config refresh pauses while the key dialog is open to avoid replacing visible operator context.
- Ownership moved:
  - `webui/src/pages/ntp.tsx` owns the Auth key optional UI and draft keys dialog.
  - `webui/tests/ntp-design.spec.ts` covers the collapsed Auth key state, key dialog visibility, and submitted server auth key payload.
- Old entrypoint now delegates to:
  - Existing NTP API routes are unchanged.
- Verification commands:
  - `cd webui && npm run build` — passed; Vite emitted the existing large-chunk warning only.
  - `scp -r webui/dist/* root@89.125.103.24:/opt/awg_manager/webui/dist/ && ssh root@89.125.103.24 "grep -o 'assets/index-[^\" ]*' /opt/awg_manager/webui/dist/index.html | head -5"` — deployed `assets/index-J5QA_00E.js` and `assets/index-DrDgO2Qg.css`.
  - `cd webui && PLAYWRIGHT_BASE_URL=http://89.125.103.24:8787/ui/ PLAYWRIGHT_API_KEY=... ./node_modules/.bin/playwright test tests/ntp-design.spec.ts -g 'NTP server settings|NTP design follows' --project=chromium --workers=1` — passed (`2 passed`).
- Result summary:
  - The server panel keeps authentication out of the default path while still giving an obvious entry point for future Chrony key management.

## 1.353) NTP/Chrony: стандартная таблица и кнопки в Manage NTP keys

- Step scope:
  - Привёл draft-окно `Manage NTP keys` к тому же list-паттерну, который используется в NTP Sources/Access и похожих IPsec/Firewall таблицах.
  - Добавил стандартную панель `Add / Del / Disable / Enable`, sortable-style заголовки и выбранную строку с тем же подсвечиванием, что у основных NTP таблиц.
  - Сохранил текущий статус окна как UI draft: backend-контракт ключей Chrony не менялся.
- Ownership moved:
  - `webui/src/pages/ntp.tsx` owns the key manager draft table/buttons styling.
  - `webui/tests/ntp-design.spec.ts` covers the key manager table headers, toolbar buttons, and selected row style.
- Old entrypoint now delegates to:
  - Existing NTP API routes are unchanged.
- Verification commands:
  - `cd webui && npm run build` — passed; Vite emitted the existing large-chunk warning only.
  - `scp -r webui/dist/* root@89.125.103.24:/opt/awg_manager/webui/dist/ && ssh root@89.125.103.24 "grep -o 'assets/index-[^\" ]*' /opt/awg_manager/webui/dist/index.html | head -5"` — deployed `assets/index-C2ndHoBJ.js` and `assets/index-BJYH_3c2.css`.
  - `cd webui && PLAYWRIGHT_BASE_URL=http://89.125.103.24:8787/ui/ PLAYWRIGHT_API_KEY=... ./node_modules/.bin/playwright test tests/ntp-design.spec.ts -g 'NTP server settings|NTP design follows' --project=chromium --workers=1` — passed (`2 passed`).
- Result summary:
  - The key manager dialog now visually matches the accepted compact admin-table style before backend key management is implemented.

## 1.354) NTP/Chrony: реальные authentication keys и chrony.keys

- Step scope:
  - Перевёл `Manage NTP keys` из UI draft в реальную часть desired JSON конфигурации.
  - Добавил валидацию Chrony key id, алгоритма, секрета, дублей и ссылок из Sources/Server.
  - Добавил генерацию `keyfile` в `chrony.conf` и отдельную запись `/etc/chrony/chrony.keys`.
  - Добавил UI для Add/Edit/Delete/Disable/Enable ключей; секреты маскируются в таблице, а edit может оставить secret пустым для сохранения текущего значения.
- Ownership moved:
  - `backend/domains/ntp/validation_ops.py` owns key schema and reference validation.
  - `backend/domains/ntp/config_renderer.py` owns `keyfile` and `chrony.keys` rendering.
  - `backend/domains/ntp/runtime_ops.py` owns atomic keyfile write, compare and rollback with `chrony.conf`.
  - `backend/domains/ntp/service.py` owns apply-state composition for desired config plus keyfile text.
  - `webui/src/pages/ntp.tsx` and `webui/src/frontend/domains/ntp/api.ts` own the key manager UI and typed frontend contract.
- Old entrypoint now delegates to:
  - Existing `/ntp` routes remain unchanged and still delegate through `backend.domains.ntp.service`.
- Verification commands:
  - `PYTHONPYCACHEPREFIX=/tmp/awg-pycache python3 -m pytest -q tests/test_ntp_service.py tests/test_ntp_runtime_ops.py tests/test_api_contract.py` — passed (`32 passed`).
  - `cd webui && npm run build` — passed; Vite emitted the existing large-chunk warning only.
  - `cd webui && PLAYWRIGHT_BASE_URL=http://89.125.103.24:8787/ui/ PLAYWRIGHT_API_KEY=... ./node_modules/.bin/playwright test tests/ntp-design.spec.ts --project=chromium --workers=1` — passed (`12 passed`).
  - `scp -r backend/domains/ntp root@89.125.103.24:/opt/awg_manager/backend/domains/ && scp -r webui/dist/* root@89.125.103.24:/opt/awg_manager/webui/dist/ && ssh root@89.125.103.24 'systemctl restart awg-manager-api.service && systemctl is-active awg-manager-api.service && grep -o "assets/index-[^\" ]*" /opt/awg_manager/webui/dist/index.html | head -5'` — deployed; service `active`, assets `index-DlKsyyVE.js` and `index-CbmRr78D.css`.
  - `curl -fsS -H 'X-API-Key: ...' http://89.125.103.24:8787/ntp` + `/ntp/status` smoke — passed; config `schema 1`, `applied True`, status service `active`, `errors 0`.
- Result summary:
  - Chrony authentication keys are now stored, validated, rendered and applied as first-class NTP module configuration instead of being a visual-only draft.

## 1.355) NTP/Chrony: генератор и просмотр secret для ключей

- Step scope:
  - Добавил в форму Add/Edit NTP key генератор `Secret`, зависящий от выбранного алгоритма: MD5/SHA1/SHA256/SHA384/SHA512 получают hex-секрет подходящей длины.
  - Добавил IPsec-like `eye` control для просмотра/скрытия секрета; после генерации значение раскрывается, чтобы оператор мог сразу проверить результат.
  - Сохранил маскирование секретов в таблице ключей и возможность при edit оставить secret пустым, чтобы не менять существующее значение.
- Ownership moved:
  - `webui/src/pages/ntp.tsx` owns the key secret generator and visibility state.
  - `webui/tests/ntp-design.spec.ts` covers generated secret length and show/hide behavior in the NTP key dialog.
- Old entrypoint now delegates to:
  - Existing NTP API routes are unchanged.
- Verification commands:
  - `cd webui && npm run build` — passed; Vite emitted the existing large-chunk warning only.
  - `scp -r webui/dist/* root@89.125.103.24:/opt/awg_manager/webui/dist/ && ssh root@89.125.103.24 'systemctl restart awg-manager-api.service && systemctl is-active awg-manager-api.service && grep -o "assets/index-[^\" ]*" /opt/awg_manager/webui/dist/index.html | head -5'` — deployed; service `active`, assets `index-CyZ7B27M.js` and `index-CbmRr78D.css`.
  - `cd webui && PLAYWRIGHT_BASE_URL=http://89.125.103.24:8787/ui/ PLAYWRIGHT_API_KEY=... ./node_modules/.bin/playwright test tests/ntp-design.spec.ts -g 'NTP design follows' --project=chromium --workers=1` — passed (`1 passed`).
  - `cd webui && PLAYWRIGHT_BASE_URL=http://89.125.103.24:8787/ui/ PLAYWRIGHT_API_KEY=... ./node_modules/.bin/playwright test tests/ntp-design.spec.ts --project=chromium --workers=1` — passed (`12 passed`).
- Result summary:
  - The NTP key editor now has the same practical secret workflow as IPsec identity: generate, inspect with eye, hide again, then save.
