#!/usr/bin/python3


def create_client_service(
    payload,
    *,
    normalize_config_value_fn,
    interface_exists_fn,
    get_next_available_ip_fn,
    generate_keypair_fn,
    encrypt_private_key_fn,
    insert_client_fn,
    upsert_client_settings_fn,
    commit_fn,
    runtime_add_peer_fn,
    fetch_client_row_fn,
):
    name = normalize_config_value_fn(payload.get("name"))
    wg_interface = normalize_config_value_fn(payload.get("wg_interface"))
    client_ip = normalize_config_value_fn(payload.get("ip"))
    private_key = normalize_config_value_fn(payload.get("privkey"))
    public_key = normalize_config_value_fn(payload.get("pubkey"))
    allowed_ips = normalize_config_value_fn(payload.get("allowed_ips")) or "0.0.0.0/0"

    if None in (name, wg_interface):
        raise ValueError("Missing required client fields")
    if not interface_exists_fn(wg_interface):
        raise LookupError("Interface not found")

    if client_ip is None:
        client_ip = get_next_available_ip_fn(wg_interface)
    if private_key is None or public_key is None:
        private_key, public_key = generate_keypair_fn()

    encrypted_private_key = encrypt_private_key_fn(private_key)
    client_id = insert_client_fn(name, public_key, encrypted_private_key, client_ip, wg_interface)
    upsert_client_settings_fn(client_id, allowed_ips)
    commit_fn()
    runtime_add_peer_fn(wg_interface, public_key, client_ip)

    return fetch_client_row_fn(client_id)


def delete_client_service(
    client_id,
    *,
    fetch_client_row_fn,
    runtime_remove_peer_fn,
    delete_client_settings_fn,
    delete_client_fn,
    commit_fn,
):
    row = fetch_client_row_fn(client_id)
    if not row:
        raise LookupError("Client not found")

    runtime_remove_peer_fn(row[5], row[2])
    delete_client_settings_fn(client_id)
    delete_client_fn(client_id)
    commit_fn()
    return row


def update_client_service(
    client_id,
    payload,
    *,
    normalize_config_value_fn,
    fetch_client_row_fn,
    interface_exists_fn,
    get_next_available_ip_fn,
    validate_client_ip_for_interface_fn,
    encrypt_private_key_fn,
    runtime_remove_peer_fn,
    update_client_fn,
    upsert_client_settings_fn,
    commit_fn,
    runtime_add_peer_fn,
):
    current_row = fetch_client_row_fn(client_id)
    if not current_row:
        raise LookupError("Client not found")

    name = normalize_config_value_fn(payload.get("name")) or current_row[1]
    public_key = normalize_config_value_fn(payload.get("pubkey")) or current_row[2]
    private_key = normalize_config_value_fn(payload.get("privkey"))
    requested_ip = normalize_config_value_fn(payload.get("ip"))
    allowed_ips = normalize_config_value_fn(payload.get("allowed_ips"))
    ip_address = requested_ip or current_row[4]
    wg_interface = normalize_config_value_fn(payload.get("wg_interface")) or current_row[5]

    if not interface_exists_fn(wg_interface):
        raise LookupError("Interface not found")

    interface_changed = wg_interface != current_row[5]
    if interface_changed and (requested_ip is None or requested_ip == current_row[4]):
        ip_address = get_next_available_ip_fn(wg_interface, exclude_client_id=client_id)
    else:
        validate_client_ip_for_interface_fn(ip_address, wg_interface, exclude_client_id=client_id)

    encrypted_private_key = current_row[3] if private_key is None else encrypt_private_key_fn(private_key)

    runtime_remove_peer_fn(current_row[5], current_row[2])
    update_client_fn(client_id, name, public_key, encrypted_private_key, ip_address, wg_interface)
    if allowed_ips is not None:
        upsert_client_settings_fn(client_id, allowed_ips)
    commit_fn()
    runtime_add_peer_fn(wg_interface, public_key, ip_address)

    return fetch_client_row_fn(client_id)
