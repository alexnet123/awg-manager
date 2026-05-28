import unittest

from backend.domains.firewall import state_ops


class FirewallStateOpsTest(unittest.TestCase):
    def test_get_state_aggregates_runtime_and_persists_stats(self):
        writes = []
        calls = {"counter_index": 0}

        def _list_rules():
            return [{"id": "r1", "table": "filter", "chain": "input", "enabled": True}]

        def _counter_index(prefix):
            calls["counter_index"] += 1
            self.assertEqual(prefix, "")
            return True, {("inet", "filter", "input"): [{"packets": 5, "bytes": 10}]}

        def _build_runtime(rules, rules_by_table_chain, family):
            self.assertEqual(family, "inet")
            self.assertEqual(len(rules), 1)
            self.assertIn(("inet", "filter", "input"), rules_by_table_chain)
            return {"r1": {"packets": 5, "bytes": 10}}

        def _enrich(rules, runtime_counters, stats_store, now_ts):
            self.assertEqual(runtime_counters["r1"]["packets"], 5)
            self.assertEqual(stats_store, {"r1": {"history": []}})
            self.assertEqual(now_ts, 123.0)
            enriched = [dict(rules[0], runtime_packets=5, runtime_bytes=10)]
            return enriched, {"r1": {"last": {"t": 123.0, "packets": 5, "bytes": 10}, "history": []}}

        result = state_ops.get_state(
            list_rules_fn=_list_rules,
            get_ruleset_text_fn=lambda: "ruleset text",
            get_ruleset_counter_index_fn=_counter_index,
            build_runtime_counters_by_rule_fn=_build_runtime,
            default_family="inet",
            table_prefix="",
            read_stats_fn=lambda: {"r1": {"history": []}},
            enrich_rules_with_runtime_stats_fn=_enrich,
            now_ts_fn=lambda: 123.0,
            write_stats_fn=lambda payload: writes.append(dict(payload)),
        )

        self.assertTrue(result["active"])
        self.assertEqual(result["ruleset"], "ruleset text")
        self.assertEqual(result["family"], "inet")
        self.assertEqual(result["tables"], ["filter", "nat", "raw", "mangle"])
        self.assertEqual(result["rules"][0]["runtime_packets"], 5)
        self.assertEqual(calls["counter_index"], 1)
        self.assertEqual(len(writes), 1)
        self.assertIn("r1", writes[0])


if __name__ == "__main__":
    unittest.main()
