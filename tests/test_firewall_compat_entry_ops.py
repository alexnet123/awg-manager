import unittest

from backend.domains.firewall import compat_entry_ops
from backend.domains.firewall import helper_service_ops
from backend.domains.firewall import service_layer_ops


class FirewallCompatEntryOpsTest(unittest.TestCase):
    def test_rule_flow_delegation(self):
        calls = []
        originals = (
            service_layer_ops.list_rules,
            service_layer_ops.create_rule,
            service_layer_ops.update_rule,
            service_layer_ops.delete_rule,
            service_layer_ops.reorder_rules,
        )
        try:
            service_layer_ops.list_rules = lambda **kwargs: (calls.append(("list", kwargs)), ["r1"])[1]
            service_layer_ops.create_rule = lambda **kwargs: (calls.append(("create", kwargs)), {"id": "r2"})[1]
            service_layer_ops.update_rule = lambda **kwargs: (calls.append(("update", kwargs)), {"id": kwargs["rule_id"]})[1]
            service_layer_ops.delete_rule = lambda **kwargs: (calls.append(("delete", kwargs)), {"id": kwargs["rule_id"]})[1]
            service_layer_ops.reorder_rules = lambda **kwargs: (calls.append(("reorder", kwargs)), ["r2", "r1"])[1]

            self.assertEqual(
                compat_entry_ops.list_rules(
                    family="inet",
                    table="filter",
                    read_rules_fn=object(),
                    normalize_rule_fn=object(),
                    normalize_value_fn=object(),
                ),
                ["r1"],
            )
            self.assertEqual(
                compat_entry_ops.create_rule(
                    payload={"action": "accept"},
                    apply_now=True,
                    list_rules_fn=object(),
                    normalize_rule_fn=object(),
                    write_rules_fn=object(),
                    apply_rules_fn=object(),
                )["id"],
                "r2",
            )
            self.assertEqual(
                compat_entry_ops.update_rule(
                    rule_id="r2",
                    payload={"action": "drop"},
                    apply_now=False,
                    list_rules_fn=object(),
                    normalize_rule_fn=object(),
                    write_rules_fn=object(),
                    apply_rules_fn=object(),
                )["id"],
                "r2",
            )
            self.assertEqual(
                compat_entry_ops.delete_rule(
                    rule_id="r1",
                    apply_now=True,
                    list_rules_fn=object(),
                    write_rules_fn=object(),
                    apply_rules_fn=object(),
                )["id"],
                "r1",
            )
            self.assertEqual(
                compat_entry_ops.reorder_rules(
                    table="filter",
                    ordered_ids=["r2", "r1"],
                    apply_now=True,
                    list_rules_fn=object(),
                    read_tables_fn=object(),
                    normalize_value_fn=object(),
                    default_family="inet",
                    default_tables=("filter",),
                    write_rules_fn=object(),
                    apply_rules_fn=object(),
                ),
                ["r2", "r1"],
            )
            self.assertEqual(calls[0][0], "list")
            self.assertEqual(calls[-1][0], "reorder")
        finally:
            (
                service_layer_ops.list_rules,
                service_layer_ops.create_rule,
                service_layer_ops.update_rule,
                service_layer_ops.delete_rule,
                service_layer_ops.reorder_rules,
            ) = originals

    def test_collection_and_named_object_delegation(self):
        calls = []
        originals = (
            service_layer_ops.list_sets,
            service_layer_ops.upsert_set,
            service_layer_ops.list_maps,
            service_layer_ops.upsert_map,
            service_layer_ops.list_named_objects,
            service_layer_ops.upsert_named_object,
            service_layer_ops.delete_named_object,
            service_layer_ops.list_tables,
            service_layer_ops.upsert_table,
            service_layer_ops.delete_table,
            service_layer_ops.get_schema,
        )
        try:
            service_layer_ops.list_sets = lambda **kwargs: (calls.append(("list_sets", kwargs)), ["set"])[1]
            service_layer_ops.upsert_set = lambda kind, **kwargs: (calls.append(("upsert_set", kind, kwargs)), {"kind": kind})[1]
            service_layer_ops.list_maps = lambda **kwargs: (calls.append(("list_maps", kwargs)), ["map"])[1]
            service_layer_ops.upsert_map = lambda kind, **kwargs: (calls.append(("upsert_map", kind, kwargs)), {"kind": kind})[1]
            service_layer_ops.list_named_objects = lambda **kwargs: (calls.append(("list_named", kwargs)), ["obj"])[1]
            service_layer_ops.upsert_named_object = lambda **kwargs: (calls.append(("upsert_named", kwargs)), {"id": "obj-1"})[1]
            service_layer_ops.delete_named_object = lambda **kwargs: (calls.append(("delete_named", kwargs)), {"id": kwargs["object_id"]})[1]
            service_layer_ops.list_tables = lambda **kwargs: (calls.append(("list_tables", kwargs)), ["tbl"])[1]
            service_layer_ops.upsert_table = lambda **kwargs: (calls.append(("upsert_table", kwargs)), {"id": "tbl-1"})[1]
            service_layer_ops.delete_table = lambda **kwargs: (calls.append(("delete_table", kwargs)), {"id": kwargs["table_id"]})[1]
            service_layer_ops.get_schema = lambda schema: (calls.append(("schema", schema)), schema)[1]

            self.assertEqual(
                compat_entry_ops.list_sets(
                    read_fn=object(),
                    write_fn=object(),
                    cleanup_expired_fn=object(),
                    enrich_item_fn=object(),
                    apply_rules_fn=object(),
                ),
                ["set"],
            )
            self.assertEqual(
                compat_entry_ops.upsert_set(
                    "ip",
                    payload={"id": "set-1"},
                    read_fn=object(),
                    write_fn=object(),
                    normalize_item_fn=object(),
                    runtime_signature_fn=object(),
                    normalize_value_fn=object(),
                    enrich_item_fn=object(),
                    apply_rules_fn=object(),
                )["kind"],
                "ip",
            )
            self.assertEqual(
                compat_entry_ops.list_maps(
                    read_fn=object(),
                    write_fn=object(),
                    cleanup_expired_fn=object(),
                    enrich_item_fn=object(),
                    apply_rules_fn=object(),
                ),
                ["map"],
            )
            self.assertEqual(
                compat_entry_ops.upsert_map(
                    "ip",
                    payload={"id": "map-1"},
                    read_fn=object(),
                    write_fn=object(),
                    normalize_item_fn=object(),
                    runtime_signature_fn=object(),
                    normalize_value_fn=object(),
                    enrich_item_fn=object(),
                    apply_rules_fn=object(),
                )["kind"],
                "ip",
            )
            self.assertEqual(
                compat_entry_ops.list_named_objects(
                    family="inet",
                    table="filter",
                    parse_query_fn=object(),
                    read_objects_fn=object(),
                    supported_kinds=("counter",),
                    collect_table_defs_fn=object(),
                    load_effective_objects_fn=object(),
                ),
                ["obj"],
            )
            self.assertEqual(
                compat_entry_ops.upsert_named_object(
                    payload={"name": "obj"},
                    apply_now=True,
                    read_objects_fn=object(),
                    write_objects_fn=object(),
                    normalize_item_fn=object(),
                    apply_rules_fn=object(),
                    list_rules_fn=object(),
                    normalize_value_fn=object(),
                )["id"],
                "obj-1",
            )
            self.assertEqual(
                compat_entry_ops.delete_named_object(
                    object_id="obj-1",
                    apply_now=True,
                    read_objects_fn=object(),
                    write_objects_fn=object(),
                    apply_rules_fn=object(),
                    list_rules_fn=object(),
                    normalize_value_fn=object(),
                )["id"],
                "obj-1",
            )
            self.assertEqual(
                compat_entry_ops.list_tables(
                    read_tables_fn=object(),
                    default_table_defs=object(),
                    default_family="inet",
                ),
                ["tbl"],
            )
            self.assertEqual(
                compat_entry_ops.upsert_table(
                    payload={"family": "inet", "table": "filter"},
                    read_tables_fn=object(),
                    write_tables_fn=object(),
                    normalize_item_fn=object(),
                    apply_rules_fn=object(),
                    default_family="inet",
                    default_table_defs=object(),
                )["id"],
                "tbl-1",
            )
            self.assertEqual(
                compat_entry_ops.delete_table(
                    table_id="inet/filter",
                    read_tables_fn=object(),
                    write_tables_fn=object(),
                    read_objects_fn=object(),
                    write_objects_fn=object(),
                    apply_rules_fn=object(),
                    default_family="inet",
                )["id"],
                "inet/filter",
            )
            self.assertEqual(
                compat_entry_ops.get_schema({"family": "inet"})["family"],
                "inet",
            )
            self.assertEqual(calls[0][0], "list_sets")
            self.assertEqual(calls[-1][0], "schema")
        finally:
            (
                service_layer_ops.list_sets,
                service_layer_ops.upsert_set,
                service_layer_ops.list_maps,
                service_layer_ops.upsert_map,
                service_layer_ops.list_named_objects,
                service_layer_ops.upsert_named_object,
                service_layer_ops.delete_named_object,
                service_layer_ops.list_tables,
                service_layer_ops.upsert_table,
                service_layer_ops.delete_table,
                service_layer_ops.get_schema,
            ) = originals

    def test_apply_reset_state_delegation(self):
        calls = []
        originals = (
            service_layer_ops.apply_rules,
            service_layer_ops.reset_counters,
            service_layer_ops.get_state,
        )
        try:
            service_layer_ops.apply_rules = lambda **kwargs: (calls.append(("apply", kwargs)), None)[1]
            service_layer_ops.reset_counters = lambda **kwargs: (calls.append(("reset", kwargs)), {"ok": True})[1]
            service_layer_ops.get_state = lambda **kwargs: (calls.append(("state", kwargs)), {"state": True})[1]

            self.assertIsNone(
                compat_entry_ops.apply_rules(
                    list_rules_fn=object(),
                    read_sets_fn=object(),
                    read_maps_fn=object(),
                    read_objects_fn=object(),
                    collect_table_defs_fn=object(),
                    read_managed_tables_fn=object(),
                    parse_managed_table_key_fn=object(),
                    list_runtime_tables_fn=object(),
                    delete_table_fn=object(),
                    append_table_script_lines_fn=object(),
                    apply_script_fn=object(),
                    managed_table_key_fn=object(),
                    write_managed_tables_fn=object(),
                    table_prefix="",
                    default_family="inet",
                )
            )
            self.assertTrue(
                compat_entry_ops.reset_counters(
                    table="filter",
                    read_tables_fn=object(),
                    normalize_value_fn=object(),
                    default_family="inet",
                    default_tables=("filter",),
                    list_rules_fn=object(),
                    read_sets_fn=object(),
                    read_maps_fn=object(),
                    read_objects_fn=object(),
                    collect_table_defs_fn=object(),
                    reset_named_counters_fn=object(),
                    reset_named_quotas_fn=object(),
                    read_stats_fn=object(),
                    write_stats_fn=object(),
                    apply_rules_fn=object(),
                    delete_table_fn=object(),
                    append_table_script_lines_fn=object(),
                    apply_script_fn=object(),
                    table_prefix="",
                )["ok"]
            )
            self.assertTrue(
                compat_entry_ops.get_state(
                    list_rules_fn=object(),
                    get_ruleset_text_fn=object(),
                    get_ruleset_counter_index_fn=object(),
                    build_runtime_counters_by_rule_fn=object(),
                    default_family="inet",
                    table_prefix="",
                    read_stats_fn=object(),
                    enrich_rules_with_runtime_stats_fn=object(),
                    now_ts_fn=object(),
                    write_stats_fn=object(),
                )["state"]
            )
            self.assertEqual(calls[0][0], "apply")
            self.assertEqual(calls[-1][0], "state")
        finally:
            (
                service_layer_ops.apply_rules,
                service_layer_ops.reset_counters,
                service_layer_ops.get_state,
            ) = originals

    def test_build_collection_runtime_helpers(self):
        calls = []
        originals = (
            helper_service_ops.normalize_nft_timeout,
            helper_service_ops.timeout_to_seconds,
            helper_service_ops.enrich_collection_item_runtime,
            helper_service_ops.cleanup_expired_collection_rows,
            helper_service_ops.set_runtime_signature,
            helper_service_ops.map_runtime_signature,
        )
        try:
            helper_service_ops.normalize_nft_timeout = lambda value, normalize_value_fn: (
                calls.append(("norm_timeout", value, normalize_value_fn)),
                "30s",
            )[1]
            helper_service_ops.timeout_to_seconds = lambda value, normalize_value_fn, normalize_nft_timeout_fn: (
                calls.append(("timeout_sec", value, normalize_value_fn, normalize_nft_timeout_fn)),
                30,
            )[1]
            helper_service_ops.enrich_collection_item_runtime = lambda item, now_ts, timeout_to_seconds_fn: (
                calls.append(("enrich", item, now_ts, timeout_to_seconds_fn)),
                {"item": item, "now_ts": now_ts},
            )[1]
            helper_service_ops.cleanup_expired_collection_rows = lambda rows, timeout_to_seconds_fn: (
                calls.append(("cleanup", rows, timeout_to_seconds_fn)),
                ["kept"],
            )[1]
            helper_service_ops.set_runtime_signature = lambda item, normalize_value_fn: (
                calls.append(("set_sig", item, normalize_value_fn)),
                "set-sig",
            )[1]
            helper_service_ops.map_runtime_signature = lambda item, normalize_value_fn: (
                calls.append(("map_sig", item, normalize_value_fn)),
                "map-sig",
            )[1]

            helpers = compat_entry_ops.build_collection_runtime_helpers(
                normalize_value_fn=lambda value: value,
                now_ts_fn=lambda: 123,
            )
            self.assertEqual(helpers["normalize_timeout_fn"]("x"), "30s")
            self.assertEqual(helpers["timeout_to_seconds_fn"]("x"), 30)
            self.assertEqual(
                helpers["enrich_item_runtime_fn"]({"id": 1}),
                {"item": {"id": 1}, "now_ts": 123},
            )
            self.assertEqual(
                helpers["cleanup_expired_fn"]([{"id": 1}]),
                ["kept"],
            )
            self.assertEqual(helpers["set_runtime_signature_fn"]({"id": 1}), "set-sig")
            self.assertEqual(helpers["map_runtime_signature_fn"]({"id": 1}), "map-sig")
            self.assertEqual(calls[0][0], "norm_timeout")
            self.assertEqual(calls[-1][0], "map_sig")
        finally:
            (
                helper_service_ops.normalize_nft_timeout,
                helper_service_ops.timeout_to_seconds,
                helper_service_ops.enrich_collection_item_runtime,
                helper_service_ops.cleanup_expired_collection_rows,
                helper_service_ops.set_runtime_signature,
                helper_service_ops.map_runtime_signature,
            ) = originals


if __name__ == "__main__":
    unittest.main()
