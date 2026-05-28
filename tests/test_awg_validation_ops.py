import unittest

from backend.domains.awg import validation_ops


class InterfacesClientsValidationOpsTest(unittest.TestCase):
    def test_parse_and_validate_interface_network_and_port(self):
        cidr, network = validation_ops.parse_and_validate_interface_network("10.0.0.1", "24")
        self.assertEqual(cidr, 24)
        self.assertEqual(network, "10.0.0.0/24")

        self.assertEqual(validation_ops.parse_and_validate_port("51820"), 51820)

        with self.assertRaisesRegex(ValueError, "CIDR must be an integer"):
            validation_ops.parse_and_validate_interface_network("10.0.0.1", "abc")
        with self.assertRaisesRegex(ValueError, "CIDR must be in range 1..32"):
            validation_ops.parse_and_validate_interface_network("10.0.0.1", "33")
        with self.assertRaisesRegex(ValueError, "Invalid interface IP/CIDR"):
            validation_ops.parse_and_validate_interface_network("bad-ip", "24")
        with self.assertRaisesRegex(ValueError, "Port must be an integer"):
            validation_ops.parse_and_validate_port("bad")
        with self.assertRaisesRegex(ValueError, "Port must be in range 1..65535"):
            validation_ops.parse_and_validate_port("70000")

    def test_validate_ip_literal_and_interface_name(self):
        validation_ops.validate_ip_literal("198.51.100.10", "server IP")
        validation_ops.validate_interface_name("awg0.1")

        with self.assertRaisesRegex(ValueError, "Invalid server IP"):
            validation_ops.validate_ip_literal("bad", "server IP")
        with self.assertRaisesRegex(ValueError, "15 characters or fewer"):
            validation_ops.validate_interface_name("x" * 16)
        with self.assertRaisesRegex(ValueError, "unsupported characters"):
            validation_ops.validate_interface_name("awg 0")

    def test_assert_interface_uniqueness(self):
        rows = [("10.0.0.1", 24), ("bad-ip", 24), ("10.1.0.1", 24)]

        validation_ops.assert_interface_uniqueness(
            "awg9",
            51999,
            "10.9.0.0/24",
            parse_network_fn=validation_ops.parse_and_validate_interface_network,
            has_interface_name_conflict_fn=lambda _iface, _exclude: False,
            has_port_conflict_fn=lambda _port, _exclude: False,
            fetch_all_interface_network_rows_fn=lambda _exclude: rows,
            exclude_id=None,
        )

        with self.assertRaisesRegex(ValueError, 'Interface "awg0" already exists'):
            validation_ops.assert_interface_uniqueness(
                "awg0",
                51999,
                "10.9.0.0/24",
                parse_network_fn=validation_ops.parse_and_validate_interface_network,
                has_interface_name_conflict_fn=lambda iface, _exclude: iface == "awg0",
                has_port_conflict_fn=lambda _port, _exclude: False,
                fetch_all_interface_network_rows_fn=lambda _exclude: rows,
                exclude_id=None,
            )

        with self.assertRaisesRegex(ValueError, "Port 51820 is already used by another interface"):
            validation_ops.assert_interface_uniqueness(
                "awg9",
                51820,
                "10.9.0.0/24",
                parse_network_fn=validation_ops.parse_and_validate_interface_network,
                has_interface_name_conflict_fn=lambda _iface, _exclude: False,
                has_port_conflict_fn=lambda port, _exclude: port == 51820,
                fetch_all_interface_network_rows_fn=lambda _exclude: rows,
                exclude_id=42,
            )

        with self.assertRaisesRegex(ValueError, "Subnet 10.0.0.0/24 is already used by another interface"):
            validation_ops.assert_interface_uniqueness(
                "awg9",
                51999,
                "10.0.0.0/24",
                parse_network_fn=validation_ops.parse_and_validate_interface_network,
                has_interface_name_conflict_fn=lambda _iface, _exclude: False,
                has_port_conflict_fn=lambda _port, _exclude: False,
                fetch_all_interface_network_rows_fn=lambda _exclude: rows,
                exclude_id=None,
            )


if __name__ == "__main__":
    unittest.main()
