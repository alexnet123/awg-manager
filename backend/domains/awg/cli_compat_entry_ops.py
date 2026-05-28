#!/usr/bin/python3

from . import cli_legacy_service_ops
from . import cli_read_ops
from . import cli_service_ops
from . import cli_support_ops


def add_client(
    *,
    cursor,
    conn,
    input_fn,
    get_next_available_ip_fn,
    run_check_output_fn,
    encrypt_private_key_fn,
    run_command_fn,
    print_fn,
    sqlite_error_type,
    called_process_error_type,
):
    return cli_legacy_service_ops.add_client(
        cursor=cursor,
        conn=conn,
        input_fn=input_fn,
        get_next_available_ip_fn=get_next_available_ip_fn,
        run_check_output_fn=run_check_output_fn,
        encrypt_private_key_fn=encrypt_private_key_fn,
        run_command_fn=run_command_fn,
        print_fn=print_fn,
        sqlite_error_type=sqlite_error_type,
        called_process_error_type=called_process_error_type,
    )


def delete_client(*, cursor, conn, list_clients_fn, input_fn, run_command_fn, del_peer_fn, print_fn):
    return cli_legacy_service_ops.delete_client(
        cursor=cursor,
        conn=conn,
        list_clients_fn=list_clients_fn,
        input_fn=input_fn,
        run_command_fn=run_command_fn,
        del_peer_fn=del_peer_fn,
        print_fn=print_fn,
    )


def list_clients(*, cursor, decrypt_private_key_fn, print_fn):
    return cli_read_ops.list_clients(
        cursor=cursor,
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
    return cli_read_ops.list_wg_int(
        cursor=cursor,
        wg_interface_columns=wg_interface_columns,
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
    return cli_read_ops.list_wg_int_clients(
        cursor=cursor,
        wg_interface_columns=wg_interface_columns,
        build_awg_params_from_row_fn=build_awg_params_from_row_fn,
        detect_awg_version_fn=detect_awg_version_fn,
        format_awg_params_for_display_fn=format_awg_params_for_display_fn,
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
    return cli_read_ops.client_qrencode(
        cursor=cursor,
        wg_interface_columns=wg_interface_columns,
        list_clients_fn=list_clients_fn,
        input_fn=input_fn,
        build_awg_params_from_row_fn=build_awg_params_from_row_fn,
        build_client_config_lines_fn=build_client_config_lines_fn,
        decrypt_private_key_fn=decrypt_private_key_fn,
        render_qr_in_terminal_fn=render_qr_in_terminal_fn,
        print_fn=print_fn,
    )


def show_api_key_status(*, load_api_key_fn, api_key_env_var, api_key_file, print_fn):
    return cli_support_ops.show_api_key_status(
        load_api_key_fn=load_api_key_fn,
        api_key_env_var=api_key_env_var,
        api_key_file=api_key_file,
        print_fn=print_fn,
    )


def set_api_key(*, getpass_fn, save_api_key_fn, api_key_file, print_fn):
    return cli_support_ops.set_api_key(
        getpass_fn=getpass_fn,
        save_api_key_fn=save_api_key_fn,
        api_key_file=api_key_file,
        print_fn=print_fn,
    )


def wg_lease_ip(wg_int, *, run_check_output_fn):
    return cli_support_ops.wg_lease_ip(
        wg_int,
        run_check_output_fn=run_check_output_fn,
    )


def add_peer(
    wg_interface,
    public_key,
    ip_address,
    *,
    run_command_fn,
    print_fn,
    called_process_error_type,
):
    return cli_support_ops.add_peer(
        wg_interface,
        public_key,
        ip_address,
        run_command_fn=run_command_fn,
        print_fn=print_fn,
        called_process_error_type=called_process_error_type,
    )


def del_peer(wg_interface, public_key, *, run_command_fn, print_fn, called_process_error_type):
    return cli_support_ops.del_peer(
        wg_interface,
        public_key,
        run_command_fn=run_command_fn,
        print_fn=print_fn,
        called_process_error_type=called_process_error_type,
    )


def write_text_file(path, content, *, open_fn):
    return cli_support_ops.write_text_file(
        path,
        content,
        open_fn=open_fn,
    )


def add_wg_int(
    *,
    cursor,
    conn,
    input_fn,
    prompt_awg_version_fn,
    run_check_output_fn,
    prepare_awg_params_for_version_fn,
    prompt_version_2_signature_params_fn,
    print_fn,
    run_command_fn,
    build_awg_set_command_fn,
    write_key_file_fn,
    sqlite_error_type,
    called_process_error_type,
):
    return cli_service_ops.add_wg_int(
        cursor=cursor,
        conn=conn,
        input_fn=input_fn,
        prompt_awg_version_fn=prompt_awg_version_fn,
        run_check_output_fn=run_check_output_fn,
        prepare_awg_params_for_version_fn=prepare_awg_params_for_version_fn,
        prompt_version_2_signature_params_fn=prompt_version_2_signature_params_fn,
        print_fn=print_fn,
        run_command_fn=run_command_fn,
        build_awg_set_command_fn=build_awg_set_command_fn,
        write_key_file_fn=write_key_file_fn,
        sqlite_error_type=sqlite_error_type,
        called_process_error_type=called_process_error_type,
    )


def del_wg_int(*, cursor, conn, wg_interface_columns, list_wg_int_fn, input_fn, run_command_fn, print_fn):
    return cli_service_ops.del_wg_int(
        cursor=cursor,
        conn=conn,
        wg_interface_columns=wg_interface_columns,
        list_wg_int_fn=list_wg_int_fn,
        input_fn=input_fn,
        run_command_fn=run_command_fn,
        print_fn=print_fn,
    )


def update_interface(
    *,
    cursor,
    conn,
    wg_interface_columns,
    list_wg_int_fn,
    print_fn,
    input_fn,
    detect_awg_version_fn,
    build_awg_params_from_row_fn,
    prompt_awg_version_fn,
    prepare_awg_params_for_version_fn,
    prompt_version_2_signature_params_fn,
    run_command_fn,
    build_awg_set_command_fn,
    write_key_file_fn,
):
    return cli_service_ops.update_interface(
        cursor=cursor,
        conn=conn,
        wg_interface_columns=wg_interface_columns,
        list_wg_int_fn=list_wg_int_fn,
        print_fn=print_fn,
        input_fn=input_fn,
        detect_awg_version_fn=detect_awg_version_fn,
        build_awg_params_from_row_fn=build_awg_params_from_row_fn,
        prompt_awg_version_fn=prompt_awg_version_fn,
        prepare_awg_params_for_version_fn=prepare_awg_params_for_version_fn,
        prompt_version_2_signature_params_fn=prompt_version_2_signature_params_fn,
        run_command_fn=run_command_fn,
        build_awg_set_command_fn=build_awg_set_command_fn,
        write_key_file_fn=write_key_file_fn,
    )


def update_peer(
    *,
    cursor,
    conn,
    list_clients_fn,
    input_fn,
    del_peer_fn,
    encrypt_private_key_fn,
    add_peer_fn,
    print_fn,
):
    return cli_service_ops.update_peer(
        cursor=cursor,
        conn=conn,
        list_clients_fn=list_clients_fn,
        input_fn=input_fn,
        del_peer_fn=del_peer_fn,
        encrypt_private_key_fn=encrypt_private_key_fn,
        add_peer_fn=add_peer_fn,
        print_fn=print_fn,
    )


def sync(
    _type,
    *,
    cursor,
    wg_interface_columns,
    run_check_output_fn,
    run_command_fn,
    build_awg_set_command_fn,
    write_key_file_fn,
    apply_firewall_rules_fn,
    print_fn,
    called_process_error_type,
    devnull,
    pipe,
):
    return cli_legacy_service_ops.sync(
        _type,
        cursor=cursor,
        wg_interface_columns=wg_interface_columns,
        run_check_output_fn=run_check_output_fn,
        run_command_fn=run_command_fn,
        build_awg_set_command_fn=build_awg_set_command_fn,
        write_key_file_fn=write_key_file_fn,
        apply_firewall_rules_fn=apply_firewall_rules_fn,
        print_fn=print_fn,
        called_process_error_type=called_process_error_type,
        devnull=devnull,
        pipe=pipe,
    )
