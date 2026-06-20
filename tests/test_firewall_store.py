import pathlib
import tempfile
import unittest

from backend.domains.firewall import store


class FirewallStoreTest(unittest.TestCase):
    def test_rules_roundtrip_supports_dict_wire_shape(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = pathlib.Path(tmp) / "rules.json"
            store.write_rules(str(path), [{"id": "r1"}])
            self.assertEqual(store.read_rules(str(path)), [{"id": "r1"}])

    def test_read_rules_filters_non_dict_rows(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = pathlib.Path(tmp) / "rules.json"
            store.write_rules(str(path), [{"id": "r1"}, "bad", 1, None])
            self.assertEqual(store.read_rules(str(path)), [{"id": "r1"}])

    def test_objects_and_tables_filter_non_dict_rows(self):
        with tempfile.TemporaryDirectory() as tmp:
            objects_path = pathlib.Path(tmp) / "objects.json"
            tables_path = pathlib.Path(tmp) / "tables.json"
            store.write_objects(str(objects_path), {"objects": [{"id": 1}, "bad", 3]})
            store.write_tables(str(tables_path), {"tables": [{"id": "t1"}, "bad"]})
            self.assertEqual(store.read_objects(str(objects_path)), {"objects": [{"id": 1}]})
            self.assertEqual(store.read_tables(str(tables_path)), {"tables": [{"id": "t1"}]})

    def test_sets_and_maps_filter_non_dict_rows(self):
        with tempfile.TemporaryDirectory() as tmp:
            sets_path = pathlib.Path(tmp) / "sets.json"
            maps_path = pathlib.Path(tmp) / "maps.json"
            store.write_sets(str(sets_path), {"addr": [{"id": "a1"}, "bad"], "port": ["bad"], "iface": [1, {"id": "i1"}]})
            store.write_maps(str(maps_path), {"map": [{"id": "m1"}, "bad"], "vmap": [None, {"id": "vm1"}]})
            self.assertEqual(
                store.read_sets(str(sets_path)),
                {"addr": [{"id": "a1"}], "port": [], "iface": [{"id": "i1"}]},
            )
            self.assertEqual(
                store.read_maps(str(maps_path)),
                {"map": [{"id": "m1"}], "vmap": [{"id": "vm1"}]},
            )

    def test_managed_tables_are_normalized_and_unique(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = pathlib.Path(tmp) / "managed.json"

            def _normalize(v):
                if v is None:
                    return None
                t = str(v).strip()
                return t or None

            store.write_managed_tables(str(path), {"tables": [" Inet:Filter ", "inet:filter", "", None]}, _normalize)
            self.assertEqual(store.read_managed_tables(str(path), _normalize), {"tables": ["inet:filter"]})

    def test_parse_managed_table_key_preserves_legacy_format(self):
        def _normalize(v):
            if v is None:
                return None
            t = str(v).strip()
            return t or None

        supported = ("inet", "ip", "ip6", "bridge", "netdev")
        self.assertEqual(
            store.parse_managed_table_key("IP6:MyTable", _normalize, supported, "inet"),
            ("ip6", "mytable"),
        )
        self.assertEqual(
            store.parse_managed_table_key("legacy_table", _normalize, supported, "inet"),
            ("inet", "legacy_table"),
        )
        self.assertIsNone(store.parse_managed_table_key("   ", _normalize, supported, "inet"))

    def test_collect_table_defs_merges_defaults_and_enabled_custom_rows(self):
        default_defs = {
            "filter": [("input", "filter", "input", 0, None, "accept")],
        }
        custom_rows = [
            {
                "family": "ip6",
                "table_name": "custom",
                "chain_name": "ingress",
                "chain_type": "filter",
                "hook": "input",
                "priority": "10",
                "enabled": "yes",
            },
            {
                "family": "inet",
                "table_name": "disabled",
                "chain_name": "x",
                "chain_type": "filter",
                "hook": "input",
                "priority": 1,
                "enabled": False,
            },
            "bad",
        ]

        def _normalize(v):
            if v is None:
                return None
            t = str(v).strip()
            return t or None

        table_defs = store.collect_table_defs(
            default_defs,
            custom_rows,
            _normalize,
            ("inet", "ip", "ip6", "bridge", "netdev"),
            "inet",
        )
        self.assertIn(("inet", "filter"), table_defs)
        self.assertIn(("ip6", "custom"), table_defs)
        self.assertNotIn(("inet", "disabled"), table_defs)

    def test_collect_table_defs_preserves_custom_chain_device_and_policy(self):
        default_defs = {}
        custom_rows = [
            {
                "family": "netdev",
                "table_name": "edge_ingress",
                "chain_name": "ingress_lan",
                "chain_type": "filter",
                "hook": "ingress",
                "priority": -500,
                "device": "eth0",
                "policy": "drop",
                "enabled": True,
            },
            {
                "family": "bridge",
                "table_name": "br_filter",
                "chain_name": "br_forward",
                "chain_type": "filter",
                "hook": "forward",
                "priority": -200,
                "policy": "accept",
                "enabled": True,
            },
        ]

        def _normalize(v):
            if v is None:
                return None
            t = str(v).strip()
            return t or None

        table_defs = store.collect_table_defs(
            default_defs,
            custom_rows,
            _normalize,
            ("inet", "ip", "ip6", "bridge", "netdev"),
            "inet",
        )

        self.assertEqual(
            table_defs[("netdev", "edge_ingress")],
            [("ingress_lan", "filter", "ingress", -500, "eth0", "drop")],
        )
        self.assertEqual(
            table_defs[("bridge", "br_filter")],
            [("br_forward", "filter", "forward", -200, None, "accept")],
        )

    def test_enrich_collection_item_runtime_computes_remaining_timeout(self):
        def _timeout_to_seconds(value):
            return 30 if str(value) == "30s" else None

        row = {
            "enabled": True,
            "timeout": "30s",
            "created_at": "10",
            "timeout_started_at": "20",
        }
        out = store.enrich_collection_item_runtime(row, _timeout_to_seconds, now_ts=35)
        self.assertEqual(out["created_at"], 10)
        self.assertEqual(out["timeout_started_at"], 20)
        self.assertEqual(out["timeout_seconds"], 30)
        self.assertEqual(out["timeout_remaining_seconds"], 15)

    def test_cleanup_expired_collection_rows_drops_expired_enabled_rows(self):
        def _timeout_to_seconds(value):
            return 10 if str(value) == "10s" else None

        rows = [
            {"id": "1", "enabled": True, "timeout": "10s", "created_at": 1},
            {"id": "2", "enabled": False, "timeout": "10s", "created_at": 1},
            {"id": "3", "enabled": True, "timeout": None},
        ]
        kept, changed, removed_active = store.cleanup_expired_collection_rows(rows, now_ts=20, timeout_to_seconds_fn=_timeout_to_seconds)
        self.assertTrue(changed)
        self.assertEqual(removed_active, 1)
        kept_ids = sorted(str(x.get("id")) for x in kept)
        self.assertEqual(kept_ids, ["3"])

    def test_runtime_signatures_are_stable_and_normalized(self):
        def _normalize(v):
            if v is None:
                return None
            t = str(v).strip()
            return t or None

        set_sig = store.set_runtime_signature(
            {"name": "s1", "enabled": "yes", "timeout": " 10s ", "elements": [" 1.1.1.1 ", "", None, "1.1.1.1"]},
            _normalize,
        )
        map_sig = store.map_runtime_signature(
            {"name": "m1", "enabled": True, "timeout": "5s", "kind": "map", "entries": [" a:b ", "a:b", " "]},
            _normalize,
        )
        self.assertEqual(set_sig, ("s1", True, "10s", False, None, None, ("1.1.1.1",)))
        self.assertEqual(map_sig, ("m1", True, "5s", "map", ("a:b",)))

    def test_normalize_set_item_validates_and_normalizes_addr_set(self):
        def _normalize(v):
            if v is None:
                return None
            t = str(v).strip()
            return t or None

        def _timeout(v):
            return "30s" if str(v).strip() else None

        row = store.normalize_set_item(
            {"name": "lan", "elements": ["10.0.0.1/24", "10.0.0.1/24", " "], "enabled": "yes", "timeout": "30s"},
            "addr",
            _normalize,
            _timeout,
        )
        self.assertEqual(row["name"], "lan")
        self.assertEqual(row["elements"], ["10.0.0.1/24"])
        self.assertTrue(row["enabled"])
        self.assertEqual(row["timeout"], "30s")

    def test_normalize_set_item_rejects_invalid_port(self):
        def _normalize(v):
            if v is None:
                return None
            t = str(v).strip()
            return t or None

        with self.assertRaisesRegex(ValueError, "port element must be 1..65535"):
            store.normalize_set_item(
                {"name": "ports", "elements": ["70000"]},
                "port",
                _normalize,
                lambda v: None,
            )

    def test_normalize_set_item_dynamic_requires_timeout_and_size(self):
        def _normalize(v):
            if v is None:
                return None
            t = str(v).strip()
            return t or None

        def _timeout(v):
            return str(v).strip() if v else None

        row = store.normalize_set_item(
            {
                "name": "ssh_flood",
                "elements": [],
                "enabled": True,
                "timeout": "10s",
                "dynamic": "yes",
                "size": "65536",
                "gc_interval": "30s",
            },
            "addr",
            _normalize,
            _timeout,
        )
        self.assertTrue(row["dynamic"])
        self.assertEqual(row["size"], 65536)
        self.assertEqual(row["gc_interval"], "30s")

        for payload, message in (
            ({"name": "no_timeout", "dynamic": True, "size": "10"}, "dynamic sets require timeout"),
            ({"name": "no_size", "dynamic": True, "timeout": "10s"}, "dynamic sets require size"),
            ({"name": "bad_size", "dynamic": True, "timeout": "10s", "size": "0"}, "size must be 1..1000000"),
            ({"name": "gc_without_timeout", "gc_interval": "10s"}, "gc_interval requires timeout"),
        ):
            with self.assertRaisesRegex(ValueError, message):
                store.normalize_set_item(payload, "addr", _normalize, _timeout)

    def test_normalize_map_item_validates_key_value_entries(self):
        def _normalize(v):
            if v is None:
                return None
            t = str(v).strip()
            return t or None

        row = store.normalize_map_item(
            {"name": "nat_map", "entries": ["10.0.0.1:192.168.0.1", "10.0.0.1:192.168.0.1"], "enabled": "true"},
            "map",
            _normalize,
            lambda v: None,
        )
        self.assertEqual(row["entries"], ["10.0.0.1:192.168.0.1"])
        with self.assertRaisesRegex(ValueError, 'entry must be "key:value"'):
            store.normalize_map_item(
                {"name": "bad", "entries": ["no-separator"]},
                "map",
                _normalize,
                lambda v: None,
            )

    def test_normalize_vmap_item_validates_verdict_values(self):
        def _normalize(v):
            if v is None:
                return None
            t = str(v).strip()
            return t or None

        row = store.normalize_map_item(
            {"name": "iface_verdicts", "entries": ["eth0:accept", "eth1:drop", "eth0:accept"]},
            "vmap",
            _normalize,
            lambda v: None,
        )
        self.assertEqual(row["entries"], ["eth0:accept", "eth1:drop"])

        with self.assertRaisesRegex(ValueError, "vmap verdict must be one of"):
            store.normalize_map_item(
                {"name": "bad_vmap", "entries": ["eth0:not_a_verdict"]},
                "vmap",
                _normalize,
                lambda v: None,
            )

    def test_prepare_collection_kind_rows_fills_runtime_timestamps(self):
        rows = [{"id": "1", "name": "a", "timeout": "30s", "enabled": True, "created_at": None, "timeout_started_at": None}]

        def _cleanup(source_rows, now_ts):
            return source_rows, False, 0

        def _enrich(item, now_ts):
            return {"id": item["id"], "now": now_ts, "created_at": item.get("created_at")}

        normalized, response, changed, removed_active = store.prepare_collection_kind_rows(rows, 100, _cleanup, _enrich)
        self.assertTrue(changed)
        self.assertEqual(removed_active, 0)
        self.assertEqual(normalized[0]["created_at"], 100)
        self.assertEqual(normalized[0]["timeout_started_at"], 100)
        self.assertEqual(response[0]["id"], "1")

    def test_upsert_collection_rows_sets_created_timeout_on_insert(self):
        item = {"id": "i1", "name": "x", "enabled": True, "timeout": "10s"}

        def _sig(row):
            return (row.get("name"), row.get("timeout"), bool(row.get("enabled", True)))

        out, row_item, runtime_changed = store.upsert_collection_rows([], item, 50, _sig, lambda v: v)
        self.assertTrue(runtime_changed)
        self.assertEqual(len(out), 1)
        self.assertEqual(row_item["created_at"], 50)
        self.assertEqual(row_item["timeout_started_at"], 50)

    def test_upsert_collection_rows_blocks_update_of_temporary_row(self):
        existing = [{"id": "i1", "name": "x", "enabled": True, "timeout": "10s"}]
        item = {"id": "i1", "name": "x2", "enabled": True, "timeout": "10s"}

        def _sig(row):
            return (row.get("name"), row.get("timeout"), bool(row.get("enabled", True)))

        with self.assertRaisesRegex(ValueError, "temporary collections are read-only; delete and recreate"):
            store.upsert_collection_rows(existing, item, 50, _sig, lambda v: v)

    def test_ensure_unique_collection_names_validates_duplicates_and_global_collision(self):
        rows = [{"name": "a"}, {"name": "a"}]
        with self.assertRaisesRegex(ValueError, "dup"):
            store.ensure_unique_collection_names(rows, "a", ["x"], "dup", "glob")
        with self.assertRaisesRegex(ValueError, "glob"):
            store.ensure_unique_collection_names([{"name": "a"}], "a", ["a"], "dup", "glob")

    def test_delete_collection_row_returns_existing_and_runtime_change(self):
        rows = [{"id": "1", "enabled": False}, {"id": "2", "enabled": True}]
        out, existing, runtime_changed = store.delete_collection_row(rows, "2", "missing")
        self.assertEqual([x["id"] for x in out], ["1"])
        self.assertEqual(existing["id"], "2")
        self.assertTrue(runtime_changed)
        with self.assertRaisesRegex(LookupError, "missing"):
            store.delete_collection_row(rows, "3", "missing")

    def test_build_tables_listing_returns_builtin_and_custom(self):
        default_defs = {
            "filter": [("input", "filter", "input", 0, None, "accept")],
        }
        custom_rows = [
            {"id": "c1", "table_name": "custom", "family": "IP6"},
            "bad",
        ]
        out = store.build_tables_listing(default_defs, custom_rows, "inet")
        self.assertEqual(len(out["builtin"]), 1)
        self.assertEqual(out["builtin"][0]["id"], "builtin:filter:input:input:0")
        self.assertEqual(out["builtin"][0]["family"], "inet")
        self.assertEqual(len(out["custom"]), 1)
        self.assertEqual(out["custom"][0]["family"], "ip6")
        self.assertFalse(out["custom"][0]["builtin"])

    def test_parse_named_objects_query_validates_family_and_table(self):
        def _normalize(v):
            if v is None:
                return None
            t = str(v).strip()
            return t or None

        family, table = store.parse_named_objects_query("IP6", " custom ", _normalize, ("inet", "ip", "ip6"))
        self.assertEqual((family, table), ("ip6", "custom"))
        with self.assertRaisesRegex(ValueError, "family must be one of"):
            store.parse_named_objects_query("arp", "x", _normalize, ("inet", "ip", "ip6"))
        with self.assertRaisesRegex(ValueError, "table is invalid"):
            store.parse_named_objects_query("inet", "bad table", _normalize, ("inet", "ip", "ip6"))

    def test_filter_and_build_named_objects_listing(self):
        rows = [
            {"id": "1", "family": "inet", "table": "filter", "kind": "counter", "name": "c1"},
            {"id": "2", "family": "ip6", "table": "filter", "kind": "counter", "name": "c2"},
            {"id": "3", "family": "inet", "table": "filter", "kind": "bad", "name": "x"},
        ]
        filtered = store.filter_declared_named_objects(rows, "inet", "filter", ("counter", "limit"))
        self.assertEqual([x["id"] for x in filtered], ["1"])
        inactive = store.build_named_objects_listing("inet", "filter", filtered, table_is_active=False)
        self.assertEqual(inactive["counter"], [])
        self.assertEqual(inactive["items"], [])
        active = store.build_named_objects_listing(
            "inet",
            "filter",
            filtered,
            objects_by_kind={"counter": {"c1", "c0"}},
            table_is_active=True,
        )
        self.assertEqual(active["counter"], ["c0", "c1"])
        self.assertEqual(active["items"], filtered)

    def test_named_object_helpers_reference_and_upsert_delete(self):
        def _normalize(v):
            if v is None:
                return None
            t = str(v).strip()
            return t or None

        rules = [
            {"id": "r1", "chain": "input", "family": "inet", "table": "filter", "counter_name": "c1"},
            {"id": "r2", "chain": "forward", "family": "inet", "table": "filter", "counter_name": "c2"},
        ]
        refs = store.find_named_object_references(rules, "inet", "filter", "counter", "c1", _normalize)
        self.assertEqual(refs, [{"rule_id": "r1", "chain": "input"}])
        self.assertEqual(store.named_object_rule_reference(rules[0], "counter", _normalize), "c1")

        rows = [{"id": "o1", "family": "inet", "table": "filter", "kind": "counter", "name": "c1"}]
        upserted = store.upsert_named_object_rows(rows, {"id": "o1", "family": "inet", "table": "filter", "kind": "counter", "name": "c1x"})
        self.assertEqual(upserted[0]["name"], "c1x")
        appended = store.upsert_named_object_rows(rows, {"id": "o2", "family": "inet", "table": "filter", "kind": "counter", "name": "c2"})
        self.assertEqual(len(appended), 2)
        store.ensure_unique_named_object_signatures(appended)
        with self.assertRaisesRegex(ValueError, "object name must be unique inside family/table/kind"):
            store.ensure_unique_named_object_signatures(rows + [{"id": "o2", "family": "inet", "table": "filter", "kind": "counter", "name": "c1"}])

        out, existing = store.delete_named_object_row(appended, "o2", "object not found")
        self.assertEqual(existing["id"], "o2")
        self.assertEqual(len(out), 1)
        with self.assertRaisesRegex(LookupError, "object not found"):
            store.delete_named_object_row(out, "missing", "object not found")

    def test_table_row_helpers_upsert_unique_delete_and_cleanup_objects(self):
        rows = [{"id": "t1", "family": "inet", "table_name": "a", "chain_name": "c1", "hook": "input", "priority": 0}]
        upserted = store.upsert_table_rows(rows, {"id": "t2", "family": "inet", "table_name": "a", "chain_name": "c2", "hook": "input", "priority": 1})
        self.assertEqual(len(upserted), 2)
        store.ensure_unique_table_signatures(upserted, "inet")
        with self.assertRaisesRegex(ValueError, "duplicate chain/hook/priority in same table"):
            store.ensure_unique_table_signatures(
                upserted + [{"id": "t3", "family": "inet", "table_name": "a", "chain_name": "c2", "hook": "input", "priority": 1}],
                "inet",
            )

        out, existing = store.delete_table_row(upserted, "t2", "table not found")
        self.assertEqual(existing["id"], "t2")
        self.assertEqual(len(out), 1)
        with self.assertRaisesRegex(LookupError, "table not found"):
            store.delete_table_row(out, "missing", "table not found")

        objects = [
            {"id": "o1", "family": "inet", "table": "a"},
            {"id": "o2", "family": "ip6", "table": "a"},
            {"id": "o3", "family": "inet", "table": "b"},
        ]
        cleaned, changed = store.remove_objects_for_table(objects, "inet", "a")
        self.assertTrue(changed)
        self.assertEqual([x["id"] for x in cleaned], ["o2", "o3"])

    def test_normalize_firewall_table_item_valid_and_rejects_reserved_priority(self):
        def _normalize(v):
            if v is None:
                return None
            t = str(v).strip()
            return t or None

        item = store.normalize_firewall_table_item(
            {
                "family": "ip6",
                "table_name": "custom",
                "chain_name": "input_c",
                "chain_type": "filter",
                "hook": "input",
                "priority": 10,
                "policy": "accept",
            },
            _normalize,
            default_family="inet",
            supported_families=("inet", "ip", "ip6", "bridge", "netdev"),
            reserved_priorities={0, 100},
        )
        self.assertEqual(item["family"], "ip6")
        self.assertEqual(item["table_name"], "custom")
        self.assertEqual(item["priority"], 10)
        with self.assertRaisesRegex(ValueError, "priority is reserved by built-in tables"):
            store.normalize_firewall_table_item(
                {
                    "family": "inet",
                    "table_name": "x",
                    "chain_name": "c",
                    "chain_type": "filter",
                    "hook": "input",
                    "priority": 0,
                },
                _normalize,
                default_family="inet",
                supported_families=("inet", "ip", "ip6", "bridge", "netdev"),
                reserved_priorities={0, 100},
            )

    def test_normalize_firewall_table_item_netdev_requires_ingress_and_device(self):
        def _normalize(v):
            if v is None:
                return None
            t = str(v).strip()
            return t or None

        item = store.normalize_firewall_table_item(
            {
                "family": "netdev",
                "table_name": "Edge_Ingress",
                "chain_name": "ingress_lan",
                "chain_type": "filter",
                "hook": "ingress",
                "device": "eth0",
                "priority": -500,
                "policy": "drop",
                "enabled": "yes",
            },
            _normalize,
            default_family="inet",
            supported_families=("inet", "ip", "ip6", "bridge", "netdev"),
            reserved_priorities={0},
        )
        self.assertEqual(item["family"], "netdev")
        self.assertEqual(item["table_name"], "edge_ingress")
        self.assertEqual(item["chain_name"], "ingress_lan")
        self.assertEqual(item["hook"], "ingress")
        self.assertEqual(item["device"], "eth0")
        self.assertEqual(item["priority"], -500)
        self.assertEqual(item["policy"], "drop")
        self.assertTrue(item["enabled"])

        with self.assertRaisesRegex(ValueError, "device is required for ingress hook"):
            store.normalize_firewall_table_item(
                {
                    "family": "netdev",
                    "table_name": "x",
                    "chain_name": "c",
                    "chain_type": "filter",
                    "hook": "ingress",
                    "priority": 10,
                },
                _normalize,
                default_family="inet",
                supported_families=("inet", "ip", "ip6", "bridge", "netdev"),
                reserved_priorities={0},
            )
        with self.assertRaisesRegex(ValueError, "netdev egress hook is not supported by current nft runtime profile"):
            store.normalize_firewall_table_item(
                {
                    "family": "netdev",
                    "table_name": "x",
                    "chain_name": "egress_c",
                    "chain_type": "filter",
                    "hook": "egress",
                    "device": "eth0",
                    "priority": 10,
                },
                _normalize,
                default_family="inet",
                supported_families=("inet", "ip", "ip6", "bridge", "netdev"),
                reserved_priorities={0},
            )
        with self.assertRaisesRegex(ValueError, "netdev family supports only chain_type=filter with hook=ingress on current nft runtime profile"):
            store.normalize_firewall_table_item(
                {
                    "family": "netdev",
                    "table_name": "x",
                    "chain_name": "c",
                    "chain_type": "nat",
                    "hook": "prerouting",
                    "priority": 10,
                },
                _normalize,
                default_family="inet",
                supported_families=("inet", "ip", "ip6", "bridge", "netdev"),
                reserved_priorities={0},
            )

    def test_normalize_firewall_table_item_bridge_stays_filter_only_without_ingress(self):
        def _normalize(v):
            if v is None:
                return None
            t = str(v).strip()
            return t or None

        item = store.normalize_firewall_table_item(
            {
                "family": "bridge",
                "table_name": "Bridge_Filter",
                "chain_name": "br_forward",
                "chain_type": "filter",
                "hook": "forward",
                "priority": -200,
                "policy": "accept",
            },
            _normalize,
            default_family="inet",
            supported_families=("inet", "ip", "ip6", "bridge", "netdev"),
            reserved_priorities={0},
        )
        self.assertEqual(item["family"], "bridge")
        self.assertEqual(item["table_name"], "bridge_filter")
        self.assertEqual(item["chain_type"], "filter")
        self.assertEqual(item["hook"], "forward")
        self.assertIsNone(item["device"])

        for payload, message in (
            (
                {
                    "family": "bridge",
                    "table_name": "x",
                    "chain_name": "c",
                    "chain_type": "nat",
                    "hook": "prerouting",
                    "priority": -200,
                },
                "bridge family supports only chain_type=filter",
            ),
            (
                {
                    "family": "bridge",
                    "table_name": "x",
                    "chain_name": "c",
                    "chain_type": "filter",
                    "hook": "ingress",
                    "device": "br0",
                    "priority": -200,
                },
                "bridge family does not support ingress hook in this manager",
            ),
            (
                {
                    "family": "bridge",
                    "table_name": "x",
                    "chain_name": "c",
                    "chain_type": "filter",
                    "hook": "forward",
                    "device": "br0",
                    "priority": -200,
                },
                "device can be set only for ingress hook",
            ),
        ):
            with self.assertRaisesRegex(ValueError, message):
                store.normalize_firewall_table_item(
                    payload,
                    _normalize,
                    default_family="inet",
                    supported_families=("inet", "ip", "ip6", "bridge", "netdev"),
                    reserved_priorities={0},
                )


if __name__ == "__main__":
    unittest.main()
