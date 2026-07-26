import unittest

from backend.domains.awg import interface_service_ops


class InterfacesClientsInterfaceServiceOpsTest(unittest.TestCase):
    def test_create_interface_service_success(self):
        calls = []
        rows = {}

        def _insert(
            wg_interface,
            awg_version,
            port_number,
            wg_ip_addr,
            wg_ip_cidr,
            private_key,
            public_key,
            srv_ip,
            srv_dns,
            awg_params,
        ):
            calls.append(("insert", wg_interface, awg_version, port_number, wg_ip_addr, wg_ip_cidr, private_key, public_key, srv_ip, srv_dns, dict(awg_params)))
            rows[42] = ("row", 42, wg_interface)
            return 42

        row = interface_service_ops.create_interface_service(
            {
                "wg_interface": "awg0",
                "awg_version": "2",
                "port_number": "51820",
                "wg_ip_addr": "10.10.0.1",
                "wg_ip_cidr": "24",
                "srv_ip": "198.51.100.10",
                "srv_dns": "1.1.1.1",
                "awg_params": {"Jc": "5"},
            },
            normalize_config_value_fn=lambda value: value,
            detect_awg_version_fn=lambda version, _params: version,
            validate_interface_name_fn=lambda name: calls.append(("validate-name", name)),
            parse_and_validate_port_fn=lambda port: int(port),
            parse_and_validate_interface_network_fn=lambda ip, cidr: (int(cidr), f"{ip}/{cidr}"),
            validate_ip_literal_fn=lambda ip, field: calls.append(("validate-ip", ip, field)),
            generate_keypair_fn=lambda: ("priv", "pub"),
            prepare_awg_params_for_version_fn=lambda _version: {"Jc": None, "S1": None},
            validate_awg_params_fn=lambda version, awg_params: calls.append(("validate-awg", version, dict(awg_params))),
            begin_tx_fn=lambda: calls.append(("begin",)),
            assert_interface_uniqueness_fn=lambda iface, port, cidr, exclude_id=None: calls.append(("unique", iface, port, cidr, exclude_id)),
            insert_interface_fn=_insert,
            apply_interface_runtime_fn=lambda *args: calls.append(("apply-runtime", args[0], args[1])),
            commit_fn=lambda: calls.append(("commit",)),
            delete_interface_row_fn=lambda row_id: calls.append(("delete-row", row_id)),
            rollback_fn=lambda: calls.append(("rollback",)),
            fetch_interface_row_fn=lambda row_id: rows.get(row_id),
        )

        self.assertEqual(row, ("row", 42, "awg0"))
        self.assertIn(("begin",), calls)
        self.assertIn(("commit",), calls)
        self.assertIn(("apply-runtime", "awg0", 51820), calls)

    def test_create_interface_service_runtime_failure_cleanup_inserted_row(self):
        calls = []

        with self.assertRaisesRegex(RuntimeError, "boom"):
            interface_service_ops.create_interface_service(
                {
                    "wg_interface": "awg0",
                    "port_number": "51820",
                    "wg_ip_addr": "10.10.0.1",
                    "wg_ip_cidr": "24",
                    "srv_ip": "198.51.100.10",
                    "srv_dns": "1.1.1.1",
                },
                normalize_config_value_fn=lambda value: value,
                detect_awg_version_fn=lambda version, _params: version,
                validate_interface_name_fn=lambda _name: None,
                parse_and_validate_port_fn=lambda port: int(port),
                parse_and_validate_interface_network_fn=lambda ip, cidr: (int(cidr), f"{ip}/{cidr}"),
                validate_ip_literal_fn=lambda _ip, _field: None,
                generate_keypair_fn=lambda: ("priv", "pub"),
                prepare_awg_params_for_version_fn=lambda _version: {"Jc": None},
                validate_awg_params_fn=lambda _version, _awg_params: None,
                begin_tx_fn=lambda: calls.append(("begin",)),
                assert_interface_uniqueness_fn=lambda _iface, _port, _cidr, exclude_id=None: None,
                insert_interface_fn=lambda *_args: 100,
                apply_interface_runtime_fn=lambda *_args: (_ for _ in ()).throw(RuntimeError("boom")),
                commit_fn=lambda: calls.append(("commit",)),
                delete_interface_row_fn=lambda row_id: calls.append(("delete-row", row_id)),
                rollback_fn=lambda: calls.append(("rollback",)),
                fetch_interface_row_fn=lambda _row_id: None,
            )

        self.assertIn(("delete-row", 100), calls)
        self.assertEqual(calls.count(("commit",)), 1)
        self.assertNotIn(("rollback",), calls)

    def test_delete_interface_service_clients_attached(self):
        with self.assertRaisesRegex(ValueError, "Interface has clients attached"):
            interface_service_ops.delete_interface_service(
                7,
                fetch_interface_row_fn=lambda _id: (7, "awg0"),
                count_interface_clients_fn=lambda _iface: 1,
                remove_interface_runtime_fn=lambda _iface: None,
                delete_interface_row_fn=lambda _id: None,
                commit_fn=lambda: None,
            )

    def test_update_interface_service_success_and_rename(self):
        calls = []
        rows = {
            7: (
                7,
                "awg0",
                "2",
                51820,
                "10.10.0.1",
                24,
                "priv",
                "pub",
                "198.51.100.10",
                "1.1.1.1",
            ),
        }

        def _fetch(interface_id):
            return rows.get(interface_id)

        def _update(
            interface_id,
            wg_interface,
            awg_version,
            wg_ip_addr,
            wg_ip_cidr,
            port_number,
            private_key,
            public_key,
            srv_ip,
            srv_dns,
            awg_params,
        ):
            calls.append(("update", interface_id, wg_interface, awg_version, port_number, dict(awg_params)))
            rows[interface_id] = (
                interface_id,
                wg_interface,
                awg_version,
                port_number,
                wg_ip_addr,
                wg_ip_cidr,
                private_key,
                public_key,
                srv_ip,
                srv_dns,
            )

        row = interface_service_ops.update_interface_service(
            7,
            {"wg_interface": "awg1", "port_number": "51821", "awg_params": {"Jc": "9"}},
            fetch_interface_row_fn=_fetch,
            build_awg_params_from_row_fn=lambda _row: {"Jc": "1"},
            detect_awg_version_fn=lambda version, _params: version,
            normalize_config_value_fn=lambda value: value,
            validate_interface_name_fn=lambda _name: None,
            parse_and_validate_port_fn=lambda port: int(port),
            parse_and_validate_interface_network_fn=lambda ip, cidr: (int(cidr), f"{ip}/{cidr}"),
            validate_ip_literal_fn=lambda _ip, _field: None,
            prepare_awg_params_for_version_fn=lambda _version: {"Jc": None},
            validate_awg_params_fn=lambda _version, _params: None,
            begin_tx_fn=lambda: calls.append(("begin",)),
            assert_interface_uniqueness_fn=lambda iface, port, cidr, exclude_id=None: calls.append(("unique", iface, port, cidr, exclude_id)),
            remove_interface_runtime_fn=lambda iface: calls.append(("remove-runtime", iface)),
            update_interface_row_fn=_update,
            update_clients_interface_fn=lambda new_iface, old_iface: calls.append(("update-clients", new_iface, old_iface)),
            apply_interface_runtime_fn=lambda iface, port, *_args: calls.append(("apply-runtime", iface, port)),
            commit_fn=lambda: calls.append(("commit",)),
            rollback_fn=lambda: calls.append(("rollback",)),
        )

        self.assertEqual(row[1], "awg1")
        self.assertIn(("update-clients", "awg1", "awg0"), calls)
        self.assertIn(("apply-runtime", "awg1", 51821), calls)
        self.assertIn(("commit",), calls)

    def test_update_interface_service_keeps_disabled_interface_down(self):
        calls = []
        rows = {
            7: (
                7,
                "awg0",
                "2",
                51820,
                "10.10.0.1",
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
                0,
            ),
        }

        def _fetch(interface_id):
            return rows.get(interface_id)

        def _update(interface_id, wg_interface, awg_version, wg_ip_addr, wg_ip_cidr, port_number, private_key, public_key, srv_ip, srv_dns, awg_params):
            rows[interface_id] = (*rows[interface_id][:1], wg_interface, awg_version, port_number, wg_ip_addr, wg_ip_cidr, private_key, public_key, srv_ip, srv_dns, *rows[interface_id][10:])

        row = interface_service_ops.update_interface_service(
            7,
            {"srv_dns": "9.9.9.9"},
            fetch_interface_row_fn=_fetch,
            build_awg_params_from_row_fn=lambda _row: {"Jc": "1"},
            detect_awg_version_fn=lambda version, _params: version,
            normalize_config_value_fn=lambda value: value,
            validate_interface_name_fn=lambda _name: None,
            parse_and_validate_port_fn=lambda port: int(port),
            parse_and_validate_interface_network_fn=lambda ip, cidr: (int(cidr), f"{ip}/{cidr}"),
            validate_ip_literal_fn=lambda _ip, _field: None,
            prepare_awg_params_for_version_fn=lambda _version: {"Jc": None},
            validate_awg_params_fn=lambda _version, _params: None,
            begin_tx_fn=lambda: calls.append(("begin",)),
            assert_interface_uniqueness_fn=lambda iface, port, cidr, exclude_id=None: calls.append(("unique", iface, port, cidr, exclude_id)),
            remove_interface_runtime_fn=lambda iface: calls.append(("remove-runtime", iface)),
            update_interface_row_fn=_update,
            update_clients_interface_fn=lambda *_args: None,
            apply_interface_runtime_fn=lambda iface, port, *_args: calls.append(("apply-runtime", iface, port)),
            commit_fn=lambda: calls.append(("commit",)),
            rollback_fn=lambda: calls.append(("rollback",)),
        )

        self.assertEqual(row[1], "awg0")
        self.assertNotIn(("remove-runtime", "awg0"), calls)
        self.assertNotIn(("apply-runtime", "awg0", 51820), calls)
        self.assertIn(("commit",), calls)

    def test_set_interface_enabled_service_toggles_runtime_and_enabled_peers(self):
        calls = []
        rows = {
            7: (
                7,
                "awg0",
                "2",
                51820,
                "10.10.0.1",
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
                1,
            ),
        }

        def _fetch(interface_id):
            return rows.get(interface_id)

        def _update_enabled(interface_id, enabled):
            calls.append(("enabled", interface_id, enabled))
            rows[interface_id] = (*rows[interface_id][:26], enabled)

        disabled = interface_service_ops.set_interface_enabled_service(
            7,
            False,
            fetch_interface_row_fn=_fetch,
            build_awg_params_from_row_fn=lambda _row: {"Jc": "1"},
            remove_interface_runtime_fn=lambda iface: calls.append(("remove-runtime", iface)),
            apply_interface_runtime_fn=lambda iface, port, ip, cidr, private, version, params: calls.append(("apply-runtime", iface, port, ip, cidr, private, version, dict(params))),
            fetch_enabled_peer_rows_fn=lambda iface: calls.append(("fetch-peers", iface)) or [("peer-pub", "10.10.0.2")],
            runtime_add_peer_fn=lambda iface, pub, ip: calls.append(("add-peer", iface, pub, ip)),
            update_interface_enabled_fn=_update_enabled,
            commit_fn=lambda: calls.append(("commit",)),
        )
        enabled = interface_service_ops.set_interface_enabled_service(
            7,
            True,
            fetch_interface_row_fn=_fetch,
            build_awg_params_from_row_fn=lambda _row: {"Jc": "1"},
            remove_interface_runtime_fn=lambda iface: calls.append(("remove-runtime", iface)),
            apply_interface_runtime_fn=lambda iface, port, ip, cidr, private, version, params: calls.append(("apply-runtime", iface, port, ip, cidr, private, version, dict(params))),
            fetch_enabled_peer_rows_fn=lambda iface: calls.append(("fetch-peers", iface)) or [("peer-pub", "10.10.0.2")],
            runtime_add_peer_fn=lambda iface, pub, ip: calls.append(("add-peer", iface, pub, ip)),
            update_interface_enabled_fn=_update_enabled,
            commit_fn=lambda: calls.append(("commit",)),
        )

        self.assertEqual(disabled[26], 0)
        self.assertEqual(enabled[26], 1)
        self.assertEqual(
            calls,
            [
                ("remove-runtime", "awg0"),
                ("enabled", 7, 0),
                ("commit",),
                ("apply-runtime", "awg0", 51820, "10.10.0.1", 24, "priv", "2", {"Jc": "1"}),
                ("fetch-peers", "awg0"),
                ("add-peer", "awg0", "peer-pub", "10.10.0.2"),
                ("enabled", 7, 1),
                ("commit",),
            ],
        )

    def test_update_interface_service_failure_rolls_back(self):
        calls = []
        row = (7, "awg0", "2", 51820, "10.10.0.1", 24, "priv", "pub", "198.51.100.10", "1.1.1.1")

        with self.assertRaisesRegex(RuntimeError, "runtime-fail"):
            interface_service_ops.update_interface_service(
                7,
                {},
                fetch_interface_row_fn=lambda _id: row,
                build_awg_params_from_row_fn=lambda _row: {"Jc": "1"},
                detect_awg_version_fn=lambda version, _params: version,
                normalize_config_value_fn=lambda value: value,
                validate_interface_name_fn=lambda _name: None,
                parse_and_validate_port_fn=lambda port: int(port),
                parse_and_validate_interface_network_fn=lambda ip, cidr: (int(cidr), f"{ip}/{cidr}"),
                validate_ip_literal_fn=lambda _ip, _field: None,
                prepare_awg_params_for_version_fn=lambda _version: {"Jc": None},
                validate_awg_params_fn=lambda _version, _params: None,
                begin_tx_fn=lambda: None,
                assert_interface_uniqueness_fn=lambda _iface, _port, _cidr, exclude_id=None: None,
                remove_interface_runtime_fn=lambda _iface: None,
                update_interface_row_fn=lambda *_args: None,
                update_clients_interface_fn=lambda *_args: None,
                apply_interface_runtime_fn=lambda *_args: (_ for _ in ()).throw(RuntimeError("runtime-fail")),
                commit_fn=lambda: calls.append(("commit",)),
                rollback_fn=lambda: calls.append(("rollback",)),
            )

        self.assertIn(("rollback",), calls)
        self.assertNotIn(("commit",), calls)


if __name__ == "__main__":
    unittest.main()
