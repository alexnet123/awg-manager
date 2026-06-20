import types
import unittest
from unittest import mock
import os

from backend.app import manager_facade
from backend.common.manager_access import get_manager


class ManagerAccessFacadeTest(unittest.TestCase):
    def test_get_manager_returns_backend_facade_module(self):
        manager = get_manager()
        self.assertIs(manager, manager_facade)

    def test_manager_facade_proxies_attributes_to_awg_core(self):
        fake_manager = types.SimpleNamespace(example_service=lambda: "ok")
        with mock.patch.dict(os.environ, {"AWG_MANAGER_LEGACY_TARGET_MODULE": ""}, clear=False):
            with mock.patch(
                "backend.app.manager_facade.importlib.import_module",
                return_value=fake_manager,
            ) as import_module_mock:
                self.assertEqual(manager_facade.example_service(), "ok")
                import_module_mock.assert_called_with(
                    "backend.app.legacy_manager_compat"
                )

    def test_backend_or_fallback_raises_when_fallback_disabled(self):
        with mock.patch.dict(os.environ, {"AWG_MANAGER_ENABLE_AWG_CORE_FALLBACK": "0"}, clear=False):
            with self.assertRaises(RuntimeError):
                manager_facade._backend_or_fallback(  # pylint: disable=protected-access
                    "example_service",
                    lambda: (_ for _ in ()).throw(RuntimeError("backend failed")),
                )

    def test_backend_or_fallback_uses_legacy_bridge_call_path(self):
        with mock.patch.dict(os.environ, {"AWG_MANAGER_ENABLE_AWG_CORE_FALLBACK": "1"}, clear=False):
            with mock.patch(
                "backend.app.manager_facade.legacy_manager_bridge.call_manager_method",
                return_value="ok",
            ) as bridge_call_mock:
                out = manager_facade._backend_or_fallback(  # pylint: disable=protected-access
                    "example_service",
                    lambda: (_ for _ in ()).throw(RuntimeError("backend failed")),
                    "arg-1",
                    kw="value",
                )
        self.assertEqual(out, "ok")
        bridge_call_mock.assert_called_once_with(
            "example_service",
            "arg-1",
            import_module_fn=manager_facade.importlib.import_module,
            kw="value",
        )

    def test_backend_or_fallback_does_not_fallback_on_validation_errors(self):
        with mock.patch(
            "backend.app.manager_facade.legacy_manager_bridge.call_manager_method",
            side_effect=AssertionError("validation errors must not use legacy fallback"),
        ) as bridge_call_mock:
            with self.assertRaisesRegex(ValueError, "bad firewall payload"):
                manager_facade._backend_or_fallback(  # pylint: disable=protected-access
                    "create_firewall_named_object_service",
                    lambda: (_ for _ in ()).throw(ValueError("bad firewall payload")),
                )

        bridge_call_mock.assert_not_called()

    def test_backend_or_fallback_does_not_fallback_on_missing_resources(self):
        with mock.patch(
            "backend.app.manager_facade.legacy_manager_bridge.call_manager_method",
            side_effect=AssertionError("missing resources must not use legacy fallback"),
        ) as bridge_call_mock:
            with self.assertRaisesRegex(LookupError, "missing firewall table"):
                manager_facade._backend_or_fallback(  # pylint: disable=protected-access
                    "update_firewall_named_object_service",
                    lambda: (_ for _ in ()).throw(LookupError("missing firewall table")),
                )

        bridge_call_mock.assert_not_called()

    def test_backend_or_fallback_keeps_non_firewall_validation_fallback(self):
        with mock.patch(
            "backend.app.manager_facade.legacy_manager_bridge.call_manager_method",
            return_value="legacy-ok",
        ) as bridge_call_mock:
            out = manager_facade._backend_or_fallback(  # pylint: disable=protected-access
                "create_interface_service",
                lambda: (_ for _ in ()).throw(ValueError("legacy compatibility")),
                {"wg_interface": "awg0"},
            )

        self.assertEqual(out, "legacy-ok")
        bridge_call_mock.assert_called_once()

    def test_getattr_does_not_proxy_when_fallback_disabled(self):
        with mock.patch.dict(os.environ, {"AWG_MANAGER_ENABLE_AWG_CORE_FALLBACK": "0"}, clear=False):
            with self.assertRaises(AttributeError):
                _ = manager_facade.example_service

    def test_list_ipsec_peers_service_prefers_backend_service_layer(self):
        paths = {"ipsec_peers_file": "/tmp/peers.json"}
        with mock.patch(
            "backend.app.manager_facade._state_paths",
            return_value=paths,
        ), mock.patch(
            "backend.app.manager_facade.ipsec_service_layer_ops.list_peers",
            return_value=[{"name": "p1"}],
        ) as list_peers_mock:
            out = manager_facade.list_ipsec_peers_service()
        self.assertEqual(out, [{"name": "p1"}])
        list_peers_mock.assert_called_once()
        kwargs = list_peers_mock.call_args.kwargs
        self.assertEqual(kwargs["peers_file"], "/tmp/peers.json")
        self.assertIs(kwargs["read_collection_fn"], manager_facade._ipsec_read_collection)

    def test_list_ipsec_peers_service_backend_only_mode_does_not_touch_manager(self):
        paths = {"ipsec_peers_file": "/tmp/peers.json"}
        with mock.patch.dict(os.environ, {"AWG_MANAGER_ENABLE_AWG_CORE_FALLBACK": "0"}, clear=False):
            with mock.patch(
                "backend.app.manager_facade._state_paths",
                return_value=paths,
            ), mock.patch(
                "backend.app.manager_facade.ipsec_service_layer_ops.list_peers",
                return_value=[{"name": "p1"}],
            ) as list_peers_mock, mock.patch(
                "backend.app.manager_facade.legacy_manager_bridge.call_manager_method",
                side_effect=AssertionError("_manager should not be called in backend-only mode"),
            ):
                out = manager_facade.list_ipsec_peers_service()
        self.assertEqual(out, [{"name": "p1"}])
        list_peers_mock.assert_called_once()

    def test_list_ipsec_active_peers_service_backend_only_mode_does_not_touch_manager(self):
        with mock.patch.dict(os.environ, {"AWG_MANAGER_ENABLE_AWG_CORE_FALLBACK": "0"}, clear=False):
            with mock.patch(
                "backend.app.manager_facade.ipsec_service_layer_ops.list_active_peers",
                return_value=[{"peer": "peer-1"}],
            ) as list_active_peers_mock, mock.patch(
                "backend.app.manager_facade.legacy_manager_bridge.call_manager_method",
                side_effect=AssertionError("_manager should not be called in backend-only mode"),
            ):
                out = manager_facade.list_ipsec_active_peers_service()
        self.assertEqual(out, [{"peer": "peer-1"}])
        list_active_peers_mock.assert_called_once_with()

    def test_list_ipsec_peers_service_falls_back_to_awg_core(self):
        with mock.patch(
            "backend.app.manager_facade.ipsec_service_layer_ops.list_peers",
            side_effect=RuntimeError("backend failed"),
        ), mock.patch(
            "backend.app.manager_facade.legacy_manager_bridge.call_manager_method",
            return_value=[{"name": "fallback"}],
        ) as fallback_call_mock:
            out = manager_facade.list_ipsec_peers_service()
        self.assertEqual(out, [{"name": "fallback"}])
        fallback_call_mock.assert_called_once_with(
            "list_ipsec_peers_service",
            import_module_fn=manager_facade.importlib.import_module,
        )

    def test_list_ipsec_active_peers_service_prefers_backend_runtime(self):
        with mock.patch(
            "backend.app.manager_facade.ipsec_service_layer_ops.list_active_peers",
            return_value=[{"peer": "peer-1"}],
        ) as list_active_peers_mock:
            out = manager_facade.list_ipsec_active_peers_service()
        self.assertEqual(out, [{"peer": "peer-1"}])
        list_active_peers_mock.assert_called_once_with()

    def test_upsert_ipsec_peer_service_prefers_backend_service_layer(self):
        paths = {
            "ipsec_peers_file": "/tmp/peers.json",
            "ipsec_phase1_profiles_file": "/tmp/phase1.json",
        }
        with mock.patch(
            "backend.app.manager_facade._state_paths",
            return_value=paths,
        ), mock.patch(
            "backend.app.manager_facade.ipsec_service_layer_ops.upsert_peer",
            return_value={"name": "peer-a"},
        ) as upsert_peer_mock:
            out = manager_facade.upsert_ipsec_peer_service({"name": "peer-a"})
        self.assertEqual(out, {"name": "peer-a"})
        upsert_peer_mock.assert_called_once()
        kwargs = upsert_peer_mock.call_args.kwargs
        self.assertEqual(kwargs["peers_file"], "/tmp/peers.json")
        self.assertEqual(kwargs["phase1_profiles_file"], "/tmp/phase1.json")
        self.assertIs(kwargs["valid_name_fn"], manager_facade._ipsec_valid_name)
        self.assertIs(kwargs["normalize_ip_list_fn"], manager_facade._ipsec_normalize_ip_list)
        self.assertIs(kwargs["read_collection_fn"], manager_facade._ipsec_read_collection)
        self.assertIs(kwargs["write_collection_fn"], manager_facade._ipsec_write_collection)

    def test_upsert_ipsec_peer_service_falls_back_to_awg_core(self):
        with mock.patch(
            "backend.app.manager_facade.ipsec_service_layer_ops.upsert_peer",
            side_effect=RuntimeError("backend failed"),
        ), mock.patch(
            "backend.app.manager_facade.legacy_manager_bridge.call_manager_method",
            return_value={"name": "peer-b", "source": "fallback"},
        ) as fallback_call_mock:
            out = manager_facade.upsert_ipsec_peer_service({"name": "peer-b"})
        self.assertEqual(out, {"name": "peer-b", "source": "fallback"})
        fallback_call_mock.assert_called_once_with(
            "upsert_ipsec_peer_service",
            {"name": "peer-b"},
            import_module_fn=manager_facade.importlib.import_module,
        )

    def test_initiate_ipsec_policy_service_prefers_backend_service_layer(self):
        paths = {
            "ipsec_policies_file": "/tmp/policies.json",
            "ipsec_events_file": "/tmp/events.json",
        }
        with mock.patch(
            "backend.app.manager_facade._state_paths",
            return_value=paths,
        ), mock.patch(
            "backend.app.manager_facade.ipsec_service_layer_ops.initiate_policy",
            return_value={"policy": "p1", "initiated": True},
        ) as initiate_mock:
            out = manager_facade.initiate_ipsec_policy_service("p1")
        self.assertEqual(out, {"policy": "p1", "initiated": True})
        initiate_mock.assert_called_once()
        kwargs = initiate_mock.call_args.kwargs
        self.assertEqual(kwargs["policies_file"], "/tmp/policies.json")
        self.assertIs(kwargs["read_collection_fn"], manager_facade._ipsec_read_collection)
        self.assertTrue(callable(kwargs["log_event_fn"]))

    def test_upsert_ipsec_identity_service_falls_back_without_crypto_context(self):
        with mock.patch(
            "backend.app.manager_facade._upsert_ipsec_identity_backend",
            side_effect=RuntimeError("backend failed"),
        ), mock.patch(
            "backend.app.manager_facade.legacy_manager_bridge.call_manager_method",
            return_value={"name": "id-1", "source": "fallback"},
        ) as fallback_call_mock:
            out = manager_facade.upsert_ipsec_identity_service({"name": "id-1"})
        self.assertEqual(out, {"name": "id-1", "source": "fallback"})
        fallback_call_mock.assert_called_once_with(
            "upsert_ipsec_identity_service",
            {"name": "id-1"},
            import_module_fn=manager_facade.importlib.import_module,
        )

    def test_list_firewall_rules_service_prefers_backend_service_layer(self):
        with mock.patch(
            "backend.app.manager_facade.firewall_service_layer_ops.list_rules",
            return_value=[{"id": "r1"}],
        ) as list_rules_mock:
            out = manager_facade.list_firewall_rules_service(family="inet", table="filter")
        self.assertEqual(out, [{"id": "r1"}])
        list_rules_mock.assert_called_once()
        kwargs = list_rules_mock.call_args.kwargs
        self.assertEqual(kwargs["family"], "inet")
        self.assertEqual(kwargs["table"], "filter")
        self.assertIs(kwargs["normalize_value_fn"], manager_facade._normalize_config_value)

    def test_list_firewall_rules_service_backend_only_mode_does_not_touch_manager(self):
        with mock.patch.dict(os.environ, {"AWG_MANAGER_ENABLE_AWG_CORE_FALLBACK": "0"}, clear=False):
            with mock.patch(
                "backend.app.manager_facade.firewall_service_layer_ops.list_rules",
                return_value=[{"id": "r1"}],
            ) as list_rules_mock, mock.patch(
                "backend.app.manager_facade.legacy_manager_bridge.call_manager_method",
                side_effect=AssertionError("_manager should not be called in backend-only mode"),
            ):
                out = manager_facade.list_firewall_rules_service(family="inet", table="filter")
        self.assertEqual(out, [{"id": "r1"}])
        list_rules_mock.assert_called_once()

    def test_list_firewall_rules_service_falls_back_to_awg_core(self):
        with mock.patch(
            "backend.app.manager_facade.firewall_service_layer_ops.list_rules",
            side_effect=RuntimeError("backend failed"),
        ), mock.patch(
            "backend.app.manager_facade.legacy_manager_bridge.call_manager_method",
            return_value=[{"family": "ip", "table": "nat", "fallback": True}],
        ) as fallback_call_mock:
            out = manager_facade.list_firewall_rules_service(family="ip", table="nat")
        self.assertEqual(out, [{"family": "ip", "table": "nat", "fallback": True}])
        fallback_call_mock.assert_called_once_with(
            "list_firewall_rules_service",
            import_module_fn=manager_facade.importlib.import_module,
            family="ip",
            table="nat",
        )

    def test_create_firewall_rule_service_normalizer_accepts_runtime_validation_flag(self):
        def fake_create_rule(**kwargs):
            return kwargs["normalize_rule_fn"](
                {
                    "family": "inet",
                    "table": "filter",
                    "chain": "input",
                    "action": "accept",
                },
                validate_runtime_objects=True,
            )

        with mock.patch(
            "backend.app.manager_facade.firewall_service_layer_ops.create_rule",
            side_effect=fake_create_rule,
        ), mock.patch(
            "backend.app.manager_facade.legacy_manager_bridge.call_manager_method",
            side_effect=AssertionError("firewall create must stay on backend path"),
        ):
            out = manager_facade.create_firewall_rule_service({"chain": "input"}, apply_now=False)

        self.assertEqual(out["family"], "inet")
        self.assertEqual(out["table"], "filter")
        self.assertEqual(out["chain"], "input")

    def test_apply_firewall_rules_prefers_backend_service_layer(self):
        with mock.patch(
            "backend.app.manager_facade.firewall_service_layer_ops.apply_rules",
            return_value=True,
        ) as apply_rules_mock:
            out = manager_facade.apply_firewall_rules()
        self.assertTrue(out)
        apply_rules_mock.assert_called_once()

    def test_apply_firewall_rules_backend_only_mode_does_not_touch_manager(self):
        with mock.patch.dict(os.environ, {"AWG_MANAGER_ENABLE_AWG_CORE_FALLBACK": "0"}, clear=False):
            with mock.patch(
                "backend.app.manager_facade.firewall_service_layer_ops.apply_rules",
                return_value=True,
            ) as apply_rules_mock, mock.patch(
                "backend.app.manager_facade.legacy_manager_bridge.call_manager_method",
                side_effect=AssertionError("_manager should not be called in backend-only mode"),
            ):
                out = manager_facade.apply_firewall_rules()
        self.assertTrue(out)
        apply_rules_mock.assert_called_once()

    def test_serialize_interface_row_prefers_backend_render_service(self):
        row = (1, "wg0", "2", 51820, "10.8.0.1", "24", "priv", "pub", "1.1.1.1", "8.8.8.8")
        with mock.patch(
            "backend.app.manager_facade.interfaces_config_render_service_ops.serialize_interface_row",
            return_value={"id": 1, "wg_interface": "wg0"},
        ) as serialize_mock:
            out = manager_facade.serialize_interface_row(row)
        self.assertEqual(out, {"id": 1, "wg_interface": "wg0"})
        serialize_mock.assert_called_once()

    def test_serialize_client_row_falls_back_to_awg_core(self):
        with mock.patch(
            "backend.app.manager_facade.interfaces_config_render_service_ops.serialize_client_row",
            side_effect=RuntimeError("backend failed"),
        ), mock.patch(
            "backend.app.manager_facade.legacy_manager_bridge.call_manager_method",
            return_value={"id": 5, "fallback": True, "include_private_key": True},
        ) as fallback_call_mock:
            out = manager_facade.serialize_client_row((5,), include_private_key=True)
        self.assertEqual(
            out,
            {"id": 5, "fallback": True, "include_private_key": True},
        )
        fallback_call_mock.assert_called_once_with(
            "serialize_client_row",
            (5,),
            True,
            import_module_fn=manager_facade.importlib.import_module,
        )

    def test_build_qr_svg_prefers_backend_support_facade(self):
        with mock.patch(
            "backend.app.manager_facade.interfaces_support_facade_ops.build_qr_svg",
            return_value=b"<svg/>",
        ) as build_qr_mock:
            out = manager_facade.build_qr_svg("cfg")
        self.assertEqual(out, b"<svg/>")
        build_qr_mock.assert_called_once_with("cfg")

    def test_build_interface_server_config_prefers_backend_render_service(self):
        row = (1, "wg0")
        with mock.patch(
            "backend.app.manager_facade.interfaces_config_render_service_ops.build_interface_server_config",
            return_value="[Interface]\nPrivateKey=...",
        ) as build_cfg_mock:
            out = manager_facade.build_interface_server_config(row)
        self.assertEqual(out, "[Interface]\nPrivateKey=...")
        build_cfg_mock.assert_called_once()

    def test_read_database_bytes_prefers_backend_support_facade(self):
        with mock.patch(
            "backend.app.manager_facade._state_paths",
            return_value={"db_file": "/tmp/db.sqlite"},
        ), mock.patch(
            "backend.app.manager_facade.interfaces_support_facade_ops.read_database_bytes",
            return_value=b"sqlite",
        ) as read_db_mock:
            out = manager_facade.read_database_bytes()
        self.assertEqual(out, b"sqlite")
        read_db_mock.assert_called_once_with(db_file_path="/tmp/db.sqlite")

    def test_restore_database_from_bytes_prefers_backend_support_facade(self):
        fake_conn = mock.Mock()
        fake_cursor = mock.Mock()
        with mock.patch(
            "backend.app.manager_facade._open_db",
            return_value=(fake_conn, fake_cursor),
        ), mock.patch(
            "backend.app.manager_facade.interfaces_support_facade_ops.restore_database_from_bytes",
            return_value=None,
        ) as restore_mock:
            manager_facade.restore_database_from_bytes(b"payload")
        restore_mock.assert_called_once_with(b"payload", cursor=fake_cursor, conn=fake_conn)
        fake_conn.close.assert_called_once()

    def test_detect_awg_version_prefers_backend_helper(self):
        with mock.patch(
            "backend.app.manager_facade._detect_awg_version",
            return_value="2",
        ) as detect_mock:
            out = manager_facade.detect_awg_version("2", {"S1": "15"})
        self.assertEqual(out, "2")
        detect_mock.assert_called_once_with("2", {"S1": "15"})

    def test_prepare_awg_params_for_version_prefers_backend_helper(self):
        with mock.patch(
            "backend.app.manager_facade._prepare_awg_params_for_version",
            return_value={"Jc": "5"},
        ) as prepare_mock:
            out = manager_facade.prepare_awg_params_for_version("2")
        self.assertEqual(out, {"Jc": "5"})
        prepare_mock.assert_called_once_with("2")

    def test_rotate_api_key_prefers_backend_support_facade(self):
        with mock.patch(
            "backend.app.manager_facade.interfaces_support_facade_ops.rotate_api_key",
            return_value="new-key",
        ) as rotate_mock:
            out = manager_facade.rotate_api_key()
        self.assertEqual(out, "new-key")
        rotate_mock.assert_called_once()

    def test_create_interface_row_falls_back_with_payload(self):
        with mock.patch(
            "backend.app.manager_facade.legacy_manager_bridge.call_manager_method",
            return_value={"id": 1, "name": "wg0"},
        ) as fallback_call_mock:
            out = manager_facade.create_interface_row({"wg_interface": "wg0"})
        self.assertEqual(out, {"id": 1, "name": "wg0"})
        fallback_call_mock.assert_called_once_with(
            "create_interface_service",
            {"wg_interface": "wg0"},
            import_module_fn=manager_facade.importlib.import_module,
        )

    def test_create_interface_row_prefers_backend_service_ops(self):
        fake_conn = mock.Mock()
        fake_cursor = mock.Mock()
        with mock.patch(
            "backend.app.manager_facade._open_db",
            return_value=(fake_conn, fake_cursor),
        ), mock.patch(
            "backend.app.manager_facade._wg_interface_columns",
            return_value="id, wg_interface",
        ), mock.patch(
            "backend.app.manager_facade.interfaces_service_ops.create_interface_service",
            return_value=("row",),
        ) as create_interface_mock:
            out = manager_facade.create_interface_row({"wg_interface": "wg0"})
        self.assertEqual(out, ("row",))
        create_interface_mock.assert_called_once()
        self.assertIs(create_interface_mock.call_args.kwargs["cursor"], fake_cursor)
        self.assertIs(create_interface_mock.call_args.kwargs["conn"], fake_conn)
        self.assertEqual(
            create_interface_mock.call_args.kwargs["wg_interface_columns"],
            "id, wg_interface",
        )
        fake_conn.close.assert_called_once()

    def test_create_interface_row_backend_only_mode_does_not_touch_manager(self):
        fake_conn = mock.Mock()
        fake_cursor = mock.Mock()
        with mock.patch.dict(os.environ, {"AWG_MANAGER_ENABLE_AWG_CORE_FALLBACK": "0"}, clear=False):
            with mock.patch(
                "backend.app.manager_facade._open_db",
                return_value=(fake_conn, fake_cursor),
            ), mock.patch(
                "backend.app.manager_facade._wg_interface_columns",
                return_value="id, wg_interface",
            ), mock.patch(
                "backend.app.manager_facade.interfaces_service_ops.create_interface_service",
                return_value=("row",),
            ) as create_interface_mock, mock.patch(
                "backend.app.manager_facade.legacy_manager_bridge.call_manager_method",
                side_effect=AssertionError("_manager should not be called in backend-only mode"),
            ):
                out = manager_facade.create_interface_row({"wg_interface": "wg0"})
        self.assertEqual(out, ("row",))
        create_interface_mock.assert_called_once()
        fake_conn.close.assert_called_once()

    def test_update_interface_row_prefers_backend_service_ops(self):
        fake_conn = mock.Mock()
        fake_cursor = mock.Mock()
        with mock.patch(
            "backend.app.manager_facade._open_db",
            return_value=(fake_conn, fake_cursor),
        ), mock.patch(
            "backend.app.manager_facade._wg_interface_columns",
            return_value="id, wg_interface",
        ), mock.patch(
            "backend.app.manager_facade.interfaces_service_ops.update_interface_service",
            return_value=("row",),
        ) as update_interface_mock:
            out = manager_facade.update_interface_row("3", {"wg_interface": "wg3"})
        self.assertEqual(out, ("row",))
        update_interface_mock.assert_called_once()
        self.assertEqual(update_interface_mock.call_args.args[0], "3")
        self.assertEqual(update_interface_mock.call_args.args[1], {"wg_interface": "wg3"})
        self.assertIs(update_interface_mock.call_args.kwargs["cursor"], fake_cursor)
        self.assertIs(update_interface_mock.call_args.kwargs["conn"], fake_conn)
        fake_conn.close.assert_called_once()

    def test_delete_interface_row_prefers_backend_service_ops(self):
        fake_conn = mock.Mock()
        fake_cursor = mock.Mock()
        with mock.patch(
            "backend.app.manager_facade._open_db",
            return_value=(fake_conn, fake_cursor),
        ), mock.patch(
            "backend.app.manager_facade._wg_interface_columns",
            return_value="id, wg_interface",
        ), mock.patch(
            "backend.app.manager_facade.interfaces_service_ops.delete_interface_service",
            return_value=("row",),
        ) as delete_interface_mock:
            out = manager_facade.delete_interface_row("4")
        self.assertEqual(out, ("row",))
        delete_interface_mock.assert_called_once_with(
            "4",
            cursor=fake_cursor,
            conn=fake_conn,
            wg_interface_columns="id, wg_interface",
            remove_interface_runtime_fn=manager_facade._remove_interface_runtime,
        )
        fake_conn.close.assert_called_once()

    def test_update_client_row_falls_back_with_args(self):
        with mock.patch(
            "backend.app.manager_facade.legacy_manager_bridge.call_manager_method",
            return_value={"id": "7", "name": "alice"},
        ) as fallback_call_mock:
            out = manager_facade.update_client_row("7", {"name": "alice"})
        self.assertEqual(out, {"id": "7", "name": "alice"})
        fallback_call_mock.assert_called_once_with(
            "update_client_service",
            "7",
            {"name": "alice"},
            import_module_fn=manager_facade.importlib.import_module,
        )

    def test_create_client_row_backend_only_mode_does_not_touch_manager(self):
        fake_conn = mock.Mock()
        fake_cursor = mock.Mock()
        with mock.patch.dict(os.environ, {"AWG_MANAGER_ENABLE_AWG_CORE_FALLBACK": "0"}, clear=False):
            with mock.patch(
                "backend.app.manager_facade._open_db",
                return_value=(fake_conn, fake_cursor),
            ), mock.patch(
                "backend.app.manager_facade.interfaces_service_ops.create_client_service",
                return_value=("row",),
            ) as create_client_mock, mock.patch(
                "backend.app.manager_facade.legacy_manager_bridge.call_manager_method",
                side_effect=AssertionError("_manager should not be called in backend-only mode"),
            ):
                out = manager_facade.create_client_row({"name": "alice"})
        self.assertEqual(out, ("row",))
        create_client_mock.assert_called_once()
        fake_conn.close.assert_called_once()

    def test_update_client_row_backend_only_mode_does_not_touch_manager(self):
        fake_conn = mock.Mock()
        fake_cursor = mock.Mock()
        with mock.patch.dict(os.environ, {"AWG_MANAGER_ENABLE_AWG_CORE_FALLBACK": "0"}, clear=False):
            with mock.patch(
                "backend.app.manager_facade._open_db",
                return_value=(fake_conn, fake_cursor),
            ), mock.patch(
                "backend.app.manager_facade.interfaces_service_ops.update_client_service",
                return_value=("row",),
            ) as update_client_mock, mock.patch(
                "backend.app.manager_facade.legacy_manager_bridge.call_manager_method",
                side_effect=AssertionError("_manager should not be called in backend-only mode"),
            ):
                out = manager_facade.update_client_row("7", {"name": "alice"})
        self.assertEqual(out, ("row",))
        update_client_mock.assert_called_once()
        fake_conn.close.assert_called_once()

    def test_delete_client_row_backend_only_mode_does_not_touch_manager(self):
        fake_conn = mock.Mock()
        fake_cursor = mock.Mock()
        with mock.patch.dict(os.environ, {"AWG_MANAGER_ENABLE_AWG_CORE_FALLBACK": "0"}, clear=False):
            with mock.patch(
                "backend.app.manager_facade._open_db",
                return_value=(fake_conn, fake_cursor),
            ), mock.patch(
                "backend.app.manager_facade.interfaces_service_ops.delete_client_service",
                return_value=("row",),
            ) as delete_client_mock, mock.patch(
                "backend.app.manager_facade.legacy_manager_bridge.call_manager_method",
                side_effect=AssertionError("_manager should not be called in backend-only mode"),
            ):
                out = manager_facade.delete_client_row("7")
        self.assertEqual(out, ("row",))
        delete_client_mock.assert_called_once()
        fake_conn.close.assert_called_once()

    def test_query_rows_with_manager_fallback_backend_only_mode_does_not_touch_load_manager(self):
        with mock.patch.dict(os.environ, {"AWG_MANAGER_ENABLE_AWG_CORE_FALLBACK": "0"}, clear=False):
            with mock.patch(
                "backend.app.manager_facade.sqlite3.connect",
                side_effect=RuntimeError("db failed"),
            ), mock.patch(
                "backend.app.manager_facade.legacy_manager_bridge.get_manager_attr",
                side_effect=AssertionError("get_manager_attr should not be called in backend-only mode"),
            ):
                with self.assertRaises(RuntimeError):
                    manager_facade._query_rows_with_manager_fallback(  # pylint: disable=protected-access
                        "SELECT 1",
                    )

    def test_query_row_with_manager_fallback_backend_only_mode_does_not_touch_load_manager(self):
        with mock.patch.dict(os.environ, {"AWG_MANAGER_ENABLE_AWG_CORE_FALLBACK": "0"}, clear=False):
            with mock.patch(
                "backend.app.manager_facade.sqlite3.connect",
                side_effect=RuntimeError("db failed"),
            ), mock.patch(
                "backend.app.manager_facade.legacy_manager_bridge.get_manager_attr",
                side_effect=AssertionError("get_manager_attr should not be called in backend-only mode"),
            ):
                with self.assertRaises(RuntimeError):
                    manager_facade._query_row_with_manager_fallback(  # pylint: disable=protected-access
                        "SELECT 1",
                    )

    def test_query_rows_with_manager_fallback_uses_legacy_cursor_when_enabled(self):
        fake_cursor = mock.Mock()
        fake_cursor.execute.return_value.fetchall.return_value = [("row",)]
        with mock.patch.dict(os.environ, {"AWG_MANAGER_ENABLE_AWG_CORE_FALLBACK": "1"}, clear=False):
            with mock.patch(
                "backend.app.manager_facade.sqlite3.connect",
                side_effect=RuntimeError("db failed"),
            ), mock.patch(
                "backend.app.manager_facade.legacy_manager_bridge.get_manager_attr",
                return_value=fake_cursor,
            ) as get_attr_mock:
                out = manager_facade._query_rows_with_manager_fallback(  # pylint: disable=protected-access
                    "SELECT 1",
                )
        self.assertEqual(out, [("row",)])
        get_attr_mock.assert_called_once_with(
            "c",
            import_module_fn=manager_facade.importlib.import_module,
        )

    def test_query_row_with_manager_fallback_uses_legacy_cursor_when_enabled(self):
        fake_cursor = mock.Mock()
        fake_cursor.execute.return_value.fetchone.return_value = ("row",)
        with mock.patch.dict(os.environ, {"AWG_MANAGER_ENABLE_AWG_CORE_FALLBACK": "1"}, clear=False):
            with mock.patch(
                "backend.app.manager_facade.sqlite3.connect",
                side_effect=RuntimeError("db failed"),
            ), mock.patch(
                "backend.app.manager_facade.legacy_manager_bridge.get_manager_attr",
                return_value=fake_cursor,
            ) as get_attr_mock:
                out = manager_facade._query_row_with_manager_fallback(  # pylint: disable=protected-access
                    "SELECT 1",
                )
        self.assertEqual(out, ("row",))
        get_attr_mock.assert_called_once_with(
            "c",
            import_module_fn=manager_facade.importlib.import_module,
        )

    def test_manager_crypto_context_raises_when_fallback_disabled_and_fernet_unavailable(self):
        with mock.patch.dict(os.environ, {"AWG_MANAGER_ENABLE_AWG_CORE_FALLBACK": "0"}, clear=False):
            with mock.patch(
                "backend.app.manager_facade._Fernet",
                None,
            ), mock.patch(
                "backend.app.manager_facade.encryption_context.get_crypto_context",
                return_value={"encryption_key": b"k1", "encryption_key_legacy": b"k0"},
            ), mock.patch(
                "backend.app.manager_facade.legacy_manager_bridge.get_manager_attr",
                side_effect=AssertionError("get_manager_attr should not be called in backend-only mode"),
            ):
                with self.assertRaises(RuntimeError):
                    manager_facade._manager_crypto_context()  # pylint: disable=protected-access

    def test_manager_crypto_context_uses_legacy_manager_when_fallback_enabled_and_fernet_unavailable(self):
        class DummyInvalidToken:  # pylint: disable=too-few-public-methods
            pass

        with mock.patch.dict(os.environ, {"AWG_MANAGER_ENABLE_AWG_CORE_FALLBACK": "1"}, clear=False):
            with mock.patch(
                "backend.app.manager_facade._Fernet",
                None,
            ), mock.patch(
                "backend.app.manager_facade.encryption_context.get_crypto_context",
                return_value={"encryption_key": b"k1", "encryption_key_legacy": b"k0"},
            ), mock.patch(
                "backend.app.manager_facade.legacy_manager_bridge.get_manager_attr",
                side_effect=[object, DummyInvalidToken],
            ) as get_attr_mock:
                ctx = manager_facade._manager_crypto_context()  # pylint: disable=protected-access
        self.assertEqual(ctx["fernet_class"], object)
        self.assertEqual(ctx["invalid_token_type"], DummyInvalidToken)
        self.assertEqual(get_attr_mock.call_count, 2)
        get_attr_mock.assert_any_call(
            "Fernet",
            import_module_fn=manager_facade.importlib.import_module,
        )
        get_attr_mock.assert_any_call(
            "InvalidToken",
            import_module_fn=manager_facade.importlib.import_module,
        )


if __name__ == "__main__":
    unittest.main()
