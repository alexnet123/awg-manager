import unittest

from backend.domains.awg import compat_entry_ops
from backend.domains.awg import config_render_service_ops
from backend.domains.awg import runtime_service_ops
from backend.domains.awg import service_ops
from backend.domains.awg import support_facade_ops
from backend.domains.awg import awg_params_ops
from backend.domains.awg import validation_ops


class InterfacesClientsCompatEntryOpsTest(unittest.TestCase):
    def test_render_delegation(self):
        calls = []
        originals = (
            config_render_service_ops.serialize_interface_row,
            config_render_service_ops.serialize_client_row,
            config_render_service_ops.build_client_config,
            config_render_service_ops.build_interface_server_config,
        )
        try:
            config_render_service_ops.serialize_interface_row = lambda row, **kwargs: (
                calls.append(("if_row", row, kwargs)),
                {"ok": True},
            )[1]
            config_render_service_ops.serialize_client_row = lambda row, **kwargs: (
                calls.append(("cl_row", row, kwargs)),
                {"client": True},
            )[1]
            config_render_service_ops.build_client_config = lambda client_row, interface_row, **kwargs: (
                calls.append(("cl_cfg", client_row, interface_row, kwargs)),
                "cfg",
            )[1]
            config_render_service_ops.build_interface_server_config = lambda interface_row, **kwargs: (
                calls.append(("if_cfg", interface_row, kwargs)),
                "ifcfg",
            )[1]

            self.assertEqual(
                compat_entry_ops.serialize_interface_row(
                    {"id": 1},
                    build_awg_params_from_row_fn=object(),
                    detect_awg_version_fn=object(),
                    get_filtered_awg_params_fn=object(),
                ),
                {"ok": True},
            )
            self.assertEqual(
                compat_entry_ops.serialize_client_row(
                    {"id": 2},
                    fetch_allowed_ips_fn=object(),
                    normalize_config_value_fn=object(),
                    decrypt_private_key_fn=object(),
                    include_private_key=True,
                ),
                {"client": True},
            )
            self.assertEqual(
                compat_entry_ops.build_client_config(
                    {"id": 3},
                    {"id": 4},
                    fetch_allowed_ips_fn=object(),
                    normalize_config_value_fn=object(),
                    build_awg_params_from_row_fn=object(),
                    build_client_config_lines_fn=object(),
                    decrypt_private_key_fn=object(),
                ),
                "cfg",
            )
            self.assertEqual(
                compat_entry_ops.build_interface_server_config(
                    {"id": 5},
                    build_awg_params_from_row_fn=object(),
                    normalize_config_value_fn=object(),
                    detect_awg_version_fn=object(),
                    append_config_param_fn=object(),
                    fetch_peer_rows_fn=object(),
                ),
                "ifcfg",
            )
            self.assertEqual(calls[0][0], "if_row")
            self.assertEqual(calls[-1][0], "if_cfg")
        finally:
            (
                config_render_service_ops.serialize_interface_row,
                config_render_service_ops.serialize_client_row,
                config_render_service_ops.build_client_config,
                config_render_service_ops.build_interface_server_config,
            ) = originals

    def test_runtime_delegation(self):
        calls = []
        originals = (
            runtime_service_ops.generate_keypair,
            runtime_service_ops.create_temp_key_file,
            runtime_service_ops.apply_interface_runtime,
            runtime_service_ops.remove_interface_runtime,
            runtime_service_ops.build_awg_set_command,
            runtime_service_ops.append_config_param,
            runtime_service_ops.build_client_config_lines,
        )
        try:
            runtime_service_ops.generate_keypair = lambda **kwargs: (calls.append(("keys", kwargs)), ("priv", "pub"))[1]
            runtime_service_ops.create_temp_key_file = lambda private_key, **kwargs: (
                calls.append(("temp", private_key, kwargs)),
                "/tmp/key",
            )[1]
            runtime_service_ops.apply_interface_runtime = lambda *args, **kwargs: (
                calls.append(("apply", args, kwargs)),
                None,
            )[1]
            runtime_service_ops.remove_interface_runtime = lambda wg_interface, **kwargs: (
                calls.append(("remove", wg_interface, kwargs)),
                None,
            )[1]
            runtime_service_ops.build_awg_set_command = lambda *args, **kwargs: (
                calls.append(("awg_cmd", args, kwargs)),
                ["awg", "set"],
            )[1]
            runtime_service_ops.append_config_param = lambda lines, key, value, **kwargs: (
                calls.append(("append", lines, key, value, kwargs)),
                lines,
            )[1]
            runtime_service_ops.build_client_config_lines = lambda *args, **kwargs: (
                calls.append(("client_lines", args, kwargs)),
                ["[Interface]"],
            )[1]

            self.assertEqual(compat_entry_ops.generate_keypair(run_check_output_fn=object()), ("priv", "pub"))
            self.assertEqual(
                compat_entry_ops.create_temp_key_file(
                    "priv",
                    named_temporary_file_factory_fn=object(),
                    chmod_fn=object(),
                ),
                "/tmp/key",
            )
            compat_entry_ops.apply_interface_runtime(
                "awg0",
                51820,
                "10.8.0.1",
                24,
                "priv",
                "2",
                {},
                create_temp_key_file_fn=object(),
                run_command_fn=object(),
                build_awg_set_command_fn=object(),
                path_exists_fn=object(),
                unlink_fn=object(),
            )
            compat_entry_ops.remove_interface_runtime("awg0", run_command_fn=object())
            self.assertEqual(
                compat_entry_ops.build_awg_set_command(
                    "awg0",
                    51820,
                    "/tmp/key",
                    "2",
                    {},
                    detect_awg_version_fn=object(),
                    normalize_config_value_fn=object(),
                ),
                ["awg", "set"],
            )
            self.assertEqual(
                compat_entry_ops.append_config_param([], "Jc", "3", normalize_config_value_fn=object()),
                [],
            )
            self.assertEqual(
                compat_entry_ops.build_client_config_lines(
                    "priv",
                    "10.8.0.2",
                    "1.1.1.1",
                    "2",
                    {},
                    "pub",
                    "203.0.113.1",
                    51820,
                    detect_awg_version_fn=object(),
                    append_config_param_fn=object(),
                ),
                ["[Interface]"],
            )
            self.assertEqual(calls[0][0], "keys")
            self.assertEqual(calls[-1][0], "client_lines")
        finally:
            (
                runtime_service_ops.generate_keypair,
                runtime_service_ops.create_temp_key_file,
                runtime_service_ops.apply_interface_runtime,
                runtime_service_ops.remove_interface_runtime,
                runtime_service_ops.build_awg_set_command,
                runtime_service_ops.append_config_param,
                runtime_service_ops.build_client_config_lines,
            ) = originals

    def test_service_delegation(self):
        calls = []
        originals = (
            service_ops.create_interface_service,
            service_ops.delete_interface_service,
            service_ops.update_interface_service,
            service_ops.create_client_service,
            service_ops.delete_client_service,
            service_ops.update_client_service,
            service_ops.get_next_available_ip,
            service_ops.validate_client_ip_for_interface,
        )
        try:
            service_ops.create_interface_service = lambda payload, **kwargs: (
                calls.append(("create_if", payload, kwargs)),
                (1, "awg0"),
            )[1]
            service_ops.delete_interface_service = lambda interface_id, **kwargs: (
                calls.append(("delete_if", interface_id, kwargs)),
                (interface_id,),
            )[1]
            service_ops.update_interface_service = lambda interface_id, payload, **kwargs: (
                calls.append(("update_if", interface_id, payload, kwargs)),
                (interface_id, payload.get("wg_interface", "awg0")),
            )[1]
            service_ops.create_client_service = lambda payload, **kwargs: (
                calls.append(("create_client", payload, kwargs)),
                (10, payload.get("name")),
            )[1]
            service_ops.delete_client_service = lambda client_id, **kwargs: (
                calls.append(("delete_client", client_id, kwargs)),
                (client_id,),
            )[1]
            service_ops.update_client_service = lambda client_id, payload, **kwargs: (
                calls.append(("update_client", client_id, payload, kwargs)),
                (client_id, payload.get("name")),
            )[1]
            service_ops.get_next_available_ip = lambda wg_interface, **kwargs: (
                calls.append(("next_ip", wg_interface, kwargs)),
                "10.8.0.2",
            )[1]
            service_ops.validate_client_ip_for_interface = lambda **kwargs: calls.append(("validate_ip", kwargs))

            self.assertEqual(
                compat_entry_ops.create_interface_service(
                    {"wg_interface": "awg0"},
                    cursor=object(),
                    conn=object(),
                    wg_interface_columns="id,wg_interface",
                    normalize_config_value_fn=object(),
                    detect_awg_version_fn=object(),
                    validate_interface_name_fn=object(),
                    parse_and_validate_port_fn=object(),
                    parse_and_validate_interface_network_fn=object(),
                    validate_ip_literal_fn=object(),
                    generate_keypair_fn=object(),
                    prepare_awg_params_for_version_fn=object(),
                    validate_awg_params_fn=object(),
                    assert_interface_uniqueness_fn=object(),
                    apply_interface_runtime_fn=object(),
                )[0],
                1,
            )
            self.assertEqual(
                compat_entry_ops.delete_interface_service(
                    1,
                    cursor=object(),
                    conn=object(),
                    wg_interface_columns="id,wg_interface",
                    remove_interface_runtime_fn=object(),
                )[0],
                1,
            )
            self.assertEqual(
                compat_entry_ops.update_interface_service(
                    1,
                    {"wg_interface": "awg0"},
                    cursor=object(),
                    conn=object(),
                    wg_interface_columns="id,wg_interface",
                    build_awg_params_from_row_fn=object(),
                    detect_awg_version_fn=object(),
                    normalize_config_value_fn=object(),
                    validate_interface_name_fn=object(),
                    parse_and_validate_port_fn=object(),
                    parse_and_validate_interface_network_fn=object(),
                    validate_ip_literal_fn=object(),
                    prepare_awg_params_for_version_fn=object(),
                    validate_awg_params_fn=object(),
                    assert_interface_uniqueness_fn=object(),
                    remove_interface_runtime_fn=object(),
                    apply_interface_runtime_fn=object(),
                )[0],
                1,
            )
            self.assertEqual(
                compat_entry_ops.create_client_service(
                    {"name": "alice"},
                    cursor=object(),
                    conn=object(),
                    normalize_config_value_fn=object(),
                    get_next_available_ip_fn=object(),
                    generate_keypair_fn=object(),
                    encrypt_private_key_fn=object(),
                    run_command_fn=object(),
                )[0],
                10,
            )
            self.assertEqual(
                compat_entry_ops.delete_client_service(
                    10,
                    cursor=object(),
                    conn=object(),
                    run_command_fn=object(),
                )[0],
                10,
            )
            self.assertEqual(
                compat_entry_ops.update_client_service(
                    10,
                    {"name": "alice2"},
                    cursor=object(),
                    conn=object(),
                    normalize_config_value_fn=object(),
                    get_next_available_ip_fn=object(),
                    validate_client_ip_for_interface_fn=object(),
                    encrypt_private_key_fn=object(),
                    run_command_fn=object(),
                )[0],
                10,
            )
            self.assertEqual(
                compat_entry_ops.get_next_available_ip("awg0", cursor=object()),
                "10.8.0.2",
            )
            self.assertIsNone(
                compat_entry_ops.validate_client_ip_for_interface("10.8.0.2", "awg0", cursor=object())
            )
            self.assertEqual(calls[0][0], "create_if")
            self.assertEqual(calls[-1][0], "validate_ip")
        finally:
            (
                service_ops.create_interface_service,
                service_ops.delete_interface_service,
                service_ops.update_interface_service,
                service_ops.create_client_service,
                service_ops.delete_client_service,
                service_ops.update_client_service,
                service_ops.get_next_available_ip,
                service_ops.validate_client_ip_for_interface,
            ) = originals

    def test_cursor_row_fetch_helpers(self):
        class _Cursor:
            def __init__(self):
                self.last = None

            def execute(self, query, params):
                self.last = (query, params)

                class _Result:
                    def __init__(self, parent):
                        self._parent = parent

                    def fetchone(self):
                        return ("10.0.0.0/24",)

                    def fetchall(self):
                        return [("pub-a", "10.0.0.2/32")]

                return _Result(self)

        cursor = _Cursor()
        self.assertEqual(
            compat_entry_ops.fetch_allowed_ips_row(7, cursor=cursor),
            ("10.0.0.0/24",),
        )
        self.assertEqual(
            compat_entry_ops.fetch_interface_peer_rows("awg0", cursor=cursor),
            [("pub-a", "10.0.0.2/32")],
        )

    def test_support_facade_delegation(self):
        calls = []
        originals = (
            support_facade_ops.load_api_key,
            support_facade_ops.save_api_key,
            support_facade_ops.render_qr_in_terminal,
            support_facade_ops.build_qr_svg,
            support_facade_ops.verify_api_auth,
            support_facade_ops.rotate_api_key,
            support_facade_ops.read_database_bytes,
            support_facade_ops.restore_database_from_bytes,
            support_facade_ops.decode_base64_payload,
        )
        try:
            support_facade_ops.load_api_key = lambda **kwargs: (calls.append(("load", kwargs)), "k")[1]
            support_facade_ops.save_api_key = lambda value, **kwargs: (calls.append(("save", value, kwargs)), None)[1]
            support_facade_ops.render_qr_in_terminal = lambda content: calls.append(("render_qr", content))
            support_facade_ops.build_qr_svg = lambda content: (calls.append(("svg", content)), b"<svg/>")[1]
            support_facade_ops.verify_api_auth = lambda api_key, secret, **kwargs: (
                calls.append(("verify", api_key, secret, kwargs)),
                (True, None),
            )[1]
            support_facade_ops.rotate_api_key = lambda **kwargs: (calls.append(("rotate", kwargs)), "new-key")[1]
            support_facade_ops.read_database_bytes = lambda **kwargs: (calls.append(("read_db", kwargs)), b"db")[1]
            support_facade_ops.restore_database_from_bytes = lambda raw_bytes, **kwargs: (
                calls.append(("restore_db", raw_bytes, kwargs)),
                None,
            )[1]
            support_facade_ops.decode_base64_payload = lambda payload: (calls.append(("decode", payload)), b"ok")[1]

            self.assertEqual(
                compat_entry_ops.load_api_key(
                    api_key_env_var="ENV",
                    api_key_file="/tmp/key",
                    normalize_config_value_fn=object(),
                ),
                "k",
            )
            self.assertIsNone(
                compat_entry_ops.save_api_key(
                    "k2",
                    api_key_file="/tmp/key",
                    normalize_config_value_fn=object(),
                )
            )
            self.assertIsNone(compat_entry_ops.render_qr_in_terminal("payload"))
            self.assertEqual(compat_entry_ops.build_qr_svg("payload2"), b"<svg/>")
            self.assertEqual(
                compat_entry_ops.verify_api_auth(
                    "api",
                    "secret",
                    load_api_key_fn=object(),
                    normalize_config_value_fn=object(),
                ),
                (True, None),
            )
            self.assertEqual(
                compat_entry_ops.rotate_api_key(save_api_key_fn=object()),
                "new-key",
            )
            self.assertEqual(
                compat_entry_ops.read_database_bytes(db_file_path="/tmp/db"),
                b"db",
            )
            self.assertIsNone(
                compat_entry_ops.restore_database_from_bytes(
                    b"db",
                    cursor=object(),
                    conn=object(),
                )
            )
            self.assertEqual(
                compat_entry_ops.decode_base64_payload("aGVsbG8="),
                b"ok",
            )
            self.assertEqual(calls[0][0], "load")
            self.assertEqual(calls[-1][0], "decode")
        finally:
            (
                support_facade_ops.load_api_key,
                support_facade_ops.save_api_key,
                support_facade_ops.render_qr_in_terminal,
                support_facade_ops.build_qr_svg,
                support_facade_ops.verify_api_auth,
                support_facade_ops.rotate_api_key,
                support_facade_ops.read_database_bytes,
                support_facade_ops.restore_database_from_bytes,
                support_facade_ops.decode_base64_payload,
            ) = originals

    def test_awg_params_delegation(self):
        calls = []
        originals = (
            awg_params_ops._random_h_value,
            awg_params_ops._random_h_range,
            awg_params_ops.generate_awg_obfuscation_params,
            awg_params_ops.get_awg_param_keys_for_version,
            awg_params_ops.detect_awg_version,
            awg_params_ops.build_awg_params_from_row,
            awg_params_ops.prepare_awg_params_for_version,
            awg_params_ops.parse_h_value_or_range,
            awg_params_ops.validate_awg_params,
            awg_params_ops.prompt_awg_version,
            awg_params_ops.prompt_version_2_signature_params,
            awg_params_ops.format_awg_params_for_display,
            awg_params_ops.get_filtered_awg_params,
        )
        try:
            awg_params_ops._random_h_value = lambda **kwargs: (calls.append(("hval", kwargs)), 12)[1]
            awg_params_ops._random_h_range = lambda **kwargs: (calls.append(("hrange", kwargs)), "12-22")[1]
            awg_params_ops.generate_awg_obfuscation_params = lambda version, **kwargs: (
                calls.append(("gen", version, kwargs)),
                {"Jc": 5},
            )[1]
            awg_params_ops.get_awg_param_keys_for_version = lambda version, **kwargs: (
                calls.append(("keys", version, kwargs)),
                ["Jc"],
            )[1]
            awg_params_ops.detect_awg_version = lambda version, params, **kwargs: (
                calls.append(("detect", version, params, kwargs)),
                "2",
            )[1]
            awg_params_ops.build_awg_params_from_row = lambda row: (calls.append(("row", row)), {"Jc": 7})[1]
            awg_params_ops.prepare_awg_params_for_version = lambda version, **kwargs: (
                calls.append(("prepare", version, kwargs)),
                {"Jc": 8},
            )[1]
            awg_params_ops.parse_h_value_or_range = lambda value, **kwargs: (
                calls.append(("parse", value, kwargs)),
                (1, 2),
            )[1]
            awg_params_ops.validate_awg_params = lambda version, params, **kwargs: calls.append(("validate", version, params, kwargs))
            awg_params_ops.prompt_awg_version = lambda default, **kwargs: (calls.append(("prompt", default, kwargs)), "1")[1]
            awg_params_ops.prompt_version_2_signature_params = lambda params, **kwargs: (
                calls.append(("prompt_i", params, kwargs)),
                {"I1": "v"},
            )[1]
            awg_params_ops.format_awg_params_for_display = lambda version, params, **kwargs: (
                calls.append(("format", version, params, kwargs)),
                ["Jc: 5"],
            )[1]
            awg_params_ops.get_filtered_awg_params = lambda version, params, **kwargs: (
                calls.append(("filter", version, params, kwargs)),
                {"Jc": "5"},
            )[1]

            self.assertEqual(compat_entry_ops._random_h_value(random_randint_fn=object()), 12)
            self.assertEqual(compat_entry_ops._random_h_range(random_randint_fn=object()), "12-22")
            self.assertEqual(
                compat_entry_ops.generate_awg_obfuscation_params(
                    "2",
                    detect_awg_version_fn=object(),
                    random_randint_fn=object(),
                    random_sample_fn=object(),
                )["Jc"],
                5,
            )
            self.assertEqual(
                compat_entry_ops.get_awg_param_keys_for_version("2", detect_awg_version_fn=object()),
                ["Jc"],
            )
            self.assertEqual(
                compat_entry_ops.detect_awg_version("2", {}, normalize_config_value_fn=object()),
                "2",
            )
            self.assertEqual(compat_entry_ops.build_awg_params_from_row((1, 2, 3))["Jc"], 7)
            self.assertEqual(
                compat_entry_ops.prepare_awg_params_for_version(
                    "2",
                    generate_awg_obfuscation_params_fn=object(),
                    detect_awg_version_fn=object(),
                )["Jc"],
                8,
            )
            self.assertEqual(
                compat_entry_ops.parse_h_value_or_range("1-2", normalize_config_value_fn=object()),
                (1, 2),
            )
            self.assertIsNone(
                compat_entry_ops.validate_awg_params(
                    "2",
                    {},
                    detect_awg_version_fn=object(),
                    normalize_config_value_fn=object(),
                    parse_h_value_or_range_fn=object(),
                )
            )
            self.assertEqual(
                compat_entry_ops.prompt_awg_version(
                    "2",
                    detect_awg_version_fn=object(),
                    input_fn=object(),
                    print_fn=object(),
                ),
                "1",
            )
            self.assertEqual(
                compat_entry_ops.prompt_version_2_signature_params({}, input_fn=object())["I1"],
                "v",
            )
            self.assertEqual(
                compat_entry_ops.format_awg_params_for_display(
                    "2",
                    {},
                    get_awg_param_keys_for_version_fn=object(),
                    normalize_config_value_fn=object(),
                ),
                ["Jc: 5"],
            )
            self.assertEqual(
                compat_entry_ops.get_filtered_awg_params(
                    "2",
                    {},
                    get_awg_param_keys_for_version_fn=object(),
                    normalize_config_value_fn=object(),
                )["Jc"],
                "5",
            )
            self.assertEqual(calls[0][0], "hval")
            self.assertEqual(calls[-1][0], "filter")
        finally:
            (
                awg_params_ops._random_h_value,
                awg_params_ops._random_h_range,
                awg_params_ops.generate_awg_obfuscation_params,
                awg_params_ops.get_awg_param_keys_for_version,
                awg_params_ops.detect_awg_version,
                awg_params_ops.build_awg_params_from_row,
                awg_params_ops.prepare_awg_params_for_version,
                awg_params_ops.parse_h_value_or_range,
                awg_params_ops.validate_awg_params,
                awg_params_ops.prompt_awg_version,
                awg_params_ops.prompt_version_2_signature_params,
                awg_params_ops.format_awg_params_for_display,
                awg_params_ops.get_filtered_awg_params,
            ) = originals

    def test_validation_delegation(self):
        calls = []
        originals = (
            validation_ops.parse_and_validate_interface_network,
            validation_ops.parse_and_validate_port,
            validation_ops.validate_ip_literal,
            validation_ops.assert_interface_uniqueness,
            validation_ops.validate_interface_name,
        )
        try:
            validation_ops.parse_and_validate_interface_network = lambda ip, cidr: (
                calls.append(("network", ip, cidr)),
                (24, "10.0.0.0/24"),
            )[1]
            validation_ops.parse_and_validate_port = lambda port: (calls.append(("port", port)), 51820)[1]
            validation_ops.validate_ip_literal = lambda value, field: calls.append(("ip", value, field))
            validation_ops.assert_interface_uniqueness = lambda *args, **kwargs: (
                calls.append(("uniq", args, kwargs)),
                None,
            )[1]
            validation_ops.validate_interface_name = lambda iface: (calls.append(("iface", iface)), None)[1]

            class _Cursor:
                def execute(self, _q, _params=()):
                    class _Result:
                        def fetchone(self):
                            return None

                        def fetchall(self):
                            return []

                    return _Result()

            cursor = _Cursor()

            self.assertEqual(
                compat_entry_ops.parse_and_validate_interface_network("10.0.0.1", 24),
                (24, "10.0.0.0/24"),
            )
            self.assertEqual(compat_entry_ops.parse_and_validate_port("51820"), 51820)
            self.assertIsNone(compat_entry_ops.validate_ip_literal("10.0.0.1", "ip"))
            self.assertIsNone(
                compat_entry_ops.assert_interface_uniqueness(
                    "awg0",
                    51820,
                    "10.0.0.0/24",
                    parse_network_fn=object(),
                    cursor=cursor,
                    exclude_id=None,
                )
            )
            self.assertIsNone(compat_entry_ops.validate_interface_name("awg0"))
            self.assertEqual(calls[0][0], "network")
            self.assertEqual(calls[-1][0], "iface")
        finally:
            (
                validation_ops.parse_and_validate_interface_network,
                validation_ops.parse_and_validate_port,
                validation_ops.validate_ip_literal,
                validation_ops.assert_interface_uniqueness,
                validation_ops.validate_interface_name,
            ) = originals


if __name__ == "__main__":
    unittest.main()
