import types
import unittest
from unittest import mock

from backend.app import legacy_manager_bridge


class LegacyManagerBridgeTest(unittest.TestCase):
    def test_load_manager_delegates_to_legacy_target_loader(self):
        fake_manager = object()
        with mock.patch(
            "backend.app.legacy_manager_bridge.legacy_manager_target.load_manager_module",
            return_value=fake_manager,
        ) as target_loader_mock:
            out = legacy_manager_bridge.load_manager(import_module_fn=mock.Mock())
        self.assertIs(out, fake_manager)
        target_loader_mock.assert_called_once()

    def test_call_manager_method_delegates_to_loaded_manager(self):
        fake_manager = types.SimpleNamespace(example=lambda a, b=None: {"a": a, "b": b})
        out = legacy_manager_bridge.call_manager_method(
            "example",
            1,
            b=2,
            import_module_fn=mock.Mock(return_value=fake_manager),
        )
        self.assertEqual(out, {"a": 1, "b": 2})

    def test_get_manager_attr_delegates_to_loaded_manager(self):
        fake_manager = types.SimpleNamespace(example_value="ok")
        out = legacy_manager_bridge.get_manager_attr(
            "example_value",
            import_module_fn=mock.Mock(return_value=fake_manager),
        )
        self.assertEqual(out, "ok")


if __name__ == "__main__":
    unittest.main()
