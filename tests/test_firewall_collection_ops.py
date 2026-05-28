import unittest

from backend.domains.firewall import collection_ops


class FirewallCollectionOpsTest(unittest.TestCase):
    def test_append_runtime_collection_script_lines(self):
        def _norm(v):
            if v is None:
                return None
            t = str(v).strip()
            return t or None

        script_lines = []
        collection_ops.append_runtime_collection_script_lines(
            script_lines=script_lines,
            table_family="inet",
            table_name="filter",
            sets_data={
                "addr": [{"name": "a1", "enabled": True, "elements": ["10.0.0.0/24"], "timeout": "30s"}],
                "port": [{"name": "p1", "enabled": True, "elements": ["80", "443"], "timeout": None}],
                "iface": [{"name": "i1", "enabled": True, "elements": ["eth0"], "timeout": "10s"}],
            },
            maps_data={
                "map": [{"name": "m1", "enabled": True, "entries": ["10.0.0.1:192.0.2.1"], "timeout": None, "kind": "map"}],
                "vmap": [{"name": "vm1", "enabled": True, "entries": ["eth0:accept"], "timeout": None, "kind": "vmap"}],
            },
            normalize_value_fn=_norm,
        )
        self.assertIn('add set inet filter a1 { type ipv4_addr; flags interval,timeout; timeout 30s; }', script_lines)
        self.assertIn('add element inet filter a1 { 10.0.0.0/24 }', script_lines)
        self.assertIn('add set inet filter p1 { type inet_service; }', script_lines)
        self.assertIn('add element inet filter p1 { 80, 443 }', script_lines)
        self.assertIn('add set inet filter i1 { type ifname; flags timeout; timeout 10s; }', script_lines)
        self.assertIn('add element inet filter i1 { "eth0" }', script_lines)
        self.assertIn('add map inet filter m1 { type ipv4_addr : ipv4_addr; }', script_lines)
        self.assertIn('add element inet filter m1 { 10.0.0.1 : 192.0.2.1 }', script_lines)
        self.assertIn('add map inet filter vm1 { type ifname : verdict; }', script_lines)
        self.assertIn('add element inet filter vm1 { "eth0" : accept }', script_lines)

    def test_build_map_declaration_and_elements(self):
        def _norm(v):
            if v is None:
                return None
            t = str(v).strip()
            return t or None

        built_map = collection_ops.build_map_declaration_and_elements(
            {
                "kind": "map",
                "timeout": " 30s ",
                "entries": ["10.0.0.0/24:192.0.2.1", "10.0.1.0/24:192.0.2.2"],
            },
            _norm,
        )
        self.assertIsNotNone(built_map)
        decl_map, elems_map = built_map
        self.assertEqual(decl_map, "type ipv4_addr : ipv4_addr; flags interval,timeout; timeout 30s;")
        self.assertEqual(elems_map[0], "10.0.0.0/24 : 192.0.2.1")

        built_vmap = collection_ops.build_map_declaration_and_elements(
            {
                "kind": "vmap",
                "entries": ["eth0:accept", "eth1:drop"],
            },
            _norm,
        )
        self.assertIsNotNone(built_vmap)
        decl_vmap, elems_vmap = built_vmap
        self.assertEqual(decl_vmap, "type ifname : verdict;")
        self.assertEqual(elems_vmap, ['"eth0" : accept', '"eth1" : drop'])

        self.assertIsNone(
            collection_ops.build_map_declaration_and_elements(
                {"kind": "map", "entries": ["broken-entry"]},
                _norm,
            )
        )

    def test_list_collections_applies_when_expired_active_removed(self):
        state = {
            "addr": [{"id": "a1"}],
            "port": [],
        }
        writes = {"count": 0}
        applied = {"count": 0}

        def _read():
            return {"addr": list(state["addr"]), "port": list(state["port"])}

        def _write(data):
            writes["count"] += 1
            state["addr"] = list(data.get("addr", []))
            state["port"] = list(data.get("port", []))

        def _cleanup(rows, _now_ts):
            if rows:
                return [], True, 1
            return rows, False, 0

        def _enrich(item, _now_ts):
            return dict(item)

        def _apply():
            applied["count"] += 1

        result = collection_ops.list_collections(
            kinds=("addr", "port"),
            read_fn=_read,
            write_fn=_write,
            cleanup_expired_fn=_cleanup,
            enrich_item_fn=_enrich,
            apply_rules_fn=_apply,
        )
        self.assertEqual(result["addr"], [])
        self.assertEqual(writes["count"], 1)
        self.assertEqual(applied["count"], 1)

    def test_upsert_collection_validates_kind_and_uniqueness(self):
        state = {"map": [], "vmap": [{"name": "shared"}]}

        def _read():
            return {"map": [dict(x) for x in state["map"]], "vmap": [dict(x) for x in state["vmap"]]}

        def _write(data):
            state["map"] = [dict(x) for x in data.get("map", [])]
            state["vmap"] = [dict(x) for x in data.get("vmap", [])]

        def _normalize_item(payload, kind):
            row = dict(payload or {})
            row.setdefault("id", "m1")
            row.setdefault("name", "shared")
            row.setdefault("enabled", True)
            row.setdefault("timeout", None)
            row["kind"] = kind
            row.setdefault("entries", [])
            return row

        def _sig(row):
            return (row.get("name"), row.get("kind"))

        with self.assertRaisesRegex(ValueError, "map kind must be map\\|vmap"):
            collection_ops.upsert_collection(
                kind="bad",
                payload={},
                allowed_kinds=("map", "vmap"),
                invalid_kind_error="map kind must be map|vmap",
                read_fn=_read,
                write_fn=_write,
                normalize_item_fn=_normalize_item,
                runtime_signature_fn=_sig,
                normalize_value_fn=lambda v: v,
                other_names=lambda data: [x.get("name") for x in data.get("vmap", [])],
                duplicate_error="dup",
                global_error="glob",
                enrich_item_fn=lambda item: item,
                apply_rules_fn=lambda: None,
            )

        with self.assertRaisesRegex(ValueError, "glob"):
            collection_ops.upsert_collection(
                kind="map",
                payload={},
                allowed_kinds=("map", "vmap"),
                invalid_kind_error="map kind must be map|vmap",
                read_fn=_read,
                write_fn=_write,
                normalize_item_fn=_normalize_item,
                runtime_signature_fn=_sig,
                normalize_value_fn=lambda v: v,
                other_names=lambda data: [x.get("name") for x in data.get("vmap", [])],
                duplicate_error="dup",
                global_error="glob",
                enrich_item_fn=lambda item: item,
                apply_rules_fn=lambda: None,
            )

    def test_delete_collection_respects_runtime_changed(self):
        state = {"set": [{"id": "s1", "enabled": False}]}
        applied = {"count": 0}

        def _read():
            return {"set": [dict(x) for x in state["set"]]}

        def _write(data):
            state["set"] = [dict(x) for x in data.get("set", [])]

        def _apply():
            applied["count"] += 1

        item = collection_ops.delete_collection(
            kind="set",
            item_id="s1",
            allowed_kinds=("set",),
            invalid_kind_error="bad kind",
            read_fn=_read,
            write_fn=_write,
            not_found_error="missing",
            apply_rules_fn=_apply,
        )
        self.assertEqual(item["id"], "s1")
        self.assertEqual(applied["count"], 0)


if __name__ == "__main__":
    unittest.main()
