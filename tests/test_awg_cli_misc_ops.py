import unittest

from backend.domains.awg import cli_misc_ops


class InterfacesClientsCliMiscOpsTest(unittest.TestCase):
    def test_client_qrencode_success(self):
        printed = []
        rendered = []
        interface_row = (
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
        cli_misc_ops.client_qrencode(
            list_clients_fn=lambda: printed.append("LIST"),
            input_fn=lambda _prompt: "1",
            fetch_client_by_id_fn=lambda _cid: (1, "alice", "pubc", "enc", "10.0.0.2", "awg0"),
            fetch_interface_by_name_fn=lambda _iface: interface_row,
            build_awg_params_from_row_fn=lambda _row: {"Jc": "5"},
            build_client_config_lines_fn=lambda *_args: ["[Interface]", "PrivateKey = dec:enc"],
            decrypt_private_key_fn=lambda value: f"dec:{value}",
            render_qr_in_terminal_fn=lambda content: rendered.append(content),
            print_fn=lambda line: printed.append(str(line)),
        )
        self.assertIn("LIST", printed)
        self.assertTrue(any("[Interface]" in line for line in printed))
        self.assertIn("QR code:", printed)
        self.assertEqual(len(rendered), 1)
        self.assertTrue(rendered[0].endswith("\n"))

    def test_client_qrencode_missing_rows(self):
        printed = []
        cli_misc_ops.client_qrencode(
            list_clients_fn=lambda: None,
            input_fn=lambda _prompt: "42",
            fetch_client_by_id_fn=lambda _cid: None,
            fetch_interface_by_name_fn=lambda _iface: None,
            build_awg_params_from_row_fn=lambda _row: {},
            build_client_config_lines_fn=lambda *_args: [],
            decrypt_private_key_fn=lambda value: value,
            render_qr_in_terminal_fn=lambda _content: None,
            print_fn=lambda line: printed.append(str(line)),
        )
        self.assertTrue(any("клиент 42 не найден" in line for line in printed))

        printed = []
        cli_misc_ops.client_qrencode(
            list_clients_fn=lambda: None,
            input_fn=lambda _prompt: "1",
            fetch_client_by_id_fn=lambda _cid: (1, "alice", "pubc", "enc", "10.0.0.2", "awg0"),
            fetch_interface_by_name_fn=lambda _iface: None,
            build_awg_params_from_row_fn=lambda _row: {},
            build_client_config_lines_fn=lambda *_args: [],
            decrypt_private_key_fn=lambda value: value,
            render_qr_in_terminal_fn=lambda _content: None,
            print_fn=lambda line: printed.append(str(line)),
        )
        self.assertTrue(any("Ошибка: awg0" in line for line in printed))

    def test_show_api_key_status(self):
        printed = []
        cli_misc_ops.show_api_key_status(
            load_api_key_fn=lambda: None,
            api_key_env_var="AWG_KEY",
            api_key_file="/tmp/api.key",
            print_fn=lambda line: printed.append(str(line)),
        )
        self.assertTrue(any("AWG_KEY" in line and "/tmp/api.key" in line for line in printed))

        printed = []
        cli_misc_ops.show_api_key_status(
            load_api_key_fn=lambda: "abcdef123456",
            api_key_env_var="AWG_KEY",
            api_key_file="/tmp/api.key",
            print_fn=lambda line: printed.append(str(line)),
        )
        self.assertTrue(any("3456" in line for line in printed))

    def test_set_api_key(self):
        printed = []
        saved = []
        cli_misc_ops.set_api_key(
            getpass_fn=lambda _prompt: "   ",
            save_api_key_fn=lambda value: saved.append(value),
            api_key_file="/tmp/api.key",
            print_fn=lambda line: printed.append(str(line)),
        )
        self.assertEqual(saved, [])
        self.assertTrue(any("пустой API key" in line for line in printed))

        printed = []
        saved = []
        cli_misc_ops.set_api_key(
            getpass_fn=lambda _prompt: "secret",
            save_api_key_fn=lambda value: saved.append(value),
            api_key_file="/tmp/api.key",
            print_fn=lambda line: printed.append(str(line)),
        )
        self.assertEqual(saved, ["secret"])
        self.assertTrue(any("/tmp/api.key" in line for line in printed))


if __name__ == "__main__":
    unittest.main()
