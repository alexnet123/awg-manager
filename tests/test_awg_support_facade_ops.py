import os
import sqlite3
import tempfile
import unittest

from backend.domains.awg import support_facade_ops


class InterfacesClientsSupportFacadeOpsTest(unittest.TestCase):
    def test_api_key_helpers(self):
        original_load = support_facade_ops.api_key_store.load_api_key
        original_save = support_facade_ops.api_key_store.save_api_key
        original_rotate = support_facade_ops.api_key_store.rotate_api_key
        try:
            support_facade_ops.api_key_store.load_api_key = lambda env_var, path, norm_fn: f"{env_var}:{path}:{norm_fn(' x ')}"
            support_facade_ops.api_key_store.save_api_key = lambda value, path, norm_fn: f"{norm_fn(value)}@{path}"
            support_facade_ops.api_key_store.rotate_api_key = lambda save_fn: (save_fn("new-key"), "new-key")[1]

            norm = lambda v: str(v).strip() if v is not None else None
            self.assertEqual(
                support_facade_ops.load_api_key(
                    api_key_env_var="ENV",
                    api_key_file="/tmp/key",
                    normalize_config_value_fn=norm,
                ),
                "ENV:/tmp/key:x",
            )
            self.assertEqual(
                support_facade_ops.save_api_key(
                    "  key ",
                    api_key_file="/tmp/key",
                    normalize_config_value_fn=norm,
                ),
                "key@/tmp/key",
            )
            saved = []
            rotated = support_facade_ops.rotate_api_key(save_api_key_fn=lambda value: saved.append(value))
            self.assertEqual(rotated, "new-key")
            self.assertEqual(saved, ["new-key"])
        finally:
            support_facade_ops.api_key_store.load_api_key = original_load
            support_facade_ops.api_key_store.save_api_key = original_save
            support_facade_ops.api_key_store.rotate_api_key = original_rotate

    def test_verify_api_auth(self):
        norm = lambda v: str(v).strip() if v is not None else None
        ok, err = support_facade_ops.verify_api_auth(
            " key ",
            None,
            load_api_key_fn=lambda: "key",
            normalize_config_value_fn=norm,
        )
        self.assertTrue(ok)
        self.assertIsNone(err)

        ok, err = support_facade_ops.verify_api_auth(
            "bad",
            None,
            load_api_key_fn=lambda: "key",
            normalize_config_value_fn=norm,
        )
        self.assertFalse(ok)
        self.assertEqual(err, "Invalid API key")

    def test_qr_helpers(self):
        calls = []
        original_make = support_facade_ops.segno.make
        try:
            class _FakeQR:
                def terminal(self, compact):
                    calls.append(("terminal", compact))

                def save(self, output, kind, scale):
                    calls.append(("save", kind, scale))
                    output.write(b"<svg/>")

            support_facade_ops.segno.make = lambda content: (calls.append(("make", content)), _FakeQR())[1]
            support_facade_ops.render_qr_in_terminal("hello")
            self.assertIn(("terminal", True), calls)
            svg = support_facade_ops.build_qr_svg("hello2")
            self.assertEqual(svg, b"<svg/>")
            self.assertTrue(any(call == ("make", "hello2") for call in calls))
        finally:
            support_facade_ops.segno.make = original_make

    def test_decode_base64_payload(self):
        self.assertEqual(
            support_facade_ops.decode_base64_payload("aGVsbG8="),
            b"hello",
        )
        with self.assertRaisesRegex(ValueError, "Invalid base64 backup payload"):
            support_facade_ops.decode_base64_payload("%%%")

    def test_read_and_restore_database_bytes(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            src_path = os.path.join(tmpdir, "src.db")
            src_conn = sqlite3.connect(src_path)
            src_cur = src_conn.cursor()
            src_cur.execute("CREATE TABLE clients (id INTEGER PRIMARY KEY, name TEXT)")
            src_cur.execute("CREATE TABLE wg_interfaces (id INTEGER PRIMARY KEY, name TEXT)")
            src_cur.execute("INSERT INTO clients (id, name) VALUES (?, ?)", (1, "alice"))
            src_cur.execute("INSERT INTO wg_interfaces (id, name) VALUES (?, ?)", (1, "awg0"))
            src_conn.commit()
            src_conn.close()

            raw = support_facade_ops.read_database_bytes(db_file_path=src_path)
            self.assertGreater(len(raw), 100)

            dst_conn = sqlite3.connect(":memory:")
            dst_cur = dst_conn.cursor()
            dst_cur.execute("CREATE TABLE clients (id INTEGER PRIMARY KEY, name TEXT)")
            dst_cur.execute("CREATE TABLE wg_interfaces (id INTEGER PRIMARY KEY, name TEXT)")
            dst_conn.commit()

            support_facade_ops.restore_database_from_bytes(
                raw,
                cursor=dst_cur,
                conn=dst_conn,
            )

            clients = dst_cur.execute("SELECT id, name FROM clients").fetchall()
            ifaces = dst_cur.execute("SELECT id, name FROM wg_interfaces").fetchall()
            self.assertEqual(clients, [(1, "alice")])
            self.assertEqual(ifaces, [(1, "awg0")])
            dst_conn.close()


if __name__ == "__main__":
    unittest.main()
