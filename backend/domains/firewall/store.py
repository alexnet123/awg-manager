#!/usr/bin/python3
import ipaddress
import re
import uuid

from ...common import json_store


def read_rules(path):
    payload = json_store.read_json(path, {})
    if isinstance(payload, dict):
        payload = payload.get('rules', [])
    elif isinstance(payload, list):
        return [dict(row) for row in payload if isinstance(row, dict)]
    else:
        return []
    if not isinstance(payload, list):
        return []
    return [dict(row) for row in payload if isinstance(row, dict)]


def write_rules(path, rules):
    json_store.write_json(path, {'rules': rules}, ensure_dir=True)


def read_sets(path):
    data = json_store.read_json(path, {})
    def _clean_rows(raw_rows):
        if not isinstance(raw_rows, list):
            return []
        return [dict(row) for row in raw_rows if isinstance(row, dict)]
    return {
        'addr': _clean_rows(data.get('addr', [])),
        'port': _clean_rows(data.get('port', [])),
        'iface': _clean_rows(data.get('iface', [])),
    }


def write_sets(path, data):
    json_store.write_json(path, data, ensure_dir=True)


def read_maps(path):
    data = json_store.read_json(path, {})
    def _clean_rows(raw_rows):
        if not isinstance(raw_rows, list):
            return []
        return [dict(row) for row in raw_rows if isinstance(row, dict)]
    return {
        'map': _clean_rows(data.get('map', [])),
        'vmap': _clean_rows(data.get('vmap', [])),
    }


def write_maps(path, data):
    json_store.write_json(path, data, ensure_dir=True)


def read_objects(path):
    data = json_store.read_json(path, {})
    rows = data.get('objects', [])
    if not isinstance(rows, list):
        rows = []
    out = []
    for row in rows:
        if isinstance(row, dict):
            out.append(dict(row))
    return {'objects': out}


def write_objects(path, data):
    rows = data.get('objects', []) if isinstance(data, dict) else []
    clean = []
    if isinstance(rows, list):
        for row in rows:
            if isinstance(row, dict):
                clean.append(dict(row))
    json_store.write_json(path, {'objects': clean}, ensure_dir=True)


def read_tables(path):
    data = json_store.read_json(path, {})
    rows = data.get('tables', [])
    if not isinstance(rows, list):
        rows = []
    out = []
    for row in rows:
        if isinstance(row, dict):
            out.append(row)
    return {'tables': out}


def write_tables(path, data):
    json_store.write_json(path, data, ensure_dir=True)


def read_managed_tables(path, normalize_value_fn):
    data = json_store.read_json(path, {})
    items = data.get('tables', [])
    out = []
    if isinstance(items, list):
        for x in items:
            v = normalize_value_fn(x)
            if v is not None:
                out.append(str(v).lower())
    return {'tables': sorted(set(out))}


def write_managed_tables(path, data, normalize_value_fn):
    rows = data.get('tables', []) if isinstance(data, dict) else []
    clean = []
    if isinstance(rows, list):
        for x in rows:
            v = normalize_value_fn(x)
            if v is not None:
                clean.append(str(v).lower())
    json_store.write_json(path, {'tables': sorted(set(clean))}, ensure_dir=True)


def read_stats(path):
    data = json_store.read_json(path, {})
    return data if isinstance(data, dict) else {}


def write_stats(path, data):
    json_store.write_json(path, data, ensure_dir=True)


def managed_table_key(family, table_name):
    return f"{str(family).lower()}:{str(table_name).lower()}"


def parse_managed_table_key(value, normalize_value_fn, supported_families, default_family):
    raw = normalize_value_fn(value)
    if raw is None:
        return None
    text = str(raw).lower()
    if ":" in text:
        fam, name = text.split(":", 1)
        fam = fam.strip()
        name = name.strip()
        if fam in supported_families and name:
            return (fam, name)
    # Backward compatibility with legacy format: "table_name" means default family.
    return (default_family, text)


def _to_bool(value):
    if isinstance(value, bool):
        return value
    return str(value).lower() in ("1", "true", "yes", "on")


def collect_table_defs(
    default_table_defs,
    custom_tables,
    normalize_value_fn,
    supported_families,
    default_family,
):
    table_defs = {
        (default_family, str(table_name).lower()): list(chains)
        for table_name, chains in default_table_defs.items()
    }
    for row in custom_tables:
        if not isinstance(row, dict):
            continue
        if not _to_bool(row.get("enabled", True)):
            continue
        family = (normalize_value_fn(row.get("family")) or default_family).lower()
        table_name = normalize_value_fn(row.get("table_name"))
        chain_name = normalize_value_fn(row.get("chain_name"))
        chain_type = normalize_value_fn(row.get("chain_type"))
        hook_name = normalize_value_fn(row.get("hook"))
        policy = normalize_value_fn(row.get("policy")) or "accept"
        if family not in supported_families:
            continue
        if table_name is None or chain_name is None or chain_type is None or hook_name is None:
            continue
        try:
            priority = int(row.get("priority"))
        except Exception:
            continue
        dev = normalize_value_fn(row.get("device"))
        table_key = (family, str(table_name).strip().lower())
        table_defs.setdefault(table_key, [])
        table_defs[table_key].append(
            (
                str(chain_name),
                str(chain_type),
                str(hook_name),
                priority,
                (str(dev) if dev else None),
                str(policy),
            )
        )
    return table_defs


def _to_int_or_none(value):
    try:
        return int(value) if value is not None else None
    except Exception:
        return None


def enrich_collection_item_runtime(item, timeout_to_seconds_fn, now_ts):
    payload = dict(item or {})
    created_at = _to_int_or_none(payload.get("created_at"))
    timeout_started_at = _to_int_or_none(payload.get("timeout_started_at"))
    timeout_seconds = timeout_to_seconds_fn(payload.get("timeout"))
    enabled = bool(payload.get("enabled", True))

    timeout_remaining_seconds = None
    if enabled and timeout_seconds and timeout_started_at:
        timeout_remaining_seconds = max(0, int(timeout_seconds) - max(0, int(now_ts) - int(timeout_started_at)))

    payload["created_at"] = created_at
    payload["timeout_started_at"] = timeout_started_at
    payload["timeout_seconds"] = timeout_seconds
    payload["timeout_remaining_seconds"] = timeout_remaining_seconds
    return payload


def cleanup_expired_collection_rows(rows, now_ts, timeout_to_seconds_fn):
    changed = False
    removed_active = 0
    kept = []
    for row in rows:
        payload = dict(row or {})
        timeout_seconds = timeout_to_seconds_fn(payload.get("timeout"))
        if not timeout_seconds:
            kept.append(payload)
            continue
        started = payload.get("timeout_started_at")
        if started is None:
            started = payload.get("created_at")
            if started is not None:
                payload["timeout_started_at"] = started
                changed = True
        started_ts = _to_int_or_none(started)
        if started_ts is None:
            kept.append(payload)
            continue
        if int(now_ts) >= int(started_ts) + int(timeout_seconds):
            changed = True
            if bool(payload.get("enabled", True)):
                removed_active += 1
            continue
        kept.append(payload)
    return kept, changed, removed_active


def set_runtime_signature(item, normalize_value_fn):
    payload = dict(item or {})
    elems = [
        str(x).strip()
        for x in (payload.get("elements") or [])
        if normalize_value_fn(x) is not None
    ]
    return (
        str(payload.get("name") or ""),
        bool(payload.get("enabled", True)),
        normalize_value_fn(payload.get("timeout")),
        tuple(sorted(set(elems))),
    )


def map_runtime_signature(item, normalize_value_fn):
    payload = dict(item or {})
    entries = [
        str(x).strip()
        for x in (payload.get("entries") or [])
        if normalize_value_fn(x) is not None
    ]
    return (
        str(payload.get("name") or ""),
        bool(payload.get("enabled", True)),
        normalize_value_fn(payload.get("timeout")),
        str(payload.get("kind") or ""),
        tuple(sorted(set(entries))),
    )


def _normalize_logical_bool(value):
    if isinstance(value, bool):
        return value
    return str(value).lower() in ("1", "true", "yes", "on")


def normalize_set_item(payload, set_kind, normalize_value_fn, normalize_timeout_fn):
    if not isinstance(payload, dict):
        raise ValueError("set payload must be object")
    name = normalize_value_fn(payload.get("name"))
    if name is None or not re.fullmatch(r"[A-Za-z0-9_.-]+", str(name)):
        raise ValueError("set name is invalid")
    elems = payload.get("elements") or []
    if not isinstance(elems, list):
        raise ValueError("elements must be array")
    enabled = _normalize_logical_bool(payload.get("enabled", True))
    comment = normalize_value_fn(payload.get("comment"))
    if comment is not None:
        comment = str(comment).replace('"', "'")
    timeout = normalize_timeout_fn(payload.get("timeout"))
    out = []
    for raw in elems:
        val = normalize_value_fn(raw)
        if val is None:
            continue
        item = str(val).strip()
        if set_kind == "addr":
            ipaddress.ip_network(item, strict=False)
        elif set_kind == "port":
            if not re.fullmatch(r"[0-9]{1,5}", item):
                raise ValueError("port element must be integer")
            port = int(item)
            if port < 1 or port > 65535:
                raise ValueError("port element must be 1..65535")
        elif set_kind == "iface":
            if not re.fullmatch(r"[A-Za-z0-9_.:-]+", item):
                raise ValueError("iface element contains invalid characters")
        out.append(item)
    return {
        "id": str(payload.get("id") or uuid.uuid4().hex),
        "name": str(name),
        "elements": sorted(set(out)),
        "enabled": enabled,
        "comment": comment,
        "timeout": timeout,
    }


def normalize_map_item(payload, map_kind, normalize_value_fn, normalize_timeout_fn):
    if not isinstance(payload, dict):
        raise ValueError("map payload must be object")
    name = normalize_value_fn(payload.get("name"))
    if name is None or not re.fullmatch(r"[A-Za-z0-9_.-]+", str(name)):
        raise ValueError("map name is invalid")
    entries = payload.get("entries") or []
    if not isinstance(entries, list):
        raise ValueError("entries must be array")
    enabled = _normalize_logical_bool(payload.get("enabled", True))
    comment = normalize_value_fn(payload.get("comment"))
    if comment is not None:
        comment = str(comment).replace('"', "'")
    timeout = normalize_timeout_fn(payload.get("timeout"))
    normalized_entries = []
    for raw in entries:
        val = normalize_value_fn(raw)
        if val is None:
            continue
        item = str(val).strip()
        if ":" not in item:
            raise ValueError('entry must be "key:value"')
        if len(item) > 200:
            raise ValueError("entry is too long")
        normalized_entries.append(item)
    return {
        "id": str(payload.get("id") or uuid.uuid4().hex),
        "name": str(name),
        "entries": sorted(set(normalized_entries)),
        "enabled": enabled,
        "comment": comment,
        "timeout": timeout,
        "kind": map_kind,
    }


def prepare_collection_kind_rows(source_rows, now_ts, cleanup_expired_fn, enrich_item_fn):
    raw_rows = [dict(row or {}) for row in (source_rows or [])]
    persisted_rows, expired_changed, expired_active = cleanup_expired_fn(raw_rows, now_ts)
    changed = bool(expired_changed)
    removed_active = int(expired_active)
    normalized_rows = []
    response_rows = []
    for payload in persisted_rows:
        if payload.get("created_at") is None:
            payload["created_at"] = int(now_ts)
            changed = True
        if payload.get("timeout") and payload.get("enabled", True) and payload.get("timeout_started_at") is None:
            payload["timeout_started_at"] = int(payload["created_at"])
            changed = True
        normalized_rows.append(payload)
        response_rows.append(enrich_item_fn(payload, now_ts))
    return normalized_rows, response_rows, changed, removed_active


def upsert_collection_rows(existing_rows, item, now_ts, runtime_signature_fn, normalize_value_fn):
    out = []
    replaced = False
    runtime_changed = False
    row_item = dict(item or {})
    for row in existing_rows or []:
        if row.get("id") == row_item.get("id"):
            prev_runtime_sig = runtime_signature_fn(row)
            prev_timeout = normalize_value_fn(row.get("timeout"))
            if prev_timeout:
                raise ValueError("temporary collections are read-only; delete and recreate")
            next_timeout = normalize_value_fn(row_item.get("timeout"))
            prev_enabled = bool(row.get("enabled", True))
            next_enabled = bool(row_item.get("enabled", True))
            if prev_timeout and prev_enabled != next_enabled:
                raise ValueError("temporary collections cannot be enabled/disabled; delete them instead")
            created_at = row.get("created_at")
            if created_at is None:
                created_at = now_ts
            started_at = row.get("timeout_started_at")
            if not next_enabled or not next_timeout:
                started_at = None
            elif prev_timeout != next_timeout or not prev_enabled:
                started_at = now_ts
            elif started_at is None:
                started_at = now_ts
            row_item["created_at"] = int(created_at)
            row_item["timeout_started_at"] = int(started_at) if started_at is not None else None
            runtime_changed = runtime_changed or (prev_runtime_sig != runtime_signature_fn(row_item))
            out.append(row_item)
            replaced = True
        else:
            out.append(row)
    if not replaced:
        if row_item.get("timeout") and not row_item.get("enabled", True):
            raise ValueError("temporary collections cannot be created in disabled state")
        row_item["created_at"] = int(now_ts)
        row_item["timeout_started_at"] = int(now_ts) if row_item.get("enabled", True) and row_item.get("timeout") else None
        out.append(row_item)
        runtime_changed = bool(row_item.get("enabled", True))
    return out, row_item, runtime_changed


def ensure_unique_collection_names(rows, current_name, other_names, duplicate_error, global_error):
    names = [x.get("name") for x in (rows or [])]
    if len(names) != len(set(names)):
        raise ValueError(str(duplicate_error))
    if current_name in list(other_names or []):
        raise ValueError(str(global_error))


def delete_collection_row(rows, item_id, not_found_error):
    existing = next((x for x in (rows or []) if x.get("id") == str(item_id)), None)
    if not existing:
        raise LookupError(str(not_found_error))
    out = [x for x in (rows or []) if x.get("id") != str(item_id)]
    runtime_changed = bool(existing.get("enabled", True))
    return out, existing, runtime_changed


def build_tables_listing(default_table_defs, custom_rows, default_family):
    builtin = []
    for table_name, chains in (default_table_defs or {}).items():
        for chain in chains:
            chain_name, chain_type, hook_name, priority, device, policy = chain
            builtin.append(
                {
                    "id": f"builtin:{table_name}:{chain_name}:{hook_name}:{priority}",
                    "family": default_family,
                    "table_name": table_name,
                    "chain_name": chain_name,
                    "chain_type": chain_type,
                    "hook": hook_name,
                    "device": device,
                    "priority": int(priority),
                    "policy": policy,
                    "builtin": True,
                    "enabled": True,
                }
            )
    custom = []
    for row in custom_rows or []:
        if not isinstance(row, dict):
            continue
        item = dict(row)
        item["family"] = str((item.get("family") or default_family)).lower()
        item["builtin"] = False
        custom.append(item)
    return {"builtin": builtin, "custom": custom}


def parse_named_objects_query(family, table, normalize_value_fn, supported_families):
    normalized_family = (normalize_value_fn(family) or "").lower()
    normalized_table = normalize_value_fn(table)
    if normalized_family not in supported_families:
        raise ValueError("family must be one of: inet, ip, ip6, bridge, netdev")
    if normalized_table is None or not re.fullmatch(r"[a-zA-Z0-9_.-]+", str(normalized_table)):
        raise ValueError("table is invalid")
    return normalized_family, str(normalized_table).lower()


def filter_declared_named_objects(rows, family, table, allowed_kinds):
    out = []
    for row in rows or []:
        if str(row.get("family") or "").lower() != str(family).lower():
            continue
        if str(row.get("table") or "").lower() != str(table).lower():
            continue
        if str(row.get("kind") or "").lower() not in tuple(allowed_kinds or ()):
            continue
        out.append(dict(row))
    return out


def build_named_objects_listing(family, table, declared_items, objects_by_kind=None, table_is_active=False):
    if not table_is_active:
        return {
            "family": family,
            "table": table,
            "counter": [],
            "limit": [],
            "quota": [],
            "ct_helper": [],
            "ct_timeout": [],
            "ct_expectation": [],
            "items": [],
        }
    objects_by_kind = objects_by_kind or {}
    return {
        "family": family,
        "table": table,
        "counter": sorted(objects_by_kind.get("counter", set())),
        "limit": sorted(objects_by_kind.get("limit", set())),
        "quota": sorted(objects_by_kind.get("quota", set())),
        "ct_helper": sorted(objects_by_kind.get("ct_helper", set())),
        "ct_timeout": sorted(objects_by_kind.get("ct_timeout", set())),
        "ct_expectation": sorted(objects_by_kind.get("ct_expectation", set())),
        "items": declared_items,
    }


def named_object_rule_reference(rule, kind, normalize_value_fn):
    mapping = {
        "counter": "counter_name",
        "limit": "limit_name",
        "quota": "quota_name",
        "ct_helper": "ct_helper_set",
        "ct_timeout": "ct_timeout_set",
        "ct_expectation": "ct_expectation_set",
    }
    field = mapping.get(str(kind))
    if not field:
        return None
    return normalize_value_fn((rule or {}).get(field))


def find_named_object_references(rules, family, table_name, kind, name, normalize_value_fn):
    refs = []
    for rule in rules or []:
        if str((rule or {}).get("family") or "").lower() != str(family).lower():
            continue
        if str((rule or {}).get("table") or "").lower() != str(table_name).lower():
            continue
        ref_name = named_object_rule_reference(rule, kind, normalize_value_fn)
        if ref_name is None:
            continue
        if str(ref_name).lower() == str(name).lower():
            refs.append({"rule_id": str((rule or {}).get("id") or ""), "chain": str((rule or {}).get("chain") or "")})
    return refs


def find_named_object_by_id(rows, object_id):
    target_id = str(object_id)
    return next((row for row in (rows or []) if str((row or {}).get("id") or "") == target_id), None)


def upsert_named_object_rows(rows, item):
    out = []
    replaced = False
    item_id = str((item or {}).get("id") or "")
    for row in rows or []:
        if str((row or {}).get("id") or "") == item_id:
            out.append(item)
            replaced = True
        else:
            out.append(row)
    if not replaced:
        out.append(item)
    return out


def ensure_unique_named_object_signatures(rows):
    seen = set()
    for row in rows or []:
        signature = (
            str((row or {}).get("family") or "").lower(),
            str((row or {}).get("table") or "").lower(),
            str((row or {}).get("kind") or "").lower(),
            str((row or {}).get("name") or "").lower(),
        )
        if signature in seen:
            raise ValueError("object name must be unique inside family/table/kind")
        seen.add(signature)


def delete_named_object_row(rows, object_id, not_found_error):
    existing = find_named_object_by_id(rows, object_id)
    if existing is None:
        raise LookupError(str(not_found_error))
    target_id = str(object_id)
    out = [row for row in (rows or []) if str((row or {}).get("id") or "") != target_id]
    return out, existing


def upsert_table_rows(rows, item):
    out = []
    replaced = False
    item_id = str((item or {}).get("id") or "")
    for row in rows or []:
        if str((row or {}).get("id") or "") == item_id:
            out.append(item)
            replaced = True
        else:
            out.append(row)
    if not replaced:
        out.append(item)
    return out


def ensure_unique_table_signatures(rows, default_family):
    seen = set()
    for row in rows or []:
        signature = (
            str((row or {}).get("family") or default_family).lower(),
            (row or {}).get("table_name"),
            (row or {}).get("chain_name"),
            (row or {}).get("hook"),
            int((row or {}).get("priority")),
        )
        if signature in seen:
            raise ValueError("duplicate chain/hook/priority in same table")
        seen.add(signature)


def delete_table_row(rows, table_id, not_found_error):
    target_id = str(table_id)
    existing = next((row for row in (rows or []) if str((row or {}).get("id") or "") == target_id), None)
    if existing is None:
        raise LookupError(str(not_found_error))
    out = [row for row in (rows or []) if str((row or {}).get("id") or "") != target_id]
    return out, existing


def remove_objects_for_table(rows, family, table_name):
    normalized_family = str(family or "").lower()
    normalized_table = str(table_name or "").lower()
    out = [
        row
        for row in (rows or [])
        if not (
            str((row or {}).get("family") or "").lower() == normalized_family
            and str((row or {}).get("table") or "").lower() == normalized_table
        )
    ]
    return out, len(out) != len(rows or [])


def normalize_firewall_table_item(
    payload,
    normalize_value_fn,
    default_family,
    supported_families,
    reserved_priorities,
):
    if not isinstance(payload, dict):
        raise ValueError("table payload must be object")
    family = (normalize_value_fn(payload.get("family")) or default_family).lower()
    if family not in tuple(supported_families or ()):
        raise ValueError("family must be one of: inet, ip, ip6, bridge, netdev")
    table_name = normalize_value_fn(payload.get("table_name"))
    chain_name = normalize_value_fn(payload.get("chain_name"))
    chain_type = (normalize_value_fn(payload.get("chain_type")) or "filter").lower()
    hook_name = (normalize_value_fn(payload.get("hook")) or "input").lower()
    device = normalize_value_fn(payload.get("device"))
    policy = (normalize_value_fn(payload.get("policy")) or "accept").lower()
    enabled = payload.get("enabled", True)
    try:
        priority = int(payload.get("priority"))
    except Exception:
        raise ValueError("priority must be integer")
    if table_name is None or not re.fullmatch(r"[a-zA-Z0-9_.-]+", str(table_name)):
        raise ValueError("table_name is invalid")
    if chain_name is None or not re.fullmatch(r"[a-zA-Z0-9_.-]+", str(chain_name)):
        raise ValueError("chain_name is invalid")
    if chain_type not in ("filter", "nat", "route"):
        raise ValueError("chain_type must be filter|nat|route")
    if hook_name not in ("prerouting", "input", "forward", "output", "postrouting", "ingress"):
        raise ValueError("hook is invalid")
    allowed_hooks_by_type = {
        "filter": {"prerouting", "input", "forward", "output", "postrouting", "ingress"},
        "nat": {"prerouting", "input", "output", "postrouting"},
        "route": {"output"},
    }
    if hook_name not in allowed_hooks_by_type[chain_type]:
        raise ValueError(f'hook "{hook_name}" is not allowed for chain_type "{chain_type}"')
    if hook_name == "ingress" and chain_type != "filter":
        raise ValueError('ingress hook is only valid for chain_type "filter"')
    if hook_name == "ingress" and device is None:
        raise ValueError("device is required for ingress hook")
    if hook_name != "ingress" and device is not None:
        raise ValueError("device can be set only for ingress hook")
    if family == "netdev":
        if chain_type != "filter" or hook_name != "ingress":
            raise ValueError("netdev family supports only chain_type=filter with hook=ingress")
        if device is None:
            raise ValueError("device is required for netdev family")
    if family == "bridge":
        if chain_type != "filter":
            raise ValueError("bridge family supports only chain_type=filter")
        if hook_name == "ingress":
            raise ValueError("bridge family does not support ingress hook in this manager")
    if policy not in ("accept", "drop"):
        raise ValueError("policy must be accept|drop")
    if priority in set(reserved_priorities or ()):
        raise ValueError("priority is reserved by built-in tables")
    if not isinstance(enabled, bool):
        enabled = str(enabled).lower() in ("1", "true", "yes", "on")
    return {
        "id": str(payload.get("id") or uuid.uuid4().hex),
        "family": family,
        "table_name": str(table_name).lower(),
        "chain_name": str(chain_name),
        "chain_type": chain_type,
        "hook": hook_name,
        "device": (str(device) if device else None),
        "priority": priority,
        "policy": policy,
        "enabled": enabled,
    }
