import gzip
import os
import tempfile
import unittest
from http.server import ThreadingHTTPServer
from unittest.mock import patch

import api_core


class ApiServerRuntimeTest(unittest.TestCase):
    def test_api_server_uses_threading_http_server(self):
        self.assertTrue(issubclass(api_core.AWGThreadingHTTPServer, ThreadingHTTPServer))
        self.assertTrue(api_core.AWGThreadingHTTPServer.daemon_threads)
        self.assertGreaterEqual(api_core.AWGThreadingHTTPServer.request_queue_size, 32)

    def test_start_api_server_constructs_threaded_server(self):
        instances = []

        class FakeServer:
            def __init__(self, address, handler):
                self.address = address
                self.handler = handler
                instances.append(self)

            def serve_forever(self):
                return None

        with patch.object(api_core, "AWGThreadingHTTPServer", FakeServer), patch.object(
            api_core.manager, "bd_path", "/tmp/awg-test", create=True
        ):
            api_core.start_api_server("127.0.0.1", 8787)

        self.assertEqual(instances[0].address, ("127.0.0.1", 8787))
        self.assertIs(instances[0].handler, api_core.AWGManagerAPIHandler)

    def test_webui_assets_use_gzip_and_immutable_cache(self):
        with tempfile.TemporaryDirectory() as dist_dir:
            assets_dir = os.path.join(dist_dir, "assets")
            os.makedirs(assets_dir)
            js_path = os.path.join(assets_dir, "index-test.js")
            with open(js_path, "wb") as asset_file:
                asset_file.write(b"console.log('test')")
            with gzip.open(f"{js_path}.gz", "wb") as gzip_file:
                gzip_file.write(b"console.log('test')")

            sent = {}
            handler = api_core.AWGManagerAPIHandler.__new__(api_core.AWGManagerAPIHandler)
            handler.headers = {"Accept-Encoding": "gzip, br"}
            handler._send_file = lambda status, path, content_type, extra_headers=None: sent.update({
                "status": status,
                "path": path,
                "content_type": content_type,
                "headers": extra_headers or {},
            })

            with patch.object(api_core, "WEBUI_DIST_DIR", dist_dir):
                self.assertTrue(handler._serve_webui_dist("assets/index-test.js"))

            self.assertEqual(sent["status"], 200)
            self.assertEqual(sent["path"], f"{js_path}.gz")
            self.assertEqual(sent["headers"]["Content-Encoding"], "gzip")
            self.assertEqual(sent["headers"]["Cache-Control"], "public, max-age=31536000, immutable")

    def test_webui_index_uses_no_cache(self):
        with tempfile.TemporaryDirectory() as dist_dir:
            index_path = os.path.join(dist_dir, "index.html")
            with open(index_path, "wb") as index_file:
                index_file.write(b"<!doctype html>")

            sent = {}
            handler = api_core.AWGManagerAPIHandler.__new__(api_core.AWGManagerAPIHandler)
            handler.headers = {}
            handler._send_file = lambda status, path, content_type, extra_headers=None: sent.update({
                "status": status,
                "path": path,
                "content_type": content_type,
                "headers": extra_headers or {},
            })

            with patch.object(api_core, "WEBUI_DIST_DIR", dist_dir):
                self.assertTrue(handler._serve_webui_dist("index.html"))

            self.assertEqual(sent["status"], 200)
            self.assertEqual(sent["path"], index_path)
            self.assertEqual(sent["headers"], {"Cache-Control": "no-cache"})


if __name__ == "__main__":
    unittest.main()
