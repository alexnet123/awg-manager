import unittest

from backend.domains.awg import runtime_ops


class _FakeTempFile:
    def __init__(self, name):
        self.name = name
        self.content = ""
        self.closed = False

    def write(self, value):
        self.content += value

    def flush(self):
        return None

    def close(self):
        self.closed = True


class InterfacesClientsRuntimeOpsTest(unittest.TestCase):
    def test_generate_keypair(self):
        calls = []

        def _check_output(cmd, input=None):
            calls.append((cmd, input))
            if cmd == ["awg", "genkey"]:
                return b"privkey\n"
            if cmd == ["awg", "pubkey"]:
                self.assertEqual(input, b"privkey")
                return b"pubkey\n"
            raise AssertionError("unexpected command")

        priv, pub = runtime_ops.generate_keypair(run_check_output_fn=_check_output)
        self.assertEqual(priv, "privkey")
        self.assertEqual(pub, "pubkey")
        self.assertEqual(len(calls), 2)

    def test_create_temp_key_file(self):
        fake = _FakeTempFile("/tmp/key-file")
        chmod_calls = []

        path = runtime_ops.create_temp_key_file(
            "secret",
            named_temporary_file_factory_fn=lambda **_kwargs: fake,
            chmod_fn=lambda target, mode: chmod_calls.append((target, mode)),
        )
        self.assertEqual(path, "/tmp/key-file")
        self.assertEqual(fake.content, "secret")
        self.assertTrue(fake.closed)
        self.assertEqual(chmod_calls, [("/tmp/key-file", 0o600)])

    def test_build_awg_set_command_and_client_config_lines(self):
        cmd = runtime_ops.build_awg_set_command(
            "awg0",
            51820,
            "/tmp/key",
            "2",
            {"Jc": "3", "Jmin": None, "S1": "7", "S3": "9", "I5": "11"},
            detect_awg_version_fn=lambda version, _params: version,
            normalize_config_value_fn=lambda value: value,
        )
        self.assertEqual(cmd[:7], ["awg", "set", "awg0", "listen-port", "51820", "private-key", "/tmp/key"])
        self.assertIn("jc", cmd)
        self.assertIn("s3", cmd)
        self.assertIn("i5", cmd)
        self.assertNotIn("jmin", cmd)

        lines = runtime_ops.build_client_config_lines(
            "client-priv",
            "10.0.0.2",
            "1.1.1.1",
            "2",
            {"Jc": "3", "S3": "9"},
            "server-pub",
            "198.51.100.10",
            51820,
            detect_awg_version_fn=lambda version, _params: version,
            append_config_param_fn=lambda arr, key, value: arr.append(f"{key} = {value}") if value is not None else None,
            allowed_ips="10.0.0.0/24",
        )
        rendered = "\n".join(lines)
        self.assertIn("PrivateKey = client-priv", rendered)
        self.assertIn("Jc = 3", rendered)
        self.assertIn("S3 = 9", rendered)
        self.assertIn("AllowedIPs = 10.0.0.0/24", rendered)

    def test_apply_and_remove_interface_runtime(self):
        commands = []
        unlinked = []

        runtime_ops.apply_interface_runtime(
            "awg0",
            51820,
            "10.0.0.1",
            24,
            "priv",
            "2",
            {"Jc": "3"},
            create_temp_key_file_fn=lambda _priv: "/tmp/key-temp",
            run_command_fn=lambda cmd: commands.append(cmd),
            build_awg_set_command_fn=lambda *_args: ["awg", "set", "awg0"],
            path_exists_fn=lambda path: path == "/tmp/key-temp",
            unlink_fn=lambda path: unlinked.append(path),
        )
        self.assertEqual(commands[0], ["ip", "link", "add", "awg0", "type", "amneziawg"])
        self.assertEqual(commands[-1], ["awg", "set", "awg0"])
        self.assertEqual(unlinked, ["/tmp/key-temp"])

        commands = []
        runtime_ops.remove_interface_runtime(
            "awg1",
            run_command_fn=lambda cmd: commands.append(cmd),
        )
        self.assertEqual(
            commands,
            [
                ["ip", "link", "set", "down", "dev", "awg1"],
                ["ip", "link", "del", "awg1", "type", "amneziawg"],
            ],
        )

    def test_apply_interface_runtime_cleanup_on_error(self):
        unlinked = []

        with self.assertRaisesRegex(RuntimeError, "fail-run"):
            runtime_ops.apply_interface_runtime(
                "awg0",
                51820,
                "10.0.0.1",
                24,
                "priv",
                "2",
                {"Jc": "3"},
                create_temp_key_file_fn=lambda _priv: "/tmp/key-temp",
                run_command_fn=lambda cmd: (_ for _ in ()).throw(RuntimeError("fail-run")) if cmd[:2] == ["ip", "address"] else None,
                build_awg_set_command_fn=lambda *_args: ["awg", "set", "awg0"],
                path_exists_fn=lambda _path: True,
                unlink_fn=lambda path: unlinked.append(path),
            )

        self.assertEqual(unlinked, ["/tmp/key-temp"])

    def test_wg_lease_ip(self):
        output = (
            "pub1\t10.0.0.2/32\n"
            "pub2\t(none)\n"
            "pub3\t10.0.0.3/32\n"
        ).encode("utf-8")
        result = runtime_ops.wg_lease_ip(
            "awg0",
            run_check_output_fn=lambda cmd: output if cmd == ["awg", "show", "awg0", "allowed-ips"] else b"",
        )
        self.assertEqual(result, ["10.0.0.2/32", "10.0.0.3/32"])

    def test_add_peer_and_del_peer_success(self):
        commands = []
        printed = []

        runtime_ops.add_peer(
            "awg0",
            "pub1",
            "10.0.0.2/32",
            run_command_fn=lambda cmd: commands.append(cmd),
            print_fn=lambda msg: printed.append(msg),
            called_process_error_type=RuntimeError,
        )
        runtime_ops.del_peer(
            "awg0",
            "pub1",
            run_command_fn=lambda cmd: commands.append(cmd),
            print_fn=lambda msg: printed.append(msg),
            called_process_error_type=RuntimeError,
        )

        self.assertEqual(commands[0], ["awg", "set", "awg0", "peer", "pub1", "allowed-ips", "10.0.0.2/32"])
        self.assertEqual(commands[1], ["awg", "set", "awg0", "peer", "pub1", "remove"])
        self.assertEqual(printed[0], ["awg", "set", "awg0", "peer", "pub1", "allowed-ips", "10.0.0.2/32"])

    def test_add_peer_and_del_peer_error_prints(self):
        printed = []

        runtime_ops.add_peer(
            "awg0",
            "pub1",
            "10.0.0.2/32",
            run_command_fn=lambda _cmd: (_ for _ in ()).throw(RuntimeError("boom-add")),
            print_fn=lambda msg: printed.append(msg),
            called_process_error_type=RuntimeError,
        )
        runtime_ops.del_peer(
            "awg0",
            "pub1",
            run_command_fn=lambda _cmd: (_ for _ in ()).throw(RuntimeError("boom-del")),
            print_fn=lambda msg: printed.append(msg),
            called_process_error_type=RuntimeError,
        )

        self.assertTrue(any("Error setting: boom-add" in str(line) for line in printed))
        self.assertTrue(any("Error setting: boom-del" in str(line) for line in printed))


if __name__ == "__main__":
    unittest.main()
