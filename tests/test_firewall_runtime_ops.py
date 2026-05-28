import unittest

from backend.domains.firewall import runtime_ops


class FirewallRuntimeOpsTest(unittest.TestCase):
    def test_apply_rules_prunes_stale_and_updates_managed(self):
        deleted = []
        appended = []
        applied_scripts = []
        written_managed = {}

        def _append(
            script_lines,
            table_family,
            nft_table,
            table_defs,
            sets_data,
            maps_data,
            rules,
            named_objects_data,
            include_runtime_objects,
        ):
            appended.append((table_family, nft_table, include_runtime_objects))
            script_lines.append(f"{table_family}:{nft_table}")

        ok = runtime_ops.apply_rules(
            list_rules_fn=lambda: [{"id": "r1", "table": "filter"}],
            read_sets_fn=lambda: {"addr": [], "port": [], "iface": []},
            read_maps_fn=lambda: {"map": [], "vmap": []},
            read_objects_fn=lambda: {"objects": []},
            collect_table_defs_fn=lambda: {
                ("inet", "filter"): [],
                ("ip", "custom"): [],
            },
            read_managed_tables_fn=lambda: {"tables": ["inet:stale", "inet:filter", "ip:legacy"]},
            parse_managed_table_key_fn=lambda key: tuple(str(key).split(":", 1)),
            list_runtime_tables_fn=lambda: [("inet", "stale"), ("ip", "legacy"), ("inet", "filter")],
            delete_table_fn=lambda family, table_name: deleted.append((family, table_name)),
            append_table_script_lines_fn=_append,
            apply_script_fn=lambda script: applied_scripts.append(script),
            managed_table_key_fn=lambda family, table_name: f"{family}:{table_name}",
            write_managed_tables_fn=lambda payload: written_managed.update(payload),
            table_prefix="",
            default_family="inet",
        )

        self.assertTrue(ok)
        self.assertIn(("inet", "stale"), deleted)
        self.assertIn(("ip", "legacy"), deleted)
        self.assertIn(("inet", "filter"), deleted)
        self.assertIn(("ip", "custom"), deleted)
        self.assertEqual(appended, [("inet", "filter", True), ("ip", "custom", False)])
        self.assertEqual(applied_scripts, ["inet:filter\nip:custom\n"])
        self.assertEqual(written_managed["tables"], ["inet:filter", "ip:custom"])

    def test_reset_counters_full_apply(self):
        writes = []
        called = {"apply": 0}
        reset_calls = {"counter": [], "quota": []}

        result = runtime_ops.reset_counters(
            table=None,
            read_tables_fn=lambda: {"tables": [{"family": "inet", "table_name": "custom1"}]},
            normalize_value_fn=lambda v: str(v).strip() if v is not None and str(v).strip() else None,
            default_family="inet",
            default_tables=("filter", "nat", "raw", "mangle"),
            list_rules_fn=lambda: [
                {"id": "r1", "table": "filter"},
                {"id": "r2", "table": "custom1"},
                {"id": "r3", "table": "ip-only"},
            ],
            read_sets_fn=lambda: {"addr": [], "port": [], "iface": []},
            read_maps_fn=lambda: {"map": [], "vmap": []},
            read_objects_fn=lambda: {"objects": []},
            collect_table_defs_fn=lambda: {("inet", "filter"): []},
            reset_named_counters_fn=lambda family, table_name: reset_calls["counter"].append((family, table_name)) or (
                table_name.endswith("filter")
            ),
            reset_named_quotas_fn=lambda family, table_name: reset_calls["quota"].append((family, table_name)) or False,
            read_stats_fn=lambda: {"r1": {"x": 1}, "r2": {"x": 2}, "r3": {"x": 3}},
            write_stats_fn=lambda payload: writes.append(dict(payload)),
            apply_rules_fn=lambda: called.update(apply=called["apply"] + 1),
            delete_table_fn=lambda family, table_name: None,
            append_table_script_lines_fn=lambda *args, **kwargs: None,
            apply_script_fn=lambda script: None,
            table_prefix="",
        )

        self.assertEqual(called["apply"], 1)
        self.assertEqual(len(reset_calls["counter"]), 5)
        self.assertEqual(len(reset_calls["quota"]), 5)
        self.assertEqual(writes[-1], {"r3": {"x": 3}})
        self.assertTrue(result["ok"])
        self.assertEqual(result["tables_reset"], 1)
        self.assertEqual(result["rules_stats_reset"], 2)
        self.assertTrue(result["runtime_reapplied"])
        self.assertTrue(result["named_reset_supported"])

    def test_reset_counters_single_table_partial_reapply(self):
        deleted = []
        scripts = []
        applied = {"count": 0}

        def _append(
            script_lines,
            table_family,
            nft_table,
            table_defs,
            sets_data,
            maps_data,
            rules,
            named_objects_data,
            include_runtime_objects,
        ):
            self.assertEqual(table_family, "inet")
            self.assertEqual(nft_table, "nat")
            self.assertTrue(include_runtime_objects)
            script_lines.append("nat-script")

        result = runtime_ops.reset_counters(
            table="nat",
            read_tables_fn=lambda: {"tables": []},
            normalize_value_fn=lambda v: str(v).strip() if v is not None and str(v).strip() else None,
            default_family="inet",
            default_tables=("filter", "nat", "raw", "mangle"),
            list_rules_fn=lambda: [{"id": "r1", "table": "nat"}],
            read_sets_fn=lambda: {"addr": [], "port": [], "iface": []},
            read_maps_fn=lambda: {"map": [], "vmap": []},
            read_objects_fn=lambda: {"objects": []},
            collect_table_defs_fn=lambda: {("inet", "nat"): []},
            reset_named_counters_fn=lambda family, table_name: False,
            reset_named_quotas_fn=lambda family, table_name: False,
            read_stats_fn=lambda: {"r1": {"x": 1}},
            write_stats_fn=lambda payload: None,
            apply_rules_fn=lambda: applied.update(count=applied["count"] + 1),
            delete_table_fn=lambda family, table_name: deleted.append((family, table_name)),
            append_table_script_lines_fn=_append,
            apply_script_fn=lambda script: scripts.append(script),
            table_prefix="",
        )

        self.assertEqual(applied["count"], 0)
        self.assertEqual(deleted, [("inet", "nat")])
        self.assertEqual(scripts, ["nat-script\n"])
        self.assertFalse(result["named_reset_supported"])

    def test_reset_counters_rejects_unknown_table(self):
        with self.assertRaisesRegex(ValueError, "table must be one of built-in or existing custom tables"):
            runtime_ops.reset_counters(
                table="unknown",
                read_tables_fn=lambda: {"tables": []},
                normalize_value_fn=lambda v: str(v).strip() if v is not None and str(v).strip() else None,
                default_family="inet",
                default_tables=("filter", "nat", "raw", "mangle"),
                list_rules_fn=lambda: [],
                read_sets_fn=lambda: {"addr": [], "port": [], "iface": []},
                read_maps_fn=lambda: {"map": [], "vmap": []},
                read_objects_fn=lambda: {"objects": []},
                collect_table_defs_fn=lambda: {},
                reset_named_counters_fn=lambda family, table_name: False,
                reset_named_quotas_fn=lambda family, table_name: False,
                read_stats_fn=lambda: {},
                write_stats_fn=lambda payload: None,
                apply_rules_fn=lambda: None,
                delete_table_fn=lambda family, table_name: None,
                append_table_script_lines_fn=lambda *args, **kwargs: None,
                apply_script_fn=lambda script: None,
                table_prefix="",
            )


if __name__ == "__main__":
    unittest.main()
