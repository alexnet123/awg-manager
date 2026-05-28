#!/usr/bin/python3
from . import config_render_ops


def serialize_interface_row(
    row,
    *,
    build_awg_params_from_row_fn,
    detect_awg_version_fn,
    get_filtered_awg_params_fn,
):
    return config_render_ops.serialize_interface_row(
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
    return config_render_ops.serialize_client_row(
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
    return config_render_ops.build_client_config(
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
    return config_render_ops.build_interface_server_config(
        interface_row,
        build_awg_params_from_row_fn=build_awg_params_from_row_fn,
        normalize_config_value_fn=normalize_config_value_fn,
        detect_awg_version_fn=detect_awg_version_fn,
        append_config_param_fn=append_config_param_fn,
        fetch_peer_rows_fn=fetch_peer_rows_fn,
    )
