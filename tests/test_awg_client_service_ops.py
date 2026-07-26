import unittest

from backend.domains.awg import client_service_ops


class InterfacesClientsClientServiceOpsTest(unittest.TestCase):
    def test_create_client_service(self):
        calls = []
        rows = {}

        def _insert(name, pub, encrypted_priv, ip, wg_iface):
            calls.append(("insert", name, pub, encrypted_priv, ip, wg_iface))
            rows[10] = (10, name, pub, encrypted_priv, ip, wg_iface)
            return 10

        row = client_service_ops.create_client_service(
            {"name": "alice", "wg_interface": "awg0"},
            normalize_config_value_fn=lambda value: value,
            interface_exists_fn=lambda iface: iface == "awg0",
            get_next_available_ip_fn=lambda iface: "10.0.0.2",
            generate_keypair_fn=lambda: ("priv", "pub"),
            encrypt_private_key_fn=lambda priv: f"enc:{priv}",
            insert_client_fn=_insert,
            upsert_client_settings_fn=lambda client_id, allowed: calls.append(("settings", client_id, allowed)),
            commit_fn=lambda: calls.append(("commit",)),
            runtime_add_peer_fn=lambda iface, pub, ip: calls.append(("add-peer", iface, pub, ip)),
            fetch_client_row_fn=lambda client_id: rows.get(client_id),
        )

        self.assertEqual(row[1], "alice")
        self.assertEqual(row[2], "pub")
        self.assertEqual(row[4], "10.0.0.2")
        self.assertIn(("settings", 10, "0.0.0.0/0"), calls)
        self.assertIn(("add-peer", "awg0", "pub", "10.0.0.2"), calls)

    def test_create_client_service_interface_not_found(self):
        with self.assertRaisesRegex(LookupError, "Interface not found"):
            client_service_ops.create_client_service(
                {"name": "alice", "wg_interface": "missing"},
                normalize_config_value_fn=lambda value: value,
                interface_exists_fn=lambda _iface: False,
                get_next_available_ip_fn=lambda iface: "10.0.0.2",
                generate_keypair_fn=lambda: ("priv", "pub"),
                encrypt_private_key_fn=lambda priv: f"enc:{priv}",
                insert_client_fn=lambda *_args: 1,
                upsert_client_settings_fn=lambda *_args: None,
                commit_fn=lambda: None,
                runtime_add_peer_fn=lambda *_args: None,
                fetch_client_row_fn=lambda _client_id: None,
            )

    def test_delete_client_service(self):
        calls = []
        current_row = (7, "bob", "pub-bob", "enc-priv", "10.0.0.7", "awg0")

        row = client_service_ops.delete_client_service(
            7,
            fetch_client_row_fn=lambda client_id: current_row if client_id == 7 else None,
            runtime_remove_peer_fn=lambda iface, pub: calls.append(("remove-peer", iface, pub)),
            delete_client_settings_fn=lambda client_id: calls.append(("delete-settings", client_id)),
            delete_client_fn=lambda client_id: calls.append(("delete-client", client_id)),
            commit_fn=lambda: calls.append(("commit",)),
        )

        self.assertEqual(row, current_row)
        self.assertEqual(
            calls,
            [
                ("remove-peer", "awg0", "pub-bob"),
                ("delete-settings", 7),
                ("delete-client", 7),
                ("commit",),
            ],
        )

    def test_update_client_service_interface_changed_auto_ip(self):
        calls = []
        rows = {
            3: (3, "alice", "old-pub", "enc-old", "10.0.0.3", "awg0"),
        }

        def _fetch(client_id):
            return rows.get(client_id)

        def _update(client_id, name, pub, encrypted_priv, ip, wg_iface):
            calls.append(("update", client_id, name, pub, encrypted_priv, ip, wg_iface))
            rows[client_id] = (client_id, name, pub, encrypted_priv, ip, wg_iface)

        row = client_service_ops.update_client_service(
            3,
            {"wg_interface": "awg1", "name": "alice2"},
            normalize_config_value_fn=lambda value: value,
            fetch_client_row_fn=_fetch,
            interface_exists_fn=lambda iface: iface in {"awg0", "awg1"},
            get_next_available_ip_fn=lambda iface, exclude_client_id=None: "10.1.0.8",
            validate_client_ip_for_interface_fn=lambda *_args, **_kwargs: calls.append(("validate",)),
            encrypt_private_key_fn=lambda priv: f"enc:{priv}",
            runtime_remove_peer_fn=lambda iface, pub: calls.append(("remove-peer", iface, pub)),
            update_client_fn=_update,
            upsert_client_settings_fn=lambda client_id, allowed: calls.append(("settings", client_id, allowed)),
            commit_fn=lambda: calls.append(("commit",)),
            runtime_add_peer_fn=lambda iface, pub, ip: calls.append(("add-peer", iface, pub, ip)),
        )

        self.assertEqual(row[1], "alice2")
        self.assertEqual(row[4], "10.1.0.8")
        self.assertNotIn(("validate",), calls)
        self.assertIn(("remove-peer", "awg0", "old-pub"), calls)
        self.assertIn(("add-peer", "awg1", "old-pub", "10.1.0.8"), calls)

    def test_update_client_service_validate_path_and_allowed_ips(self):
        calls = []
        rows = {
            3: (3, "alice", "old-pub", "enc-old", "10.0.0.3", "awg0"),
        }

        def _fetch(client_id):
            return rows.get(client_id)

        def _update(client_id, name, pub, encrypted_priv, ip, wg_iface):
            rows[client_id] = (client_id, name, pub, encrypted_priv, ip, wg_iface)

        row = client_service_ops.update_client_service(
            3,
            {"ip": "10.0.0.9", "allowed_ips": "10.0.0.0/24"},
            normalize_config_value_fn=lambda value: value,
            fetch_client_row_fn=_fetch,
            interface_exists_fn=lambda iface: iface == "awg0",
            get_next_available_ip_fn=lambda iface, exclude_client_id=None: "10.0.0.200",
            validate_client_ip_for_interface_fn=lambda ip, iface, exclude_client_id=None: calls.append(("validate", ip, iface, exclude_client_id)),
            encrypt_private_key_fn=lambda priv: f"enc:{priv}",
            runtime_remove_peer_fn=lambda iface, pub: None,
            update_client_fn=_update,
            upsert_client_settings_fn=lambda client_id, allowed: calls.append(("settings", client_id, allowed)),
            commit_fn=lambda: None,
            runtime_add_peer_fn=lambda iface, pub, ip: calls.append(("add-peer", iface, pub, ip)),
        )

        self.assertEqual(row[2], "old-pub")
        self.assertEqual(row[3], "enc-old")
        self.assertEqual(row[4], "10.0.0.9")
        self.assertIn(("validate", "10.0.0.9", "awg0", 3), calls)
        self.assertIn(("settings", 3, "10.0.0.0/24"), calls)

    def test_update_client_service_keeps_disabled_peer_removed(self):
        calls = []
        rows = {
            3: (3, "alice", "old-pub", "enc-old", "10.0.0.3", "awg0", 0),
        }

        def _fetch(client_id):
            return rows.get(client_id)

        def _update(client_id, name, pub, encrypted_priv, ip, wg_iface):
            rows[client_id] = (client_id, name, pub, encrypted_priv, ip, wg_iface, rows[client_id][6])

        row = client_service_ops.update_client_service(
            3,
            {"name": "alice2"},
            normalize_config_value_fn=lambda value: value,
            fetch_client_row_fn=_fetch,
            interface_exists_fn=lambda iface: iface == "awg0",
            get_next_available_ip_fn=lambda iface, exclude_client_id=None: "10.0.0.200",
            validate_client_ip_for_interface_fn=lambda *_args, **_kwargs: None,
            encrypt_private_key_fn=lambda priv: f"enc:{priv}",
            runtime_remove_peer_fn=lambda iface, pub: calls.append(("remove-peer", iface, pub)),
            update_client_fn=_update,
            upsert_client_settings_fn=lambda *_args: None,
            commit_fn=lambda: calls.append(("commit",)),
            runtime_add_peer_fn=lambda iface, pub, ip: calls.append(("add-peer", iface, pub, ip)),
        )

        self.assertEqual(row[1], "alice2")
        self.assertIn(("remove-peer", "awg0", "old-pub"), calls)
        self.assertNotIn(("add-peer", "awg0", "old-pub", "10.0.0.3"), calls)

    def test_set_client_enabled_service_toggles_runtime_peer(self):
        calls = []
        rows = {
            3: (3, "alice", "pub-a", "enc-a", "10.0.0.3", "awg0", 1),
        }

        def _fetch(client_id):
            return rows.get(client_id)

        def _update_enabled(client_id, enabled):
            calls.append(("enabled", client_id, enabled))
            current = rows[client_id]
            rows[client_id] = (*current[:6], enabled)

        disabled = client_service_ops.set_client_enabled_service(
            3,
            False,
            fetch_client_row_fn=_fetch,
            update_client_enabled_fn=_update_enabled,
            runtime_remove_peer_fn=lambda iface, pub: calls.append(("remove-peer", iface, pub)),
            runtime_add_peer_fn=lambda iface, pub, ip: calls.append(("add-peer", iface, pub, ip)),
            commit_fn=lambda: calls.append(("commit",)),
        )
        enabled = client_service_ops.set_client_enabled_service(
            3,
            True,
            fetch_client_row_fn=_fetch,
            update_client_enabled_fn=_update_enabled,
            runtime_remove_peer_fn=lambda iface, pub: calls.append(("remove-peer", iface, pub)),
            runtime_add_peer_fn=lambda iface, pub, ip: calls.append(("add-peer", iface, pub, ip)),
            commit_fn=lambda: calls.append(("commit",)),
        )

        self.assertEqual(disabled[6], 0)
        self.assertEqual(enabled[6], 1)
        self.assertEqual(
            calls,
            [
                ("remove-peer", "awg0", "pub-a"),
                ("enabled", 3, 0),
                ("commit",),
                ("add-peer", "awg0", "pub-a", "10.0.0.3"),
                ("enabled", 3, 1),
                ("commit",),
            ],
        )


if __name__ == "__main__":
    unittest.main()
