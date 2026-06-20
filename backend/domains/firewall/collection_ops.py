#!/usr/bin/python3
import ipaddress
import re
import time

from . import store


def infer_map_token_type(token):
    t = str(token or "").strip()
    if not t:
        return "ifname"
    if t.lower() in ("tcp", "udp", "udplite", "icmp", "icmpv6", "sctp", "dccp"):
        return "inet_proto"
    if t.lower() in ("established", "related", "new", "invalid", "untracked"):
        return "ct_state"
    if t.lower() in (
        "echo-reply",
        "destination-unreachable",
        "source-quench",
        "redirect",
        "echo-request",
        "router-advertisement",
        "router-solicitation",
        "time-exceeded",
        "parameter-problem",
        "timestamp-request",
        "timestamp-reply",
        "address-mask-request",
        "address-mask-reply",
    ):
        return "icmp_type"
    if t.lower() in ("accept", "drop", "queue", "continue", "return"):
        return "verdict"
    try:
        ipaddress.ip_address(t)
        return "ipv4_addr" if "." in t else "ipv6_addr"
    except Exception:
        pass
    try:
        ipaddress.ip_network(t, strict=False)
        return "ipv4_addr" if "." in t else "ipv6_addr"
    except Exception:
        pass
    if re.fullmatch(r"\d{1,5}", t):
        return "inet_service"
    if re.fullmatch(r"0x[0-9a-fA-F]+|\d+", t):
        return "mark"
    return "ifname"


def format_map_token(token, token_type):
    t = str(token or "").strip()
    if token_type == "ifname":
        return f'"{t}"'
    return t


def build_map_declaration_and_elements(item, normalize_value_fn):
    entries = [x for x in (item.get("entries") or []) if x and ":" in str(x)]
    if not entries:
        return None
    pairs = []
    for entry in entries:
        key, value = str(entry).split(":", 1)
        key = key.strip()
        value = value.strip()
        if not key or not value:
            continue
        pairs.append((key, value))
    if not pairs:
        return None
    key_type = infer_map_token_type(pairs[0][0])
    value_type = "verdict" if item.get("kind") == "vmap" else infer_map_token_type(pairs[0][1])
    has_prefix = any("/" in key for key, _ in pairs)
    flags = []
    if has_prefix and key_type in ("ipv4_addr", "ipv6_addr"):
        flags.append("interval")
    timeout = normalize_value_fn(item.get("timeout"))
    if timeout:
        flags.append("timeout")
    flags_clause = f' flags {",".join(flags)};' if flags else ""
    timeout_clause = f" timeout {timeout};" if timeout else ""
    decl_stmt = f"type {key_type} : {value_type};{flags_clause}{timeout_clause}"
    elems = []
    for key, value in pairs:
        elems.append(f"{format_map_token(key, key_type)} : {format_map_token(value, value_type)}")
    return decl_stmt, elems


def append_runtime_collection_script_lines(
    script_lines,
    table_family,
    table_name,
    sets_data,
    maps_data,
    normalize_value_fn,
):
    def _build_set_options(item, base_flags):
        flags = list(base_flags)
        if item.get("dynamic"):
            flags.append("dynamic")
        timeout = normalize_value_fn(item.get("timeout"))
        if timeout:
            flags.append("timeout")
        flags = list(dict.fromkeys(flags))
        flags_clause = f' flags {",".join(flags)};' if flags else ""
        timeout_clause = f" timeout {timeout};" if timeout else ""
        gc_interval = normalize_value_fn(item.get("gc_interval"))
        gc_clause = f" gc-interval {gc_interval};" if gc_interval else ""
        size = normalize_value_fn(item.get("size"))
        size_clause = f" size {size};" if size else ""
        return flags_clause, timeout_clause, gc_clause, size_clause

    for item in sets_data.get("addr", []):
        if item.get("name") and item.get("enabled", True):
            elems = [x for x in (item.get("elements") or []) if x]
            flags = []
            if any("/" in str(x) for x in elems):
                flags.append("interval")
            flags_clause, timeout_clause, gc_clause, size_clause = _build_set_options(item, flags)
            script_lines.append(
                f'add set {table_family} {table_name} {item["name"]} {{ type ipv4_addr;{flags_clause}{timeout_clause}{gc_clause}{size_clause} }}'
            )
            if elems:
                script_lines.append(f'add element {table_family} {table_name} {item["name"]} {{ {", ".join(elems)} }}')
    for item in sets_data.get("port", []):
        if item.get("name") and item.get("enabled", True):
            flags_clause, timeout_clause, gc_clause, size_clause = _build_set_options(item, [])
            script_lines.append(
                f'add set {table_family} {table_name} {item["name"]} {{ type inet_service;{flags_clause}{timeout_clause}{gc_clause}{size_clause} }}'
            )
            elems = [x for x in (item.get("elements") or []) if x]
            if elems:
                script_lines.append(f'add element {table_family} {table_name} {item["name"]} {{ {", ".join(elems)} }}')
    for item in sets_data.get("iface", []):
        if item.get("name") and item.get("enabled", True):
            flags_clause, timeout_clause, gc_clause, size_clause = _build_set_options(item, [])
            script_lines.append(
                f'add set {table_family} {table_name} {item["name"]} {{ type ifname;{flags_clause}{timeout_clause}{gc_clause}{size_clause} }}'
            )
            elems = [f'"{x}"' for x in (item.get("elements") or []) if x]
            if elems:
                script_lines.append(f'add element {table_family} {table_name} {item["name"]} {{ {", ".join(elems)} }}')
    for item in maps_data.get("map", []):
        if item.get("name") and item.get("enabled", True):
            built = build_map_declaration_and_elements(item, normalize_value_fn)
            if not built:
                continue
            decl_stmt, elems = built
            script_lines.append(f'add map {table_family} {table_name} {item["name"]} {{ {decl_stmt} }}')
            script_lines.append(f'add element {table_family} {table_name} {item["name"]} {{ {", ".join(elems)} }}')
    for item in maps_data.get("vmap", []):
        if item.get("name") and item.get("enabled", True):
            built = build_map_declaration_and_elements(item, normalize_value_fn)
            if not built:
                continue
            decl_stmt, elems = built
            script_lines.append(f'add map {table_family} {table_name} {item["name"]} {{ {decl_stmt} }}')
            script_lines.append(f'add element {table_family} {table_name} {item["name"]} {{ {", ".join(elems)} }}')


def list_collections(
    kinds,
    read_fn,
    write_fn,
    cleanup_expired_fn,
    enrich_item_fn,
    apply_rules_fn,
):
    data = read_fn()
    previous_data = {kind: [dict(row) for row in data.get(kind, [])] for kind in kinds}
    changed = False
    removed_active = 0
    now_ts = int(time.time())
    response = {kind: [] for kind in kinds}
    for kind in kinds:
        normalized_rows, response_rows, kind_changed, kind_removed_active = store.prepare_collection_kind_rows(
            data.get(kind, []),
            now_ts,
            cleanup_expired_fn,
            enrich_item_fn,
        )
        if kind_changed:
            changed = True
        removed_active += int(kind_removed_active)
        data[kind] = normalized_rows
        response[kind] = response_rows
    if changed:
        write_fn(data)
        try:
            if removed_active > 0:
                apply_rules_fn()
        except Exception:
            for kind, rows in previous_data.items():
                data[kind] = rows
            write_fn(data)
            raise
    return response


def upsert_collection(
    kind,
    payload,
    allowed_kinds,
    invalid_kind_error,
    read_fn,
    write_fn,
    normalize_item_fn,
    runtime_signature_fn,
    normalize_value_fn,
    other_names,
    duplicate_error,
    global_error,
    enrich_item_fn,
    apply_rules_fn,
):
    if kind not in tuple(allowed_kinds):
        raise ValueError(str(invalid_kind_error))
    data = read_fn()
    previous_rows = [dict(row) for row in data.get(kind, [])]
    item = normalize_item_fn(payload, kind)
    now_ts = int(time.time())
    out, item, runtime_changed = store.upsert_collection_rows(
        data.get(kind, []),
        item,
        now_ts,
        runtime_signature_fn,
        normalize_value_fn,
    )
    store.ensure_unique_collection_names(
        out,
        item["name"],
        list(other_names(data)),
        duplicate_error,
        global_error,
    )
    data[kind] = out
    write_fn(data)
    try:
        if runtime_changed:
            apply_rules_fn()
    except Exception:
        data[kind] = previous_rows
        write_fn(data)
        raise
    return enrich_item_fn(item)


def delete_collection(
    kind,
    item_id,
    allowed_kinds,
    invalid_kind_error,
    read_fn,
    write_fn,
    not_found_error,
    apply_rules_fn,
):
    if kind not in tuple(allowed_kinds):
        raise ValueError(str(invalid_kind_error))
    data = read_fn()
    previous_rows = [dict(row) for row in data.get(kind, [])]
    out, existing, runtime_changed = store.delete_collection_row(
        data.get(kind, []),
        item_id,
        not_found_error,
    )
    data[kind] = out
    write_fn(data)
    try:
        if runtime_changed:
            apply_rules_fn()
    except Exception:
        data[kind] = previous_rows
        write_fn(data)
        raise
    return existing
