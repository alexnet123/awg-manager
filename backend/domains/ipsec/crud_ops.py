#!/usr/bin/python3


def upsert_peer(
    payload,
    *,
    valid_name_fn,
    normalize_ip_list_fn,
    ensure_phase1_exists_fn,
    read_peers_fn,
    write_peers_fn,
):
    if not isinstance(payload, dict):
        raise ValueError("peer payload must be object")
    item = {
        "name": valid_name_fn(payload.get("name")),
        "remote_addrs": normalize_ip_list_fn(payload.get("remote_addrs"), "remote_addrs"),
        "local_addrs": normalize_ip_list_fn(payload.get("local_addrs"), "local_addrs"),
        "ike_version": 2,
        "phase1_profile": valid_name_fn(payload.get("phase1_profile"), "phase1_profile"),
        "enabled": bool(payload.get("enabled", True)),
        "dpd": bool(payload.get("dpd", True)),
        "nat_t": bool(payload.get("nat_t", True)),
        "send_initial_contact": bool(payload.get("send_initial_contact", True)),
    }
    if not item["remote_addrs"]:
        raise ValueError("remote_addrs is required")
    ensure_phase1_exists_fn(item["phase1_profile"])
    items = read_peers_fn()
    replaced = False
    for i, row in enumerate(items):
        if row.get("name") == item["name"]:
            items[i] = item
            replaced = True
            break
    if not replaced:
        items.append(item)
    write_peers_fn(items)
    return item


def upsert_identity(
    payload,
    *,
    valid_name_fn,
    ensure_peer_exists_fn,
    normalize_config_value_fn,
    read_identities_fn,
    secret_encrypt_fn,
    write_identities_fn,
):
    if not isinstance(payload, dict):
        raise ValueError("identity payload must be object")
    peer_name = valid_name_fn(payload.get("peer"), "peer")
    ensure_peer_exists_fn(peer_name)
    auth_method = str(payload.get("auth_method") or "psk").lower()
    if auth_method != "psk":
        raise ValueError("only psk auth_method is supported in v1")
    local_id = valid_name_fn(payload.get("local_id"), "local_id")
    remote_id = valid_name_fn(payload.get("remote_id"), "remote_id")
    psk = normalize_config_value_fn(payload.get("psk"))
    items = read_identities_fn()
    previous = next((x for x in items if x.get("peer") == peer_name), None)
    psk_encrypted = previous.get("psk_encrypted") if previous else None
    if psk is not None:
        psk_encrypted = secret_encrypt_fn(str(psk))
    if not psk_encrypted:
        raise ValueError("psk is required for new identity")
    item = {
        "peer": peer_name,
        "auth_method": auth_method,
        "local_id": local_id,
        "remote_id": remote_id,
        "psk_encrypted": psk_encrypted,
    }
    out = [x for x in items if x.get("peer") != peer_name]
    out.append(item)
    write_identities_fn(out)
    safe = dict(item)
    safe.pop("psk_encrypted", None)
    safe["has_psk"] = True
    return safe


def upsert_phase1_profile(
    payload,
    *,
    valid_name_fn,
    normalize_config_value_fn,
    build_phase1_proposal_string_fn,
    read_profiles_fn,
    write_profiles_fn,
):
    if not isinstance(payload, dict):
        raise ValueError("phase1 profile payload must be object")
    item = {
        "name": valid_name_fn(payload.get("name")),
        "encryption": valid_name_fn(payload.get("encryption"), "encryption").lower(),
        "hash": valid_name_fn(payload.get("hash"), "hash").lower(),
        "dh_group": valid_name_fn(payload.get("dh_group"), "dh_group").lower(),
        "lifetime": str(normalize_config_value_fn(payload.get("lifetime")) or "1d"),
        "proposal_check": str(normalize_config_value_fn(payload.get("proposal_check")) or "obey").lower(),
    }
    item["proposal_string"] = build_phase1_proposal_string_fn(
        item["encryption"], item["hash"], item["dh_group"]
    )
    items = read_profiles_fn()
    out = [x for x in items if x.get("name") != item["name"]]
    out.append(item)
    write_profiles_fn(out)
    return item


def upsert_phase2_proposal(
    payload,
    *,
    valid_name_fn,
    normalize_config_value_fn,
    build_phase2_proposal_string_fn,
    read_proposals_fn,
    write_proposals_fn,
):
    if not isinstance(payload, dict):
        raise ValueError("phase2 proposal payload must be object")
    pfs_raw = normalize_config_value_fn(payload.get("pfs_group"))
    item = {
        "name": valid_name_fn(payload.get("name")),
        "encryption": valid_name_fn(payload.get("encryption"), "encryption").lower(),
        "auth": valid_name_fn(payload.get("auth"), "auth").lower(),
        "pfs_group": valid_name_fn(pfs_raw, "pfs_group").lower() if pfs_raw else None,
        "lifetime": str(normalize_config_value_fn(payload.get("lifetime")) or "1h"),
    }
    item["proposal_string"] = build_phase2_proposal_string_fn(
        item["encryption"], item["auth"], item.get("pfs_group")
    )
    items = read_proposals_fn()
    out = [x for x in items if x.get("name") != item["name"]]
    out.append(item)
    write_proposals_fn(out)
    return item


def upsert_policy(
    payload,
    *,
    valid_name_fn,
    normalize_ts_list_fn,
    normalize_config_value_fn,
    ensure_peer_exists_fn,
    ensure_phase2_exists_fn,
    read_policies_fn,
    write_policies_fn,
):
    if not isinstance(payload, dict):
        raise ValueError("policy payload must be object")
    item = {
        "name": valid_name_fn(payload.get("name")),
        "peer": valid_name_fn(payload.get("peer"), "peer"),
        "local_ts": normalize_ts_list_fn(payload.get("local_ts"), "local_ts"),
        "remote_ts": normalize_ts_list_fn(payload.get("remote_ts"), "remote_ts"),
        "proposal": valid_name_fn(payload.get("proposal"), "proposal"),
        "action": str(normalize_config_value_fn(payload.get("action")) or "encrypt").lower(),
        "level": str(normalize_config_value_fn(payload.get("level")) or "require").lower(),
        "mode": str(normalize_config_value_fn(payload.get("mode")) or "tunnel").lower(),
        "start_action": str(normalize_config_value_fn(payload.get("start_action")) or "start").lower(),
        "enabled": bool(payload.get("enabled", True)),
    }
    ensure_peer_exists_fn(item["peer"])
    ensure_phase2_exists_fn(item["proposal"])
    if not item["local_ts"] or not item["remote_ts"]:
        raise ValueError("local_ts and remote_ts are required")
    items = read_policies_fn()
    out = [x for x in items if x.get("name") != item["name"]]
    out.append(item)
    write_policies_fn(out)
    return item


def delete_peer(name, *, read_policies_fn, read_peers_fn, write_peers_fn, read_identities_fn, write_identities_fn):
    peer_name = str(name)
    policies = read_policies_fn()
    if any(x.get("peer") == peer_name for x in policies):
        raise ValueError("peer is referenced by policy")
    peers = read_peers_fn()
    existing = next((x for x in peers if x.get("name") == peer_name), None)
    if existing is None:
        raise LookupError("peer not found")
    write_peers_fn([x for x in peers if x.get("name") != peer_name])
    ids = read_identities_fn()
    write_identities_fn([x for x in ids if x.get("peer") != peer_name])
    return existing


def delete_policy(name, *, read_policies_fn, write_policies_fn):
    policy_name = str(name)
    items = read_policies_fn()
    existing = next((x for x in items if x.get("name") == policy_name), None)
    if existing is None:
        raise LookupError("policy not found")
    write_policies_fn([x for x in items if x.get("name") != policy_name])
    return existing
