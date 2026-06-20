import unittest

from backend.domains.firewall import table_ops


class FirewallTableOpsTest(unittest.TestCase):
    def test_list_tables_includes_builtin_and_custom(self):
        def _read_tables():
            return {
                "tables": [
                    {
                        "id": "t1",
                        "family": "inet",
                        "table_name": "custom",
                        "chain_name": "in_custom",
                        "hook": "input",
                        "priority": 10,
                        "enabled": True,
                    }
                ]
            }

        result = table_ops.list_tables(
            read_tables_fn=_read_tables,
            default_table_defs={"filter": [("input", "filter", "input", 0, None, "accept")]},
            default_family="inet",
        )
        builtin_items = {(row["family"], row["table_name"]) for row in result["builtin"]}
        custom_items = {(row["family"], row["table_name"]) for row in result["custom"]}
        self.assertIn(("inet", "filter"), builtin_items)
        self.assertIn(("inet", "custom"), custom_items)

    def test_upsert_table_rejects_builtin_table_names(self):
        tables_state = {"tables": []}

        def _read_tables():
            return {"tables": list(tables_state["tables"])}

        def _write_tables(data):
            tables_state["tables"] = list(data.get("tables", []))

        def _normalize(_payload):
            return {
                "id": "t1",
                "family": "inet",
                "table_name": "filter",
                "chain_name": "custom_in",
                "hook": "input",
                "priority": 10,
            }

        applied = {"count": 0}

        def _apply():
            applied["count"] += 1

        with self.assertRaisesRegex(ValueError, "built-in table names are reserved"):
            table_ops.upsert_table(
                payload={},
                read_tables_fn=_read_tables,
                write_tables_fn=_write_tables,
                normalize_item_fn=_normalize,
                apply_rules_fn=_apply,
                default_family="inet",
                default_table_defs={"filter": []},
            )
        self.assertEqual(applied["count"], 0)

    def test_upsert_and_delete_table_with_related_objects_cleanup(self):
        tables_state = {
            "tables": [
                {
                    "id": "t1",
                    "family": "ip6",
                    "table_name": "custom",
                    "chain_name": "in",
                    "hook": "input",
                    "priority": 10,
                }
            ]
        }
        objects_state = {
            "objects": [
                {"id": "o1", "family": "ip6", "table": "custom"},
                {"id": "o2", "family": "inet", "table": "filter"},
            ]
        }

        def _read_tables():
            return {"tables": [dict(x) for x in tables_state["tables"]]}

        def _write_tables(data):
            tables_state["tables"] = [dict(x) for x in data.get("tables", [])]

        def _read_objects():
            return {"objects": [dict(x) for x in objects_state["objects"]]}

        def _write_objects(data):
            objects_state["objects"] = [dict(x) for x in data.get("objects", [])]

        def _normalize(_payload):
            return {
                "id": "t2",
                "family": "ip6",
                "table_name": "custom",
                "chain_name": "out",
                "hook": "output",
                "priority": 20,
            }

        applied = {"count": 0}

        def _apply():
            applied["count"] += 1

        item = table_ops.upsert_table(
            payload={},
            read_tables_fn=_read_tables,
            write_tables_fn=_write_tables,
            normalize_item_fn=_normalize,
            apply_rules_fn=_apply,
            default_family="inet",
            default_table_defs={"filter": []},
        )
        self.assertEqual(item["id"], "t2")
        self.assertEqual(len(tables_state["tables"]), 2)
        self.assertEqual(applied["count"], 1)

        deleted = table_ops.delete_table(
            table_id="t1",
            read_tables_fn=_read_tables,
            write_tables_fn=_write_tables,
            read_objects_fn=_read_objects,
            write_objects_fn=_write_objects,
            apply_rules_fn=_apply,
            default_family="inet",
        )
        self.assertEqual(deleted["id"], "t1")
        self.assertEqual([x["id"] for x in tables_state["tables"]], ["t2"])
        self.assertEqual([x["id"] for x in objects_state["objects"]], ["o2"])
        self.assertEqual(applied["count"], 2)

    def test_delete_table_skips_object_write_when_no_related_objects(self):
        tables_state = {
            "tables": [
                {
                    "id": "t1",
                    "family": "bridge",
                    "table_name": "br_filter",
                    "chain_name": "forward",
                    "hook": "forward",
                    "priority": -200,
                }
            ]
        }
        objects_state = {
            "objects": [
                {"id": "o1", "family": "inet", "table": "filter"},
                {"id": "o2", "family": "bridge", "table": "other_bridge"},
            ]
        }
        object_writes = {"count": 0}
        applied = {"count": 0}

        def _read_tables():
            return {"tables": [dict(x) for x in tables_state["tables"]]}

        def _write_tables(data):
            tables_state["tables"] = [dict(x) for x in data.get("tables", [])]

        def _read_objects():
            return {"objects": [dict(x) for x in objects_state["objects"]]}

        def _write_objects(data):
            object_writes["count"] += 1
            objects_state["objects"] = [dict(x) for x in data.get("objects", [])]

        def _apply():
            applied["count"] += 1

        deleted = table_ops.delete_table(
            table_id="t1",
            read_tables_fn=_read_tables,
            write_tables_fn=_write_tables,
            read_objects_fn=_read_objects,
            write_objects_fn=_write_objects,
            apply_rules_fn=_apply,
            default_family="inet",
        )

        self.assertEqual(deleted["id"], "t1")
        self.assertEqual(tables_state["tables"], [])
        self.assertEqual([x["id"] for x in objects_state["objects"]], ["o1", "o2"])
        self.assertEqual(object_writes["count"], 0)
        self.assertEqual(applied["count"], 1)

    def test_delete_table_raises_for_missing_id(self):
        def _read_tables():
            return {"tables": []}

        def _write_tables(_data):
            pass

        def _read_objects():
            return {"objects": []}

        def _write_objects(_data):
            pass

        def _apply():
            pass

        with self.assertRaisesRegex(LookupError, "table not found"):
            table_ops.delete_table(
                table_id="missing",
                read_tables_fn=_read_tables,
                write_tables_fn=_write_tables,
                read_objects_fn=_read_objects,
                write_objects_fn=_write_objects,
                apply_rules_fn=_apply,
                default_family="inet",
            )


if __name__ == "__main__":
    unittest.main()
