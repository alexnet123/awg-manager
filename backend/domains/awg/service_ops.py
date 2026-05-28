#!/usr/bin/python3
from . import client_service_ops
from . import interface_service_ops
from . import ip_alloc_ops


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
    return interface_service_ops.create_interface_service(
        payload,
        normalize_config_value_fn=normalize_config_value_fn,
        detect_awg_version_fn=detect_awg_version_fn,
        validate_interface_name_fn=validate_interface_name_fn,
        parse_and_validate_port_fn=parse_and_validate_port_fn,
        parse_and_validate_interface_network_fn=parse_and_validate_interface_network_fn,
        validate_ip_literal_fn=validate_ip_literal_fn,
        generate_keypair_fn=generate_keypair_fn,
        prepare_awg_params_for_version_fn=prepare_awg_params_for_version_fn,
        validate_awg_params_fn=validate_awg_params_fn,
        begin_tx_fn=lambda: cursor.execute("BEGIN IMMEDIATE"),
        assert_interface_uniqueness_fn=assert_interface_uniqueness_fn,
        insert_interface_fn=lambda wg_interface, awg_version, port_number, wg_ip_addr, wg_ip_cidr, private_key, public_key, srv_ip, srv_dns, awg_params: (
            cursor.execute(
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
                    private_key,
                    public_key,
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
            cursor.lastrowid,
        )[1],
        apply_interface_runtime_fn=apply_interface_runtime_fn,
        commit_fn=conn.commit,
        delete_interface_row_fn=lambda row_id: cursor.execute(
            "DELETE FROM wg_interfaces WHERE id = ?",
            (row_id,),
        ),
        rollback_fn=conn.rollback,
        fetch_interface_row_fn=lambda target_id: cursor.execute(
            f"SELECT {wg_interface_columns} FROM wg_interfaces WHERE id = ?",
            (target_id,),
        ).fetchone(),
    )


def delete_interface_service(
    interface_id,
    *,
    cursor,
    conn,
    wg_interface_columns,
    remove_interface_runtime_fn,
):
    return interface_service_ops.delete_interface_service(
        interface_id,
        fetch_interface_row_fn=lambda target_id: cursor.execute(
            f"SELECT {wg_interface_columns} FROM wg_interfaces WHERE id = ?",
            (target_id,),
        ).fetchone(),
        count_interface_clients_fn=lambda wg_iface: cursor.execute(
            "SELECT COUNT(*) FROM clients WHERE wg_interface = ?",
            (wg_iface,),
        ).fetchone()[0],
        remove_interface_runtime_fn=remove_interface_runtime_fn,
        delete_interface_row_fn=lambda target_id: cursor.execute(
            "DELETE FROM wg_interfaces WHERE id = ?",
            (target_id,),
        ),
        commit_fn=conn.commit,
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
    return interface_service_ops.update_interface_service(
        interface_id,
        payload,
        fetch_interface_row_fn=lambda target_id: cursor.execute(
            f"SELECT {wg_interface_columns} FROM wg_interfaces WHERE id = ?",
            (target_id,),
        ).fetchone(),
        build_awg_params_from_row_fn=build_awg_params_from_row_fn,
        detect_awg_version_fn=detect_awg_version_fn,
        normalize_config_value_fn=normalize_config_value_fn,
        validate_interface_name_fn=validate_interface_name_fn,
        parse_and_validate_port_fn=parse_and_validate_port_fn,
        parse_and_validate_interface_network_fn=parse_and_validate_interface_network_fn,
        validate_ip_literal_fn=validate_ip_literal_fn,
        prepare_awg_params_for_version_fn=prepare_awg_params_for_version_fn,
        validate_awg_params_fn=validate_awg_params_fn,
        begin_tx_fn=lambda: cursor.execute("BEGIN IMMEDIATE"),
        assert_interface_uniqueness_fn=assert_interface_uniqueness_fn,
        remove_interface_runtime_fn=remove_interface_runtime_fn,
        update_interface_row_fn=lambda target_id, wg_interface, awg_version, wg_ip_addr, wg_ip_cidr, port_number, private_key, public_key, srv_ip, srv_dns, awg_params: cursor.execute(
            """UPDATE wg_interfaces
               SET wg_interface=?, awg_version=?, wg_ip_addr=?, wg_ip_cidr=?, port_number=?, private_key=?, pubkey=?, srv_ip=?, srv_dns=?,
                   Jc=?, Jmin=?, Jmax=?, S1=?, S2=?, S3=?, S4=?, H1=?, H2=?, H3=?, H4=?, I1=?, I2=?, I3=?, I4=?, I5=?
               WHERE id=?""",
            (
                wg_interface,
                awg_version,
                wg_ip_addr,
                wg_ip_cidr,
                port_number,
                private_key,
                public_key,
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
                target_id,
            ),
        ),
        update_clients_interface_fn=lambda new_iface, old_iface: cursor.execute(
            "UPDATE clients SET wg_interface = ? WHERE wg_interface = ?",
            (new_iface, old_iface),
        ),
        apply_interface_runtime_fn=apply_interface_runtime_fn,
        commit_fn=conn.commit,
        rollback_fn=conn.rollback,
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
    return client_service_ops.create_client_service(
        payload,
        normalize_config_value_fn=normalize_config_value_fn,
        interface_exists_fn=lambda wg_iface: cursor.execute(
            "SELECT 1 FROM wg_interfaces WHERE wg_interface = ?",
            (wg_iface,),
        ).fetchone()
        is not None,
        get_next_available_ip_fn=get_next_available_ip_fn,
        generate_keypair_fn=generate_keypair_fn,
        encrypt_private_key_fn=encrypt_private_key_fn,
        insert_client_fn=lambda name, pub, encrypted_priv, ip, wg_iface: (
            cursor.execute(
                """INSERT INTO clients (name, pubkey, privkey, ip, wg_interface)
                   VALUES (?, ?, ?, ?, ?)""",
                (name, pub, encrypted_priv, ip, wg_iface),
            ),
            cursor.lastrowid,
        )[1],
        upsert_client_settings_fn=lambda client_id, allowed_ips: cursor.execute(
            "INSERT OR REPLACE INTO client_settings (client_id, allowed_ips) VALUES (?, ?)",
            (client_id, allowed_ips),
        ),
        commit_fn=conn.commit,
        runtime_add_peer_fn=lambda wg_iface, pub, ip: run_command_fn(
            ["awg", "set", wg_iface, "peer", pub, "allowed-ips", ip + "/32"]
        ),
        fetch_client_row_fn=lambda target_id: cursor.execute(
            "SELECT * FROM clients WHERE id = ?",
            (target_id,),
        ).fetchone(),
    )


def delete_client_service(client_id, *, cursor, conn, run_command_fn):
    return client_service_ops.delete_client_service(
        client_id,
        fetch_client_row_fn=lambda target_id: cursor.execute(
            "SELECT * FROM clients WHERE id = ?",
            (target_id,),
        ).fetchone(),
        runtime_remove_peer_fn=lambda wg_iface, pub: run_command_fn(
            ["awg", "set", wg_iface, "peer", pub, "remove"]
        ),
        delete_client_settings_fn=lambda target_id: cursor.execute(
            "DELETE FROM client_settings WHERE client_id = ?",
            (target_id,),
        ),
        delete_client_fn=lambda target_id: cursor.execute(
            "DELETE FROM clients WHERE id = ?",
            (target_id,),
        ),
        commit_fn=conn.commit,
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
    return client_service_ops.update_client_service(
        client_id,
        payload,
        normalize_config_value_fn=normalize_config_value_fn,
        fetch_client_row_fn=lambda target_id: cursor.execute(
            "SELECT * FROM clients WHERE id = ?",
            (target_id,),
        ).fetchone(),
        interface_exists_fn=lambda wg_iface: cursor.execute(
            "SELECT 1 FROM wg_interfaces WHERE wg_interface = ?",
            (wg_iface,),
        ).fetchone()
        is not None,
        get_next_available_ip_fn=get_next_available_ip_fn,
        validate_client_ip_for_interface_fn=validate_client_ip_for_interface_fn,
        encrypt_private_key_fn=encrypt_private_key_fn,
        runtime_remove_peer_fn=lambda wg_iface, pub: run_command_fn(
            ["awg", "set", wg_iface, "peer", pub, "remove"]
        ),
        update_client_fn=lambda target_id, name, pub, encrypted_priv, ip, wg_iface: cursor.execute(
            "UPDATE clients SET name=?, pubkey=?, privkey=?, ip=?, wg_interface=? WHERE id=?",
            (name, pub, encrypted_priv, ip, wg_iface, target_id),
        ),
        upsert_client_settings_fn=lambda target_id, allowed_ips: cursor.execute(
            "INSERT OR REPLACE INTO client_settings (client_id, allowed_ips) VALUES (?, ?)",
            (target_id, allowed_ips),
        ),
        commit_fn=conn.commit,
        runtime_add_peer_fn=lambda wg_iface, pub, ip: run_command_fn(
            ["awg", "set", wg_iface, "peer", pub, "allowed-ips", ip + "/32"]
        ),
    )


def get_next_available_ip(wg_interface, *, cursor, exclude_client_id=None):
    return ip_alloc_ops.get_next_available_ip(
        wg_interface,
        fetch_interface_subnet_fn=lambda iface: cursor.execute(
            "SELECT wg_ip_addr, wg_ip_cidr FROM wg_interfaces WHERE wg_interface = ?",
            (iface,),
        ).fetchone(),
        fetch_used_ips_fn=lambda iface, exclude_id: (
            cursor.execute(
                "SELECT ip FROM clients WHERE wg_interface = ?",
                (iface,),
            ).fetchall()
            if exclude_id is None
            else cursor.execute(
                "SELECT ip FROM clients WHERE wg_interface = ? AND id != ?",
                (iface, exclude_id),
            ).fetchall()
        ),
        exclude_client_id=exclude_client_id,
    )


def validate_client_ip_for_interface(client_ip, wg_interface, *, cursor, exclude_client_id=None):
    return ip_alloc_ops.validate_client_ip_for_interface(
        client_ip=client_ip,
        wg_interface=wg_interface,
        fetch_interface_subnet_fn=lambda iface: cursor.execute(
            "SELECT wg_ip_addr, wg_ip_cidr FROM wg_interfaces WHERE wg_interface = ?",
            (iface,),
        ).fetchone(),
        has_ip_conflict_fn=lambda iface, ip_value, exclude_id: (
            cursor.execute(
                "SELECT 1 FROM clients WHERE wg_interface = ? AND ip = ?",
                (iface, ip_value),
            ).fetchone()
            if exclude_id is None
            else cursor.execute(
                "SELECT 1 FROM clients WHERE wg_interface = ? AND ip = ? AND id != ?",
                (iface, ip_value, exclude_id),
            ).fetchone()
        )
        is not None,
        exclude_client_id=exclude_client_id,
    )
