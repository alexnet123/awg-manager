import json
import types
import unittest
from unittest import mock

from backend.domains.firewall import runtime_adapter


class FirewallRuntimeAdapterTest(unittest.TestCase):
    @mock.patch("backend.domains.firewall.runtime_adapter.subprocess.run")
    def test_list_tables_parses_supported_families(self, run_mock):
        run_mock.return_value = types.SimpleNamespace(
            returncode=0,
            stdout="\n".join(
                [
                    "table inet filter",
                    "table ip6 custom",
                    "table arp ignored",
                    "garbage line",
                ]
            ),
            stderr="",
        )
        rows = runtime_adapter.list_tables(("inet", "ip", "ip6", "bridge", "netdev"))
        self.assertEqual(rows, [("inet", "filter"), ("ip6", "custom")])

    @mock.patch("backend.domains.firewall.runtime_adapter.subprocess.run")
    def test_list_tables_returns_empty_on_nft_error(self, run_mock):
        run_mock.return_value = types.SimpleNamespace(returncode=1, stdout="", stderr="boom")
        self.assertEqual(runtime_adapter.list_tables(("inet", "ip")), [])

    @mock.patch("backend.domains.firewall.runtime_adapter.subprocess.run")
    def test_delete_table_uses_best_effort_call(self, run_mock):
        runtime_adapter.delete_table("inet", "filter")
        run_mock.assert_called_once()
        args = run_mock.call_args.kwargs
        self.assertEqual(run_mock.call_args.args[0], ["nft", "delete", "table", "inet", "filter"])
        self.assertFalse(args["check"])

    @mock.patch("backend.domains.firewall.runtime_adapter.subprocess.run")
    def test_apply_script_passes_script_as_stdin(self, run_mock):
        runtime_adapter.apply_script("add table inet filter\n")
        run_mock.assert_called_once()
        self.assertEqual(run_mock.call_args.args[0], ["nft", "-f", "-"])
        self.assertEqual(run_mock.call_args.kwargs["input"], b"add table inet filter\n")
        self.assertTrue(run_mock.call_args.kwargs["check"])

    @mock.patch("backend.domains.firewall.runtime_adapter.subprocess.run")
    def test_list_table_objects_by_kind_parses_runtime_objects(self, run_mock):
        run_mock.return_value = types.SimpleNamespace(
            returncode=0,
            stdout="\n".join(
                [
                    " counter CNT_A { packets 1 bytes 2 }",
                    " limit LIM_A { rate 1/second }",
                    " quota Q_A { over 1024 bytes }",
                    " ct helper H_A { type \"ftp\" protocol tcp; }",
                    " ct timeout T_A { protocol tcp; l3proto ip; }",
                    " ct expectation E_A { protocol tcp; dport 21; }",
                ]
            ),
            stderr="",
        )
        rows = runtime_adapter.list_table_objects_by_kind("inet", "filter")
        self.assertEqual(rows["counter"], {"cnt_a"})
        self.assertEqual(rows["limit"], {"lim_a"})
        self.assertEqual(rows["quota"], {"q_a"})
        self.assertEqual(rows["ct_helper"], {"h_a"})
        self.assertEqual(rows["ct_timeout"], {"t_a"})
        self.assertEqual(rows["ct_expectation"], {"e_a"})

    @mock.patch("backend.domains.firewall.runtime_adapter.subprocess.run")
    def test_list_table_objects_by_kind_returns_empty_on_nft_error(self, run_mock):
        run_mock.return_value = types.SimpleNamespace(returncode=1, stdout="", stderr="boom")
        rows = runtime_adapter.list_table_objects_by_kind("inet", "filter")
        self.assertEqual(rows["counter"], set())
        self.assertEqual(rows["ct_expectation"], set())

    @mock.patch("backend.domains.firewall.runtime_adapter.subprocess.run")
    def test_reset_table_named_counters_returns_true_on_success(self, run_mock):
        run_mock.return_value = types.SimpleNamespace(returncode=0, stdout="", stderr="")
        self.assertTrue(runtime_adapter.reset_table_named_counters("inet", "filter"))
        self.assertEqual(
            run_mock.call_args.args[0],
            ["nft", "reset", "counters", "table", "inet", "filter"],
        )
        self.assertTrue(run_mock.call_args.kwargs["check"])

    @mock.patch("backend.domains.firewall.runtime_adapter.subprocess.run")
    def test_reset_table_named_quotas_returns_false_on_error(self, run_mock):
        run_mock.side_effect = RuntimeError("boom")
        self.assertFalse(runtime_adapter.reset_table_named_quotas("inet", "filter"))

    @mock.patch("backend.domains.firewall.runtime_adapter.subprocess.run")
    def test_get_ruleset_text_returns_stdout(self, run_mock):
        run_mock.return_value = types.SimpleNamespace(stdout="table inet filter {}\n")
        self.assertEqual(runtime_adapter.get_ruleset_text(), "table inet filter {}\n")

    @mock.patch("backend.domains.firewall.runtime_adapter.subprocess.run")
    def test_get_ruleset_counter_index_parses_counters(self, run_mock):
        payload = {
            "nftables": [
                {
                    "rule": {
                        "family": "inet",
                        "table": "filter",
                        "chain": "input",
                        "expr": [{"counter": {"packets": 12, "bytes": 256}}],
                    }
                },
                {"rule": {"family": "inet", "table": "filter", "expr": []}},
            ]
        }
        run_mock.return_value = types.SimpleNamespace(stdout=json.dumps(payload))
        active, index = runtime_adapter.get_ruleset_counter_index("")
        self.assertTrue(active)
        self.assertEqual(index[("inet", "filter", "input")][0], {"packets": 12, "bytes": 256})

    @mock.patch("backend.domains.firewall.runtime_adapter.subprocess.run")
    def test_get_ruleset_counter_index_returns_empty_on_error(self, run_mock):
        run_mock.side_effect = RuntimeError("boom")
        active, index = runtime_adapter.get_ruleset_counter_index("")
        self.assertFalse(active)
        self.assertEqual(index, {})

    @mock.patch("backend.domains.firewall.runtime_adapter.subprocess.run")
    def test_get_ruleset_counter_index_handles_non_dict_counter_payload(self, run_mock):
        payload = {
            "nftables": [
                {
                    "rule": {
                        "family": "inet",
                        "table": "filter",
                        "chain": "input",
                        "expr": [{"counter": "bad"}],
                    }
                }
            ]
        }
        run_mock.return_value = types.SimpleNamespace(stdout=json.dumps(payload))
        active, index = runtime_adapter.get_ruleset_counter_index("")
        self.assertTrue(active)
        self.assertEqual(index[("inet", "filter", "input")][0], {"packets": 0, "bytes": 0})

    def test_build_runtime_counters_by_rule_aligns_rule_order_per_chain(self):
        rules = [
            {"id": "r1", "enabled": True, "family": "inet", "table": "filter", "chain": "input"},
            {"id": "r2", "enabled": True, "family": "inet", "table": "filter", "chain": "input"},
            {"id": "r3", "enabled": False, "family": "inet", "table": "filter", "chain": "input"},
        ]
        chain_index = {
            ("inet", "filter", "input"): [
                {"packets": 1, "bytes": 10},
                {"packets": 2, "bytes": 20},
            ]
        }
        out = runtime_adapter.build_runtime_counters_by_rule(rules, chain_index, "inet")
        self.assertEqual(out["r1"], {"packets": 1, "bytes": 10})
        self.assertEqual(out["r2"], {"packets": 2, "bytes": 20})
        self.assertNotIn("r3", out)

    def test_enrich_rules_with_runtime_stats_updates_history_and_rates(self):
        rules = [{"id": "r1", "counter": True}]
        runtime = {"r1": {"packets": 15, "bytes": 150}}
        stats = {"r1": {"last": {"t": 10.0, "packets": 10, "bytes": 100}, "history": []}}
        enriched, next_stats = runtime_adapter.enrich_rules_with_runtime_stats(rules, runtime, stats, now_ts=12.0)
        self.assertEqual(enriched[0]["runtime_packets"], 15)
        self.assertEqual(enriched[0]["runtime_bytes"], 150)
        self.assertGreater(enriched[0]["runtime_pps"], 0.0)
        self.assertGreater(enriched[0]["runtime_bps"], 0.0)
        self.assertEqual(next_stats["r1"]["last"]["packets"], 15)
        self.assertEqual(next_stats["r1"]["last"]["bytes"], 150)

    def test_enrich_rules_with_runtime_stats_resets_history_when_counter_disabled(self):
        rules = [{"id": "r1", "counter": False}]
        runtime = {"r1": {"packets": 15, "bytes": 150}}
        stats = {"r1": {"last": {"t": 10.0, "packets": 10, "bytes": 100}, "history": [{"t": 11.0}]}}
        enriched, _ = runtime_adapter.enrich_rules_with_runtime_stats(rules, runtime, stats, now_ts=12.0)
        self.assertEqual(enriched[0]["runtime_pps"], 0.0)
        self.assertEqual(enriched[0]["runtime_bps"], 0.0)
        self.assertEqual(len(enriched[0]["runtime_history"]), 1)

    @mock.patch("backend.domains.firewall.runtime_adapter.get_manager")
    def test_apply_rules_delegates_to_manager(self, get_manager_mock):
        manager = mock.Mock()
        get_manager_mock.return_value = manager
        runtime_adapter.apply_rules()
        manager.apply_firewall_rules.assert_called_once_with()


if __name__ == "__main__":
    unittest.main()
