# Карта Модулей (RU)

Обновлено: 2026-05-28

Документ фиксирует зоны ответственности модулей в процессе модульного рефакторинга и показывает, какие функции за что отвечают.

## Архитектурные слои

1. `backend/app` — только HTTP-маршрутизация и сборка ответов.
2. `backend/domains/*` — доменная оркестрация и бизнес-логика.
3. `backend/common` — общие низкоуровневые хелперы (пути, JSON, ключи, ошибки).
4. `backend/app/legacy_manager_compat.py` — legacy runtime compatibility модуль (после удаления `awg_core.py`).

## Backend: владение модулями

### `backend/app/router.py`

- `handle_get/handle_post/handle_put/handle_delete`: диспетчеризация HTTP-маршрутов.
- `_handle_client_qr_path`: разбор пути `/clients/<id>/qr`.
- NTP-dispatch делегирует запросы `/ntp/*` в `backend.domains.ntp.service`.

### `backend/app/manager_facade.py`

- Compat backend-facade для manager-доступа.
  - экспортирует compat-константы для entrypoint/legacy-caller-ов: `bd_path`, `FIREWALL_SCHEMA`, `WG_INTERFACE_COLUMNS`
  - shared helper диспетчеризации вызовов: `_backend_partial_call` (инкапсулирует паттерн `partial + _backend_or_fallback` для thin-shim call-site-ов)
  - доступ к legacy bridge централизован через facade-helper-ы: `_legacy_manager_call`, `_legacy_manager_attr`
  - публичные facade call-site-ы унифицированы через `_backend_partial_call` для interfaces/support/auth/AWG, firewall и IPsec путей
  - structural guard-тесты фиксируют thin-shim инварианты в `tests/test_manager_facade_structure.py`
  - backend-first маршрутизация IPsec read/runtime:
    - `list_ipsec_peers_service`, `list_ipsec_identities_service`
    - `list_ipsec_policies_service`, `list_ipsec_phase1_profiles_service`, `list_ipsec_phase2_proposals_service`
    - `list_ipsec_events_service`, `list_ipsec_active_peers_service`, `list_ipsec_installed_sas_service`
    - `get_ipsec_config_preview_service`
  - backend-first маршрутизация IPsec write:
    - `upsert_ipsec_peer_service`, `upsert_ipsec_identity_service`, `upsert_ipsec_phase1_profile_service`
    - `upsert_ipsec_phase2_proposal_service`, `upsert_ipsec_policy_service`
    - `delete_ipsec_peer_service`, `delete_ipsec_policy_service`
  - backend-first маршрутизация IPsec action:
    - `load_ipsec_peer_service`, `initiate_ipsec_policy_service`
    - `terminate_ipsec_peer_service`, `apply_ipsec_config_service`
  - backend-first маршрутизация row-access для repository-слоя interfaces/clients:
    - `list_interfaces_rows`, `get_interface_row`, `get_interface_row_by_name`
    - `list_client_rows`, `get_client_row`
    - wiring fallback `sqlite -> manager.c` для row-access централизован через `_query_rows_with_manager_fallback` / `_query_row_with_manager_fallback`
    - импорт `awg_core` в row-access путях теперь fallback-only: fast-path DB чтения не выполняют eager-import manager-модуля
    - CRUD facade маршрутизация: `create_interface_row`, `update_interface_row`, `delete_interface_row`
    - CRUD facade маршрутизация: `create_client_row`, `update_client_row`, `delete_client_row`
  - backend-first путь выполнения interface CRUD:
    - `create_interface_row`, `update_interface_row`, `delete_interface_row` вызывают доменный `interfaces_service_ops` через sqlite контекст
    - runtime/apply и AWG/validation wiring проходят через локальные helper-ы facade
    - проекция `WG_INTERFACE_COLUMNS` берется из доменного `awg/schema.py` (а не из `awg_core`)
    - сохранен legacy/stub-safe fallback через `_backend_or_fallback` и `_is_stub_manager`
  - backend-first путь выполнения client CRUD:
    - `create_client_row`, `update_client_row`, `delete_client_row` вызывают доменный `interfaces_service_ops` через sqlite контекст
    - сохранен legacy/stub-safe fallback через `_backend_or_fallback` и `_is_stub_manager`
  - backend-first helper-ы рендеринга interfaces/clients для repository/service слоя:
    - `serialize_interface_row`, `serialize_client_row`
    - `build_client_config`, `build_interface_server_config`, `build_qr_svg`
  - backend-first маршрутизация helper-ов support/auth/backup для interfaces:
    - `read_database_bytes`, `restore_database_from_bytes`, `decode_base64_payload`
    - `load_api_key`, `save_api_key`, `verify_api_auth`, `rotate_api_key`
    - `detect_awg_version`, `prepare_awg_params_for_version`
    - callback-и `_backend_or_fallback` для interfaces/support/auth render путей связаны через `functools.partial` (вместо inline lambda)
    - shared callback `_append_config_param_normalized` используется в путях композиции client/server config render
    - call-site-ы `_backend_or_fallback` для interface/client CRUD связаны через `functools.partial` (без inline lambda-оберток)
    - callback wiring для interfaces runtime/AWG/IP-allocation централизован через именованные facade helper-ы + `functools.partial` (без inline lambda в callback-объявлениях)
    - wiring crypto-context (`_manager_crypto_context`) теперь идет из `backend.common.encryption_context` (без sourcing глобальных ключей из `awg_core`)
  - backend-first маршрутизация firewall service-методов:
    - rules/state/runtime: `list_firewall_rules_service`, `create_firewall_rule_service`, `update_firewall_rule_service`, `delete_firewall_rule_service`, `reorder_firewall_rules_service`, `reset_firewall_counters_service`, `get_firewall_state_service`, `apply_firewall_rules`
    - collections/tables/objects/schema: `list_firewall_sets_service`, `upsert_firewall_set_service`, `delete_firewall_set_service`, `list_firewall_maps_service`, `upsert_firewall_map_service`, `delete_firewall_map_service`, `list_firewall_tables_service`, `upsert_firewall_table_service`, `delete_firewall_table_service`, `list_firewall_named_objects_service`, `upsert_firewall_named_object_service`, `create_firewall_named_object_service`, `update_firewall_named_object_service`, `delete_firewall_named_object_service`, `get_firewall_schema_service`
    - wiring firewall JSON store/runtime теперь выполняется через callable-ы facade (`_read/_write_firewall_*`, `_collect_firewall_table_defs`) и прямые callback-и доменных `store/adapter` в `apply_firewall_rules`
    - facade `read/write` callback-и firewall store централизованы как именованные helper callable-ы (и partial там, где нужно), с сохранением динамического `_state_paths()`
    - managed-table/runtime/append-script callback-и в facade `apply/reset` путях централизованы в shared callable-ы (именованные helper-ы/partial; без lambda-адаптеров в callback-объявлениях)
    - wiring collection runtime helper-ов firewall (`normalize/timeout/enrich/cleanup/runtime-signature`) делегирован через `firewall_compat_entry_ops.build_collection_runtime_helpers`; wiring нормализации object/set/map/table и merge effective object остается в facade
    - пути `normalize_item_fn` в firewall service централизованы через shared facade callable-ы (`_normalize_firewall_*`), делегирующие в доменные normalizer-ы (без дублирования inline lambda в call-sites)
    - wiring callback-ов named-object parse/validation централизован через shared facade callback-ы (`_parse_firewall_named_objects_query`, `_validate_firewall_named_object_table_exists`)
    - wiring генерации rule-id в пути нормализации firewall централизован через callback `_generate_firewall_rule_id`
    - firewall call-site-ы service-методов унифицированы через `_backend_partial_call` (инкапсулированный dispatch `partial + fallback`) в путях rules/state/sets/maps и named-objects/tables/schema
    - backend-path IPsec read/write/action теперь связаны напрямую через `ipsec_service_layer_ops` через `_backend_partial_call` + shared facade helper-ы при сохранении `_backend_or_fallback`
    - callback wiring IPsec validation/crypto/event централизован в shared facade helper-ах семейства `_ipsec_*`; crypto-примитивы делегируются через `_manager_fernet_encrypt` / `_manager_fernet_decrypt`
    - wiring firewall schema берется напрямую из `backend.domains.firewall.schema.FIREWALL_SCHEMA` (без sourcing из `awg_core`)
  - fallback-маршрутизация:
    - `_backend_or_fallback` переключает вызов на service-wrapper в legacy-target модуле при ошибке backend-пути
    - ошибки firewall backend-валидации/отсутствующих ресурсов (`ValueError`, `LookupError`) пробрасываются из `_backend_or_fallback` напрямую и не уходят в legacy fallback, чтобы сохранить доменные/API-ответы валидации без изменения non-firewall compatibility fallback
    - dispatch fallback-вызова идет через `legacy_manager_bridge.call_manager_method` (единый app-layer seam для remove-cycle)
    - row-access fallback cursor резолвится через `legacy_manager_bridge.get_manager_attr("c")`; crypto fallback примитивы резолвятся через `legacy_manager_bridge.get_manager_attr("Fernet"/"InvalidToken")`
    - fallback call-site-ы (`_backend_or_fallback`, row-access, crypto и `__getattr__`) маршрутизируются через helper-ы `_legacy_manager_call` / `_legacy_manager_attr`
    - fallback-маршрутизация управляется env-переключателем `AWG_MANAGER_ENABLE_AWG_CORE_FALLBACK` (по умолчанию включена)
    - sqlite row-access helper-ы переключаются на `legacy_manager_compat.c`, если direct DB-path query недоступен
    - при отключенном fallback-toggle sqlite row-access helper-ы re-raise-ят DB-ошибку и не вызывают legacy manager
    - при отключенном fallback-toggle и отсутствии нативного `cryptography` backend crypto-context путь re-raise-ит ошибку без загрузки legacy manager
    - backend-only guard покрытие (`AWG_MANAGER_ENABLE_AWG_CORE_FALLBACK=0`) включает no-manager-call проверки для `list_ipsec_active_peers_service`, `apply_firewall_rules` и client CRUD facade-путей
  - `__getattr__`: проксирует manager-вызовы через `backend/app/legacy_manager_bridge.py`.

### `backend/app/legacy_manager_bridge.py`

- Изолированный compatibility-мост для fallback в legacy-target модуль.
  - `load_manager`: лениво загружает manager-модуль через `backend/app/legacy_manager_target.py`
  - `call_manager_method`: вызывает fallback service-метод у загруженного manager
  - `get_manager_attr`: проксирует доступ к атрибутам загруженного manager

### `backend/app/legacy_manager_target.py`

- Резолвер legacy fallback-target для bridge-слоя.
  - `resolve_manager_module_name`: определяет имя модуля из env (`AWG_MANAGER_LEGACY_TARGET_MODULE`, default `backend.app.legacy_manager_compat`)
  - `load_manager_module`: импортирует разрешенный manager-модуль

### `backend/app/legacy_manager_compat.py`

- Канонический legacy compatibility runtime-модуль для fallback-вызовов `manager_facade`.
- Содержит прежнюю compat-реализацию manager-API (cursor/crypto/service wrapper-ы) без изменения wire/API поведения.

### `backend/common`

- `data_paths.py`: `AWG_MANAGER_DATA_DIR` и runtime-пути к файлам состояния.
  - `resolve_data_dir`, `build_state_paths`
- `json_store.py`: универсальные JSON read/write с безопасными default-значениями.
  - `read_json`, `read_dict_or_default`, `write_json`
- `api_key_store.py`: загрузка/сохранение/ротация API key.
  - `load_api_key`, `save_api_key`, `rotate_api_key`
- `crypto_keys.py`: derivation ключей и fallback-дешифрование.
  - `derive_encryption_key_v2`, `derive_encryption_key_v1_legacy`, `decrypt_with_key_fallback`
- `crypto_facade_ops.py`: compatibility crypto-facade для оберток шифрования/дешифрования приватных ключей.
  - `encrypt_private_key`, `decrypt_private_key`
- `encryption_context.py`: централизованный bootstrap секрета/ключей шифрования с lazy-cache.
  - `load_encryption_secret`, `build_crypto_context`, `get_crypto_context`
- `http_errors.py`: маппинг сервисных ошибок в HTTP-ответы.
  - `send_service_error`
- `manager_access.py`: доступ к manager-объекту.
  - `get_manager` (возвращает `backend.app.manager_facade`)

### `backend/domains/firewall`

- `service.py`: HTTP-neutral обработчики домена firewall.
  - `handle_get`, `handle_post`, `handle_put`, `handle_delete`
- `repository.py`: стабильный CRUD-facade над storage/runtime операциями.
  - `list_rules`, `create_rule`, `update_rule`, `delete_rule`, `reorder_rules`, `reset_counters`
- `runtime_adapter.py`: интеграция с nft/runtime.
  - `apply_rules`, `list_tables`, `delete_table`, `build_runtime_counters_by_rule`
  - `parse_runtime_collections_from_ruleset_json`, `list_runtime_collections`: best-effort парсинг runtime-only overlay set/map/vmap из `nft -j list ruleset` без записи в manager state.
- `store.py`: JSON-персистентность и примитивы нормализации.
  - `read_*`/`write_*`, `normalize_set_item`, `normalize_map_item`, helper-ы по named-object/table
  - `normalize_map_item` владеет нормализацией entries для map/vmap и allowlist-валидацией verdict values для `vmap`.
- `schema.py`: канонические firewall-константы для compat-слоя и backend-facade.
  - `FIREWALL_TABLE_FAMILY`, `FIREWALL_SUPPORTED_TABLE_FAMILIES`, `FIREWALL_NAMED_OBJECT_KINDS`
  - `FIREWALL_TABLE_PREFIX`, `FIREWALL_SCHEMA`, `FIREWALL_DEFAULT_TABLE_DEFS`, `FIREWALL_RESERVED_PRIORITIES`
- `helper_service_ops.py`: общий firewall helper-composition слой для compat и facade.
  - timeout helper-ы: `normalize_nft_timeout`, `timeout_to_seconds`
  - collection runtime helper-ы: `enrich_collection_item_runtime`, `cleanup_expired_collection_rows`, `set_runtime_signature`, `map_runtime_signature`
  - named-object helper-ы: `normalize_logical_bool`, `empty_named_objects_by_kind`, `load_effective_table_objects_by_kind`, `validate_named_object_table_exists`
  - общий helper сбора table-defs: `collect_table_defs`
  - общий helper сборки table-script: `append_table_script_lines`
  - callback рендеринга named-object в script-assembly централизован через `_render_named_object_add_statement` + `functools.partial`
- `rule_ops.py`: нормализация/валидация firewall-rules и мутация списка правил.
  - `extract_normalized_rule_inputs`
  - `build_normalized_rule_payload`
  - `render_firewall_rule`
  - `append_enabled_rule_script_lines`
  - `resolve_table_chain_context`
  - `resolve_table_chain_context` владеет built-in `inet` table context и custom table context для `inet/ip/ip6/bridge/netdev`
  - `validate_action_target_reject_and_proto_fields` владеет валидацией `action`/`target_chain`/`reject_type`, а также L4 protocol token validation для именованных протоколов (`tcp`/`udp`/`icmp`/`icmpv6`) и numeric protocol ID (`0..255`), включая проверку допустимости портов для `tcp`/`udp`/`6`/`17`.
  - `normalize_proto_and_basic_match_fields` владеет базовой L3 address match валидацией для одного IP/CIDR-префикса или одной `@collection` ссылки в `src`/`dst`.
  - `validate_l4_icmp_literal_fields`
  - `normalize_nat_raw_fields`, `normalize_log_fields`
  - `normalize_meta_ct_fib_fields`, `normalize_l2_mark_fields`
  - `normalize_dynamic_set_statement_fields`
  - `normalize_vmap_statement_fields` владеет валидацией/рендер-полями первого scope named `vmap` rule statement (`vmap_stmt_expr`, `vmap_stmt_name`) для `inet` + `meta l4proto`.
  - `validate_bridge_disallowed_fields`, `validate_netdev_restrictions`
  - `validate_family_specific_restrictions`
- `rule_normalization_service_ops.py`: композиционный workflow полной нормализации firewall-правил.
  - `normalize_firewall_rule` (extract/validate/normalize/build payload pipeline)
  - validation target set для dynamic set statement подключена через существующий sets reader, при этом логика валидации остается в `rule_ops.py`; facade-нормализация принимает runtime validation flag от service layer и остается backend-first.
  - validation target named `vmap` statement подключена через существующий maps reader, при этом проверка expression/key-type остается в `rule_ops.py`.
  - default fallback генерации rule-id централизован через `_default_rule_id_factory`
- `named_object_ops.py`: нормализация named-objects, рендеринг, проверка ссылок.
  - `normalize_named_object_payload`, `render_named_object_add_statement`, `ensure_named_object_exists`
  - `normalize_named_object_payload` владеет eligibility matrix named-object family/kind: `ct_helper`/`ct_timeout` не поддерживаются для `netdev`, `ct_expectation` ограничен `inet/ip/ip6`, а `l3proto` должен совпадать с object family `ip`/`ip6`
  - default fallback генерации named-object id централизован через `_default_named_object_id_factory`
  - `validate_runtime_named_object_references` проверяет enabled named-object ссылки для non-netdev families правил (`inet/ip/ip6/bridge`)
  - `append_enabled_named_object_script_lines`
- `collection_ops.py`, `table_ops.py`, `state_ops.py`, `schema_ops.py`, `runtime_ops.py`: специализированные helper-модули для collection/table/state/schema/runtime сценариев.
  - `collection_ops.py`: `infer_map_token_type`, `format_map_token`, `build_map_declaration_and_elements`, `append_runtime_collection_script_lines`; `infer_map_token_type` также владеет protocol-token typing (`tcp/udp/icmp/...` -> `inet_proto`) для named `vmap` declarations.
- `service_layer_ops.py`: слой firewall compatibility-композиции для legacy compatibility service-оберток.
  - wiring rules/runtime/state: `list_rules`, `apply_rules`, `create_rule`, `update_rule`, `delete_rule`, `reorder_rules`, `reset_counters`, `get_state`
  - wiring collections/maps/tables/named-objects/schema: `list_sets`, `upsert_set`, `delete_set`, `list_maps`, `upsert_map`, `delete_map`, `list_tables`, `list_named_objects`, `upsert_named_object`, `create_named_object`, `update_named_object`, `delete_named_object`, `upsert_table`, `delete_table`, `get_schema`
  - callback-и межвкладочной уникальности set/map (`other_names`) централизованы через shared helper-итераторы и `functools.partial`
- `compat_entry_ops.py`: compat entry-слой firewall, который используется `backend.app.legacy_manager_compat`.
  - делегирует compat-обертки поверх `service_layer_ops` для paths rules/runtime/state и collections/maps/tables/named-objects/schema
  - фабрика collection runtime helper-ов, используемая и в `backend.app.legacy_manager_compat`, и в `backend.app.manager_facade`: `build_collection_runtime_helpers`

### `backend/domains/awg`

- `service.py`: оркестрация CRUD для interfaces/clients и backup/auth endpoint-ов.
  - `list_interfaces`, `create_interface`, `list_clients`, `create_client`, `restore_backup`, `rotate_api_key`
- `repository.py`: уровень персистентности и сериализации конфигов.
  - `serialize_client`, `build_client_config`, `build_qr_svg`
- `runtime_adapter.py`: runtime helper-ы для генерации конфигов, restore и AWG-параметров.
  - `build_interface_server_config`, `restore_database`, `detect_awg_version`, `prepare_awg_params`
- `ip_alloc_ops.py`: helper-ы аллокации/валидации IP в подсети интерфейса.
  - `get_next_available_ip`, `validate_client_ip_for_interface`
- `config_render_ops.py`: сериализация interface/client и рендеринг config-текста.
  - `serialize_interface_row`, `serialize_client_row`, `build_client_config`, `build_interface_server_config`
- `config_render_service_ops.py`: слой config-render композиции для compat-оберток в `backend.app.legacy_manager_compat`.
  - `serialize_interface_row`, `serialize_client_row`, `build_client_config`, `build_interface_server_config`
- `client_service_ops.py`: HTTP-neutral оркестрация CRUD клиентов.
  - `create_client_service`, `update_client_service`, `delete_client_service`
- `interface_service_ops.py`: HTTP-neutral оркестрация CRUD интерфейсов.
  - `create_interface_service`, `update_interface_service`, `delete_interface_service`
- `runtime_ops.py`: runtime helper-ы для key/config/apply потоков interfaces/clients.
  - `generate_keypair`, `create_temp_key_file`, `build_awg_set_command`
  - `apply_interface_runtime`, `remove_interface_runtime`, `append_config_param`, `build_client_config_lines`
  - `wg_lease_ip`, `add_peer`, `del_peer`
- `runtime_service_ops.py`: слой runtime-композиции для compat-оберток в `backend.app.legacy_manager_compat`.
  - `generate_keypair`, `create_temp_key_file`, `apply_interface_runtime`, `remove_interface_runtime`
  - `build_awg_set_command`, `append_config_param`, `build_client_config_lines`
- `service_ops.py`: сервисный слой композиции wiring для DB/runtime сценариев interfaces/clients.
  - композиция interface-сервисов: `create_interface_service`, `update_interface_service`, `delete_interface_service`
  - композиция client-сервисов: `create_client_service`, `update_client_service`, `delete_client_service`
  - композиция IP allocation: `get_next_available_ip`, `validate_client_ip_for_interface`
- `validation_ops.py`: валидация интерфейсов и проверки уникальности.
  - `parse_and_validate_interface_network`, `parse_and_validate_port`
  - `validate_ip_literal`, `validate_interface_name`, `assert_interface_uniqueness`
- `schema.py`: канонические константы DB-проекции для строк интерфейсов.
  - `WG_INTERFACE_COLUMNS`
- `awg_params_ops.py`: helper-ы определения версии AWG, подготовки/валидации параметров и их проекции.
  - `detect_awg_version`, `get_awg_param_keys_for_version`, `build_awg_params_from_row`
  - `generate_awg_obfuscation_params`, `prepare_awg_params_for_version`, `parse_h_value_or_range`, `validate_awg_params`
  - `format_awg_params_for_display`, `get_filtered_awg_params`, `prompt_awg_version`, `prompt_version_2_signature_params`
- `cli_list_ops.py`: CLI helper-ы листинга/рендеринга для клиентов и интерфейсов.
  - `list_clients`, `list_wg_int`, `list_wg_int_clients`
- `cli_misc_ops.py`: CLI helper-ы QR-конфига клиента и статуса/обновления API key.
  - `client_qrencode`, `show_api_key_status`, `set_api_key`
- `cli_peer_ops.py`: CLI helper интерактивного обновления peer-клиента.
  - `update_peer`
- `cli_interface_ops.py`: CLI helper-ы интерактивного add/delete/update интерфейсов.
  - `add_wg_int`, `del_wg_int`, `update_interface`
- `cli_legacy_ops.py`: legacy-совместимые CLI потоки, вынесенные из `awg_core.py`.
  - `add_client`, `delete_client`, `sync`
- `cli_legacy_service_ops.py`: слой legacy CLI-композиции wiring зависимостей DB/runtime для compat-оберток.
  - `add_client`, `delete_client`, `sync`
- `cli_service_ops.py`: слой CLI-композиции wiring зависимостей DB/runtime для CLI helper-ов.
  - `add_wg_int`, `del_wg_int`, `update_interface`, `update_peer`
- `cli_read_ops.py`: слой CLI-композиции read/query для list/qr сценариев.
  - `list_clients`, `list_wg_int`, `list_wg_int_clients`, `client_qrencode`
- `cli_support_ops.py`: слой CLI-композиции support wiring для auth/runtime helper-ов.
  - `show_api_key_status`, `set_api_key`, `wg_lease_ip`, `add_peer`, `del_peer`
- `cli_compat_entry_ops.py`: CLI compat entry-слой, который используется `backend.app.legacy_manager_compat`.
  - wiring legacy/read/support/service оберток: `add_client`, `delete_client`, `list_clients`, `list_wg_int`, `list_wg_int_clients`, `client_qrencode`, `show_api_key_status`, `set_api_key`, `wg_lease_ip`, `add_peer`, `del_peer`, `add_wg_int`, `del_wg_int`, `update_interface`, `update_peer`, `sync`
- `support_facade_ops.py`: support facade-слой для compat-оберток `awg_core.py` (auth/QR/backup/base64).
  - wiring API key/auth: `load_api_key`, `save_api_key`, `verify_api_auth`, `rotate_api_key`
  - QR helper-ы: `render_qr_in_terminal`, `build_qr_svg`
  - helper-ы backup/payload: `read_database_bytes`, `restore_database_from_bytes`, `decode_base64_payload`
- `compat_entry_ops.py`: compat entry-слой interfaces/clients, который используется `backend.app.legacy_manager_compat`.
  - wiring render/runtime/service оберток: `serialize_interface_row`, `serialize_client_row`, `build_client_config`, `build_interface_server_config`, `generate_keypair`, `create_temp_key_file`, `apply_interface_runtime`, `remove_interface_runtime`
  - wiring interface/client CRUD оберток: `create_interface_service`, `delete_interface_service`, `update_interface_service`, `create_client_service`, `delete_client_service`, `update_client_service`
  - wiring shared runtime/service helper-ов: `build_awg_set_command`, `append_config_param`, `build_client_config_lines`, `get_next_available_ip`, `validate_client_ip_for_interface`, `fetch_allowed_ips_row`, `fetch_interface_peer_rows`
  - wiring validation/uniqueness оберток: `parse_and_validate_interface_network`, `parse_and_validate_port`, `validate_ip_literal`, `assert_interface_uniqueness`, `validate_interface_name`
  - wiring support/auth/backup helper-ов: `load_api_key`, `save_api_key`, `verify_api_auth`, `rotate_api_key`, `render_qr_in_terminal`, `build_qr_svg`, `read_database_bytes`, `restore_database_from_bytes`, `decode_base64_payload`
  - wiring helper-ов AWG params: `_random_h_value`, `_random_h_range`, `generate_awg_obfuscation_params`, `get_awg_param_keys_for_version`, `detect_awg_version`, `build_awg_params_from_row`, `prepare_awg_params_for_version`, `parse_h_value_or_range`, `validate_awg_params`, `prompt_awg_version`, `prompt_version_2_signature_params`, `format_awg_params_for_display`, `get_filtered_awg_params`
- `schema.py`: schema-константы interfaces и helper-ы миграционного guard-слоя.
  - каноническая SELECT-проекция: `WG_INTERFACE_COLUMNS`
  - helper миграции схемы: `ensure_wg_interfaces_schema`
- `cli_support_ops.py`: CLI runtime helper-ы interfaces/clients.
  - runtime helper-ы peer-ов: `add_peer`, `del_peer`
  - helper записи key-файла: `write_text_file`

### `backend/domains/ipsec`

- `service.py`: route-level оркестрация для `/api/ipsec/*`.
  - `handle_get`, `handle_post`, `handle_put`, `handle_delete`
- `repository.py`: CRUD для peers/policies/profiles/identities/events.
  - `list_peers`, `upsert_peer`, `upsert_policy`, `delete_peer`, `delete_policy`
  - `delete_identity`, `delete_phase1_profile`, `delete_phase2_proposal`
- `runtime_adapter.py`: интеграция с активными peers/SAs и runtime-действиями.
  - `get_config_preview`, `apply_config`, `load_peer`, `initiate_policy`, `terminate_peer`
- `store.py`: JSON-хранилище и удержание истории событий.
  - `read_collection`, `write_collection`, `append_event`, `list_events`
- `validation_ops.py`: helper-ы нормализации IPsec payload и proposal-string.
  - `valid_name`, `normalize_ip_list`, `normalize_ts_list`
  - `build_phase1_proposal_string`, `build_phase2_proposal_string`
- `query_ops.py`: helper-ы безопасного list/existence-query для IPsec коллекций.
  - `list_ipsec_identities`, `ensure_item_exists_by_name`
  - identity list responses скрывают encrypted PSK, отдают `has_psk` и нормализуют legacy rows к `enabled: true`.
- `crud_ops.py`: helper-ы IPsec CRUD-оркестрации для peers/identities/profiles/policies.
  - владеет сохраненной metadata-настройкой `enabled` для peers, identities, phase profiles/proposals и policies.
  - `upsert_peer`, `upsert_identity`, `upsert_phase1_profile`, `upsert_phase2_proposal`, `upsert_policy`
  - `delete_peer`, `delete_policy`, `delete_identity`, `delete_phase1_profile`, `delete_phase2_proposal`
- `runtime_ops.py`: helper-ы runtime-оркестрации IPsec и интеграции с VICI/xfrm.
  - `log_event`, `list_events`, `vici_session`, `collect_refs`
  - `build_vici_connection_for_peer`, `build_vici_secret_for_peer`, `build_vici_secret_metadata_for_peer`
  - `build_config_preview` собирает read-only preview VICI `load_conn` и metadata secrets без открытия VICI-сессии и без раскрытия PSK.
  - `sanitize_vici_sas`, `extract_active_peers_from_sas`, `extract_installed_sas_from_sas`
  - `run_ip_xfrm_best_effort`, `list_active_peers`, `list_installed_sas`
  - `load_peer`, `initiate_policy`, `terminate_peer`, `apply_config`
  - runtime-effective `load/apply` каскадно останавливает и выгружает peers, если отключены сам peer, identity, Phase 1 profile, набор enabled policies или связанный Phase 2 proposal.
- `service_ops.py`: сервисный слой композиции IPsec, связывающий collections/CRUD/runtime через контрактно-совместимые адаптеры.
  - list/read сервисы: `list_peers_service`, `list_identities_service`, `list_phase1_profiles_service`, `list_phase2_proposals_service`, `list_policies_service`
  - проверки существования: `ensure_peer_exists`, `ensure_phase1_exists`, `ensure_phase2_exists`
  - CRUD-композиция: `upsert_peer_service`, `upsert_identity_service`, `upsert_phase1_profile_service`, `upsert_phase2_proposal_service`, `upsert_policy_service`, `delete_peer_service`, `delete_policy_service`, `delete_identity_service`, `delete_phase1_profile_service`, `delete_phase2_proposal_service`
  - runtime-композиция: `log_event_service`, `list_events_service`, `list_active_peers_service`, `list_installed_sas_service`, `get_config_preview_service`, `load_peer_service`, `initiate_policy_service`, `terminate_peer_service`, `apply_config_service`
- `service_layer_ops.py`: слой IPsec compatibility-композиции для legacy compatibility service-оберток.
  - list/read wiring: `list_peers`, `list_identities`, `list_phase1_profiles`, `list_phase2_proposals`, `list_policies`
  - CRUD wiring: `upsert_peer`, `upsert_identity`, `upsert_phase1_profile`, `upsert_phase2_proposal`, `upsert_policy`, `delete_peer`, `delete_policy`, `delete_identity`, `delete_phase1_profile`, `delete_phase2_proposal`
  - runtime wiring: `log_event`, `list_events`, `list_active_peers`, `list_installed_sas`, `get_config_preview`, `load_peer`, `initiate_policy`, `terminate_peer`, `apply_config`
- `compat_entry_ops.py`: compat entry-слой IPsec, который используется `backend.app.legacy_manager_compat`.
  - инкапсулирует callback wiring для store/validation/proposal/crypto/event helper-ов поверх `service_layer_ops`
  - экспортирует compatibility-обертки: `list_*`, `upsert_*`, `delete_*`, `list_events_service`, `list_active_peers_service`, `list_installed_sas_service`, `get_config_preview_service`, `load_peer_service`, `initiate_policy_service`, `terminate_peer_service`, `apply_config_service`
- `service_facade_ops.py`: facade-слой IPsec, инкапсулирующий legacy compatibility helper wiring (store/validation/crypto/files).
  - helper wiring: `_read_collection`, `_write_collection`, `_valid_name`, `_normalize_ip_list`, `_normalize_ts_list`
  - wiring proposal/secret: `_build_phase1_proposal_string`, `_build_phase2_proposal_string`, `_secret_encrypt`, `_secret_decrypt`
  - публичные service-обертки: `list_*`, `upsert_*`, `delete_*`, `list_events_service`, `list_active_peers_service`, `list_installed_sas_service`, `get_config_preview_service`, `load_peer_service`, `initiate_policy_service`, `terminate_peer_service`, `apply_config_service`

### `backend/domains/ntp`

- `service.py`: HTTP-neutral оркестрация желаемой конфигурации Chrony, read-only preview, определения неприменённых изменений и явного apply.
  - `get_config`, `get_config_with_apply_state`, `save_config`, `get_config_preview`, `apply_config`, `handle_get`, `handle_put`, `handle_post`
- `validation_ops.py`: дефолты схемы, нормализация payload, проверки диапазонов, разбор сетей, проверка ссылок на authentication keys и защита от внедрения новых строк.
  - желаемая конфигурация содержит `time`, `sources`, `server`, `access` и `keys`; версия схемы — `1`; `time.rtcsync` управляет генерацией директивы Chrony `rtcsync`
- `store.py`: атомарное JSON-хранилище `${AWG_MANAGER_DATA_DIR}/ntp_config.json`.
- `config_renderer.py`: детерминированная read-only генерация `chrony.conf` из нормализованного desired state и генерация `chrony.keys` для включённых authentication keys, включая дефолтную директиву `makestep 1.0 3`, когда включён NTP client mode, и всегда включённую директиву `clientloglimit` для клиентской статистики Chrony.
- `runtime_ops.py`: проверяет сгенерированный конфиг через `chronyd -p`, сравнивает desired config/keyfile с установленными `/etc/chrony/chrony.conf` и `/etc/chrony/chrony.keys`, сохраняет backup и атомарно заменяет оба файла, маскирует конкурирующие синхронизаторы времени, включает/перезапускает Chrony, получает каталог таймзон хоста через `timedatectl list-timezones` и восстанавливает предыдущий конфиг/keyfile при ошибке активации.
  - владеет privileged fixed-argv действиями для timezone, ручного времени, `chronyc makestep`, restart и reload-or-restart
  - manual time временно останавливает Chrony, выполняет `timedatectl set-time`, снова запускает Chrony, проверяет active state и преобразует command failures в понятные оператору ошибки
- `status_ops.py`: собирает состояние сервиса через `systemctl`, epoch-время хоста через `date +%s`, состояние системных часов через `timedatectl show` и преобразует CSV-вывод `chronyc -n -c` для tracking, activity, sources и source statistics в структурированный read-only snapshot с частичными ошибками.
- Домен никогда не управляет firewall.

### `awg_core.py` (удален)

- `awg_core.py` удален.
- Legacy runtime compatibility теперь обеспечивается через `backend.app.legacy_manager_compat`.
- Упоминания `awg_core.py` ниже — исторические примечания миграции.

- HTTP/API bootstrap больше не импортирует `awg_core` напрямую:
  - `api_core.py` теперь использует `backend.app.manager_facade` как manager-entrypoint.
  - `manager_facade` сохраняет compatibility fallback в `backend.app.legacy_manager_compat` для остаточных путей, при этом ослабляя import-граф app-слоя.
- CLI bootstrap больше не импортирует `awg_core` напрямую:
  - `awg_manager.py` теперь использует `backend.app.manager_facade` как manager-entrypoint для CLI-действий.
  - прямые `import awg_core` удалены из `.py` entrypoint-ов проекта.
- Firewall compat-обертки сокращены до orchestration wiring и делегируют normalizer/runtime helper-ы напрямую в доменные модули.
  - firewall compat-service wrapper-блок в `backend.app.legacy_manager_compat` сведен к `functools.partial` делегатам (включая дефолты `family/table/apply_now/table`), сохраняя тонкую shim-поверхность.
  - позиционная fallback-совместимость перенесена в `backend/app/manager_facade.py` через именованные `fallback_kwargs`, поэтому временные firewall wrapper-def shim-обертки удалены из `awg_core.py`.
  - прямой доменный wiring нормализации в service-обертках:
    - `upsert_firewall_set_service` -> `firewall_store.normalize_set_item`
    - `upsert_firewall_map_service` -> `firewall_store.normalize_map_item`
    - `upsert_firewall_named_object_service` -> `firewall_named_object_ops.normalize_named_object_payload`
    - `upsert_firewall_table_service` -> `firewall_store.normalize_firewall_table_item`
    - wiring callback-ов `normalize_item_fn` централизован через shared `_normalize_firewall_*` callable-ы (доменная делегация сохранена)
    - callback-и bool/table validation для named-object wiring идут напрямую в `firewall_helper_service_ops` (без локальных compat-wrapper-ов)
    - wiring callback-ов named-object parse/validation централизован через shared compat callback-ы (`_parse_firewall_named_objects_query`, `_validate_firewall_named_object_table_exists`)
  - merge effective named-object runtime выполняется через `firewall_helper_service_ops.load_effective_table_objects_by_kind` с прямым callback в runtime-adapter (`firewall_runtime_adapter.list_table_objects_by_kind`)
  - callback-и effective-objects и table-defs связаны как shared callable-ы (микс partial/def для сохранения import-time безопасности)
  - compat-обертки firewall store `read_*`/`write_*` связаны напрямую через `functools.partial` (path-bound adapters)
  - callback-и timeout/runtime-signature в compat также связаны через `functools.partial`; `enrich_collection_item_runtime` оставлен функцией для optional `now_ts`
  - callback генерации rule-id в пути нормализации firewall централизован через `_generate_firewall_rule_id`
  - сборка table script делегирована в `firewall_helper_service_ops.append_table_script_lines` через `functools.partial` callback binding (общий путь с `manager_facade`)
  - сбор table-defs делегирован в `firewall_helper_service_ops.collect_table_defs` (общий путь с `manager_facade`)
  - wiring managed-table parse/key/runtime-table в `apply_firewall_rules` делегирован напрямую в callback-и `firewall_store`/`firewall_runtime_adapter` через shared compat callable-ы (`functools.partial`)
  - оставшийся interfaces/IPsec compat callback wiring централизован через именованные helper-ы (`_run_command_checked`, `_fernet_encrypt`, `_fernet_decrypt`, `_fetch_allowed_ips_row`, `_fetch_interface_peer_rows`, helper-ы uniqueness для interfaces); `_fernet_*` оформлены как компактные lambda-alias.
  - interfaces validation/support/AWG helper-обертки сведены к прямым alias/partial делегатам на `interfaces_compat_entry_ops` (минимальная compat shim-поверхность в `backend.app.legacy_manager_compat`)
  - interfaces utility/crypto wrapper-ы (`generate_keypair`, `create_temp_key_file`, `remove_interface_runtime`, `build_awg_set_command`, `append_config_param`, `build_client_config_lines`, `get_next_available_ip`, `validate_client_ip_for_interface`, `encrypt_private_key`, `decrypt_private_key`) сведены к `functools.partial` делегатам
  - из `awg_core.py` убрано дублирование inline lambda/wrapper wiring для путей выше за счет shared callable-ов (без изменения wire/API контракта).
- IPsec compat-обертки делегируют в `backend.domains.ipsec.compat_entry_ops` (тонкий entry wiring в доменном слое); локальный `_ipsec_*` helper wiring удален из `awg_core.py`.
  - блок IPsec service-оберток в `backend.app.legacy_manager_compat` сведен к `functools.partial`/alias делегатам с bind файловых/crypto callback-ов.
- interfaces/clients compat-обертки для render/runtime/service путей делегируют в `backend.domains.awg.compat_entry_ops`; прямой wiring к `*_service_ops` модулям вынесен из `awg_core.py`.
  - дополнительная группа interfaces render/service wrapper-ов сведена к `functools.partial` там, где безопасен порядок инициализации (`serialize_interface_row`, `serialize_client_row`, `build_client_config`, `build_interface_server_config`, `apply_interface_runtime`, `create_interface_service`, `delete_interface_service`, `update_interface_service`, `create_client_service`, `update_client_service`, `delete_client_service`).
  - оставшийся callback wiring (`write_text_file`) делегирован через `interfaces_cli_compat_entry_ops.write_text_file` в доменные CLI helper-ы (без локальных `def`-оберток).
- ownership startup/bootstrap helper-ов вынесен из локальных wrapper-ов:
  - нормализация config-значений: `backend.common.value_normalization.normalize_config_value`
  - guard миграции `wg_interfaces`: `backend.domains.awg.schema.ensure_wg_interfaces_schema`
  - bootstrap encryption-secret встроен напрямую в startup-инициализацию (`-r` путь к файлу или интерактивный prompt), без compat-wrapper-ов.
- interfaces/clients CLI/support compat-обертки делегируют в `backend.domains.awg.cli_compat_entry_ops`; прямой wiring к `cli_*_ops` модулям вынесен из `awg_core.py`.
  - CLI support/runtime wrapper-ы, не зависящие от позднего bind callback-ов, сведены к `functools.partial` (`show_api_key_status`, `set_api_key`, `wg_lease_ip`, `add_peer`, `del_peer`, `add_wg_int`, `del_wg_int`, `update_interface`, `sync`, `list_clients`, `list_wg_int`, `list_wg_int_clients`, `client_qrencode`, `update_peer`).
  - callback-чувствительные пути после реордера зависимостей тоже сведены к `functools.partial` (`add_client`); из CLI остался только `delete_client` как тонкая `def`-обертка, потому что он связывает callback-ы, объявленные ниже по модулю.
- firewall compat-обертки делегируют в `backend.domains.firewall.compat_entry_ops`; прямой compat wiring к call-site `firewall_service_layer_ops` вынесен из `awg_core.py`.

## Frontend: доменные API-клиенты

### `webui/src/frontend/domains/common/api.ts`

- Общие HTTP/auth helper-ы:
  - `headers`, `parseError`, `downloadBackup`, `restoreBackup`

### `webui/src/frontend/domains/firewall/api.ts`

- Клиент контрактов Firewall API:
  - state/rules: `getFirewallState`, `getFirewallRules`, `createFirewallRule`, `updateFirewallRule`, `deleteFirewallRule`, `reorderFirewallRules`, `applyFirewallRules`, `resetFirewallCounters`
  - rules выставляют optional поля dynamic set statement `set_stmt_*` без изменения обязательной формы payload.
  - rules выставляют optional поля named verdict map statement `vmap_stmt_*` без изменения обязательной формы payload.
  - sets выставляют optional safety/runtime поля `dynamic`, `size`, `gc_interval`.
  - objects/sets/maps/tables: `getFirewallObjects`, `upsertFirewallObject`, `deleteFirewallObject`, `getFirewallSets`, `upsertFirewallSet`, `getFirewallMaps`, `upsertFirewallMap`, `getFirewallTables`, `upsertFirewallTable`

### `webui/src/frontend/domains/interfaces_clients/api.ts`

- Interfaces/clients + AWG params:
  - `getInterfaces`, `createInterface`, `updateInterface`, `deleteInterface`
  - `getClients`, `createClient`, `updateClient`, `deleteClient`
  - `getInterfaceConfig`, `getClientConfig`, `getClientQrSvg`, `generateAwgParams`

### `webui/src/frontend/domains/ipsec/api.ts`

- Клиент контрактов IPsec API:
  - CRUD: `getIpsecPeers`, `upsertIpsecPeer`, `deleteIpsecPeer`, `getIpsecPolicies`, `upsertIpsecPolicy`, `deleteIpsecPolicy`, `deleteIpsecIdentity`, `deleteIpsecPhase1Profile`, `deleteIpsecPhase2Proposal`
  - runtime/actions: `applyIpsec`, `getIpsecActivePeers`, `getIpsecInstalledSas`, `getIpsecConfigPreview`, `initiateIpsecPolicy`, `terminateIpsecPeer`

### `webui/src/frontend/domains/ntp/api.ts`

- Типизированный клиент контрактов NTP/Chrony API:
  - desired state: `getNtpConfig`, `putNtpConfig`
  - runtime/read-only support: `applyNtpConfig`, `getNtpStatus`, `getNtpTimezones`, `setNtpTimezone`, `setNtpManualTime`, `syncNtpNow`, `restartNtp`, `reloadNtp`

### `webui/src/pages/ntp.tsx`

- Владеет утверждённым UI Time/Sources/Access/Status и преобразует состояние форм в NTP schema version `1`.
- Параллельно загружает desired config и runtime status, запрещает редактирование до hydration, использует одну реальную операцию Apply и обновляет Chrony status, пока открыта вкладка Status.
- Загружает каталог таймзон хоста для селектора Time tab и сразу пересчитывает отображаемое host-backed время при смене выбранной timezone.
- Владеет privileged action-оркестрацией для system timezone, ручного времени, sync-now, restart и reload-or-restart, сохраняя их визуально отделёнными от config Apply.

## Frontend: владение Firewall UI

### `webui/src/pages/firewall.tsx` и `webui/src/pages/firewall/*`

- `FirewallSectionTabs`: владеет верхними секциями Firewall. `policy2`/`policy3` больше не показываются как отдельные верхние вкладки; bridge/netdev rules доступны из единого раздела `policy`, а управление nftables named-objects вынесено в отдельный раздел `objects` после `collections`.
- `PolicySectionToolbar`: владеет выбором таблицы в Policy. Быстрые `filter`/`nat`/`raw`/`mangle` остаются `inet`-контекстом; custom selector стал family-aware и хранит контекст таблицы как `(family, table)`.
- `PolicyRuleEditorDialog` и `PolicyRuleEditor*Tab`: владеют единой Add/Edit формой правил для `inet/ip/ip6/bridge/netdev` контекстов. Add/Edit правил bridge/netdev теперь использует тот же Policy modal; bridge-specific interface поля, non-netdev named-object bindings с быстрым unlink, inet/ip/ip6 `ct_expectation_set`, runtime-safe controls dynamic set statement для `inet`, runtime-safe controls named `vmap` для `inet` и netdev `fwd`/общий `queue` включаются по `family`. Action tab владеет короткими why-disabled подсказками для `inet`-only dynamic set/verdict map controls, доступности NAT actions по контексту family/table/chain, отключенного `ct_expectation` в `bridge` и отключенных named-object bindings в `netdev`.
- `FirewallObjectsPanel`: владеет управлением named-objects в отдельном разделе `objects`. Переиспользует существующий API `/firewall/objects` и `FirewallObjectModal`, scoped по выбранным `family/table`, включает `use-in-rule` для `inet/ip/ip6/bridge` и оставляет netdev object bindings выключенными.
- `useFirewallPageGuards`, `usePolicyRuleFormContext`, `usePolicyRuleEditorSync`, `usePolicyRuleEditorActions`, `usePolicyRulesView`: владеют wiring единого Policy-контекста для выбранной family/name таблицы правил, списка chain, default create/edit значений, save-payload sanitization и фильтрации видимых правил, включая object-binding фильтры для non-netdev policy tables из единого object panel; `usePolicyRuleEditorActions` также очищает `set_stmt_*`, если выбранная family или состояние формы вне поддержанного `inet` scope dynamic set statement.
- `useFirewallDataSync`: владеет refresh orchestration страницы Firewall и подгружает named objects для non-netdev policy tables, чтобы Add/Edit rule selectors оставались синхронизированы после Objects `use in rule`.
- `firewallObjectForm`, `firewallObjectSummary`, `firewallObjectBindings`, `useFirewallObjectState`, `useFirewallObjectActions`, `useFirewallObjectEditor`, `useFirewallObjectBindings` и `FirewallObjectModal`: владеют состоянием object form, summaries, binding usage keys, selection/filter state, create/edit/delete actions, modal presets, create/edit `ct_expectation` object для `inet/ip/ip6` и non-netdev use-in-rule orchestration за `FirewallObjectsPanel`. Исторические `PolicyAdvancedPage`/`PolicyAdvancedSection`, старый `PolicyAdvancedRuleEditor*` и старые имена helper-ов `PolicyV2`/`PolicyBridgeObject` удалены из активного UI bundle.
- Старые entrypoint-ы делегируют через единый Policy shell: скрытые возможности `policy2`/`policy3` выбираются по family (`bridge`/`netdev`), а не по видимым вкладкам; API payload и backend validation не менялись.

## Правило для новых шагов рефакторинга

Когда функция переносится из `awg_core.py`:

1. Обновить владение модулем в этом файле.
2. Обновить `docs/development/MODULE_MAP.md` с эквивалентной информацией.
3. Обновить `docs/development/REFRACTOR_PROGRESS.ru.md` (номер шага + результаты тестов).
