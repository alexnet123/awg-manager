import unittest

from backend.domains.awg import runtime_ops
from backend.domains.awg import runtime_service_ops


class InterfacesClientsRuntimeServiceOpsTest(unittest.TestCase):
    def test_generate_keypair_and_create_temp_key_file_delegate(self):
        calls = []
        original_generate = runtime_ops.generate_keypair
        original_temp = runtime_ops.create_temp_key_file
        try:
            runtime_ops.generate_keypair = lambda *, run_check_output_fn: (
                calls.append(("generate_keypair", run_check_output_fn)),
                ("priv", "pub"),
            )[1]
            runtime_ops.create_temp_key_file = lambda private_key, *, named_temporary_file_factory_fn, chmod_fn: (
                calls.append(("create_temp_key_file", private_key, named_temporary_file_factory_fn, chmod_fn)),
                "/tmp/key",
            )[1]

            check_output_fn = object()
            named_temp_factory = object()
            chmod_fn = object()
            self.assertEqual(
                runtime_service_ops.generate_keypair(run_check_output_fn=check_output_fn),
                ("priv", "pub"),
            )
            self.assertEqual(
                runtime_service_ops.create_temp_key_file(
                    "secret",
                    named_temporary_file_factory_fn=named_temp_factory,
                    chmod_fn=chmod_fn,
                ),
                "/tmp/key",
            )
            self.assertEqual(
                calls,
                [
                    ("generate_keypair", check_output_fn),
                    ("create_temp_key_file", "secret", named_temp_factory, chmod_fn),
                ],
            )
        finally:
            runtime_ops.generate_keypair = original_generate
            runtime_ops.create_temp_key_file = original_temp

    def test_apply_and_remove_interface_runtime_delegate(self):
        calls = []
        original_apply = runtime_ops.apply_interface_runtime
        original_remove = runtime_ops.remove_interface_runtime
        try:
            runtime_ops.apply_interface_runtime = (
                lambda wg_interface, port_number, wg_ip_addr, wg_ip_cidr, private_key, awg_version, awg_params, **kwargs: (
                    calls.append(
                        (
                            "apply_interface_runtime",
                            wg_interface,
                            port_number,
                            wg_ip_addr,
                            wg_ip_cidr,
                            private_key,
                            awg_version,
                            awg_params,
                            kwargs["create_temp_key_file_fn"],
                            kwargs["run_command_fn"],
                            kwargs["build_awg_set_command_fn"],
                            kwargs["path_exists_fn"],
                            kwargs["unlink_fn"],
                        )
                    ),
                    "ok",
                )[1]
            )
            runtime_ops.remove_interface_runtime = lambda wg_interface, *, run_command_fn: (
                calls.append(("remove_interface_runtime", wg_interface, run_command_fn)),
                "removed",
            )[1]

            create_temp_key_file_fn = object()
            run_command_fn = object()
            build_awg_set_command_fn = object()
            path_exists_fn = object()
            unlink_fn = object()

            self.assertEqual(
                runtime_service_ops.apply_interface_runtime(
                    "awg0",
                    51820,
                    "10.0.0.1",
                    24,
                    "priv",
                    "2",
                    {"Jc": "1"},
                    create_temp_key_file_fn=create_temp_key_file_fn,
                    run_command_fn=run_command_fn,
                    build_awg_set_command_fn=build_awg_set_command_fn,
                    path_exists_fn=path_exists_fn,
                    unlink_fn=unlink_fn,
                ),
                "ok",
            )
            self.assertEqual(
                runtime_service_ops.remove_interface_runtime(
                    "awg0",
                    run_command_fn=run_command_fn,
                ),
                "removed",
            )
            self.assertEqual(calls[0][0], "apply_interface_runtime")
            self.assertEqual(calls[0][1:8], ("awg0", 51820, "10.0.0.1", 24, "priv", "2", {"Jc": "1"}))
            self.assertEqual(calls[0][8:], (create_temp_key_file_fn, run_command_fn, build_awg_set_command_fn, path_exists_fn, unlink_fn))
            self.assertEqual(calls[1], ("remove_interface_runtime", "awg0", run_command_fn))
        finally:
            runtime_ops.apply_interface_runtime = original_apply
            runtime_ops.remove_interface_runtime = original_remove

    def test_awg_command_and_config_helpers_delegate(self):
        calls = []
        original_build = runtime_ops.build_awg_set_command
        original_append = runtime_ops.append_config_param
        original_client_lines = runtime_ops.build_client_config_lines
        try:
            runtime_ops.build_awg_set_command = (
                lambda wg_interface, port_number, key_file_path, awg_version, awg_params, **kwargs: (
                    calls.append(
                        (
                            "build_awg_set_command",
                            wg_interface,
                            port_number,
                            key_file_path,
                            awg_version,
                            awg_params,
                            kwargs["detect_awg_version_fn"],
                            kwargs["normalize_config_value_fn"],
                        )
                    ),
                    ["awg", "set"],
                )[1]
            )
            runtime_ops.append_config_param = lambda lines, key, value, *, normalize_config_value_fn: (
                calls.append(("append_config_param", lines, key, value, normalize_config_value_fn)),
                None,
            )[1]
            runtime_ops.build_client_config_lines = (
                lambda client_private_key, client_ip, srv_dns, awg_version, awg_params, server_pubkey, srv_ip, port_number, **kwargs: (
                    calls.append(
                        (
                            "build_client_config_lines",
                            client_private_key,
                            client_ip,
                            srv_dns,
                            awg_version,
                            awg_params,
                            server_pubkey,
                            srv_ip,
                            port_number,
                            kwargs["detect_awg_version_fn"],
                            kwargs["append_config_param_fn"],
                            kwargs["allowed_ips"],
                        )
                    ),
                    ["line1", "line2"],
                )[1]
            )

            detect_awg_version_fn = object()
            normalize_config_value_fn = object()
            append_config_param_fn = object()
            lines = []

            self.assertEqual(
                runtime_service_ops.build_awg_set_command(
                    "awg0",
                    51820,
                    "/tmp/key",
                    "2",
                    {"Jc": "1"},
                    detect_awg_version_fn=detect_awg_version_fn,
                    normalize_config_value_fn=normalize_config_value_fn,
                ),
                ["awg", "set"],
            )
            runtime_service_ops.append_config_param(
                lines,
                "Jc",
                "1",
                normalize_config_value_fn=normalize_config_value_fn,
            )
            self.assertEqual(
                runtime_service_ops.build_client_config_lines(
                    "client-priv",
                    "10.0.0.2",
                    "1.1.1.1",
                    "2",
                    {"Jc": "1"},
                    "server-pub",
                    "198.51.100.10",
                    51820,
                    detect_awg_version_fn=detect_awg_version_fn,
                    append_config_param_fn=append_config_param_fn,
                    allowed_ips="10.0.0.0/24",
                ),
                ["line1", "line2"],
            )

            self.assertEqual(calls[0][0], "build_awg_set_command")
            self.assertEqual(calls[0][1:6], ("awg0", 51820, "/tmp/key", "2", {"Jc": "1"}))
            self.assertEqual(calls[0][6:], (detect_awg_version_fn, normalize_config_value_fn))
            self.assertEqual(calls[1], ("append_config_param", lines, "Jc", "1", normalize_config_value_fn))
            self.assertEqual(calls[2][0], "build_client_config_lines")
            self.assertEqual(calls[2][1:9], ("client-priv", "10.0.0.2", "1.1.1.1", "2", {"Jc": "1"}, "server-pub", "198.51.100.10", 51820))
            self.assertEqual(calls[2][9:], (detect_awg_version_fn, append_config_param_fn, "10.0.0.0/24"))
        finally:
            runtime_ops.build_awg_set_command = original_build
            runtime_ops.append_config_param = original_append
            runtime_ops.build_client_config_lines = original_client_lines


if __name__ == "__main__":
    unittest.main()
