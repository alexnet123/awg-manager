#!/usr/bin/python3
import subprocess
import sqlite3
import ipaddress
import getpass
import sys
import os
import random
import tempfile
import re
import uuid
import time
import functools
from cryptography.fernet import Fernet, InvalidToken
from backend.common import crypto_facade_ops, crypto_keys, data_paths, encryption_context, value_normalization
from backend.domains.firewall import helper_service_ops as firewall_helper_service_ops
from backend.domains.firewall import named_object_ops as firewall_named_object_ops
from backend.domains.firewall import rule_ops as firewall_rule_ops
from backend.domains.firewall import rule_normalization_service_ops as firewall_rule_normalization_service_ops
from backend.domains.firewall import schema as firewall_schema
from backend.domains.firewall import compat_entry_ops as firewall_compat_entry_ops
from backend.domains.firewall import store as firewall_store
from backend.domains.firewall import runtime_adapter as firewall_runtime_adapter
from backend.domains.awg import cli_compat_entry_ops as interfaces_cli_compat_entry_ops
from backend.domains.awg import compat_entry_ops as interfaces_compat_entry_ops
from backend.domains.awg import schema as interfaces_schema
from backend.domains.ipsec import compat_entry_ops as ipsec_compat_entry_ops


_crypto_context = encryption_context.get_crypto_context(
    argv=sys.argv,
    open_fn=open,
    getpass_fn=getpass.getpass,
    print_fn=print,
)
encryption_secret = _crypto_context["encryption_secret"]
encryption_key = _crypto_context["encryption_key"]
encryption_key_legacy = _crypto_context["encryption_key_legacy"]




#_path = os.path.dirname(os.path.abspath(__file__))

# Получить путь к символической ссылке
#link_path = os.path.abspath(__file__)

# Разрешить символическую ссылку и получить путь к оригинальному файлу
#org_path = os.path.dirname(os.path.realpath(link_path))

# Сменить каталог
#os.chdir(org_path)



DATA_DIR_ENV_VAR = data_paths.DATA_DIR_ENV_VAR
DEFAULT_DATA_DIR = data_paths.DEFAULT_DATA_DIR
API_KEY_ENV_VAR = data_paths.API_KEY_ENV_VAR
bd_path = data_paths.resolve_data_dir()
_state_paths = data_paths.build_state_paths(bd_path)
API_KEY_FILE = _state_paths['api_key_file']
FIREWALL_RULES_FILE = _state_paths['firewall_rules_file']
FIREWALL_SETS_FILE = _state_paths['firewall_sets_file']
FIREWALL_MAPS_FILE = _state_paths['firewall_maps_file']
FIREWALL_TABLES_FILE = _state_paths['firewall_tables_file']
FIREWALL_OBJECTS_FILE = _state_paths['firewall_objects_file']
FIREWALL_MANAGED_TABLES_FILE = _state_paths['firewall_managed_tables_file']
FIREWALL_STATS_FILE = _state_paths['firewall_stats_file']
IPSEC_PEERS_FILE = _state_paths['ipsec_peers_file']
IPSEC_IDENTITIES_FILE = _state_paths['ipsec_identities_file']
IPSEC_PHASE1_PROFILES_FILE = _state_paths['ipsec_phase1_profiles_file']
IPSEC_PHASE2_PROPOSALS_FILE = _state_paths['ipsec_phase2_proposals_file']
IPSEC_POLICIES_FILE = _state_paths['ipsec_policies_file']
IPSEC_EVENTS_FILE = _state_paths['ipsec_events_file']
DB_FILE = _state_paths['db_file']
FIREWALL_TABLE_FAMILY = firewall_schema.FIREWALL_TABLE_FAMILY
FIREWALL_SUPPORTED_TABLE_FAMILIES = firewall_schema.FIREWALL_SUPPORTED_TABLE_FAMILIES
FIREWALL_NAMED_OBJECT_KINDS = firewall_schema.FIREWALL_NAMED_OBJECT_KINDS
FIREWALL_TABLE_PREFIX = firewall_schema.FIREWALL_TABLE_PREFIX
FIREWALL_SCHEMA = firewall_schema.FIREWALL_SCHEMA
FIREWALL_DEFAULT_TABLE_DEFS = firewall_schema.FIREWALL_DEFAULT_TABLE_DEFS
FIREWALL_RESERVED_PRIORITIES = firewall_schema.FIREWALL_RESERVED_PRIORITIES
if not os.path.isdir(bd_path):
    os.makedirs(bd_path, exist_ok=True)
conn = sqlite3.connect(DB_FILE)



c = conn.cursor()

# Создание таблицы clients
c.execute('''CREATE TABLE IF NOT EXISTS clients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                pubkey TEXT NOT NULL,
                privkey TEXT NOT NULL,
                ip TEXT NOT NULL,
                wg_interface TEXT NOT NULL
            )''')

# Дополнительные per-client параметры конфигурации без изменения схемы clients
c.execute('''CREATE TABLE IF NOT EXISTS client_settings (
                client_id INTEGER PRIMARY KEY,
                allowed_ips TEXT NOT NULL DEFAULT '0.0.0.0/0'
            )''')

# Создание таблицы wg_interfaces
c.execute('''CREATE TABLE IF NOT EXISTS wg_interfaces (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                wg_interface TEXT NOT NULL,
                awg_version TEXT NOT NULL DEFAULT '1',
                port_number INTEGER NOT NULL,
                wg_ip_addr TEXT NOT NULL,
                wg_ip_cidr INTEGER NOT NULL,
                private_key TEXT NOT NULL,
                pubkey TEXT NOT NULL,
                srv_ip TEXT NOT NULL,
                srv_dns TEXT NOT NULL,
                Jc INTEGER,
                Jmin INTEGER,
                Jmax INTEGER,
                S1 INTEGER,
                S2 INTEGER,
                S3 INTEGER,
                S4 INTEGER,
                H1 TEXT,
                H2 TEXT,
                H3 TEXT,
                H4 TEXT,
                I1 TEXT,
                I2 TEXT,
                I3 TEXT,
                I4 TEXT,
                I5 TEXT
            )''')


ensure_wg_interfaces_schema = functools.partial(
    interfaces_schema.ensure_wg_interfaces_schema,
    cursor=c,
    print_fn=print,
    integrity_error_type=sqlite3.IntegrityError,
)
ensure_wg_interfaces_schema()

# Сохраняем изменения и закрываем подключение
conn.commit()


WG_INTERFACE_COLUMNS = interfaces_schema.WG_INTERFACE_COLUMNS


parse_and_validate_interface_network = interfaces_compat_entry_ops.parse_and_validate_interface_network
parse_and_validate_port = interfaces_compat_entry_ops.parse_and_validate_port
validate_ip_literal = interfaces_compat_entry_ops.validate_ip_literal


_run_command_checked = functools.partial(subprocess.run, check=True)


_fernet_encrypt = lambda key, blob: Fernet(key).encrypt(blob)
_fernet_decrypt = lambda key, token: Fernet(key).decrypt(token)


# Функция для шифрования приватного ключа
encrypt_private_key = functools.partial(
    crypto_facade_ops.encrypt_private_key,
    encryption_key=encryption_key,
    fernet_encrypt_fn=_fernet_encrypt,
)

# Функция для дешифрования приватного ключа
decrypt_private_key = functools.partial(
    crypto_facade_ops.decrypt_private_key,
    encryption_key=encryption_key,
    encryption_key_legacy=encryption_key_legacy,
    fernet_decrypt_fn=_fernet_decrypt,
    invalid_token_type=InvalidToken,
)


assert_interface_uniqueness = functools.partial(
    interfaces_compat_entry_ops.assert_interface_uniqueness,
    parse_network_fn=parse_and_validate_interface_network,
    cursor=c,
)
validate_interface_name = interfaces_compat_entry_ops.validate_interface_name


normalize_config_value = value_normalization.normalize_config_value


_firewall_collection_helpers = firewall_compat_entry_ops.build_collection_runtime_helpers(
    normalize_value_fn=normalize_config_value,
    now_ts_fn=time.time,
)
normalize_nft_timeout = _firewall_collection_helpers["normalize_timeout_fn"]
timeout_to_seconds = _firewall_collection_helpers["timeout_to_seconds_fn"]
enrich_collection_item_runtime = _firewall_collection_helpers["enrich_item_runtime_fn"]
_cleanup_expired_collection_rows = _firewall_collection_helpers["cleanup_expired_fn"]
_set_runtime_signature = _firewall_collection_helpers["set_runtime_signature_fn"]
_map_runtime_signature = _firewall_collection_helpers["map_runtime_signature_fn"]


load_api_key = functools.partial(
    interfaces_compat_entry_ops.load_api_key,
    api_key_env_var=API_KEY_ENV_VAR,
    api_key_file=API_KEY_FILE,
    normalize_config_value_fn=normalize_config_value,
)
save_api_key = functools.partial(
    interfaces_compat_entry_ops.save_api_key,
    api_key_file=API_KEY_FILE,
    normalize_config_value_fn=normalize_config_value,
)
render_qr_in_terminal = interfaces_compat_entry_ops.render_qr_in_terminal
build_qr_svg = interfaces_compat_entry_ops.build_qr_svg
verify_api_auth = functools.partial(
    interfaces_compat_entry_ops.verify_api_auth,
    load_api_key_fn=load_api_key,
    normalize_config_value_fn=normalize_config_value,
)
rotate_api_key = functools.partial(
    interfaces_compat_entry_ops.rotate_api_key,
    save_api_key_fn=save_api_key,
)
read_database_bytes = functools.partial(
    interfaces_compat_entry_ops.read_database_bytes,
    db_file_path=DB_FILE,
)
restore_database_from_bytes = functools.partial(
    interfaces_compat_entry_ops.restore_database_from_bytes,
    cursor=c,
    conn=conn,
)
decode_base64_payload = interfaces_compat_entry_ops.decode_base64_payload


_read_firewall_rules_file = functools.partial(firewall_store.read_rules, FIREWALL_RULES_FILE)
_read_firewall_sets_file = functools.partial(firewall_store.read_sets, FIREWALL_SETS_FILE)
_write_firewall_sets_file = functools.partial(firewall_store.write_sets, FIREWALL_SETS_FILE)
_read_firewall_maps_file = functools.partial(firewall_store.read_maps, FIREWALL_MAPS_FILE)
_write_firewall_maps_file = functools.partial(firewall_store.write_maps, FIREWALL_MAPS_FILE)
_read_firewall_objects_file = functools.partial(firewall_store.read_objects, FIREWALL_OBJECTS_FILE)
_write_firewall_objects_file = functools.partial(firewall_store.write_objects, FIREWALL_OBJECTS_FILE)
_read_firewall_tables_file = functools.partial(firewall_store.read_tables, FIREWALL_TABLES_FILE)
_write_firewall_tables_file = functools.partial(firewall_store.write_tables, FIREWALL_TABLES_FILE)


_load_effective_table_objects_by_kind = functools.partial(
    firewall_helper_service_ops.load_effective_table_objects_by_kind,
    named_object_kinds=FIREWALL_NAMED_OBJECT_KINDS,
    read_objects_fn=_read_firewall_objects_file,
    list_runtime_objects_fn=firewall_runtime_adapter.list_table_objects_by_kind,
    normalize_value_fn=normalize_config_value,
)


_read_firewall_stats_file = functools.partial(firewall_store.read_stats, FIREWALL_STATS_FILE)
_write_firewall_stats_file = functools.partial(firewall_store.write_stats, FIREWALL_STATS_FILE)
_write_firewall_rules_file = functools.partial(firewall_store.write_rules, FIREWALL_RULES_FILE)


_collect_firewall_table_defs = functools.partial(
    firewall_helper_service_ops.collect_table_defs,
    default_table_defs=FIREWALL_DEFAULT_TABLE_DEFS,
    read_tables_fn=_read_firewall_tables_file,
    normalize_value_fn=normalize_config_value,
    supported_families=FIREWALL_SUPPORTED_TABLE_FAMILIES,
    default_family=FIREWALL_TABLE_FAMILY,
)


_generate_firewall_rule_id = lambda: uuid.uuid4().hex


_normalize_firewall_rule = functools.partial(
    firewall_rule_normalization_service_ops.normalize_firewall_rule,
    normalize_value_fn=normalize_config_value,
    default_family=FIREWALL_TABLE_FAMILY,
    schema_tables=FIREWALL_SCHEMA["tables"],
    ct_states=FIREWALL_SCHEMA["ct_states"],
    read_tables_fn=_read_firewall_tables_file,
    load_effective_objects_fn=_load_effective_table_objects_by_kind,
    id_factory=_generate_firewall_rule_id,
)

_read_managed_firewall_tables = functools.partial(
    firewall_store.read_managed_tables,
    FIREWALL_MANAGED_TABLES_FILE,
    normalize_value_fn=normalize_config_value,
)
_write_managed_firewall_tables = functools.partial(
    firewall_store.write_managed_tables,
    FIREWALL_MANAGED_TABLES_FILE,
    normalize_value_fn=normalize_config_value,
)
_parse_managed_firewall_table_key = functools.partial(
    firewall_store.parse_managed_table_key,
    normalize_value_fn=normalize_config_value,
    supported_families=FIREWALL_SUPPORTED_TABLE_FAMILIES,
    default_family=FIREWALL_TABLE_FAMILY,
)
_list_firewall_runtime_tables = functools.partial(
    firewall_runtime_adapter.list_tables,
    FIREWALL_SUPPORTED_TABLE_FAMILIES,
)
_append_firewall_table_script_lines = functools.partial(
    firewall_helper_service_ops.append_table_script_lines,
    table_prefix=FIREWALL_TABLE_PREFIX,
    default_family=FIREWALL_TABLE_FAMILY,
    normalize_value_fn=normalize_config_value,
    render_rule_fn=firewall_rule_ops.render_firewall_rule,
)
_normalize_firewall_set_item = functools.partial(
    firewall_store.normalize_set_item,
    normalize_value_fn=normalize_config_value,
    normalize_timeout_fn=normalize_nft_timeout,
)
_normalize_firewall_map_item = functools.partial(
    firewall_store.normalize_map_item,
    normalize_value_fn=normalize_config_value,
    normalize_timeout_fn=normalize_nft_timeout,
)
_validate_firewall_named_object_table_exists = functools.partial(
    firewall_helper_service_ops.validate_named_object_table_exists,
    collect_table_defs_fn=_collect_firewall_table_defs,
)
_parse_firewall_named_objects_query = functools.partial(
    firewall_store.parse_named_objects_query,
    normalize_value_fn=normalize_config_value,
    supported_families=FIREWALL_SUPPORTED_TABLE_FAMILIES,
)
_normalize_firewall_named_object_payload = functools.partial(
    firewall_named_object_ops.normalize_named_object_payload,
    normalize_value_fn=normalize_config_value,
    normalize_bool_fn=firewall_helper_service_ops.normalize_logical_bool,
    normalize_timeout_fn=normalize_nft_timeout,
    validate_table_exists_fn=_validate_firewall_named_object_table_exists,
    default_family=FIREWALL_TABLE_FAMILY,
    supported_families=FIREWALL_SUPPORTED_TABLE_FAMILIES,
    supported_kinds=FIREWALL_NAMED_OBJECT_KINDS,
)
_normalize_firewall_table_item = functools.partial(
    firewall_store.normalize_firewall_table_item,
    normalize_value_fn=normalize_config_value,
    default_family=FIREWALL_TABLE_FAMILY,
    supported_families=FIREWALL_SUPPORTED_TABLE_FAMILIES,
    reserved_priorities=FIREWALL_RESERVED_PRIORITIES,
)


list_firewall_rules_service = functools.partial(
    firewall_compat_entry_ops.list_rules,
    family=None,
    table=None,
    read_rules_fn=_read_firewall_rules_file,
    normalize_rule_fn=_normalize_firewall_rule,
    normalize_value_fn=normalize_config_value,
)
apply_firewall_rules = functools.partial(
    firewall_compat_entry_ops.apply_rules,
    list_rules_fn=list_firewall_rules_service,
    read_sets_fn=_read_firewall_sets_file,
    read_maps_fn=_read_firewall_maps_file,
    read_objects_fn=_read_firewall_objects_file,
    collect_table_defs_fn=_collect_firewall_table_defs,
    read_managed_tables_fn=_read_managed_firewall_tables,
    parse_managed_table_key_fn=_parse_managed_firewall_table_key,
    list_runtime_tables_fn=_list_firewall_runtime_tables,
    delete_table_fn=firewall_runtime_adapter.delete_table,
    append_table_script_lines_fn=_append_firewall_table_script_lines,
    apply_script_fn=firewall_runtime_adapter.apply_script,
    managed_table_key_fn=firewall_store.managed_table_key,
    write_managed_tables_fn=_write_managed_firewall_tables,
    table_prefix=FIREWALL_TABLE_PREFIX,
    default_family=FIREWALL_TABLE_FAMILY,
)
create_firewall_rule_service = functools.partial(
    firewall_compat_entry_ops.create_rule,
    apply_now=True,
    list_rules_fn=list_firewall_rules_service,
    normalize_rule_fn=_normalize_firewall_rule,
    write_rules_fn=_write_firewall_rules_file,
    apply_rules_fn=apply_firewall_rules,
)
update_firewall_rule_service = functools.partial(
    firewall_compat_entry_ops.update_rule,
    apply_now=True,
    list_rules_fn=list_firewall_rules_service,
    normalize_rule_fn=_normalize_firewall_rule,
    write_rules_fn=_write_firewall_rules_file,
    apply_rules_fn=apply_firewall_rules,
)
delete_firewall_rule_service = functools.partial(
    firewall_compat_entry_ops.delete_rule,
    apply_now=True,
    list_rules_fn=list_firewall_rules_service,
    write_rules_fn=_write_firewall_rules_file,
    apply_rules_fn=apply_firewall_rules,
)
reorder_firewall_rules_service = functools.partial(
    firewall_compat_entry_ops.reorder_rules,
    apply_now=True,
    list_rules_fn=list_firewall_rules_service,
    read_tables_fn=_read_firewall_tables_file,
    normalize_value_fn=normalize_config_value,
    default_family=FIREWALL_TABLE_FAMILY,
    default_tables=("filter", "nat", "raw", "mangle"),
    write_rules_fn=_write_firewall_rules_file,
    apply_rules_fn=apply_firewall_rules,
)
reset_firewall_counters_service = functools.partial(
    firewall_compat_entry_ops.reset_counters,
    table=None,
    read_tables_fn=_read_firewall_tables_file,
    normalize_value_fn=normalize_config_value,
    default_family=FIREWALL_TABLE_FAMILY,
    default_tables=("filter", "nat", "raw", "mangle"),
    list_rules_fn=list_firewall_rules_service,
    read_sets_fn=_read_firewall_sets_file,
    read_maps_fn=_read_firewall_maps_file,
    read_objects_fn=_read_firewall_objects_file,
    collect_table_defs_fn=_collect_firewall_table_defs,
    reset_named_counters_fn=firewall_runtime_adapter.reset_table_named_counters,
    reset_named_quotas_fn=firewall_runtime_adapter.reset_table_named_quotas,
    read_stats_fn=_read_firewall_stats_file,
    write_stats_fn=_write_firewall_stats_file,
    apply_rules_fn=apply_firewall_rules,
    delete_table_fn=firewall_runtime_adapter.delete_table,
    append_table_script_lines_fn=_append_firewall_table_script_lines,
    apply_script_fn=firewall_runtime_adapter.apply_script,
    table_prefix=FIREWALL_TABLE_PREFIX,
)
get_firewall_state_service = functools.partial(
    firewall_compat_entry_ops.get_state,
    list_rules_fn=list_firewall_rules_service,
    get_ruleset_text_fn=firewall_runtime_adapter.get_ruleset_text,
    get_ruleset_counter_index_fn=firewall_runtime_adapter.get_ruleset_counter_index,
    build_runtime_counters_by_rule_fn=firewall_runtime_adapter.build_runtime_counters_by_rule,
    default_family=FIREWALL_TABLE_FAMILY,
    table_prefix=FIREWALL_TABLE_PREFIX,
    read_stats_fn=_read_firewall_stats_file,
    enrich_rules_with_runtime_stats_fn=firewall_runtime_adapter.enrich_rules_with_runtime_stats,
    now_ts_fn=time.time,
    write_stats_fn=_write_firewall_stats_file,
)
list_firewall_sets_service = functools.partial(
    firewall_compat_entry_ops.list_sets,
    read_fn=_read_firewall_sets_file,
    write_fn=_write_firewall_sets_file,
    cleanup_expired_fn=_cleanup_expired_collection_rows,
    enrich_item_fn=enrich_collection_item_runtime,
    apply_rules_fn=apply_firewall_rules,
)
upsert_firewall_set_service = functools.partial(
    firewall_compat_entry_ops.upsert_set,
    read_fn=_read_firewall_sets_file,
    write_fn=_write_firewall_sets_file,
    normalize_item_fn=_normalize_firewall_set_item,
    runtime_signature_fn=_set_runtime_signature,
    normalize_value_fn=normalize_config_value,
    enrich_item_fn=enrich_collection_item_runtime,
    apply_rules_fn=apply_firewall_rules,
)
delete_firewall_set_service = functools.partial(
    firewall_compat_entry_ops.delete_set,
    read_fn=_read_firewall_sets_file,
    write_fn=_write_firewall_sets_file,
    apply_rules_fn=apply_firewall_rules,
)
list_firewall_maps_service = functools.partial(
    firewall_compat_entry_ops.list_maps,
    read_fn=_read_firewall_maps_file,
    write_fn=_write_firewall_maps_file,
    cleanup_expired_fn=_cleanup_expired_collection_rows,
    enrich_item_fn=enrich_collection_item_runtime,
    apply_rules_fn=apply_firewall_rules,
)
upsert_firewall_map_service = functools.partial(
    firewall_compat_entry_ops.upsert_map,
    read_fn=_read_firewall_maps_file,
    write_fn=_write_firewall_maps_file,
    normalize_item_fn=_normalize_firewall_map_item,
    runtime_signature_fn=_map_runtime_signature,
    normalize_value_fn=normalize_config_value,
    enrich_item_fn=enrich_collection_item_runtime,
    apply_rules_fn=apply_firewall_rules,
)
delete_firewall_map_service = functools.partial(
    firewall_compat_entry_ops.delete_map,
    read_fn=_read_firewall_maps_file,
    write_fn=_write_firewall_maps_file,
    apply_rules_fn=apply_firewall_rules,
)
list_firewall_tables_service = functools.partial(
    firewall_compat_entry_ops.list_tables,
    read_tables_fn=_read_firewall_tables_file,
    default_table_defs=FIREWALL_DEFAULT_TABLE_DEFS,
    default_family=FIREWALL_TABLE_FAMILY,
)
list_firewall_named_objects_service = functools.partial(
    firewall_compat_entry_ops.list_named_objects,
    family=None,
    table=None,
    parse_query_fn=_parse_firewall_named_objects_query,
    read_objects_fn=_read_firewall_objects_file,
    supported_kinds=FIREWALL_NAMED_OBJECT_KINDS,
    collect_table_defs_fn=_collect_firewall_table_defs,
    load_effective_objects_fn=_load_effective_table_objects_by_kind,
)
upsert_firewall_named_object_service = functools.partial(
    firewall_compat_entry_ops.upsert_named_object,
    apply_now=True,
    read_objects_fn=_read_firewall_objects_file,
    write_objects_fn=_write_firewall_objects_file,
    normalize_item_fn=_normalize_firewall_named_object_payload,
    apply_rules_fn=apply_firewall_rules,
    list_rules_fn=list_firewall_rules_service,
    normalize_value_fn=normalize_config_value,
)
create_firewall_named_object_service = functools.partial(
    firewall_compat_entry_ops.create_named_object,
    apply_now=True,
    read_objects_fn=_read_firewall_objects_file,
    normalize_value_fn=normalize_config_value,
    upsert_named_object_fn=upsert_firewall_named_object_service,
)
update_firewall_named_object_service = functools.partial(
    firewall_compat_entry_ops.update_named_object,
    apply_now=True,
    read_objects_fn=_read_firewall_objects_file,
    upsert_named_object_fn=upsert_firewall_named_object_service,
)
delete_firewall_named_object_service = functools.partial(
    firewall_compat_entry_ops.delete_named_object,
    apply_now=True,
    read_objects_fn=_read_firewall_objects_file,
    write_objects_fn=_write_firewall_objects_file,
    apply_rules_fn=apply_firewall_rules,
    list_rules_fn=list_firewall_rules_service,
    normalize_value_fn=normalize_config_value,
)
upsert_firewall_table_service = functools.partial(
    firewall_compat_entry_ops.upsert_table,
    read_tables_fn=_read_firewall_tables_file,
    write_tables_fn=_write_firewall_tables_file,
    normalize_item_fn=_normalize_firewall_table_item,
    apply_rules_fn=apply_firewall_rules,
    default_family=FIREWALL_TABLE_FAMILY,
    default_table_defs=FIREWALL_DEFAULT_TABLE_DEFS,
)
delete_firewall_table_service = functools.partial(
    firewall_compat_entry_ops.delete_table,
    read_tables_fn=_read_firewall_tables_file,
    write_tables_fn=_write_firewall_tables_file,
    read_objects_fn=_read_firewall_objects_file,
    write_objects_fn=_write_firewall_objects_file,
    apply_rules_fn=apply_firewall_rules,
    default_family=FIREWALL_TABLE_FAMILY,
)
get_firewall_schema_service = functools.partial(
    firewall_compat_entry_ops.get_schema,
    FIREWALL_SCHEMA,
)

_random_h_value = functools.partial(
    interfaces_compat_entry_ops._random_h_value,
    random_randint_fn=random.randint,
)
_random_h_range = functools.partial(
    interfaces_compat_entry_ops._random_h_range,
    random_randint_fn=random.randint,
)
detect_awg_version = functools.partial(
    interfaces_compat_entry_ops.detect_awg_version,
    normalize_config_value_fn=normalize_config_value,
)
generate_awg_obfuscation_params = functools.partial(
    interfaces_compat_entry_ops.generate_awg_obfuscation_params,
    detect_awg_version_fn=detect_awg_version,
    random_randint_fn=random.randint,
    random_sample_fn=random.sample,
)
get_awg_param_keys_for_version = functools.partial(
    interfaces_compat_entry_ops.get_awg_param_keys_for_version,
    detect_awg_version_fn=detect_awg_version,
)
build_awg_params_from_row = interfaces_compat_entry_ops.build_awg_params_from_row
prepare_awg_params_for_version = functools.partial(
    interfaces_compat_entry_ops.prepare_awg_params_for_version,
    generate_awg_obfuscation_params_fn=generate_awg_obfuscation_params,
    detect_awg_version_fn=detect_awg_version,
)
_parse_h_value_or_range = functools.partial(
    interfaces_compat_entry_ops.parse_h_value_or_range,
    normalize_config_value_fn=normalize_config_value,
)
validate_awg_params = functools.partial(
    interfaces_compat_entry_ops.validate_awg_params,
    detect_awg_version_fn=detect_awg_version,
    normalize_config_value_fn=normalize_config_value,
    parse_h_value_or_range_fn=_parse_h_value_or_range,
)
prompt_awg_version = functools.partial(
    interfaces_compat_entry_ops.prompt_awg_version,
    detect_awg_version_fn=detect_awg_version,
    input_fn=input,
    print_fn=print,
)
prompt_version_2_signature_params = functools.partial(
    interfaces_compat_entry_ops.prompt_version_2_signature_params,
    input_fn=input,
)
format_awg_params_for_display = functools.partial(
    interfaces_compat_entry_ops.format_awg_params_for_display,
    get_awg_param_keys_for_version_fn=get_awg_param_keys_for_version,
    normalize_config_value_fn=normalize_config_value,
)
get_filtered_awg_params = functools.partial(
    interfaces_compat_entry_ops.get_filtered_awg_params,
    get_awg_param_keys_for_version_fn=get_awg_param_keys_for_version,
    normalize_config_value_fn=normalize_config_value,
)


_fetch_allowed_ips_row = functools.partial(
    interfaces_compat_entry_ops.fetch_allowed_ips_row,
    cursor=c,
)
_fetch_interface_peer_rows = functools.partial(
    interfaces_compat_entry_ops.fetch_interface_peer_rows,
    cursor=c,
)

build_awg_set_command = functools.partial(
    interfaces_compat_entry_ops.build_awg_set_command,
    detect_awg_version_fn=detect_awg_version,
    normalize_config_value_fn=normalize_config_value,
)

append_config_param = functools.partial(
    interfaces_compat_entry_ops.append_config_param,
    normalize_config_value_fn=normalize_config_value,
)

build_client_config_lines = functools.partial(
    interfaces_compat_entry_ops.build_client_config_lines,
    detect_awg_version_fn=detect_awg_version,
    append_config_param_fn=append_config_param,
)

get_next_available_ip = functools.partial(
    interfaces_compat_entry_ops.get_next_available_ip,
    cursor=c,
)

validate_client_ip_for_interface = functools.partial(
    interfaces_compat_entry_ops.validate_client_ip_for_interface,
    cursor=c,
)


serialize_interface_row = functools.partial(
    interfaces_compat_entry_ops.serialize_interface_row,
    build_awg_params_from_row_fn=build_awg_params_from_row,
    detect_awg_version_fn=detect_awg_version,
    get_filtered_awg_params_fn=get_filtered_awg_params,
)


serialize_client_row = functools.partial(
    interfaces_compat_entry_ops.serialize_client_row,
    fetch_allowed_ips_fn=_fetch_allowed_ips_row,
    normalize_config_value_fn=normalize_config_value,
    decrypt_private_key_fn=decrypt_private_key,
)


build_client_config = functools.partial(
    interfaces_compat_entry_ops.build_client_config,
    fetch_allowed_ips_fn=_fetch_allowed_ips_row,
    normalize_config_value_fn=normalize_config_value,
    build_awg_params_from_row_fn=build_awg_params_from_row,
    build_client_config_lines_fn=build_client_config_lines,
    decrypt_private_key_fn=decrypt_private_key,
)


build_interface_server_config = functools.partial(
    interfaces_compat_entry_ops.build_interface_server_config,
    build_awg_params_from_row_fn=build_awg_params_from_row,
    normalize_config_value_fn=normalize_config_value,
    detect_awg_version_fn=detect_awg_version,
    append_config_param_fn=append_config_param,
    fetch_peer_rows_fn=_fetch_interface_peer_rows,
)


generate_keypair = functools.partial(
    interfaces_compat_entry_ops.generate_keypair,
    run_check_output_fn=subprocess.check_output,
)


create_temp_key_file = functools.partial(
    interfaces_compat_entry_ops.create_temp_key_file,
    named_temporary_file_factory_fn=tempfile.NamedTemporaryFile,
    chmod_fn=os.chmod,
)


write_text_file = functools.partial(
    interfaces_cli_compat_entry_ops.write_text_file,
    open_fn=open,
)


apply_interface_runtime = functools.partial(
    interfaces_compat_entry_ops.apply_interface_runtime,
    create_temp_key_file_fn=create_temp_key_file,
    run_command_fn=_run_command_checked,
    build_awg_set_command_fn=build_awg_set_command,
    path_exists_fn=os.path.exists,
    unlink_fn=os.unlink,
)


remove_interface_runtime = functools.partial(
    interfaces_compat_entry_ops.remove_interface_runtime,
    run_command_fn=_run_command_checked,
)


create_interface_service = functools.partial(
    interfaces_compat_entry_ops.create_interface_service,
    cursor=c,
    conn=conn,
    wg_interface_columns=WG_INTERFACE_COLUMNS,
    normalize_config_value_fn=normalize_config_value,
    detect_awg_version_fn=detect_awg_version,
    validate_interface_name_fn=validate_interface_name,
    parse_and_validate_port_fn=parse_and_validate_port,
    parse_and_validate_interface_network_fn=parse_and_validate_interface_network,
    validate_ip_literal_fn=validate_ip_literal,
    generate_keypair_fn=generate_keypair,
    prepare_awg_params_for_version_fn=prepare_awg_params_for_version,
    validate_awg_params_fn=validate_awg_params,
    assert_interface_uniqueness_fn=assert_interface_uniqueness,
    apply_interface_runtime_fn=apply_interface_runtime,
)


delete_interface_service = functools.partial(
    interfaces_compat_entry_ops.delete_interface_service,
    cursor=c,
    conn=conn,
    wg_interface_columns=WG_INTERFACE_COLUMNS,
    remove_interface_runtime_fn=remove_interface_runtime,
)


update_interface_service = functools.partial(
    interfaces_compat_entry_ops.update_interface_service,
    cursor=c,
    conn=conn,
    wg_interface_columns=WG_INTERFACE_COLUMNS,
    build_awg_params_from_row_fn=build_awg_params_from_row,
    detect_awg_version_fn=detect_awg_version,
    normalize_config_value_fn=normalize_config_value,
    validate_interface_name_fn=validate_interface_name,
    parse_and_validate_port_fn=parse_and_validate_port,
    parse_and_validate_interface_network_fn=parse_and_validate_interface_network,
    validate_ip_literal_fn=validate_ip_literal,
    prepare_awg_params_for_version_fn=prepare_awg_params_for_version,
    validate_awg_params_fn=validate_awg_params,
    assert_interface_uniqueness_fn=assert_interface_uniqueness,
    remove_interface_runtime_fn=remove_interface_runtime,
    apply_interface_runtime_fn=apply_interface_runtime,
)


create_client_service = functools.partial(
    interfaces_compat_entry_ops.create_client_service,
    cursor=c,
    conn=conn,
    normalize_config_value_fn=normalize_config_value,
    get_next_available_ip_fn=get_next_available_ip,
    generate_keypair_fn=generate_keypair,
    encrypt_private_key_fn=encrypt_private_key,
    run_command_fn=_run_command_checked,
)


delete_client_service = functools.partial(
    interfaces_compat_entry_ops.delete_client_service,
    cursor=c,
    conn=conn,
    run_command_fn=_run_command_checked,
)


update_client_service = functools.partial(
    interfaces_compat_entry_ops.update_client_service,
    cursor=c,
    conn=conn,
    normalize_config_value_fn=normalize_config_value,
    get_next_available_ip_fn=get_next_available_ip,
    validate_client_ip_for_interface_fn=validate_client_ip_for_interface,
    encrypt_private_key_fn=encrypt_private_key,
    run_command_fn=_run_command_checked,
)


add_client = functools.partial(
    interfaces_cli_compat_entry_ops.add_client,
    cursor=c,
    conn=conn,
    input_fn=input,
    get_next_available_ip_fn=get_next_available_ip,
    run_check_output_fn=subprocess.check_output,
    encrypt_private_key_fn=encrypt_private_key,
    run_command_fn=_run_command_checked,
    print_fn=print,
    sqlite_error_type=sqlite3.Error,
    called_process_error_type=subprocess.CalledProcessError,
)
    

list_clients = functools.partial(
    interfaces_cli_compat_entry_ops.list_clients,
    cursor=c,
    decrypt_private_key_fn=decrypt_private_key,
    print_fn=print,
)

list_wg_int = functools.partial(
    interfaces_cli_compat_entry_ops.list_wg_int,
    cursor=c,
    wg_interface_columns=WG_INTERFACE_COLUMNS,
    build_awg_params_from_row_fn=build_awg_params_from_row,
    detect_awg_version_fn=detect_awg_version,
    format_awg_params_for_display_fn=format_awg_params_for_display,
    print_fn=print,
)

list_wg_int_clients = functools.partial(
    interfaces_cli_compat_entry_ops.list_wg_int_clients,
    cursor=c,
    wg_interface_columns=WG_INTERFACE_COLUMNS,
    build_awg_params_from_row_fn=build_awg_params_from_row,
    detect_awg_version_fn=detect_awg_version,
    format_awg_params_for_display_fn=format_awg_params_for_display,
    decrypt_private_key_fn=decrypt_private_key,
    print_fn=print,
)

# Печатаем qr-code
client_qrencode = functools.partial(
    interfaces_cli_compat_entry_ops.client_qrencode,
    cursor=c,
    wg_interface_columns=WG_INTERFACE_COLUMNS,
    list_clients_fn=list_clients,
    input_fn=input,
    build_awg_params_from_row_fn=build_awg_params_from_row,
    build_client_config_lines_fn=build_client_config_lines,
    decrypt_private_key_fn=decrypt_private_key,
    render_qr_in_terminal_fn=render_qr_in_terminal,
    print_fn=print,
)


show_api_key_status = functools.partial(
    interfaces_cli_compat_entry_ops.show_api_key_status,
    load_api_key_fn=load_api_key,
    api_key_env_var=API_KEY_ENV_VAR,
    api_key_file=API_KEY_FILE,
    print_fn=print,
)


set_api_key = functools.partial(
    interfaces_cli_compat_entry_ops.set_api_key,
    getpass_fn=getpass.getpass,
    save_api_key_fn=save_api_key,
    api_key_file=API_KEY_FILE,
    print_fn=print,
)


# Занятые ip адреса
wg_lease_ip = functools.partial(
    interfaces_cli_compat_entry_ops.wg_lease_ip,
    run_check_output_fn=subprocess.check_output,
)

# Добавить peer
add_peer = functools.partial(
    interfaces_cli_compat_entry_ops.add_peer,
    run_command_fn=_run_command_checked,
    print_fn=print,
    called_process_error_type=subprocess.CalledProcessError,
)

# Удалить peer
del_peer = functools.partial(
    interfaces_cli_compat_entry_ops.del_peer,
    run_command_fn=_run_command_checked,
    print_fn=print,
    called_process_error_type=subprocess.CalledProcessError,
)

delete_client = functools.partial(
    interfaces_cli_compat_entry_ops.delete_client,
    cursor=c,
    conn=conn,
    list_clients_fn=list_clients,
    input_fn=input,
    run_command_fn=_run_command_checked,
    del_peer_fn=del_peer,
    print_fn=print,
)

add_wg_int = functools.partial(
    interfaces_cli_compat_entry_ops.add_wg_int,
    cursor=c,
    conn=conn,
    input_fn=input,
    prompt_awg_version_fn=prompt_awg_version,
    run_check_output_fn=subprocess.check_output,
    prepare_awg_params_for_version_fn=prepare_awg_params_for_version,
    prompt_version_2_signature_params_fn=prompt_version_2_signature_params,
    print_fn=print,
    run_command_fn=_run_command_checked,
    build_awg_set_command_fn=build_awg_set_command,
    write_key_file_fn=write_text_file,
    sqlite_error_type=sqlite3.Error,
    called_process_error_type=subprocess.CalledProcessError,
)
        
# Удалить wg  интерфейс
del_wg_int = functools.partial(
    interfaces_cli_compat_entry_ops.del_wg_int,
    cursor=c,
    conn=conn,
    wg_interface_columns=WG_INTERFACE_COLUMNS,
    list_wg_int_fn=list_wg_int,
    input_fn=input,
    run_command_fn=_run_command_checked,
    print_fn=print,
)


update_interface = functools.partial(
    interfaces_cli_compat_entry_ops.update_interface,
    cursor=c,
    conn=conn,
    wg_interface_columns=WG_INTERFACE_COLUMNS,
    list_wg_int_fn=list_wg_int,
    print_fn=print,
    input_fn=input,
    detect_awg_version_fn=detect_awg_version,
    build_awg_params_from_row_fn=build_awg_params_from_row,
    prompt_awg_version_fn=prompt_awg_version,
    prepare_awg_params_for_version_fn=prepare_awg_params_for_version,
    prompt_version_2_signature_params_fn=prompt_version_2_signature_params,
    run_command_fn=_run_command_checked,
    build_awg_set_command_fn=build_awg_set_command,
    write_key_file_fn=write_text_file,
)

# обновить настройки клиентов
update_peer = functools.partial(
    interfaces_cli_compat_entry_ops.update_peer,
    cursor=c,
    conn=conn,
    list_clients_fn=list_clients,
    input_fn=input,
    del_peer_fn=del_peer,
    encrypt_private_key_fn=encrypt_private_key,
    add_peer_fn=add_peer,
    print_fn=print,
)


sync = functools.partial(
    interfaces_cli_compat_entry_ops.sync,
    cursor=c,
    wg_interface_columns=WG_INTERFACE_COLUMNS,
    run_check_output_fn=subprocess.check_output,
    run_command_fn=subprocess.run,
    build_awg_set_command_fn=build_awg_set_command,
    write_key_file_fn=write_text_file,
    apply_firewall_rules_fn=apply_firewall_rules,
    print_fn=print,
    called_process_error_type=subprocess.CalledProcessError,
    devnull=subprocess.DEVNULL,
    pipe=subprocess.PIPE,
)



list_ipsec_peers_service = functools.partial(
    ipsec_compat_entry_ops.list_peers_service,
    peers_file=IPSEC_PEERS_FILE,
)
list_ipsec_identities_service = functools.partial(
    ipsec_compat_entry_ops.list_identities_service,
    identities_file=IPSEC_IDENTITIES_FILE,
)
list_ipsec_phase1_profiles_service = functools.partial(
    ipsec_compat_entry_ops.list_phase1_profiles_service,
    phase1_profiles_file=IPSEC_PHASE1_PROFILES_FILE,
)
list_ipsec_phase2_proposals_service = functools.partial(
    ipsec_compat_entry_ops.list_phase2_proposals_service,
    phase2_proposals_file=IPSEC_PHASE2_PROPOSALS_FILE,
)
list_ipsec_policies_service = functools.partial(
    ipsec_compat_entry_ops.list_policies_service,
    policies_file=IPSEC_POLICIES_FILE,
)
upsert_ipsec_peer_service = functools.partial(
    ipsec_compat_entry_ops.upsert_peer_service,
    normalize_config_value_fn=normalize_config_value,
    peers_file=IPSEC_PEERS_FILE,
    phase1_profiles_file=IPSEC_PHASE1_PROFILES_FILE,
)
upsert_ipsec_identity_service = functools.partial(
    ipsec_compat_entry_ops.upsert_identity_service,
    normalize_config_value_fn=normalize_config_value,
    encryption_key=encryption_key,
    identities_file=IPSEC_IDENTITIES_FILE,
    peers_file=IPSEC_PEERS_FILE,
    fernet_encrypt_fn=_fernet_encrypt,
)
upsert_ipsec_phase1_profile_service = functools.partial(
    ipsec_compat_entry_ops.upsert_phase1_profile_service,
    normalize_config_value_fn=normalize_config_value,
    phase1_profiles_file=IPSEC_PHASE1_PROFILES_FILE,
)
upsert_ipsec_phase2_proposal_service = functools.partial(
    ipsec_compat_entry_ops.upsert_phase2_proposal_service,
    normalize_config_value_fn=normalize_config_value,
    phase2_proposals_file=IPSEC_PHASE2_PROPOSALS_FILE,
)
upsert_ipsec_policy_service = functools.partial(
    ipsec_compat_entry_ops.upsert_policy_service,
    normalize_config_value_fn=normalize_config_value,
    policies_file=IPSEC_POLICIES_FILE,
    peers_file=IPSEC_PEERS_FILE,
    phase2_proposals_file=IPSEC_PHASE2_PROPOSALS_FILE,
)
delete_ipsec_peer_service = functools.partial(
    ipsec_compat_entry_ops.delete_peer_service,
    peers_file=IPSEC_PEERS_FILE,
    policies_file=IPSEC_POLICIES_FILE,
    identities_file=IPSEC_IDENTITIES_FILE,
)
delete_ipsec_policy_service = functools.partial(
    ipsec_compat_entry_ops.delete_policy_service,
    policies_file=IPSEC_POLICIES_FILE,
)
list_ipsec_events_service = functools.partial(
    ipsec_compat_entry_ops.list_events_service,
    events_file=IPSEC_EVENTS_FILE,
)
list_ipsec_active_peers_service = ipsec_compat_entry_ops.list_active_peers_service
list_ipsec_installed_sas_service = ipsec_compat_entry_ops.list_installed_sas_service
load_ipsec_peer_service = functools.partial(
    ipsec_compat_entry_ops.load_peer_service,
    encryption_key=encryption_key,
    encryption_key_legacy=encryption_key_legacy,
    peers_file=IPSEC_PEERS_FILE,
    identities_file=IPSEC_IDENTITIES_FILE,
    phase1_profiles_file=IPSEC_PHASE1_PROFILES_FILE,
    phase2_proposals_file=IPSEC_PHASE2_PROPOSALS_FILE,
    policies_file=IPSEC_POLICIES_FILE,
    events_file=IPSEC_EVENTS_FILE,
    fernet_decrypt_fn=_fernet_decrypt,
)
initiate_ipsec_policy_service = functools.partial(
    ipsec_compat_entry_ops.initiate_policy_service,
    policies_file=IPSEC_POLICIES_FILE,
    events_file=IPSEC_EVENTS_FILE,
)
terminate_ipsec_peer_service = functools.partial(
    ipsec_compat_entry_ops.terminate_peer_service,
    events_file=IPSEC_EVENTS_FILE,
)
apply_ipsec_config_service = functools.partial(
    ipsec_compat_entry_ops.apply_config_service,
    encryption_key=encryption_key,
    encryption_key_legacy=encryption_key_legacy,
    peers_file=IPSEC_PEERS_FILE,
    identities_file=IPSEC_IDENTITIES_FILE,
    phase1_profiles_file=IPSEC_PHASE1_PROFILES_FILE,
    phase2_proposals_file=IPSEC_PHASE2_PROPOSALS_FILE,
    policies_file=IPSEC_POLICIES_FILE,
    events_file=IPSEC_EVENTS_FILE,
    fernet_decrypt_fn=_fernet_decrypt,
)
