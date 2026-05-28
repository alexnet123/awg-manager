import unittest

from backend.domains.awg import config_render_ops


class InterfacesClientsConfigRenderOpsTest(unittest.TestCase):
    def test_serialize_interface_row(self):
        row = (
            7,
            "awg0",
            "2",
            "51820",
            "10.10.0.1",
            "24",
            "server-priv",
            "server-pub",
            "198.51.100.10",
            "1.1.1.1",
        )

        result = config_render_ops.serialize_interface_row(
            row,
            build_awg_params_from_row_fn=lambda _row: {"Jc": "5", "S3": "1"},
            detect_awg_version_fn=lambda _version, _params: "2",
            get_filtered_awg_params_fn=lambda _version, params: params,
        )

        self.assertEqual(result["id"], 7)
        self.assertEqual(result["wg_interface"], "awg0")
        self.assertEqual(result["awg_version"], "2")
        self.assertEqual(result["awg_params"]["Jc"], "5")

    def test_serialize_client_row_defaults_and_private_key(self):
        row = (1, "alice", "pub", "enc-priv", "10.0.0.2", "awg0")

        result = config_render_ops.serialize_client_row(
            row,
            fetch_allowed_ips_fn=lambda _client_id: None,
            normalize_config_value_fn=lambda value: value,
            decrypt_private_key_fn=lambda value: f"dec:{value}",
            include_private_key=True,
        )
        self.assertEqual(result["allowed_ips"], "0.0.0.0/0")
        self.assertEqual(result["privkey"], "dec:enc-priv")

        result_custom = config_render_ops.serialize_client_row(
            row,
            fetch_allowed_ips_fn=lambda _client_id: ("10.0.0.0/24",),
            normalize_config_value_fn=lambda value: value,
            decrypt_private_key_fn=lambda value: f"dec:{value}",
            include_private_key=False,
        )
        self.assertEqual(result_custom["allowed_ips"], "10.0.0.0/24")
        self.assertNotIn("privkey", result_custom)

    def test_build_client_config(self):
        client_row = (1, "alice", "pub", "enc-priv", "10.0.0.2", "awg0")
        interface_row = (
            7,
            "awg0",
            "2",
            "51820",
            "10.10.0.1",
            "24",
            "server-priv",
            "server-pub",
            "198.51.100.10",
            "1.1.1.1",
        )

        config = config_render_ops.build_client_config(
            client_row,
            interface_row,
            fetch_allowed_ips_fn=lambda _client_id: ("10.0.0.0/24",),
            normalize_config_value_fn=lambda value: value,
            build_awg_params_from_row_fn=lambda _row: {"Jc": "3"},
            build_client_config_lines_fn=lambda *args: [
                "AllowedIPs = " + args[8],
                "PrivateKey = " + args[0],
            ],
            decrypt_private_key_fn=lambda value: f"dec:{value}",
        )

        self.assertIn("AllowedIPs = 10.0.0.0/24", config)
        self.assertIn("PrivateKey = dec:enc-priv", config)
        self.assertTrue(config.endswith("\n"))

    def test_build_interface_server_config(self):
        interface_row = (
            7,
            "awg0",
            "2",
            "51820",
            "10.10.0.1",
            "24",
            "server-priv",
            "server-pub",
            "198.51.100.10",
            "1.1.1.1",
        )
        seen_params = []

        config = config_render_ops.build_interface_server_config(
            interface_row,
            build_awg_params_from_row_fn=lambda _row: {"Jc": "3", "S3": "9", "I1": "7"},
            normalize_config_value_fn=lambda value: value,
            detect_awg_version_fn=lambda _version, _params: "2",
            append_config_param_fn=lambda lines, key, value: (seen_params.append((key, value)), lines.append(f"{key} = {value}")),
            fetch_peer_rows_fn=lambda _iface: [("peer-pub-1", "10.10.0.10"), ("peer-pub-2", "10.10.0.11")],
        )

        self.assertIn("PrivateKey = server-priv", config)
        self.assertIn("DNS = 1.1.1.1", config)
        self.assertIn("PublicKey = peer-pub-1", config)
        self.assertIn("AllowedIPs = 10.10.0.10/32", config)
        self.assertIn(("Jc", "3"), seen_params)
        self.assertIn(("S3", "9"), seen_params)
        self.assertTrue(config.endswith("\n"))


if __name__ == "__main__":
    unittest.main()
