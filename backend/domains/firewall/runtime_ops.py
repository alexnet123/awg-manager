#!/usr/bin/python3


def apply_rules(
    list_rules_fn,
    read_sets_fn,
    read_maps_fn,
    read_objects_fn,
    collect_table_defs_fn,
    read_managed_tables_fn,
    parse_managed_table_key_fn,
    list_runtime_tables_fn,
    delete_table_fn,
    append_table_script_lines_fn,
    apply_script_fn,
    managed_table_key_fn,
    write_managed_tables_fn,
    table_prefix,
    default_family,
):
    rules = list_rules_fn()
    sets_data = read_sets_fn()
    maps_data = read_maps_fn()
    named_objects_data = read_objects_fn()
    table_defs = collect_table_defs_fn()
    active_table_refs = set(table_defs.keys())
    managed_keys = read_managed_tables_fn().get("tables", [])
    managed_refs = set()
    for key in managed_keys:
        parsed = parse_managed_table_key_fn(key)
        if parsed is not None:
            managed_refs.add(parsed)
    stale_managed = [t for t in managed_refs if t not in active_table_refs]
    for stale_family, stale_table in stale_managed:
        delete_table_fn(stale_family, stale_table)
    runtime_tables = list_runtime_tables_fn()
    for runtime_ref in runtime_tables:
        if runtime_ref in managed_refs and runtime_ref not in active_table_refs:
            runtime_family, runtime_name = runtime_ref
            delete_table_fn(runtime_family, runtime_name)
    script_lines = []
    for table_family, nft_table in table_defs.keys():
        table_name = f"{table_prefix}{nft_table}"
        delete_table_fn(table_family, table_name)
        append_table_script_lines_fn(
            script_lines,
            table_family,
            nft_table,
            table_defs,
            sets_data,
            maps_data,
            rules,
            named_objects_data,
            include_runtime_objects=(table_family == default_family),
        )
    script_text = "\n".join(script_lines) + "\n"
    apply_script_fn(script_text)
    managed_serialized = sorted(managed_table_key_fn(fam, name) for fam, name in active_table_refs)
    write_managed_tables_fn({"tables": managed_serialized})
    return True


def reset_counters(
    table,
    read_tables_fn,
    normalize_value_fn,
    default_family,
    default_tables,
    list_rules_fn,
    read_sets_fn,
    read_maps_fn,
    read_objects_fn,
    collect_table_defs_fn,
    reset_named_counters_fn,
    reset_named_quotas_fn,
    read_stats_fn,
    write_stats_fn,
    apply_rules_fn,
    delete_table_fn,
    append_table_script_lines_fn,
    apply_script_fn,
    table_prefix,
):
    tables = list(default_tables or ())
    custom_rows = read_tables_fn().get("tables", [])
    for row in custom_rows:
        if not isinstance(row, dict):
            continue
        if str((row.get("family") or default_family)).lower() != default_family:
            continue
        tname = normalize_value_fn(row.get("table_name"))
        if tname:
            low = str(tname).lower()
            if low not in tables:
                tables.append(low)

    if table is None:
        target_tables = tuple(tables)
    else:
        nft_table = normalize_value_fn(table)
        if nft_table is None:
            raise ValueError("table is empty")
        nft_table = nft_table.lower()
        if nft_table not in set(tables):
            raise ValueError("table must be one of built-in or existing custom tables")
        target_tables = (nft_table,)

    reset_count = 0
    target_table_set = set(target_tables)
    rules = list_rules_fn()
    sets_data = read_sets_fn()
    maps_data = read_maps_fn()
    named_objects_data = read_objects_fn()
    table_defs = collect_table_defs_fn()
    runtime_reset_supported = False

    for nft_table in target_tables:
        table_name = f"{table_prefix}{nft_table}"
        table_reset_ok = False
        if reset_named_counters_fn(default_family, table_name):
            table_reset_ok = True
            runtime_reset_supported = True
        if reset_named_quotas_fn(default_family, table_name):
            table_reset_ok = True
            runtime_reset_supported = True
        if table_reset_ok:
            reset_count += 1

    stats_store = read_stats_fn()
    target_ids = {
        str(rule.get("id"))
        for rule in rules
        if str(rule.get("table") or "").lower() in target_table_set and rule.get("id")
    }
    for rule_id in target_ids:
        stats_store.pop(rule_id, None)
    write_stats_fn(stats_store)

    if table is None:
        apply_rules_fn()
    else:
        nft_table = next(iter(target_table_set))
        key = (default_family, nft_table)
        if key in table_defs:
            table_name = f"{table_prefix}{nft_table}"
            delete_table_fn(default_family, table_name)
            script_lines = []
            append_table_script_lines_fn(
                script_lines,
                default_family,
                nft_table,
                table_defs,
                sets_data,
                maps_data,
                rules,
                named_objects_data,
                include_runtime_objects=True,
            )
            script_text = "\n".join(script_lines) + "\n"
            apply_script_fn(script_text)
        else:
            apply_rules_fn()

    return {
        "ok": True,
        "tables_reset": reset_count,
        "rules_stats_reset": len(target_ids),
        "runtime_reapplied": True,
        "named_reset_supported": runtime_reset_supported,
    }
