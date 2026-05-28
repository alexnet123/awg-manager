import sqlite3
import unittest

from backend.domains.awg import cli_service_ops


WG_INTERFACE_COLUMNS = (
    "id, wg_interface, awg_version, port_number, wg_ip_addr, wg_ip_cidr, private_key, pubkey, "
    "srv_ip, srv_dns, Jc, Jmin, Jmax, S1, S2, S3, S4, H1, H2, H3, H4, I1, I2, I3, I4, I5"
)


def _default_awg_params():
    return {
        "Jc": 1,
        "Jmin": 2,
        "Jmax": 3,
        "S1": 4,
        "S2": 5,
        "S3": 6,
        "S4": 7,
        "H1": 8,
        "H2": 9,
        "H3": 10,
        "H4": 11,
        "I1": None,
        "I2": None,
        "I3": None,
        "I4": None,
        "I5": None,
    }


class InterfacesClientsCliServiceOpsTest(unittest.TestCase):
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

    def test_add_del_and_update_interface_cli_wiring(self):
        commands = []
        printed = []
        written = []

        answers = iter(
            [
                "awg0",
                "51820",
                "10.0.0.1",
                "24",
                "198.51.100.10",
                "1.1.1.1",
                "yes",
            ]
        )

        def _check_output(cmd, input=None):
            if cmd == ["awg", "genkey"]:
                return b"priv\n"
            if cmd == ["awg", "pubkey"]:
                self.assertEqual(input, b"priv")
                return b"pub\n"
            raise AssertionError("unexpected check_output")

        cli_service_ops.add_wg_int(
            cursor=self.cursor,
            conn=self.conn,
            input_fn=lambda _prompt: next(answers),
            prompt_awg_version_fn=lambda _default: "2",
            run_check_output_fn=_check_output,
            prepare_awg_params_for_version_fn=lambda _ver: _default_awg_params(),
            prompt_version_2_signature_params_fn=lambda params: params,
            run_command_fn=lambda cmd: commands.append(list(cmd)),
            build_awg_set_command_fn=lambda *_args: ["awg", "set", "awg0"],
            write_key_file_fn=lambda path, content: written.append((path, content)),
            print_fn=lambda line: printed.append(str(line)),
            sqlite_error_type=RuntimeError,
            called_process_error_type=ValueError,
        )
        self.assertEqual(self.cursor.execute("SELECT COUNT(*) FROM wg_interfaces").fetchone()[0], 1)
        self.assertIn(["ip", "link", "add", "awg0", "type", "amneziawg"], commands)
        self.assertIn(("key_temp", "priv"), written)

        cli_service_ops.del_wg_int(
            cursor=self.cursor,
            conn=self.conn,
            wg_interface_columns=WG_INTERFACE_COLUMNS,
            list_wg_int_fn=lambda: printed.append("LIST"),
            input_fn=lambda _prompt: "1",
            run_command_fn=lambda cmd: commands.append(list(cmd)),
            print_fn=lambda line: printed.append(str(line)),
        )
        self.assertEqual(self.cursor.execute("SELECT COUNT(*) FROM wg_interfaces").fetchone()[0], 0)

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
        self.conn.commit()

        upd_answers = iter(
            [
                "awg0",
                "",
                "",
                "",
                "",
                "",
                "new-pub",
                "new-priv",
            ]
        )
        cli_service_ops.update_interface(
            cursor=self.cursor,
            conn=self.conn,
            wg_interface_columns=WG_INTERFACE_COLUMNS,
            list_wg_int_fn=lambda: printed.append("LIST2"),
            print_fn=lambda line: printed.append(str(line)),
            input_fn=lambda _prompt: next(upd_answers),
            detect_awg_version_fn=lambda version, _params: str(version),
            build_awg_params_from_row_fn=lambda _row: _default_awg_params(),
            prompt_awg_version_fn=lambda _default: "2",
            prepare_awg_params_for_version_fn=lambda _ver: _default_awg_params(),
            prompt_version_2_signature_params_fn=lambda params: params,
            run_command_fn=lambda cmd: commands.append(list(cmd)),
            build_awg_set_command_fn=lambda *_args: ["awg", "set", "awg0"],
            write_key_file_fn=lambda path, content: written.append((path, content)),
        )
        row = self.cursor.execute("SELECT pubkey, private_key FROM wg_interfaces WHERE wg_interface = 'awg0'").fetchone()
        self.assertEqual(row[0], "new-pub")
        self.assertEqual(row[1], "new-priv")

    def test_update_peer_cli_wiring(self):
        printed = []
        calls = []
        self.cursor.execute(
            "INSERT INTO clients (name, pubkey, privkey, ip, wg_interface) VALUES (?, ?, ?, ?, ?)",
            ("alice", "old-pub", "old-enc", "10.0.0.2", "awg0"),
        )
        self.conn.commit()

        answers = iter(["1", "alice2", "new-pub", "new-priv", "10.0.0.3", "awg0"])
        cli_service_ops.update_peer(
            cursor=self.cursor,
            conn=self.conn,
            list_clients_fn=lambda: calls.append("list"),
            input_fn=lambda _prompt: next(answers),
            del_peer_fn=lambda iface, pub: calls.append(("del", iface, pub)),
            encrypt_private_key_fn=lambda value: f"enc:{value}",
            add_peer_fn=lambda iface, pub, ip: calls.append(("add", iface, pub, ip)),
            print_fn=lambda line: printed.append(str(line)),
        )
        row = self.cursor.execute("SELECT name, pubkey, privkey, ip FROM clients WHERE id = 1").fetchone()
        self.assertEqual(row, ("alice2", "new-pub", "enc:new-priv", "10.0.0.3"))
        self.assertIn(("del", "awg0", "old-pub"), calls)
        self.assertIn(("add", "awg0", "new-pub", "10.0.0.3"), calls)

        printed = []
        answers = iter(["99", "x", "x", "x", "x", "x"])
        cli_service_ops.update_peer(
            cursor=self.cursor,
            conn=self.conn,
            list_clients_fn=lambda: None,
            input_fn=lambda _prompt: next(answers),
            del_peer_fn=lambda _iface, _pub: None,
            encrypt_private_key_fn=lambda value: value,
            add_peer_fn=lambda _iface, _pub, _ip: None,
            print_fn=lambda line: printed.append(str(line)),
        )
        self.assertTrue(any("клиент с id 99 не найден" in line for line in printed))


if __name__ == "__main__":
    unittest.main()
