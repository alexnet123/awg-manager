#!/usr/bin/python3
from . import cli_list_ops
from . import cli_misc_ops


def list_clients(*, cursor, decrypt_private_key_fn, print_fn):
    return cli_list_ops.list_clients(
        fetch_clients_fn=lambda: cursor.execute("SELECT * FROM clients").fetchall(),
        decrypt_private_key_fn=decrypt_private_key_fn,
        print_fn=print_fn,
    )


def list_wg_int(
    *,
    cursor,
    wg_interface_columns,
    build_awg_params_from_row_fn,
    detect_awg_version_fn,
    format_awg_params_for_display_fn,
    print_fn,
):
    return cli_list_ops.list_wg_int(
        fetch_interfaces_fn=lambda: cursor.execute(
            f"SELECT {wg_interface_columns} FROM wg_interfaces"
        ).fetchall(),
        build_awg_params_from_row_fn=build_awg_params_from_row_fn,
        detect_awg_version_fn=detect_awg_version_fn,
        format_awg_params_for_display_fn=format_awg_params_for_display_fn,
        print_fn=print_fn,
    )


def list_wg_int_clients(
    *,
    cursor,
    wg_interface_columns,
    build_awg_params_from_row_fn,
    detect_awg_version_fn,
    format_awg_params_for_display_fn,
    decrypt_private_key_fn,
    print_fn,
):
    return cli_list_ops.list_wg_int_clients(
        fetch_interfaces_fn=lambda: cursor.execute(
            f"SELECT {wg_interface_columns} FROM wg_interfaces"
        ).fetchall(),
        build_awg_params_from_row_fn=build_awg_params_from_row_fn,
        detect_awg_version_fn=detect_awg_version_fn,
        format_awg_params_for_display_fn=format_awg_params_for_display_fn,
        fetch_clients_for_interface_fn=lambda iface: cursor.execute(
            "SELECT * FROM clients WHERE wg_interface = ?",
            (iface,),
        ).fetchall(),
        decrypt_private_key_fn=decrypt_private_key_fn,
        print_fn=print_fn,
    )


def client_qrencode(
    *,
    cursor,
    wg_interface_columns,
    list_clients_fn,
    input_fn,
    build_awg_params_from_row_fn,
    build_client_config_lines_fn,
    decrypt_private_key_fn,
    render_qr_in_terminal_fn,
    print_fn,
):
    return cli_misc_ops.client_qrencode(
        list_clients_fn=list_clients_fn,
        input_fn=input_fn,
        fetch_client_by_id_fn=lambda client_id: cursor.execute(
            "SELECT * FROM clients WHERE id = ?",
            (client_id,),
        ).fetchone(),
        fetch_interface_by_name_fn=lambda wg_iface: cursor.execute(
            f"SELECT {wg_interface_columns} FROM wg_interfaces WHERE wg_interface = ?",
            (wg_iface,),
        ).fetchone(),
        build_awg_params_from_row_fn=build_awg_params_from_row_fn,
        build_client_config_lines_fn=build_client_config_lines_fn,
        decrypt_private_key_fn=decrypt_private_key_fn,
        render_qr_in_terminal_fn=render_qr_in_terminal_fn,
        print_fn=print_fn,
    )
