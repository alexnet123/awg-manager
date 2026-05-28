#!/usr/bin/python3
from . import cli_interface_ops
from . import cli_peer_ops


def add_wg_int(
    *,
    cursor,
    conn,
    input_fn,
    prompt_awg_version_fn,
    run_check_output_fn,
    prepare_awg_params_for_version_fn,
    prompt_version_2_signature_params_fn,
    run_command_fn,
    build_awg_set_command_fn,
    write_key_file_fn,
    print_fn,
    sqlite_error_type,
    called_process_error_type,
):
    return cli_interface_ops.add_wg_int(
        input_fn=input_fn,
        prompt_awg_version_fn=prompt_awg_version_fn,
        run_check_output_fn=run_check_output_fn,
        prepare_awg_params_for_version_fn=prepare_awg_params_for_version_fn,
        prompt_version_2_signature_params_fn=prompt_version_2_signature_params_fn,
        insert_interface_row_fn=lambda wg_interface, awg_version, port_number, wg_ip_addr, wg_ip_cidr, priv_key, pub_key, srv_ip, srv_dns, awg_params: cursor.execute(
            """INSERT INTO wg_interfaces (
                    wg_interface, awg_version, port_number, wg_ip_addr, wg_ip_cidr, private_key, pubkey, srv_ip, srv_dns,
                    Jc, Jmin, Jmax, S1, S2, S3, S4, H1, H2, H3, H4, I1, I2, I3, I4, I5
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                wg_interface,
                awg_version,
                port_number,
                wg_ip_addr,
                wg_ip_cidr,
                priv_key,
                pub_key,
                srv_ip,
                srv_dns,
                awg_params["Jc"],
                awg_params["Jmin"],
                awg_params["Jmax"],
                awg_params["S1"],
                awg_params["S2"],
                awg_params["S3"],
                awg_params["S4"],
                awg_params["H1"],
                awg_params["H2"],
                awg_params["H3"],
                awg_params["H4"],
                awg_params["I1"],
                awg_params["I2"],
                awg_params["I3"],
                awg_params["I4"],
                awg_params["I5"],
            ),
        ),
        commit_fn=conn.commit,
        print_fn=print_fn,
        run_command_fn=run_command_fn,
        build_awg_set_command_fn=build_awg_set_command_fn,
        write_key_file_fn=write_key_file_fn,
        sqlite_error_type=sqlite_error_type,
        called_process_error_type=called_process_error_type,
    )


def del_wg_int(
    *,
    cursor,
    conn,
    wg_interface_columns,
    list_wg_int_fn,
    input_fn,
    run_command_fn,
    print_fn,
):
    return cli_interface_ops.del_wg_int(
        list_wg_int_fn=list_wg_int_fn,
        input_fn=input_fn,
        fetch_interface_by_id_fn=lambda wg_id: cursor.execute(
            f"SELECT {wg_interface_columns} FROM wg_interfaces WHERE id = ?",
            (wg_id,),
        ).fetchone(),
        run_command_fn=run_command_fn,
        delete_interface_row_by_name_fn=lambda wg_interface: cursor.execute(
            "DELETE FROM wg_interfaces WHERE wg_interface = ?",
            (wg_interface,),
        ),
        commit_fn=conn.commit,
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
    return cli_interface_ops.update_interface(
        list_wg_int_fn=list_wg_int_fn,
        print_fn=print_fn,
        input_fn=input_fn,
        fetch_interface_by_name_fn=lambda iface: cursor.execute(
            f"SELECT {wg_interface_columns} FROM wg_interfaces WHERE wg_interface = ?",
            (iface,),
        ).fetchone(),
        detect_awg_version_fn=detect_awg_version_fn,
        build_awg_params_from_row_fn=build_awg_params_from_row_fn,
        prompt_awg_version_fn=prompt_awg_version_fn,
        prepare_awg_params_for_version_fn=prepare_awg_params_for_version_fn,
        prompt_version_2_signature_params_fn=prompt_version_2_signature_params_fn,
        run_command_fn=run_command_fn,
        update_interface_row_fn=lambda awg_version, wg_ip_addr, wg_ip_cidr, port_number, private_key, pubkey, srv_ip, srv_dns, awg_params, wg_interface: cursor.execute(
            """UPDATE wg_interfaces
               SET awg_version=?, wg_ip_addr=?, wg_ip_cidr=?, port_number=?, private_key=?, pubkey=?, srv_ip=?, srv_dns=?,
                   Jc=?, Jmin=?, Jmax=?, S1=?, S2=?, S3=?, S4=?, H1=?, H2=?, H3=?, H4=?, I1=?, I2=?, I3=?, I4=?, I5=?
               WHERE wg_interface=?""",
            (
                awg_version,
                wg_ip_addr,
                wg_ip_cidr,
                port_number,
                private_key,
                pubkey,
                srv_ip,
                srv_dns,
                awg_params["Jc"],
                awg_params["Jmin"],
                awg_params["Jmax"],
                awg_params["S1"],
                awg_params["S2"],
                awg_params["S3"],
                awg_params["S4"],
                awg_params["H1"],
                awg_params["H2"],
                awg_params["H3"],
                awg_params["H4"],
                awg_params["I1"],
                awg_params["I2"],
                awg_params["I3"],
                awg_params["I4"],
                awg_params["I5"],
                wg_interface,
            ),
        ),
        commit_fn=conn.commit,
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
    return cli_peer_ops.update_peer(
        list_clients_fn=list_clients_fn,
        input_fn=input_fn,
        fetch_client_pubkey_by_id_fn=lambda client_id: cursor.execute(
            "SELECT pubkey FROM clients WHERE id = ?",
            (client_id,),
        ).fetchone(),
        del_peer_fn=del_peer_fn,
        update_client_row_fn=lambda name, pubkey, encrypted_privkey, ip, wg_interface, client_id: cursor.execute(
            "UPDATE clients SET name=?, pubkey=?, privkey=?, ip=?, wg_interface=? WHERE id=?",
            (name, pubkey, encrypted_privkey, ip, wg_interface, client_id),
        ),
        encrypt_private_key_fn=encrypt_private_key_fn,
        commit_fn=conn.commit,
        add_peer_fn=add_peer_fn,
        print_fn=print_fn,
    )
