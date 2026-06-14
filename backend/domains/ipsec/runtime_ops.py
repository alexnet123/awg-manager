#!/usr/bin/python3
import subprocess
import time
from collections.abc import Iterable


VICI_INITIATE_TIMEOUT_MS = 5000


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


def _connection_value(peer, key, default=None):
    value = peer.get(key, default)
    if value is None or str(value).strip() == "":
        return None
    return str(value).strip()


def _child_value(policy, key, default=None):
    value = policy.get(key, default)
    if value is None or str(value).strip() == "":
        return None
    return str(value).strip()


def _proposal_list(item):
    proposals = []
    primary = item.get("proposal_string")
    if primary is not None and str(primary).strip():
        proposals.append(str(primary).strip())
    for proposal in item.get("extra_proposals") or []:
        if proposal is not None and str(proposal).strip():
            proposals.append(str(proposal).strip())
    return proposals


def _with_ikev1_esp_noesn(proposals):
    out = []
    for proposal in proposals:
        parts = str(proposal).strip().split("-")
        if not parts or "esn" in parts or "noesn" in parts:
            out.append(str(proposal).strip())
            continue
        # RouterOS IKEv1/main advertises NO_EXT_SEQ explicitly in Quick Mode.
        # Make implicit strongSwan ESP proposals explicit without changing IKEv2.
        out.append(f"{str(proposal).strip()}-noesn")
    return out


def _is_enabled(item):
    return bool(item.get("enabled", True))


def build_vici_connection_for_peer(peer, identity, profile, policies, phase2_index):
    children = {}
    ike_version = str(peer.get("ike_version") or "2").strip() or "2"
    for policy in policies:
        prop2 = phase2_index.get(policy.get("proposal"))
        if prop2 is None:
            raise ValueError(f"policy {policy.get('name')} references unknown phase2 proposal")
        esp_proposals = _proposal_list(prop2)
        if ike_version == "1":
            esp_proposals = _with_ikev1_esp_noesn(esp_proposals)
        child = {
            "local_ts": policy.get("local_ts", []),
            "remote_ts": policy.get("remote_ts", []),
            "esp_proposals": esp_proposals,
            "start_action": str(policy.get("start_action") or "start"),
            "mode": str(policy.get("mode") or "tunnel"),
        }
        for key, default in (
            ("close_action", "none"),
            ("dpd_action", "restart"),
            ("rekey_time", "1h"),
            ("life_time", None),
            ("rand_time", None),
            ("policies", "yes"),
            ("policies_fwd_out", "no"),
            ("reqid", None),
            ("priority", None),
            ("interface", None),
            ("mark_in", None),
            ("mark_in_sa", "no"),
            ("mark_out", None),
            ("set_mark_in", None),
            ("set_mark_out", None),
            ("if_id_in", None),
            ("if_id_out", None),
        ):
            value = _child_value(policy, key, default)
            if value is not None:
                child[key] = value
        children[str(policy["name"])] = child
    local_auth = {"auth": "psk"}
    remote_auth = {"auth": "psk"}
    local_id = str(identity.get("local_id") or "")
    remote_id = str(identity.get("remote_id") or "")
    if local_id:
        local_auth["id"] = local_id
    if remote_id:
        remote_auth["id"] = remote_id
    conn = {
        "version": ike_version,
        "local_addrs": peer.get("local_addrs", []),
        "remote_addrs": peer.get("remote_addrs", []),
        "local": local_auth,
        "remote": remote_auth,
        "children": children,
        "proposals": _proposal_list(profile),
        "unique": "replace" if peer.get("send_initial_contact", True) else "never",
    }
    if peer.get("dpd", True):
        conn["dpd_delay"] = _connection_value(peer, "dpd_delay", "30s") or "30s"
        conn["dpd_timeout"] = _connection_value(peer, "dpd_timeout", "120s") or "120s"
    if peer.get("nat_t", True):
        conn["encap"] = "yes"
    mobike = _connection_value(peer, "mobike", "yes")
    if mobike is not None:
        conn["mobike"] = mobike
    fragmentation = _connection_value(peer, "fragmentation", "yes")
    if fragmentation is not None:
        conn["fragmentation"] = fragmentation
    for key, default in (
        ("rekey_time", "1d"),
        ("reauth_time", "0s"),
        ("over_time", None),
        ("rand_time", None),
        ("keyingtries", "0"),
    ):
        value = _connection_value(peer, key, default)
        if value is not None:
            conn[key] = value
    return {str(peer["name"]): conn}


def build_vici_secret_for_peer(peer, identity, *, secret_decrypt_fn):
    psk = secret_decrypt_fn(identity.get("psk_encrypted"))
    # python-vici expects a flat load_shared payload (optional id + type/data/owners),
    # not a nested map keyed by secret name.
    return {
        "id": f"ike-{peer['name']}",
        "type": "IKE",
        "data": psk,
        "owners": [owner for owner in (str(identity.get("local_id") or ""), str(identity.get("remote_id") or "")) if owner],
    }


def build_vici_secret_metadata_for_peer(peer, identity):
    return {
        "id": f"ike-{peer['name']}",
        "type": "IKE",
        "owners": [owner for owner in (str(identity.get("local_id") or ""), str(identity.get("remote_id") or "")) if owner],
        "secret_set": bool(identity.get("psk_encrypted")),
    }


def _decode_vici_value(value):
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    if isinstance(value, dict):
        return {str(_decode_vici_value(key)): _decode_vici_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_decode_vici_value(item) for item in value]
    return value


def sanitize_vici_sas(raw):
    if isinstance(raw, dict):
        return _decode_vici_value(raw)
    if isinstance(raw, Iterable) and not isinstance(raw, (str, bytes)):
        items = [_decode_vici_value(item) for item in raw]
        if all(isinstance(item, dict) for item in items):
            merged = {}
            for item in items:
                merged.update(item)
            return merged
        return {"items": items}
    return {"items": []}


def _int_or_zero(value):
    try:
        return int(value)
    except Exception:
        return 0


def _format_duration(value):
    seconds = _int_or_zero(value)
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    return f"{hours:02d}:{minutes:02d}:{secs:02d}"


def _first_non_empty(*values, default=""):
    for value in values:
        if isinstance(value, list):
            if value:
                return value[0]
            continue
        if value is not None and str(value) != "":
            return value
    return default


def _drain_vici_result(result):
    if isinstance(result, Iterable) and not isinstance(result, (str, bytes, dict)):
        for _ in result:
            pass


def extract_active_peers_from_sas(sas):
    out = []
    if isinstance(sas, dict):
        for key, value in sas.items():
            if not isinstance(value, dict):
                continue
            children = value.get("child-sas") if isinstance(value.get("child-sas"), dict) else {}
            tx_bytes = 0
            rx_bytes = 0
            tx_packets = 0
            rx_packets = 0
            last_seen_values = []
            for child in children.values():
                if not isinstance(child, dict):
                    continue
                tx_bytes += _int_or_zero(child.get("bytes-out"))
                rx_bytes += _int_or_zero(child.get("bytes-in"))
                tx_packets += _int_or_zero(child.get("packets-out"))
                rx_packets += _int_or_zero(child.get("packets-in"))
                for use_key in ("use-out", "use-in"):
                    if child.get(use_key) is not None:
                        last_seen_values.append(_int_or_zero(child.get(use_key)))
            last_seen = min(last_seen_values) if last_seen_values else None
            out.append(
                {
                    "status": "up",
                    "peer": key,
                    "id": key,
                    "local_address": value.get("local-host") or "",
                    "local_port": str(value.get("local-port") or ""),
                    "remote_address": value.get("remote-host") or value.get("remote-hosts") or "",
                    "remote_port": str(value.get("remote-port") or ""),
                    "dynamic_address": _first_non_empty(
                        value.get("remote-vips"),
                        value.get("local-vips"),
                        value.get("remote-virtual-ips"),
                        value.get("local-virtual-ips"),
                        default="",
                    ),
                    "side": str(value.get("side") or value.get("role") or ""),
                    "ike_version": value.get("version") or "2",
                    "profile": value.get("name") or "",
                    "uptime": _format_duration(value.get("established")),
                    "rekey": value.get("rekey-time") or "",
                    "last_seen": _format_duration(last_seen) if last_seen is not None else "",
                    "ph2_total": len(children),
                    "tx_bytes": tx_bytes,
                    "rx_bytes": rx_bytes,
                    "tx_packets": tx_packets,
                    "rx_packets": rx_packets,
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
            last_seen_values = [
                _int_or_zero(child.get(key))
                for key in ("use-out", "use-in")
                if child.get(key) is not None
            ]
            last_seen = min(last_seen_values) if last_seen_values else None
            out.append(
                {
                    "state": child.get("state") or "INSTALLED",
                    "child_sa": child.get("name") or child_name,
                    "uniqueid": str(child.get("uniqueid") or ""),
                    "reqid": str(child.get("reqid") or ""),
                    "mode": child.get("mode") or "",
                    "protocol": child.get("protocol") or "",
                    "spi_in": child.get("spi-in") or "",
                    "spi_out": child.get("spi-out") or "",
                    "local_ts": child.get("local-ts") or [],
                    "remote_ts": child.get("remote-ts") or [],
                    "esp_proposal": child.get("proposal") or "",
                    "bytes_in": _int_or_zero(child.get("bytes-in")),
                    "bytes_out": _int_or_zero(child.get("bytes-out")),
                    "packets_in": _int_or_zero(child.get("packets-in")),
                    "packets_out": _int_or_zero(child.get("packets-out")),
                    "rekey_time": _format_duration(child.get("rekey-time")) if child.get("rekey-time") is not None else "",
                    "life_time": _format_duration(child.get("life-time")) if child.get("life-time") is not None else "",
                    "install_time": _format_duration(child.get("install-time")) if child.get("install-time") is not None else "",
                    "last_seen": _format_duration(last_seen) if last_seen is not None else "",
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


def list_installed_sas(*, session_factory=None, run_command_fn=None, include_xfrm=True):
    try:
        session = vici_session(session_factory=session_factory)
        sas = sanitize_vici_sas(session.list_sas())
        items = extract_installed_sas_from_sas(sas)
    except Exception:
        items = []
    if not include_xfrm:
        return {"items": items}
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
    block_reason = _peer_block_reason(peer, identity, profile)
    if block_reason:
        if block_reason == f"peer {target} is disabled":
            block_reason = "peer is disabled"
        elif block_reason.startswith(f"peer {target} "):
            block_reason = block_reason[len(f"peer {target} "):]
        raise ValueError(block_reason)
    warnings = []
    enabled_policies = _runtime_enabled_policies(policies, phase2, warnings)
    if not enabled_policies:
        raise ValueError("peer has no enabled policies")
    conn_obj = build_connection_fn(peer, identity, profile, enabled_policies, phase2)
    secret_obj = build_secret_fn(peer, identity)
    session = vici_session(session_factory=session_factory)
    _terminate_ike_best_effort(session, target)
    _unload_conn_best_effort(session, target)
    session.load_shared(secret_obj)
    session.load_conn(conn_obj)
    log_event_fn("load_peer", {"peer": target})
    return {"peer": target, "loaded": True}


def initiate_policy(policy_name, *, list_policies_fn, session_factory=None, log_event_fn):
    target = str(policy_name)
    policy = next((x for x in list_policies_fn() if x.get("name") == target), None)
    if policy is None:
        raise LookupError("policy not found")
    if not _is_enabled(policy):
        raise ValueError("policy is disabled")
    session = vici_session(session_factory=session_factory)
    _drain_vici_result(session.initiate({"child": target, "timeout": VICI_INITIATE_TIMEOUT_MS}))
    log_event_fn("initiate", {"policy": target})
    return {"policy": target, "initiated": True}


def terminate_peer(peer_name, *, session_factory=None, log_event_fn):
    target = str(peer_name)
    session = vici_session(session_factory=session_factory)
    _drain_vici_result(session.terminate({"ike": target, "force": True}))
    log_event_fn("terminate", {"peer": target})
    return {"peer": target, "terminated": True}


def _terminate_ike_best_effort(session, peer_name):
    try:
        _drain_vici_result(session.terminate({"ike": str(peer_name), "force": True}))
    except Exception:
        pass


def _unload_conn_best_effort(session, peer_name):
    try:
        _drain_vici_result(session.unload_conn({"name": str(peer_name)}))
    except Exception:
        pass


def _as_list(value):
    if isinstance(value, list):
        return [str(item) for item in value]
    if value in (None, ""):
        return []
    return [str(value)]


def _endpoint_key(item):
    return (tuple(_as_list(item.get("local_addrs"))), tuple(_as_list(item.get("remote_addrs"))))


def _loaded_conn_items(session):
    try:
        raw = sanitize_vici_sas(session.list_conns())
    except Exception:
        return []
    if isinstance(raw, dict):
        return [(str(name), value if isinstance(value, dict) else {}) for name, value in raw.items()]
    if isinstance(raw, list):
        items = []
        for entry in raw:
            if isinstance(entry, dict):
                if "name" in entry:
                    items.append((str(entry.get("name")), entry))
                else:
                    items.extend((str(name), value if isinstance(value, dict) else {}) for name, value in entry.items())
        return items
    return []


def _unload_obsolete_endpoint_conns(session, refs, *, warnings):
    desired_names = {str(peer.get("name")) for peer, *_rest in refs}
    desired_endpoints = {
        _endpoint_key(peer)
        for peer, *_rest in refs
        if _endpoint_key(peer) != ((), ())
    }
    if not desired_endpoints:
        return
    for name, conn in _loaded_conn_items(session):
        if name in desired_names:
            continue
        if _endpoint_key(conn) not in desired_endpoints:
            continue
        _terminate_ike_best_effort(session, name)
        _unload_conn_best_effort(session, name)
        warnings.append(f"unloaded obsolete runtime connection {name}")


def _policies_for_explicit_initiate(policies):
    out = []
    for policy in policies:
        if str(policy.get("start_action") or "start") == "start":
            out.append({**policy, "start_action": "none"})
        else:
            out.append(policy)
    return out


def _peer_block_reason(peer, identity, profile):
    peer_name = str(peer.get("name"))
    if not _is_enabled(peer):
        return f"peer {peer_name} is disabled"
    if not _is_enabled(profile):
        return f"peer {peer_name} phase1 profile {profile.get('name') or peer.get('phase1_profile')} is disabled"
    if not _is_enabled(identity):
        return f"peer {peer_name} identity is disabled"
    return None


def _runtime_enabled_policies(policies, phase2, warnings):
    out = []
    for policy in policies:
        if not _is_enabled(policy):
            continue
        proposal_name = policy.get("proposal")
        proposal = phase2.get(proposal_name)
        if proposal is not None and not _is_enabled(proposal):
            warnings.append(f"policy {policy.get('name')} phase2 proposal {proposal_name} is disabled")
            continue
        out.append(policy)
    return out


def _installed_child_names(sas, peer_name):
    peer = sas.get(str(peer_name)) if isinstance(sas, dict) else None
    if not isinstance(peer, dict):
        return set()
    children = peer.get("child-sas") if isinstance(peer.get("child-sas"), dict) else {}
    return {
        str(child.get("name") or child_name)
        for child_name, child in children.items()
        if isinstance(child, dict) and str(child.get("state") or "").upper() == "INSTALLED"
    }


def _wait_for_children(session, peer_name, policy_names, *, timeout=15, interval=1, sleep_fn=time.sleep):
    pending = {str(name) for name in policy_names}
    if not pending:
        return set()
    attempts = max(1, int(timeout / interval) + 1)
    installed = set()
    for attempt in range(attempts):
        sas = sanitize_vici_sas(session.list_sas())
        installed = _installed_child_names(sas, peer_name)
        if pending.issubset(installed):
            return pending
        if attempt + 1 < attempts:
            sleep_fn(interval)
    return pending.intersection(installed)


def _initiate_child_and_wait(session, peer_name, child_name, *, sleep_fn=time.sleep):
    target = str(child_name)
    initiate_error = None
    try:
        _drain_vici_result(session.initiate({"child": target, "timeout": VICI_INITIATE_TIMEOUT_MS}))
    except Exception as exc:
        initiate_error = exc
    installed = _wait_for_children(session, peer_name, [target], sleep_fn=sleep_fn)
    if target in installed:
        return True, None
    if initiate_error is not None:
        return False, initiate_error
    return False, RuntimeError("CHILD_SA was not installed")


def build_config_preview(*, collect_refs_fn, build_connection_fn):
    refs = collect_refs_fn()
    connections = {}
    secrets = []
    warnings = []
    for peer, identity, profile, policies, phase2 in refs:
        peer_name = str(peer.get("name"))
        block_reason = _peer_block_reason(peer, identity, profile)
        if block_reason:
            warnings.append(block_reason)
            continue
        enabled_policies = _runtime_enabled_policies(policies, phase2, warnings)
        if not enabled_policies:
            warnings.append(f"peer {peer_name} has no enabled policies")
            continue
        conn_obj = build_connection_fn(peer, identity, profile, _policies_for_explicit_initiate(enabled_policies), phase2)
        connections.update(conn_obj)
        secrets.append(build_vici_secret_metadata_for_peer(peer, identity))
    return {"connections": connections, "secrets": secrets, "warnings": warnings}


def apply_config(
    *,
    collect_refs_fn,
    build_connection_fn,
    build_secret_fn,
    session_factory=None,
    run_command_fn=None,
    log_event_fn,
    sleep_fn=time.sleep,
):
    refs = collect_refs_fn()
    loaded = []
    initiated = []
    warnings = []
    session = vici_session(session_factory=session_factory)
    _unload_obsolete_endpoint_conns(session, refs, warnings=warnings)
    for peer, identity, profile, policies, phase2 in refs:
        peer_name = str(peer.get("name"))
        block_reason = _peer_block_reason(peer, identity, profile)
        if block_reason:
            _terminate_ike_best_effort(session, peer_name)
            _unload_conn_best_effort(session, peer_name)
            warnings.append(block_reason)
            continue
        enabled_policies = _runtime_enabled_policies(policies, phase2, warnings)
        if not enabled_policies:
            _terminate_ike_best_effort(session, peer_name)
            _unload_conn_best_effort(session, peer_name)
            warnings.append(f"peer {peer_name} has no enabled policies")
            continue
        conn_obj = build_connection_fn(peer, identity, profile, _policies_for_explicit_initiate(enabled_policies), phase2)
        secret_obj = build_secret_fn(peer, identity)
        _terminate_ike_best_effort(session, peer_name)
        _unload_conn_best_effort(session, peer_name)
        session.load_shared(secret_obj)
        session.load_conn(conn_obj)
        loaded.append(peer_name)
        start_policy_names = [
            str(policy.get("name"))
            for policy in enabled_policies
            if bool(policy.get("enabled", True)) and str(policy.get("start_action") or "start") == "start"
        ]
        if str(peer.get("ike_version") or "2") == "1":
            installed = _wait_for_children(session, peer_name, start_policy_names, sleep_fn=sleep_fn)
            initiated.extend(name for name in start_policy_names if name in installed)
            missing = [name for name in start_policy_names if name not in installed]
            if missing:
                warnings.append(f"waiting for IKEv1 CHILD_SA timed out: {', '.join(missing)}")
            continue
        for policy in enabled_policies:
            should_start = bool(policy.get("enabled", True)) and str(policy.get("start_action") or "start") == "start"
            if should_start:
                policy_name = str(policy.get("name"))
                ok, error = _initiate_child_and_wait(session, peer_name, policy_name, sleep_fn=sleep_fn)
                if ok:
                    initiated.append(policy_name)
                else:
                    warnings.append(f"initiate failed for {policy_name}: {error}")
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
