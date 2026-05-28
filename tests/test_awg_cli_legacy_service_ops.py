import sqlite3
import unittest

from backend.domains.awg import cli_legacy_ops
from backend.domains.awg import cli_legacy_service_ops


WG_INTERFACE_COLUMNS = (
    "id, wg_interface, awg_version, port_number, wg_ip_addr, wg_ip_cidr, private_key, pubkey, "
    "srv_ip, srv_dns, Jc, Jmin, Jmax, S1, S2, S3, S4, H1, H2, H3, H4, I1, I2, I3, I4, I5"
)


class InterfacesClientsCliLegacyServiceOpsTest(unittest.TestCase):
    def setUp(self):
        self.conn = sqlite3.connect(":memory:")
        self.cursor = self.conn.cursor()
        self.cursor.execute(
            """CREATE TABLE wg_interfaces (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                wg_interface TEXT,
                awg_version TEXT,
                port_number INTEGER,
                wg_ip_addr TEXT,
                wg_ip_cidr INTEGER,
                private_key TEXT,
                pubkey TEXT,
                srv_ip TEXT,
                srv_dns TEXT,
                Jc INTEGER, Jmin INTEGER, Jmax INTEGER,
                S1 INTEGER, S2 INTEGER, S3 INTEGER, S4 INTEGER,
                H1 TEXT, H2 TEXT, H3 TEXT, H4 TEXT,
                I1 TEXT, I2 TEXT, I3 TEXT, I4 TEXT, I5 TEXT
            )"""
        )
        self.cursor.execute(
            """CREATE TABLE clients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                pubkey TEXT,
                privkey TEXT,
                ip TEXT,
                wg_interface TEXT
            )"""
        )
        self.conn.commit()

    def tearDown(self):
        self.conn.close()

    def test_add_client_wiring(self):
        original = cli_legacy_ops.add_client
        try:
            def _fake_add_client(**kwargs):
                kwargs["insert_client_row_fn"]("alice", "pub", "enc:priv", "10.0.0.2", "awg0")
                kwargs["commit_fn"]()
                return "ok"

            cli_legacy_ops.add_client = _fake_add_client
            out = cli_legacy_service_ops.add_client(
                cursor=self.cursor,
                conn=self.conn,
                input_fn=lambda _prompt: "",
                get_next_available_ip_fn=lambda _iface: "10.0.0.2",
                run_check_output_fn=lambda *_args, **_kwargs: b"",
                encrypt_private_key_fn=lambda value: value,
                run_command_fn=lambda _cmd: None,
                print_fn=lambda _line: None,
                sqlite_error_type=RuntimeError,
                called_process_error_type=RuntimeError,
            )
            self.assertEqual(out, "ok")
            self.assertEqual(self.cursor.execute("SELECT COUNT(*) FROM clients").fetchone()[0], 1)
            row = self.cursor.execute("SELECT name, pubkey, ip, wg_interface FROM clients").fetchone()
            self.assertEqual(row, ("alice", "pub", "10.0.0.2", "awg0"))
        finally:
            cli_legacy_ops.add_client = original

    def test_delete_client_wiring(self):
        self.cursor.execute(
            "INSERT INTO clients (name, pubkey, privkey, ip, wg_interface) VALUES (?, ?, ?, ?, ?)",
            ("alice", "pub", "enc", "10.0.0.2", "awg0"),
        )
        self.conn.commit()

        original = cli_legacy_ops.delete_client
        try:
            seen = {}

            def _fake_delete_client(**kwargs):
                seen["row"] = kwargs["fetch_client_by_id_fn"]("1")
                kwargs["delete_client_row_fn"](1)
                kwargs["commit_fn"]()
                return "deleted"

            cli_legacy_ops.delete_client = _fake_delete_client
            out = cli_legacy_service_ops.delete_client(
                cursor=self.cursor,
                conn=self.conn,
                list_clients_fn=lambda: None,
                input_fn=lambda _prompt: "1",
                run_command_fn=lambda _cmd: None,
                del_peer_fn=lambda _iface, _pub: None,
                print_fn=lambda _line: None,
            )
            self.assertEqual(out, "deleted")
            self.assertIsNotNone(seen["row"])
            self.assertEqual(seen["row"][0], 1)
            self.assertEqual(self.cursor.execute("SELECT COUNT(*) FROM clients").fetchone()[0], 0)
        finally:
            cli_legacy_ops.delete_client = original

    def test_sync_wiring(self):
        self.cursor.execute(
            """INSERT INTO wg_interfaces (
                wg_interface, awg_version, port_number, wg_ip_addr, wg_ip_cidr, private_key, pubkey, srv_ip, srv_dns,
                Jc, Jmin, Jmax, S1, S2, S3, S4, H1, H2, H3, H4, I1, I2, I3, I4, I5
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                "awg0",
                "2",
                51820,
                "10.0.0.1",
                24,
                "priv",
                "pub",
                "198.51.100.10",
                "1.1.1.1",
                1,
                2,
                3,
                4,
                5,
                6,
                7,
                8,
                9,
                10,
                11,
                None,
                None,
                None,
                None,
                None,
            ),
        )
        self.cursor.execute(
            "INSERT INTO clients (name, pubkey, privkey, ip, wg_interface) VALUES (?, ?, ?, ?, ?)",
            ("alice", "pubc", "enc", "10.0.0.2", "awg0"),
        )
        self.conn.commit()

        original = cli_legacy_ops.sync
        try:
            observed = {}

            def _fake_sync(sync_type, **kwargs):
                observed["sync_type"] = sync_type
                observed["ifaces"] = kwargs["fetch_interfaces_fn"]()
                observed["clients"] = kwargs["fetch_clients_fn"]()
                return "synced"

            cli_legacy_ops.sync = _fake_sync
            out = cli_legacy_service_ops.sync(
                1,
                cursor=self.cursor,
                wg_interface_columns=WG_INTERFACE_COLUMNS,
                run_check_output_fn=lambda *_args, **_kwargs: "",
                run_command_fn=lambda *_args, **_kwargs: None,
                build_awg_set_command_fn=lambda *_args: ["awg", "set", "awg0"],
                write_key_file_fn=lambda _path, _content: None,
                apply_firewall_rules_fn=lambda: None,
                print_fn=lambda _line: None,
                called_process_error_type=RuntimeError,
                devnull="DEVNULL",
                pipe="PIPE",
            )
            self.assertEqual(out, "synced")
            self.assertEqual(observed["sync_type"], 1)
            self.assertEqual(len(observed["ifaces"]), 1)
            self.assertEqual(observed["ifaces"][0][1], "awg0")
            self.assertEqual(len(observed["clients"]), 1)
            self.assertEqual(observed["clients"][0][1], "alice")
        finally:
            cli_legacy_ops.sync = original


if __name__ == "__main__":
    unittest.main()
