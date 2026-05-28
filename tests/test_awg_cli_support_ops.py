import unittest

from backend.domains.awg import cli_support_ops


class InterfacesClientsCliSupportOpsTest(unittest.TestCase):
    def test_show_and_set_api_key(self):
        printed = []
        cli_support_ops.show_api_key_status(
            load_api_key_fn=lambda: None,
            api_key_env_var="AWG_KEY",
            api_key_file="/tmp/api.key",
            print_fn=lambda line: printed.append(str(line)),
        )
        self.assertTrue(any("AWG_KEY" in line for line in printed))

        saved = []
        printed = []
        cli_support_ops.set_api_key(
            getpass_fn=lambda _prompt: "secret",
            save_api_key_fn=lambda value: saved.append(value),
            api_key_file="/tmp/api.key",
            print_fn=lambda line: printed.append(str(line)),
        )
        self.assertEqual(saved, ["secret"])
        self.assertTrue(any("/tmp/api.key" in line for line in printed))

    def test_wg_lease_ip_and_peer_ops(self):
        output = (
            "pub1\t10.0.0.2/32\n"
            "pub2\t(none)\n"
            "pub3\t10.0.0.3/32\n"
        ).encode("utf-8")
        leases = cli_support_ops.wg_lease_ip(
            "awg0",
            run_check_output_fn=lambda cmd: output if cmd == ["awg", "show", "awg0", "allowed-ips"] else b"",
        )
        self.assertEqual(leases, ["10.0.0.2/32", "10.0.0.3/32"])

        commands = []
        printed = []
        cli_support_ops.add_peer(
            "awg0",
            "pub1",
            "10.0.0.2/32",
            run_command_fn=lambda cmd: commands.append(cmd),
            print_fn=lambda msg: printed.append(msg),
            called_process_error_type=RuntimeError,
        )
        cli_support_ops.del_peer(
            "awg0",
            "pub1",
            run_command_fn=lambda cmd: commands.append(cmd),
            print_fn=lambda msg: printed.append(msg),
            called_process_error_type=RuntimeError,
        )
        self.assertEqual(commands[0], ["awg", "set", "awg0", "peer", "pub1", "allowed-ips", "10.0.0.2/32"])
        self.assertEqual(commands[1], ["awg", "set", "awg0", "peer", "pub1", "remove"])


if __name__ == "__main__":
    unittest.main()
