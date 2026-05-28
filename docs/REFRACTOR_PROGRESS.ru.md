# Рефакторинг: прогресс работ

Обновлено: 2026-05-28

Цель итерации:
- параллельная модель разработки (`firewall` + `ipsec`) без конфликтов;
- инкрементальная декомпозиция `webui/src/pages/firewall.tsx`;
- без изменения внешнего HTTP API.

## Статус Master-Plan (без чекбоксов)

- Backend decomposition: `DONE (for awg_core removal-cycle scope)` (выполнены шаги `1.1`-`1.183`; `awg_core` переведен в compat shim, regression/docs lock закрыты).
- API contract layer: `DONE (for current refactor scope)` (wire-совместимость держится, `tests/test_api_contract.py` стабильно зеленый).
- Frontend decomposition: `IN PROGRESS` (доменный API split и большая часть firewall-декомпозиции сделаны, финальный e2e/regression gate еще впереди).
- Delivery model (A/B/C/D): `IN PROGRESS` (этапы A-B в работе, C-D pending: финальный cleanup + freeze window + merge).
- IPsec feature stream: `ON HOLD` (разрешены только структурные изменения в рамках рефакторинга, без новых фич).

## Быстрый Срез Прогресса

- Выполнено: `183` backend-этапов (`1.1`-`1.183`) с паритетными тестами.
- Текущее состояние монолита: `awg_core.py` = `7` строк (compat shim), runtime перенесен в `backend/app/legacy_manager_compat.py` (`1102` строки, на 2026-05-27).
- Уже переведено на модульные слои: `50+` явных интеграционных вызовов (`backend.common`, `firewall_store`, `firewall_runtime_adapter`, `firewall_compat_entry_ops`, `ipsec_compat_entry_ops`, `interfaces_compat_entry_ops`, `interfaces_cli_compat_entry_ops`).
- Введена базовая dev-документация по владению модулями/функциями (RU/EN): `docs/development/MODULE_MAP.ru.md`, `docs/development/MODULE_MAP.md`; добавлен `AGENTS.md` с правилами сопровождения рефакторинга.
- До полного remove-cycle по `awg_core.py` осталось: `0/4` блоков (`B1`-`B4` закрыты).
- Оценка по времени до удаления `awg_core.py` как файла: отдельный согласованный structural step (по текущему плану не обязателен, так как `compat shim` уже введен).
- Прогресс macro-этапов (оценка):
  - Этап 1 (thin-shim `manager_facade`): `100%` (завершен, guarded).
  - Этап 2 (истончение `awg_core.py`): `100%`.
  - Этап 3 (remove-cycle `B1`-`B4`): `100%`.
  - Общий backend decomposition до remove-cycle completion: `100%`.

## 2026-05-28 — Onboarding и единые правила для новых агентов

- Добавлена пара onboarding-документов для быстрого старта:
  - `docs/development/START_HERE.md` (EN)
  - `docs/development/START_HERE.ru.md` (RU)
- В `docs/development/README.md` добавлены ссылки на новые onboarding-файлы.
- В `START_HERE` зафиксированы:
  - обязательные first-steps;
  - архитектурные guardrails;
  - единый `Definition of Done`;
  - playbook-и по типам задач (`firewall`, структурный `ipsec`, `awg_core/manager_facade`).
- Проверки:
  - Тесты не запускались: изменения документационные, без изменения runtime-кода.

## 1) Инфраструктура и runtime-конфиги

- [x] Введен `AWG_MANAGER_DATA_DIR` (default `/etc/wg-manager`) в backend.
- [x] Переведены runtime пути state/key/db на `AWG_MANAGER_DATA_DIR`.
- [x] Добавлен `AWG_MANAGER_STAND_PROFILE` в env-шаблоны.
- [x] Расширен installer:
  - [x] `--data-dir`
  - [x] `--stand-profile`
- [x] Документация обновлена:
  - [x] `docs/DEPLOY.md`
  - [x] `docs/API.md`
  - [x] `docs/PARALLEL_DEVELOPMENT.md`

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
  - [x] `docs/REFRACTOR_PROGRESS.ru.md` — счетчик шагов до `1.177`.
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
  - [x] Обновлен статусный блок и быстрый срез в `docs/REFRACTOR_PROGRESS.ru.md`.
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
  - `webui/src/pages/firewall/PolicyBridgeObjectsTable.tsx`
- [x] Rule editor modal shell:
  - `webui/src/pages/firewall/PolicyAdvancedRuleEditorModal.tsx`
- [x] Bridge object modal extracted:
  - `webui/src/pages/firewall/PolicyBridgeObjectModal.tsx`
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
  - [x] `docs/DEPLOY.md` дополнен разделом `Final Single-Stand Redeploy From main`.

## 5) Коммит-политика

- [ ] Отдельные commits/PR для:
  - infra/runtime
  - ui refactor
  - docs/tests
- [ ] Без смешивания firewall/ipsec изменений в одном changeset.
