#!/usr/bin/python3
from . import cli_legacy_ops


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
    return cli_legacy_ops.add_client(
        input_fn=input_fn,
        get_next_available_ip_fn=get_next_available_ip_fn,
        run_check_output_fn=run_check_output_fn,
        encrypt_private_key_fn=encrypt_private_key_fn,
        insert_client_row_fn=lambda name, pub_key, priv_key, client_ip, wg_interface: cursor.execute(
            """INSERT INTO clients (name, pubkey, privkey, ip, wg_interface)
                     VALUES (?, ?, ?, ?, ?)""",
            (name, pub_key, priv_key, client_ip, wg_interface),
        ),
        commit_fn=conn.commit,
        run_command_fn=run_command_fn,
        print_fn=print_fn,
        sqlite_error_type=sqlite_error_type,
        called_process_error_type=called_process_error_type,
    )


def delete_client(
    *,
    cursor,
    conn,
    list_clients_fn,
    input_fn,
    run_command_fn,
    del_peer_fn,
    print_fn,
):
    return cli_legacy_ops.delete_client(
        list_clients_fn=list_clients_fn,
        input_fn=input_fn,
        fetch_client_by_id_fn=lambda client_id: cursor.execute(
            "SELECT * FROM clients WHERE id = ?",
            (client_id,),
        ).fetchone(),
        run_command_fn=run_command_fn,
        delete_client_row_fn=lambda row_id: cursor.execute(
            "DELETE FROM clients WHERE id = ?",
            (row_id,),
        ),
        commit_fn=conn.commit,
        del_peer_fn=del_peer_fn,
        print_fn=print_fn,
    )


def sync(
    sync_type,
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
    return cli_legacy_ops.sync(
        sync_type,
        run_check_output_fn=run_check_output_fn,
        run_command_fn=run_command_fn,
        fetch_interfaces_fn=lambda: cursor.execute(
            f"SELECT {wg_interface_columns} FROM wg_interfaces"
        ).fetchall(),
        build_awg_set_command_fn=build_awg_set_command_fn,
        write_key_file_fn=write_key_file_fn,
        fetch_clients_fn=lambda: cursor.execute("SELECT * FROM clients").fetchall(),
        apply_firewall_rules_fn=apply_firewall_rules_fn,
        print_fn=print_fn,
        called_process_error_type=called_process_error_type,
        devnull=devnull,
        pipe=pipe,
    )
