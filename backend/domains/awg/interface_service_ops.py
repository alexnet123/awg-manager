#!/usr/bin/python3


def interface_row_enabled(row):
    return len(row) < 27 or row[26] is None or bool(row[26])


def create_interface_service(
    payload,
    *,
    normalize_config_value_fn,
    detect_awg_version_fn,
    validate_interface_name_fn,
    parse_and_validate_port_fn,
    parse_and_validate_interface_network_fn,
    validate_ip_literal_fn,
    generate_keypair_fn,
    prepare_awg_params_for_version_fn,
    validate_awg_params_fn,
    begin_tx_fn,
    assert_interface_uniqueness_fn,
    insert_interface_fn,
    apply_interface_runtime_fn,
    commit_fn,
    delete_interface_row_fn,
    rollback_fn,
    fetch_interface_row_fn,
):
    wg_interface = normalize_config_value_fn(payload.get("wg_interface"))
    awg_version = detect_awg_version_fn(payload.get("awg_version", "2"), {})
    port_number = normalize_config_value_fn(payload.get("port_number"))
    wg_ip_addr = normalize_config_value_fn(payload.get("wg_ip_addr"))
    wg_ip_cidr = normalize_config_value_fn(payload.get("wg_ip_cidr"))
    srv_ip = normalize_config_value_fn(payload.get("srv_ip"))
    srv_dns = normalize_config_value_fn(payload.get("srv_dns"))
    private_key = normalize_config_value_fn(payload.get("private_key"))
    public_key = normalize_config_value_fn(payload.get("public_key"))

    if None in (wg_interface, port_number, wg_ip_addr, wg_ip_cidr, srv_ip, srv_dns):
        raise ValueError("Missing required interface fields")
    validate_interface_name_fn(wg_interface)
    if awg_version not in ("1", "2"):
        raise ValueError("Unsupported awg_version")
    port_number = parse_and_validate_port_fn(port_number)
    wg_ip_cidr, network_cidr = parse_and_validate_interface_network_fn(wg_ip_addr, wg_ip_cidr)
    validate_ip_literal_fn(srv_ip, "server IP")

    if private_key is None or public_key is None:
        private_key, public_key = generate_keypair_fn()

    awg_params = prepare_awg_params_for_version_fn(awg_version)
    payload_awg_params = payload.get("awg_params", {})
    if isinstance(payload_awg_params, dict):
        for key in awg_params.keys():
            if key in payload_awg_params:
                awg_params[key] = normalize_config_value_fn(payload_awg_params.get(key))
    validate_awg_params_fn(awg_version, awg_params)

    row_id = None
    try:
        begin_tx_fn()
        assert_interface_uniqueness_fn(wg_interface, port_number, network_cidr)
        row_id = insert_interface_fn(
            wg_interface,
            awg_version,
            port_number,
            wg_ip_addr,
            wg_ip_cidr,
            private_key,
            public_key,
            srv_ip,
            srv_dns,
            awg_params,
        )
        apply_interface_runtime_fn(wg_interface, port_number, wg_ip_addr, wg_ip_cidr, private_key, awg_version, awg_params)
        commit_fn()
    except Exception:
        if row_id is not None:
            try:
                delete_interface_row_fn(row_id)
                commit_fn()
            except Exception:
                rollback_fn()
        else:
            rollback_fn()
        raise

    return fetch_interface_row_fn(row_id)


def delete_interface_service(
    interface_id,
    *,
    fetch_interface_row_fn,
    count_interface_clients_fn,
    remove_interface_runtime_fn,
    delete_interface_row_fn,
    commit_fn,
):
    row = fetch_interface_row_fn(interface_id)
    if not row:
        raise LookupError("Interface not found")

    clients_count = count_interface_clients_fn(row[1])
    if clients_count:
        raise ValueError("Interface has clients attached")

    remove_interface_runtime_fn(row[1])
    delete_interface_row_fn(interface_id)
    commit_fn()
    return row


def update_interface_service(
    interface_id,
    payload,
    *,
    fetch_interface_row_fn,
    build_awg_params_from_row_fn,
    detect_awg_version_fn,
    normalize_config_value_fn,
    validate_interface_name_fn,
    parse_and_validate_port_fn,
    parse_and_validate_interface_network_fn,
    validate_ip_literal_fn,
    prepare_awg_params_for_version_fn,
    validate_awg_params_fn,
    begin_tx_fn,
    assert_interface_uniqueness_fn,
    remove_interface_runtime_fn,
    update_interface_row_fn,
    update_clients_interface_fn,
    apply_interface_runtime_fn,
    commit_fn,
    rollback_fn,
):
    current_row = fetch_interface_row_fn(interface_id)
    if not current_row:
        raise LookupError("Interface not found")

    current_params = build_awg_params_from_row_fn(current_row)
    awg_version = detect_awg_version_fn(payload.get("awg_version", current_row[2]), current_params)
    if awg_version not in ("1", "2"):
        raise ValueError("Unsupported awg_version")

    wg_interface = normalize_config_value_fn(payload.get("wg_interface")) or current_row[1]
    port_number = normalize_config_value_fn(payload.get("port_number")) or str(current_row[3])
    wg_ip_addr = normalize_config_value_fn(payload.get("wg_ip_addr")) or current_row[4]
    wg_ip_cidr = normalize_config_value_fn(payload.get("wg_ip_cidr")) or str(current_row[5])
    private_key = normalize_config_value_fn(payload.get("private_key")) or current_row[6]
    public_key = normalize_config_value_fn(payload.get("public_key")) or current_row[7]
    srv_ip = normalize_config_value_fn(payload.get("srv_ip")) or current_row[8]
    srv_dns = normalize_config_value_fn(payload.get("srv_dns")) or current_row[9]
    validate_interface_name_fn(wg_interface)

    port_number = parse_and_validate_port_fn(port_number)
    wg_ip_cidr, network_cidr = parse_and_validate_interface_network_fn(wg_ip_addr, wg_ip_cidr)
    validate_ip_literal_fn(srv_ip, "server IP")

    awg_params = prepare_awg_params_for_version_fn(awg_version)
    for key in awg_params.keys():
        if key in current_params and normalize_config_value_fn(current_params[key]) is not None:
            awg_params[key] = current_params[key]
    payload_awg_params = payload.get("awg_params", {})
    if isinstance(payload_awg_params, dict):
        for key in awg_params.keys():
            if key in payload_awg_params:
                awg_params[key] = normalize_config_value_fn(payload_awg_params.get(key))
    validate_awg_params_fn(awg_version, awg_params)

    try:
        begin_tx_fn()
        assert_interface_uniqueness_fn(wg_interface, port_number, network_cidr, exclude_id=interface_id)
        current_enabled = interface_row_enabled(current_row)
        if current_enabled:
            remove_interface_runtime_fn(current_row[1])
        update_interface_row_fn(
            interface_id,
            wg_interface,
            awg_version,
            wg_ip_addr,
            wg_ip_cidr,
            port_number,
            private_key,
            public_key,
            srv_ip,
            srv_dns,
            awg_params,
        )
        if wg_interface != current_row[1]:
            update_clients_interface_fn(wg_interface, current_row[1])
        if current_enabled:
            apply_interface_runtime_fn(wg_interface, port_number, wg_ip_addr, wg_ip_cidr, private_key, awg_version, awg_params)
        commit_fn()
    except Exception:
        rollback_fn()
        raise

    return fetch_interface_row_fn(interface_id)


def set_interface_enabled_service(
    interface_id,
    enabled,
    *,
    fetch_interface_row_fn,
    build_awg_params_from_row_fn,
    remove_interface_runtime_fn,
    apply_interface_runtime_fn,
    fetch_enabled_peer_rows_fn,
    runtime_add_peer_fn,
    update_interface_enabled_fn,
    commit_fn,
):
    row = fetch_interface_row_fn(interface_id)
    if not row:
        raise LookupError("Interface not found")

    next_enabled = bool(enabled)
    if interface_row_enabled(row) == next_enabled:
        return row

    if next_enabled:
        awg_params = build_awg_params_from_row_fn(row)
        apply_interface_runtime_fn(row[1], row[3], row[4], row[5], row[6], row[2], awg_params)
        for peer_pubkey, peer_ip in fetch_enabled_peer_rows_fn(row[1]):
            runtime_add_peer_fn(row[1], peer_pubkey, peer_ip)
    else:
        remove_interface_runtime_fn(row[1])

    update_interface_enabled_fn(interface_id, 1 if next_enabled else 0)
    commit_fn()
    return fetch_interface_row_fn(interface_id)
