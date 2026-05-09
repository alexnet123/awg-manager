#!/usr/bin/python3
import json
import mimetypes
import os
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs

import awg_core as manager

UI_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ui')
WEBUI_DIST_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'webui', 'dist')


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

    def _handle_service_error(self, exc):
        if isinstance(exc, LookupError):
            self._send_json(404, {'ok': False, 'error': str(exc)})
        elif isinstance(exc, ValueError):
            self._send_json(400, {'ok': False, 'error': str(exc)})
        else:
            self._send_json(500, {'ok': False, 'error': str(exc)})

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

        if parsed_url.path == '/health':
            self._send_json(200, {
                'ok': True,
                'service': 'awg_manager',
                'auth': 'api_key'
            })
            return

        if path_parts == ['interfaces']:
            interfaces = [
                manager.serialize_interface_row(row)
                for row in manager.c.execute(f'SELECT {manager.WG_INTERFACE_COLUMNS} FROM wg_interfaces').fetchall()
            ]
            self._send_json(200, {'ok': True, 'items': interfaces})
            return

        if len(path_parts) == 2 and path_parts[0] == 'interfaces':
            row = manager.c.execute(
                f'SELECT {manager.WG_INTERFACE_COLUMNS} FROM wg_interfaces WHERE id = ?',
                (path_parts[1],)
            ).fetchone()
            if not row:
                self._send_json(404, {'ok': False, 'error': 'Interface not found'})
                return
            self._send_json(200, {'ok': True, 'item': manager.serialize_interface_row(row)})
            return

        if len(path_parts) == 3 and path_parts[0] == 'interfaces' and path_parts[2] == 'config':
            row = manager.c.execute(
                f'SELECT {manager.WG_INTERFACE_COLUMNS} FROM wg_interfaces WHERE id = ?',
                (path_parts[1],)
            ).fetchone()
            if not row:
                self._send_json(404, {'ok': False, 'error': 'Interface not found'})
                return
            config_text = manager.build_interface_server_config(row)
            self._send_json(200, {'ok': True, 'config': config_text})
            return

        if path_parts == ['clients']:
            clients = [
                manager.serialize_client_row(row)
                for row in manager.c.execute('SELECT * FROM clients').fetchall()
            ]
            self._send_json(200, {'ok': True, 'items': clients})
            return

        if path_parts == ['backup', 'download']:
            backup_bytes = manager.read_database_bytes()
            self._send_bytes(
                200,
                backup_bytes,
                'application/octet-stream',
                filename='clients.db',
                as_attachment=True
            )
            return

        if len(path_parts) == 2 and path_parts[0] == 'clients':
            row = manager.c.execute('SELECT * FROM clients WHERE id = ?', (path_parts[1],)).fetchone()
            if not row:
                self._send_json(404, {'ok': False, 'error': 'Client not found'})
                return
            self._send_json(200, {'ok': True, 'item': manager.serialize_client_row(row, include_private_key=True)})
            return

        if len(path_parts) == 3 and path_parts[0] == 'clients' and path_parts[2] == 'config':
            client_row = manager.c.execute('SELECT * FROM clients WHERE id = ?', (path_parts[1],)).fetchone()
            if not client_row:
                self._send_json(404, {'ok': False, 'error': 'Client not found'})
                return
            interface_row = manager.c.execute(
                f'SELECT {manager.WG_INTERFACE_COLUMNS} FROM wg_interfaces WHERE wg_interface = ?',
                (client_row[5],)
            ).fetchone()
            if not interface_row:
                self._send_json(404, {'ok': False, 'error': 'Interface not found'})
                return
            client_config = manager.build_client_config(client_row, interface_row)
            self._send_json(200, {
                'ok': True,
                'client': manager.serialize_client_row(client_row),
                'config': client_config
            })
            return

        if len(path_parts) == 4 and path_parts[0] == 'clients' and path_parts[2] == 'config' and path_parts[3] == 'download':
            client_row = manager.c.execute('SELECT * FROM clients WHERE id = ?', (path_parts[1],)).fetchone()
            if not client_row:
                self._send_json(404, {'ok': False, 'error': 'Client not found'})
                return
            interface_row = manager.c.execute(
                f'SELECT {manager.WG_INTERFACE_COLUMNS} FROM wg_interfaces WHERE wg_interface = ?',
                (client_row[5],)
            ).fetchone()
            if not interface_row:
                self._send_json(404, {'ok': False, 'error': 'Interface not found'})
                return

            client_config = manager.build_client_config(client_row, interface_row).encode('utf-8')
            filename = f"client-{client_row[0]}-{client_row[1]}.conf"
            self._send_bytes(
                200,
                client_config,
                'text/plain; charset=utf-8',
                filename=filename,
                as_attachment=True
            )
            return

        if len(path_parts) in (3, 4) and path_parts[0] == 'clients' and path_parts[2] == 'qr':
            client_row = manager.c.execute('SELECT * FROM clients WHERE id = ?', (path_parts[1],)).fetchone()
            if not client_row:
                self._send_json(404, {'ok': False, 'error': 'Client not found'})
                return
            interface_row = manager.c.execute(
                f'SELECT {manager.WG_INTERFACE_COLUMNS} FROM wg_interfaces WHERE wg_interface = ?',
                (client_row[5],)
            ).fetchone()
            if not interface_row:
                self._send_json(404, {'ok': False, 'error': 'Interface not found'})
                return

            output_format = query_params.get('format', ['svg'])[0].lower()
            client_config = manager.build_client_config(client_row, interface_row)
            if output_format != 'svg':
                self._send_json(400, {'ok': False, 'error': 'Only svg format is currently supported'})
                return

            qr_svg = manager.build_qr_svg(client_config)
            filename = f"client-{client_row[0]}-{client_row[1]}.svg"
            is_download = len(path_parts) == 4 and path_parts[3] == 'download'
            if len(path_parts) == 4 and path_parts[3] != 'download':
                self._send_json(404, {'ok': False, 'error': 'Route not found'})
                return
            self._send_bytes(
                200,
                qr_svg,
                'image/svg+xml',
                filename=filename,
                as_attachment=is_download
            )
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

        try:
            if path_parts == ['api-key', 'rotate']:
                new_key = manager.rotate_api_key()
                self._send_json(200, {'ok': True, 'api_key': new_key})
                return

            if path_parts == ['awg', 'params', 'generate']:
                awg_version = manager.detect_awg_version(payload.get('awg_version', '2'), {})
                awg_params = manager.prepare_awg_params_for_version(awg_version)
                self._send_json(200, {'ok': True, 'awg_version': awg_version, 'awg_params': awg_params})
                return

            if path_parts == ['interfaces']:
                row = manager.create_interface_service(payload)
                self._send_json(201, {'ok': True, 'item': manager.serialize_interface_row(row)})
                return

            if path_parts == ['clients']:
                row = manager.create_client_service(payload)
                self._send_json(201, {'ok': True, 'item': manager.serialize_client_row(row, include_private_key=True)})
                return

            if path_parts == ['backup', 'restore']:
                db_base64 = payload.get('db_base64')
                if not isinstance(db_base64, str) or not db_base64.strip():
                    raise ValueError('db_base64 is required')
                backup_bytes = manager.decode_base64_payload(db_base64.strip())
                manager.restore_database_from_bytes(backup_bytes)
                self._send_json(200, {'ok': True})
                return
        except Exception as exc:
            self._handle_service_error(exc)
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

        try:
            if len(path_parts) == 2 and path_parts[0] == 'interfaces':
                row = manager.update_interface_service(path_parts[1], payload)
                self._send_json(200, {'ok': True, 'item': manager.serialize_interface_row(row)})
                return

            if len(path_parts) == 2 and path_parts[0] == 'clients':
                row = manager.update_client_service(path_parts[1], payload)
                self._send_json(200, {'ok': True, 'item': manager.serialize_client_row(row, include_private_key=True)})
                return
        except Exception as exc:
            self._handle_service_error(exc)
            return

        self._send_json(404, {'ok': False, 'error': 'Route not found'})

    def do_DELETE(self):
        if not self._require_auth():
            return

        parsed_url = urlparse(self.path)
        path_parts = [part for part in parsed_url.path.strip('/').split('/') if part]

        try:
            if len(path_parts) == 2 and path_parts[0] == 'interfaces':
                row = manager.delete_interface_service(path_parts[1])
                self._send_json(200, {'ok': True, 'item': manager.serialize_interface_row(row)})
                return

            if len(path_parts) == 2 and path_parts[0] == 'clients':
                row = manager.delete_client_service(path_parts[1])
                self._send_json(200, {'ok': True, 'item': manager.serialize_client_row(row)})
                return
        except Exception as exc:
            self._handle_service_error(exc)
            return

        self._send_json(404, {'ok': False, 'error': 'Route not found'})

    def log_message(self, format, *args):
        return


def start_api_server(host='127.0.0.1', port=8787):
    httpd = HTTPServer((host, port), AWGManagerAPIHandler)
    print(f'API server started on http://{host}:{port}')
    print('Authentication header required: X-API-Key')
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
