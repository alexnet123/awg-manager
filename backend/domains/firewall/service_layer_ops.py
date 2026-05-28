#!/usr/bin/python3
import functools

from . import collection_ops
from . import named_object_ops
from . import rule_ops
from . import runtime_ops
from . import schema_ops
from . import state_ops
from . import table_ops


def _iter_other_set_names(data, *, set_kind):
    for kind in ("addr", "port", "iface"):
        if kind == set_kind:
            continue
        for row in data.get(kind, []):
            yield str(row.get("name") or "")


def _iter_other_map_names(data, *, map_kind):
    other_kind = "vmap" if map_kind == "map" else "map"
    for row in data.get(other_kind, []):
        yield str(row.get("name") or "")


def list_rules(*, family, table, read_rules_fn, normalize_rule_fn, normalize_value_fn):
    return rule_ops.list_rules(
        family=family,
        table=table,
        read_rules_fn=read_rules_fn,
        normalize_rule_fn=normalize_rule_fn,
        normalize_value_fn=normalize_value_fn,
    )


def apply_rules(
    *,
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
    return runtime_ops.apply_rules(
        list_rules_fn=list_rules_fn,
        read_sets_fn=read_sets_fn,
        read_maps_fn=read_maps_fn,
        read_objects_fn=read_objects_fn,
        collect_table_defs_fn=collect_table_defs_fn,
        read_managed_tables_fn=read_managed_tables_fn,
        parse_managed_table_key_fn=parse_managed_table_key_fn,
        list_runtime_tables_fn=list_runtime_tables_fn,
        delete_table_fn=delete_table_fn,
        append_table_script_lines_fn=append_table_script_lines_fn,
        apply_script_fn=apply_script_fn,
        managed_table_key_fn=managed_table_key_fn,
        write_managed_tables_fn=write_managed_tables_fn,
        table_prefix=table_prefix,
        default_family=default_family,
    )


def create_rule(*, payload, apply_now, list_rules_fn, normalize_rule_fn, write_rules_fn, apply_rules_fn):
    return rule_ops.create_rule(
        payload=payload,
        apply_now=apply_now,
        list_rules_fn=list_rules_fn,
        normalize_rule_fn=normalize_rule_fn,
        write_rules_fn=write_rules_fn,
        apply_rules_fn=apply_rules_fn,
    )


def update_rule(*, rule_id, payload, apply_now, list_rules_fn, normalize_rule_fn, write_rules_fn, apply_rules_fn):
    return rule_ops.update_rule(
        rule_id=rule_id,
        payload=payload,
        apply_now=apply_now,
        list_rules_fn=list_rules_fn,
        normalize_rule_fn=normalize_rule_fn,
        write_rules_fn=write_rules_fn,
        apply_rules_fn=apply_rules_fn,
    )


def delete_rule(*, rule_id, apply_now, list_rules_fn, write_rules_fn, apply_rules_fn):
    return rule_ops.delete_rule(
        rule_id=rule_id,
        apply_now=apply_now,
        list_rules_fn=list_rules_fn,
        write_rules_fn=write_rules_fn,
        apply_rules_fn=apply_rules_fn,
    )


def reorder_rules(
    *,
    table,
    ordered_ids,
    apply_now,
    list_rules_fn,
    read_tables_fn,
    normalize_value_fn,
    default_family,
    default_tables,
    write_rules_fn,
    apply_rules_fn,
):
    return rule_ops.reorder_rules(
        table=table,
        ordered_ids=ordered_ids,
        apply_now=apply_now,
        list_rules_fn=list_rules_fn,
        read_tables_fn=read_tables_fn,
        normalize_value_fn=normalize_value_fn,
        default_family=default_family,
        default_tables=default_tables,
        write_rules_fn=write_rules_fn,
        apply_rules_fn=apply_rules_fn,
    )


def reset_counters(
    *,
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
    return runtime_ops.reset_counters(
        table=table,
        read_tables_fn=read_tables_fn,
        normalize_value_fn=normalize_value_fn,
        default_family=default_family,
        default_tables=default_tables,
        list_rules_fn=list_rules_fn,
        read_sets_fn=read_sets_fn,
        read_maps_fn=read_maps_fn,
        read_objects_fn=read_objects_fn,
        collect_table_defs_fn=collect_table_defs_fn,
        reset_named_counters_fn=reset_named_counters_fn,
        reset_named_quotas_fn=reset_named_quotas_fn,
        read_stats_fn=read_stats_fn,
        write_stats_fn=write_stats_fn,
        apply_rules_fn=apply_rules_fn,
        delete_table_fn=delete_table_fn,
        append_table_script_lines_fn=append_table_script_lines_fn,
        apply_script_fn=apply_script_fn,
        table_prefix=table_prefix,
    )


def get_state(
    *,
    list_rules_fn,
    get_ruleset_text_fn,
    get_ruleset_counter_index_fn,
    build_runtime_counters_by_rule_fn,
    default_family,
    table_prefix,
    read_stats_fn,
    enrich_rules_with_runtime_stats_fn,
    now_ts_fn,
    write_stats_fn,
):
    return state_ops.get_state(
        list_rules_fn=list_rules_fn,
        get_ruleset_text_fn=get_ruleset_text_fn,
        get_ruleset_counter_index_fn=get_ruleset_counter_index_fn,
        build_runtime_counters_by_rule_fn=build_runtime_counters_by_rule_fn,
        default_family=default_family,
        table_prefix=table_prefix,
        read_stats_fn=read_stats_fn,
        enrich_rules_with_runtime_stats_fn=enrich_rules_with_runtime_stats_fn,
        now_ts_fn=now_ts_fn,
        write_stats_fn=write_stats_fn,
    )


def list_sets(*, read_fn, write_fn, cleanup_expired_fn, enrich_item_fn, apply_rules_fn):
    return collection_ops.list_collections(
        kinds=("addr", "port", "iface"),
        read_fn=read_fn,
        write_fn=write_fn,
        cleanup_expired_fn=cleanup_expired_fn,
        enrich_item_fn=enrich_item_fn,
        apply_rules_fn=apply_rules_fn,
    )


def upsert_set(
    set_kind,
    payload,
    *,
    read_fn,
    write_fn,
    normalize_item_fn,
    runtime_signature_fn,
    normalize_value_fn,
    enrich_item_fn,
    apply_rules_fn,
):
    return collection_ops.upsert_collection(
        kind=set_kind,
        payload=payload,
        allowed_kinds=("addr", "port", "iface"),
        invalid_kind_error="set kind must be addr|port|iface",
        read_fn=read_fn,
        write_fn=write_fn,
        normalize_item_fn=normalize_item_fn,
        runtime_signature_fn=runtime_signature_fn,
        normalize_value_fn=normalize_value_fn,
        other_names=functools.partial(_iter_other_set_names, set_kind=set_kind),
        duplicate_error="set names must be unique within tab",
        global_error="set name must be globally unique across addr/port/iface",
        enrich_item_fn=enrich_item_fn,
        apply_rules_fn=apply_rules_fn,
    )


def delete_set(set_kind, set_id, *, read_fn, write_fn, apply_rules_fn):
    return collection_ops.delete_collection(
        kind=set_kind,
        item_id=set_id,
        allowed_kinds=("addr", "port", "iface"),
        invalid_kind_error="set kind must be addr|port|iface",
        read_fn=read_fn,
        write_fn=write_fn,
        not_found_error="set not found",
        apply_rules_fn=apply_rules_fn,
    )


def list_maps(*, read_fn, write_fn, cleanup_expired_fn, enrich_item_fn, apply_rules_fn):
    return collection_ops.list_collections(
        kinds=("map", "vmap"),
        read_fn=read_fn,
        write_fn=write_fn,
        cleanup_expired_fn=cleanup_expired_fn,
        enrich_item_fn=enrich_item_fn,
        apply_rules_fn=apply_rules_fn,
    )


def upsert_map(
    map_kind,
    payload,
    *,
    read_fn,
    write_fn,
    normalize_item_fn,
    runtime_signature_fn,
    normalize_value_fn,
    enrich_item_fn,
    apply_rules_fn,
):
    return collection_ops.upsert_collection(
        kind=map_kind,
        payload=payload,
        allowed_kinds=("map", "vmap"),
        invalid_kind_error="map kind must be map|vmap",
        read_fn=read_fn,
        write_fn=write_fn,
        normalize_item_fn=normalize_item_fn,
        runtime_signature_fn=runtime_signature_fn,
        normalize_value_fn=normalize_value_fn,
        other_names=functools.partial(_iter_other_map_names, map_kind=map_kind),
        duplicate_error="map names must be unique within tab",
        global_error="map name must be globally unique across map/vmap",
        enrich_item_fn=enrich_item_fn,
        apply_rules_fn=apply_rules_fn,
    )


def delete_map(map_kind, map_id, *, read_fn, write_fn, apply_rules_fn):
    return collection_ops.delete_collection(
        kind=map_kind,
        item_id=map_id,
        allowed_kinds=("map", "vmap"),
        invalid_kind_error="map kind must be map|vmap",
        read_fn=read_fn,
        write_fn=write_fn,
        not_found_error="map not found",
        apply_rules_fn=apply_rules_fn,
    )


def list_tables(*, read_tables_fn, default_table_defs, default_family):
    return table_ops.list_tables(
        read_tables_fn=read_tables_fn,
        default_table_defs=default_table_defs,
        default_family=default_family,
    )


def list_named_objects(
    *,
    family,
    table,
    parse_query_fn,
    read_objects_fn,
    supported_kinds,
    collect_table_defs_fn,
    load_effective_objects_fn,
):
    return named_object_ops.list_named_objects(
        family=family,
        table=table,
        parse_query_fn=parse_query_fn,
        read_objects_fn=read_objects_fn,
        supported_kinds=supported_kinds,
        collect_table_defs_fn=collect_table_defs_fn,
        load_effective_objects_fn=load_effective_objects_fn,
    )


def upsert_named_object(
    payload,
    *,
    apply_now,
    read_objects_fn,
    write_objects_fn,
    normalize_item_fn,
    apply_rules_fn,
    list_rules_fn,
    normalize_value_fn,
):
    return named_object_ops.upsert_named_object(
        payload=payload,
        apply_now=apply_now,
        read_objects_fn=read_objects_fn,
        write_objects_fn=write_objects_fn,
        normalize_item_fn=normalize_item_fn,
        apply_rules_fn=apply_rules_fn,
        list_rules_fn=list_rules_fn,
        normalize_value_fn=normalize_value_fn,
    )


def create_named_object(*, payload, apply_now, read_objects_fn, normalize_value_fn, upsert_named_object_fn):
    return named_object_ops.create_named_object(
        payload=payload,
        apply_now=apply_now,
        read_objects_fn=read_objects_fn,
        normalize_value_fn=normalize_value_fn,
        upsert_named_object_fn=upsert_named_object_fn,
    )


def update_named_object(*, object_id, payload, apply_now, read_objects_fn, upsert_named_object_fn):
    return named_object_ops.update_named_object(
        object_id=object_id,
        payload=payload,
        apply_now=apply_now,
        read_objects_fn=read_objects_fn,
        upsert_named_object_fn=upsert_named_object_fn,
    )


def delete_named_object(
    *,
    object_id,
    apply_now,
    read_objects_fn,
    write_objects_fn,
    apply_rules_fn,
    list_rules_fn,
    normalize_value_fn,
):
    return named_object_ops.delete_named_object(
        object_id=object_id,
        apply_now=apply_now,
        read_objects_fn=read_objects_fn,
        write_objects_fn=write_objects_fn,
        apply_rules_fn=apply_rules_fn,
        list_rules_fn=list_rules_fn,
        normalize_value_fn=normalize_value_fn,
    )


def upsert_table(
    payload,
    *,
    read_tables_fn,
    write_tables_fn,
    normalize_item_fn,
    apply_rules_fn,
    default_family,
    default_table_defs,
):
    return table_ops.upsert_table(
        payload=payload,
        read_tables_fn=read_tables_fn,
        write_tables_fn=write_tables_fn,
        normalize_item_fn=normalize_item_fn,
        apply_rules_fn=apply_rules_fn,
        default_family=default_family,
        default_table_defs=default_table_defs,
    )


def delete_table(
    table_id,
    *,
    read_tables_fn,
    write_tables_fn,
    read_objects_fn,
    write_objects_fn,
    apply_rules_fn,
    default_family,
):
    return table_ops.delete_table(
        table_id=table_id,
        read_tables_fn=read_tables_fn,
        write_tables_fn=write_tables_fn,
        read_objects_fn=read_objects_fn,
        write_objects_fn=write_objects_fn,
        apply_rules_fn=apply_rules_fn,
        default_family=default_family,
    )


def get_schema(schema):
    return schema_ops.get_schema(schema)
