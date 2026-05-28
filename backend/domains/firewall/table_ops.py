#!/usr/bin/python3
from . import store


def list_tables(read_tables_fn, default_table_defs, default_family):
    data = read_tables_fn()
    return store.build_tables_listing(
        default_table_defs,
        data.get("tables", []),
        default_family,
    )


def upsert_table(
    payload,
    read_tables_fn,
    write_tables_fn,
    normalize_item_fn,
    apply_rules_fn,
    default_family,
    default_table_defs,
):
    data = read_tables_fn()
    item = normalize_item_fn(payload)
    if item["family"] == default_family and item["table_name"] in (default_table_defs or {}):
        raise ValueError("built-in table names are reserved")
    out = store.upsert_table_rows(data.get("tables", []), item)
    store.ensure_unique_table_signatures(out, default_family)
    data["tables"] = out
    write_tables_fn(data)
    apply_rules_fn()
    return item


def delete_table(
    table_id,
    read_tables_fn,
    write_tables_fn,
    read_objects_fn,
    write_objects_fn,
    apply_rules_fn,
    default_family,
):
    data = read_tables_fn()
    next_tables, existing = store.delete_table_row(data.get("tables", []), table_id, "table not found")
    data["tables"] = next_tables
    write_tables_fn(data)

    objects_data = read_objects_fn()
    existing_family = str(existing.get("family") or default_family).lower()
    existing_table = str(existing.get("table_name") or "").lower()
    next_objects, changed = store.remove_objects_for_table(
        objects_data.get("objects", []),
        existing_family,
        existing_table,
    )
    if changed:
        objects_data["objects"] = next_objects
        write_objects_fn(objects_data)

    apply_rules_fn()
    return existing
