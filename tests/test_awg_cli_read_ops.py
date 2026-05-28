import sqlite3
import unittest

from backend.domains.awg import cli_read_ops


WG_INTERFACE_COLUMNS = (
    "id, wg_interface, awg_version, port_number, wg_ip_addr, wg_ip_cidr, private_key, pubkey, "
    "srv_ip, srv_dns, Jc, Jmin, Jmax, S1, S2, S3, S4, H1, H2, H3, H4, I1, I2, I3, I4, I5"
)


class InterfacesClientsCliReadOpsTest(unittest.TestCase):
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
                "8",
                "9",
                "10",
                "11",
                None,
                None,
                None,
                None,
                None,
            ),
        )
        self.cursor.execute(
            "INSERT INTO clients (name, pubkey, privkey, ip, wg_interface) VALUES (?, ?, ?, ?, ?)",
            ("alice", "pub1", "enc1", "10.0.0.2", "awg0"),
        )
        self.conn.commit()

    def tearDown(self):
        self.conn.close()

    def test_list_clients(self):
        out = []
        cli_read_ops.list_clients(
            cursor=self.cursor,
            decrypt_private_key_fn=lambda value: f"dec:{value}",
            print_fn=lambda line: out.append(str(line)),
        )
        self.assertEqual(out[0], "Список клиентов:")
        self.assertTrue(any("alice: 10.0.0.2" in line for line in out))

    def test_list_wg_int_and_clients(self):
        out = []
        cli_read_ops.list_wg_int(
            cursor=self.cursor,
            wg_interface_columns=WG_INTERFACE_COLUMNS,
            build_awg_params_from_row_fn=lambda _row: {"Jc": "5"},
            detect_awg_version_fn=lambda version, _params: version,
            format_awg_params_for_display_fn=lambda _version, _params: ["Jc: 5"],
            print_fn=lambda line: out.append(str(line)),
        )
        self.assertTrue(any("Interface: awg0" in line for line in out))

        out = []
        cli_read_ops.list_wg_int_clients(
            cursor=self.cursor,
            wg_interface_columns=WG_INTERFACE_COLUMNS,
            build_awg_params_from_row_fn=lambda _row: {"Jc": "5"},
            detect_awg_version_fn=lambda version, _params: version,
            format_awg_params_for_display_fn=lambda _version, _params: ["Jc: 5"],
            decrypt_private_key_fn=lambda value: f"dec:{value}",
            print_fn=lambda line: out.append(str(line)),
        )
        self.assertTrue(any("ID: 1 - alice: IP-address: 10.0.0.2" in line for line in out))
        self.assertTrue(any("Private key: dec:enc1" in line for line in out))

    def test_client_qrencode(self):
        printed = []
        rendered = []

        cli_read_ops.client_qrencode(
            cursor=self.cursor,
            wg_interface_columns=WG_INTERFACE_COLUMNS,
            list_clients_fn=lambda: printed.append("LIST"),
            input_fn=lambda _prompt: "1",
            build_awg_params_from_row_fn=lambda _row: {"Jc": "5"},
            build_client_config_lines_fn=lambda *_args: ["[Interface]", "PrivateKey = dec:enc1"],
            decrypt_private_key_fn=lambda value: f"dec:{value}",
            render_qr_in_terminal_fn=lambda content: rendered.append(content),
            print_fn=lambda line: printed.append(str(line)),
        )
        self.assertIn("LIST", printed)
        self.assertIn("QR code:", printed)
        self.assertEqual(len(rendered), 1)
        self.assertTrue(rendered[0].endswith("\n"))


if __name__ == "__main__":
    unittest.main()
