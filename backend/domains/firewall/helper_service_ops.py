#!/usr/bin/python3
import functools
import re

from . import collection_ops
from . import named_object_ops
from . import rule_ops
from . import store


def _render_named_object_add_statement(item, *, normalize_value_fn):
    return named_object_ops.render_named_object_add_statement(
        item,
        normalize_value_fn=normalize_value_fn,
    )


def normalize_nft_timeout(value, *, normalize_value_fn):
    timeout = normalize_value_fn(value)
    if timeout is None:
        return None
    raw = str(timeout).strip().lower()
    compact = re.sub(r"\s+", "", raw)
    if compact in ("inf", "infinite", "infinity", "perm", "permanent", "never"):
        raise ValueError("timeout must be finite")

    mk_match = re.fullmatch(r"(?:(\d+)d\s+)?(\d{1,2}):([0-5]\d):([0-5]\d)", raw)
    if mk_match:
        days = int(mk_match.group(1) or 0)
        hours = int(mk_match.group(2))
        minutes = int(mk_match.group(3))
        seconds = int(mk_match.group(4))
        if hours > 23:
            raise ValueError('timeout hour must be 0..23 in "Xd HH:MM:SS" format')
        total_seconds = (days * 86400) + (hours * 3600) + (minutes * 60) + seconds
        if total_seconds <= 0:
            raise ValueError("timeout must be greater than zero")
        return f"{total_seconds}s"

    if re.fullmatch(r"\d+", raw):
        total_seconds = int(raw)
        if total_seconds <= 0:
            raise ValueError("timeout must be greater than zero")
        return f"{total_seconds}s"

    parts = re.findall(r"([1-9]\d*)(ms|s|m|h|d|w)", compact)
    if not parts or "".join(f"{num}{unit}" for num, unit in parts) != compact:
        raise ValueError('timeout is invalid; use "10m", "2h30m", or "1d 15:00:00"')
    total_ms = 0
    for raw_num, unit in parts:
        number = int(raw_num)
        if unit == "ms":
            total_ms += number
        elif unit == "s":
            total_ms += number * 1000
        elif unit == "m":
            total_ms += number * 60 * 1000
        elif unit == "h":
            total_ms += number * 3600 * 1000
        elif unit == "d":
            total_ms += number * 86400 * 1000
        elif unit == "w":
            total_ms += number * 7 * 86400 * 1000
    if total_ms <= 0:
        raise ValueError("timeout must be greater than zero")
    return f"{max(1, (total_ms + 999) // 1000)}s"


def timeout_to_seconds(value, *, normalize_value_fn, normalize_nft_timeout_fn):
    timeout = normalize_value_fn(value)
    if timeout is None:
        return None
    try:
        normalized = normalize_nft_timeout_fn(timeout)
    except ValueError:
        return None
    match = re.fullmatch(r"([1-9][0-9]*)s", normalized)
    if not match:
        return None
    return int(match.group(1))


def enrich_collection_item_runtime(item, *, now_ts, timeout_to_seconds_fn):
    return store.enrich_collection_item_runtime(item, timeout_to_seconds_fn, int(now_ts))


def cleanup_expired_collection_rows(rows, now_ts, *, timeout_to_seconds_fn):
    return store.cleanup_expired_collection_rows(rows, now_ts, timeout_to_seconds_fn)


def set_runtime_signature(item, *, normalize_value_fn):
    return store.set_runtime_signature(item, normalize_value_fn)


def map_runtime_signature(item, *, normalize_value_fn):
    return store.map_runtime_signature(item, normalize_value_fn)


def normalize_logical_bool(value):
    if isinstance(value, bool):
        return value
    return str(value).lower() in ("1", "true", "yes", "on")


def empty_named_objects_by_kind(named_object_kinds):
    return {kind: set() for kind in named_object_kinds}


def load_effective_table_objects_by_kind(
    family,
    table_name,
    *,
    named_object_kinds,
    read_objects_fn,
    list_runtime_objects_fn,
    normalize_value_fn,
):
    runtime_objects = list_runtime_objects_fn(family, table_name)
    out = empty_named_objects_by_kind(named_object_kinds)
    rows = read_objects_fn().get("objects", [])
    normalized_family = str(family).lower()
    normalized_table = str(table_name).lower()
    for row in rows:
        row_family = str(row.get("family") or "").lower()
        row_table = str(row.get("table") or "").lower()
        row_kind = str(row.get("kind") or "").lower()
        row_name = normalize_value_fn(row.get("name"))
        if row_family != normalized_family or row_table != normalized_table:
            continue
        if row_kind not in out:
            continue
        if not bool(row.get("enabled", True)):
            continue
        if row_name is None:
            continue
        out[row_kind].add(str(row_name).lower())
    for kind in named_object_kinds:
        out[kind] = set(runtime_objects.get(kind, set())) | set(out.get(kind, set()))
    return out


def validate_named_object_table_exists(family, table_name, *, collect_table_defs_fn):
    table_defs = collect_table_defs_fn()
    if (str(family).lower(), str(table_name).lower()) not in table_defs:
        raise ValueError(f'table "{table_name}" is not active for family "{family}"')


def collect_table_defs(
    *,
    default_table_defs,
    read_tables_fn,
    normalize_value_fn,
    supported_families,
    default_family,
):
    custom_tables = read_tables_fn().get("tables", [])
    return store.collect_table_defs(
        default_table_defs=default_table_defs,
        custom_tables=custom_tables,
        normalize_value_fn=normalize_value_fn,
        supported_families=supported_families,
        default_family=default_family,
    )


def append_table_script_lines(
    script_lines,
    table_family,
    nft_table,
    table_defs,
    sets_data,
    maps_data,
    rules,
    named_objects_data,
    table_prefix,
    default_family,
    normalize_value_fn,
    render_rule_fn,
    include_runtime_objects=True,
):
    table_name = f"{table_prefix}{nft_table}"
    script_lines.append(f"add table {table_family} {table_name}")
    for chain_info in table_defs.get((table_family, nft_table), []):
        if len(chain_info) == 4:
            chain_name, chain_type, hook_name, priority = chain_info
            device = None
            policy = "accept"
        else:
            chain_name, chain_type, hook_name, priority, device, policy = chain_info
        dev_clause = f' device "{device}"' if device else ""
        script_lines.append(
            f"add chain {table_family} {table_name} {chain_name} "
            f"{{ type {chain_type} hook {hook_name}{dev_clause} priority {priority}; policy {policy}; }}"
        )
    if include_runtime_objects:
        collection_ops.append_runtime_collection_script_lines(
            script_lines=script_lines,
            table_family=table_family,
            table_name=table_name,
            sets_data=sets_data,
            maps_data=maps_data,
            normalize_value_fn=normalize_value_fn,
        )
    named_object_ops.append_enabled_named_object_script_lines(
        script_lines=script_lines,
        table_family=table_family,
        nft_table=nft_table,
        named_objects_data=named_objects_data,
        render_stmt_fn=functools.partial(
            _render_named_object_add_statement,
            normalize_value_fn=normalize_value_fn,
        ),
    )
    rule_ops.append_enabled_rule_script_lines(
        script_lines=script_lines,
        table_family=table_family,
        nft_table=nft_table,
        table_name=table_name,
        rules=rules,
        default_family=default_family,
        render_rule_fn=render_rule_fn,
    )
