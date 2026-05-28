import unittest

from backend.domains.awg import ip_alloc_ops


class InterfacesClientsIpAllocOpsTest(unittest.TestCase):
    def test_get_next_available_ip(self):
        def _fetch_subnet(_iface):
            return ("10.0.0.1", 29)

        def _fetch_used(_iface, exclude_id):
            if exclude_id is None:
                return [("10.0.0.2",), ("10.0.0.3",)]
            return [("10.0.0.2",)]

        ip = ip_alloc_ops.get_next_available_ip(
            "wg0",
            fetch_interface_subnet_fn=_fetch_subnet,
            fetch_used_ips_fn=_fetch_used,
            exclude_client_id=None,
        )
        self.assertEqual(ip, "10.0.0.4")

        ip_excluded = ip_alloc_ops.get_next_available_ip(
            "wg0",
            fetch_interface_subnet_fn=_fetch_subnet,
            fetch_used_ips_fn=_fetch_used,
            exclude_client_id=10,
        )
        self.assertEqual(ip_excluded, "10.0.0.3")

        with self.assertRaisesRegex(LookupError, "Интерфейс wg0 не найден в базе данных"):
            ip_alloc_ops.get_next_available_ip(
                "wg0",
                fetch_interface_subnet_fn=lambda _iface: None,
                fetch_used_ips_fn=_fetch_used,
            )

    def test_validate_client_ip_for_interface(self):
        def _fetch_subnet(_iface):
            return ("10.0.0.1", 24)

        ip_alloc_ops.validate_client_ip_for_interface(
            client_ip="10.0.0.50",
            wg_interface="wg0",
            fetch_interface_subnet_fn=_fetch_subnet,
            has_ip_conflict_fn=lambda _iface, _ip, _exclude: False,
        )

        with self.assertRaisesRegex(ValueError, "Invalid client IP"):
            ip_alloc_ops.validate_client_ip_for_interface(
                client_ip="not-an-ip",
                wg_interface="wg0",
                fetch_interface_subnet_fn=_fetch_subnet,
                has_ip_conflict_fn=lambda _iface, _ip, _exclude: False,
            )

        with self.assertRaisesRegex(ValueError, "outside interface subnet"):
            ip_alloc_ops.validate_client_ip_for_interface(
                client_ip="192.0.2.1",
                wg_interface="wg0",
                fetch_interface_subnet_fn=_fetch_subnet,
                has_ip_conflict_fn=lambda _iface, _ip, _exclude: False,
            )

        with self.assertRaisesRegex(ValueError, "conflicts with interface IP"):
            ip_alloc_ops.validate_client_ip_for_interface(
                client_ip="10.0.0.1",
                wg_interface="wg0",
                fetch_interface_subnet_fn=_fetch_subnet,
                has_ip_conflict_fn=lambda _iface, _ip, _exclude: False,
            )

        with self.assertRaisesRegex(ValueError, "already used on interface wg0"):
            ip_alloc_ops.validate_client_ip_for_interface(
                client_ip="10.0.0.2",
                wg_interface="wg0",
                fetch_interface_subnet_fn=_fetch_subnet,
                has_ip_conflict_fn=lambda _iface, _ip, _exclude: True,
            )

        with self.assertRaisesRegex(LookupError, "Interface not found"):
            ip_alloc_ops.validate_client_ip_for_interface(
                client_ip="10.0.0.2",
                wg_interface="wg0",
                fetch_interface_subnet_fn=lambda _iface: None,
                has_ip_conflict_fn=lambda _iface, _ip, _exclude: False,
            )


if __name__ == "__main__":
    unittest.main()
