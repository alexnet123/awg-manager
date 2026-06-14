#!/usr/bin/python3


def _normalize_optional_string(payload, key, default, *, normalize_config_value_fn):
    value = normalize_config_value_fn(payload.get(key))
    if value is None or str(value).strip() == "":
        return default
    return str(value).strip()


def _normalize_choice(payload, key, default, choices, *, normalize_config_value_fn):
    value = _normalize_optional_string(
        payload,
        key,
        default,
        normalize_config_value_fn=normalize_config_value_fn,
    ).lower()
    if value not in choices:
        raise ValueError(f"{key} must be one of: {', '.join(choices)}")
    return value


def _normalize_policy_choice(payload, key, default, choices, *, normalize_config_value_fn):
    value = str(normalize_config_value_fn(payload.get(key)) or default).lower()
    if value not in choices:
        raise ValueError(f"{key} must be one of: {', '.join(choices)}")
    return value


def _normalize_policy_optional_string(payload, key, default, *, normalize_config_value_fn):
    value = normalize_config_value_fn(payload.get(key))
    if value is None or str(value).strip() == "":
        return default
    return str(value).strip()


def _normalize_ike_version(payload, *, normalize_config_value_fn):
    value = normalize_config_value_fn(payload.get("ike_version"))
    if value is None or str(value).strip() == "":
        return 2
    try:
        normalized = int(str(value).strip())
    except (TypeError, ValueError):
        raise ValueError("ike_version must be one of: 1, 2")
    if normalized not in (1, 2):
        raise ValueError("ike_version must be one of: 1, 2")
    return normalized


def _normalize_extra_proposals(payload, *, valid_name_fn, normalize_config_value_fn):
    raw = payload.get("extra_proposals")
    if raw is None:
        return []
    if isinstance(raw, str):
        values = raw.replace("\n", ",").split(",")
    elif isinstance(raw, list):
        values = []
        for item in raw:
            if isinstance(item, str):
                values.extend(item.replace("\n", ",").split(","))
            else:
                values.append(item)
    else:
        raise ValueError("extra_proposals must be array or string")

    out = []
    for value in values:
        normalized = normalize_config_value_fn(value)
        if normalized is None or str(normalized).strip() == "":
            continue
        out.append(valid_name_fn(str(normalized).strip(), "extra_proposals").lower())
    return out


def upsert_peer(
    payload,
    *,
    valid_name_fn,
    normalize_ip_list_fn,
    normalize_config_value_fn=lambda value: value,
    ensure_phase1_exists_fn,
    read_peers_fn,
    write_peers_fn,
    read_policies_fn=None,
    write_policies_fn=None,
    read_identities_fn=None,
    write_identities_fn=None,
):
    if not isinstance(payload, dict):
        raise ValueError("peer payload must be object")
    item = {
        "name": valid_name_fn(payload.get("name")),
        "remote_addrs": normalize_ip_list_fn(payload.get("remote_addrs"), "remote_addrs"),
        "local_addrs": normalize_ip_list_fn(payload.get("local_addrs"), "local_addrs"),
        "ike_version": _normalize_ike_version(
            payload,
            normalize_config_value_fn=normalize_config_value_fn,
        ),
        "phase1_profile": valid_name_fn(payload.get("phase1_profile"), "phase1_profile"),
        "enabled": bool(payload.get("enabled", True)),
        "dpd": bool(payload.get("dpd", True)),
        "dpd_delay": _normalize_optional_string(
            payload,
            "dpd_delay",
            "30s",
            normalize_config_value_fn=normalize_config_value_fn,
        ),
        "dpd_timeout": _normalize_optional_string(
            payload,
            "dpd_timeout",
            "120s",
            normalize_config_value_fn=normalize_config_value_fn,
        ),
        "nat_t": bool(payload.get("nat_t", True)),
        "mobike": _normalize_choice(
            payload,
            "mobike",
            "yes",
            ("yes", "no"),
            normalize_config_value_fn=normalize_config_value_fn,
        ),
        "fragmentation": _normalize_choice(
            payload,
            "fragmentation",
            "yes",
            ("yes", "accept", "force", "no"),
            normalize_config_value_fn=normalize_config_value_fn,
        ),
        "rekey_time": _normalize_optional_string(
            payload,
            "rekey_time",
            "1d",
            normalize_config_value_fn=normalize_config_value_fn,
        ),
        "reauth_time": _normalize_optional_string(
            payload,
            "reauth_time",
            "0s",
            normalize_config_value_fn=normalize_config_value_fn,
        ),
        "over_time": _normalize_optional_string(
            payload,
            "over_time",
            "",
            normalize_config_value_fn=normalize_config_value_fn,
        ),
        "rand_time": _normalize_optional_string(
            payload,
            "rand_time",
            "",
            normalize_config_value_fn=normalize_config_value_fn,
        ),
        "keyingtries": _normalize_optional_string(
            payload,
            "keyingtries",
            "0",
            normalize_config_value_fn=normalize_config_value_fn,
        ),
        "send_initial_contact": bool(payload.get("send_initial_contact", True)),
    }
    if not item["remote_addrs"]:
        raise ValueError("remote_addrs is required")
    ensure_phase1_exists_fn(item["phase1_profile"])
    items = read_peers_fn()
    original_raw = normalize_config_value_fn(payload.get("original_name"))
    original_name = valid_name_fn(original_raw) if original_raw else item["name"]
    is_rename = original_name != item["name"]
    if is_rename:
        if not any(row.get("name") == original_name for row in items):
            raise LookupError("peer not found")
        if any(row.get("name") == item["name"] for row in items):
            raise ValueError("peer name already exists")
        if (
            read_policies_fn is None
            or write_policies_fn is None
            or read_identities_fn is None
            or write_identities_fn is None
        ):
            raise ValueError("peer rename requires policy and identity storage")
        write_peers_fn([item if row.get("name") == original_name else row for row in items])
        write_policies_fn([
            {**policy, "peer": item["name"]} if policy.get("peer") == original_name else policy
            for policy in read_policies_fn()
        ])
        write_identities_fn([
            {**identity, "peer": item["name"]} if identity.get("peer") == original_name else identity
            for identity in read_identities_fn()
        ])
    else:
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
    local_id_raw = normalize_config_value_fn(payload.get("local_id"))
    remote_id_raw = normalize_config_value_fn(payload.get("remote_id"))
    local_id = valid_name_fn(local_id_raw, "local_id") if local_id_raw is not None else ""
    remote_id = valid_name_fn(remote_id_raw, "remote_id") if remote_id_raw is not None else ""
    psk = normalize_config_value_fn(payload.get("psk"))
    items = read_identities_fn()
    previous = next((x for x in items if x.get("peer") == peer_name), None)
    psk_encrypted = previous.get("psk_encrypted") if previous else None
    if psk is not None and str(psk) != "":
        psk_encrypted = secret_encrypt_fn(str(psk))
    if not psk_encrypted:
        raise ValueError("psk is required for new identity")
    item = {
        "peer": peer_name,
        "auth_method": auth_method,
        "local_id": local_id,
        "remote_id": remote_id,
        "enabled": bool(payload.get("enabled", True)),
        "psk_encrypted": psk_encrypted,
    }
    out = [x for x in items if x.get("peer") != peer_name]
    out.append(item)
    write_identities_fn(out)
    safe = dict(item)
    safe.pop("psk_encrypted", None)
    safe["has_psk"] = True
    return safe


def get_identity_psk(name, *, valid_name_fn, read_identities_fn, secret_decrypt_fn):
    peer_name = valid_name_fn(name, "peer")
    item = next((x for x in read_identities_fn() if x.get("peer") == peer_name), None)
    if item is None:
        raise LookupError("identity not found")
    psk_encrypted = item.get("psk_encrypted")
    if not psk_encrypted:
        raise LookupError("identity psk not found")
    return {"peer": peer_name, "psk": secret_decrypt_fn(psk_encrypted) or ""}


def upsert_phase1_profile(
    payload,
    *,
    valid_name_fn,
    normalize_config_value_fn,
    build_phase1_proposal_string_fn,
    read_profiles_fn,
    write_profiles_fn,
    read_peers_fn=None,
    write_peers_fn=None,
):
    if not isinstance(payload, dict):
        raise ValueError("phase1 profile payload must be object")
    raw_prf = normalize_config_value_fn(payload.get("prf"))
    if raw_prf is None or str(raw_prf).strip() == "":
        prf = "prfsha256"
        proposal_prf = prf
    elif str(raw_prf).strip().lower() == "auto":
        prf = "auto"
        proposal_prf = None
    else:
        prf = valid_name_fn(raw_prf, "prf").lower()
        proposal_prf = prf
    item = {
        "name": valid_name_fn(payload.get("name")),
        "encryption": valid_name_fn(payload.get("encryption"), "encryption").lower(),
        "hash": valid_name_fn(payload.get("hash"), "hash").lower(),
        "dh_group": valid_name_fn(payload.get("dh_group"), "dh_group").lower(),
        "prf": prf,
        "lifetime": str(normalize_config_value_fn(payload.get("lifetime")) or "1d"),
        "proposal_check": str(normalize_config_value_fn(payload.get("proposal_check")) or "obey").lower(),
        "enabled": bool(payload.get("enabled", True)),
        "extra_proposals": _normalize_extra_proposals(
            payload,
            valid_name_fn=valid_name_fn,
            normalize_config_value_fn=normalize_config_value_fn,
        ),
    }
    item["proposal_string"] = build_phase1_proposal_string_fn(
        item["encryption"], item["hash"], item["dh_group"], proposal_prf
    )
    items = read_profiles_fn()
    original_raw = normalize_config_value_fn(payload.get("original_name"))
    original_name = valid_name_fn(original_raw) if original_raw else item["name"]
    is_rename = original_name != item["name"]
    if is_rename:
        if not any(x.get("name") == original_name for x in items):
            raise LookupError("phase1 profile not found")
        if any(x.get("name") == item["name"] for x in items):
            raise ValueError("phase1 profile name already exists")
        out = [item if x.get("name") == original_name else x for x in items]
        if read_peers_fn is None or write_peers_fn is None:
            raise ValueError("phase1 profile rename requires peer storage")
        peers = read_peers_fn()
        updated_peers = [
            {**peer, "phase1_profile": item["name"]} if peer.get("phase1_profile") == original_name else peer
            for peer in peers
        ]
        write_peers_fn(updated_peers)
    else:
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
    read_policies_fn=None,
    write_policies_fn=None,
):
    if not isinstance(payload, dict):
        raise ValueError("phase2 proposal payload must be object")
    pfs_raw = normalize_config_value_fn(payload.get("pfs_group"))
    esn_raw = normalize_config_value_fn(payload.get("esn"))
    esn = valid_name_fn(esn_raw, "esn").lower() if esn_raw else None
    if esn is not None and esn not in ("esn", "noesn"):
        raise ValueError("esn must be one of: esn, noesn")
    item = {
        "name": valid_name_fn(payload.get("name")),
        "encryption": valid_name_fn(payload.get("encryption"), "encryption").lower(),
        "auth": valid_name_fn(payload.get("auth"), "auth").lower(),
        "pfs_group": valid_name_fn(pfs_raw, "pfs_group").lower() if pfs_raw else None,
        "esn": esn,
        "lifetime": str(normalize_config_value_fn(payload.get("lifetime")) or "1h"),
        "enabled": bool(payload.get("enabled", True)),
        "extra_proposals": _normalize_extra_proposals(
            payload,
            valid_name_fn=valid_name_fn,
            normalize_config_value_fn=normalize_config_value_fn,
        ),
    }
    item["proposal_string"] = build_phase2_proposal_string_fn(
        item["encryption"], item["auth"], item.get("pfs_group"), item.get("esn")
    )
    items = read_proposals_fn()
    original_raw = normalize_config_value_fn(payload.get("original_name"))
    original_name = valid_name_fn(original_raw) if original_raw else item["name"]
    is_rename = original_name != item["name"]
    if is_rename:
        if not any(x.get("name") == original_name for x in items):
            raise LookupError("phase2 proposal not found")
        if any(x.get("name") == item["name"] for x in items):
            raise ValueError("phase2 proposal name already exists")
        out = [item if x.get("name") == original_name else x for x in items]
        if read_policies_fn is None or write_policies_fn is None:
            raise ValueError("phase2 proposal rename requires policy storage")
        policies = read_policies_fn()
        updated_policies = [
            {**policy, "proposal": item["name"]} if policy.get("proposal") == original_name else policy
            for policy in policies
        ]
        write_policies_fn(updated_policies)
    else:
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
    def _normalize_single_ts(field_name):
        values = normalize_ts_list_fn(payload.get(field_name), field_name)
        return values[:1]

    item = {
        "name": valid_name_fn(payload.get("name")),
        "peer": valid_name_fn(payload.get("peer"), "peer"),
        "local_ts": _normalize_single_ts("local_ts"),
        "remote_ts": _normalize_single_ts("remote_ts"),
        "proposal": valid_name_fn(payload.get("proposal"), "proposal"),
        "action": str(normalize_config_value_fn(payload.get("action")) or "encrypt").lower(),
        "level": str(normalize_config_value_fn(payload.get("level")) or "require").lower(),
        "mode": _normalize_policy_choice(
            payload,
            "mode",
            "tunnel",
            ("tunnel", "transport", "beet", "pass", "drop"),
            normalize_config_value_fn=normalize_config_value_fn,
        ),
        "start_action": _normalize_policy_choice(
            payload,
            "start_action",
            "start",
            ("start", "trap", "none"),
            normalize_config_value_fn=normalize_config_value_fn,
        ),
        "close_action": _normalize_policy_choice(
            payload,
            "close_action",
            "none",
            ("none", "trap", "start"),
            normalize_config_value_fn=normalize_config_value_fn,
        ),
        "dpd_action": _normalize_policy_choice(
            payload,
            "dpd_action",
            "restart",
            ("clear", "trap", "restart"),
            normalize_config_value_fn=normalize_config_value_fn,
        ),
        "rekey_time": str(normalize_config_value_fn(payload.get("rekey_time")) or "1h"),
        "life_time": str(normalize_config_value_fn(payload.get("life_time")) or ""),
        "rand_time": str(normalize_config_value_fn(payload.get("rand_time")) or ""),
        "policies": _normalize_policy_choice(
            payload,
            "policies",
            "yes",
            ("yes", "no"),
            normalize_config_value_fn=normalize_config_value_fn,
        ),
        "policies_fwd_out": _normalize_policy_choice(
            payload,
            "policies_fwd_out",
            "no",
            ("yes", "no"),
            normalize_config_value_fn=normalize_config_value_fn,
        ),
        "reqid": _normalize_policy_optional_string(
            payload,
            "reqid",
            "",
            normalize_config_value_fn=normalize_config_value_fn,
        ),
        "priority": _normalize_policy_optional_string(
            payload,
            "priority",
            "",
            normalize_config_value_fn=normalize_config_value_fn,
        ),
        "interface": _normalize_policy_optional_string(
            payload,
            "interface",
            "",
            normalize_config_value_fn=normalize_config_value_fn,
        ),
        "mark_in": _normalize_policy_optional_string(
            payload,
            "mark_in",
            "",
            normalize_config_value_fn=normalize_config_value_fn,
        ),
        "mark_in_sa": _normalize_policy_choice(
            payload,
            "mark_in_sa",
            "no",
            ("yes", "no"),
            normalize_config_value_fn=normalize_config_value_fn,
        ),
        "mark_out": _normalize_policy_optional_string(
            payload,
            "mark_out",
            "",
            normalize_config_value_fn=normalize_config_value_fn,
        ),
        "set_mark_in": _normalize_policy_optional_string(
            payload,
            "set_mark_in",
            "",
            normalize_config_value_fn=normalize_config_value_fn,
        ),
        "set_mark_out": _normalize_policy_optional_string(
            payload,
            "set_mark_out",
            "",
            normalize_config_value_fn=normalize_config_value_fn,
        ),
        "if_id_in": _normalize_policy_optional_string(
            payload,
            "if_id_in",
            "",
            normalize_config_value_fn=normalize_config_value_fn,
        ),
        "if_id_out": _normalize_policy_optional_string(
            payload,
            "if_id_out",
            "",
            normalize_config_value_fn=normalize_config_value_fn,
        ),
        "enabled": bool(payload.get("enabled", True)),
    }
    ensure_peer_exists_fn(item["peer"])
    ensure_phase2_exists_fn(item["proposal"])
    if not item["local_ts"] or not item["remote_ts"]:
        raise ValueError("local_ts and remote_ts are required")
    items = read_policies_fn()
    original_raw = normalize_config_value_fn(payload.get("original_name"))
    original_name = valid_name_fn(original_raw) if original_raw else item["name"]
    is_rename = original_name != item["name"]
    if is_rename:
        if not any(x.get("name") == original_name for x in items):
            raise LookupError("policy not found")
        if any(x.get("name") == item["name"] for x in items):
            raise ValueError("policy name already exists")
        out = [item if x.get("name") == original_name else x for x in items]
    else:
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


def delete_identity(name, *, read_identities_fn, write_identities_fn):
    peer_name = str(name)
    items = read_identities_fn()
    existing = next((x for x in items if x.get("peer") == peer_name), None)
    if existing is None:
        raise LookupError("identity not found")
    write_identities_fn([x for x in items if x.get("peer") != peer_name])
    safe = dict(existing)
    safe.pop("psk_encrypted", None)
    safe["has_psk"] = bool(existing.get("psk_encrypted", True))
    return safe


def delete_phase1_profile(name, *, read_profiles_fn, write_profiles_fn, read_peers_fn):
    profile_name = str(name)
    referencing_peers = [x.get("name") for x in read_peers_fn() if x.get("phase1_profile") == profile_name]
    if referencing_peers:
        raise ValueError(f"phase1 profile is referenced by peer(s): {', '.join(str(x) for x in referencing_peers)}")
    items = read_profiles_fn()
    existing = next((x for x in items if x.get("name") == profile_name), None)
    if existing is None:
        raise LookupError("phase1 profile not found")
    write_profiles_fn([x for x in items if x.get("name") != profile_name])
    return existing


def delete_phase2_proposal(name, *, read_proposals_fn, write_proposals_fn, read_policies_fn):
    proposal_name = str(name)
    referencing_policies = [x.get("name") for x in read_policies_fn() if x.get("proposal") == proposal_name]
    if referencing_policies:
        raise ValueError(f"phase2 proposal is referenced by policy(s): {', '.join(str(x) for x in referencing_policies)}")
    items = read_proposals_fn()
    existing = next((x for x in items if x.get("name") == proposal_name), None)
    if existing is None:
        raise LookupError("phase2 proposal not found")
    write_proposals_fn([x for x in items if x.get("name") != proposal_name])
    return existing
