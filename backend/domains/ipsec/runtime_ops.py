#!/usr/bin/python3
import subprocess


def log_event(event_type, payload, *, append_event_fn, limit=500):
    append_event_fn(event_type, payload, limit)


def list_events(*, list_events_fn):
    return list_events_fn()


def vici_session(*, session_factory=None):
    if session_factory is not None:
        return session_factory()
    try:
        import vici  # type: ignore

        return vici.Session()
    except Exception as exc:
        raise RuntimeError(f"VICI unavailable: {exc}")


def collect_refs(
    *,
    list_peers_fn,
    read_identities_fn,
    list_phase1_profiles_fn,
    list_phase2_proposals_fn,
    list_policies_fn,
):
    peers = list_peers_fn()
    identities = read_identities_fn()
    phase1 = {x["name"]: x for x in list_phase1_profiles_fn()}
    phase2 = {x["name"]: x for x in list_phase2_proposals_fn()}
    policies = list_policies_fn()
    by_peer_identity = {x.get("peer"): x for x in identities}
    by_peer_policies = {}
    for policy in policies:
        by_peer_policies.setdefault(policy.get("peer"), []).append(policy)
    out = []
    for peer in peers:
        profile = phase1.get(peer.get("phase1_profile"))
        if profile is None:
            raise ValueError(f"peer {peer.get('name')} references unknown phase1 profile")
        identity = by_peer_identity.get(peer.get("name"))
        if identity is None:
            raise ValueError(f"peer {peer.get('name')} has no identity")
        child_policies = by_peer_policies.get(peer.get("name"), [])
        if not child_policies:
            raise ValueError(f"peer {peer.get('name')} has no policies")
        out.append((peer, identity, profile, child_policies, phase2))
    return out


def build_vici_connection_for_peer(peer, identity, profile, policies, phase2_index):
    children = {}
    for policy in policies:
        prop2 = phase2_index.get(policy.get("proposal"))
        if prop2 is None:
            raise ValueError(f"policy {policy.get('name')} references unknown phase2 proposal")
        children[str(policy["name"])] = {
            "local_ts": policy.get("local_ts", []),
            "remote_ts": policy.get("remote_ts", []),
            "esp_proposals": [str(prop2.get("proposal_string"))],
            "start_action": str(policy.get("start_action") or "start"),
            "mode": str(policy.get("mode") or "tunnel"),
        }
    return {
        str(peer["name"]): {
            "version": "2",
            "local_addrs": peer.get("local_addrs", []),
            "remote_addrs": peer.get("remote_addrs", []),
            "local": {
                "auth": "psk",
                "id": str(identity.get("local_id") or ""),
            },
            "remote": {
                "auth": "psk",
                "id": str(identity.get("remote_id") or ""),
            },
            "children": children,
            "proposals": [str(profile.get("proposal_string"))],
            "unique": "replace",
        }
    }


def build_vici_secret_for_peer(peer, identity, *, secret_decrypt_fn):
    psk = secret_decrypt_fn(identity.get("psk_encrypted"))
    # python-vici expects a flat load_shared payload (optional id + type/data/owners),
    # not a nested map keyed by secret name.
    return {
        "id": f"ike-{peer['name']}",
        "type": "IKE",
        "data": psk,
        "owners": [str(identity.get("local_id") or ""), str(identity.get("remote_id") or "")],
    }


def sanitize_vici_sas(raw):
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, list):
        return {"items": raw}
    return {"items": []}


def extract_active_peers_from_sas(sas):
    out = []
    if isinstance(sas, dict):
        for key, value in sas.items():
            if not isinstance(value, dict):
                continue
            out.append(
                {
                    "status": "up",
                    "peer": key,
                    "remote_address": value.get("remote-host") or value.get("remote-hosts") or "",
                    "ike_version": value.get("version") or "2",
                    "profile": value.get("name") or "",
                    "uptime": value.get("established") or "",
                    "rekey": value.get("rekey-time") or "",
                    "state": value.get("state") or "ESTABLISHED",
                }
            )
    return out


def extract_installed_sas_from_sas(sas):
    out = []
    if not isinstance(sas, dict):
        return out
    for _, ike_sa in sas.items():
        if not isinstance(ike_sa, dict):
            continue
        children = ike_sa.get("child-sas")
        if not isinstance(children, dict):
            continue
        for child_name, child in children.items():
            if not isinstance(child, dict):
                continue
            out.append(
                {
                    "state": child.get("state") or "INSTALLED",
                    "child_sa": child_name,
                    "spi_in": child.get("spi-in") or "",
                    "spi_out": child.get("spi-out") or "",
                    "local_ts": child.get("local-ts") or [],
                    "remote_ts": child.get("remote-ts") or [],
                    "esp_proposal": child.get("proposal") or "",
                    "bytes_in": child.get("bytes-in") or 0,
                    "bytes_out": child.get("bytes-out") or 0,
                }
            )
    return out


def run_ip_xfrm_best_effort(*, run_command_fn=None):
    command_runner = run_command_fn
    if command_runner is None:
        command_runner = lambda cmd: subprocess.run(cmd, check=False, capture_output=True, text=True)

    out = {"state": "", "policy": ""}
    try:
        state = command_runner(["ip", "xfrm", "state"])
        out["state"] = state.stdout or ""
    except Exception:
        pass
    try:
        policy = command_runner(["ip", "xfrm", "policy"])
        out["policy"] = policy.stdout or ""
    except Exception:
        pass
    return out


def list_active_peers(*, session_factory=None):
    try:
        session = vici_session(session_factory=session_factory)
        sas = sanitize_vici_sas(session.list_sas())
        return extract_active_peers_from_sas(sas)
    except Exception:
        return []


def list_installed_sas(*, session_factory=None, run_command_fn=None):
    try:
        session = vici_session(session_factory=session_factory)
        sas = sanitize_vici_sas(session.list_sas())
        items = extract_installed_sas_from_sas(sas)
    except Exception:
        items = []
    xfrm = run_ip_xfrm_best_effort(run_command_fn=run_command_fn)
    return {"items": items, "xfrm": xfrm}


def load_peer(
    peer_name,
    *,
    collect_refs_fn,
    build_connection_fn,
    build_secret_fn,
    session_factory=None,
    log_event_fn,
):
    target = str(peer_name)
    refs = collect_refs_fn()
    peer_data = next((item for item in refs if item[0].get("name") == target), None)
    if peer_data is None:
        raise LookupError("peer not found")
    peer, identity, profile, policies, phase2 = peer_data
    conn_obj = build_connection_fn(peer, identity, profile, policies, phase2)
    secret_obj = build_secret_fn(peer, identity)
    session = vici_session(session_factory=session_factory)
    session.load_shared(secret_obj)
    session.load_conn(conn_obj)
    log_event_fn("load_peer", {"peer": target})
    return {"peer": target, "loaded": True}


def initiate_policy(policy_name, *, list_policies_fn, session_factory=None, log_event_fn):
    target = str(policy_name)
    policy = next((x for x in list_policies_fn() if x.get("name") == target), None)
    if policy is None:
        raise LookupError("policy not found")
    session = vici_session(session_factory=session_factory)
    session.initiate({"child": target, "timeout": 30})
    log_event_fn("initiate", {"policy": target})
    return {"policy": target, "initiated": True}


def terminate_peer(peer_name, *, session_factory=None, log_event_fn):
    target = str(peer_name)
    session = vici_session(session_factory=session_factory)
    session.terminate({"ike": target, "force": True})
    log_event_fn("terminate", {"peer": target})
    return {"peer": target, "terminated": True}


def apply_config(
    *,
    collect_refs_fn,
    build_connection_fn,
    build_secret_fn,
    session_factory=None,
    run_command_fn=None,
    log_event_fn,
):
    refs = collect_refs_fn()
    loaded = []
    initiated = []
    warnings = []
    session = vici_session(session_factory=session_factory)
    for peer, identity, profile, policies, phase2 in refs:
        conn_obj = build_connection_fn(peer, identity, profile, policies, phase2)
        secret_obj = build_secret_fn(peer, identity)
        session.load_shared(secret_obj)
        session.load_conn(conn_obj)
        loaded.append(str(peer.get("name")))
        for policy in policies:
            should_start = bool(policy.get("enabled", True)) and str(policy.get("start_action") or "start") == "start"
            if should_start:
                try:
                    session.initiate({"child": str(policy.get("name")), "timeout": 30})
                    initiated.append(str(policy.get("name")))
                except Exception as exc:
                    warnings.append(f"initiate failed for {policy.get('name')}: {exc}")
    sas = sanitize_vici_sas(session.list_sas())
    active = extract_active_peers_from_sas(sas)
    installed_items = extract_installed_sas_from_sas(sas)
    xfrm = run_ip_xfrm_best_effort(run_command_fn=run_command_fn)
    if not xfrm.get("state") and not xfrm.get("policy"):
        warnings.append("xfrm probe unavailable")
    log_event_fn("apply", {"loaded_peers": loaded, "initiated_policies": initiated})
    return {
        "loaded_peers": loaded,
        "initiated_policies": initiated,
        "active_peers": active,
        "installed_sas": {"items": installed_items, "xfrm": xfrm},
        "warnings": warnings,
    }
