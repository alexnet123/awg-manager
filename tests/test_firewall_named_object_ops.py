import unittest

from backend.domains.firewall import named_object_ops


class FirewallNamedObjectOpsTest(unittest.TestCase):
    def test_append_enabled_named_object_script_lines(self):
        lines = []

        def _render(item):
            return f'add-object {item["name"]}'

        named_object_ops.append_enabled_named_object_script_lines(
            script_lines=lines,
            table_family="inet",
            nft_table="filter",
            named_objects_data={
                "objects": [
                    {"name": "ok1", "family": "inet", "table": "filter", "enabled": True},
                    {"name": "skip-disabled", "family": "inet", "table": "filter", "enabled": False},
                    {"name": "skip-family", "family": "bridge", "table": "filter", "enabled": True},
                    {"name": "skip-table", "family": "inet", "table": "nat", "enabled": True},
                    "not-a-dict",
                ]
            },
            render_stmt_fn=_render,
        )
        self.assertEqual(lines, ["add-object ok1"])

    def test_validate_runtime_named_object_references(self):
        load_calls = []

        def _load_effective_objects(family, table):
            load_calls.append((family, table))
            return {
                "ct_helper": {"h1"},
                "ct_timeout": {"t1"},
                "ct_expectation": {"e1"},
                "counter": {"c1"},
                "limit": {"l1"},
                "quota": {"q1"},
            }

        named_object_ops.validate_runtime_named_object_references(
            validate_runtime_objects=False,
            family="bridge",
            nft_table="policy2",
            ct_helper_set="h1",
            ct_timeout_set="t1",
            ct_expectation_set=None,
            counter_name=None,
            limit_name=None,
            quota_name=None,
            load_effective_objects_fn=_load_effective_objects,
        )
        self.assertEqual(load_calls, [])

        named_object_ops.validate_runtime_named_object_references(
            validate_runtime_objects=True,
            family="inet",
            nft_table="filter",
            ct_helper_set="h1",
            ct_timeout_set=None,
            ct_expectation_set=None,
            counter_name=None,
            limit_name=None,
            quota_name=None,
            load_effective_objects_fn=_load_effective_objects,
        )
        self.assertEqual(load_calls, [])

        named_object_ops.validate_runtime_named_object_references(
            validate_runtime_objects=True,
            family="bridge",
            nft_table="policy2",
            ct_helper_set="h1",
            ct_timeout_set="t1",
            ct_expectation_set="e1",
            counter_name="c1",
            limit_name="l1",
            quota_name="q1",
            load_effective_objects_fn=_load_effective_objects,
        )
        self.assertEqual(load_calls, [("bridge", "policy2")])

        with self.assertRaisesRegex(ValueError, 'ct_helper_set references missing ct helper object "missing"'):
            named_object_ops.validate_runtime_named_object_references(
                validate_runtime_objects=True,
                family="bridge",
                nft_table="policy2",
                ct_helper_set="missing",
                ct_timeout_set=None,
                ct_expectation_set=None,
                counter_name=None,
                limit_name=None,
                quota_name=None,
                load_effective_objects_fn=_load_effective_objects,
            )

    def test_ensure_named_object_exists(self):
        objects_by_kind = {"counter": {"c1"}}
        named_object_ops.ensure_named_object_exists(objects_by_kind, "counter", "c1", "counter_name")
        named_object_ops.ensure_named_object_exists(objects_by_kind, "counter", None, "counter_name")
        with self.assertRaisesRegex(ValueError, 'counter_name references missing counter object "c2"'):
            named_object_ops.ensure_named_object_exists(objects_by_kind, "counter", "c2", "counter_name")

    def test_render_named_object_add_statement(self):
        def _norm(v):
            if v is None:
                return None
            t = str(v).strip()
            return t or None

        stmt_counter = named_object_ops.render_named_object_add_statement(
            {
                "kind": "counter",
                "family": "inet",
                "table": "filter",
                "name": "c1",
                "comment": "ok",
                "config": {"packets": 10, "bytes": 20},
            },
            normalize_value_fn=_norm,
        )
        self.assertEqual(stmt_counter, 'add counter inet filter c1 { packets 10 bytes 20; comment "ok"; }')

        stmt_limit = named_object_ops.render_named_object_add_statement(
            {
                "kind": "limit",
                "family": "inet",
                "table": "filter",
                "name": "l1",
                "config": {"rate": "10/second", "burst": "5", "over": True},
            },
            normalize_value_fn=_norm,
        )
        self.assertEqual(stmt_limit, "add limit inet filter l1 { rate over 10/second burst 5 packets; }")

        with self.assertRaisesRegex(ValueError, "unsupported object kind"):
            named_object_ops.render_named_object_add_statement(
                {"kind": "unknown", "family": "inet", "table": "filter", "name": "x", "config": {}},
                normalize_value_fn=_norm,
            )

    def test_normalize_named_object_payload(self):
        validate_calls = []

        def _norm(v):
            if v is None:
                return None
            t = str(v).strip()
            return t or None

        def _norm_bool(v):
            if isinstance(v, bool):
                return v
            return str(v).lower() in ("1", "true", "yes", "on")

        def _norm_timeout(v):
            return _norm(v)

        def _validate_table_exists(family, table):
            validate_calls.append((family, table))

        item = named_object_ops.normalize_named_object_payload(
            payload={
                "kind": "limit",
                "family": "inet",
                "table": "filter",
                "name": "OBJ-1",
                "rate": "10/second",
                "burst": "5",
                "over": "true",
                "enabled": "1",
                "comment": 'quoted "comment"',
            },
            normalize_value_fn=_norm,
            normalize_bool_fn=_norm_bool,
            normalize_timeout_fn=_norm_timeout,
            validate_table_exists_fn=_validate_table_exists,
            default_family="inet",
            supported_families=("inet", "ip", "ip6", "bridge", "netdev"),
            supported_kinds=("counter", "limit", "quota", "ct_helper", "ct_timeout", "ct_expectation"),
            id_factory=lambda: "fixed-id",
        )
        self.assertEqual(validate_calls, [("inet", "filter")])
        self.assertEqual(item["id"], "fixed-id")
        self.assertEqual(item["name"], "obj-1")
        self.assertTrue(item["enabled"])
        self.assertEqual(item["comment"], "quoted 'comment'")
        self.assertEqual(item["config"]["rate"], "10/second")
        self.assertEqual(item["config"]["burst"], "5")
        self.assertTrue(item["config"]["over"])

        with self.assertRaisesRegex(ValueError, "table is invalid"):
            named_object_ops.normalize_named_object_payload(
                payload={"kind": "counter", "family": "inet", "table": "bad space", "name": "x"},
                normalize_value_fn=_norm,
                normalize_bool_fn=_norm_bool,
                normalize_timeout_fn=_norm_timeout,
                validate_table_exists_fn=_validate_table_exists,
                default_family="inet",
                supported_families=("inet", "ip", "ip6", "bridge", "netdev"),
                supported_kinds=("counter", "limit", "quota", "ct_helper", "ct_timeout", "ct_expectation"),
            )

    def test_list_named_objects_handles_inactive_and_active_tables(self):
        objects_state = {
            "objects": [
                {"id": "o1", "family": "inet", "table": "filter", "kind": "counter", "name": "c1", "enabled": True},
                {"id": "o2", "family": "inet", "table": "filter", "kind": "quota", "name": "q1", "enabled": True},
            ]
        }

        def _parse_query(family, table):
            return (str(family or "inet"), str(table or "filter"))

        inactive = named_object_ops.list_named_objects(
            family="inet",
            table="filter",
            parse_query_fn=_parse_query,
            read_objects_fn=lambda: {"objects": [dict(x) for x in objects_state["objects"]]},
            supported_kinds=("counter", "quota"),
            collect_table_defs_fn=lambda: {},
            load_effective_objects_fn=lambda family, table: {},
        )
        self.assertEqual(inactive["family"], "inet")
        self.assertEqual(inactive["table"], "filter")
        self.assertEqual(inactive["items"], [])

        active = named_object_ops.list_named_objects(
            family="inet",
            table="filter",
            parse_query_fn=_parse_query,
            read_objects_fn=lambda: {"objects": [dict(x) for x in objects_state["objects"]]},
            supported_kinds=("counter", "quota"),
            collect_table_defs_fn=lambda: {("inet", "filter"): []},
            load_effective_objects_fn=lambda family, table: {"counter": {"c1"}, "quota": {"q1"}},
        )
        self.assertEqual({x["name"] for x in active["items"]}, {"c1", "q1"})
        self.assertEqual(active["counter"], ["c1"])
        self.assertEqual(active["quota"], ["q1"])

    def test_create_upsert_update_delete_flow(self):
        objects_state = {"objects": []}
        rules_state = {"rules": []}
        applied = {"count": 0}

        def _read_objects():
            return {"objects": [dict(x) for x in objects_state["objects"]]}

        def _write_objects(data):
            objects_state["objects"] = [dict(x) for x in data.get("objects", [])]

        def _normalize_item(payload):
            body = dict(payload or {})
            body.setdefault("id", "o1")
            body.setdefault("family", "inet")
            body.setdefault("table", "filter")
            body.setdefault("kind", "counter")
            body.setdefault("name", "c1")
            body.setdefault("enabled", True)
            return body

        def _apply_rules():
            applied["count"] += 1

        def _list_rules():
            return [dict(x) for x in rules_state["rules"]]

        def _normalize_value(v):
            if v is None:
                return None
            t = str(v).strip()
            return t or None

        item = named_object_ops.upsert_named_object(
            payload={},
            apply_now=True,
            read_objects_fn=_read_objects,
            write_objects_fn=_write_objects,
            normalize_item_fn=_normalize_item,
            apply_rules_fn=_apply_rules,
            list_rules_fn=_list_rules,
            normalize_value_fn=_normalize_value,
        )
        self.assertEqual(item["id"], "o1")
        self.assertEqual(len(objects_state["objects"]), 1)
        self.assertEqual(applied["count"], 1)

        created = named_object_ops.create_named_object(
            payload={"id": "o2", "name": "c2"},
            apply_now=False,
            read_objects_fn=_read_objects,
            normalize_value_fn=_normalize_value,
            upsert_named_object_fn=lambda body, apply_now: named_object_ops.upsert_named_object(
                payload=body,
                apply_now=apply_now,
                read_objects_fn=_read_objects,
                write_objects_fn=_write_objects,
                normalize_item_fn=_normalize_item,
                apply_rules_fn=_apply_rules,
                list_rules_fn=_list_rules,
                normalize_value_fn=_normalize_value,
            ),
        )
        self.assertEqual(created["id"], "o2")
        self.assertEqual(applied["count"], 1)

        updated = named_object_ops.update_named_object(
            object_id="o2",
            payload={"name": "c2x"},
            apply_now=False,
            read_objects_fn=_read_objects,
            upsert_named_object_fn=lambda body, apply_now: named_object_ops.upsert_named_object(
                payload=body,
                apply_now=apply_now,
                read_objects_fn=_read_objects,
                write_objects_fn=_write_objects,
                normalize_item_fn=_normalize_item,
                apply_rules_fn=_apply_rules,
                list_rules_fn=_list_rules,
                normalize_value_fn=_normalize_value,
            ),
        )
        self.assertEqual(updated["name"], "c2x")

        deleted = named_object_ops.delete_named_object(
            object_id="o2",
            apply_now=True,
            read_objects_fn=_read_objects,
            write_objects_fn=_write_objects,
            apply_rules_fn=_apply_rules,
            list_rules_fn=_list_rules,
            normalize_value_fn=_normalize_value,
        )
        self.assertEqual(deleted["id"], "o2")
        self.assertEqual(applied["count"], 2)

    def test_create_rejects_duplicate_id_and_delete_checks_references(self):
        objects_state = {
            "objects": [
                {"id": "o1", "family": "inet", "table": "filter", "kind": "counter", "name": "c1", "enabled": True}
            ]
        }
        rules_state = {
            "rules": [
                {"id": "r1", "chain": "input", "family": "inet", "table": "filter", "counter_name": "c1"},
            ]
        }

        def _read_objects():
            return {"objects": [dict(x) for x in objects_state["objects"]]}

        def _write_objects(data):
            objects_state["objects"] = [dict(x) for x in data.get("objects", [])]

        def _normalize_value(v):
            if v is None:
                return None
            t = str(v).strip()
            return t or None

        with self.assertRaisesRegex(ValueError, "object id already exists"):
            named_object_ops.create_named_object(
                payload={"id": "o1"},
                apply_now=False,
                read_objects_fn=_read_objects,
                normalize_value_fn=_normalize_value,
                upsert_named_object_fn=lambda body, apply_now: body,
            )

        with self.assertRaisesRegex(ValueError, "object is in use by 1 firewall rule\\(s\\)"):
            named_object_ops.delete_named_object(
                object_id="o1",
                apply_now=False,
                read_objects_fn=_read_objects,
                write_objects_fn=_write_objects,
                apply_rules_fn=lambda: None,
                list_rules_fn=lambda: [dict(x) for x in rules_state["rules"]],
                normalize_value_fn=_normalize_value,
            )


if __name__ == "__main__":
    unittest.main()
