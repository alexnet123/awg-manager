import unittest

from backend.domains.awg import config_render_ops
from backend.domains.awg import config_render_service_ops


class InterfacesClientsConfigRenderServiceOpsTest(unittest.TestCase):
    def test_serialize_interface_row_delegate(self):
        calls = []
        original = config_render_ops.serialize_interface_row
        try:
            config_render_ops.serialize_interface_row = (
                lambda row, **kwargs: (
                    calls.append(
                        (
                            row,
                            kwargs["build_awg_params_from_row_fn"],
                            kwargs["detect_awg_version_fn"],
                            kwargs["get_filtered_awg_params_fn"],
                        )
                    ),
                    {"ok": True},
                )[1]
            )
            build_awg_params_from_row_fn = object()
            detect_awg_version_fn = object()
            get_filtered_awg_params_fn = object()
            row = {"id": 1}
            self.assertEqual(
                config_render_service_ops.serialize_interface_row(
                    row,
                    build_awg_params_from_row_fn=build_awg_params_from_row_fn,
                    detect_awg_version_fn=detect_awg_version_fn,
                    get_filtered_awg_params_fn=get_filtered_awg_params_fn,
                ),
                {"ok": True},
            )
            self.assertEqual(
                calls,
                [(row, build_awg_params_from_row_fn, detect_awg_version_fn, get_filtered_awg_params_fn)],
            )
        finally:
            config_render_ops.serialize_interface_row = original

    def test_serialize_client_row_delegate(self):
        calls = []
        original = config_render_ops.serialize_client_row
        try:
            config_render_ops.serialize_client_row = (
                lambda row, **kwargs: (
                    calls.append(
                        (
                            row,
                            kwargs["fetch_allowed_ips_fn"],
                            kwargs["normalize_config_value_fn"],
                            kwargs["decrypt_private_key_fn"],
                            kwargs["include_private_key"],
                        )
                    ),
                    {"name": "client"},
                )[1]
            )
            fetch_allowed_ips_fn = object()
            normalize_config_value_fn = object()
            decrypt_private_key_fn = object()
            row = {"id": 2}
            self.assertEqual(
                config_render_service_ops.serialize_client_row(
                    row,
                    fetch_allowed_ips_fn=fetch_allowed_ips_fn,
                    normalize_config_value_fn=normalize_config_value_fn,
                    decrypt_private_key_fn=decrypt_private_key_fn,
                    include_private_key=True,
                ),
                {"name": "client"},
            )
            self.assertEqual(
                calls,
                [(row, fetch_allowed_ips_fn, normalize_config_value_fn, decrypt_private_key_fn, True)],
            )
        finally:
            config_render_ops.serialize_client_row = original

    def test_build_client_config_delegate(self):
        calls = []
        original = config_render_ops.build_client_config
        try:
            config_render_ops.build_client_config = (
                lambda client_row, interface_row, **kwargs: (
                    calls.append(
                        (
                            client_row,
                            interface_row,
                            kwargs["fetch_allowed_ips_fn"],
                            kwargs["normalize_config_value_fn"],
                            kwargs["build_awg_params_from_row_fn"],
                            kwargs["build_client_config_lines_fn"],
                            kwargs["decrypt_private_key_fn"],
                        )
                    ),
                    "cfg",
                )[1]
            )
            fetch_allowed_ips_fn = object()
            normalize_config_value_fn = object()
            build_awg_params_from_row_fn = object()
            build_client_config_lines_fn = object()
            decrypt_private_key_fn = object()
            client_row = {"id": 3}
            interface_row = {"id": 4}
            self.assertEqual(
                config_render_service_ops.build_client_config(
                    client_row,
                    interface_row,
                    fetch_allowed_ips_fn=fetch_allowed_ips_fn,
                    normalize_config_value_fn=normalize_config_value_fn,
                    build_awg_params_from_row_fn=build_awg_params_from_row_fn,
                    build_client_config_lines_fn=build_client_config_lines_fn,
                    decrypt_private_key_fn=decrypt_private_key_fn,
                ),
                "cfg",
            )
            self.assertEqual(
                calls,
                [
                    (
                        client_row,
                        interface_row,
                        fetch_allowed_ips_fn,
                        normalize_config_value_fn,
                        build_awg_params_from_row_fn,
                        build_client_config_lines_fn,
                        decrypt_private_key_fn,
                    )
                ],
            )
        finally:
            config_render_ops.build_client_config = original

    def test_build_interface_server_config_delegate(self):
        calls = []
        original = config_render_ops.build_interface_server_config
        try:
            config_render_ops.build_interface_server_config = (
                lambda interface_row, **kwargs: (
                    calls.append(
                        (
                            interface_row,
                            kwargs["build_awg_params_from_row_fn"],
                            kwargs["normalize_config_value_fn"],
                            kwargs["detect_awg_version_fn"],
                            kwargs["append_config_param_fn"],
                            kwargs["fetch_peer_rows_fn"],
                        )
                    ),
                    "server-cfg",
                )[1]
            )
            build_awg_params_from_row_fn = object()
            normalize_config_value_fn = object()
            detect_awg_version_fn = object()
            append_config_param_fn = object()
            fetch_peer_rows_fn = object()
            interface_row = {"id": 5}
            self.assertEqual(
                config_render_service_ops.build_interface_server_config(
                    interface_row,
                    build_awg_params_from_row_fn=build_awg_params_from_row_fn,
                    normalize_config_value_fn=normalize_config_value_fn,
                    detect_awg_version_fn=detect_awg_version_fn,
                    append_config_param_fn=append_config_param_fn,
                    fetch_peer_rows_fn=fetch_peer_rows_fn,
                ),
                "server-cfg",
            )
            self.assertEqual(
                calls,
                [
                    (
                        interface_row,
                        build_awg_params_from_row_fn,
                        normalize_config_value_fn,
                        detect_awg_version_fn,
                        append_config_param_fn,
                        fetch_peer_rows_fn,
                    )
                ],
            )
        finally:
            config_render_ops.build_interface_server_config = original


if __name__ == "__main__":
    unittest.main()
