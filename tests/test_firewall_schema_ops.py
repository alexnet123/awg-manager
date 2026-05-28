import unittest

from backend.domains.firewall import schema_ops


class FirewallSchemaOpsTest(unittest.TestCase):
    def test_get_schema_returns_same_reference(self):
        schema = {"tables": {"filter": {"chains": ["input"]}}}
        result = schema_ops.get_schema(schema)
        self.assertIs(result, schema)
        result["tables"]["filter"]["chains"].append("output")
        self.assertEqual(schema["tables"]["filter"]["chains"], ["input", "output"])


if __name__ == "__main__":
    unittest.main()
