#!/usr/bin/python3
import re
import uuid

from . import store


def _default_named_object_id_factory():
    return uuid.uuid4().hex


def _normalize_l3proto_for_family(raw_l3proto, family, normalize_value_fn):
    l3proto = normalize_value_fn(raw_l3proto)
    if l3proto is None:
        return None
    l3proto = str(l3proto).lower()
    if l3proto not in ("ip", "ip6"):
        raise ValueError("l3proto must be ip|ip6")
    if family in ("ip", "ip6") and l3proto != family:
        raise ValueError(f"l3proto must match family={family}")
    return l3proto


def normalize_named_object_payload(
    payload,
    normalize_value_fn,
    normalize_bool_fn,
    normalize_timeout_fn,
    validate_table_exists_fn,
    default_family,
    supported_families,
    supported_kinds,
    id_factory=None,
):
    if not isinstance(payload, dict):
        raise ValueError("object payload must be object")
    kind = (normalize_value_fn(payload.get("kind")) or "").lower()
    if kind not in tuple(supported_kinds or ()):
        raise ValueError("kind must be one of: counter, limit, quota, ct_helper, ct_timeout, ct_expectation")
    family = (normalize_value_fn(payload.get("family")) or default_family).lower()
    if family not in tuple(supported_families or ()):
        raise ValueError("family must be one of: inet, ip, ip6, bridge, netdev")
    if family == "netdev" and kind in ("ct_helper", "ct_timeout", "ct_expectation"):
        raise ValueError(f"{kind} is not supported for family=netdev")
    if family == "bridge" and kind == "ct_expectation":
        raise ValueError(f"ct_expectation is not supported for family={family}")
    table_name = normalize_value_fn(payload.get("table"))
    if table_name is None or not re.fullmatch(r"[A-Za-z0-9_.-]+", str(table_name)):
        raise ValueError("table is invalid")
    table_name = str(table_name).lower()
    validate_table_exists_fn(family, table_name)
    name = normalize_value_fn(payload.get("name"))
    if name is None or not re.fullmatch(r"[A-Za-z0-9_.:-]+", str(name)):
        raise ValueError("name is invalid")
    name = str(name).lower()
    enabled = normalize_bool_fn(payload.get("enabled", True))
    comment = normalize_value_fn(payload.get("comment"))
    if comment is not None:
        comment = str(comment).replace('"', "'")

    config = {}
    if kind == "counter":
        packets_raw = normalize_value_fn(payload.get("packets"))
        bytes_raw = normalize_value_fn(payload.get("bytes"))
        if packets_raw is not None:
            if not re.fullmatch(r"[0-9]+", packets_raw):
                raise ValueError("packets must be unsigned integer")
            config["packets"] = int(packets_raw)
        if bytes_raw is not None:
            if not re.fullmatch(r"[0-9]+", bytes_raw):
                raise ValueError("bytes must be unsigned integer")
            config["bytes"] = int(bytes_raw)
    elif kind == "limit":
        rate = normalize_value_fn(payload.get("rate"))
        if rate is None or not re.fullmatch(r"[0-9]+(?:\s+(?:bytes|kbytes|mbytes|gbytes))?/(second|minute|hour|day)", rate.lower()):
            raise ValueError("rate must be like 10/second or 1024 bytes/second")
        config["rate"] = rate.lower()
        burst = normalize_value_fn(payload.get("burst"))
        if burst is not None:
            if not re.fullmatch(r"[0-9]+(?:\s+(?:packets|bytes|kbytes|mbytes|gbytes))?", burst.lower()):
                raise ValueError("burst is invalid")
            config["burst"] = burst.lower()
        config["over"] = normalize_bool_fn(payload.get("over", False))
    elif kind == "quota":
        mode = (normalize_value_fn(payload.get("mode")) or "over").lower()
        if mode not in ("over", "until"):
            raise ValueError("mode must be over|until")
        bytes_value = normalize_value_fn(payload.get("bytes"))
        if bytes_value is None or not re.fullmatch(r"[0-9]+\s+(bytes|kbytes|mbytes|gbytes)", bytes_value.lower()):
            raise ValueError('bytes must be like "20 mbytes"')
        config["mode"] = mode
        config["bytes"] = bytes_value.lower()
        used = normalize_value_fn(payload.get("used"))
        if used is not None:
            if not re.fullmatch(r"[0-9]+\s+(bytes|kbytes|mbytes|gbytes)", used.lower()):
                raise ValueError('used must be like "1 mbytes"')
            config["used"] = used.lower()
    elif kind == "ct_helper":
        helper_type = normalize_value_fn(payload.get("helper_type"))
        if helper_type is None or not re.fullmatch(r"[A-Za-z0-9_.:-]+", helper_type):
            raise ValueError("helper_type is invalid")
        l4proto = (normalize_value_fn(payload.get("l4proto")) or "").lower()
        if l4proto not in ("tcp", "udp"):
            raise ValueError("l4proto must be tcp|udp")
        l3proto = _normalize_l3proto_for_family(payload.get("l3proto"), family, normalize_value_fn)
        config["helper_type"] = helper_type.lower()
        config["l4proto"] = l4proto
        if l3proto is not None:
            config["l3proto"] = l3proto
    elif kind == "ct_timeout":
        l4proto = (normalize_value_fn(payload.get("l4proto")) or "").lower()
        if l4proto not in ("tcp", "udp"):
            raise ValueError("l4proto must be tcp|udp")
        policy = normalize_value_fn(payload.get("timeout_policy"))
        if policy is None:
            raise ValueError("timeout_policy is required")
        policy = str(policy).strip().lower()
        if len(policy) > 240:
            raise ValueError("timeout_policy is too long")
        if not re.fullmatch(r"[a-z0-9_:, .-]+", policy):
            raise ValueError("timeout_policy contains invalid characters")
        if ":" not in policy:
            raise ValueError("timeout_policy must contain state:value pairs")
        l3proto = _normalize_l3proto_for_family(payload.get("l3proto"), family, normalize_value_fn)
        config["l4proto"] = l4proto
        config["timeout_policy"] = policy
        if l3proto is not None:
            config["l3proto"] = l3proto
    elif kind == "ct_expectation":
        l4proto = (normalize_value_fn(payload.get("l4proto")) or "").lower()
        if l4proto not in ("tcp", "udp"):
            raise ValueError("l4proto must be tcp|udp")
        dport = normalize_value_fn(payload.get("dport"))
        if dport is None or not re.fullmatch(r"[0-9]{1,5}", dport):
            raise ValueError("dport must be integer in range 1..65535")
        if int(dport) < 1 or int(dport) > 65535:
            raise ValueError("dport must be integer in range 1..65535")
        timeout = normalize_timeout_fn(payload.get("timeout"))
        if timeout is None:
            raise ValueError("timeout is required")
        size_raw = normalize_value_fn(payload.get("size"))
        if size_raw is None or not re.fullmatch(r"[0-9]+", size_raw):
            raise ValueError("size must be unsigned integer")
        if int(size_raw) < 1:
            raise ValueError("size must be greater than zero")
        l3proto = _normalize_l3proto_for_family(payload.get("l3proto"), family, normalize_value_fn)
        config["l4proto"] = l4proto
        config["dport"] = int(dport)
        config["timeout"] = timeout
        config["size"] = int(size_raw)
        if l3proto is not None:
            config["l3proto"] = l3proto

    build_id = id_factory or _default_named_object_id_factory
    return {
        "id": str(payload.get("id") or build_id()),
        "kind": kind,
        "family": family,
        "table": table_name,
        "name": name,
        "enabled": enabled,
        "comment": comment,
        "config": config,
    }


def render_named_object_add_statement(item, normalize_value_fn):
    kind = item.get("kind")
    family = item.get("family")
    table_name = item.get("table")
    name = item.get("name")
    config = item.get("config") or {}
    comment = normalize_value_fn(item.get("comment"))
    if kind == "counter":
        body_parts = []
        packets = config.get("packets")
        bytes_count = config.get("bytes")
        if packets is not None or bytes_count is not None:
            packets_value = int(packets or 0)
            bytes_value = int(bytes_count or 0)
            body_parts.append(f"packets {packets_value} bytes {bytes_value};")
        if comment is not None:
            body_parts.append(f'comment "{comment}";')
        body_clause = f' {{ {" ".join(body_parts)} }}' if body_parts else ""
        return f"add counter {family} {table_name} {name}{body_clause}"
    if kind == "limit":
        rate = str(config.get("rate") or "")
        burst = normalize_value_fn(config.get("burst"))
        over = bool(config.get("over", False))
        body_parts = [f'rate {"over " if over else ""}{rate}']
        if burst is not None:
            burst_value = str(burst)
            if re.fullmatch(r"[0-9]+", burst_value):
                burst_value = f"{burst_value} packets"
            body_parts.append(f"burst {burst_value}")
        body = " ".join(body_parts)
        body_parts = [f"{body};"]
        if comment is not None:
            body_parts.append(f'comment "{comment}";')
        return f'add limit {family} {table_name} {name} {{ {" ".join(body_parts)} }}'
    if kind == "quota":
        mode = str(config.get("mode") or "over")
        bytes_value = str(config.get("bytes") or "")
        used = normalize_value_fn(config.get("used"))
        body_parts = [f"{mode} {bytes_value}"]
        if used is not None:
            body_parts.append(f"used {used}")
        body_parts = [f'{" ".join(body_parts)};']
        if comment is not None:
            body_parts.append(f'comment "{comment}";')
        return f'add quota {family} {table_name} {name} {{ {" ".join(body_parts)} }}'
    if kind == "ct_helper":
        helper_type = str(config.get("helper_type") or "")
        l4proto = str(config.get("l4proto") or "")
        l3proto = normalize_value_fn(config.get("l3proto"))
        body_parts = [f'type "{helper_type}" protocol {l4proto};']
        if l3proto is not None:
            body_parts.append(f"l3proto {l3proto};")
        if comment is not None:
            body_parts.append(f'comment "{comment}";')
        return f'add ct helper {family} {table_name} {name} {{ {" ".join(body_parts)} }}'
    if kind == "ct_timeout":
        l4proto = str(config.get("l4proto") or "")
        timeout_policy = str(config.get("timeout_policy") or "")
        l3proto = normalize_value_fn(config.get("l3proto"))
        body_parts = [f"protocol {l4proto};", f"policy = {{ {timeout_policy} }};"]
        if l3proto is not None:
            body_parts.append(f"l3proto {l3proto};")
        if comment is not None:
            body_parts.append(f'comment "{comment}";')
        return f'add ct timeout {family} {table_name} {name} {{ {" ".join(body_parts)} }}'
    if kind == "ct_expectation":
        l4proto = str(config.get("l4proto") or "")
        dport = int(config.get("dport") or 0)
        timeout = str(config.get("timeout") or "")
        size = int(config.get("size") or 0)
        l3proto = normalize_value_fn(config.get("l3proto"))
        body_parts = [
            f"protocol {l4proto};",
            f"dport {dport};",
            f"timeout {timeout};",
            f"size {size};",
        ]
        if l3proto is not None:
            body_parts.append(f"l3proto {l3proto};")
        if comment is not None:
            body_parts.append(f'comment "{comment}";')
        return f'add ct expectation {family} {table_name} {name} {{ {" ".join(body_parts)} }}'
    raise ValueError("unsupported object kind")


def append_enabled_named_object_script_lines(
    script_lines,
    table_family,
    nft_table,
    named_objects_data,
    render_stmt_fn,
):
    for item in named_objects_data.get("objects", []):
        if not isinstance(item, dict):
            continue
        if not bool(item.get("enabled", True)):
            continue
        if str(item.get("family") or "").lower() != table_family:
            continue
        if str(item.get("table") or "").lower() != nft_table:
            continue
        script_lines.append(render_stmt_fn(item))


def ensure_named_object_exists(objects_by_kind, object_kind, object_name, field_name):
    obj = str(object_name or "").strip().lower()
    if not obj:
        return
    names = objects_by_kind.get(object_kind, set())
    if obj not in names:
        pretty = object_kind.replace("_", " ")
        raise ValueError(f'{field_name} references missing {pretty} object "{object_name}" in selected table')


def validate_runtime_named_object_references(
    validate_runtime_objects,
    family,
    nft_table,
    ct_helper_set,
    ct_timeout_set,
    ct_expectation_set,
    counter_name,
    limit_name,
    quota_name,
    load_effective_objects_fn,
    ensure_exists_fn=ensure_named_object_exists,
):
    if not validate_runtime_objects or family == "netdev":
        return

    needs_named_objects = any(
        (
            ct_helper_set is not None,
            ct_timeout_set is not None,
            ct_expectation_set is not None,
            counter_name is not None,
            limit_name is not None,
            quota_name is not None,
        )
    )
    if not needs_named_objects:
        return

    objects_by_kind = load_effective_objects_fn(family, nft_table)
    ensure_exists_fn(objects_by_kind, "ct_helper", ct_helper_set, "ct_helper_set")
    ensure_exists_fn(objects_by_kind, "ct_timeout", ct_timeout_set, "ct_timeout_set")
    ensure_exists_fn(objects_by_kind, "ct_expectation", ct_expectation_set, "ct_expectation_set")
    ensure_exists_fn(objects_by_kind, "counter", counter_name, "counter_name")
    ensure_exists_fn(objects_by_kind, "limit", limit_name, "limit_name")
    ensure_exists_fn(objects_by_kind, "quota", quota_name, "quota_name")


def list_named_objects(
    family,
    table,
    parse_query_fn,
    read_objects_fn,
    supported_kinds,
    collect_table_defs_fn,
    load_effective_objects_fn,
):
    normalized_family, normalized_table = parse_query_fn(family, table)
    declared_items = store.filter_declared_named_objects(
        read_objects_fn().get("objects", []),
        normalized_family,
        normalized_table,
        supported_kinds,
    )
    table_defs = collect_table_defs_fn()
    if (normalized_family, normalized_table) not in table_defs:
        return store.build_named_objects_listing(
            normalized_family,
            normalized_table,
            declared_items,
            table_is_active=False,
        )
    objects_by_kind = load_effective_objects_fn(normalized_family, normalized_table)
    return store.build_named_objects_listing(
        normalized_family,
        normalized_table,
        declared_items,
        objects_by_kind=objects_by_kind,
        table_is_active=True,
    )


def _find_refs(list_rules_fn, family, table_name, kind, name, normalize_value_fn):
    return store.find_named_object_references(
        list_rules_fn(),
        family,
        table_name,
        kind,
        name,
        normalize_value_fn,
    )


def upsert_named_object(
    payload,
    apply_now,
    read_objects_fn,
    write_objects_fn,
    normalize_item_fn,
    apply_rules_fn,
    list_rules_fn,
    normalize_value_fn,
):
    objects_data = read_objects_fn()
    previous_objects = [dict(row) for row in objects_data.get("objects", [])]
    item = normalize_item_fn(payload or {})
    previous_row = store.find_named_object_by_id(objects_data.get("objects", []), item["id"])
    if previous_row is not None:
        previous_refs = _find_refs(
            list_rules_fn,
            previous_row.get("family"),
            previous_row.get("table"),
            previous_row.get("kind"),
            previous_row.get("name"),
            normalize_value_fn,
        )
        changed_identity = any(
            (
                str(previous_row.get("family") or "").lower() != str(item.get("family") or "").lower(),
                str(previous_row.get("table") or "").lower() != str(item.get("table") or "").lower(),
                str(previous_row.get("kind") or "").lower() != str(item.get("kind") or "").lower(),
                str(previous_row.get("name") or "").lower() != str(item.get("name") or "").lower(),
            )
        )
        disabling = bool(previous_row.get("enabled", True)) and not bool(item.get("enabled", True))
        if previous_refs and (changed_identity or disabling):
            raise ValueError(f"object is in use by {len(previous_refs)} firewall rule(s)")

    out = store.upsert_named_object_rows(objects_data.get("objects", []), item)
    store.ensure_unique_named_object_signatures(out)
    objects_data["objects"] = out
    write_objects_fn(objects_data)
    try:
        if apply_now:
            apply_rules_fn()
    except Exception:
        write_objects_fn({"objects": previous_objects})
        raise
    return item


def create_named_object(
    payload,
    apply_now,
    read_objects_fn,
    normalize_value_fn,
    upsert_named_object_fn,
):
    body = dict(payload or {})
    requested_id = normalize_value_fn(body.get("id"))
    objects_data = read_objects_fn()
    if requested_id is not None:
        if store.find_named_object_by_id(objects_data.get("objects", []), requested_id) is not None:
            raise ValueError("object id already exists")
    return upsert_named_object_fn(body, apply_now=apply_now)


def update_named_object(
    object_id,
    payload,
    apply_now,
    read_objects_fn,
    upsert_named_object_fn,
):
    target_id = str(object_id)
    objects_data = read_objects_fn()
    existing = store.find_named_object_by_id(objects_data.get("objects", []), target_id)
    if existing is None:
        raise LookupError("object not found")
    body = dict(existing)
    body.update(payload or {})
    body["id"] = target_id
    return upsert_named_object_fn(body, apply_now=apply_now)


def delete_named_object(
    object_id,
    apply_now,
    read_objects_fn,
    write_objects_fn,
    apply_rules_fn,
    list_rules_fn,
    normalize_value_fn,
):
    objects_data = read_objects_fn()
    previous_objects = [dict(row) for row in objects_data.get("objects", [])]
    next_objects, existing = store.delete_named_object_row(
        objects_data.get("objects", []),
        object_id,
        "object not found",
    )
    refs = _find_refs(
        list_rules_fn,
        existing.get("family"),
        existing.get("table"),
        existing.get("kind"),
        existing.get("name"),
        normalize_value_fn,
    )
    if refs:
        raise ValueError(f"object is in use by {len(refs)} firewall rule(s)")
    objects_data["objects"] = next_objects
    write_objects_fn(objects_data)
    try:
        if apply_now:
            apply_rules_fn()
    except Exception:
        write_objects_fn({"objects": previous_objects})
        raise
    return existing
