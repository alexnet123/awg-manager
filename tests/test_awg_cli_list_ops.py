import unittest

from backend.domains.awg import cli_list_ops


class InterfacesClientsCliListOpsTest(unittest.TestCase):
    def test_list_clients(self):
        out = []
        cli_list_ops.list_clients(
            fetch_clients_fn=lambda: [(1, "alice", "pub1", "enc1", "10.0.0.2", "awg0")],
            decrypt_private_key_fn=lambda value: f"dec:{value}",
            print_fn=lambda line: out.append(str(line)),
        )
        self.assertEqual(out[0], "Список клиентов:")
        self.assertTrue(any("alice: 10.0.0.2 (pub1) (dec:enc1) awg0" in line for line in out))

    def test_list_wg_int(self):
        out = []
        row = (
            7,
            "awg0",
            "2",
            51820,
            "10.0.0.1",
            24,
            "priv",
            "pub",
            "198.51.100.10",
            "1.1.1.1",
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
        )
        cli_list_ops.list_wg_int(
            fetch_interfaces_fn=lambda: [row],
            build_awg_params_from_row_fn=lambda _row: {"Jc": "5"},
            detect_awg_version_fn=lambda version, _params: version,
            format_awg_params_for_display_fn=lambda _version, _params: ["Jc: 5"],
            print_fn=lambda line: out.append(str(line)),
        )
        self.assertEqual(out[0], "Список интерфейсов:")
        self.assertTrue(any("Interface: awg0, AWG version: 2" in line for line in out))
        self.assertIn("Jc: 5", out)

    def test_list_wg_int_clients(self):
        out = []
        row = (
            7,
            "awg0",
            "2",
            51820,
            "10.0.0.1",
            24,
            "priv",
            "pub",
            "198.51.100.10",
            "1.1.1.1",
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
        )
        cli_list_ops.list_wg_int_clients(
            fetch_interfaces_fn=lambda: [row],
            build_awg_params_from_row_fn=lambda _row: {"Jc": "5"},
            detect_awg_version_fn=lambda version, _params: version,
            format_awg_params_for_display_fn=lambda _version, _params: ["Jc: 5"],
            fetch_clients_for_interface_fn=lambda iface: [(1, "alice", "pub1", "enc1", "10.0.0.2", iface)],
            decrypt_private_key_fn=lambda value: f"dec:{value}",
            print_fn=lambda line: out.append(str(line)),
        )
        self.assertTrue(any("ID: 1 - alice: IP-address: 10.0.0.2" in line for line in out))
        self.assertTrue(any("Private key: dec:enc1" in line for line in out))


if __name__ == "__main__":
    unittest.main()
