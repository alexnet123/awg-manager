#!/usr/bin/python3
from backend.common.http_errors import send_service_error
from backend.common.system_metrics import collect_system_metrics
from backend.domains.firewall import service as firewall_service
from backend.domains.awg import service as ic_service
from backend.domains.ipsec import service as ipsec_service
from backend.domains.ntp import service as ntp_service


def _handle_client_qr_path(path_parts):
    if len(path_parts) not in (3, 4):
        return False
    if path_parts[0] != 'clients' or path_parts[2] != 'qr':
        return False
    if len(path_parts) == 4 and path_parts[3] != 'download':
        return False
    return True


def handle_get(path_parts, query_params, send_json, send_bytes):
    try:
        if path_parts == ['health']:
            send_json(200, {
                'ok': True,
                'service': 'awg_manager',
                'auth': 'api_key',
                'system': collect_system_metrics(),
            })
            return True

        if path_parts == ['interfaces']:
            send_json(200, {'ok': True, 'items': ic_service.list_interfaces()})
            return True

        if len(path_parts) == 2 and path_parts[0] == 'interfaces':
            send_json(200, {'ok': True, 'item': ic_service.get_interface(path_parts[1])})
            return True

        if len(path_parts) == 3 and path_parts[0] == 'interfaces' and path_parts[2] == 'config':
            send_json(200, {'ok': True, 'config': ic_service.get_interface_config(path_parts[1])})
            return True

        if path_parts == ['clients']:
            send_json(200, {'ok': True, 'items': ic_service.list_clients()})
            return True

        firewall_response = firewall_service.handle_get(path_parts, query_params)
        if firewall_response is not None:
            status, payload = firewall_response
            send_json(status, payload)
            return True

        ipsec_response = ipsec_service.handle_get(path_parts)
        if ipsec_response is not None:
            status, payload = ipsec_response
            send_json(status, payload)
            return True

        ntp_response = ntp_service.handle_get(path_parts)
        if ntp_response is not None:
            status, payload = ntp_response
            send_json(status, payload)
            return True

        if path_parts == ['backup', 'download']:
            send_bytes(
                200,
                ic_service.get_backup_bytes(),
                'application/octet-stream',
                filename='clients.db',
                as_attachment=True,
            )
            return True

        if len(path_parts) == 2 and path_parts[0] == 'clients':
            send_json(200, {'ok': True, 'item': ic_service.get_client(path_parts[1])})
            return True

        if len(path_parts) == 3 and path_parts[0] == 'clients' and path_parts[2] == 'config':
            config, client = ic_service.get_client_config(path_parts[1])
            send_json(200, {'ok': True, 'client': client, 'config': config})
            return True

        if len(path_parts) == 4 and path_parts[0] == 'clients' and path_parts[2] == 'config' and path_parts[3] == 'download':
            config, client = ic_service.get_client_config(path_parts[1])
            filename = f"client-{client['id']}-{client['name']}.conf"
            send_bytes(
                200,
                config.encode('utf-8'),
                'text/plain; charset=utf-8',
                filename=filename,
                as_attachment=True,
            )
            return True

        if _handle_client_qr_path(path_parts):
            output_format = query_params.get('format', ['svg'])[0].lower()
            if output_format != 'svg':
                send_json(400, {'ok': False, 'error': 'Only svg format is currently supported'})
                return True
            qr_svg, client = ic_service.get_client_qr_svg(path_parts[1])
            is_download = len(path_parts) == 4 and path_parts[3] == 'download'
            filename = f"client-{client['id']}-{client['name']}.svg"
            send_bytes(
                200,
                qr_svg,
                'image/svg+xml',
                filename=filename,
                as_attachment=is_download,
            )
            return True
    except Exception as exc:  # pragma: no cover - exercised via contract tests
        send_service_error(send_json, exc)
        return True

    return False


def handle_post(path_parts, payload, send_json, _send_bytes):
    try:
        if path_parts == ['api-key', 'rotate']:
            send_json(200, {'ok': True, 'api_key': ic_service.rotate_api_key()})
            return True

        if path_parts == ['awg', 'params', 'generate']:
            awg_version, awg_params = ic_service.generate_awg_params((payload or {}).get('awg_version', '2'))
            send_json(200, {'ok': True, 'awg_version': awg_version, 'awg_params': awg_params})
            return True

        if path_parts == ['interfaces']:
            send_json(201, {'ok': True, 'item': ic_service.create_interface(payload)})
            return True

        if len(path_parts) == 3 and path_parts[0] == 'interfaces' and path_parts[2] in ('enable', 'disable'):
            send_json(200, {
                'ok': True,
                'item': ic_service.set_interface_enabled(path_parts[1], path_parts[2] == 'enable'),
            })
            return True

        if path_parts == ['clients']:
            send_json(201, {'ok': True, 'item': ic_service.create_client(payload)})
            return True

        if len(path_parts) == 3 and path_parts[0] == 'clients' and path_parts[2] in ('enable', 'disable'):
            send_json(200, {
                'ok': True,
                'item': ic_service.set_client_enabled(path_parts[1], path_parts[2] == 'enable'),
            })
            return True

        firewall_response = firewall_service.handle_post(path_parts, payload)
        if firewall_response is not None:
            status, body = firewall_response
            send_json(status, body)
            return True

        ipsec_response = ipsec_service.handle_post(path_parts, payload)
        if ipsec_response is not None:
            status, body = ipsec_response
            send_json(status, body)
            return True

        ntp_response = ntp_service.handle_post(path_parts, payload)
        if ntp_response is not None:
            status, body = ntp_response
            send_json(status, body)
            return True

        if path_parts == ['backup', 'restore']:
            ic_service.restore_backup((payload or {}).get('db_base64'))
            send_json(200, {'ok': True})
            return True
    except Exception as exc:  # pragma: no cover - exercised via contract tests
        send_service_error(send_json, exc)
        return True

    return False


def handle_put(path_parts, payload, send_json, _send_bytes):
    try:
        if len(path_parts) == 2 and path_parts[0] == 'interfaces':
            send_json(200, {'ok': True, 'item': ic_service.update_interface(path_parts[1], payload)})
            return True

        if len(path_parts) == 2 and path_parts[0] == 'clients':
            send_json(200, {'ok': True, 'item': ic_service.update_client(path_parts[1], payload)})
            return True

        firewall_response = firewall_service.handle_put(path_parts, payload)
        if firewall_response is not None:
            status, body = firewall_response
            send_json(status, body)
            return True

        ipsec_response = ipsec_service.handle_put(path_parts, payload)
        if ipsec_response is not None:
            status, body = ipsec_response
            send_json(status, body)
            return True

        ntp_response = ntp_service.handle_put(path_parts, payload)
        if ntp_response is not None:
            status, body = ntp_response
            send_json(status, body)
            return True
    except Exception as exc:  # pragma: no cover - exercised via contract tests
        send_service_error(send_json, exc)
        return True

    return False


def handle_delete(path_parts, send_json, _send_bytes):
    try:
        if len(path_parts) == 2 and path_parts[0] == 'interfaces':
            send_json(200, {'ok': True, 'item': ic_service.delete_interface(path_parts[1])})
            return True

        if len(path_parts) == 2 and path_parts[0] == 'clients':
            send_json(200, {'ok': True, 'item': ic_service.delete_client(path_parts[1])})
            return True

        firewall_response = firewall_service.handle_delete(path_parts)
        if firewall_response is not None:
            status, body = firewall_response
            send_json(status, body)
            return True

        ipsec_response = ipsec_service.handle_delete(path_parts)
        if ipsec_response is not None:
            status, body = ipsec_response
            send_json(status, body)
            return True
    except Exception as exc:  # pragma: no cover - exercised via contract tests
        send_service_error(send_json, exc)
        return True

    return False
