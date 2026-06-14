#!/usr/bin/python3
import json
import mimetypes
import os
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

from backend.app import router as app_router
from backend.app import manager_facade as manager

UI_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ui')
WEBUI_DIST_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'webui', 'dist')


class AWGThreadingHTTPServer(ThreadingHTTPServer):
    daemon_threads = True
    request_queue_size = 32


class AWGManagerAPIHandler(BaseHTTPRequestHandler):
    server_version = 'AWGManagerAPI/1.0'

    def _send_security_headers(self):
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
        # UI is same-origin only; API and static assets are served from one origin.
        self.send_header(
            'Content-Security-Policy',
            "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; "
            "script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
        )

    def _send_json(self, status_code, payload):
        response = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status_code)
        self._send_security_headers()
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(response)))
        self.end_headers()
        self.wfile.write(response)

    def _send_bytes(self, status_code, payload, content_type, filename=None, as_attachment=False):
        self.send_response(status_code)
        self._send_security_headers()
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(payload)))
        if filename is not None:
            disposition = 'attachment' if as_attachment else 'inline'
            self.send_header('Content-Disposition', f'{disposition}; filename="{filename}"')
        self.end_headers()
        self.wfile.write(payload)

    def _send_redirect(self, location):
        self.send_response(302)
        self._send_security_headers()
        self.send_header('Location', location)
        self.end_headers()

    def _serve_static_file(self, relative_path):
        normalized_path = os.path.normpath(relative_path).lstrip(os.sep)
        full_path = os.path.abspath(os.path.join(UI_DIR, normalized_path))
        if not full_path.startswith(os.path.abspath(UI_DIR) + os.sep) and full_path != os.path.abspath(UI_DIR):
            self._send_json(404, {'ok': False, 'error': 'File not found'})
            return True
        if not os.path.isfile(full_path):
            self._send_json(404, {'ok': False, 'error': 'File not found'})
            return True
        with open(full_path, 'rb') as static_file:
            payload = static_file.read()
        content_type = mimetypes.guess_type(full_path)[0] or 'application/octet-stream'
        self._send_bytes(200, payload, content_type)
        return True

    def _serve_webui_dist(self, relative_path):
        if not os.path.isdir(WEBUI_DIST_DIR):
            return False
        normalized_path = os.path.normpath(relative_path).lstrip(os.sep)
        full_path = os.path.abspath(os.path.join(WEBUI_DIST_DIR, normalized_path))
        webui_root = os.path.abspath(WEBUI_DIST_DIR)
        if not full_path.startswith(webui_root + os.sep) and full_path != webui_root:
            return False
        if not os.path.isfile(full_path):
            return False
        with open(full_path, 'rb') as static_file:
            payload = static_file.read()
        content_type = mimetypes.guess_type(full_path)[0] or 'application/octet-stream'
        self._send_bytes(200, payload, content_type)
        return True

    def _require_auth(self):
        api_key = self.headers.get('X-API-Key')
        is_valid, error_message = manager.verify_api_auth(api_key, None)
        if not is_valid:
            self._send_json(401, {'ok': False, 'error': error_message})
            return False
        return True

    def _read_json_body(self):
        content_length = int(self.headers.get('Content-Length', '0'))
        if content_length == 0:
            return {}
        raw_body = self.rfile.read(content_length)
        try:
            return json.loads(raw_body.decode('utf-8'))
        except json.JSONDecodeError:
            self._send_json(400, {'ok': False, 'error': 'Invalid JSON body'})
            return None

    def do_GET(self):
        parsed_url = urlparse(self.path)

        if parsed_url.path == '/':
            self._send_redirect('/ui/')
            return

        if parsed_url.path in ('/ui', '/ui/'):
            if self._serve_webui_dist('index.html'):
                return
            self._serve_static_file('index.html')
            return

        # New Web UI build output (Vite):
        # - assets are served as /assets/...
        if parsed_url.path.startswith('/assets/'):
            relative_path = parsed_url.path[len('/assets/'):]
            if self._serve_webui_dist(os.path.join('assets', relative_path)):
                return

        if parsed_url.path.startswith('/static/'):
            relative_path = parsed_url.path[len('/static/'):]
            self._serve_static_file(relative_path)
            return

        if not self._require_auth():
            return

        path_parts = [part for part in parsed_url.path.strip('/').split('/') if part]
        query_params = parse_qs(parsed_url.query)

        if app_router.handle_get(path_parts, query_params, self._send_json, self._send_bytes):
            return

        self._send_json(404, {'ok': False, 'error': 'Route not found'})

    def do_POST(self):
        if not self._require_auth():
            return

        parsed_url = urlparse(self.path)
        path_parts = [part for part in parsed_url.path.strip('/').split('/') if part]
        payload = self._read_json_body()
        if payload is None:
            return

        if app_router.handle_post(path_parts, payload, self._send_json, self._send_bytes):
            return

        self._send_json(404, {'ok': False, 'error': 'Route not found'})

    def do_PUT(self):
        if not self._require_auth():
            return

        parsed_url = urlparse(self.path)
        path_parts = [part for part in parsed_url.path.strip('/').split('/') if part]
        payload = self._read_json_body()
        if payload is None:
            return

        if app_router.handle_put(path_parts, payload, self._send_json, self._send_bytes):
            return

        self._send_json(404, {'ok': False, 'error': 'Route not found'})

    def do_DELETE(self):
        if not self._require_auth():
            return

        parsed_url = urlparse(self.path)
        path_parts = [part for part in parsed_url.path.strip('/').split('/') if part]

        if app_router.handle_delete(path_parts, self._send_json, self._send_bytes):
            return

        self._send_json(404, {'ok': False, 'error': 'Route not found'})

    def log_message(self, format, *args):
        return


def start_api_server(host='127.0.0.1', port=8787):
    httpd = AWGThreadingHTTPServer((host, port), AWGManagerAPIHandler)
    print(f'API server started on http://{host}:{port}')
    print('Authentication header required: X-API-Key')
    print(f'Runtime data dir: {manager.bd_path}')
    print(f'Stand profile: {os.environ.get("AWG_MANAGER_STAND_PROFILE", "firewall")}')
    httpd.serve_forever()


def main():
    positional_args = []
    skip_next = False
    for arg in sys.argv[1:]:
        if skip_next:
            skip_next = False
            continue
        if arg == '-r':
            skip_next = True
            continue
        positional_args.append(arg)

    api_host = positional_args[0] if len(positional_args) > 0 else '127.0.0.1'
    api_port = int(positional_args[1]) if len(positional_args) > 1 else 8787
    start_api_server(api_host, api_port)


if __name__ == '__main__':
    main()
