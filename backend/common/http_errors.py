#!/usr/bin/python3


def send_service_error(send_json, exc):
    if isinstance(exc, LookupError):
        send_json(404, {'ok': False, 'error': str(exc)})
        return
    if isinstance(exc, ValueError):
        send_json(400, {'ok': False, 'error': str(exc)})
        return
    send_json(500, {'ok': False, 'error': str(exc)})

