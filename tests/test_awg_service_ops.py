import sqlite3
import unittest

from backend.domains.awg import service_ops


WG_INTERFACE_COLUMNS = (
    "id, wg_interface, awg_version, port_number, wg_ip_addr, wg_ip_cidr, private_key, pubkey, "
    "srv_ip, srv_dns, Jc, Jmin, Jmax, S1, S2, S3, S4, H1, H2, H3, H4, I1, I2, I3, I4, I5"
)


def _default_awg_params():
    return {
        "Jc": 3,
        "Jmin": 10,
        "Jmax": 20,
        "S1": 30,
        "S2": 40,
        "S3": 50,
        "S4": 60,
        "H1": "1:2",
        "H2": None,
        "H3": None,
        "H4": None,
        "I1": None,
        "I2": None,
        "I3": None,
        "I4": None,
        "I5": None,
    }


class InterfacesClientsServiceOpsTest(unittest.TestCase):
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
            """CREATE TABLE client_settings (
                client_id INTEGER PRIMARY KEY,
                allowed_ips TEXT
            )"""
        )
        self.conn.commit()

    def tearDown(self):
        self.conn.close()

    def test_interface_service_flow(self):
        row = service_ops.create_interface_service(
            {
                "wg_interface": "awg0",
                "awg_version": "2",
                "port_number": "51820",
                "wg_ip_addr": "10.8.0.1",
                "wg_ip_cidr": "24",
                "srv_ip": "198.51.100.10",
                "srv_dns": "1.1.1.1",
            },
            cursor=self.cursor,
            conn=self.conn,
            wg_interface_columns=WG_INTERFACE_COLUMNS,
            normalize_config_value_fn=lambda value: None if value is None else str(value).strip() or None,
            detect_awg_version_fn=lambda value, _params: str(value),
            validate_interface_name_fn=lambda _value: None,
            parse_and_validate_port_fn=lambda value: int(str(value)),
            parse_and_validate_interface_network_fn=lambda ip_addr, cidr: (int(str(cidr)), f"{ip_addr}/{cidr}"),
            validate_ip_literal_fn=lambda _value, _field: None,
            generate_keypair_fn=lambda: ("priv-a", "pub-a"),
            prepare_awg_params_for_version_fn=lambda _version: _default_awg_params(),
            validate_awg_params_fn=lambda _version, _params: None,
            assert_interface_uniqueness_fn=lambda _iface, _port, _net, exclude_id=None: None,
            apply_interface_runtime_fn=lambda *_args, **_kwargs: None,
        )
        self.assertEqual(row[1], "awg0")

        updated = service_ops.update_interface_service(
            row[0],
            {"srv_dns": "9.9.9.9", "port_number": "51821"},
            cursor=self.cursor,
            conn=self.conn,
            wg_interface_columns=WG_INTERFACE_COLUMNS,
            build_awg_params_from_row_fn=lambda _row: _default_awg_params(),
            detect_awg_version_fn=lambda value, _params: str(value),
            normalize_config_value_fn=lambda value: None if value is None else str(value).strip() or None,
            validate_interface_name_fn=lambda _value: None,
            parse_and_validate_port_fn=lambda value: int(str(value)),
            parse_and_validate_interface_network_fn=lambda ip_addr, cidr: (int(str(cidr)), f"{ip_addr}/{cidr}"),
            validate_ip_literal_fn=lambda _value, _field: None,
            prepare_awg_params_for_version_fn=lambda _version: _default_awg_params(),
            validate_awg_params_fn=lambda _version, _params: None,
            assert_interface_uniqueness_fn=lambda _iface, _port, _net, exclude_id=None: None,
            remove_interface_runtime_fn=lambda _iface: None,
            apply_interface_runtime_fn=lambda *_args, **_kwargs: None,
        )
        self.assertEqual(updated[3], 51821)
        self.assertEqual(updated[9], "9.9.9.9")

        deleted = service_ops.delete_interface_service(
            row[0],
            cursor=self.cursor,
            conn=self.conn,
            wg_interface_columns=WG_INTERFACE_COLUMNS,
            remove_interface_runtime_fn=lambda _iface: None,
        )
        self.assertEqual(deleted[0], row[0])

    def test_client_service_flow(self):
        self.cursor.execute(
            """INSERT INTO wg_interfaces (
                wg_interface, awg_version, port_number, wg_ip_addr, wg_ip_cidr, private_key, pubkey, srv_ip, srv_dns,
                Jc, Jmin, Jmax, S1, S2, S3, S4, H1, H2, H3, H4, I1, I2, I3, I4, I5
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                "awg0",
                "2",
                51820,
                "10.8.0.1",
                24,
                "priv",
                "pub",
                "198.51.100.10",
                "1.1.1.1",
                3,
                10,
                20,
                30,
                40,
                50,
                60,
                "1:2",
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                None,
            ),
        )
        self.conn.commit()
        commands = []

        created = service_ops.create_client_service(
            {"name": "alice", "wg_interface": "awg0"},
            cursor=self.cursor,
            conn=self.conn,
            normalize_config_value_fn=lambda value: None if value is None else str(value).strip() or None,
            get_next_available_ip_fn=lambda _iface, exclude_client_id=None: "10.8.0.2",
            generate_keypair_fn=lambda: ("priv-c", "pub-c"),
            encrypt_private_key_fn=lambda value: f"enc:{value}",
            run_command_fn=lambda cmd: commands.append(list(cmd)),
        )
        self.assertEqual(created[1], "alice")
        self.assertEqual(created[4], "10.8.0.2")
        self.assertEqual(commands[-1][:3], ["awg", "set", "awg0"])

        updated = service_ops.update_client_service(
            created[0],
            {"name": "alice2", "ip": "10.8.0.3"},
            cursor=self.cursor,
            conn=self.conn,
            normalize_config_value_fn=lambda value: None if value is None else str(value).strip() or None,
            get_next_available_ip_fn=lambda _iface, exclude_client_id=None: "10.8.0.4",
            validate_client_ip_for_interface_fn=lambda client_ip, wg_interface, exclude_client_id=None: None,
            encrypt_private_key_fn=lambda value: f"enc:{value}",
            run_command_fn=lambda cmd: commands.append(list(cmd)),
        )
        self.assertEqual(updated[1], "alice2")
        self.assertEqual(updated[4], "10.8.0.3")

        deleted = service_ops.delete_client_service(
            created[0],
            cursor=self.cursor,
            conn=self.conn,
            run_command_fn=lambda cmd: commands.append(list(cmd)),
        )
        self.assertEqual(deleted[0], created[0])

    def test_ip_alloc_wrappers(self):
        self.cursor.execute(
            """INSERT INTO wg_interfaces (
                wg_interface, awg_version, port_number, wg_ip_addr, wg_ip_cidr, private_key, pubkey, srv_ip, srv_dns,
                Jc, Jmin, Jmax, S1, S2, S3, S4, H1, H2, H3, H4, I1, I2, I3, I4, I5
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                "awg1",
                "2",
                51830,
                "10.9.0.1",
                24,
                "priv",
                "pub",
                "198.51.100.20",
                "1.1.1.1",
                3,
                10,
                20,
                30,
                40,
                50,
                60,
                "1:2",
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                None,
            ),
        )
        self.cursor.execute(
            "INSERT INTO clients (name, pubkey, privkey, ip, wg_interface) VALUES (?, ?, ?, ?, ?)",
            ("bob", "pub-b", "enc:priv-b", "10.9.0.2", "awg1"),
        )
        self.conn.commit()

        next_ip = service_ops.get_next_available_ip("awg1", cursor=self.cursor)
        self.assertEqual(next_ip, "10.9.0.3")

        service_ops.validate_client_ip_for_interface(
            client_ip="10.9.0.4",
            wg_interface="awg1",
            cursor=self.cursor,
        )
        with self.assertRaisesRegex(ValueError, "already used"):
            service_ops.validate_client_ip_for_interface(
                client_ip="10.9.0.2",
                wg_interface="awg1",
                cursor=self.cursor,
            )


if __name__ == "__main__":
    unittest.main()
