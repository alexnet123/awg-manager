import importlib
import os
import pathlib
import sys
import types
import unittest

PROJECT_ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


class _ManagerStub:
    WG_INTERFACE_COLUMNS = "id, wg_interface"

    def __init__(self):
        self.calls = []
        self.c = self

    def execute(self, *_args, **_kwargs):
        return self

    def fetchall(self):
        return []

    def fetchone(self):
        return None

    def verify_api_auth(self, api_key, _secret):
        if api_key == "ok":
            return True, None
        return False, "Invalid API key"

    def serialize_interface_row(self, row):
        return dict(row)

    def serialize_client_row(self, row, include_private_key=False):
        item = dict(row)
        if not include_private_key:
            item.pop("privkey", None)
        return item

    def create_interface_service(self, payload):
        self.calls.append(("create_interface_service", payload))
        return {"id": 1, "wg_interface": payload["wg_interface"]}

    def create_client_service(self, payload):
        self.calls.append(("create_client_service", payload))
        return {"id": 1, "name": payload["name"], "wg_interface": payload["wg_interface"]}

    def build_client_config(self, _client_row, _interface_row):
        return "[Interface]\nAddress = 10.0.0.2/32\n"

    def build_qr_svg(self, _cfg):
        return b"<svg/>"

    def detect_awg_version(self, version, _params):
        return str(version)

    def prepare_awg_params_for_version(self, version):
        return {"version": str(version)}

    def read_database_bytes(self):
        return b"db"

    def decode_base64_payload(self, payload):
        return payload.encode("utf-8")

    def restore_database_from_bytes(self, _payload):
        self.calls.append(("restore_database_from_bytes", True))

    def rotate_api_key(self):
        return "rotated"


class AppRouterTests(unittest.TestCase):
    def setUp(self):
        self.manager = _ManagerStub()
        self._legacy_module_name = "test_app_router_legacy_stub"
        self._old_target_env = os.environ.get("AWG_MANAGER_LEGACY_TARGET_MODULE")
        os.environ["AWG_MANAGER_LEGACY_TARGET_MODULE"] = self._legacy_module_name
        sys.modules[self._legacy_module_name] = self.manager  # type: ignore[assignment]
        self.router = importlib.import_module("backend.app.router")
        importlib.reload(self.router)
        self.sender_calls = []

    def tearDown(self):
        sys.modules.pop(self._legacy_module_name, None)
        if self._old_target_env is None:
            os.environ.pop("AWG_MANAGER_LEGACY_TARGET_MODULE", None)
        else:
            os.environ["AWG_MANAGER_LEGACY_TARGET_MODULE"] = self._old_target_env

    def _send_json(self, status, payload):
        self.sender_calls.append(("json", status, payload))

    def _send_bytes(self, status, payload, content_type, filename=None, as_attachment=False):
        self.sender_calls.append(("bytes", status, payload, content_type, filename, as_attachment))

    def test_health_route_is_handled_by_app_router(self):
        handled = self.router.handle_get(["health"], {}, self._send_json, self._send_bytes)
        self.assertTrue(handled)
        self.assertEqual(self.sender_calls[0][1], 200)
        self.assertEqual(self.sender_calls[0][2]["service"], "awg_manager")

    def test_generate_awg_params_route_is_supported(self):
        handled = self.router.handle_post(
            ["awg", "params", "generate"],
            {"awg_version": "2"},
            self._send_json,
            self._send_bytes,
        )
        self.assertTrue(handled)
        self.assertEqual(self.sender_calls[0][1], 200)
        self.assertEqual(self.sender_calls[0][2]["awg_version"], "2")


if __name__ == "__main__":
    unittest.main()
