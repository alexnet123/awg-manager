#!/usr/bin/python3
import ipaddress
import re


SCHEMA_VERSION = 1
_SAFE_TOKEN_RE = re.compile(r'^[A-Za-z0-9_.:@+-]+$')
_SAFE_TIMEZONE_RE = re.compile(r'^[A-Za-z0-9._+-]+(?:/[A-Za-z0-9._+-]+)*$')
_KEY_ID_RE = re.compile(r'^[1-9][0-9]{0,9}$')
_KEY_ALGORITHMS = {'MD5', 'SHA1', 'SHA256', 'SHA384', 'SHA512'}


def default_config():
    return {
        'schema_version': SCHEMA_VERSION,
        'time': {
            'timezone': 'UTC',
            'ntp_enabled': True,
            'rtcsync': True,
        },
        'sources': [],
        'server': {
            'enabled': False,
            'use_local_clock': False,
            'local_stratum': 10,
            'bind_address': '',
            'bind_interface': '',
            'listen_port': 123,
            'orphan_mode': False,
            'rate_limit_enabled': True,
            'rate_interval': 3,
            'rate_burst': 8,
            'collect_client_statistics': True,
            'client_log_limit': 1048576,
            'auth_key': 'none',
        },
        'access': [],
        'keys': [],
    }


def normalize_config(payload):
    if not isinstance(payload, dict):
        raise ValueError('NTP configuration must be a JSON object')

    defaults = default_config()
    schema_version = _integer(payload.get('schema_version', SCHEMA_VERSION), 'schema_version')
    if schema_version != SCHEMA_VERSION:
        raise ValueError(f'Unsupported NTP schema_version: {schema_version}')

    time_payload = _mapping(payload.get('time', {}), 'time')
    timezone = _single_line(time_payload.get('timezone', defaults['time']['timezone']), 'time.timezone')
    if not timezone or not _SAFE_TIMEZONE_RE.fullmatch(timezone):
        raise ValueError('time.timezone has an invalid format')

    sources_payload = payload.get('sources', [])
    if not isinstance(sources_payload, list):
        raise ValueError('sources must be a list')
    if len(sources_payload) > 64:
        raise ValueError('sources cannot contain more than 64 entries')

    access_payload = payload.get('access', [])
    if not isinstance(access_payload, list):
        raise ValueError('access must be a list')
    if len(access_payload) > 128:
        raise ValueError('access cannot contain more than 128 entries')

    keys_payload = payload.get('keys', [])
    if not isinstance(keys_payload, list):
        raise ValueError('keys must be a list')
    if len(keys_payload) > 128:
        raise ValueError('keys cannot contain more than 128 entries')
    keys = [_normalize_key(item, index) for index, item in enumerate(keys_payload)]
    _validate_unique_key_ids(keys)
    enabled_key_ids = {item['id'] for item in keys if item['enabled']}

    sources = [_normalize_source(item, index) for index, item in enumerate(sources_payload)]
    server = _normalize_server(payload.get('server', {}), defaults['server'])
    for index, source in enumerate(sources):
        _validate_auth_reference(source['auth_key'], enabled_key_ids, f'sources[{index}].auth_key')
    _validate_auth_reference(server['auth_key'], enabled_key_ids, 'server.auth_key')

    return {
        'schema_version': SCHEMA_VERSION,
        'time': {
            'timezone': timezone,
            'ntp_enabled': _boolean(time_payload.get('ntp_enabled', defaults['time']['ntp_enabled']), 'time.ntp_enabled'),
            'rtcsync': _boolean(time_payload.get('rtcsync', defaults['time']['rtcsync']), 'time.rtcsync'),
        },
        'sources': sources,
        'server': server,
        'access': [_normalize_access(item, index) for index, item in enumerate(access_payload)],
        'keys': keys,
    }


def _normalize_source(payload, index):
    item = _mapping(payload, f'sources[{index}]')
    source_type = _single_line(item.get('type', 'server'), f'sources[{index}].type').lower()
    if source_type not in ('server', 'pool'):
        raise ValueError(f'sources[{index}].type must be server or pool')
    address = _single_line(item.get('address', ''), f'sources[{index}].address')
    if not address or not _SAFE_TOKEN_RE.fullmatch(address):
        raise ValueError(f'sources[{index}].address has an invalid format')
    min_poll = _integer(item.get('min_poll', 6), f'sources[{index}].min_poll', -7, 24)
    max_poll = _integer(item.get('max_poll', 10), f'sources[{index}].max_poll', -7, 24)
    if max_poll < min_poll:
        raise ValueError(f'sources[{index}].max_poll must be greater than or equal to min_poll')
    return {
        'enabled': _boolean(item.get('enabled', True), f'sources[{index}].enabled'),
        'type': source_type,
        'address': address,
        'min_poll': min_poll,
        'max_poll': max_poll,
        'iburst': _boolean(item.get('iburst', True), f'sources[{index}].iburst'),
        'auth_key': _single_line(item.get('auth_key', 'none'), f'sources[{index}].auth_key'),
        'options': _safe_options(item.get('options', ''), f'sources[{index}].options'),
        'comment': _single_line(item.get('comment', ''), f'sources[{index}].comment'),
    }


def _normalize_server(payload, defaults):
    item = _mapping(payload, 'server')
    use_local_clock = _boolean(item.get('use_local_clock', defaults['use_local_clock']), 'server.use_local_clock')
    orphan_mode = _boolean(item.get('orphan_mode', defaults['orphan_mode']), 'server.orphan_mode')
    if orphan_mode and not use_local_clock:
        raise ValueError('server.orphan_mode requires server.use_local_clock')
    bind_address = _single_line(item.get('bind_address', defaults['bind_address']), 'server.bind_address')
    if bind_address:
        try:
            bind_address = str(ipaddress.ip_address(bind_address))
        except ValueError as exc:
            raise ValueError('server.bind_address must be an IP address') from exc
    bind_interface = _single_line(item.get('bind_interface', defaults['bind_interface']), 'server.bind_interface')
    if bind_interface and not _SAFE_TOKEN_RE.fullmatch(bind_interface):
        raise ValueError('server.bind_interface has an invalid format')
    return {
        'enabled': _boolean(item.get('enabled', defaults['enabled']), 'server.enabled'),
        'use_local_clock': use_local_clock,
        'local_stratum': _integer(item.get('local_stratum', defaults['local_stratum']), 'server.local_stratum', 1, 15),
        'bind_address': bind_address,
        'bind_interface': bind_interface,
        'listen_port': _integer(item.get('listen_port', defaults['listen_port']), 'server.listen_port', 1, 65535),
        'orphan_mode': orphan_mode,
        'rate_limit_enabled': _boolean(item.get('rate_limit_enabled', defaults['rate_limit_enabled']), 'server.rate_limit_enabled'),
        'rate_interval': _integer(item.get('rate_interval', defaults['rate_interval']), 'server.rate_interval', -19, 12),
        'rate_burst': _integer(item.get('rate_burst', defaults['rate_burst']), 'server.rate_burst', 1, 255),
        'collect_client_statistics': True,
        'client_log_limit': _integer(item.get('client_log_limit', defaults['client_log_limit']), 'server.client_log_limit', 0, 2147483648),
        'auth_key': _single_line(item.get('auth_key', defaults['auth_key']), 'server.auth_key'),
    }


def _normalize_access(payload, index):
    item = _mapping(payload, f'access[{index}]')
    action = _single_line(item.get('action', 'allow'), f'access[{index}].action').lower()
    if action not in ('allow', 'deny'):
        raise ValueError(f'access[{index}].action must be allow or deny')
    network = _single_line(item.get('network', ''), f'access[{index}].network')
    if network.lower() == 'all':
        network = 'all'
    else:
        try:
            network = str(ipaddress.ip_network(network, strict=False))
        except ValueError as exc:
            raise ValueError(f'access[{index}].network must be an IP network or all') from exc
    return {
        'enabled': _boolean(item.get('enabled', True), f'access[{index}].enabled'),
        'action': action,
        'network': network,
        'comment': _single_line(item.get('comment', ''), f'access[{index}].comment'),
    }


def _normalize_key(payload, index):
    item = _mapping(payload, f'keys[{index}]')
    key_id = _single_line(item.get('id', ''), f'keys[{index}].id')
    if not _KEY_ID_RE.fullmatch(key_id):
        raise ValueError(f'keys[{index}].id must be a positive numeric Chrony key id')
    algorithm = _single_line(item.get('algorithm', 'SHA256'), f'keys[{index}].algorithm').upper()
    if algorithm not in _KEY_ALGORITHMS:
        raise ValueError(f'keys[{index}].algorithm must be one of {", ".join(sorted(_KEY_ALGORITHMS))}')
    secret = _single_line(item.get('secret', ''), f'keys[{index}].secret')
    if not secret:
        raise ValueError(f'keys[{index}].secret is required')
    return {
        'enabled': _boolean(item.get('enabled', True), f'keys[{index}].enabled'),
        'id': key_id,
        'algorithm': algorithm,
        'secret': secret,
        'comment': _single_line(item.get('comment', ''), f'keys[{index}].comment'),
    }


def _validate_unique_key_ids(keys):
    seen = set()
    for item in keys:
        if item['id'] in seen:
            raise ValueError(f"duplicate key id {item['id']}")
        seen.add(item['id'])


def _validate_auth_reference(value, enabled_key_ids, field):
    if value in ('', 'none'):
        return
    if value not in enabled_key_ids:
        raise ValueError(f'{field} references unknown auth_key {value}')


def _mapping(value, field):
    if not isinstance(value, dict):
        raise ValueError(f'{field} must be an object')
    return value


def _single_line(value, field):
    text = str(value or '').strip()
    if '\n' in text or '\r' in text or '\x00' in text:
        raise ValueError(f'{field} must be a single line')
    return text


def _safe_options(value, field):
    text = _single_line(value, field)
    if text and not re.fullmatch(r'[A-Za-z0-9_.:@+\-= ]+', text):
        raise ValueError(f'{field} contains unsupported characters')
    return ' '.join(text.split())


def _boolean(value, field):
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in ('true', '1', 'yes', 'on'):
            return True
        if lowered in ('false', '0', 'no', 'off'):
            return False
    if value in (0, 1):
        return bool(value)
    raise ValueError(f'{field} must be a boolean')


def _integer(value, field, minimum=None, maximum=None):
    if isinstance(value, bool):
        raise ValueError(f'{field} must be an integer')
    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f'{field} must be an integer') from exc
    if minimum is not None and parsed < minimum:
        raise ValueError(f'{field} must be at least {minimum}')
    if maximum is not None and parsed > maximum:
        raise ValueError(f'{field} must be at most {maximum}')
    return parsed
