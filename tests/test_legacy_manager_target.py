import os
import unittest
from unittest import mock

from backend.app import legacy_manager_target


class LegacyManagerTargetTest(unittest.TestCase):
    def test_resolve_manager_module_name_uses_default(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            self.assertEqual(
                legacy_manager_target.resolve_manager_module_name(),
                "backend.app.legacy_manager_compat",
            )

    def test_resolve_manager_module_name_uses_env_override(self):
        with mock.patch.dict(
            os.environ,
            {"AWG_MANAGER_LEGACY_TARGET_MODULE": "custom_legacy_module"},
            clear=True,
        ):
            self.assertEqual(
                legacy_manager_target.resolve_manager_module_name(),
                "custom_legacy_module",
            )

    def test_load_manager_module_imports_resolved_name(self):
        import_mock = mock.Mock(return_value=object())
        with mock.patch.dict(
            os.environ,
            {"AWG_MANAGER_LEGACY_TARGET_MODULE": "custom_legacy_module"},
            clear=True,
        ):
            legacy_manager_target.load_manager_module(import_module_fn=import_mock)
        import_mock.assert_called_once_with("custom_legacy_module")


if __name__ == "__main__":
    unittest.main()
