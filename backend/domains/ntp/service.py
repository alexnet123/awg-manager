#!/usr/bin/python3
from backend.common import data_paths

from . import config_renderer
from . import runtime_ops
from . import status_ops
from . import store
from . import validation_ops


def _config_path():
    return data_paths.build_state_paths(data_paths.resolve_data_dir())['ntp_config_file']


def get_config():
    stored = store.read_config(_config_path(), validation_ops.default_config)
    return validation_ops.normalize_config(stored)


def save_config(payload):
    normalized = validation_ops.normalize_config(payload)
    store.write_config(_config_path(), normalized)
    return normalized


def get_config_preview():
    return config_renderer.render_config(get_config())


def get_config_with_apply_state():
    config = get_config()
    preview = config_renderer.render_config(config)
    keys_text = config_renderer.render_keys(config) or None
    return {
        **config,
        'applied_current': runtime_ops.is_config_current(preview['content'], keys_text=keys_text),
    }


def apply_config():
    config = get_config()
    preview = config_renderer.render_config(config)
    if preview['warnings']:
        raise ValueError('NTP configuration cannot be applied while preview warnings are present')
    keys_text = config_renderer.render_keys(config) or None
    return runtime_ops.apply_config(preview['content'], keys_text=keys_text)


def handle_get(path_parts):
    if path_parts == ['ntp']:
        return 200, {'ok': True, 'item': get_config_with_apply_state()}
    if path_parts == ['ntp', 'config-preview']:
        return 200, {'ok': True, 'item': get_config_preview()}
    if path_parts == ['ntp', 'status']:
        return 200, {'ok': True, 'item': status_ops.collect_status()}
    if path_parts == ['ntp', 'timezones']:
        return 200, {'ok': True, 'item': runtime_ops.list_timezones()}
    return None


def handle_put(path_parts, payload):
    if path_parts == ['ntp']:
        return 200, {'ok': True, 'item': save_config(payload)}
    return None


def handle_post(path_parts, _payload):
    payload = _payload or {}
    if path_parts == ['ntp', 'apply']:
        return 200, {'ok': True, 'item': apply_config()}
    if path_parts == ['ntp', 'timezone']:
        timezone = validation_ops.normalize_config({'time': {'timezone': payload.get('timezone')}})['time']['timezone']
        return 200, {'ok': True, 'item': runtime_ops.set_timezone(timezone)}
    if path_parts == ['ntp', 'manual-time']:
        if get_config()['time']['ntp_enabled']:
            raise ValueError('NTP synchronization must be disabled before setting time manually')
        return 200, {'ok': True, 'item': runtime_ops.set_manual_time(payload.get('date'), payload.get('time'))}
    if path_parts == ['ntp', 'sync']:
        return 200, {'ok': True, 'item': runtime_ops.sync_now()}
    if path_parts == ['ntp', 'restart']:
        return 200, {'ok': True, 'item': runtime_ops.restart_service()}
    if path_parts == ['ntp', 'reload']:
        return 200, {'ok': True, 'item': runtime_ops.reload_service()}
    return None
