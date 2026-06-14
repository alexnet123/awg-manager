import unittest

from backend.domains.ipsec import query_ops


class IpsecQueryOpsTest(unittest.TestCase):
    def test_list_ipsec_identities(self):
        rows = [
            {"peer": "peer-a", "psk_encrypted": "enc-a", "local_id": "l1"},
            {"peer": "peer-b", "local_id": "l2"},
        ]
        out = query_ops.list_ipsec_identities(read_collection_fn=lambda: rows)
        self.assertEqual(out[0]["peer"], "peer-a")
        self.assertTrue(out[0]["has_psk"])
        self.assertTrue(out[0]["enabled"])
        self.assertNotIn("psk_encrypted", out[0])
        self.assertFalse(out[1]["has_psk"])
        self.assertTrue(out[1]["enabled"])

    def test_ensure_item_exists_by_name(self):
        rows = [{"name": "peer-a"}, {"name": "peer-b"}]
        query_ops.ensure_item_exists_by_name(
            "peer-a",
            read_collection_fn=lambda: rows,
            error_message="peer not found",
        )
        with self.assertRaisesRegex(ValueError, "peer not found"):
            query_ops.ensure_item_exists_by_name(
                "peer-z",
                read_collection_fn=lambda: rows,
                error_message="peer not found",
            )


if __name__ == "__main__":
    unittest.main()
