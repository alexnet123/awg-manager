#!/usr/bin/python3
import random

from . import awg_params_ops
from . import config_render_service_ops
from . import runtime_service_ops
from . import service_ops
from . import support_facade_ops
from . import validation_ops


def serialize_interface_row(
    row,
    *,
    build_awg_params_from_row_fn,
    detect_awg_version_fn,
    get_filtered_awg_params_fn,
):
    return config_render_service_ops.serialize_interface_row(
        row,
        build_awg_params_from_row_fn=build_awg_params_from_row_fn,
        detect_awg_version_fn=detect_awg_version_fn,
        get_filtered_awg_params_fn=get_filtered_awg_params_fn,
    )


def serialize_client_row(
    row,
    *,
    fetch_allowed_ips_fn,
    normalize_config_value_fn,
    decrypt_private_key_fn,
    include_private_key=False,
):
    return config_render_service_ops.serialize_client_row(
        row,
        fetch_allowed_ips_fn=fetch_allowed_ips_fn,
        normalize_config_value_fn=normalize_config_value_fn,
        decrypt_private_key_fn=decrypt_private_key_fn,
        include_private_key=include_private_key,
    )


def build_client_config(
    client_row,
    interface_row,
    *,
    fetch_allowed_ips_fn,
    normalize_config_value_fn,
    build_awg_params_from_row_fn,
    build_client_config_lines_fn,
    decrypt_private_key_fn,
):
    return config_render_service_ops.build_client_config(
        client_row,
        interface_row,
        fetch_allowed_ips_fn=fetch_allowed_ips_fn,
        normalize_config_value_fn=normalize_config_value_fn,
        build_awg_params_from_row_fn=build_awg_params_from_row_fn,
        build_client_config_lines_fn=build_client_config_lines_fn,
        decrypt_private_key_fn=decrypt_private_key_fn,
    )


def build_interface_server_config(
    interface_row,
    *,
    build_awg_params_from_row_fn,
    normalize_config_value_fn,
    detect_awg_version_fn,
    append_config_param_fn,
    fetch_peer_rows_fn,
):
    return config_render_service_ops.build_interface_server_config(
        interface_row,
        build_awg_params_from_row_fn=build_awg_params_from_row_fn,
        normalize_config_value_fn=normalize_config_value_fn,
        detect_awg_version_fn=detect_awg_version_fn,
        append_config_param_fn=append_config_param_fn,
        fetch_peer_rows_fn=fetch_peer_rows_fn,
    )


def generate_keypair(*, run_check_output_fn):
    return runtime_service_ops.generate_keypair(
        run_check_output_fn=run_check_output_fn,
    )


def create_temp_key_file(private_key, *, named_temporary_file_factory_fn, chmod_fn):
    return runtime_service_ops.create_temp_key_file(
        private_key,
        named_temporary_file_factory_fn=named_temporary_file_factory_fn,
        chmod_fn=chmod_fn,
    )


def apply_interface_runtime(
    wg_interface,
    port_number,
    wg_ip_addr,
    wg_ip_cidr,
    private_key,
    awg_version,
    awg_params,
    *,
    create_temp_key_file_fn,
    run_command_fn,
    build_awg_set_command_fn,
    path_exists_fn,
    unlink_fn,
):
    return runtime_service_ops.apply_interface_runtime(
        wg_interface,
        port_number,
        wg_ip_addr,
        wg_ip_cidr,
        private_key,
        awg_version,
        awg_params,
        create_temp_key_file_fn=create_temp_key_file_fn,
        run_command_fn=run_command_fn,
        build_awg_set_command_fn=build_awg_set_command_fn,
        path_exists_fn=path_exists_fn,
        unlink_fn=unlink_fn,
    )


def remove_interface_runtime(wg_interface, *, run_command_fn):
    return runtime_service_ops.remove_interface_runtime(
        wg_interface,
        run_command_fn=run_command_fn,
    )


def create_interface_service(
    payload,
    *,
    cursor,
    conn,
    wg_interface_columns,
    normalize_config_value_fn,
    detect_awg_version_fn,
    validate_interface_name_fn,
    parse_and_validate_port_fn,
    parse_and_validate_interface_network_fn,
    validate_ip_literal_fn,
    generate_keypair_fn,
    prepare_awg_params_for_version_fn,
    validate_awg_params_fn,
    assert_interface_uniqueness_fn,
    apply_interface_runtime_fn,
):
    return service_ops.create_interface_service(
        payload,
        cursor=cursor,
        conn=conn,
        wg_interface_columns=wg_interface_columns,
        normalize_config_value_fn=normalize_config_value_fn,
        detect_awg_version_fn=detect_awg_version_fn,
        validate_interface_name_fn=validate_interface_name_fn,
        parse_and_validate_port_fn=parse_and_validate_port_fn,
        parse_and_validate_interface_network_fn=parse_and_validate_interface_network_fn,
        validate_ip_literal_fn=validate_ip_literal_fn,
        generate_keypair_fn=generate_keypair_fn,
        prepare_awg_params_for_version_fn=prepare_awg_params_for_version_fn,
        validate_awg_params_fn=validate_awg_params_fn,
        assert_interface_uniqueness_fn=assert_interface_uniqueness_fn,
        apply_interface_runtime_fn=apply_interface_runtime_fn,
    )


def delete_interface_service(
    interface_id,
    *,
    cursor,
    conn,
    wg_interface_columns,
    remove_interface_runtime_fn,
):
    return service_ops.delete_interface_service(
        interface_id,
        cursor=cursor,
        conn=conn,
        wg_interface_columns=wg_interface_columns,
        remove_interface_runtime_fn=remove_interface_runtime_fn,
    )


def update_interface_service(
    interface_id,
    payload,
    *,
    cursor,
    conn,
    wg_interface_columns,
    build_awg_params_from_row_fn,
    detect_awg_version_fn,
    normalize_config_value_fn,
    validate_interface_name_fn,
    parse_and_validate_port_fn,
    parse_and_validate_interface_network_fn,
    validate_ip_literal_fn,
    prepare_awg_params_for_version_fn,
    validate_awg_params_fn,
    assert_interface_uniqueness_fn,
    remove_interface_runtime_fn,
    apply_interface_runtime_fn,
):
    return service_ops.update_interface_service(
        interface_id,
        payload,
        cursor=cursor,
        conn=conn,
        wg_interface_columns=wg_interface_columns,
        build_awg_params_from_row_fn=build_awg_params_from_row_fn,
        detect_awg_version_fn=detect_awg_version_fn,
        normalize_config_value_fn=normalize_config_value_fn,
        validate_interface_name_fn=validate_interface_name_fn,
        parse_and_validate_port_fn=parse_and_validate_port_fn,
        parse_and_validate_interface_network_fn=parse_and_validate_interface_network_fn,
        validate_ip_literal_fn=validate_ip_literal_fn,
        prepare_awg_params_for_version_fn=prepare_awg_params_for_version_fn,
        validate_awg_params_fn=validate_awg_params_fn,
        assert_interface_uniqueness_fn=assert_interface_uniqueness_fn,
        remove_interface_runtime_fn=remove_interface_runtime_fn,
        apply_interface_runtime_fn=apply_interface_runtime_fn,
    )


def create_client_service(
    payload,
    *,
    cursor,
    conn,
    normalize_config_value_fn,
    get_next_available_ip_fn,
    generate_keypair_fn,
    encrypt_private_key_fn,
    run_command_fn,
):
    return service_ops.create_client_service(
        payload,
        cursor=cursor,
        conn=conn,
        normalize_config_value_fn=normalize_config_value_fn,
        get_next_available_ip_fn=get_next_available_ip_fn,
        generate_keypair_fn=generate_keypair_fn,
        encrypt_private_key_fn=encrypt_private_key_fn,
        run_command_fn=run_command_fn,
    )


def delete_client_service(client_id, *, cursor, conn, run_command_fn):
    return service_ops.delete_client_service(
        client_id,
        cursor=cursor,
        conn=conn,
        run_command_fn=run_command_fn,
    )


def update_client_service(
    client_id,
    payload,
    *,
    cursor,
    conn,
    normalize_config_value_fn,
    get_next_available_ip_fn,
    validate_client_ip_for_interface_fn,
    encrypt_private_key_fn,
    run_command_fn,
):
    return service_ops.update_client_service(
        client_id,
        payload,
        cursor=cursor,
        conn=conn,
        normalize_config_value_fn=normalize_config_value_fn,
        get_next_available_ip_fn=get_next_available_ip_fn,
        validate_client_ip_for_interface_fn=validate_client_ip_for_interface_fn,
        encrypt_private_key_fn=encrypt_private_key_fn,
        run_command_fn=run_command_fn,
    )


def build_awg_set_command(
    wg_interface,
    port_number,
    key_file_path,
    awg_version,
    awg_params,
    *,
    detect_awg_version_fn,
    normalize_config_value_fn,
):
    return runtime_service_ops.build_awg_set_command(
        wg_interface,
        port_number,
        key_file_path,
        awg_version,
        awg_params,
        detect_awg_version_fn=detect_awg_version_fn,
        normalize_config_value_fn=normalize_config_value_fn,
    )


def append_config_param(lines, key, value, *, normalize_config_value_fn):
    return runtime_service_ops.append_config_param(
        lines,
        key,
        value,
        normalize_config_value_fn=normalize_config_value_fn,
    )


def build_client_config_lines(
    client_private_key,
    client_ip,
    srv_dns,
    awg_version,
    awg_params,
    server_pubkey,
    srv_ip,
    port_number,
    *,
    detect_awg_version_fn,
    append_config_param_fn,
    allowed_ips="0.0.0.0/0",
):
    return runtime_service_ops.build_client_config_lines(
        client_private_key,
        client_ip,
        srv_dns,
        awg_version,
        awg_params,
        server_pubkey,
        srv_ip,
        port_number,
        detect_awg_version_fn=detect_awg_version_fn,
        append_config_param_fn=append_config_param_fn,
        allowed_ips=allowed_ips,
    )


def get_next_available_ip(wg_interface, *, cursor, exclude_client_id=None):
    return service_ops.get_next_available_ip(
        wg_interface,
        cursor=cursor,
        exclude_client_id=exclude_client_id,
    )


def validate_client_ip_for_interface(client_ip, wg_interface, *, cursor, exclude_client_id=None):
    return service_ops.validate_client_ip_for_interface(
        client_ip=client_ip,
        wg_interface=wg_interface,
        cursor=cursor,
        exclude_client_id=exclude_client_id,
    )


def fetch_allowed_ips_row(client_id, *, cursor):
    return cursor.execute(
        "SELECT allowed_ips FROM client_settings WHERE client_id = ?",
        (client_id,),
    ).fetchone()


def fetch_interface_peer_rows(wg_iface, *, cursor):
    return cursor.execute(
        "SELECT pubkey, ip FROM clients WHERE wg_interface = ? ORDER BY id ASC",
        (wg_iface,),
    ).fetchall()


def load_api_key(*, api_key_env_var, api_key_file, normalize_config_value_fn):
    return support_facade_ops.load_api_key(
        api_key_env_var=api_key_env_var,
        api_key_file=api_key_file,
        normalize_config_value_fn=normalize_config_value_fn,
    )


def save_api_key(api_key, *, api_key_file, normalize_config_value_fn):
    return support_facade_ops.save_api_key(
        api_key,
        api_key_file=api_key_file,
        normalize_config_value_fn=normalize_config_value_fn,
    )


def render_qr_in_terminal(content):
    return support_facade_ops.render_qr_in_terminal(content)


def build_qr_svg(content):
    return support_facade_ops.build_qr_svg(content)


def verify_api_auth(api_key, provided_encryption_secret, *, load_api_key_fn, normalize_config_value_fn):
    return support_facade_ops.verify_api_auth(
        api_key,
        provided_encryption_secret,
        load_api_key_fn=load_api_key_fn,
        normalize_config_value_fn=normalize_config_value_fn,
    )


def rotate_api_key(*, save_api_key_fn):
    return support_facade_ops.rotate_api_key(
        save_api_key_fn=save_api_key_fn,
    )


def read_database_bytes(*, db_file_path):
    return support_facade_ops.read_database_bytes(
        db_file_path=db_file_path,
    )


def restore_database_from_bytes(raw_bytes, *, cursor, conn):
    return support_facade_ops.restore_database_from_bytes(
        raw_bytes,
        cursor=cursor,
        conn=conn,
    )


def decode_base64_payload(payload):
    return support_facade_ops.decode_base64_payload(payload)


def _random_h_value(*, random_randint_fn):
    return awg_params_ops._random_h_value(
        random_randint_fn=random_randint_fn,
    )


def _random_h_range(*, random_randint_fn):
    return awg_params_ops._random_h_range(
        random_randint_fn=random_randint_fn,
    )


def generate_awg_obfuscation_params(
    awg_version="2",
    *,
    detect_awg_version_fn,
    random_randint_fn=None,
    random_sample_fn=None,
):
    if random_randint_fn is None:
        random_randint_fn = random.randint
    if random_sample_fn is None:
        random_sample_fn = random.sample
    return awg_params_ops.generate_awg_obfuscation_params(
        awg_version,
        detect_awg_version_fn=detect_awg_version_fn,
        random_randint_fn=random_randint_fn,
        random_sample_fn=random_sample_fn,
    )


def get_awg_param_keys_for_version(awg_version, *, detect_awg_version_fn):
    return awg_params_ops.get_awg_param_keys_for_version(
        awg_version,
        detect_awg_version_fn=detect_awg_version_fn,
    )


def detect_awg_version(awg_version, awg_params, *, normalize_config_value_fn):
    return awg_params_ops.detect_awg_version(
        awg_version,
        awg_params,
        normalize_config_value_fn=normalize_config_value_fn,
    )


def build_awg_params_from_row(row):
    return awg_params_ops.build_awg_params_from_row(row)


def prepare_awg_params_for_version(awg_version, *, generate_awg_obfuscation_params_fn, detect_awg_version_fn):
    return awg_params_ops.prepare_awg_params_for_version(
        awg_version,
        generate_awg_obfuscation_params_fn=generate_awg_obfuscation_params_fn,
        detect_awg_version_fn=detect_awg_version_fn,
    )


def parse_h_value_or_range(value, *, normalize_config_value_fn):
    return awg_params_ops.parse_h_value_or_range(
        value,
        normalize_config_value_fn=normalize_config_value_fn,
    )


def validate_awg_params(
    awg_version,
    awg_params,
    *,
    detect_awg_version_fn,
    normalize_config_value_fn,
    parse_h_value_or_range_fn,
):
    return awg_params_ops.validate_awg_params(
        awg_version,
        awg_params,
        detect_awg_version_fn=detect_awg_version_fn,
        normalize_config_value_fn=normalize_config_value_fn,
        parse_h_value_or_range_fn=parse_h_value_or_range_fn,
    )


def prompt_awg_version(default="2", *, detect_awg_version_fn, input_fn, print_fn):
    return awg_params_ops.prompt_awg_version(
        default,
        detect_awg_version_fn=detect_awg_version_fn,
        input_fn=input_fn,
        print_fn=print_fn,
    )


def prompt_version_2_signature_params(awg_params, *, input_fn):
    return awg_params_ops.prompt_version_2_signature_params(
        awg_params,
        input_fn=input_fn,
    )


def format_awg_params_for_display(
    awg_version,
    awg_params,
    *,
    get_awg_param_keys_for_version_fn,
    normalize_config_value_fn,
):
    return awg_params_ops.format_awg_params_for_display(
        awg_version,
        awg_params,
        get_awg_param_keys_for_version_fn=get_awg_param_keys_for_version_fn,
        normalize_config_value_fn=normalize_config_value_fn,
    )


def get_filtered_awg_params(
    awg_version,
    awg_params,
    *,
    get_awg_param_keys_for_version_fn,
    normalize_config_value_fn,
):
    return awg_params_ops.get_filtered_awg_params(
        awg_version,
        awg_params,
        get_awg_param_keys_for_version_fn=get_awg_param_keys_for_version_fn,
        normalize_config_value_fn=normalize_config_value_fn,
    )


def parse_and_validate_interface_network(wg_ip_addr, wg_ip_cidr):
    return validation_ops.parse_and_validate_interface_network(
        wg_ip_addr,
        wg_ip_cidr,
    )


def parse_and_validate_port(port_number):
    return validation_ops.parse_and_validate_port(port_number)


def validate_ip_literal(value, field_name):
    return validation_ops.validate_ip_literal(value, field_name)


def assert_interface_uniqueness(wg_interface, port_number, network_cidr, *, parse_network_fn, cursor, exclude_id=None):
    def _has_interface_name_conflict(iface, excluded_id):
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

    def _has_port_conflict(port, excluded_id):
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

    def _fetch_all_interface_network_rows(excluded_id):
        if excluded_id is None:
            return cursor.execute("SELECT wg_ip_addr, wg_ip_cidr FROM wg_interfaces").fetchall()
        return cursor.execute(
            "SELECT wg_ip_addr, wg_ip_cidr FROM wg_interfaces WHERE id != ?",
            (excluded_id,),
        ).fetchall()

    return validation_ops.assert_interface_uniqueness(
        wg_interface,
        port_number,
        network_cidr,
        parse_network_fn=parse_network_fn,
        has_interface_name_conflict_fn=_has_interface_name_conflict,
        has_port_conflict_fn=_has_port_conflict,
        fetch_all_interface_network_rows_fn=_fetch_all_interface_network_rows,
        exclude_id=exclude_id,
    )


def validate_interface_name(wg_interface):
    return validation_ops.validate_interface_name(wg_interface)
