import types
import unittest

from backend.domains.awg import cli_legacy_ops


class InterfacesClientsCliLegacyOpsTest(unittest.TestCase):
    def test_add_client_success_and_ip_error(self):
        printed = []
        inserted = []
        commands = []

        answers = iter(["alice", "awg0", "yes"])

        def _check_output(cmd, input=None):
            if cmd == ["awg", "genkey"]:
                return b"priv\n"
            if cmd == ["awg", "pubkey"]:
                self.assertEqual(input, b"priv")
                return b"pub\n"
            raise AssertionError("unexpected check_output")

        cli_legacy_ops.add_client(
            input_fn=lambda _prompt: next(answers),
            get_next_available_ip_fn=lambda _iface: "10.0.0.2",
            run_check_output_fn=_check_output,
            encrypt_private_key_fn=lambda value: f"enc:{value}",
            insert_client_row_fn=lambda *args: inserted.append(args),
            commit_fn=lambda: printed.append("COMMIT"),
            run_command_fn=lambda cmd: commands.append(list(cmd)),
            print_fn=lambda line: printed.append(str(line)),
            sqlite_error_type=RuntimeError,
            called_process_error_type=ValueError,
        )

        self.assertEqual(len(inserted), 1)
        self.assertIn(["awg", "set", "awg0", "peer", "pub", "allowed-ips", "10.0.0.2/32"], commands)
        self.assertTrue(any("успешно добавлен в базу данных" in line for line in printed))

        printed = []
        cli_legacy_ops.add_client(
            input_fn=lambda _prompt: "x",
            get_next_available_ip_fn=lambda _iface: (_ for _ in ()).throw(ValueError("no ip")),
            run_check_output_fn=lambda *_args, **_kwargs: b"",
            encrypt_private_key_fn=lambda value: value,
            insert_client_row_fn=lambda *_args: None,
            commit_fn=lambda: None,
            run_command_fn=lambda _cmd: None,
            print_fn=lambda line: printed.append(str(line)),
            sqlite_error_type=RuntimeError,
            called_process_error_type=ValueError,
        )
        self.assertTrue(any("Ошибка при назначении IP-адреса" in line for line in printed))

    def test_delete_client_paths(self):
        printed = []
        calls = []

        cli_legacy_ops.delete_client(
            list_clients_fn=lambda: calls.append("list"),
            input_fn=lambda _prompt: "42",
            fetch_client_by_id_fn=lambda _client_id: None,
            run_command_fn=lambda _cmd: calls.append("run"),
            delete_client_row_fn=lambda _row_id: calls.append("delete"),
            commit_fn=lambda: calls.append("commit"),
            del_peer_fn=lambda _iface, _pub: calls.append("del_peer"),
            print_fn=lambda line: printed.append(str(line)),
        )
        self.assertTrue(any("клиент c id 42 не найден" in line for line in printed))
        self.assertNotIn("commit", calls)

        printed = []
        calls = []
        cli_legacy_ops.delete_client(
            list_clients_fn=lambda: calls.append("list"),
            input_fn=lambda _prompt: "1",
            fetch_client_by_id_fn=lambda _client_id: (1, "alice", "pub", "enc", "10.0.0.2", "awg0"),
            run_command_fn=lambda cmd: calls.append(("run", list(cmd))),
            delete_client_row_fn=lambda row_id: calls.append(("delete", row_id)),
            commit_fn=lambda: calls.append("commit"),
            del_peer_fn=lambda iface, pub: calls.append(("del_peer", iface, pub)),
            print_fn=lambda line: printed.append(str(line)),
        )
        self.assertIn(("delete", 1), calls)
        self.assertIn(("del_peer", "awg0", "pub"), calls)
        self.assertTrue(any("Клиент alice удалён." in line for line in printed))

    def test_sync(self):
        printed = []
        commands = []

        def _run_command(cmd, check=False, stdout=None, stderr=None, text=False):
            commands.append((list(cmd), check, stdout, stderr, text))
            if cmd[:3] == ["ip", "link", "show"]:
                return types.SimpleNamespace(returncode=1, args=cmd, stdout="", stderr="")
            if cmd[:4] == ["ip", "link", "add", "awg0"]:
                return types.SimpleNamespace(returncode=0, args=cmd, stdout="", stderr="")
            return types.SimpleNamespace(returncode=0, args=cmd, stdout="", stderr="")

        cli_legacy_ops.sync(
            1,
            run_check_output_fn=lambda _cmd, text=False: "2: awg0: <BROADCAST>\n",
            run_command_fn=_run_command,
            fetch_interfaces_fn=lambda: [
                (
                    1,
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
                    8,
                    9,
                    10,
                    11,
                    None,
                    None,
                    None,
                    None,
                    None,
                )
            ],
            build_awg_set_command_fn=lambda *_args: ["awg", "set", "awg0"],
            write_key_file_fn=lambda path, content: commands.append((["write", path, content], True, None, None, False)),
            fetch_clients_fn=lambda: [(1, "alice", "pubc", "enc", "10.0.0.2", "awg0")],
            apply_firewall_rules_fn=lambda: (_ for _ in ()).throw(RuntimeError("fw boom")),
            print_fn=lambda line: printed.append(str(line)),
            called_process_error_type=RuntimeError,
            devnull="DEVNULL",
            pipe="PIPE",
        )

        flat_cmds = [item[0] for item in commands]
        self.assertIn(["ip", "link", "delete", "awg0"], flat_cmds)
        self.assertIn(["ip", "link", "add", "awg0", "type", "amneziawg"], flat_cmds)
        self.assertIn(["awg", "set", "awg0"], flat_cmds)
        self.assertTrue(any("Firewall restore error: fw boom" in line for line in printed))


if __name__ == "__main__":
    unittest.main()
