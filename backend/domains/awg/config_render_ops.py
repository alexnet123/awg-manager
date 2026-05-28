#!/usr/bin/python3


def serialize_interface_row(
    row,
    *,
    build_awg_params_from_row_fn,
    detect_awg_version_fn,
    get_filtered_awg_params_fn,
):
    awg_params = build_awg_params_from_row_fn(row)
    awg_version = detect_awg_version_fn(row[2], awg_params)
    return {
        "id": row[0],
        "wg_interface": row[1],
        "awg_version": awg_version,
        "port_number": row[3],
        "wg_ip_addr": row[4],
        "wg_ip_cidr": row[5],
        "public_key": row[7],
        "srv_ip": row[8],
        "srv_dns": row[9],
        "awg_params": get_filtered_awg_params_fn(awg_version, awg_params),
    }


def serialize_client_row(
    row,
    *,
    fetch_allowed_ips_fn,
    normalize_config_value_fn,
    decrypt_private_key_fn,
    include_private_key=False,
):
    settings_row = fetch_allowed_ips_fn(row[0])
    allowed_ips = (
        settings_row[0]
        if settings_row and normalize_config_value_fn(settings_row[0]) is not None
        else "0.0.0.0/0"
    )
    client_data = {
        "id": row[0],
        "name": row[1],
        "pubkey": row[2],
        "ip": row[4],
        "wg_interface": row[5],
        "allowed_ips": allowed_ips,
    }
    if include_private_key:
        client_data["privkey"] = decrypt_private_key_fn(row[3])
    return client_data


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
    settings_row = fetch_allowed_ips_fn(client_row[0])
    allowed_ips = (
        settings_row[0]
        if settings_row and normalize_config_value_fn(settings_row[0]) is not None
        else "0.0.0.0/0"
    )
    awg_params = build_awg_params_from_row_fn(interface_row)
    client_lines = build_client_config_lines_fn(
        str(decrypt_private_key_fn(client_row[3])),
        client_row[4],
        interface_row[9],
        interface_row[2],
        awg_params,
        interface_row[7],
        interface_row[8],
        interface_row[3],
        allowed_ips,
    )
    return "\n".join(client_lines) + "\n"


def build_interface_server_config(
    interface_row,
    *,
    build_awg_params_from_row_fn,
    normalize_config_value_fn,
    detect_awg_version_fn,
    append_config_param_fn,
    fetch_peer_rows_fn,
):
    awg_params = build_awg_params_from_row_fn(interface_row)
    lines = [
        "[Interface]",
        f"PrivateKey = {interface_row[6]}",
        f"Address = {interface_row[4]}/{interface_row[5]}",
        f"ListenPort = {interface_row[3]}",
    ]

    if normalize_config_value_fn(interface_row[9]) is not None:
        lines.append(f"DNS = {interface_row[9]}")

    detected_version = detect_awg_version_fn(interface_row[2], awg_params)
    if detected_version in ("1", "2"):
        for key in ("Jc", "Jmin", "Jmax", "S1", "S2", "H1", "H2", "H3", "H4"):
            append_config_param_fn(lines, key, awg_params.get(key))
    if detected_version == "2":
        for key in ("S3", "S4", "I1", "I2", "I3", "I4", "I5"):
            append_config_param_fn(lines, key, awg_params.get(key))

    peer_rows = fetch_peer_rows_fn(interface_row[1])
    for peer_pubkey, peer_ip in peer_rows:
        lines.extend(
            [
                "",
                "[Peer]",
                f"PublicKey = {peer_pubkey}",
                f"AllowedIPs = {peer_ip}/32",
            ]
        )

    return "\n".join(lines) + "\n"
