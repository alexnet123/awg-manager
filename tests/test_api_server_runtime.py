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


if __name__ == "__main__":
    unittest.main()
