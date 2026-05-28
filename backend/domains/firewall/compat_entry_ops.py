#!/usr/bin/python3
import functools

from . import helper_service_ops
from . import service_layer_ops


def list_rules_service(*, family, table, read_rules_fn, normalize_rule_fn, normalize_value_fn):
    return service_layer_ops.list_rules(
        family=family,
        table=table,
        read_rules_fn=read_rules_fn,
        normalize_rule_fn=normalize_rule_fn,
        normalize_value_fn=normalize_value_fn,
    )


def apply_rules_service(
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
    return service_layer_ops.apply_rules(
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


def create_rule_service(*, payload, apply_now, list_rules_fn, normalize_rule_fn, write_rules_fn, apply_rules_fn):
    return service_layer_ops.create_rule(
        payload=payload,
        apply_now=apply_now,
        list_rules_fn=list_rules_fn,
        normalize_rule_fn=normalize_rule_fn,
        write_rules_fn=write_rules_fn,
        apply_rules_fn=apply_rules_fn,
    )


def update_rule_service(*, rule_id, payload, apply_now, list_rules_fn, normalize_rule_fn, write_rules_fn, apply_rules_fn):
    return service_layer_ops.update_rule(
        rule_id=rule_id,
        payload=payload,
        apply_now=apply_now,
        list_rules_fn=list_rules_fn,
        normalize_rule_fn=normalize_rule_fn,
        write_rules_fn=write_rules_fn,
        apply_rules_fn=apply_rules_fn,
    )


def delete_rule_service(*, rule_id, apply_now, list_rules_fn, write_rules_fn, apply_rules_fn):
    return service_layer_ops.delete_rule(
        rule_id=rule_id,
        apply_now=apply_now,
        list_rules_fn=list_rules_fn,
        write_rules_fn=write_rules_fn,
        apply_rules_fn=apply_rules_fn,
    )


def reorder_rules_service(
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
    return service_layer_ops.reorder_rules(
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


def reset_counters_service(
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
    return service_layer_ops.reset_counters(
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


def get_state_service(
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
    return service_layer_ops.get_state(
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


def list_sets_service(*, read_fn, write_fn, cleanup_expired_fn, enrich_item_fn, apply_rules_fn):
    return service_layer_ops.list_sets(
        read_fn=read_fn,
        write_fn=write_fn,
        cleanup_expired_fn=cleanup_expired_fn,
        enrich_item_fn=enrich_item_fn,
        apply_rules_fn=apply_rules_fn,
    )


def upsert_set_service(
    set_kind,
    *,
    payload,
    read_fn,
    write_fn,
    normalize_item_fn,
    runtime_signature_fn,
    normalize_value_fn,
    enrich_item_fn,
    apply_rules_fn,
):
    return service_layer_ops.upsert_set(
        set_kind,
        payload=payload,
        read_fn=read_fn,
        write_fn=write_fn,
        normalize_item_fn=normalize_item_fn,
        runtime_signature_fn=runtime_signature_fn,
        normalize_value_fn=normalize_value_fn,
        enrich_item_fn=enrich_item_fn,
        apply_rules_fn=apply_rules_fn,
    )


def delete_set_service(set_kind, set_id, *, read_fn, write_fn, apply_rules_fn):
    return service_layer_ops.delete_set(
        set_kind,
        set_id,
        read_fn=read_fn,
        write_fn=write_fn,
        apply_rules_fn=apply_rules_fn,
    )


def list_maps_service(*, read_fn, write_fn, cleanup_expired_fn, enrich_item_fn, apply_rules_fn):
    return service_layer_ops.list_maps(
        read_fn=read_fn,
        write_fn=write_fn,
        cleanup_expired_fn=cleanup_expired_fn,
        enrich_item_fn=enrich_item_fn,
        apply_rules_fn=apply_rules_fn,
    )


def upsert_map_service(
    map_kind,
    *,
    payload,
    read_fn,
    write_fn,
    normalize_item_fn,
    runtime_signature_fn,
    normalize_value_fn,
    enrich_item_fn,
    apply_rules_fn,
):
    return service_layer_ops.upsert_map(
        map_kind,
        payload=payload,
        read_fn=read_fn,
        write_fn=write_fn,
        normalize_item_fn=normalize_item_fn,
        runtime_signature_fn=runtime_signature_fn,
        normalize_value_fn=normalize_value_fn,
        enrich_item_fn=enrich_item_fn,
        apply_rules_fn=apply_rules_fn,
    )


def delete_map_service(map_kind, map_id, *, read_fn, write_fn, apply_rules_fn):
    return service_layer_ops.delete_map(
        map_kind,
        map_id,
        read_fn=read_fn,
        write_fn=write_fn,
        apply_rules_fn=apply_rules_fn,
    )


def list_tables_service(*, read_tables_fn, default_table_defs, default_family):
    return service_layer_ops.list_tables(
        read_tables_fn=read_tables_fn,
        default_table_defs=default_table_defs,
        default_family=default_family,
    )


def list_named_objects_service(
    *,
    family,
    table,
    parse_query_fn,
    read_objects_fn,
    supported_kinds,
    collect_table_defs_fn,
    load_effective_objects_fn,
):
    return service_layer_ops.list_named_objects(
        family=family,
        table=table,
        parse_query_fn=parse_query_fn,
        read_objects_fn=read_objects_fn,
        supported_kinds=supported_kinds,
        collect_table_defs_fn=collect_table_defs_fn,
        load_effective_objects_fn=load_effective_objects_fn,
    )


def upsert_named_object_service(
    *,
    payload,
    apply_now,
    read_objects_fn,
    write_objects_fn,
    normalize_item_fn,
    apply_rules_fn,
    list_rules_fn,
    normalize_value_fn,
):
    return service_layer_ops.upsert_named_object(
        payload=payload,
        apply_now=apply_now,
        read_objects_fn=read_objects_fn,
        write_objects_fn=write_objects_fn,
        normalize_item_fn=normalize_item_fn,
        apply_rules_fn=apply_rules_fn,
        list_rules_fn=list_rules_fn,
        normalize_value_fn=normalize_value_fn,
    )


def create_named_object_service(*, payload, apply_now, read_objects_fn, normalize_value_fn, upsert_named_object_fn):
    return service_layer_ops.create_named_object(
        payload=payload,
        apply_now=apply_now,
        read_objects_fn=read_objects_fn,
        normalize_value_fn=normalize_value_fn,
        upsert_named_object_fn=upsert_named_object_fn,
    )


def update_named_object_service(*, object_id, payload, apply_now, read_objects_fn, upsert_named_object_fn):
    return service_layer_ops.update_named_object(
        object_id=object_id,
        payload=payload,
        apply_now=apply_now,
        read_objects_fn=read_objects_fn,
        upsert_named_object_fn=upsert_named_object_fn,
    )


def delete_named_object_service(
    *,
    object_id,
    apply_now,
    read_objects_fn,
    write_objects_fn,
    apply_rules_fn,
    list_rules_fn,
    normalize_value_fn,
):
    return service_layer_ops.delete_named_object(
        object_id=object_id,
        apply_now=apply_now,
        read_objects_fn=read_objects_fn,
        write_objects_fn=write_objects_fn,
        apply_rules_fn=apply_rules_fn,
        list_rules_fn=list_rules_fn,
        normalize_value_fn=normalize_value_fn,
    )


def upsert_table_service(*, payload, read_tables_fn, write_tables_fn, normalize_item_fn, apply_rules_fn, default_family, default_table_defs):
    return service_layer_ops.upsert_table(
        payload=payload,
        read_tables_fn=read_tables_fn,
        write_tables_fn=write_tables_fn,
        normalize_item_fn=normalize_item_fn,
        apply_rules_fn=apply_rules_fn,
        default_family=default_family,
        default_table_defs=default_table_defs,
    )


def delete_table_service(*, table_id, read_tables_fn, write_tables_fn, read_objects_fn, write_objects_fn, apply_rules_fn, default_family):
    return service_layer_ops.delete_table(
        table_id=table_id,
        read_tables_fn=read_tables_fn,
        write_tables_fn=write_tables_fn,
        read_objects_fn=read_objects_fn,
        write_objects_fn=write_objects_fn,
        apply_rules_fn=apply_rules_fn,
        default_family=default_family,
    )


def get_schema_service(schema):
    return service_layer_ops.get_schema(schema)


def build_collection_runtime_helpers(*, normalize_value_fn, now_ts_fn):
    normalize_timeout_fn = functools.partial(
        helper_service_ops.normalize_nft_timeout,
        normalize_value_fn=normalize_value_fn,
    )
    timeout_to_seconds_fn = functools.partial(
        helper_service_ops.timeout_to_seconds,
        normalize_value_fn=normalize_value_fn,
        normalize_nft_timeout_fn=normalize_timeout_fn,
    )

    def enrich_item_runtime_fn(item, now_ts=None):
        if now_ts is None:
            now_ts = int(now_ts_fn())
        return helper_service_ops.enrich_collection_item_runtime(
            item,
            now_ts=int(now_ts),
            timeout_to_seconds_fn=timeout_to_seconds_fn,
        )

    cleanup_expired_fn = functools.partial(
        helper_service_ops.cleanup_expired_collection_rows,
        timeout_to_seconds_fn=timeout_to_seconds_fn,
    )
    set_runtime_signature_fn = functools.partial(
        helper_service_ops.set_runtime_signature,
        normalize_value_fn=normalize_value_fn,
    )
    map_runtime_signature_fn = functools.partial(
        helper_service_ops.map_runtime_signature,
        normalize_value_fn=normalize_value_fn,
    )
    return {
        "normalize_timeout_fn": normalize_timeout_fn,
        "timeout_to_seconds_fn": timeout_to_seconds_fn,
        "enrich_item_runtime_fn": enrich_item_runtime_fn,
        "cleanup_expired_fn": cleanup_expired_fn,
        "set_runtime_signature_fn": set_runtime_signature_fn,
        "map_runtime_signature_fn": map_runtime_signature_fn,
    }


# Compatibility aliases for existing legacy-manager call-sites.
list_rules = list_rules_service
apply_rules = apply_rules_service
create_rule = create_rule_service
update_rule = update_rule_service
delete_rule = delete_rule_service
reorder_rules = reorder_rules_service
reset_counters = reset_counters_service
get_state = get_state_service
list_sets = list_sets_service
upsert_set = upsert_set_service
delete_set = delete_set_service
list_maps = list_maps_service
upsert_map = upsert_map_service
delete_map = delete_map_service
list_tables = list_tables_service
list_named_objects = list_named_objects_service
upsert_named_object = upsert_named_object_service
create_named_object = create_named_object_service
update_named_object = update_named_object_service
delete_named_object = delete_named_object_service
upsert_table = upsert_table_service
delete_table = delete_table_service
get_schema = get_schema_service
