#!/usr/bin/python3
from . import runtime_ops


def generate_keypair(*, run_check_output_fn):
    return runtime_ops.generate_keypair(
        run_check_output_fn=run_check_output_fn,
    )


def create_temp_key_file(
    private_key,
    *,
    named_temporary_file_factory_fn,
    chmod_fn,
):
    return runtime_ops.create_temp_key_file(
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
    return runtime_ops.apply_interface_runtime(
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
    return runtime_ops.remove_interface_runtime(
        wg_interface,
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
    return runtime_ops.build_awg_set_command(
        wg_interface,
        port_number,
        key_file_path,
        awg_version,
        awg_params,
        detect_awg_version_fn=detect_awg_version_fn,
        normalize_config_value_fn=normalize_config_value_fn,
    )


def append_config_param(lines, key, value, *, normalize_config_value_fn):
    return runtime_ops.append_config_param(
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
    return runtime_ops.build_client_config_lines(
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
