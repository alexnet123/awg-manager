import os
import pathlib
import tempfile
import unittest

from backend.common import data_paths, json_store


class BackendCommonTest(unittest.TestCase):
    def test_data_paths_resolve_from_env_and_build_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            old = os.environ.get(data_paths.DATA_DIR_ENV_VAR)
            try:
                os.environ[data_paths.DATA_DIR_ENV_VAR] = tmp
                base = data_paths.resolve_data_dir()
                paths = data_paths.build_state_paths(base)
                self.assertEqual(base, os.path.abspath(tmp))
                self.assertTrue(paths["api_key_file"].startswith(base))
                self.assertTrue(paths["ipsec_peers_file"].startswith(base))
            finally:
                if old is None:
                    os.environ.pop(data_paths.DATA_DIR_ENV_VAR, None)
                else:
                    os.environ[data_paths.DATA_DIR_ENV_VAR] = old

    def test_json_store_roundtrip_with_auto_dir(self):
        with tempfile.TemporaryDirectory() as tmp:
            target = pathlib.Path(tmp) / "nested" / "file.json"
            payload = {"items": [{"id": 1}]}
            json_store.write_json(str(target), payload, ensure_dir=True)
            loaded = json_store.read_json(str(target), {})
            self.assertEqual(loaded, payload)


if __name__ == "__main__":
    unittest.main()
