#!/usr/bin/python3


def generate_keypair(*, run_check_output_fn):
    priv_key = run_check_output_fn(["awg", "genkey"]).strip().decode("utf-8")
    pub_key = run_check_output_fn(["awg", "pubkey"], input=priv_key.encode("utf-8")).strip().decode("utf-8")
    return priv_key, pub_key


def create_temp_key_file(
    private_key,
    *,
    named_temporary_file_factory_fn,
    chmod_fn,
):
    temp_file = named_temporary_file_factory_fn(mode="w", delete=False)
    try:
        temp_file.write(private_key)
        temp_file.flush()
    finally:
        temp_file.close()
    chmod_fn(temp_file.name, 0o600)
    return temp_file.name


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
    cmd = [
        "awg",
        "set",
        wg_interface,
        "listen-port",
        str(port_number),
        "private-key",
        key_file_path,
    ]

    awg_version = detect_awg_version_fn(awg_version, awg_params)
    ordered_params = []
    if awg_version in ("1", "2"):
        ordered_params.extend(
            [
                ("jc", awg_params.get("Jc")),
                ("jmin", awg_params.get("Jmin")),
                ("jmax", awg_params.get("Jmax")),
                ("s1", awg_params.get("S1")),
                ("s2", awg_params.get("S2")),
                ("h1", awg_params.get("H1")),
                ("h2", awg_params.get("H2")),
                ("h3", awg_params.get("H3")),
                ("h4", awg_params.get("H4")),
            ]
        )
    if awg_version == "2":
        ordered_params.extend(
            [
                ("s3", awg_params.get("S3")),
                ("s4", awg_params.get("S4")),
                ("i1", awg_params.get("I1")),
                ("i2", awg_params.get("I2")),
                ("i3", awg_params.get("I3")),
                ("i4", awg_params.get("I4")),
                ("i5", awg_params.get("I5")),
            ]
        )

    for param_name, value in ordered_params:
        normalized = normalize_config_value_fn(value)
        if normalized is not None:
            cmd.extend([param_name, normalized])

    return cmd


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
    key_file_path = create_temp_key_file_fn(private_key)
    try:
        run_command_fn(["ip", "link", "add", wg_interface, "type", "amneziawg"])
        run_command_fn(["ip", "address", "replace", f"{wg_ip_addr}/{wg_ip_cidr}", "dev", wg_interface])
        run_command_fn(["ip", "link", "set", "up", "dev", wg_interface])
        run_command_fn(build_awg_set_command_fn(wg_interface, port_number, key_file_path, awg_version, awg_params))
    finally:
        if path_exists_fn(key_file_path):
            unlink_fn(key_file_path)


def remove_interface_runtime(wg_interface, *, run_command_fn):
    run_command_fn(["ip", "link", "set", "down", "dev", wg_interface])
    run_command_fn(["ip", "link", "del", wg_interface, "type", "amneziawg"])


def wg_lease_ip(wg_int, *, run_check_output_fn):
    output = run_check_output_fn(["awg", "show", wg_int, "allowed-ips"])
    ips = output.decode().split("\n")[:-1]

    ip_addresses = []
    for line in ips:
        parts = line.split("\t")
        if len(parts) > 1 and parts[1] != "(none)":
            ip_addresses.append(parts[1])
    return ip_addresses


def add_peer(
    wg_interface,
    public_key,
    ip_address,
    *,
    run_command_fn,
    print_fn,
    called_process_error_type,
):
    try:
        cmd = ["awg", "set", wg_interface, "peer", public_key, "allowed-ips", ip_address]
        print_fn(cmd)
        run_command_fn(cmd)
    except called_process_error_type as e:
        print_fn("--------------------------------------------------------------------------------")
        print_fn(f"Error setting: {e}")
        print_fn("--------------------------------------------------------------------------------")


def del_peer(
    wg_interface,
    public_key,
    *,
    run_command_fn,
    print_fn,
    called_process_error_type,
):
    try:
        cmd = ["awg", "set", wg_interface, "peer", public_key, "remove"]
        run_command_fn(cmd)
    except called_process_error_type as e:
        print_fn("--------------------------------------------------------------------------------")
        print_fn(f"Error setting: {e}")
        print_fn("--------------------------------------------------------------------------------")


def append_config_param(lines, key, value, *, normalize_config_value_fn):
    normalized = normalize_config_value_fn(value)
    if normalized is not None:
        lines.append(f"{key} = {normalized}")


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
    awg_version = detect_awg_version_fn(awg_version, awg_params)
    lines = [
        "",
        "[Interface]",
        f"PrivateKey = {client_private_key}",
        f"Address = {client_ip}/32",
        f"DNS = {srv_dns}",
    ]

    if awg_version in ("1", "2"):
        append_config_param_fn(lines, "Jc", awg_params.get("Jc"))
        append_config_param_fn(lines, "Jmin", awg_params.get("Jmin"))
        append_config_param_fn(lines, "Jmax", awg_params.get("Jmax"))
        append_config_param_fn(lines, "S1", awg_params.get("S1"))
        append_config_param_fn(lines, "S2", awg_params.get("S2"))
        append_config_param_fn(lines, "H1", awg_params.get("H1"))
        append_config_param_fn(lines, "H2", awg_params.get("H2"))
        append_config_param_fn(lines, "H3", awg_params.get("H3"))
        append_config_param_fn(lines, "H4", awg_params.get("H4"))
    if awg_version == "2":
        append_config_param_fn(lines, "S3", awg_params.get("S3"))
        append_config_param_fn(lines, "S4", awg_params.get("S4"))
        append_config_param_fn(lines, "I1", awg_params.get("I1"))
        append_config_param_fn(lines, "I2", awg_params.get("I2"))
        append_config_param_fn(lines, "I3", awg_params.get("I3"))
        append_config_param_fn(lines, "I4", awg_params.get("I4"))
        append_config_param_fn(lines, "I5", awg_params.get("I5"))

    lines.extend(
        [
            "",
            "[Peer]",
            f"PublicKey = {server_pubkey}",
            f"Endpoint = {srv_ip}:{port_number}",
            f"AllowedIPs = {allowed_ips}",
        ]
    )
    return lines
