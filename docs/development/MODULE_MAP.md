# Module Map (EN)

Last updated: 2026-05-27

This document tracks module ownership during the modular refactor and explains which functions are responsible for what.

## Architectural Layers

1. `backend/app` — HTTP routing and response wiring only.
2. `backend/domains/*` — domain orchestration and business logic.
3. `backend/common` — shared low-level helpers (paths, JSON, keys, errors).
4. `backend/app/legacy_manager_compat.py` — legacy runtime compatibility module (post-`awg_core.py` removal).

## Backend: Module Ownership

### `backend/app/router.py`

- `handle_get/handle_post/handle_put/handle_delete`: route dispatch for HTTP methods.
- `_handle_client_qr_path`: parses `/clients/<id>/qr` path shape.

### `backend/app/manager_facade.py`

  - Compatibility backend facade for manager access.
    - exposes compat constants for entrypoint/legacy callers: `bd_path`, `FIREWALL_SCHEMA`, `WG_INTERFACE_COLUMNS`
    - shared call-dispatch helper: `_backend_partial_call` (encapsulates `partial + _backend_or_fallback` pattern for thin-shim call sites)
    - legacy bridge access is centralized via facade-local helpers: `_legacy_manager_call`, `_legacy_manager_attr`
    - public facade call-sites are unified through `_backend_partial_call` across interfaces/support/auth/AWG, firewall, and IPsec paths
    - structural guard tests enforce thin-shim invariants in `tests/test_manager_facade_structure.py`
  - backend-first IPsec read/runtime routing:
    - `list_ipsec_peers_service`, `list_ipsec_identities_service`
    - `list_ipsec_policies_service`, `list_ipsec_phase1_profiles_service`, `list_ipsec_phase2_proposals_service`
    - `list_ipsec_events_service`, `list_ipsec_active_peers_service`, `list_ipsec_installed_sas_service`
  - backend-first IPsec write routing:
    - `upsert_ipsec_peer_service`, `upsert_ipsec_identity_service`, `upsert_ipsec_phase1_profile_service`
    - `upsert_ipsec_phase2_proposal_service`, `upsert_ipsec_policy_service`
    - `delete_ipsec_peer_service`, `delete_ipsec_policy_service`
  - backend-first IPsec action routing:
    - `load_ipsec_peer_service`, `initiate_ipsec_policy_service`
    - `terminate_ipsec_peer_service`, `apply_ipsec_config_service`
  - backend-first interfaces/clients row-access routing for repository layer:
    - `list_interfaces_rows`, `get_interface_row`, `get_interface_row_by_name`
    - `list_client_rows`, `get_client_row`
    - sqlite->manager cursor fallback wiring for row-access is centralized via `_query_rows_with_manager_fallback` / `_query_row_with_manager_fallback`
    - `awg_core` import in row-access paths is fallback-only: fast-path DB reads no longer eagerly import manager module
    - CRUD facade routing: `create_interface_row`, `update_interface_row`, `delete_interface_row`
    - CRUD facade routing: `create_client_row`, `update_client_row`, `delete_client_row`
  - backend-first interface CRUD execution path:
    - `create_interface_row`, `update_interface_row`, `delete_interface_row` call domain `interfaces_service_ops` with sqlite context
    - runtime/apply and AWG/validation wiring moved through facade-local helpers
    - `WG_INTERFACE_COLUMNS` projection is resolved from domain `awg/schema.py` (not sourced from `awg_core`)
    - legacy/stub-safe fallback preserved through `_backend_or_fallback` and `_is_stub_manager`
  - backend-first client CRUD execution path:
    - `create_client_row`, `update_client_row`, `delete_client_row` call domain `interfaces_service_ops` with sqlite context
    - legacy/stub-safe fallback preserved through `_backend_or_fallback` and `_is_stub_manager`
  - backend-first interfaces/clients render helpers for repository/service layer:
    - `serialize_interface_row`, `serialize_client_row`
    - `build_client_config`, `build_interface_server_config`, `build_qr_svg`
  - backend-first interfaces support/auth/backup helper routing:
    - `read_database_bytes`, `restore_database_from_bytes`, `decode_base64_payload`
    - `load_api_key`, `save_api_key`, `verify_api_auth`, `rotate_api_key`
    - `detect_awg_version`, `prepare_awg_params_for_version`
    - `_backend_or_fallback` callbacks for interfaces/support/auth render paths are wired via `functools.partial` (instead of inline lambdas)
    - shared `_append_config_param_normalized` callback is used in client/server config render composition paths
    - interface/client CRUD `_backend_or_fallback` call sites are wired via `functools.partial` (no inline lambda wrappers)
    - interfaces runtime/AWG/IP-allocation callback wiring is centralized via named facade helpers + `functools.partial` (no inline lambdas in callback declarations)
    - crypto-context wiring (`_manager_crypto_context`) is sourced from `backend.common.encryption_context` (no `awg_core` global key sourcing)
  - backend-first firewall service routing:
    - rules/state/runtime: `list_firewall_rules_service`, `create_firewall_rule_service`, `update_firewall_rule_service`, `delete_firewall_rule_service`, `reorder_firewall_rules_service`, `reset_firewall_counters_service`, `get_firewall_state_service`, `apply_firewall_rules`
    - collections/tables/objects/schema: `list_firewall_sets_service`, `upsert_firewall_set_service`, `delete_firewall_set_service`, `list_firewall_maps_service`, `upsert_firewall_map_service`, `delete_firewall_map_service`, `list_firewall_tables_service`, `upsert_firewall_table_service`, `delete_firewall_table_service`, `list_firewall_named_objects_service`, `upsert_firewall_named_object_service`, `create_firewall_named_object_service`, `update_firewall_named_object_service`, `delete_firewall_named_object_service`, `get_firewall_schema_service`
    - firewall JSON store/runtime wiring is resolved inside facade callables (`_read/_write_firewall_*`, `_collect_firewall_table_defs`) and direct domain/store callbacks in `apply_firewall_rules`
    - facade `read/write` firewall store callbacks are centralized as named helper callables (and partials where needed), while preserving dynamic `_state_paths()` resolution
    - managed-table/runtime/append-script callbacks in facade `apply/reset` paths are centralized into shared callables (named helpers/partials; no lambda adapters in callback declarations)
    - firewall collection/object helper wiring is facade-local (no awg_core helper sourcing for set/map/table/object normalization, timeout/runtime signatures, table script assembly, effective object merge)
    - firewall service `normalize_item_fn` paths are centralized via shared facade callables (`_normalize_firewall_*`) that delegate to domain normalizers (no duplicated inline lambda blocks in call sites)
    - named-object parse/validation callback wiring is centralized via shared facade callbacks (`_parse_firewall_named_objects_query`, `_validate_firewall_named_object_table_exists`)
    - firewall rule-id generation wiring in normalization path is centralized via `_generate_firewall_rule_id` callback
    - firewall service call-sites are unified via `_backend_partial_call` (encapsulated `partial + fallback` dispatch) across rules/state/sets/maps and named-objects/tables/schema paths
    - IPsec read/write/action backend paths are wired directly through `ipsec_service_layer_ops` via `_backend_partial_call` + shared facade helpers, while keeping `_backend_or_fallback` behavior
    - IPsec validation/crypto/event callback wiring is centralized via shared facade helpers (`_ipsec_*` family), with crypto primitives delegated through `_manager_fernet_encrypt` / `_manager_fernet_decrypt`
    - firewall schema wiring is resolved from `backend.domains.firewall.schema.FIREWALL_SCHEMA` (no `awg_core` schema sourcing)
  - fallback routing:
    - `_backend_or_fallback` switches to legacy-target service wrapper on backend-path errors
    - fallback call dispatch is routed through `legacy_manager_bridge.call_manager_method` (single app-layer seam for remove-cycle)
    - row-access fallback cursor is resolved via `legacy_manager_bridge.get_manager_attr("c")`; crypto fallback primitives are resolved via `legacy_manager_bridge.get_manager_attr("Fernet"/"InvalidToken")`
    - `_backend_or_fallback` / row-access / crypto and `__getattr__` fallback call sites are routed via `_legacy_manager_call` / `_legacy_manager_attr` helpers
    - fallback routing is controlled by env toggle `AWG_MANAGER_ENABLE_AWG_CORE_FALLBACK` (default enabled)
    - sqlite row-access helpers fallback to `legacy_manager_compat.c` when direct DB-path query is unavailable
    - when fallback toggle is disabled, sqlite row-access helpers re-raise DB errors and do not call legacy manager
    - when fallback toggle is disabled and native `cryptography` backend is unavailable, crypto-context path re-raises instead of loading legacy manager
    - backend-only guard coverage (`AWG_MANAGER_ENABLE_AWG_CORE_FALLBACK=0`) includes no-manager-call checks for `list_ipsec_active_peers_service`, `apply_firewall_rules`, and client CRUD facade routes
  - `__getattr__`: forwards manager calls through `backend/app/legacy_manager_bridge.py`.

### `backend/app/legacy_manager_bridge.py`

- Isolated compatibility bridge for legacy-target fallback.
  - `load_manager`: lazy-loads manager module via `backend/app/legacy_manager_target.py`
  - `call_manager_method`: invokes fallback service method on loaded manager
  - `get_manager_attr`: proxies attribute access to loaded manager

### `backend/app/legacy_manager_target.py`

- Legacy fallback target resolver for the bridge.
  - `resolve_manager_module_name`: resolves module name from env (`AWG_MANAGER_LEGACY_TARGET_MODULE`, default `backend.app.legacy_manager_compat`)
  - `load_manager_module`: imports the resolved manager module

### `backend/app/legacy_manager_compat.py`

- Canonical legacy compatibility runtime module used by `manager_facade` fallback calls.
- Keeps the previous manager-API compatibility implementation (cursor/crypto/service wrappers) without wire/API behavior changes.

### `backend/common`

- `data_paths.py`: resolves `AWG_MANAGER_DATA_DIR` and runtime file paths.
  - `resolve_data_dir`, `build_state_paths`
- `json_store.py`: generic JSON read/write with safe defaults.
  - `read_json`, `read_dict_or_default`, `write_json`
- `api_key_store.py`: API key load/save/rotate flow.
  - `load_api_key`, `save_api_key`, `rotate_api_key`
- `crypto_keys.py`: key derivation and decrypt fallback helpers.
  - `derive_encryption_key_v2`, `derive_encryption_key_v1_legacy`, `decrypt_with_key_fallback`
- `crypto_facade_ops.py`: compatibility crypto facade for private key encrypt/decrypt wrappers.
  - `encrypt_private_key`, `decrypt_private_key`
- `encryption_context.py`: centralized encryption secret/key bootstrap with lazy cache.
  - `load_encryption_secret`, `build_crypto_context`, `get_crypto_context`
- `http_errors.py`: maps service exceptions to HTTP responses.
  - `send_service_error`
- `manager_access.py`: manager accessor used by services.
  - `get_manager` (returns `backend.app.manager_facade`)

### `backend/domains/firewall`

- `service.py`: domain HTTP-neutral handlers for firewall resources.
  - `handle_get`, `handle_post`, `handle_put`, `handle_delete`
- `repository.py`: stable CRUD facade over firewall storage/runtime operations.
  - `list_rules`, `create_rule`, `update_rule`, `delete_rule`, `reorder_rules`, `reset_counters`
- `runtime_adapter.py`: nft/runtime integration.
  - `apply_rules`, `list_tables`, `delete_table`, `build_runtime_counters_by_rule`
- `store.py`: JSON persistence and normalization primitives.
  - `read_*`/`write_*`, `normalize_set_item`, `normalize_map_item`, named-object/table helpers
- `schema.py`: canonical firewall constants used by compat and backend facade layers.
  - `FIREWALL_TABLE_FAMILY`, `FIREWALL_SUPPORTED_TABLE_FAMILIES`, `FIREWALL_NAMED_OBJECT_KINDS`
  - `FIREWALL_TABLE_PREFIX`, `FIREWALL_SCHEMA`, `FIREWALL_DEFAULT_TABLE_DEFS`, `FIREWALL_RESERVED_PRIORITIES`
- `helper_service_ops.py`: shared firewall helper composition used by compat and facade layers.
  - timeout helpers: `normalize_nft_timeout`, `timeout_to_seconds`
  - collection runtime helpers: `enrich_collection_item_runtime`, `cleanup_expired_collection_rows`, `set_runtime_signature`, `map_runtime_signature`
  - named-object support helpers: `normalize_logical_bool`, `empty_named_objects_by_kind`, `load_effective_table_objects_by_kind`, `validate_named_object_table_exists`
  - shared table-def collection helper: `collect_table_defs`
  - shared table-script assembly helper: `append_table_script_lines`
  - named-object render callback in script-assembly is centralized via `_render_named_object_add_statement` + `functools.partial`
- `rule_ops.py`: rule normalization/validation and rule list mutation helpers.
  - `extract_normalized_rule_inputs`
  - `build_normalized_rule_payload`
  - `render_firewall_rule`
  - `append_enabled_rule_script_lines`
  - `resolve_table_chain_context`
  - `validate_action_target_reject_and_proto_fields`
  - `normalize_proto_and_basic_match_fields`
  - `validate_l4_icmp_literal_fields`
  - `normalize_nat_raw_fields`, `normalize_log_fields`
  - `normalize_meta_ct_fib_fields`, `normalize_l2_mark_fields`
  - `validate_bridge_disallowed_fields`, `validate_netdev_restrictions`
  - `validate_family_specific_restrictions`
- `rule_normalization_service_ops.py`: composition-level full firewall rule normalization workflow.
  - `normalize_firewall_rule` (extract/validate/normalize/build payload pipeline)
  - default rule-id fallback is centralized via `_default_rule_id_factory`
- `named_object_ops.py`: named object normalization, rendering, references.
  - `normalize_named_object_payload`, `render_named_object_add_statement`, `ensure_named_object_exists`
  - default named-object id fallback is centralized via `_default_named_object_id_factory`
  - `validate_runtime_named_object_references`
  - `append_enabled_named_object_script_lines`
- `collection_ops.py`, `table_ops.py`, `state_ops.py`, `schema_ops.py`, `runtime_ops.py`: focused service helpers for collection/table/state/schema/runtime flows.
  - `collection_ops.py`: `infer_map_token_type`, `format_map_token`, `build_map_declaration_and_elements`, `append_runtime_collection_script_lines`
- `service_layer_ops.py`: firewall compatibility composition layer for legacy compatibility service wrappers.
  - rules/runtime/state wiring: `list_rules`, `apply_rules`, `create_rule`, `update_rule`, `delete_rule`, `reorder_rules`, `reset_counters`, `get_state`
  - collections/maps/tables/named-objects/schema wiring: `list_sets`, `upsert_set`, `delete_set`, `list_maps`, `upsert_map`, `delete_map`, `list_tables`, `list_named_objects`, `upsert_named_object`, `create_named_object`, `update_named_object`, `delete_named_object`, `upsert_table`, `delete_table`, `get_schema`
  - set/map cross-tab uniqueness callbacks (`other_names`) are centralized via shared helper iterators and `functools.partial`
- `compat_entry_ops.py`: firewall compatibility entry layer used by `backend.app.legacy_manager_compat`.
  - delegates compat wrappers over `service_layer_ops` for rules/runtime/state and collections/maps/tables/named-objects/schema paths
  - collection runtime helper factory for compat wiring: `build_collection_runtime_helpers`

### `backend/domains/awg`

- `service.py`: orchestration for interfaces/clients CRUD and backup/auth support endpoints.
  - `list_interfaces`, `create_interface`, `list_clients`, `create_client`, `restore_backup`, `rotate_api_key`
- `repository.py`: persistence-level methods and config serialization.
  - `serialize_client`, `build_client_config`, `build_qr_svg`
- `runtime_adapter.py`: runtime helpers for config generation, restore, AWG param preparation.
  - `build_interface_server_config`, `restore_database`, `detect_awg_version`, `prepare_awg_params`
- `ip_alloc_ops.py`: interface subnet IP allocation/validation helpers.
  - `get_next_available_ip`, `validate_client_ip_for_interface`
- `config_render_ops.py`: client/interface serialization and config text rendering.
  - `serialize_interface_row`, `serialize_client_row`, `build_client_config`, `build_interface_server_config`
- `config_render_service_ops.py`: config-render composition layer for compatibility wrappers in `backend.app.legacy_manager_compat`.
  - `serialize_interface_row`, `serialize_client_row`, `build_client_config`, `build_interface_server_config`
- `client_service_ops.py`: HTTP-neutral client CRUD orchestration.
  - `create_client_service`, `update_client_service`, `delete_client_service`
- `interface_service_ops.py`: HTTP-neutral interface CRUD orchestration.
  - `create_interface_service`, `update_interface_service`, `delete_interface_service`
- `runtime_ops.py`: runtime helpers for interface/client key/config/application flows.
  - `generate_keypair`, `create_temp_key_file`, `build_awg_set_command`
  - `apply_interface_runtime`, `remove_interface_runtime`, `append_config_param`, `build_client_config_lines`
  - `wg_lease_ip`, `add_peer`, `del_peer`
- `runtime_service_ops.py`: runtime composition layer for compatibility wrappers in `backend.app.legacy_manager_compat`.
  - `generate_keypair`, `create_temp_key_file`, `apply_interface_runtime`, `remove_interface_runtime`
  - `build_awg_set_command`, `append_config_param`, `build_client_config_lines`
- `service_ops.py`: service-level composition layer for interfaces/clients DB and runtime wiring.
  - interfaces service composition: `create_interface_service`, `update_interface_service`, `delete_interface_service`
  - clients service composition: `create_client_service`, `update_client_service`, `delete_client_service`
  - IP allocation composition: `get_next_available_ip`, `validate_client_ip_for_interface`
- `validation_ops.py`: interface validation and uniqueness checks.
  - `parse_and_validate_interface_network`, `parse_and_validate_port`
  - `validate_ip_literal`, `validate_interface_name`, `assert_interface_uniqueness`
- `schema.py`: canonical DB projection constants for interface rows.
  - `WG_INTERFACE_COLUMNS`
- `awg_params_ops.py`: AWG version/params detection, preparation, validation, and projection helpers.
  - `detect_awg_version`, `get_awg_param_keys_for_version`, `build_awg_params_from_row`
  - `generate_awg_obfuscation_params`, `prepare_awg_params_for_version`, `parse_h_value_or_range`, `validate_awg_params`
  - `format_awg_params_for_display`, `get_filtered_awg_params`, `prompt_awg_version`, `prompt_version_2_signature_params`
- `cli_list_ops.py`: CLI listing/render helpers for clients/interfaces views.
  - `list_clients`, `list_wg_int`, `list_wg_int_clients`
- `cli_misc_ops.py`: CLI helpers for client QR and API key status/update flows.
  - `client_qrencode`, `show_api_key_status`, `set_api_key`
- `cli_peer_ops.py`: CLI helper for interactive peer update flow.
  - `update_peer`
- `cli_interface_ops.py`: CLI helpers for interactive interface add/delete/update flows.
  - `add_wg_int`, `del_wg_int`, `update_interface`
- `cli_legacy_ops.py`: legacy CLI compatibility flows extracted from `awg_core.py`.
  - `add_client`, `delete_client`, `sync`
- `cli_legacy_service_ops.py`: legacy CLI composition layer wiring DB/runtime dependencies for compatibility wrappers.
  - `add_client`, `delete_client`, `sync`
- `cli_service_ops.py`: CLI composition layer wiring DB/runtime dependencies for CLI helpers.
  - `add_wg_int`, `del_wg_int`, `update_interface`, `update_peer`
- `cli_read_ops.py`: CLI read/query composition layer for listing and QR render flows.
  - `list_clients`, `list_wg_int`, `list_wg_int_clients`, `client_qrencode`
- `cli_support_ops.py`: CLI support composition layer for auth and runtime helper wiring.
  - `show_api_key_status`, `set_api_key`, `wg_lease_ip`, `add_peer`, `del_peer`
- `cli_compat_entry_ops.py`: CLI compatibility entry layer used by `backend.app.legacy_manager_compat`.
  - legacy/read/support/service wrapper wiring: `add_client`, `delete_client`, `list_clients`, `list_wg_int`, `list_wg_int_clients`, `client_qrencode`, `show_api_key_status`, `set_api_key`, `wg_lease_ip`, `add_peer`, `del_peer`, `add_wg_int`, `del_wg_int`, `update_interface`, `update_peer`, `sync`
- `support_facade_ops.py`: support facade layer for `awg_core.py` compatibility wrappers (auth/QR/backup/base64).
  - API key/auth wiring: `load_api_key`, `save_api_key`, `verify_api_auth`, `rotate_api_key`
  - QR helpers: `render_qr_in_terminal`, `build_qr_svg`
  - backup/payload helpers: `read_database_bytes`, `restore_database_from_bytes`, `decode_base64_payload`
- `compat_entry_ops.py`: interfaces/clients compatibility entry layer used by `backend.app.legacy_manager_compat`.
  - render/runtime/service wrapper wiring: `serialize_interface_row`, `serialize_client_row`, `build_client_config`, `build_interface_server_config`, `generate_keypair`, `create_temp_key_file`, `apply_interface_runtime`, `remove_interface_runtime`
  - interface/client CRUD wrapper wiring: `create_interface_service`, `delete_interface_service`, `update_interface_service`, `create_client_service`, `delete_client_service`, `update_client_service`
  - shared runtime/service helper wiring: `build_awg_set_command`, `append_config_param`, `build_client_config_lines`, `get_next_available_ip`, `validate_client_ip_for_interface`, `fetch_allowed_ips_row`, `fetch_interface_peer_rows`
  - validation/uniqueness wrapper wiring: `parse_and_validate_interface_network`, `parse_and_validate_port`, `validate_ip_literal`, `assert_interface_uniqueness`, `validate_interface_name`
  - support/auth/backup helper wiring: `load_api_key`, `save_api_key`, `verify_api_auth`, `rotate_api_key`, `render_qr_in_terminal`, `build_qr_svg`, `read_database_bytes`, `restore_database_from_bytes`, `decode_base64_payload`
  - AWG params helper wiring: `_random_h_value`, `_random_h_range`, `generate_awg_obfuscation_params`, `get_awg_param_keys_for_version`, `detect_awg_version`, `build_awg_params_from_row`, `prepare_awg_params_for_version`, `parse_h_value_or_range`, `validate_awg_params`, `prompt_awg_version`, `prompt_version_2_signature_params`, `format_awg_params_for_display`, `get_filtered_awg_params`
- `schema.py`: interfaces schema constants and migration guard helpers.
  - canonical projection: `WG_INTERFACE_COLUMNS`
  - schema migration helper: `ensure_wg_interfaces_schema`
- `cli_support_ops.py`: interfaces/clients CLI runtime helpers.
  - peer runtime helpers: `add_peer`, `del_peer`
  - key file writer helper: `write_text_file`

### `backend/domains/ipsec`

- `service.py`: route-level orchestration for `/api/ipsec/*`.
  - `handle_get`, `handle_post`, `handle_put`, `handle_delete`
- `repository.py`: CRUD for peers/policies/profiles/identities/events.
  - `list_peers`, `upsert_peer`, `upsert_policy`, `delete_peer`, `delete_policy`
- `runtime_adapter.py`: integration with active peers/SAs and runtime actions.
  - `apply_config`, `load_peer`, `initiate_policy`, `terminate_peer`
- `store.py`: JSON storage and events retention.
  - `read_collection`, `write_collection`, `append_event`, `list_events`
- `validation_ops.py`: IPsec payload normalization and proposal-string helpers.
  - `valid_name`, `normalize_ip_list`, `normalize_ts_list`
  - `build_phase1_proposal_string`, `build_phase2_proposal_string`
- `query_ops.py`: IPsec collection-query helpers for safe list and existence checks.
  - `list_ipsec_identities`, `ensure_item_exists_by_name`
- `crud_ops.py`: IPsec CRUD orchestration helpers for peers/identities/profiles/policies.
  - `upsert_peer`, `upsert_identity`, `upsert_phase1_profile`, `upsert_phase2_proposal`, `upsert_policy`
  - `delete_peer`, `delete_policy`
- `runtime_ops.py`: IPsec runtime orchestration and VICI/xfrm integration helpers.
  - `log_event`, `list_events`, `vici_session`, `collect_refs`
  - `build_vici_connection_for_peer`, `build_vici_secret_for_peer`
  - `sanitize_vici_sas`, `extract_active_peers_from_sas`, `extract_installed_sas_from_sas`
  - `run_ip_xfrm_best_effort`, `list_active_peers`, `list_installed_sas`
  - `load_peer`, `initiate_policy`, `terminate_peer`, `apply_config`
- `service_ops.py`: IPsec service-level composition layer that wires collections/CRUD/runtime by contract-safe adapters.
  - list/read services: `list_peers_service`, `list_identities_service`, `list_phase1_profiles_service`, `list_phase2_proposals_service`, `list_policies_service`
  - existence checks: `ensure_peer_exists`, `ensure_phase1_exists`, `ensure_phase2_exists`
  - CRUD composition: `upsert_peer_service`, `upsert_identity_service`, `upsert_phase1_profile_service`, `upsert_phase2_proposal_service`, `upsert_policy_service`, `delete_peer_service`, `delete_policy_service`
  - runtime composition: `log_event_service`, `list_events_service`, `list_active_peers_service`, `list_installed_sas_service`, `load_peer_service`, `initiate_policy_service`, `terminate_peer_service`, `apply_config_service`
- `service_layer_ops.py`: IPsec compatibility composition layer for legacy compatibility service wrappers.
  - list/read wiring: `list_peers`, `list_identities`, `list_phase1_profiles`, `list_phase2_proposals`, `list_policies`
  - CRUD wiring: `upsert_peer`, `upsert_identity`, `upsert_phase1_profile`, `upsert_phase2_proposal`, `upsert_policy`, `delete_peer`, `delete_policy`
  - runtime wiring: `log_event`, `list_events`, `list_active_peers`, `list_installed_sas`, `load_peer`, `initiate_policy`, `terminate_peer`, `apply_config`
- `compat_entry_ops.py`: IPsec compatibility entry layer used by `backend.app.legacy_manager_compat`.
  - encapsulates callback wiring for store/validation/proposal/crypto/event helpers over `service_layer_ops`
  - exports compatibility wrappers: `list_*`, `upsert_*`, `delete_*`, `list_events_service`, `list_active_peers_service`, `list_installed_sas_service`, `load_peer_service`, `initiate_policy_service`, `terminate_peer_service`, `apply_config_service`
- `service_facade_ops.py`: IPsec facade layer that encapsulates legacy compatibility helper wiring (store/validation/crypto/files).
  - helper wiring: `_read_collection`, `_write_collection`, `_valid_name`, `_normalize_ip_list`, `_normalize_ts_list`
  - proposal/secret wiring: `_build_phase1_proposal_string`, `_build_phase2_proposal_string`, `_secret_encrypt`, `_secret_decrypt`
  - public service wrappers: `list_*`, `upsert_*`, `delete_*`, `list_events_service`, `list_active_peers_service`, `list_installed_sas_service`, `load_peer_service`, `initiate_policy_service`, `terminate_peer_service`, `apply_config_service`

### `awg_core.py` (removed)

- `awg_core.py` has been removed.
- Legacy runtime compatibility is now provided by `backend.app.legacy_manager_compat`.
- Any references to `awg_core.py` below are historical notes from migration steps.

- HTTP/API bootstrap no longer imports `awg_core` directly:
  - `api_core.py` now depends on `backend.app.manager_facade` as manager entrypoint.
  - `manager_facade` preserves compatibility fallback to `backend.app.legacy_manager_compat` for residual paths while decoupling the app-layer import graph.
- CLI bootstrap no longer imports `awg_core` directly:
  - `awg_manager.py` now depends on `backend.app.manager_facade` as manager entrypoint for CLI actions.
  - direct `import awg_core` references are removed from project `.py` entrypoints.
- Firewall compatibility wrappers are reduced to orchestration wiring and delegate normalization/runtime helpers directly to domain modules.
  - firewall compat-service wrapper block in `backend.app.legacy_manager_compat` is flattened to `functools.partial` delegates (including defaults for `family/table/apply_now/table`), keeping a thin shim surface.
  - positional fallback compatibility is handled in `backend/app/manager_facade.py` via named `fallback_kwargs`, so temporary firewall wrapper-def shims were removed from `awg_core.py`.
  - direct domain normalization wiring in service wrappers:
    - `upsert_firewall_set_service` -> `firewall_store.normalize_set_item`
    - `upsert_firewall_map_service` -> `firewall_store.normalize_map_item`
    - `upsert_firewall_named_object_service` -> `firewall_named_object_ops.normalize_named_object_payload`
    - `upsert_firewall_table_service` -> `firewall_store.normalize_firewall_table_item`
    - `normalize_item_fn` callback wiring is centralized via shared `_normalize_firewall_*` callables (domain delegation preserved)
    - named-object bool/table validation callbacks are wired directly to `firewall_helper_service_ops` (no local compat wrappers)
    - named-object parse/validation callback wiring is centralized via shared compat callbacks (`_parse_firewall_named_objects_query`, `_validate_firewall_named_object_table_exists`)
  - effective named-object runtime merge uses `firewall_helper_service_ops.load_effective_table_objects_by_kind` with direct runtime adapter callback (`firewall_runtime_adapter.list_table_objects_by_kind`)
  - effective-object and table-def callbacks are bound as shared callables (partial/def mix to preserve import-time safety)
  - firewall store `read_*`/`write_*` callback wrappers in compat are bound directly via `functools.partial` (path-bound adapters)
  - timeout/runtime-signature callbacks in compat are also bound via `functools.partial`; `enrich_collection_item_runtime` stays a function for optional `now_ts`
  - firewall rule-id generation callback in normalization path is centralized via `_generate_firewall_rule_id`
  - table script assembly wiring delegates to `firewall_helper_service_ops.append_table_script_lines` via `functools.partial` callback binding (shared with `manager_facade`)
  - table-def collection wiring delegates to `firewall_helper_service_ops.collect_table_defs` (shared with `manager_facade`)
  - managed-table parse/key/runtime-table wiring in `apply_firewall_rules` delegates directly to `firewall_store`/`firewall_runtime_adapter` callbacks via shared compat callables (`functools.partial`)
  - remaining interfaces/IPsec compat callback wiring is centralized via named helpers (`_run_command_checked`, `_fernet_encrypt`, `_fernet_decrypt`, `_fetch_allowed_ips_row`, `_fetch_interface_peer_rows`, interface uniqueness helpers); `_fernet_*` are compact lambda aliases.
  - interfaces validation/support/AWG helper wrappers are flattened to direct aliases/partials to `interfaces_compat_entry_ops` (minimal compat shim surface in `backend.app.legacy_manager_compat`)
  - interfaces utility/crypto wrappers (`generate_keypair`, `create_temp_key_file`, `remove_interface_runtime`, `build_awg_set_command`, `append_config_param`, `build_client_config_lines`, `get_next_available_ip`, `validate_client_ip_for_interface`, `encrypt_private_key`, `decrypt_private_key`) are flattened to `functools.partial` delegates
  - redundant inline lambda/wrapper duplication removed from `awg_core.py` for the paths above via shared callable wiring (no wire/API contract changes).
- IPsec compatibility wrappers delegate to `backend.domains.ipsec.compat_entry_ops` (thin entry wiring in domain layer); local `_ipsec_*` helper wiring was removed from `awg_core.py`.
  - IPsec service wrapper block in `backend.app.legacy_manager_compat` is flattened to `functools.partial`/alias delegates with bound files/crypto callbacks.
- interfaces/clients compatibility wrappers for render/runtime/service paths delegate to `backend.domains.awg.compat_entry_ops`; direct wiring to `*_service_ops` modules was moved out of `awg_core.py`.
  - additional interfaces render/service wrappers are flattened to `functools.partial` where import-order safe (`serialize_interface_row`, `serialize_client_row`, `build_client_config`, `build_interface_server_config`, `apply_interface_runtime`, `create_interface_service`, `delete_interface_service`, `update_interface_service`, `create_client_service`, `update_client_service`, `delete_client_service`).
  - remaining callback wiring (`write_text_file`) is delegated through `interfaces_cli_compat_entry_ops.write_text_file` to domain CLI helpers (no local `def` wrappers).
- startup/bootstrap helper ownership moved out of local wrappers:
  - config normalization: `backend.common.value_normalization.normalize_config_value`
  - wg_interfaces migration guard: `backend.domains.awg.schema.ensure_wg_interfaces_schema`
  - encryption-secret bootstrap is inlined in startup initialization (`-r` file path or interactive prompt), without compatibility wrappers.
- interfaces/clients CLI/support compatibility wrappers delegate to `backend.domains.awg.cli_compat_entry_ops`; direct wiring to `cli_*_ops` modules was moved out of `awg_core.py`.
  - CLI support/runtime wrappers that do not depend on late-bound callbacks are flattened to `functools.partial` (`show_api_key_status`, `set_api_key`, `wg_lease_ip`, `add_peer`, `del_peer`, `add_wg_int`, `del_wg_int`, `update_interface`, `sync`, `list_clients`, `list_wg_int`, `list_wg_int_clients`, `client_qrencode`, `update_peer`).
  - callback-sensitive flows are now also flattened after dependency reordering (`add_client`); only `delete_client` remains a thin `def` wrapper because it binds callbacks defined later in the module.
- firewall compatibility wrappers delegate to `backend.domains.firewall.compat_entry_ops`; direct compat wiring to `firewall_service_layer_ops` call-sites was moved out of `awg_core.py`.

## Frontend: Domain API Clients

### `webui/src/frontend/domains/common/api.ts`

- Shared HTTP/auth utilities:
  - `headers`, `parseError`, `downloadBackup`, `restoreBackup`

### `webui/src/frontend/domains/firewall/api.ts`

- Firewall API contract client:
  - state/rules: `getFirewallState`, `getFirewallRules`, `createFirewallRule`, `updateFirewallRule`, `deleteFirewallRule`, `reorderFirewallRules`, `applyFirewallRules`, `resetFirewallCounters`
  - objects/sets/maps/tables: `getFirewallObjects`, `upsertFirewallObject`, `deleteFirewallObject`, `getFirewallSets`, `upsertFirewallSet`, `getFirewallMaps`, `upsertFirewallMap`, `getFirewallTables`, `upsertFirewallTable`

### `webui/src/frontend/domains/interfaces_clients/api.ts`

- Interfaces/clients + AWG params:
  - `getInterfaces`, `createInterface`, `updateInterface`, `deleteInterface`
  - `getClients`, `createClient`, `updateClient`, `deleteClient`
  - `getInterfaceConfig`, `getClientConfig`, `getClientQrSvg`, `generateAwgParams`

### `webui/src/frontend/domains/ipsec/api.ts`

- IPsec API contract client:
  - CRUD: `getIpsecPeers`, `upsertIpsecPeer`, `deleteIpsecPeer`, `getIpsecPolicies`, `upsertIpsecPolicy`, `deleteIpsecPolicy`
  - runtime/actions: `applyIpsec`, `getIpsecActivePeers`, `getIpsecInstalledSas`, `initiateIpsecPolicy`, `terminateIpsecPeer`

## Migration Rule for New Refactor Steps

When a function is moved out of `awg_core.py`:

1. Add/update target module ownership in this file.
2. Update `docs/development/MODULE_MAP.ru.md` with equivalent information.
3. Update `docs/REFRACTOR_PROGRESS.ru.md` with step number and tests.
