import unittest

from backend.domains.firewall import collection_ops
from backend.domains.firewall import named_object_ops
from backend.domains.firewall import rule_ops
from backend.domains.firewall import runtime_ops
from backend.domains.firewall import schema_ops
from backend.domains.firewall import service_layer_ops
from backend.domains.firewall import state_ops
from backend.domains.firewall import table_ops


class FirewallServiceLayerOpsTest(unittest.TestCase):
    def test_rules_runtime_and_state_delegation(self):
        calls = []
        originals = (
            rule_ops.list_rules,
            rule_ops.create_rule,
            rule_ops.update_rule,
            rule_ops.delete_rule,
            rule_ops.reorder_rules,
            runtime_ops.apply_rules,
            runtime_ops.reset_counters,
            state_ops.get_state,
        )
        try:
            rule_ops.list_rules = lambda **kwargs: (calls.append(("list_rules", kwargs)), ["r"])[1]
            rule_ops.create_rule = lambda **kwargs: (calls.append(("create_rule", kwargs)), {"id": "n"})[1]
            rule_ops.update_rule = lambda **kwargs: (calls.append(("update_rule", kwargs)), {"id": kwargs["rule_id"]})[1]
            rule_ops.delete_rule = lambda **kwargs: (calls.append(("delete_rule", kwargs)), {"id": kwargs["rule_id"]})[1]
            rule_ops.reorder_rules = lambda **kwargs: (calls.append(("reorder_rules", kwargs)), {"ok": True})[1]
            runtime_ops.apply_rules = lambda **kwargs: (calls.append(("apply_rules", kwargs)), True)[1]
            runtime_ops.reset_counters = lambda **kwargs: (calls.append(("reset_counters", kwargs)), {"ok": True})[1]
            state_ops.get_state = lambda **kwargs: (calls.append(("get_state", kwargs)), {"rules": []})[1]

            self.assertEqual(
                service_layer_ops.list_rules(
                    family="inet",
                    table="filter",
                    read_rules_fn=object(),
                    normalize_rule_fn=object(),
                    normalize_value_fn=object(),
                ),
                ["r"],
            )
            self.assertEqual(
                service_layer_ops.create_rule(
                    payload={"x": 1},
                    apply_now=True,
                    list_rules_fn=object(),
                    normalize_rule_fn=object(),
                    write_rules_fn=object(),
                    apply_rules_fn=object(),
                )["id"],
                "n",
            )
            self.assertEqual(
                service_layer_ops.update_rule(
                    rule_id="r1",
                    payload={"x": 2},
                    apply_now=False,
                    list_rules_fn=object(),
                    normalize_rule_fn=object(),
                    write_rules_fn=object(),
                    apply_rules_fn=object(),
                )["id"],
                "r1",
            )
            self.assertEqual(
                service_layer_ops.delete_rule(
                    rule_id="r2",
                    apply_now=True,
                    list_rules_fn=object(),
                    write_rules_fn=object(),
                    apply_rules_fn=object(),
                )["id"],
                "r2",
            )
            self.assertTrue(
                service_layer_ops.reorder_rules(
                    table="filter",
                    ordered_ids=["a", "b"],
                    apply_now=True,
                    list_rules_fn=object(),
                    read_tables_fn=object(),
                    normalize_value_fn=object(),
                    default_family="inet",
                    default_tables=("filter", "nat"),
                    write_rules_fn=object(),
                    apply_rules_fn=object(),
                )["ok"]
            )
            self.assertTrue(
                service_layer_ops.apply_rules(
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
                    table_prefix="awg_",
                    default_family="inet",
                )
            )
            self.assertTrue(
                service_layer_ops.reset_counters(
                    table="filter",
                    read_tables_fn=object(),
                    normalize_value_fn=object(),
                    default_family="inet",
                    default_tables=("filter", "nat"),
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
                    table_prefix="awg_",
                )["ok"]
            )
            self.assertEqual(
                service_layer_ops.get_state(
                    list_rules_fn=object(),
                    get_ruleset_text_fn=object(),
                    get_ruleset_counter_index_fn=object(),
                    build_runtime_counters_by_rule_fn=object(),
                    default_family="inet",
                    table_prefix="awg_",
                    read_stats_fn=object(),
                    enrich_rules_with_runtime_stats_fn=object(),
                    now_ts_fn=object(),
                    write_stats_fn=object(),
                ),
                {"rules": []},
            )
            self.assertEqual(calls[0][0], "list_rules")
            self.assertEqual(calls[-1][0], "get_state")
        finally:
            (
                rule_ops.list_rules,
                rule_ops.create_rule,
                rule_ops.update_rule,
                rule_ops.delete_rule,
                rule_ops.reorder_rules,
                runtime_ops.apply_rules,
                runtime_ops.reset_counters,
                state_ops.get_state,
            ) = originals

    def test_collection_set_and_map_wiring(self):
        calls = []
        originals = (
            collection_ops.list_collections,
            collection_ops.upsert_collection,
            collection_ops.delete_collection,
        )
        try:
            collection_ops.list_collections = lambda **kwargs: (calls.append(("list", kwargs)), {"ok": True})[1]

            def _upsert(**kwargs):
                calls.append(("upsert", kwargs))
                names = list(kwargs["other_names"]({"addr": [{"name": "a"}], "port": [{"name": "p"}], "iface": [{"name": "i"}], "map": [{"name": "m"}], "vmap": [{"name": "v"}]}))
                return {"kind": kwargs["kind"], "other": names}

            collection_ops.upsert_collection = _upsert
            collection_ops.delete_collection = lambda **kwargs: (calls.append(("delete", kwargs)), {"id": kwargs["item_id"]})[1]

            self.assertTrue(
                service_layer_ops.list_sets(
                    read_fn=object(),
                    write_fn=object(),
                    cleanup_expired_fn=object(),
                    enrich_item_fn=object(),
                    apply_rules_fn=object(),
                )["ok"]
            )
            set_result = service_layer_ops.upsert_set(
                "addr",
                {"name": "x"},
                read_fn=object(),
                write_fn=object(),
                normalize_item_fn=object(),
                runtime_signature_fn=object(),
                normalize_value_fn=object(),
                enrich_item_fn=object(),
                apply_rules_fn=object(),
            )
            self.assertEqual(set_result["kind"], "addr")
            self.assertEqual(set_result["other"], ["p", "i"])
            self.assertEqual(
                service_layer_ops.delete_set(
                    "addr",
                    "s1",
                    read_fn=object(),
                    write_fn=object(),
                    apply_rules_fn=object(),
                )["id"],
                "s1",
            )

            self.assertTrue(
                service_layer_ops.list_maps(
                    read_fn=object(),
                    write_fn=object(),
                    cleanup_expired_fn=object(),
                    enrich_item_fn=object(),
                    apply_rules_fn=object(),
                )["ok"]
            )
            map_result = service_layer_ops.upsert_map(
                "map",
                {"name": "x"},
                read_fn=object(),
                write_fn=object(),
                normalize_item_fn=object(),
                runtime_signature_fn=object(),
                normalize_value_fn=object(),
                enrich_item_fn=object(),
                apply_rules_fn=object(),
            )
            self.assertEqual(map_result["kind"], "map")
            self.assertEqual(map_result["other"], ["v"])
            self.assertEqual(
                service_layer_ops.delete_map(
                    "map",
                    "m1",
                    read_fn=object(),
                    write_fn=object(),
                    apply_rules_fn=object(),
                )["id"],
                "m1",
            )
            self.assertEqual(calls[0][0], "list")
            self.assertEqual(calls[-1][0], "delete")
        finally:
            (
                collection_ops.list_collections,
                collection_ops.upsert_collection,
                collection_ops.delete_collection,
            ) = originals

    def test_named_objects_tables_and_schema_delegation(self):
        calls = []
        originals = (
            named_object_ops.list_named_objects,
            named_object_ops.upsert_named_object,
            named_object_ops.create_named_object,
            named_object_ops.update_named_object,
            named_object_ops.delete_named_object,
            table_ops.list_tables,
            table_ops.upsert_table,
            table_ops.delete_table,
            schema_ops.get_schema,
        )
        try:
            named_object_ops.list_named_objects = lambda **kwargs: (calls.append(("list_obj", kwargs)), ["o"])[1]
            named_object_ops.upsert_named_object = lambda **kwargs: (calls.append(("upsert_obj", kwargs)), {"id": "o1"})[1]
            named_object_ops.create_named_object = lambda **kwargs: (calls.append(("create_obj", kwargs)), {"id": "o2"})[1]
            named_object_ops.update_named_object = lambda **kwargs: (calls.append(("update_obj", kwargs)), {"id": kwargs["object_id"]})[1]
            named_object_ops.delete_named_object = lambda **kwargs: (calls.append(("delete_obj", kwargs)), {"id": kwargs["object_id"]})[1]
            table_ops.list_tables = lambda **kwargs: (calls.append(("list_tables", kwargs)), ["t"])[1]
            table_ops.upsert_table = lambda **kwargs: (calls.append(("upsert_table", kwargs)), {"id": "t1"})[1]
            table_ops.delete_table = lambda **kwargs: (calls.append(("delete_table", kwargs)), {"id": kwargs["table_id"]})[1]
            schema_ops.get_schema = lambda schema: (calls.append(("schema", schema)), {"keys": list(schema.keys())})[1]

            self.assertEqual(
                service_layer_ops.list_named_objects(
                    family="inet",
                    table="filter",
                    parse_query_fn=object(),
                    read_objects_fn=object(),
                    supported_kinds=("counter",),
                    collect_table_defs_fn=object(),
                    load_effective_objects_fn=object(),
                ),
                ["o"],
            )
            self.assertEqual(
                service_layer_ops.upsert_named_object(
                    {"name": "x"},
                    apply_now=True,
                    read_objects_fn=object(),
                    write_objects_fn=object(),
                    normalize_item_fn=object(),
                    apply_rules_fn=object(),
                    list_rules_fn=object(),
                    normalize_value_fn=object(),
                )["id"],
                "o1",
            )
            self.assertEqual(
                service_layer_ops.create_named_object(
                    payload={"name": "x"},
                    apply_now=True,
                    read_objects_fn=object(),
                    normalize_value_fn=object(),
                    upsert_named_object_fn=object(),
                )["id"],
                "o2",
            )
            self.assertEqual(
                service_layer_ops.update_named_object(
                    object_id="obj-id",
                    payload={"name": "x"},
                    apply_now=False,
                    read_objects_fn=object(),
                    upsert_named_object_fn=object(),
                )["id"],
                "obj-id",
            )
            self.assertEqual(
                service_layer_ops.delete_named_object(
                    object_id="obj-id2",
                    apply_now=False,
                    read_objects_fn=object(),
                    write_objects_fn=object(),
                    apply_rules_fn=object(),
                    list_rules_fn=object(),
                    normalize_value_fn=object(),
                )["id"],
                "obj-id2",
            )
            self.assertEqual(
                service_layer_ops.list_tables(
                    read_tables_fn=object(),
                    default_table_defs={},
                    default_family="inet",
                ),
                ["t"],
            )
            self.assertEqual(
                service_layer_ops.upsert_table(
                    {"name": "t"},
                    read_tables_fn=object(),
                    write_tables_fn=object(),
                    normalize_item_fn=object(),
                    apply_rules_fn=object(),
                    default_family="inet",
                    default_table_defs={},
                )["id"],
                "t1",
            )
            self.assertEqual(
                service_layer_ops.delete_table(
                    "tbl-1",
                    read_tables_fn=object(),
                    write_tables_fn=object(),
                    read_objects_fn=object(),
                    write_objects_fn=object(),
                    apply_rules_fn=object(),
                    default_family="inet",
                )["id"],
                "tbl-1",
            )
            self.assertEqual(
                service_layer_ops.get_schema({"a": 1}),
                {"keys": ["a"]},
            )
            self.assertEqual(calls[0][0], "list_obj")
            self.assertEqual(calls[-1][0], "schema")
        finally:
            (
                named_object_ops.list_named_objects,
                named_object_ops.upsert_named_object,
                named_object_ops.create_named_object,
                named_object_ops.update_named_object,
                named_object_ops.delete_named_object,
                table_ops.list_tables,
                table_ops.upsert_table,
                table_ops.delete_table,
                schema_ops.get_schema,
            ) = originals


if __name__ == "__main__":
    unittest.main()
