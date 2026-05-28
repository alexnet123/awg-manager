#!/usr/bin/python3


def get_state(
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
    rules = list_rules_fn()
    ruleset_text = get_ruleset_text_fn()
    active, rules_by_table_chain = get_ruleset_counter_index_fn(table_prefix)
    runtime_counters = build_runtime_counters_by_rule_fn(
        rules,
        rules_by_table_chain,
        default_family,
    )
    stats_store = read_stats_fn()
    now_ts = now_ts_fn()
    enriched_rules, next_stats_store = enrich_rules_with_runtime_stats_fn(
        rules,
        runtime_counters,
        stats_store,
        now_ts,
    )
    write_stats_fn(next_stats_store)
    return {
        "active": active,
        "rules": enriched_rules,
        "ruleset": ruleset_text,
        "family": default_family,
        "tables": ["filter", "nat", "raw", "mangle"],
    }
