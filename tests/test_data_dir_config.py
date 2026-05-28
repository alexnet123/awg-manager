import importlib
import os
import pathlib
import sys
import tempfile
import types
import unittest


PROJECT_ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


class DataDirConfigTest(unittest.TestCase):
    def _import_legacy_target_manager(self, data_dir: str):
        key_file = pathlib.Path(data_dir) / "encryption.key"
        pathlib.Path(data_dir).mkdir(parents=True, exist_ok=True)
        key_file.write_text("test-secret\n", encoding="utf-8")

        old_argv = list(sys.argv)
        old_env = os.environ.get("AWG_MANAGER_DATA_DIR")
        old_target_env = os.environ.get("AWG_MANAGER_LEGACY_TARGET_MODULE")
        old_crypto = sys.modules.get("cryptography")
        old_crypto_fernet = sys.modules.get("cryptography.fernet")
        old_segno = sys.modules.get("segno")
        old_target_module = sys.modules.get("backend.app.legacy_manager_target")
        old_legacy_compat_module = sys.modules.get("backend.app.legacy_manager_compat")
        try:
            sys.argv = ["legacy_manager_compat.py", "-r", str(key_file)]
            os.environ["AWG_MANAGER_DATA_DIR"] = data_dir
            os.environ["AWG_MANAGER_LEGACY_TARGET_MODULE"] = "backend.app.legacy_manager_compat"
            crypto_mod = types.ModuleType("cryptography")
            fernet_mod = types.ModuleType("cryptography.fernet")

            class _Fernet:  # pragma: no cover - import stub
                def __init__(self, *_args, **_kwargs):
                    pass

            class _InvalidToken(Exception):
                pass

            fernet_mod.Fernet = _Fernet
            fernet_mod.InvalidToken = _InvalidToken
            crypto_mod.fernet = fernet_mod
            sys.modules["cryptography"] = crypto_mod
            sys.modules["cryptography.fernet"] = fernet_mod
            sys.modules["segno"] = types.ModuleType("segno")
            sys.modules.pop("backend.app.legacy_manager_target", None)
            sys.modules.pop("backend.app.legacy_manager_compat", None)
            target = importlib.import_module("backend.app.legacy_manager_target")
            module = target.load_manager_module(import_module_fn=importlib.import_module)
            return module
        finally:
            sys.argv = old_argv
            if old_env is None:
                os.environ.pop("AWG_MANAGER_DATA_DIR", None)
            else:
                os.environ["AWG_MANAGER_DATA_DIR"] = old_env
            if old_target_env is None:
                os.environ.pop("AWG_MANAGER_LEGACY_TARGET_MODULE", None)
            else:
                os.environ["AWG_MANAGER_LEGACY_TARGET_MODULE"] = old_target_env
            if old_crypto is None:
                sys.modules.pop("cryptography", None)
            else:
                sys.modules["cryptography"] = old_crypto
            if old_crypto_fernet is None:
                sys.modules.pop("cryptography.fernet", None)
            else:
                sys.modules["cryptography.fernet"] = old_crypto_fernet
            if old_segno is None:
                sys.modules.pop("segno", None)
            else:
                sys.modules["segno"] = old_segno
            if old_target_module is None:
                sys.modules.pop("backend.app.legacy_manager_target", None)
            else:
                sys.modules["backend.app.legacy_manager_target"] = old_target_module
            if old_legacy_compat_module is None:
                sys.modules.pop("backend.app.legacy_manager_compat", None)
            else:
                sys.modules["backend.app.legacy_manager_compat"] = old_legacy_compat_module

    def test_data_dir_env_overrides_default_paths(self):
        with tempfile.TemporaryDirectory() as tmp:
            module = self._import_legacy_target_manager(tmp)
            self.assertEqual(module.bd_path, os.path.abspath(tmp))
            self.assertTrue(module.API_KEY_FILE.startswith(os.path.abspath(tmp)))
            self.assertTrue(module.FIREWALL_RULES_FILE.startswith(os.path.abspath(tmp)))
            self.assertTrue(module.IPSEC_PEERS_FILE.startswith(os.path.abspath(tmp)))
            self.assertTrue((pathlib.Path(tmp) / "clients.db").exists())
            module.conn.close()
            sys.modules.pop("backend.app.legacy_manager_compat", None)

    def test_api_key_is_persisted_inside_selected_data_dir(self):
        with tempfile.TemporaryDirectory() as tmp:
            module = self._import_legacy_target_manager(tmp)
            module.save_api_key("abc123")
            self.assertEqual(module.load_api_key(), "abc123")
            api_key_path = pathlib.Path(tmp) / "api.key"
            self.assertTrue(api_key_path.exists())
            self.assertEqual(api_key_path.read_text(encoding="utf-8").strip(), "abc123")
            rotated = module.rotate_api_key()
            self.assertEqual(module.load_api_key(), rotated)
            self.assertEqual(api_key_path.read_text(encoding="utf-8").strip(), rotated)
            module.conn.close()
            sys.modules.pop("backend.app.legacy_manager_compat", None)


if __name__ == "__main__":
    unittest.main()
