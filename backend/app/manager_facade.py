#!/usr/bin/python3
import functools
import importlib
import os
import random
import sqlite3
import subprocess
import tempfile
import time
import uuid

from ..common import crypto_facade_ops
from ..common import crypto_keys
from ..common import data_paths
from ..common import encryption_context
from ..common import value_normalization
from . import legacy_manager_bridge
from ..domains.firewall import helper_service_ops as firewall_helper_service_ops
from ..domains.firewall import named_object_ops as firewall_named_object_ops
from ..domains.firewall import rule_normalization_service_ops as firewall_rule_normalization_service_ops
from ..domains.firewall import runtime_adapter as firewall_runtime_adapter
from ..domains.firewall import rule_ops as firewall_rule_ops
from ..domains.firewall import schema as firewall_schema
from ..domains.firewall import service_layer_ops as firewall_service_layer_ops
from ..domains.firewall import store as firewall_store
from ..domains.awg import awg_params_ops as interfaces_awg_params_ops
from ..domains.awg import config_render_service_ops as interfaces_config_render_service_ops
from ..domains.awg import ip_alloc_ops as interfaces_ip_alloc_ops
from ..domains.awg import runtime_service_ops as interfaces_runtime_service_ops
from ..domains.awg import schema as interfaces_schema
from ..domains.awg import service_ops as interfaces_service_ops
from ..domains.awg import support_facade_ops as interfaces_support_facade_ops
from ..domains.awg import validation_ops as interfaces_validation_ops
from ..domains.ipsec import service_layer_ops as ipsec_service_layer_ops
from ..domains.ipsec import store as ipsec_store
from ..domains.ipsec import validation_ops as ipsec_validation_ops

try:  # pragma: no cover - depends on runtime environment
    from cryptography.fernet import Fernet as _Fernet
    from cryptography.fernet import InvalidToken as _InvalidToken
except Exception:  # pragma: no cover - test/runtime fallback
    _Fernet = None
    _InvalidToken = Exception

_FIREWALL_TABLE_FAMILY = firewall_schema.FIREWALL_TABLE_FAMILY
_FIREWALL_SUPPORTED_TABLE_FAMILIES = firewall_schema.FIREWALL_SUPPORTED_TABLE_FAMILIES
_FIREWALL_NAMED_OBJECT_KINDS = firewall_schema.FIREWALL_NAMED_OBJECT_KINDS
_FIREWALL_TABLE_PREFIX = firewall_schema.FIREWALL_TABLE_PREFIX
_FIREWALL_DEFAULT_TABLE_DEFS = firewall_schema.FIREWALL_DEFAULT_TABLE_DEFS
_AWG_CORE_FALLBACK_ENV_VAR = "AWG_MANAGER_ENABLE_AWG_CORE_FALLBACK"

# Compatibility constants for entrypoints and legacy callers.
bd_path = data_paths.resolve_data_dir()
FIREWALL_SCHEMA = firewall_schema.FIREWALL_SCHEMA
WG_INTERFACE_COLUMNS = interfaces_schema.WG_INTERFACE_COLUMNS


def _fallback_enabled():
    raw = str(os.environ.get(_AWG_CORE_FALLBACK_ENV_VAR, "1") or "").strip().lower()
    return raw not in ("0", "false", "no", "off")


def _state_paths():
    return data_paths.build_state_paths(data_paths.resolve_data_dir())


def _legacy_manager_call(method_name, *args, **kwargs):
    return legacy_manager_bridge.call_manager_method(
        method_name,
        *args,
        import_module_fn=importlib.import_module,
        **kwargs,
    )


def _legacy_manager_attr(name):
    return legacy_manager_bridge.get_manager_attr(
        name,
        import_module_fn=importlib.import_module,
    )


def _backend_or_fallback(method_name, backend_fn, *fallback_args, **fallback_kwargs):
    try:
        return backend_fn()
    except Exception:
        if not _fallback_enabled():
            raise
        return _legacy_manager_call(
            method_name,
            *fallback_args,
            **fallback_kwargs,
        )


def _backend_partial_call(
    method_name,
    target_fn,
    *target_args,
    fallback_args=(),
    fallback_kwargs=None,
    **target_kwargs,
):
    return _backend_or_fallback(
        method_name,
        functools.partial(target_fn, *target_args, **target_kwargs),
        *fallback_args,
        **(fallback_kwargs or {}),
    )


def _run_command_checked(cmd):
    return subprocess.run(cmd, check=True)


def _chmod_path(path, mode):
    return os.chmod(path, mode)


_normalize_config_value = value_normalization.normalize_config_value


def _manager_crypto_context():
    crypto = encryption_context.get_crypto_context()
    if _Fernet is None:
        if not _fallback_enabled():
            raise RuntimeError(
                "cryptography backend unavailable while legacy fallback is disabled"
            )
        fernet_class = _legacy_manager_attr("Fernet")
        invalid_token_type = _legacy_manager_attr("InvalidToken")
    else:
        fernet_class = _Fernet
        invalid_token_type = _InvalidToken
    return {
        "encryption_key": crypto["encryption_key"],
        "encryption_key_legacy": crypto["encryption_key_legacy"],
        "fernet_class": fernet_class,
        "invalid_token_type": invalid_token_type,
    }


def _is_stub_manager(manager):
    return all(hasattr(manager, attr) for attr in ("interfaces", "clients", "c"))


def _wg_interface_columns():
    return interfaces_schema.WG_INTERFACE_COLUMNS


def _open_db():
    conn = sqlite3.connect(_state_paths()["db_file"])
    cursor = conn.cursor()
    return conn, cursor


def _query_rows_with_manager_fallback(query, params=(), *, manager=None):
    if manager is not None and _is_stub_manager(manager):
        return manager.c.execute(query, params).fetchall()
    try:
        with sqlite3.connect(_state_paths()["db_file"]) as conn:
            return conn.execute(query, params).fetchall()
    except Exception:
        if not _fallback_enabled():
            raise
        if manager is None:
            manager_cursor = _legacy_manager_attr("c")
            return manager_cursor.execute(query, params).fetchall()
        return manager.c.execute(query, params).fetchall()


def _query_row_with_manager_fallback(query, params=(), *, manager=None):
    if manager is not None and _is_stub_manager(manager):
        return manager.c.execute(query, params).fetchone()
    try:
        with sqlite3.connect(_state_paths()["db_file"]) as conn:
            return conn.execute(query, params).fetchone()
    except Exception:
        if not _fallback_enabled():
            raise
        if manager is None:
            manager_cursor = _legacy_manager_attr("c")
            return manager_cursor.execute(query, params).fetchone()
        return manager.c.execute(query, params).fetchone()


def list_interfaces_rows():
    columns = _wg_interface_columns()
    query = f"SELECT {columns} FROM wg_interfaces"
    return _query_rows_with_manager_fallback(query)


def get_interface_row(interface_id):
    columns = _wg_interface_columns()
    query = f"SELECT {columns} FROM wg_interfaces WHERE id = ?"
    return _query_row_with_manager_fallback(
        query,
        (interface_id,),
    )


def get_interface_row_by_name(interface_name):
    columns = _wg_interface_columns()
    query = f"SELECT {columns} FROM wg_interfaces WHERE wg_interface = ?"
    return _query_row_with_manager_fallback(
        query,
        (interface_name,),
    )


def list_client_rows():
    query = "SELECT * FROM clients"
    return _query_rows_with_manager_fallback(query)


def get_client_row(client_id):
    query = "SELECT * FROM clients WHERE id = ?"
    return _query_row_with_manager_fallback(
        query,
        (client_id,),
    )


def create_interface_row(payload):
    return _backend_partial_call(
        "create_interface_service",
        _create_interface_row_backend,
        payload,
        fallback_args=(payload,),
    )


def update_interface_row(interface_id, payload):
    return _backend_partial_call(
        "update_interface_service",
        _update_interface_row_backend,
        interface_id,
        payload,
        fallback_args=(interface_id, payload),
    )


def delete_interface_row(interface_id):
    return _backend_partial_call(
        "delete_interface_service",
        _delete_interface_row_backend,
        interface_id,
        fallback_args=(interface_id,),
    )


def create_client_row(payload):
    return _backend_partial_call(
        "create_client_service",
        _create_client_row_backend,
        payload,
        fallback_args=(payload,),
    )


def update_client_row(client_id, payload):
    return _backend_partial_call(
        "update_client_service",
        _update_client_row_backend,
        client_id,
        payload,
        fallback_args=(client_id, payload),
    )


def delete_client_row(client_id):
    return _backend_partial_call(
        "delete_client_service",
        _delete_client_row_backend,
        client_id,
        fallback_args=(client_id,),
    )


def _detect_awg_version(awg_version, awg_params):
    return interfaces_awg_params_ops.detect_awg_version(
        awg_version,
        awg_params,
        normalize_config_value_fn=_normalize_config_value,
    )


def _generate_keypair():
    return interfaces_runtime_service_ops.generate_keypair(
        run_check_output_fn=subprocess.check_output,
    )


def _create_temp_key_file(private_key):
    return interfaces_runtime_service_ops.create_temp_key_file(
        private_key,
        named_temporary_file_factory_fn=tempfile.NamedTemporaryFile,
        chmod_fn=_chmod_path,
    )


def _build_awg_set_command(wg_interface, port_number, key_file_path, awg_version, awg_params):
    return interfaces_runtime_service_ops.build_awg_set_command(
        wg_interface,
        port_number,
        key_file_path,
        awg_version,
        awg_params,
        detect_awg_version_fn=_detect_awg_version,
        normalize_config_value_fn=_normalize_config_value,
    )


def _apply_interface_runtime(wg_interface, port_number, wg_ip_addr, wg_ip_cidr, private_key, awg_version, awg_params):
    return interfaces_runtime_service_ops.apply_interface_runtime(
        wg_interface,
        port_number,
        wg_ip_addr,
        wg_ip_cidr,
        private_key,
        awg_version,
        awg_params,
        create_temp_key_file_fn=_create_temp_key_file,
        run_command_fn=_run_command_checked,
        build_awg_set_command_fn=_build_awg_set_command,
        path_exists_fn=os.path.exists,
        unlink_fn=os.unlink,
    )


def _remove_interface_runtime(wg_interface):
    return interfaces_runtime_service_ops.remove_interface_runtime(
        wg_interface,
        run_command_fn=_run_command_checked,
    )


def _generate_awg_obfuscation_params(version):
    return interfaces_awg_params_ops.generate_awg_obfuscation_params(
        version,
        detect_awg_version_fn=_detect_awg_version,
        random_randint_fn=random.randint,
        random_sample_fn=random.sample,
    )


def _prepare_awg_params_for_version(awg_version):
    return interfaces_awg_params_ops.prepare_awg_params_for_version(
        awg_version,
        generate_awg_obfuscation_params_fn=_generate_awg_obfuscation_params,
        detect_awg_version_fn=_detect_awg_version,
    )


def _parse_h_value_or_range(value):
    return interfaces_awg_params_ops.parse_h_value_or_range(
        value,
        normalize_config_value_fn=_normalize_config_value,
    )


def _validate_awg_params(awg_version, awg_params):
    return interfaces_awg_params_ops.validate_awg_params(
        awg_version,
        awg_params,
        detect_awg_version_fn=_detect_awg_version,
        normalize_config_value_fn=_normalize_config_value,
        parse_h_value_or_range_fn=_parse_h_value_or_range,
    )


def _has_interface_name_conflict(cursor, iface, excluded_id):
    if excluded_id is None:
        row = cursor.execute(
            "SELECT 1 FROM wg_interfaces WHERE wg_interface = ?",
            (iface,),
        ).fetchone()
    else:
        row = cursor.execute(
            "SELECT 1 FROM wg_interfaces WHERE wg_interface = ? AND id != ?",
            (iface, excluded_id),
        ).fetchone()
    return row is not None


def _has_port_conflict(cursor, port, excluded_id):
    if excluded_id is None:
        row = cursor.execute(
            "SELECT 1 FROM wg_interfaces WHERE port_number = ?",
            (port,),
        ).fetchone()
    else:
        row = cursor.execute(
            "SELECT 1 FROM wg_interfaces WHERE port_number = ? AND id != ?",
            (port, excluded_id),
        ).fetchone()
    return row is not None


def _fetch_all_interface_network_rows(cursor, excluded_id):
    if excluded_id is None:
        return cursor.execute("SELECT wg_ip_addr, wg_ip_cidr FROM wg_interfaces").fetchall()
    return cursor.execute(
        "SELECT wg_ip_addr, wg_ip_cidr FROM wg_interfaces WHERE id != ?",
        (excluded_id,),
    ).fetchall()


def _assert_interface_uniqueness(cursor, wg_interface, port_number, network_cidr, exclude_id=None):
    return interfaces_validation_ops.assert_interface_uniqueness(
        wg_interface,
        port_number,
        network_cidr,
        parse_network_fn=interfaces_validation_ops.parse_and_validate_interface_network,
        has_interface_name_conflict_fn=functools.partial(_has_interface_name_conflict, cursor),
        has_port_conflict_fn=functools.partial(_has_port_conflict, cursor),
        fetch_all_interface_network_rows_fn=functools.partial(_fetch_all_interface_network_rows, cursor),
        exclude_id=exclude_id,
    )


def _encrypt_private_key(private_key):
    crypto = _manager_crypto_context()
    return crypto_facade_ops.encrypt_private_key(
        private_key,
        encryption_key=crypto["encryption_key"],
        fernet_encrypt_fn=_manager_fernet_encrypt,
    )


def _get_next_available_ip(cursor, wg_interface, exclude_client_id=None):
    return interfaces_ip_alloc_ops.get_next_available_ip(
        wg_interface,
        fetch_interface_subnet_fn=functools.partial(_fetch_interface_subnet_row, cursor),
        fetch_used_ips_fn=functools.partial(_fetch_interface_used_ips, cursor),
        exclude_client_id=exclude_client_id,
    )


def _fetch_interface_subnet_row(cursor, iface):
    return cursor.execute(
        "SELECT wg_ip_addr, wg_ip_cidr FROM wg_interfaces WHERE wg_interface = ?",
        (iface,),
    ).fetchone()


def _fetch_interface_used_ips(cursor, iface, excluded_id):
    if excluded_id is None:
        return cursor.execute(
            "SELECT ip FROM clients WHERE wg_interface = ?",
            (iface,),
        ).fetchall()
    return cursor.execute(
        "SELECT ip FROM clients WHERE wg_interface = ? AND id != ?",
        (iface, excluded_id),
    ).fetchall()


def _validate_client_ip_for_interface(cursor, client_ip, wg_interface, exclude_client_id=None):
    return interfaces_ip_alloc_ops.validate_client_ip_for_interface(
        client_ip,
        wg_interface,
        fetch_interface_subnet_fn=functools.partial(_fetch_interface_subnet_row, cursor),
        fetch_conflict_ip_fn=functools.partial(_fetch_conflict_ip, cursor),
        exclude_client_id=exclude_client_id,
    )


def _fetch_conflict_ip(cursor, iface, ip, excluded_id):
    if excluded_id is None:
        return cursor.execute(
            "SELECT id FROM clients WHERE wg_interface = ? AND ip = ?",
            (iface, ip),
        ).fetchone()
    return cursor.execute(
        "SELECT id FROM clients WHERE wg_interface = ? AND ip = ? AND id != ?",
        (iface, ip, excluded_id),
    ).fetchone()


def _create_client_row_backend(payload):
    conn, cursor = _open_db()
    try:
        return interfaces_service_ops.create_client_service(
            payload,
            cursor=cursor,
            conn=conn,
            normalize_config_value_fn=_normalize_config_value,
            get_next_available_ip_fn=functools.partial(_get_next_available_ip, cursor),
            generate_keypair_fn=_generate_keypair,
            encrypt_private_key_fn=_encrypt_private_key,
            run_command_fn=_run_command_checked,
        )
    finally:
        conn.close()


def _create_interface_row_backend(payload):
    conn, cursor = _open_db()
    try:
        return interfaces_service_ops.create_interface_service(
            payload,
            cursor=cursor,
            conn=conn,
            wg_interface_columns=_wg_interface_columns(),
            normalize_config_value_fn=_normalize_config_value,
            detect_awg_version_fn=_detect_awg_version,
            validate_interface_name_fn=interfaces_validation_ops.validate_interface_name,
            parse_and_validate_port_fn=interfaces_validation_ops.parse_and_validate_port,
            parse_and_validate_interface_network_fn=interfaces_validation_ops.parse_and_validate_interface_network,
            validate_ip_literal_fn=interfaces_validation_ops.validate_ip_literal,
            generate_keypair_fn=_generate_keypair,
            prepare_awg_params_for_version_fn=_prepare_awg_params_for_version,
            validate_awg_params_fn=_validate_awg_params,
            assert_interface_uniqueness_fn=functools.partial(_assert_interface_uniqueness, cursor),
            apply_interface_runtime_fn=_apply_interface_runtime,
        )
    finally:
        conn.close()


def _update_interface_row_backend(interface_id, payload):
    conn, cursor = _open_db()
    try:
        return interfaces_service_ops.update_interface_service(
            interface_id,
            payload,
            cursor=cursor,
            conn=conn,
            wg_interface_columns=_wg_interface_columns(),
            build_awg_params_from_row_fn=interfaces_awg_params_ops.build_awg_params_from_row,
            detect_awg_version_fn=_detect_awg_version,
            normalize_config_value_fn=_normalize_config_value,
            validate_interface_name_fn=interfaces_validation_ops.validate_interface_name,
            parse_and_validate_port_fn=interfaces_validation_ops.parse_and_validate_port,
            parse_and_validate_interface_network_fn=interfaces_validation_ops.parse_and_validate_interface_network,
            validate_ip_literal_fn=interfaces_validation_ops.validate_ip_literal,
            prepare_awg_params_for_version_fn=_prepare_awg_params_for_version,
            validate_awg_params_fn=_validate_awg_params,
            assert_interface_uniqueness_fn=functools.partial(_assert_interface_uniqueness, cursor),
            remove_interface_runtime_fn=_remove_interface_runtime,
            apply_interface_runtime_fn=_apply_interface_runtime,
        )
    finally:
        conn.close()


def _delete_interface_row_backend(interface_id):
    conn, cursor = _open_db()
    try:
        return interfaces_service_ops.delete_interface_service(
            interface_id,
            cursor=cursor,
            conn=conn,
            wg_interface_columns=_wg_interface_columns(),
            remove_interface_runtime_fn=_remove_interface_runtime,
        )
    finally:
        conn.close()


def _update_client_row_backend(client_id, payload):
    conn, cursor = _open_db()
    try:
        return interfaces_service_ops.update_client_service(
            client_id,
            payload,
            cursor=cursor,
            conn=conn,
            normalize_config_value_fn=_normalize_config_value,
            get_next_available_ip_fn=functools.partial(_get_next_available_ip, cursor),
            validate_client_ip_for_interface_fn=functools.partial(_validate_client_ip_for_interface, cursor),
            encrypt_private_key_fn=_encrypt_private_key,
            run_command_fn=_run_command_checked,
        )
    finally:
        conn.close()


def _delete_client_row_backend(client_id):
    conn, cursor = _open_db()
    try:
        return interfaces_service_ops.delete_client_service(
            client_id,
            cursor=cursor,
            conn=conn,
            run_command_fn=_run_command_checked,
        )
    finally:
        conn.close()


def _restore_database_from_bytes_backend(raw_bytes):
    conn, cursor = _open_db()
    try:
        return interfaces_support_facade_ops.restore_database_from_bytes(
            raw_bytes,
            cursor=cursor,
            conn=conn,
        )
    finally:
        conn.close()


def _fetch_client_allowed_ips_row(client_id):
    query = "SELECT allowed_ips FROM client_settings WHERE client_id = ?"
    row = _query_row_with_manager_fallback(
        query,
        (client_id,),
        manager=None,
    )
    if row is None:
        return None
    return row


def _fetch_interface_peer_rows(wg_interface):
    query = "SELECT pubkey, ip FROM clients WHERE wg_interface = ?"
    return _query_rows_with_manager_fallback(
        query,
        (wg_interface,),
    )


def _get_filtered_awg_params(awg_version, awg_params):
    return interfaces_awg_params_ops.get_filtered_awg_params(
        awg_version,
        awg_params,
        get_awg_param_keys_for_version_fn=_get_awg_param_keys_for_version,
        normalize_config_value_fn=_normalize_config_value,
    )


def _get_awg_param_keys_for_version(current_version):
    return interfaces_awg_params_ops.get_awg_param_keys_for_version(
        current_version,
        detect_awg_version_fn=_detect_awg_version,
    )


def _manager_fernet_encrypt(key, blob):
    return _manager_crypto_context()["fernet_class"](key).encrypt(blob)


def _manager_fernet_decrypt(key, token):
    return _manager_crypto_context()["fernet_class"](key).decrypt(token)


def _ipsec_read_collection(path):
    return ipsec_store.read_collection(path)


def _ipsec_write_collection(path, items):
    ipsec_store.write_collection(path, items)


def _ipsec_paths():
    return _state_paths()


def _ipsec_valid_name(value, field_name="name"):
    return ipsec_validation_ops.valid_name(
        value,
        normalize_config_value_fn=_normalize_config_value,
        field_name=field_name,
    )


def _ipsec_normalize_ip_list(value, field_name):
    return ipsec_validation_ops.normalize_ip_list(
        value,
        normalize_config_value_fn=_normalize_config_value,
        field_name=field_name,
    )


def _ipsec_normalize_ts_list(value, field_name):
    return ipsec_validation_ops.normalize_ts_list(
        value,
        normalize_ip_list_fn=_ipsec_normalize_ip_list,
        field_name=field_name,
    )


def _ipsec_build_phase1_proposal_string(enc, hash_alg, dh_group):
    return ipsec_validation_ops.build_phase1_proposal_string(
        enc,
        hash_alg,
        dh_group,
        valid_name_fn=_ipsec_valid_name,
    )


def _ipsec_build_phase2_proposal_string(enc, auth_alg, pfs_group=None):
    return ipsec_validation_ops.build_phase2_proposal_string(
        enc,
        auth_alg,
        pfs_group,
        valid_name_fn=_ipsec_valid_name,
        normalize_config_value_fn=_normalize_config_value,
    )


def _ipsec_secret_encrypt(value):
    encrypted = crypto_keys.encrypt_with_key(
        value,
        _manager_crypto_context()["encryption_key"],
        _manager_fernet_encrypt,
    )
    return encrypted.decode("utf-8")


def _ipsec_secret_decrypt(value):
    if value is None:
        return None
    crypto = _manager_crypto_context()
    return crypto_keys.decrypt_with_key_fallback(
        token=value,
        keys=(crypto["encryption_key"], crypto["encryption_key_legacy"]),
        decrypt_fn=_manager_fernet_decrypt,
        continue_exceptions=(Exception,),
    )


def _ipsec_log_event(event_type, payload, paths):
    return ipsec_service_layer_ops.log_event(
        event_type,
        payload,
        events_file=paths["ipsec_events_file"],
    )


def _ipsec_log_event_fn(paths):
    return functools.partial(_ipsec_log_event, paths=paths)


def _upsert_ipsec_identity_backend(payload, paths):
    return ipsec_service_layer_ops.upsert_identity(
        payload,
        valid_name_fn=_ipsec_valid_name,
        normalize_config_value_fn=_normalize_config_value,
        secret_encrypt_fn=_ipsec_secret_encrypt,
        read_collection_fn=_ipsec_read_collection,
        write_collection_fn=_ipsec_write_collection,
        peers_file=paths["ipsec_peers_file"],
        identities_file=paths["ipsec_identities_file"],
    )


def _load_ipsec_peer_backend(peer_name, paths):
    return ipsec_service_layer_ops.load_peer(
        peer_name,
        read_collection_fn=_ipsec_read_collection,
        peers_file=paths["ipsec_peers_file"],
        identities_file=paths["ipsec_identities_file"],
        phase1_profiles_file=paths["ipsec_phase1_profiles_file"],
        phase2_proposals_file=paths["ipsec_phase2_proposals_file"],
        policies_file=paths["ipsec_policies_file"],
        secret_decrypt_fn=_ipsec_secret_decrypt,
        log_event_fn=_ipsec_log_event_fn(paths),
    )


def _apply_ipsec_config_backend(paths):
    return ipsec_service_layer_ops.apply_config(
        read_collection_fn=_ipsec_read_collection,
        peers_file=paths["ipsec_peers_file"],
        identities_file=paths["ipsec_identities_file"],
        phase1_profiles_file=paths["ipsec_phase1_profiles_file"],
        phase2_proposals_file=paths["ipsec_phase2_proposals_file"],
        policies_file=paths["ipsec_policies_file"],
        secret_decrypt_fn=_ipsec_secret_decrypt,
        log_event_fn=_ipsec_log_event_fn(paths),
    )


def _decrypt_private_key(encrypted_private_key):
    crypto = _manager_crypto_context()
    return crypto_facade_ops.decrypt_private_key(
        encrypted_private_key,
        encryption_key=crypto["encryption_key"],
        encryption_key_legacy=crypto["encryption_key_legacy"],
        fernet_decrypt_fn=_manager_fernet_decrypt,
        invalid_token_type=crypto["invalid_token_type"],
    )


def _append_config_param_normalized(lines, key, value):
    return interfaces_runtime_service_ops.append_config_param(
        lines,
        key,
        value,
        normalize_config_value_fn=_normalize_config_value,
    )


def _build_client_config_lines(
    client_private_key,
    client_ip,
    srv_dns,
    awg_version,
    awg_params,
    server_pubkey,
    srv_ip,
    port_number,
    allowed_ips="0.0.0.0/0",
):
    return interfaces_runtime_service_ops.build_client_config_lines(
        client_private_key,
        client_ip,
        srv_dns,
        awg_version,
        awg_params,
        server_pubkey,
        srv_ip,
        port_number,
        detect_awg_version_fn=_detect_awg_version,
        append_config_param_fn=_append_config_param_normalized,
        allowed_ips=allowed_ips,
    )


def serialize_interface_row(row):
    return _backend_partial_call(
        "serialize_interface_row",
        interfaces_config_render_service_ops.serialize_interface_row,
        row,
        build_awg_params_from_row_fn=interfaces_awg_params_ops.build_awg_params_from_row,
        detect_awg_version_fn=_detect_awg_version,
        get_filtered_awg_params_fn=_get_filtered_awg_params,
        fallback_args=(row,),
    )


def serialize_client_row(row, include_private_key=False):
    return _backend_partial_call(
        "serialize_client_row",
        interfaces_config_render_service_ops.serialize_client_row,
        row,
        fetch_allowed_ips_fn=_fetch_client_allowed_ips_row,
        normalize_config_value_fn=_normalize_config_value,
        decrypt_private_key_fn=_decrypt_private_key,
        include_private_key=include_private_key,
        fallback_args=(row, include_private_key),
    )


def build_client_config(client_row, interface_row):
    return _backend_partial_call(
        "build_client_config",
        interfaces_config_render_service_ops.build_client_config,
        client_row,
        interface_row,
        fetch_allowed_ips_fn=_fetch_client_allowed_ips_row,
        normalize_config_value_fn=_normalize_config_value,
        build_awg_params_from_row_fn=interfaces_awg_params_ops.build_awg_params_from_row,
        build_client_config_lines_fn=_build_client_config_lines,
        decrypt_private_key_fn=_decrypt_private_key,
        fallback_args=(client_row, interface_row),
    )


def build_interface_server_config(interface_row):
    return _backend_partial_call(
        "build_interface_server_config",
        interfaces_config_render_service_ops.build_interface_server_config,
        interface_row,
        build_awg_params_from_row_fn=interfaces_awg_params_ops.build_awg_params_from_row,
        normalize_config_value_fn=_normalize_config_value,
        detect_awg_version_fn=_detect_awg_version,
        append_config_param_fn=_append_config_param_normalized,
        fetch_peer_rows_fn=_fetch_interface_peer_rows,
        fallback_args=(interface_row,),
    )


def build_qr_svg(content):
    return _backend_partial_call(
        "build_qr_svg",
        interfaces_support_facade_ops.build_qr_svg,
        content,
        fallback_args=(content,),
    )


def read_database_bytes():
    paths = _state_paths()
    return _backend_partial_call(
        "read_database_bytes",
        interfaces_support_facade_ops.read_database_bytes,
        db_file_path=paths["db_file"],
    )


def restore_database_from_bytes(raw_bytes):
    return _backend_partial_call(
        "restore_database_from_bytes",
        _restore_database_from_bytes_backend,
        raw_bytes,
        fallback_args=(raw_bytes,),
    )


def decode_base64_payload(payload):
    return _backend_partial_call(
        "decode_base64_payload",
        interfaces_support_facade_ops.decode_base64_payload,
        payload,
        fallback_args=(payload,),
    )


def load_api_key():
    paths = _state_paths()
    return _backend_partial_call(
        "load_api_key",
        interfaces_support_facade_ops.load_api_key,
        api_key_env_var=data_paths.API_KEY_ENV_VAR,
        api_key_file=paths["api_key_file"],
        normalize_config_value_fn=_normalize_config_value,
    )


def save_api_key(api_key):
    paths = _state_paths()
    return _backend_partial_call(
        "save_api_key",
        interfaces_support_facade_ops.save_api_key,
        api_key,
        api_key_file=paths["api_key_file"],
        normalize_config_value_fn=_normalize_config_value,
        fallback_args=(api_key,),
    )


def verify_api_auth(api_key, provided_encryption_secret):
    return _backend_partial_call(
        "verify_api_auth",
        interfaces_support_facade_ops.verify_api_auth,
        api_key,
        provided_encryption_secret,
        load_api_key_fn=load_api_key,
        normalize_config_value_fn=_normalize_config_value,
        fallback_args=(api_key, provided_encryption_secret),
    )


def rotate_api_key():
    return _backend_partial_call(
        "rotate_api_key",
        interfaces_support_facade_ops.rotate_api_key,
        save_api_key_fn=save_api_key,
    )


def detect_awg_version(awg_version, awg_params):
    return _backend_partial_call(
        "detect_awg_version",
        _detect_awg_version,
        awg_version,
        awg_params,
        fallback_args=(awg_version, awg_params),
    )


def prepare_awg_params_for_version(awg_version):
    return _backend_partial_call(
        "prepare_awg_params_for_version",
        _prepare_awg_params_for_version,
        awg_version,
        fallback_args=(awg_version,),
    )


def _firewall_default_family():
    return _FIREWALL_TABLE_FAMILY


def _firewall_table_prefix():
    return _FIREWALL_TABLE_PREFIX


def _firewall_supported_families():
    return _FIREWALL_SUPPORTED_TABLE_FAMILIES


def _firewall_named_object_kinds():
    return _FIREWALL_NAMED_OBJECT_KINDS


def _firewall_default_table_defs():
    return _FIREWALL_DEFAULT_TABLE_DEFS


def _firewall_schema():
    return getattr(
        firewall_schema,
        "FIREWALL_SCHEMA",
        {
            "family": _FIREWALL_TABLE_FAMILY,
            "tables": {},
            "actions": [],
            "protos": [],
            "ct_states": [],
        },
    )


def _read_firewall_rules_file():
    return firewall_store.read_rules(_state_paths()["firewall_rules_file"])


def _write_firewall_rules_file(rules):
    return firewall_store.write_rules(_state_paths()["firewall_rules_file"], rules)


def _read_firewall_sets_file():
    return firewall_store.read_sets(_state_paths()["firewall_sets_file"])


def _write_firewall_sets_file(data):
    return firewall_store.write_sets(_state_paths()["firewall_sets_file"], data)


def _read_firewall_maps_file():
    return firewall_store.read_maps(_state_paths()["firewall_maps_file"])


def _write_firewall_maps_file(data):
    return firewall_store.write_maps(_state_paths()["firewall_maps_file"], data)


def _read_firewall_tables_file():
    return firewall_store.read_tables(_state_paths()["firewall_tables_file"])


def _write_firewall_tables_file(data):
    return firewall_store.write_tables(_state_paths()["firewall_tables_file"], data)


def _read_firewall_objects_file():
    return firewall_store.read_objects(_state_paths()["firewall_objects_file"])


def _write_firewall_objects_file(data):
    return firewall_store.write_objects(_state_paths()["firewall_objects_file"], data)


def _read_firewall_stats_file():
    return firewall_store.read_stats(_state_paths()["firewall_stats_file"])


def _write_firewall_stats_file(data):
    return firewall_store.write_stats(_state_paths()["firewall_stats_file"], data)


_collect_firewall_table_defs = functools.partial(
    firewall_helper_service_ops.collect_table_defs,
    default_table_defs=_firewall_default_table_defs(),
    read_tables_fn=_read_firewall_tables_file,
    normalize_value_fn=_normalize_config_value,
    supported_families=_firewall_supported_families(),
    default_family=_firewall_default_family(),
)


_normalize_nft_timeout = functools.partial(
    firewall_helper_service_ops.normalize_nft_timeout,
    normalize_value_fn=_normalize_config_value,
)


_timeout_to_seconds = functools.partial(
    firewall_helper_service_ops.timeout_to_seconds,
    normalize_value_fn=_normalize_config_value,
    normalize_nft_timeout_fn=_normalize_nft_timeout,
)


def _enrich_collection_item_runtime(item, now_ts=None):
    if now_ts is None:
        now_ts = int(time.time())
    return firewall_helper_service_ops.enrich_collection_item_runtime(
        item,
        now_ts=int(now_ts),
        timeout_to_seconds_fn=_timeout_to_seconds,
    )


_cleanup_expired_collection_rows = functools.partial(
    firewall_helper_service_ops.cleanup_expired_collection_rows,
    timeout_to_seconds_fn=_timeout_to_seconds,
)


_set_runtime_signature = functools.partial(
    firewall_helper_service_ops.set_runtime_signature,
    normalize_value_fn=_normalize_config_value,
)


_map_runtime_signature = functools.partial(
    firewall_helper_service_ops.map_runtime_signature,
    normalize_value_fn=_normalize_config_value,
)


_load_effective_table_objects_by_kind = functools.partial(
    firewall_helper_service_ops.load_effective_table_objects_by_kind,
    named_object_kinds=_firewall_named_object_kinds(),
    read_objects_fn=_read_firewall_objects_file,
    list_runtime_objects_fn=firewall_runtime_adapter.list_table_objects_by_kind,
    normalize_value_fn=_normalize_config_value,
)


def _generate_firewall_rule_id():
    return uuid.uuid4().hex


def _normalize_firewall_rule(payload):
    return firewall_rule_normalization_service_ops.normalize_firewall_rule(
        payload,
        normalize_value_fn=_normalize_config_value,
        default_family=_firewall_default_family(),
        schema_tables=_firewall_schema().get("tables", {}),
        ct_states=_firewall_schema().get("ct_states", []),
        read_tables_fn=_read_firewall_tables_file,
        load_effective_objects_fn=_load_effective_table_objects_by_kind,
        id_factory=_generate_firewall_rule_id,
    )

def _read_managed_firewall_tables():
    return firewall_store.read_managed_tables(
        _state_paths()["firewall_managed_tables_file"],
        normalize_value_fn=_normalize_config_value,
    )


def _write_managed_firewall_tables(data):
    return firewall_store.write_managed_tables(
        _state_paths()["firewall_managed_tables_file"],
        data,
        normalize_value_fn=_normalize_config_value,
    )


def _parse_managed_firewall_table_key(value):
    return firewall_store.parse_managed_table_key(
        value,
        normalize_value_fn=_normalize_config_value,
        supported_families=_firewall_supported_families(),
        default_family=_firewall_default_family(),
    )


def _list_firewall_runtime_tables():
    return firewall_runtime_adapter.list_tables(_firewall_supported_families())
_append_firewall_table_script_lines = functools.partial(
    firewall_helper_service_ops.append_table_script_lines,
    table_prefix=_firewall_table_prefix(),
    default_family=_firewall_default_family(),
    normalize_value_fn=_normalize_config_value,
    render_rule_fn=firewall_rule_ops.render_firewall_rule,
)
_normalize_firewall_set_item = functools.partial(
    firewall_store.normalize_set_item,
    normalize_value_fn=_normalize_config_value,
    normalize_timeout_fn=_normalize_nft_timeout,
)
_normalize_firewall_map_item = functools.partial(
    firewall_store.normalize_map_item,
    normalize_value_fn=_normalize_config_value,
    normalize_timeout_fn=_normalize_nft_timeout,
)


def _validate_firewall_named_object_table_exists(family, table_name):
    return firewall_helper_service_ops.validate_named_object_table_exists(
        family,
        table_name,
        collect_table_defs_fn=_collect_firewall_table_defs,
    )


def _parse_firewall_named_objects_query(family, table):
    return firewall_store.parse_named_objects_query(
        family,
        table,
        _normalize_config_value,
        _firewall_supported_families(),
    )


_normalize_firewall_named_object_payload = functools.partial(
    firewall_named_object_ops.normalize_named_object_payload,
    normalize_value_fn=_normalize_config_value,
    normalize_bool_fn=firewall_helper_service_ops.normalize_logical_bool,
    normalize_timeout_fn=_normalize_nft_timeout,
    validate_table_exists_fn=_validate_firewall_named_object_table_exists,
    default_family=_firewall_default_family(),
    supported_families=_firewall_supported_families(),
    supported_kinds=_firewall_named_object_kinds(),
)
_normalize_firewall_table_item = functools.partial(
    firewall_store.normalize_firewall_table_item,
    normalize_value_fn=_normalize_config_value,
    default_family=_firewall_default_family(),
    supported_families=_firewall_supported_families(),
    reserved_priorities=firewall_schema.FIREWALL_RESERVED_PRIORITIES,
)


def list_firewall_rules_service(family=None, table=None):
    return _backend_partial_call(
        "list_firewall_rules_service",
        firewall_service_layer_ops.list_rules,
        family=family,
        table=table,
        read_rules_fn=_read_firewall_rules_file,
        normalize_rule_fn=_normalize_firewall_rule,
        normalize_value_fn=_normalize_config_value,
        fallback_kwargs={"family": family, "table": table},
    )


def apply_firewall_rules():
    return _backend_partial_call(
        "apply_firewall_rules",
        firewall_service_layer_ops.apply_rules,
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
        table_prefix=_firewall_table_prefix(),
        default_family=_firewall_default_family(),
    )


def create_firewall_rule_service(payload, apply_now=True):
    return _backend_partial_call(
        "create_firewall_rule_service",
        firewall_service_layer_ops.create_rule,
        payload=payload,
        apply_now=apply_now,
        list_rules_fn=list_firewall_rules_service,
        normalize_rule_fn=_normalize_firewall_rule,
        write_rules_fn=_write_firewall_rules_file,
        apply_rules_fn=apply_firewall_rules,
        fallback_kwargs={"payload": payload, "apply_now": apply_now},
    )


def update_firewall_rule_service(rule_id, payload, apply_now=True):
    return _backend_partial_call(
        "update_firewall_rule_service",
        firewall_service_layer_ops.update_rule,
        rule_id=rule_id,
        payload=payload,
        apply_now=apply_now,
        list_rules_fn=list_firewall_rules_service,
        normalize_rule_fn=_normalize_firewall_rule,
        write_rules_fn=_write_firewall_rules_file,
        apply_rules_fn=apply_firewall_rules,
        fallback_kwargs={"rule_id": rule_id, "payload": payload, "apply_now": apply_now},
    )


def delete_firewall_rule_service(rule_id, apply_now=True):
    return _backend_partial_call(
        "delete_firewall_rule_service",
        firewall_service_layer_ops.delete_rule,
        rule_id=rule_id,
        apply_now=apply_now,
        list_rules_fn=list_firewall_rules_service,
        write_rules_fn=_write_firewall_rules_file,
        apply_rules_fn=apply_firewall_rules,
        fallback_kwargs={"rule_id": rule_id, "apply_now": apply_now},
    )


def reorder_firewall_rules_service(table, ordered_ids, apply_now=True):
    return _backend_partial_call(
        "reorder_firewall_rules_service",
        firewall_service_layer_ops.reorder_rules,
        table=table,
        ordered_ids=ordered_ids,
        apply_now=apply_now,
        list_rules_fn=list_firewall_rules_service,
        read_tables_fn=_read_firewall_tables_file,
        normalize_value_fn=_normalize_config_value,
        default_family=_firewall_default_family(),
        default_tables=("filter", "nat", "raw", "mangle"),
        write_rules_fn=_write_firewall_rules_file,
        apply_rules_fn=apply_firewall_rules,
        fallback_kwargs={"table": table, "ordered_ids": ordered_ids, "apply_now": apply_now},
    )


def reset_firewall_counters_service(table=None):
    return _backend_partial_call(
        "reset_firewall_counters_service",
        firewall_service_layer_ops.reset_counters,
        table=table,
        read_tables_fn=_read_firewall_tables_file,
        normalize_value_fn=_normalize_config_value,
        default_family=_firewall_default_family(),
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
        table_prefix=_firewall_table_prefix(),
        fallback_kwargs={"table": table},
    )


def get_firewall_state_service():
    return _backend_partial_call(
        "get_firewall_state_service",
        firewall_service_layer_ops.get_state,
        list_rules_fn=list_firewall_rules_service,
        get_ruleset_text_fn=firewall_runtime_adapter.get_ruleset_text,
        get_ruleset_counter_index_fn=firewall_runtime_adapter.get_ruleset_counter_index,
        build_runtime_counters_by_rule_fn=firewall_runtime_adapter.build_runtime_counters_by_rule,
        default_family=_firewall_default_family(),
        table_prefix=_firewall_table_prefix(),
        read_stats_fn=_read_firewall_stats_file,
        enrich_rules_with_runtime_stats_fn=firewall_runtime_adapter.enrich_rules_with_runtime_stats,
        now_ts_fn=time.time,
        write_stats_fn=_write_firewall_stats_file,
    )


def list_firewall_sets_service():
    return _backend_partial_call(
        "list_firewall_sets_service",
        firewall_service_layer_ops.list_sets,
        read_fn=_read_firewall_sets_file,
        write_fn=_write_firewall_sets_file,
        cleanup_expired_fn=_cleanup_expired_collection_rows,
        enrich_item_fn=_enrich_collection_item_runtime,
        apply_rules_fn=apply_firewall_rules,
    )


def upsert_firewall_set_service(set_kind, payload):
    return _backend_partial_call(
        "upsert_firewall_set_service",
        firewall_service_layer_ops.upsert_set,
        set_kind,
        payload=payload,
        read_fn=_read_firewall_sets_file,
        write_fn=_write_firewall_sets_file,
        normalize_item_fn=_normalize_firewall_set_item,
        runtime_signature_fn=_set_runtime_signature,
        normalize_value_fn=_normalize_config_value,
        enrich_item_fn=_enrich_collection_item_runtime,
        apply_rules_fn=apply_firewall_rules,
        fallback_kwargs={"set_kind": set_kind, "payload": payload},
    )


def delete_firewall_set_service(set_kind, set_id):
    return _backend_partial_call(
        "delete_firewall_set_service",
        firewall_service_layer_ops.delete_set,
        set_kind,
        set_id,
        read_fn=_read_firewall_sets_file,
        write_fn=_write_firewall_sets_file,
        apply_rules_fn=apply_firewall_rules,
        fallback_kwargs={"set_kind": set_kind, "set_id": set_id},
    )


def list_firewall_maps_service():
    return _backend_partial_call(
        "list_firewall_maps_service",
        firewall_service_layer_ops.list_maps,
        read_fn=_read_firewall_maps_file,
        write_fn=_write_firewall_maps_file,
        cleanup_expired_fn=_cleanup_expired_collection_rows,
        enrich_item_fn=_enrich_collection_item_runtime,
        apply_rules_fn=apply_firewall_rules,
    )


def upsert_firewall_map_service(map_kind, payload):
    return _backend_partial_call(
        "upsert_firewall_map_service",
        firewall_service_layer_ops.upsert_map,
        map_kind,
        payload=payload,
        read_fn=_read_firewall_maps_file,
        write_fn=_write_firewall_maps_file,
        normalize_item_fn=_normalize_firewall_map_item,
        runtime_signature_fn=_map_runtime_signature,
        normalize_value_fn=_normalize_config_value,
        enrich_item_fn=_enrich_collection_item_runtime,
        apply_rules_fn=apply_firewall_rules,
        fallback_kwargs={"map_kind": map_kind, "payload": payload},
    )


def delete_firewall_map_service(map_kind, map_id):
    return _backend_partial_call(
        "delete_firewall_map_service",
        firewall_service_layer_ops.delete_map,
        map_kind,
        map_id,
        read_fn=_read_firewall_maps_file,
        write_fn=_write_firewall_maps_file,
        apply_rules_fn=apply_firewall_rules,
        fallback_kwargs={"map_kind": map_kind, "map_id": map_id},
    )


def list_firewall_tables_service():
    return _backend_partial_call(
        "list_firewall_tables_service",
        firewall_service_layer_ops.list_tables,
        read_tables_fn=_read_firewall_tables_file,
        default_table_defs=_firewall_default_table_defs(),
        default_family=_firewall_default_family(),
    )


def list_firewall_named_objects_service(family=None, table=None):
    return _backend_partial_call(
        "list_firewall_named_objects_service",
        firewall_service_layer_ops.list_named_objects,
        family=family,
        table=table,
        parse_query_fn=_parse_firewall_named_objects_query,
        read_objects_fn=_read_firewall_objects_file,
        supported_kinds=_firewall_named_object_kinds(),
        collect_table_defs_fn=_collect_firewall_table_defs,
        load_effective_objects_fn=_load_effective_table_objects_by_kind,
        fallback_kwargs={"family": family, "table": table},
    )


def upsert_firewall_named_object_service(payload, apply_now=True):
    return _backend_partial_call(
        "upsert_firewall_named_object_service",
        firewall_service_layer_ops.upsert_named_object,
        payload=payload,
        apply_now=apply_now,
        read_objects_fn=_read_firewall_objects_file,
        write_objects_fn=_write_firewall_objects_file,
        normalize_item_fn=_normalize_firewall_named_object_payload,
        apply_rules_fn=apply_firewall_rules,
        list_rules_fn=list_firewall_rules_service,
        normalize_value_fn=_normalize_config_value,
        fallback_kwargs={"payload": payload, "apply_now": apply_now},
    )


def create_firewall_named_object_service(payload, apply_now=True):
    return _backend_partial_call(
        "create_firewall_named_object_service",
        firewall_service_layer_ops.create_named_object,
        payload=payload,
        apply_now=apply_now,
        read_objects_fn=_read_firewall_objects_file,
        normalize_value_fn=_normalize_config_value,
        upsert_named_object_fn=upsert_firewall_named_object_service,
        fallback_kwargs={"payload": payload, "apply_now": apply_now},
    )


def update_firewall_named_object_service(object_id, payload, apply_now=True):
    return _backend_partial_call(
        "update_firewall_named_object_service",
        firewall_service_layer_ops.update_named_object,
        object_id=object_id,
        payload=payload,
        apply_now=apply_now,
        read_objects_fn=_read_firewall_objects_file,
        upsert_named_object_fn=upsert_firewall_named_object_service,
        fallback_kwargs={"object_id": object_id, "payload": payload, "apply_now": apply_now},
    )


def delete_firewall_named_object_service(object_id, apply_now=True):
    return _backend_partial_call(
        "delete_firewall_named_object_service",
        firewall_service_layer_ops.delete_named_object,
        object_id=object_id,
        apply_now=apply_now,
        read_objects_fn=_read_firewall_objects_file,
        write_objects_fn=_write_firewall_objects_file,
        apply_rules_fn=apply_firewall_rules,
        list_rules_fn=list_firewall_rules_service,
        normalize_value_fn=_normalize_config_value,
        fallback_kwargs={"object_id": object_id, "apply_now": apply_now},
    )


def upsert_firewall_table_service(payload):
    return _backend_partial_call(
        "upsert_firewall_table_service",
        firewall_service_layer_ops.upsert_table,
        payload=payload,
        read_tables_fn=_read_firewall_tables_file,
        write_tables_fn=_write_firewall_tables_file,
        normalize_item_fn=_normalize_firewall_table_item,
        apply_rules_fn=apply_firewall_rules,
        default_family=_firewall_default_family(),
        default_table_defs=_firewall_default_table_defs(),
        fallback_kwargs={"payload": payload},
    )


def delete_firewall_table_service(table_id):
    return _backend_partial_call(
        "delete_firewall_table_service",
        firewall_service_layer_ops.delete_table,
        table_id=table_id,
        read_tables_fn=_read_firewall_tables_file,
        write_tables_fn=_write_firewall_tables_file,
        read_objects_fn=_read_firewall_objects_file,
        write_objects_fn=_write_firewall_objects_file,
        apply_rules_fn=apply_firewall_rules,
        default_family=_firewall_default_family(),
        fallback_kwargs={"table_id": table_id},
    )


def get_firewall_schema_service():
    return _backend_partial_call(
        "get_firewall_schema_service",
        firewall_service_layer_ops.get_schema,
        _firewall_schema(),
    )


def list_ipsec_peers_service():
    paths = _ipsec_paths()
    return _backend_partial_call(
        "list_ipsec_peers_service",
        ipsec_service_layer_ops.list_peers,
        read_collection_fn=_ipsec_read_collection,
        peers_file=paths["ipsec_peers_file"],
    )


def list_ipsec_identities_service():
    paths = _ipsec_paths()
    return _backend_partial_call(
        "list_ipsec_identities_service",
        ipsec_service_layer_ops.list_identities,
        read_collection_fn=_ipsec_read_collection,
        identities_file=paths["ipsec_identities_file"],
    )


def list_ipsec_policies_service():
    paths = _ipsec_paths()
    return _backend_partial_call(
        "list_ipsec_policies_service",
        ipsec_service_layer_ops.list_policies,
        read_collection_fn=_ipsec_read_collection,
        policies_file=paths["ipsec_policies_file"],
    )


def list_ipsec_phase1_profiles_service():
    paths = _ipsec_paths()
    return _backend_partial_call(
        "list_ipsec_phase1_profiles_service",
        ipsec_service_layer_ops.list_phase1_profiles,
        read_collection_fn=_ipsec_read_collection,
        phase1_profiles_file=paths["ipsec_phase1_profiles_file"],
    )


def list_ipsec_phase2_proposals_service():
    paths = _ipsec_paths()
    return _backend_partial_call(
        "list_ipsec_phase2_proposals_service",
        ipsec_service_layer_ops.list_phase2_proposals,
        read_collection_fn=_ipsec_read_collection,
        phase2_proposals_file=paths["ipsec_phase2_proposals_file"],
    )


def list_ipsec_events_service():
    paths = _ipsec_paths()
    return _backend_partial_call(
        "list_ipsec_events_service",
        ipsec_service_layer_ops.list_events,
        events_file=paths["ipsec_events_file"],
    )


def list_ipsec_active_peers_service():
    return _backend_partial_call(
        "list_ipsec_active_peers_service",
        ipsec_service_layer_ops.list_active_peers,
    )


def list_ipsec_installed_sas_service():
    return _backend_partial_call(
        "list_ipsec_installed_sas_service",
        ipsec_service_layer_ops.list_installed_sas,
    )


def upsert_ipsec_peer_service(payload):
    paths = _ipsec_paths()
    return _backend_partial_call(
        "upsert_ipsec_peer_service",
        ipsec_service_layer_ops.upsert_peer,
        payload,
        valid_name_fn=_ipsec_valid_name,
        normalize_ip_list_fn=_ipsec_normalize_ip_list,
        read_collection_fn=_ipsec_read_collection,
        write_collection_fn=_ipsec_write_collection,
        peers_file=paths["ipsec_peers_file"],
        phase1_profiles_file=paths["ipsec_phase1_profiles_file"],
        fallback_args=(payload,),
    )


def upsert_ipsec_phase1_profile_service(payload):
    paths = _ipsec_paths()
    return _backend_partial_call(
        "upsert_ipsec_phase1_profile_service",
        ipsec_service_layer_ops.upsert_phase1_profile,
        payload,
        valid_name_fn=_ipsec_valid_name,
        normalize_config_value_fn=_normalize_config_value,
        build_phase1_proposal_string_fn=_ipsec_build_phase1_proposal_string,
        read_collection_fn=_ipsec_read_collection,
        write_collection_fn=_ipsec_write_collection,
        phase1_profiles_file=paths["ipsec_phase1_profiles_file"],
        fallback_args=(payload,),
    )


def upsert_ipsec_phase2_proposal_service(payload):
    paths = _ipsec_paths()
    return _backend_partial_call(
        "upsert_ipsec_phase2_proposal_service",
        ipsec_service_layer_ops.upsert_phase2_proposal,
        payload,
        valid_name_fn=_ipsec_valid_name,
        normalize_config_value_fn=_normalize_config_value,
        build_phase2_proposal_string_fn=_ipsec_build_phase2_proposal_string,
        read_collection_fn=_ipsec_read_collection,
        write_collection_fn=_ipsec_write_collection,
        phase2_proposals_file=paths["ipsec_phase2_proposals_file"],
        fallback_args=(payload,),
    )


def upsert_ipsec_policy_service(payload):
    paths = _ipsec_paths()
    return _backend_partial_call(
        "upsert_ipsec_policy_service",
        ipsec_service_layer_ops.upsert_policy,
        payload,
        valid_name_fn=_ipsec_valid_name,
        normalize_ts_list_fn=_ipsec_normalize_ts_list,
        normalize_config_value_fn=_normalize_config_value,
        read_collection_fn=_ipsec_read_collection,
        write_collection_fn=_ipsec_write_collection,
        policies_file=paths["ipsec_policies_file"],
        peers_file=paths["ipsec_peers_file"],
        phase2_proposals_file=paths["ipsec_phase2_proposals_file"],
        fallback_args=(payload,),
    )


def delete_ipsec_peer_service(name):
    paths = _ipsec_paths()
    return _backend_partial_call(
        "delete_ipsec_peer_service",
        ipsec_service_layer_ops.delete_peer,
        name,
        read_collection_fn=_ipsec_read_collection,
        write_collection_fn=_ipsec_write_collection,
        peers_file=paths["ipsec_peers_file"],
        policies_file=paths["ipsec_policies_file"],
        identities_file=paths["ipsec_identities_file"],
        fallback_args=(name,),
    )


def delete_ipsec_policy_service(name):
    paths = _ipsec_paths()
    return _backend_partial_call(
        "delete_ipsec_policy_service",
        ipsec_service_layer_ops.delete_policy,
        name,
        read_collection_fn=_ipsec_read_collection,
        write_collection_fn=_ipsec_write_collection,
        policies_file=paths["ipsec_policies_file"],
        fallback_args=(name,),
    )


def upsert_ipsec_identity_service(payload):
    paths = _ipsec_paths()
    return _backend_partial_call(
        "upsert_ipsec_identity_service",
        _upsert_ipsec_identity_backend,
        payload,
        paths,
        fallback_args=(payload,),
    )


def load_ipsec_peer_service(peer_name):
    paths = _ipsec_paths()
    return _backend_partial_call(
        "load_ipsec_peer_service",
        _load_ipsec_peer_backend,
        peer_name,
        paths,
        fallback_args=(peer_name,),
    )


def initiate_ipsec_policy_service(policy_name):
    paths = _ipsec_paths()
    return _backend_partial_call(
        "initiate_ipsec_policy_service",
        ipsec_service_layer_ops.initiate_policy,
        policy_name,
        read_collection_fn=_ipsec_read_collection,
        policies_file=paths["ipsec_policies_file"],
        log_event_fn=_ipsec_log_event_fn(paths),
        fallback_args=(policy_name,),
    )


def terminate_ipsec_peer_service(peer_name):
    paths = _ipsec_paths()
    return _backend_partial_call(
        "terminate_ipsec_peer_service",
        ipsec_service_layer_ops.terminate_peer,
        peer_name,
        log_event_fn=_ipsec_log_event_fn(paths),
        fallback_args=(peer_name,),
    )


def apply_ipsec_config_service():
    paths = _ipsec_paths()
    return _backend_partial_call(
        "apply_ipsec_config_service",
        _apply_ipsec_config_backend,
        paths,
    )


def __getattr__(name):
    if not _fallback_enabled():
        raise AttributeError(name)
    return _legacy_manager_attr(name)
