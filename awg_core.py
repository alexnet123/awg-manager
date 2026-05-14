#!/usr/bin/python3
import subprocess
import sqlite3
import ipaddress
import getpass
import base64
import binascii
import hashlib
import sys
import os
import random
import tempfile
import io
import re
import json
import uuid
import time
from cryptography.fernet import Fernet, InvalidToken
import segno


def derive_encryption_key_v2(raw_key):
    # Stable KDF: sha256(secret) -> 32 bytes -> urlsafe base64 for Fernet.
    digest = hashlib.sha256(raw_key.encode('utf-8')).digest()
    return base64.urlsafe_b64encode(digest)


def derive_encryption_key_v1_legacy(raw_key):
    # Legacy behavior used by older installs: pad/truncate to 32 bytes then base64.
    # Keep this only for backwards decryption compatibility.
    key_bytes = raw_key.encode('utf-8')[:32].ljust(32, b'\0')
    return base64.urlsafe_b64encode(key_bytes)


def get_argument_value(flag_name, default=None):
    if flag_name in sys.argv:
        flag_index = sys.argv.index(flag_name)
        if flag_index + 1 < len(sys.argv):
            return sys.argv[flag_index + 1]
    return default


def load_encryption_secret():
    encryption_key_path = get_argument_value('-r')
    if encryption_key_path is not None:
        with open(str(encryption_key_path), "r") as encryption_key_file:
            return encryption_key_file.read().rstrip('\n')
    print("*** Введите ключ шифрования приватного ключа клиента ***")
    return getpass.getpass("Введите ключ: ").rstrip('\n')


encryption_secret = load_encryption_secret()
encryption_key = derive_encryption_key_v2(encryption_secret)
encryption_key_legacy = derive_encryption_key_v1_legacy(encryption_secret)




#_path = os.path.dirname(os.path.abspath(__file__))

# Получить путь к символической ссылке
#link_path = os.path.abspath(__file__)

# Разрешить символическую ссылку и получить путь к оригинальному файлу
#org_path = os.path.dirname(os.path.realpath(link_path))

# Сменить каталог
#os.chdir(org_path)



bd_path = '/etc/wg-manager'
API_KEY_ENV_VAR = 'AWG_MANAGER_API_KEY'
API_KEY_FILE = os.path.join(bd_path, 'api.key')
FIREWALL_RULES_FILE = os.path.join(bd_path, 'firewall_rules.json')
FIREWALL_SETS_FILE = os.path.join(bd_path, 'firewall_sets.json')
FIREWALL_MAPS_FILE = os.path.join(bd_path, 'firewall_maps.json')
FIREWALL_TABLES_FILE = os.path.join(bd_path, 'firewall_tables.json')
FIREWALL_MANAGED_TABLES_FILE = os.path.join(bd_path, 'firewall_managed_tables.json')
FIREWALL_STATS_FILE = os.path.join(bd_path, 'firewall_stats.json')
FIREWALL_TABLE_FAMILY = 'inet'
FIREWALL_TABLE_PREFIX = ''
FIREWALL_SCHEMA = {
    'family': FIREWALL_TABLE_FAMILY,
    'tables': {
        'filter': {
            'chains': ['input', 'forward', 'output'],
            'nat_types': [],
            'supports': ['proto', 'src', 'dst', 'sport', 'dport', 'ct_state', 'in_interface', 'out_interface', 'action', 'counter', 'log', 'limit_rate'],
        },
        'nat': {
            'chains': ['prerouting', 'input', 'output', 'postrouting'],
            'nat_types_by_chain': {
                'prerouting': ['dnat', 'redirect'],
                'input': [],
                'output': ['dnat', 'redirect'],
                'postrouting': ['snat', 'masquerade'],
            },
            'supports': ['proto', 'src', 'dst', 'sport', 'dport', 'ct_state', 'in_interface', 'out_interface', 'action', 'counter', 'log', 'limit_rate', 'nat_type', 'to_addr', 'to_port', 'nat_random', 'nat_fully_random', 'nat_persistent'],
        },
        'raw': {
            'chains': ['prerouting', 'output'],
            'nat_types': [],
            'supports': ['proto', 'src', 'dst', 'sport', 'dport', 'ct_state', 'in_interface', 'out_interface', 'action', 'counter', 'notrack'],
        },
        'mangle': {
            'chains': ['prerouting', 'input', 'forward', 'output', 'postrouting'],
            'nat_types': [],
            'supports': ['proto', 'src', 'dst', 'sport', 'dport', 'ct_state', 'in_interface', 'out_interface', 'action', 'counter', 'mark_set', 'ct_mark_set', 'log', 'limit_rate'],
        },
    },
    'actions': ['accept', 'drop', 'reject', 'jump', 'goto', 'return'],
    'protos': ['tcp', 'udp', 'icmp', 'icmpv6'],
    'ct_states': ['established,related', 'new', 'invalid', 'related', 'established', 'untracked'],
}
FIREWALL_DEFAULT_TABLE_DEFS = {
    'filter': [
        ('input', 'filter', 'input', 0, None, 'accept'),
        ('forward', 'filter', 'forward', 0, None, 'accept'),
        ('output', 'filter', 'output', 0, None, 'accept'),
    ],
    'nat': [
        ('prerouting', 'nat', 'prerouting', -100, None, 'accept'),
        ('input', 'nat', 'input', 100, None, 'accept'),
        ('output', 'nat', 'output', -100, None, 'accept'),
        ('postrouting', 'nat', 'postrouting', 100, None, 'accept'),
    ],
    'raw': [
        ('prerouting', 'filter', 'prerouting', -300, None, 'accept'),
        ('output', 'filter', 'output', -300, None, 'accept'),
    ],
    'mangle': [
        ('prerouting', 'filter', 'prerouting', -150, None, 'accept'),
        ('input', 'filter', 'input', -150, None, 'accept'),
        ('forward', 'filter', 'forward', -150, None, 'accept'),
        ('output', 'filter', 'output', -150, None, 'accept'),
        ('postrouting', 'filter', 'postrouting', -150, None, 'accept'),
    ],
}
FIREWALL_RESERVED_PRIORITIES = {-300, -150, -100, 0, 100}
if os.path.isdir(bd_path):
    # Подключение к базе данных
    conn = sqlite3.connect(bd_path+"/"+"clients.db")
else:
    print('Directory does not exist')
    os.makedirs(bd_path, exist_ok=True)
    conn = sqlite3.connect(bd_path+"/"+"clients.db")



c = conn.cursor()

# Создание таблицы clients
c.execute('''CREATE TABLE IF NOT EXISTS clients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                pubkey TEXT NOT NULL,
                privkey TEXT NOT NULL,
                ip TEXT NOT NULL,
                wg_interface TEXT NOT NULL
            )''')

# Дополнительные per-client параметры конфигурации без изменения схемы clients
c.execute('''CREATE TABLE IF NOT EXISTS client_settings (
                client_id INTEGER PRIMARY KEY,
                allowed_ips TEXT NOT NULL DEFAULT '0.0.0.0/0'
            )''')

# Создание таблицы wg_interfaces
c.execute('''CREATE TABLE IF NOT EXISTS wg_interfaces (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                wg_interface TEXT NOT NULL,
                awg_version TEXT NOT NULL DEFAULT '1',
                port_number INTEGER NOT NULL,
                wg_ip_addr TEXT NOT NULL,
                wg_ip_cidr INTEGER NOT NULL,
                private_key TEXT NOT NULL,
                pubkey TEXT NOT NULL,
                srv_ip TEXT NOT NULL,
                srv_dns TEXT NOT NULL,
                Jc INTEGER,
                Jmin INTEGER,
                Jmax INTEGER,
                S1 INTEGER,
                S2 INTEGER,
                S3 INTEGER,
                S4 INTEGER,
                H1 TEXT,
                H2 TEXT,
                H3 TEXT,
                H4 TEXT,
                I1 TEXT,
                I2 TEXT,
                I3 TEXT,
                I4 TEXT,
                I5 TEXT
            )''')


def ensure_wg_interfaces_schema():
    expected_columns = {
        'Jc': 'INTEGER',
        'Jmin': 'INTEGER',
        'Jmax': 'INTEGER',
        'awg_version': "TEXT NOT NULL DEFAULT '1'",
        'S1': 'INTEGER',
        'S2': 'INTEGER',
        'S3': 'INTEGER',
        'S4': 'INTEGER',
        'H1': 'TEXT',
        'H2': 'TEXT',
        'H3': 'TEXT',
        'H4': 'TEXT',
        'I1': 'TEXT',
        'I2': 'TEXT',
        'I3': 'TEXT',
        'I4': 'TEXT',
        'I5': 'TEXT',
    }
    existing_columns = {
        row[1] for row in c.execute("PRAGMA table_info(wg_interfaces)").fetchall()
    }
    for column_name, column_type in expected_columns.items():
        if column_name not in existing_columns:
            c.execute(
                f'ALTER TABLE wg_interfaces ADD COLUMN {column_name} {column_type}'
            )

    # Enforce unique interface names for all new writes.
    try:
        c.execute(
            'CREATE UNIQUE INDEX IF NOT EXISTS idx_wg_interfaces_wg_interface_unique '
            'ON wg_interfaces(wg_interface)'
        )
    except sqlite3.IntegrityError:
        # Legacy DB may already contain duplicates; keep runtime working and
        # rely on service-level checks to block new duplicates.
        print('Warning: duplicate wg_interface names found, unique index was not created')


ensure_wg_interfaces_schema()

# Сохраняем изменения и закрываем подключение
conn.commit()


WG_INTERFACE_COLUMNS = (
    'id, wg_interface, awg_version, port_number, wg_ip_addr, wg_ip_cidr, private_key, pubkey, '
    'srv_ip, srv_dns, Jc, Jmin, Jmax, S1, S2, S3, S4, H1, H2, H3, H4, I1, I2, I3, I4, I5'
)


def parse_and_validate_interface_network(wg_ip_addr, wg_ip_cidr):
    try:
        cidr_int = int(str(wg_ip_cidr))
    except (TypeError, ValueError):
        raise ValueError('CIDR must be an integer')
    if cidr_int < 1 or cidr_int > 32:
        raise ValueError('CIDR must be in range 1..32')
    try:
        network = ipaddress.ip_network(f'{wg_ip_addr}/{cidr_int}', strict=False)
    except ValueError:
        raise ValueError('Invalid interface IP/CIDR')
    return cidr_int, str(network)


def parse_and_validate_port(port_number):
    try:
        port_int = int(str(port_number))
    except (TypeError, ValueError):
        raise ValueError('Port must be an integer')
    if port_int < 1 or port_int > 65535:
        raise ValueError('Port must be in range 1..65535')
    return port_int


def validate_ip_literal(value, field_name):
    try:
        ipaddress.ip_address(str(value))
    except ValueError:
        raise ValueError(f'Invalid {field_name}')


def assert_interface_uniqueness(wg_interface, port_number, network_cidr, exclude_id=None):
    if exclude_id is None:
        if c.execute('SELECT 1 FROM wg_interfaces WHERE wg_interface = ?', (wg_interface,)).fetchone() is not None:
            raise ValueError(f'Interface "{wg_interface}" already exists')
        if c.execute('SELECT 1 FROM wg_interfaces WHERE port_number = ?', (port_number,)).fetchone() is not None:
            raise ValueError(f'Port {port_number} is already used by another interface')
        rows = c.execute('SELECT wg_ip_addr, wg_ip_cidr FROM wg_interfaces').fetchall()
    else:
        if c.execute('SELECT 1 FROM wg_interfaces WHERE wg_interface = ? AND id != ?', (wg_interface, exclude_id)).fetchone() is not None:
            raise ValueError(f'Interface "{wg_interface}" already exists')
        if c.execute('SELECT 1 FROM wg_interfaces WHERE port_number = ? AND id != ?', (port_number, exclude_id)).fetchone() is not None:
            raise ValueError(f'Port {port_number} is already used by another interface')
        rows = c.execute('SELECT wg_ip_addr, wg_ip_cidr FROM wg_interfaces WHERE id != ?', (exclude_id,)).fetchall()

    for row_ip, row_cidr in rows:
        try:
            _, row_network = parse_and_validate_interface_network(row_ip, row_cidr)
        except ValueError:
            # Skip legacy invalid rows; they should be fixed separately.
            continue
        if row_network == network_cidr:
            raise ValueError(f'Subnet {network_cidr} is already used by another interface')


def validate_interface_name(wg_interface):
    # Linux interface name (IFNAMSIZ-1) is up to 15 chars.
    if len(wg_interface) > 15:
        raise ValueError('Interface name must be 15 characters or fewer')
    if not re.fullmatch(r'[A-Za-z0-9_.-]+', wg_interface):
        raise ValueError('Interface name contains unsupported characters')


def normalize_config_value(value):
    if value is None:
        return None
    if isinstance(value, bytes):
        value = value.decode('utf-8')
    value = str(value).strip()
    return value if value else None


def load_api_key():
    env_api_key = normalize_config_value(os.environ.get(API_KEY_ENV_VAR))
    if env_api_key is not None:
        return env_api_key
    if os.path.isfile(API_KEY_FILE):
        with open(API_KEY_FILE, 'r') as api_key_file:
            return normalize_config_value(api_key_file.read())
    return None


def save_api_key(api_key):
    normalized_api_key = normalize_config_value(api_key)
    if normalized_api_key is None:
        raise ValueError('API key is empty')
    with open(API_KEY_FILE, 'w') as api_key_file:
        api_key_file.write(normalized_api_key + '\n')
    os.chmod(API_KEY_FILE, 0o600)


def render_qr_in_terminal(content):
    qr_code = segno.make(content)
    qr_code.terminal(compact=True)


def build_qr_svg(content):
    qr_code = segno.make(content)
    output = io.BytesIO()
    qr_code.save(output, kind='svg', scale=4)
    return output.getvalue()


def verify_api_auth(api_key, provided_encryption_secret):
    saved_api_key = load_api_key()
    if saved_api_key is None:
        return False, 'API key is not configured'
    if normalize_config_value(api_key) != saved_api_key:
        return False, 'Invalid API key'
    return True, None


def rotate_api_key():
    # Returns the new API key (one-time disclosure to caller).
    import secrets
    new_key = secrets.token_hex(32)
    save_api_key(new_key)
    return new_key


def get_db_file_path():
    return os.path.join(bd_path, 'clients.db')


def read_database_bytes():
    with open(get_db_file_path(), 'rb') as db_file:
        return db_file.read()


def restore_database_from_bytes(raw_bytes):
    if not raw_bytes:
        raise ValueError('Backup payload is empty')
    if not isinstance(raw_bytes, (bytes, bytearray)):
        raise ValueError('Backup payload must be bytes')
    if len(raw_bytes) < 100:
        raise ValueError('Backup payload is too small')

    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False) as temp_db:
            temp_db.write(raw_bytes)
            temp_path = temp_db.name

        src_conn = sqlite3.connect(temp_path)
        src_cur = src_conn.cursor()
        src_clients = src_cur.execute('SELECT * FROM clients').fetchall()
        src_interfaces = src_cur.execute('SELECT * FROM wg_interfaces').fetchall()
        src_conn.close()

        c.execute('BEGIN IMMEDIATE')
        c.execute('DELETE FROM clients')
        c.execute('DELETE FROM wg_interfaces')

        if src_interfaces:
            placeholders = ','.join(['?'] * len(src_interfaces[0]))
            c.executemany(f'INSERT INTO wg_interfaces VALUES ({placeholders})', src_interfaces)
        if src_clients:
            placeholders = ','.join(['?'] * len(src_clients[0]))
            c.executemany(f'INSERT INTO clients VALUES ({placeholders})', src_clients)
        conn.commit()
    except sqlite3.Error as exc:
        conn.rollback()
        raise ValueError(f'Invalid backup database: {exc}')
    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)


def decode_base64_payload(payload):
    try:
        return base64.b64decode(payload, validate=True)
    except (ValueError, binascii.Error):
        raise ValueError('Invalid base64 backup payload')


def _read_firewall_rules_file():
    if not os.path.isfile(FIREWALL_RULES_FILE):
        return []
    try:
        with open(FIREWALL_RULES_FILE, 'r', encoding='utf-8') as f:
            payload = json.load(f)
    except (OSError, json.JSONDecodeError):
        return []
    if isinstance(payload, dict):
        payload = payload.get('rules', [])
    if not isinstance(payload, list):
        return []
    return payload


def _read_json_file(path, default):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            payload = json.load(f)
            return payload if isinstance(payload, type(default)) else default
    except Exception:
        return default


def _write_json_file(path, payload):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)


def _read_firewall_sets_file():
    data = _read_json_file(FIREWALL_SETS_FILE, {})
    return {
        'addr': data.get('addr', []),
        'port': data.get('port', []),
        'iface': data.get('iface', []),
    }


def _write_firewall_sets_file(data):
    _write_json_file(FIREWALL_SETS_FILE, data)


def _read_firewall_maps_file():
    data = _read_json_file(FIREWALL_MAPS_FILE, {})
    return {
        'map': data.get('map', []),
        'vmap': data.get('vmap', []),
    }


def _write_firewall_maps_file(data):
    _write_json_file(FIREWALL_MAPS_FILE, data)


def _read_firewall_tables_file():
    data = _read_json_file(FIREWALL_TABLES_FILE, {})
    rows = data.get('tables', [])
    if not isinstance(rows, list):
        rows = []
    out = []
    for row in rows:
        if isinstance(row, dict):
            out.append(row)
    return {'tables': out}


def _write_firewall_tables_file(data):
    _write_json_file(FIREWALL_TABLES_FILE, data)


def _read_managed_tables_file():
    data = _read_json_file(FIREWALL_MANAGED_TABLES_FILE, {})
    items = data.get('tables', [])
    out = []
    if isinstance(items, list):
        for x in items:
            v = normalize_config_value(x)
            if v is not None:
                out.append(str(v).lower())
    return {'tables': sorted(set(out))}


def _write_managed_tables_file(data):
    rows = data.get('tables', []) if isinstance(data, dict) else []
    clean = []
    if isinstance(rows, list):
        for x in rows:
            v = normalize_config_value(x)
            if v is not None:
                clean.append(str(v).lower())
    _write_json_file(FIREWALL_MANAGED_TABLES_FILE, {'tables': sorted(set(clean))})


def _list_inet_tables_runtime():
    res = subprocess.run(
        ['nft', 'list', 'tables'],
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    if res.returncode != 0:
        return []
    out = []
    for line in (res.stdout or '').splitlines():
        line = line.strip()
        if line.startswith('table inet '):
            name = line.split('table inet ', 1)[1].strip()
            if name:
                out.append(name)
    return sorted(set(out))


def _read_firewall_stats_file():
    data = _read_json_file(FIREWALL_STATS_FILE, {})
    return data if isinstance(data, dict) else {}


def _write_firewall_stats_file(data):
    _write_json_file(FIREWALL_STATS_FILE, data)


def _write_firewall_rules_file(rules):
    os.makedirs(os.path.dirname(FIREWALL_RULES_FILE), exist_ok=True)
    with open(FIREWALL_RULES_FILE, 'w', encoding='utf-8') as f:
        json.dump({'rules': rules}, f, ensure_ascii=False, indent=2)


def _normalize_firewall_rule(payload):
    if not isinstance(payload, dict):
        raise ValueError('Rule payload must be an object')

    family = normalize_config_value(payload.get('family')) or 'inet'
    nft_table = (normalize_config_value(payload.get('table')) or 'filter').lower()
    chain = (normalize_config_value(payload.get('chain')) or '').lower()
    action = (normalize_config_value(payload.get('action')) or '').lower()
    proto = normalize_config_value(payload.get('proto'))
    src = normalize_config_value(payload.get('src'))
    dst = normalize_config_value(payload.get('dst'))
    in_interface = normalize_config_value(payload.get('in_interface'))
    out_interface = normalize_config_value(payload.get('out_interface'))
    dport = normalize_config_value(payload.get('dport'))
    sport = normalize_config_value(payload.get('sport'))
    comment = normalize_config_value(payload.get('comment'))
    ct_state = normalize_config_value(payload.get('ct_state'))
    nat_type = normalize_config_value(payload.get('nat_type'))
    target_chain = normalize_config_value(payload.get('target_chain'))
    reject_type = normalize_config_value(payload.get('reject_type'))
    to_addr = normalize_config_value(payload.get('to_addr'))
    to_port = normalize_config_value(payload.get('to_port'))
    notrack = payload.get('notrack', False)
    mark_set = normalize_config_value(payload.get('mark_set'))
    ct_mark_set = normalize_config_value(payload.get('ct_mark_set'))
    log_prefix = normalize_config_value(payload.get('log_prefix'))
    log_level = normalize_config_value(payload.get('log_level'))
    fib_expr = normalize_config_value(payload.get('fib_expr'))
    socket_expr = normalize_config_value(payload.get('socket_expr'))
    rt_expr = normalize_config_value(payload.get('rt_expr'))
    exthdr_expr = normalize_config_value(payload.get('exthdr_expr'))
    ct_helper_set = normalize_config_value(payload.get('ct_helper_set'))
    ct_timeout_set = normalize_config_value(payload.get('ct_timeout_set'))
    ct_expectation_set = normalize_config_value(payload.get('ct_expectation_set'))
    nat_random = payload.get('nat_random', False)
    nat_fully_random = payload.get('nat_fully_random', False)
    nat_persistent = payload.get('nat_persistent', False)
    limit_rate = normalize_config_value(payload.get('limit_rate'))
    counter = payload.get('counter', False)
    enabled = payload.get('enabled', True)

    if family != FIREWALL_TABLE_FAMILY:
        raise ValueError(f'family must be {FIREWALL_TABLE_FAMILY}')
    if nft_table not in ('filter', 'nat', 'raw', 'mangle'):
        raise ValueError('table must be one of: filter, nat, raw, mangle')
    allowed_chains_by_table = {
        table: tuple(config['chains'])
        for table, config in FIREWALL_SCHEMA['tables'].items()
    }
    if chain not in allowed_chains_by_table[nft_table]:
        raise ValueError(f'chain "{chain}" is not valid for table "{nft_table}"')
    if action not in ('accept', 'drop', 'reject', 'jump', 'goto', 'return'):
        raise ValueError('action must be one of: accept, drop, reject, jump, goto, return')
    if nft_table != 'filter' and action in ('jump', 'goto', 'return'):
        raise ValueError('jump/goto/return are currently supported only in filter table')
    if action in ('jump', 'goto'):
        if target_chain is None:
            raise ValueError('target_chain is required for jump/goto')
        if not re.fullmatch(r'[A-Za-z0-9_.-]+', str(target_chain)):
            raise ValueError('target_chain contains invalid characters')
        if str(target_chain).lower() in ('input', 'forward', 'output'):
            raise ValueError('target_chain must be a user-defined chain, not base hook chain')
    elif target_chain is not None:
        raise ValueError('target_chain is only valid for jump/goto')
    if reject_type is not None:
        if action != 'reject':
            raise ValueError('reject_type is only valid when action=reject')
        allowed_reject = {
            'icmpx port-unreachable',
            'icmpx admin-prohibited',
            'icmp type host-unreachable',
            'tcp reset',
        }
        if str(reject_type) not in allowed_reject:
            raise ValueError('reject_type must be one of: icmpx port-unreachable | icmpx admin-prohibited | icmp type host-unreachable | tcp reset')
    if proto is not None:
        proto = str(proto).lower()
        if proto not in ('tcp', 'udp', 'icmp', 'icmpv6'):
            raise ValueError('proto must be one of: tcp, udp, icmp, icmpv6')
    if dport is not None and proto not in ('tcp', 'udp'):
        raise ValueError('dport requires proto tcp or udp')
    if sport is not None and proto not in ('tcp', 'udp'):
        raise ValueError('sport requires proto tcp or udp')
    def _parse_port_or_range(raw, field_name):
        if not re.fullmatch(r'[0-9]{1,5}(:[0-9]{1,5})?', str(raw)):
            raise ValueError(f'{field_name} must be like 80 or 1000:2000')
        if ':' in str(raw):
            left, right = str(raw).split(':', 1)
            p1, p2 = int(left), int(right)
            if p1 < 1 or p2 < 1 or p1 > 65535 or p2 > 65535 or p1 > p2:
                raise ValueError(f'{field_name} range must be within 1..65535 and start <= end')
        else:
            p = int(str(raw))
            if p < 1 or p > 65535:
                raise ValueError(f'{field_name} must be in range 1..65535')
    if dport is not None:
        _parse_port_or_range(dport, 'dport')
    if sport is not None:
        _parse_port_or_range(sport, 'sport')
    if src is not None:
        ipaddress.ip_network(str(src), strict=False)
    if dst is not None:
        ipaddress.ip_network(str(dst), strict=False)
    if in_interface is not None and not re.fullmatch(r'[A-Za-z0-9_.:-]+', str(in_interface)):
        raise ValueError('in_interface contains invalid characters')
    if out_interface is not None and not re.fullmatch(r'[A-Za-z0-9_.:-]+', str(out_interface)):
        raise ValueError('out_interface contains invalid characters')
    if not isinstance(enabled, bool):
        enabled = str(enabled).lower() in ('1', 'true', 'yes', 'on')
    if ct_state is not None:
        ct_state = str(ct_state).lower().replace(' ', '')
        if ct_state not in FIREWALL_SCHEMA['ct_states']:
            raise ValueError('ct_state must be one of: established,related | new | invalid | related | established | untracked')
    if comment is not None:
        comment = str(comment).replace('"', "'")
    if nat_type is not None:
        nat_type = str(nat_type).lower()
        if nat_type not in ('masquerade', 'snat', 'dnat', 'redirect'):
            raise ValueError('nat_type must be one of: masquerade, snat, dnat, redirect')
    if nft_table != 'nat' and nat_type is not None:
        raise ValueError('nat_type is only valid for nat table')
    if nat_type is not None:
        allowed_nat_types = FIREWALL_SCHEMA['tables']['nat']['nat_types_by_chain'].get(chain, [])
        if nat_type not in allowed_nat_types:
            raise ValueError(f'{nat_type} is not valid in {chain} chain for nat table')
    if not isinstance(nat_random, bool):
        nat_random = str(nat_random).lower() in ('1', 'true', 'yes', 'on')
    if not isinstance(nat_fully_random, bool):
        nat_fully_random = str(nat_fully_random).lower() in ('1', 'true', 'yes', 'on')
    if not isinstance(nat_persistent, bool):
        nat_persistent = str(nat_persistent).lower() in ('1', 'true', 'yes', 'on')
    if nft_table != 'nat' and (nat_random or nat_fully_random or nat_persistent):
        raise ValueError('nat flags are only valid for nat table')
    if nat_fully_random and nat_type not in ('snat', 'dnat', 'masquerade', 'redirect'):
        raise ValueError('nat_fully_random requires a nat_type statement')
    if nat_random and nat_type not in ('snat', 'dnat', 'masquerade', 'redirect'):
        raise ValueError('nat_random requires a nat_type statement')
    if nat_persistent and nat_type not in ('snat', 'dnat', 'masquerade', 'redirect'):
        raise ValueError('nat_persistent requires a nat_type statement')
    if to_addr is not None:
        try:
            ipaddress.ip_address(str(to_addr))
        except ValueError:
            raise ValueError('to_addr must be a valid IP address')
    if to_port is not None and not re.fullmatch(r'[0-9]{1,5}(-[0-9]{1,5})?', str(to_port)):
        raise ValueError('to_port must be like 53 or 1000-2000')
    if to_addr is not None and nat_type not in ('snat', 'dnat'):
        raise ValueError('to_addr is only valid for snat/dnat')
    if to_port is not None and nat_type not in ('snat', 'dnat', 'masquerade', 'redirect'):
        raise ValueError('to_port is only valid for nat statements')
    if not isinstance(notrack, bool):
        notrack = str(notrack).lower() in ('1', 'true', 'yes', 'on')
    if notrack and nft_table != 'raw':
        raise ValueError('notrack is only valid for raw table')
    if mark_set is not None and not re.fullmatch(r'0x[0-9a-fA-F]+|[0-9]+', str(mark_set)):
        raise ValueError('mark_set must be integer or hex (e.g. 10 or 0x1)')
    if ct_mark_set is not None and not re.fullmatch(r'0x[0-9a-fA-F]+|[0-9]+', str(ct_mark_set)):
        raise ValueError('ct_mark_set must be integer or hex (e.g. 10 or 0x1)')
    if log_level is not None:
        log_level = str(log_level).lower()
        if log_level not in ('emerg', 'alert', 'crit', 'err', 'warn', 'notice', 'info', 'debug'):
            raise ValueError('log_level must be one of emerg, alert, crit, err, warn, notice, info, debug')
    if log_prefix is not None:
        log_prefix = str(log_prefix).replace('"', "'")
    if limit_rate is not None:
        if not re.fullmatch(r'[0-9]+/(second|minute|hour|day)', str(limit_rate).lower()):
            raise ValueError('limit_rate must be like 10/second or 200/minute')
        limit_rate = str(limit_rate).lower()
    if not isinstance(counter, bool):
        counter = str(counter).lower() in ('1', 'true', 'yes', 'on')
    for fld, val in (
        ('fib_expr', fib_expr),
        ('socket_expr', socket_expr),
        ('rt_expr', rt_expr),
        ('exthdr_expr', exthdr_expr),
    ):
        if val is not None:
            if len(str(val)) > 160:
                raise ValueError(f'{fld} is too long')
            if not re.fullmatch(r'[A-Za-z0-9_ .:/,!=<>\-]+', str(val)):
                raise ValueError(f'{fld} contains invalid characters')
    for fld, val in (
        ('ct_helper_set', ct_helper_set),
        ('ct_timeout_set', ct_timeout_set),
        ('ct_expectation_set', ct_expectation_set),
    ):
        if val is not None and not re.fullmatch(r'[A-Za-z0-9_.-]+', str(val)):
            raise ValueError(f'{fld} contains invalid characters')
    if ct_helper_set is not None or ct_timeout_set is not None or ct_expectation_set is not None:
        raise ValueError('ct_helper_set/ct_timeout_set/ct_expectation_set require nft stateful ct objects and are not enabled yet')

    return {
        'id': str(payload.get('id') or uuid.uuid4().hex),
        'table': nft_table,
        'family': family,
        'chain': chain,
        'action': action,
        'proto': proto,
        'src': src,
        'dst': dst,
        'in_interface': in_interface,
        'out_interface': out_interface,
        'sport': str(sport) if sport is not None else None,
        'dport': str(dport) if dport is not None else None,
        'comment': comment,
        'ct_state': ct_state,
        'nat_type': nat_type,
        'target_chain': target_chain,
        'reject_type': reject_type,
        'to_addr': to_addr,
        'to_port': str(to_port) if to_port is not None else None,
        'nat_random': nat_random,
        'nat_fully_random': nat_fully_random,
        'nat_persistent': nat_persistent,
        'notrack': notrack,
        'mark_set': str(mark_set) if mark_set is not None else None,
        'ct_mark_set': str(ct_mark_set) if ct_mark_set is not None else None,
        'log_prefix': log_prefix,
        'log_level': log_level,
        'fib_expr': fib_expr,
        'socket_expr': socket_expr,
        'rt_expr': rt_expr,
        'exthdr_expr': exthdr_expr,
        'ct_helper_set': ct_helper_set,
        'ct_timeout_set': ct_timeout_set,
        'ct_expectation_set': ct_expectation_set,
        'limit_rate': limit_rate,
        'counter': counter,
        'enabled': enabled,
    }


def _render_firewall_rule(rule):
    def _render_port_value(raw):
        value = str(raw)
        if ':' in value:
            return value.replace(':', '-')
        return value

    parts = []
    if rule['in_interface']:
        parts.append(f'iifname "{rule["in_interface"]}"')
    if rule['out_interface']:
        parts.append(f'oifname "{rule["out_interface"]}"')
    if rule['src']:
        prefix = 'ip6' if ':' in str(rule['src']) else 'ip'
        parts.append(f'{prefix} saddr {rule["src"]}')
    if rule['dst']:
        prefix = 'ip6' if ':' in str(rule['dst']) else 'ip'
        parts.append(f'{prefix} daddr {rule["dst"]}')
    if rule['proto']:
        parts.append(f'meta l4proto {rule["proto"]}')
    if rule.get('ct_state'):
        parts.append(f'ct state {rule["ct_state"]}')
    if rule['sport']:
        parts.append(f'{rule["proto"]} sport {_render_port_value(rule["sport"])}')
    if rule['dport']:
        parts.append(f'{rule["proto"]} dport {_render_port_value(rule["dport"])}')
    if rule.get('limit_rate'):
        parts.append(f'limit rate {rule["limit_rate"]}')
    if rule.get('fib_expr'):
        parts.append(str(rule['fib_expr']))
    if rule.get('socket_expr'):
        parts.append(str(rule['socket_expr']))
    if rule.get('rt_expr'):
        parts.append(str(rule['rt_expr']))
    if rule.get('exthdr_expr'):
        parts.append(str(rule['exthdr_expr']))
    if rule.get('log_prefix') or rule.get('log_level'):
        log_parts = ['log']
        if rule.get('log_prefix'):
            log_parts.append(f'prefix "{rule["log_prefix"]}"')
        if rule.get('log_level'):
            log_parts.append(f'level {rule["log_level"]}')
        parts.append(' '.join(log_parts))
    if rule.get('counter'):
        parts.append('counter')
    if rule.get('notrack'):
        parts.append('notrack')
    if rule.get('mark_set'):
        parts.append(f'meta mark set {rule["mark_set"]}')
    if rule.get('ct_mark_set'):
        parts.append(f'ct mark set {rule["ct_mark_set"]}')
    if rule.get('ct_helper_set'):
        parts.append(f'ct helper set "{rule["ct_helper_set"]}"')
    if rule.get('ct_timeout_set'):
        parts.append(f'ct timeout set "{rule["ct_timeout_set"]}"')
    if rule.get('ct_expectation_set'):
        parts.append(f'ct expectation set "{rule["ct_expectation_set"]}"')
    nat_type = rule.get('nat_type')
    if nat_type:
        nat_stmt = nat_type
        if nat_type in ('snat', 'dnat') and rule.get('to_addr'):
            to_addr = str(rule['to_addr'])
            family_prefix = 'ip6' if ':' in to_addr else 'ip'
            nat_stmt += f' {family_prefix} to {to_addr}'
            if rule.get('to_port'):
                nat_stmt += f':{rule["to_port"]}'
        elif nat_type in ('masquerade', 'redirect') and rule.get('to_port'):
            nat_stmt += f' to :{rule["to_port"]}'
        nat_flags = []
        if rule.get('nat_random'):
            nat_flags.append('random')
        if rule.get('nat_fully_random'):
            nat_flags.append('fully-random')
        if rule.get('nat_persistent'):
            nat_flags.append('persistent')
        if nat_flags:
            nat_stmt += ' ' + ','.join(nat_flags)
        parts.append(nat_stmt)
    else:
        action = rule['action']
        if action in ('jump', 'goto'):
            parts.append(f'{action} {rule.get("target_chain")}')
        elif action == 'reject' and rule.get('reject_type'):
            parts.append(f'reject with {rule["reject_type"]}')
        else:
            parts.append(action)
    if rule['comment']:
        parts.append(f'comment "{rule["comment"]}"')
    return ' '.join(parts)


def _infer_map_token_type(token):
    t = str(token or '').strip()
    if not t:
        return 'ifname'
    if t.lower() in ('established', 'related', 'new', 'invalid', 'untracked'):
        return 'ct_state'
    if t.lower() in (
        'echo-reply', 'destination-unreachable', 'source-quench', 'redirect', 'echo-request',
        'router-advertisement', 'router-solicitation', 'time-exceeded', 'parameter-problem',
        'timestamp-request', 'timestamp-reply', 'address-mask-request', 'address-mask-reply',
    ):
        return 'icmp_type'
    if t.lower() in ('accept', 'drop', 'queue', 'continue', 'return'):
        return 'verdict'
    try:
        ipaddress.ip_address(t)
        return 'ipv4_addr' if '.' in t else 'ipv6_addr'
    except Exception:
        pass
    try:
        ipaddress.ip_network(t, strict=False)
        return 'ipv4_addr' if '.' in t else 'ipv6_addr'
    except Exception:
        pass
    if re.fullmatch(r'\d{1,5}', t):
        return 'inet_service'
    if re.fullmatch(r'0x[0-9a-fA-F]+|\d+', t):
        return 'mark'
    return 'ifname'


def _format_map_token(token, token_type):
    t = str(token or '').strip()
    if token_type == 'ifname':
        return f'"{t}"'
    return t


def _build_map_declaration_and_elements(item):
    entries = [x for x in (item.get('entries') or []) if x and ':' in str(x)]
    if not entries:
        return None
    pairs = []
    for entry in entries:
        key, value = str(entry).split(':', 1)
        key = key.strip()
        value = value.strip()
        if not key or not value:
            continue
        pairs.append((key, value))
    if not pairs:
        return None
    key_type = _infer_map_token_type(pairs[0][0])
    value_type = 'verdict' if item.get('kind') == 'vmap' else _infer_map_token_type(pairs[0][1])
    has_prefix = any('/' in key for key, _ in pairs)
    flags_clause = ' flags interval;' if has_prefix and key_type in ('ipv4_addr', 'ipv6_addr') else ''
    decl_stmt = f'type {key_type} : {value_type};{flags_clause}'
    elems = []
    for key, value in pairs:
        elems.append(f'{_format_map_token(key, key_type)} : {_format_map_token(value, value_type)}')
    return decl_stmt, elems


def list_firewall_rules_service():
    raw_rules = _read_firewall_rules_file()
    normalized = []
    for payload in raw_rules:
        try:
            normalized.append(_normalize_firewall_rule(payload))
        except Exception:
            continue
    return normalized


def apply_firewall_rules():
    rules = list_firewall_rules_service()
    sets_data = _read_firewall_sets_file()
    maps_data = _read_firewall_maps_file()
    table_defs = dict(FIREWALL_DEFAULT_TABLE_DEFS)
    custom_tables = _read_firewall_tables_file().get('tables', [])
    for row in custom_tables:
        table_name = normalize_config_value(row.get('table_name'))
        chain_name = normalize_config_value(row.get('chain_name'))
        chain_type = normalize_config_value(row.get('chain_type'))
        hook_name = normalize_config_value(row.get('hook'))
        policy = normalize_config_value(row.get('policy')) or 'accept'
        if table_name is None or chain_name is None or chain_type is None or hook_name is None:
            continue
        try:
            priority = int(row.get('priority'))
        except Exception:
            continue
        dev = normalize_config_value(row.get('device'))
        table_key = str(table_name).strip().lower()
        table_defs.setdefault(table_key, [])
        table_defs[table_key].append((str(chain_name), str(chain_type), str(hook_name), priority, (str(dev) if dev else None), str(policy)))
    active_table_names = {str(name).lower() for name in table_defs.keys()}
    managed = _read_managed_tables_file().get('tables', [])
    stale_managed = [t for t in managed if t not in active_table_names]
    for stale in stale_managed:
        subprocess.run(
            ['nft', 'delete', 'table', FIREWALL_TABLE_FAMILY, str(stale)],
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    # Also prune any runtime inet table that is outside the active manager set.
    # This prevents orphaned custom tables from surviving after JSON state cleanup.
    runtime_tables = _list_inet_tables_runtime()
    for runtime_name in runtime_tables:
        if runtime_name.lower() not in active_table_names:
            subprocess.run(
                ['nft', 'delete', 'table', FIREWALL_TABLE_FAMILY, str(runtime_name)],
                check=False,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
    script_lines = []
    for nft_table in table_defs.keys():
        table_name = f'{FIREWALL_TABLE_PREFIX}{nft_table}'
        # Best-effort delete to avoid "already exists" and missing table conflicts.
        subprocess.run(
            ['nft', 'delete', 'table', FIREWALL_TABLE_FAMILY, table_name],
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        script_lines.append(f'add table {FIREWALL_TABLE_FAMILY} {table_name}')
        for chain_info in table_defs[nft_table]:
            if len(chain_info) == 4:
                chain_name, chain_type, hook_name, priority = chain_info
                device = None
                policy = 'accept'
            else:
                chain_name, chain_type, hook_name, priority, device, policy = chain_info
            dev_clause = f' device "{device}"' if device else ''
            script_lines.append(
                f'add chain {FIREWALL_TABLE_FAMILY} {table_name} {chain_name} '
                f'{{ type {chain_type} hook {hook_name}{dev_clause} priority {priority}; policy {policy}; }}'
            )
        # create shared sets in each table to allow matching from any chain/table
        for item in sets_data.get('addr', []):
            if item.get('name') and item.get('enabled', True):
                elems = [x for x in (item.get('elements') or []) if x]
                flags_clause = ' flags interval;' if any('/' in str(x) for x in elems) else ''
                script_lines.append(f'add set {FIREWALL_TABLE_FAMILY} {table_name} {item["name"]} {{ type ipv4_addr;{flags_clause} }}')
                if elems:
                    script_lines.append(f'add element {FIREWALL_TABLE_FAMILY} {table_name} {item["name"]} {{ {", ".join(elems)} }}')
        for item in sets_data.get('port', []):
            if item.get('name') and item.get('enabled', True):
                script_lines.append(f'add set {FIREWALL_TABLE_FAMILY} {table_name} {item["name"]} {{ type inet_service; }}')
                elems = [x for x in (item.get('elements') or []) if x]
                if elems:
                    script_lines.append(f'add element {FIREWALL_TABLE_FAMILY} {table_name} {item["name"]} {{ {", ".join(elems)} }}')
        for item in sets_data.get('iface', []):
            if item.get('name') and item.get('enabled', True):
                script_lines.append(f'add set {FIREWALL_TABLE_FAMILY} {table_name} {item["name"]} {{ type ifname; }}')
                elems = [f'"{x}"' for x in (item.get('elements') or []) if x]
                if elems:
                    script_lines.append(f'add element {FIREWALL_TABLE_FAMILY} {table_name} {item["name"]} {{ {", ".join(elems)} }}')
        # create shared maps and vmaps in each table
        for item in maps_data.get('map', []):
            if item.get('name') and item.get('enabled', True):
                built = _build_map_declaration_and_elements(item)
                if not built:
                    continue
                decl_stmt, elems = built
                script_lines.append(f'add map {FIREWALL_TABLE_FAMILY} {table_name} {item["name"]} {{ {decl_stmt} }}')
                script_lines.append(f'add element {FIREWALL_TABLE_FAMILY} {table_name} {item["name"]} {{ {", ".join(elems)} }}')
        for item in maps_data.get('vmap', []):
            if item.get('name') and item.get('enabled', True):
                built = _build_map_declaration_and_elements(item)
                if not built:
                    continue
                decl_stmt, elems = built
                script_lines.append(f'add map {FIREWALL_TABLE_FAMILY} {table_name} {item["name"]} {{ {decl_stmt} }}')
                script_lines.append(f'add element {FIREWALL_TABLE_FAMILY} {table_name} {item["name"]} {{ {", ".join(elems)} }}')
    for rule in rules:
        if not rule.get('enabled', True):
            continue
        rendered = _render_firewall_rule(rule)
        table_name = f'{FIREWALL_TABLE_PREFIX}{rule["table"]}'
        script_lines.append(
            f'add rule {FIREWALL_TABLE_FAMILY} {table_name} {rule["chain"]} {rendered}'
        )
    script_text = '\n'.join(script_lines) + '\n'
    subprocess.run(['nft', '-f', '-'], input=script_text.encode('utf-8'), check=True)
    return True


def create_firewall_rule_service(payload, apply_now=True):
    rules = list_firewall_rules_service()
    rule = _normalize_firewall_rule(payload)
    # Idempotency guard for concurrent duplicate creates from UI/API retries.
    # Keep one logical rule for the same effective payload.
    identity_keys = (
        'table', 'family', 'chain', 'action', 'proto', 'src', 'dst',
        'in_interface', 'out_interface', 'sport', 'dport', 'comment', 'ct_state',
        'nat_type', 'target_chain', 'reject_type', 'to_addr', 'to_port',
        'nat_random', 'nat_fully_random', 'nat_persistent', 'notrack',
        'mark_set', 'ct_mark_set', 'log_prefix', 'log_level',
        'fib_expr', 'socket_expr', 'rt_expr', 'exthdr_expr',
        'ct_helper_set', 'ct_timeout_set', 'ct_expectation_set',
        'limit_rate', 'counter', 'enabled',
    )
    for existing in rules:
        if all(existing.get(k) == rule.get(k) for k in identity_keys):
            if apply_now:
                apply_firewall_rules()
            return existing
    out = list(rules)
    out.append(rule)
    _write_firewall_rules_file(out)
    try:
        if apply_now:
            apply_firewall_rules()
    except Exception:
        # Rollback persisted state if runtime apply fails.
        _write_firewall_rules_file(rules)
        raise
    return rule


def update_firewall_rule_service(rule_id, payload, apply_now=True):
    rules = list_firewall_rules_service()
    existing = next((r for r in rules if r['id'] == str(rule_id)), None)
    if existing is None:
        raise LookupError('Firewall rule not found')
    merged = {**existing, **(payload or {})}
    merged['id'] = existing['id']
    updated = _normalize_firewall_rule(merged)
    out = [updated if r['id'] == existing['id'] else r for r in rules]
    _write_firewall_rules_file(out)
    try:
        if apply_now:
            apply_firewall_rules()
    except Exception:
        _write_firewall_rules_file(rules)
        raise
    return updated


def delete_firewall_rule_service(rule_id, apply_now=True):
    rules = list_firewall_rules_service()
    existing = next((r for r in rules if r['id'] == str(rule_id)), None)
    if existing is None:
        raise LookupError('Firewall rule not found')
    out = [r for r in rules if r['id'] != str(rule_id)]
    _write_firewall_rules_file(out)
    try:
        if apply_now:
            apply_firewall_rules()
    except Exception:
        _write_firewall_rules_file(rules)
        raise
    return existing


def reorder_firewall_rules_service(table, ordered_ids, apply_now=True):
    nft_table = normalize_config_value(table)
    if nft_table is None:
        raise ValueError('table is required')
    nft_table = nft_table.lower()
    if nft_table not in ('filter', 'nat', 'raw', 'mangle'):
        raise ValueError('table must be one of: filter, nat, raw, mangle')
    if not isinstance(ordered_ids, list) or not all(isinstance(x, str) and x.strip() for x in ordered_ids):
        raise ValueError('ordered_ids must be a non-empty list of rule ids')

    rules = list_firewall_rules_service()
    table_rules = [r for r in rules if r.get('table') == nft_table]
    table_ids = [r['id'] for r in table_rules]
    incoming_ids = [x.strip() for x in ordered_ids]
    if sorted(table_ids) != sorted(incoming_ids):
        raise ValueError('ordered_ids must contain exactly all ids from selected table')

    by_id = {r['id']: r for r in table_rules}
    reordered_table_rules = [by_id[rid] for rid in incoming_ids]
    out = []
    inserted = False
    for rule in rules:
        if rule.get('table') == nft_table:
            if not inserted:
                out.extend(reordered_table_rules)
                inserted = True
            continue
        out.append(rule)
    if not inserted:
        out.extend(reordered_table_rules)

    _write_firewall_rules_file(out)
    if apply_now:
        apply_firewall_rules()
    return reordered_table_rules


def reset_firewall_counters_service(table=None):
    tables = ('filter', 'nat', 'raw', 'mangle')
    if table is None:
        target_tables = tables
    else:
        nft_table = normalize_config_value(table)
        if nft_table is None:
            raise ValueError('table is empty')
        nft_table = nft_table.lower()
        if nft_table not in tables:
            raise ValueError('table must be one of: filter, nat, raw, mangle')
        target_tables = (nft_table,)

    reset_count = 0
    for nft_table in target_tables:
        table_name = f'{FIREWALL_TABLE_PREFIX}{nft_table}'
        try:
            subprocess.run(
                ['nft', 'reset', 'counters', 'table', FIREWALL_TABLE_FAMILY, table_name],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            reset_count += 1
        except Exception:
            # Skip missing tables; state can be recreated by apply call.
            continue
    return {'ok': True, 'tables_reset': reset_count}


def get_firewall_state_service():
    rules = list_firewall_rules_service()
    runtime_counters = {}
    ruleset_text = ''
    active = False
    try:
        txt_res = subprocess.run(
            ['nft', 'list', 'ruleset'],
            check=True,
            capture_output=True,
            text=True
        )
        ruleset_text = txt_res.stdout
    except Exception:
        ruleset_text = ''
    try:
        json_res = subprocess.run(
            ['nft', '-j', 'list', 'ruleset'],
            check=True,
            capture_output=True,
            text=True
        )
        nft_json = json.loads(json_res.stdout)
        rules_by_table_chain = {}
        for item in nft_json.get('nftables', []):
            rule_payload = item.get('rule')
            if not rule_payload:
                continue
            table_name = str(rule_payload.get('table') or '')
            if not table_name.startswith(FIREWALL_TABLE_PREFIX):
                continue
            chain_name = rule_payload.get('chain')
            if chain_name is None:
                continue
            nft_table = table_name.replace(FIREWALL_TABLE_PREFIX, '', 1)
            expr = rule_payload.get('expr', [])
            counter_item = next((x.get('counter') for x in expr if isinstance(x, dict) and 'counter' in x), None)
            rules_by_table_chain.setdefault((nft_table, chain_name), []).append({
                'packets': int(counter_item.get('packets', 0)) if counter_item else 0,
                'bytes': int(counter_item.get('bytes', 0)) if counter_item else 0,
            })
            active = True

        chain_runtime_index = {}
        for rule in rules:
            if not rule.get('enabled', True):
                continue
            nft_table = rule.get('table')
            chain_name = rule.get('chain')
            key = (nft_table, chain_name)
            idx = chain_runtime_index.get(key, 0)
            counter_list = rules_by_table_chain.get(key, [])
            if idx < len(counter_list):
                runtime_counters[rule['id']] = counter_list[idx]
            chain_runtime_index[key] = idx + 1
    except Exception:
        pass
    enriched_rules = []
    stats_store = _read_firewall_stats_file()
    now_ts = int(time.time())
    for rule in rules:
        payload = dict(rule)
        counter = runtime_counters.get(rule['id'])
        packets = counter.get('packets') if counter else 0
        bytes_count = counter.get('bytes') if counter else 0
        payload['runtime_packets'] = packets
        payload['runtime_bytes'] = bytes_count

        stat_row = stats_store.get(rule['id']) if isinstance(stats_store.get(rule['id']), dict) else {}
        last = stat_row.get('last') if isinstance(stat_row, dict) else None
        prev_packets = int(last.get('packets', packets)) if isinstance(last, dict) else packets
        prev_bytes = int(last.get('bytes', bytes_count)) if isinstance(last, dict) else bytes_count
        prev_t = int(last.get('t', now_ts)) if isinstance(last, dict) else now_ts
        dt = max(1, now_ts - prev_t)
        dpk = max(0, int(packets) - prev_packets)
        dby = max(0, int(bytes_count) - prev_bytes)
        pps = dpk / dt
        bps = dby / dt
        payload['runtime_pps'] = pps
        payload['runtime_bps'] = bps

        history = stat_row.get('history', []) if isinstance(stat_row, dict) else []
        if not isinstance(history, list):
            history = []
        history.append({'t': now_ts, 'pps': pps, 'bps': bps, 'packets': packets, 'bytes': bytes_count})
        history = history[-120:]
        payload['runtime_history'] = history
        stats_store[rule['id']] = {'last': {'t': now_ts, 'packets': packets, 'bytes': bytes_count}, 'history': history}
        enriched_rules.append(payload)
    _write_firewall_stats_file(stats_store)
    return {
        'active': active,
        'rules': enriched_rules,
        'ruleset': ruleset_text,
        'family': FIREWALL_TABLE_FAMILY,
        'tables': ['filter', 'nat', 'raw', 'mangle'],
    }


def _normalize_set_item(payload, set_kind):
    if not isinstance(payload, dict):
        raise ValueError('set payload must be object')
    name = normalize_config_value(payload.get('name'))
    if name is None or not re.fullmatch(r'[A-Za-z0-9_.-]+', str(name)):
        raise ValueError('set name is invalid')
    elems = payload.get('elements') or []
    if not isinstance(elems, list):
        raise ValueError('elements must be array')
    enabled = payload.get('enabled', True)
    if not isinstance(enabled, bool):
        enabled = str(enabled).lower() in ('1', 'true', 'yes', 'on')
    comment = normalize_config_value(payload.get('comment'))
    if comment is not None:
        comment = str(comment).replace('"', "'")
    out = []
    for raw in elems:
        val = normalize_config_value(raw)
        if val is None:
            continue
        s = str(val).strip()
        if set_kind == 'addr':
            ipaddress.ip_network(s, strict=False)
        elif set_kind == 'port':
            if not re.fullmatch(r'[0-9]{1,5}', s):
                raise ValueError('port element must be integer')
            p = int(s)
            if p < 1 or p > 65535:
                raise ValueError('port element must be 1..65535')
        elif set_kind == 'iface':
            if not re.fullmatch(r'[A-Za-z0-9_.:-]+', s):
                raise ValueError('iface element contains invalid characters')
        out.append(s)
    return {'id': str(payload.get('id') or uuid.uuid4().hex), 'name': str(name), 'elements': sorted(set(out)), 'enabled': enabled, 'comment': comment}


def list_firewall_sets_service():
    return _read_firewall_sets_file()


def upsert_firewall_set_service(set_kind, payload):
    if set_kind not in ('addr', 'port', 'iface'):
        raise ValueError('set kind must be addr|port|iface')
    data = _read_firewall_sets_file()
    item = _normalize_set_item(payload, set_kind)
    out = []
    replaced = False
    for row in data[set_kind]:
        if row.get('id') == item['id']:
            out.append(item)
            replaced = True
        else:
            out.append(row)
    if not replaced:
        out.append(item)
    # Keep a single logical namespace for set names across addr/port/iface.
    existing_other_names = []
    for kind in ('addr', 'port', 'iface'):
        if kind == set_kind:
            continue
        existing_other_names.extend([str(x.get('name') or '') for x in data.get(kind, [])])
    names = [x['name'] for x in out]
    if len(names) != len(set(names)):
        raise ValueError('set names must be unique within tab')
    if item['name'] in existing_other_names:
        raise ValueError('set name must be globally unique across addr/port/iface')
    data[set_kind] = out
    _write_firewall_sets_file(data)
    apply_firewall_rules()
    return item


def delete_firewall_set_service(set_kind, set_id):
    if set_kind not in ('addr', 'port', 'iface'):
        raise ValueError('set kind must be addr|port|iface')
    data = _read_firewall_sets_file()
    existing = next((x for x in data[set_kind] if x.get('id') == str(set_id)), None)
    if not existing:
        raise LookupError('set not found')
    data[set_kind] = [x for x in data[set_kind] if x.get('id') != str(set_id)]
    _write_firewall_sets_file(data)
    apply_firewall_rules()
    return existing


def _normalize_map_item(payload, map_kind):
    if not isinstance(payload, dict):
        raise ValueError('map payload must be object')
    name = normalize_config_value(payload.get('name'))
    if name is None or not re.fullmatch(r'[A-Za-z0-9_.-]+', str(name)):
        raise ValueError('map name is invalid')
    entries = payload.get('entries') or []
    if not isinstance(entries, list):
        raise ValueError('entries must be array')
    enabled = payload.get('enabled', True)
    if not isinstance(enabled, bool):
        enabled = str(enabled).lower() in ('1', 'true', 'yes', 'on')
    comment = normalize_config_value(payload.get('comment'))
    if comment is not None:
        comment = str(comment).replace('"', "'")
    normalized_entries = []
    for raw in entries:
        val = normalize_config_value(raw)
        if val is None:
            continue
        s = str(val).strip()
        if ':' not in s:
            raise ValueError('entry must be "key:value"')
        if len(s) > 200:
            raise ValueError('entry is too long')
        normalized_entries.append(s)
    return {
        'id': str(payload.get('id') or uuid.uuid4().hex),
        'name': str(name),
        'entries': sorted(set(normalized_entries)),
        'enabled': enabled,
        'comment': comment,
        'kind': map_kind,
    }


def list_firewall_maps_service():
    return _read_firewall_maps_file()


def upsert_firewall_map_service(map_kind, payload):
    if map_kind not in ('map', 'vmap'):
        raise ValueError('map kind must be map|vmap')
    data = _read_firewall_maps_file()
    item = _normalize_map_item(payload, map_kind)
    out = []
    replaced = False
    for row in data[map_kind]:
        if row.get('id') == item['id']:
            out.append(item)
            replaced = True
        else:
            out.append(row)
    if not replaced:
        out.append(item)
    other = 'vmap' if map_kind == 'map' else 'map'
    names = [x['name'] for x in out]
    if len(names) != len(set(names)):
        raise ValueError('map names must be unique within tab')
    if item['name'] in [str(x.get('name') or '') for x in data.get(other, [])]:
        raise ValueError('map name must be globally unique across map/vmap')
    data[map_kind] = out
    _write_firewall_maps_file(data)
    apply_firewall_rules()
    return item


def delete_firewall_map_service(map_kind, map_id):
    if map_kind not in ('map', 'vmap'):
        raise ValueError('map kind must be map|vmap')
    data = _read_firewall_maps_file()
    existing = next((x for x in data[map_kind] if x.get('id') == str(map_id)), None)
    if not existing:
        raise LookupError('map not found')
    data[map_kind] = [x for x in data[map_kind] if x.get('id') != str(map_id)]
    _write_firewall_maps_file(data)
    apply_firewall_rules()
    return existing


def list_firewall_tables_service():
    data = _read_firewall_tables_file()
    builtin = []
    for table_name, chains in FIREWALL_DEFAULT_TABLE_DEFS.items():
        for chain in chains:
            chain_name, chain_type, hook_name, priority, device, policy = chain
            builtin.append({
                'id': f'builtin:{table_name}:{chain_name}:{hook_name}:{priority}',
                'family': FIREWALL_TABLE_FAMILY,
                'table_name': table_name,
                'chain_name': chain_name,
                'chain_type': chain_type,
                'hook': hook_name,
                'device': device,
                'priority': int(priority),
                'policy': policy,
                'builtin': True,
                'enabled': True,
            })
    custom = []
    for row in data.get('tables', []):
        if not isinstance(row, dict):
            continue
        item = dict(row)
        item['builtin'] = False
        custom.append(item)
    return {'builtin': builtin, 'custom': custom}


def _normalize_firewall_table_item(payload):
    if not isinstance(payload, dict):
        raise ValueError('table payload must be object')
    family = (normalize_config_value(payload.get('family')) or FIREWALL_TABLE_FAMILY).lower()
    if family != FIREWALL_TABLE_FAMILY:
        raise ValueError(f'only family "{FIREWALL_TABLE_FAMILY}" is supported')
    table_name = normalize_config_value(payload.get('table_name'))
    chain_name = normalize_config_value(payload.get('chain_name'))
    chain_type = (normalize_config_value(payload.get('chain_type')) or 'filter').lower()
    hook_name = (normalize_config_value(payload.get('hook')) or 'input').lower()
    device = normalize_config_value(payload.get('device'))
    policy = (normalize_config_value(payload.get('policy')) or 'accept').lower()
    try:
        priority = int(payload.get('priority'))
    except Exception:
        raise ValueError('priority must be integer')
    if table_name is None or not re.fullmatch(r'[a-zA-Z0-9_.-]+', str(table_name)):
        raise ValueError('table_name is invalid')
    if chain_name is None or not re.fullmatch(r'[a-zA-Z0-9_.-]+', str(chain_name)):
        raise ValueError('chain_name is invalid')
    if chain_type not in ('filter', 'nat', 'route'):
        raise ValueError('chain_type must be filter|nat|route')
    if hook_name not in ('prerouting', 'input', 'forward', 'output', 'postrouting', 'ingress'):
        raise ValueError('hook is invalid')
    if policy not in ('accept', 'drop'):
        raise ValueError('policy must be accept|drop')
    if priority in FIREWALL_RESERVED_PRIORITIES:
        raise ValueError('priority is reserved by built-in tables')
    return {
        'id': str(payload.get('id') or uuid.uuid4().hex),
        'family': family,
        'table_name': str(table_name).lower(),
        'chain_name': str(chain_name),
        'chain_type': chain_type,
        'hook': hook_name,
        'device': (str(device) if device else None),
        'priority': priority,
        'policy': policy,
        'enabled': True,
    }


def upsert_firewall_table_service(payload):
    data = _read_firewall_tables_file()
    item = _normalize_firewall_table_item(payload)
    if item['table_name'] in FIREWALL_DEFAULT_TABLE_DEFS:
        raise ValueError('built-in table names are reserved')
    out = []
    replaced = False
    for row in data['tables']:
        if row.get('id') == item['id']:
            out.append(item)
            replaced = True
        else:
            out.append(row)
    if not replaced:
        out.append(item)
    # unique table+chain+hook+priority per custom table set
    seen = set()
    for row in out:
        sig = (row.get('table_name'), row.get('chain_name'), row.get('hook'), int(row.get('priority')))
        if sig in seen:
            raise ValueError('duplicate chain/hook/priority in same table')
        seen.add(sig)
    data['tables'] = out
    _write_firewall_tables_file(data)
    managed = _read_managed_tables_file().get('tables', [])
    if item['table_name'] not in managed:
        managed.append(item['table_name'])
    _write_managed_tables_file({'tables': managed})
    apply_firewall_rules()
    return item


def delete_firewall_table_service(table_id):
    data = _read_firewall_tables_file()
    existing = next((x for x in data['tables'] if x.get('id') == str(table_id)), None)
    if not existing:
        raise LookupError('table not found')
    data['tables'] = [x for x in data['tables'] if x.get('id') != str(table_id)]
    _write_firewall_tables_file(data)
    apply_firewall_rules()
    table_name = normalize_config_value(existing.get('table_name'))
    if table_name:
        res = subprocess.run(
            ['nft', 'delete', 'table', FIREWALL_TABLE_FAMILY, str(table_name)],
            check=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        if res.returncode != 0:
            stderr = (res.stderr or b'').decode('utf-8', 'ignore').strip()
            raise RuntimeError(f'failed to delete runtime nft table "{table_name}": {stderr or res.returncode}')
        managed = _read_managed_tables_file().get('tables', [])
        managed = [x for x in managed if x != str(table_name).lower()]
        _write_managed_tables_file({'tables': managed})
    return existing


def get_firewall_schema_service():
    return FIREWALL_SCHEMA


def _random_h_value():
    return random.randint(5, 2147483647)


def _random_h_range():
    start = _random_h_value()
    end = min(2147483647, start + random.randint(10, 500))
    return f'{start}-{end}'


def generate_awg_obfuscation_params(awg_version='2'):
    awg_version = detect_awg_version(awg_version, {})
    jc = random.randint(4, 12)
    jmin = 8
    jmax = 80
    s1 = random.randint(15, 150)
    s2 = random.randint(15, 150)
    while s1 + 56 == s2:
        s2 = random.randint(15, 150)
    s3 = random.randint(15, 150)
    s4 = random.randint(5, 32)

    # v2 supports dynamic ranges (x-y), v1 keeps single numeric values.
    if awg_version == '2':
        h_values = [_random_h_range(), _random_h_range(), _random_h_range(), _random_h_range()]
        # Ensure unique range strings.
        while len(set(h_values)) < 4:
            h_values = [_random_h_range(), _random_h_range(), _random_h_range(), _random_h_range()]
        h1, h2, h3, h4 = h_values
    else:
        h_values = random.sample(range(5, 2147483648), 4)
        h1, h2, h3, h4 = [str(value) for value in h_values]

    return {
        'Jc': jc,
        'Jmin': jmin,
        'Jmax': jmax,
        'S1': s1,
        'S2': s2,
        'S3': s3,
        'S4': s4,
        'H1': h1,
        'H2': h2,
        'H3': h3,
        'H4': h4,
        'I1': None,
        'I2': None,
        'I3': None,
        'I4': None,
        'I5': None,
    }


def get_awg_param_keys_for_version(awg_version):
    awg_version = detect_awg_version(awg_version, {})
    keys = ['Jc', 'Jmin', 'Jmax', 'S1', 'S2', 'H1', 'H2', 'H3', 'H4']
    if awg_version == '2':
        keys.extend(['S3', 'S4', 'I1', 'I2', 'I3', 'I4', 'I5'])
    return keys


def detect_awg_version(awg_version, awg_params):
    normalized_version = normalize_config_value(awg_version)
    if normalized_version in ('1', '2'):
        return normalized_version
    if normalized_version in ('1.0', '1.5'):
        return '1'
    if normalized_version in ('2.0',):
        return '2'

    if any(normalize_config_value(awg_params.get(key)) is not None for key in ('I1', 'I2', 'I3', 'I4', 'I5', 'S3', 'S4')):
        return '2'
    if any(normalize_config_value(awg_params.get(key)) is not None for key in ('Jc', 'Jmin', 'Jmax', 'S1', 'S2', 'H1', 'H2', 'H3', 'H4')):
        return '1'
    return '1'


def build_awg_params_from_row(row):
    return {
        'Jc': row[10],
        'Jmin': row[11],
        'Jmax': row[12],
        'S1': row[13],
        'S2': row[14],
        'S3': row[15],
        'S4': row[16],
        'H1': row[17],
        'H2': row[18],
        'H3': row[19],
        'H4': row[20],
        'I1': row[21],
        'I2': row[22],
        'I3': row[23],
        'I4': row[24],
        'I5': row[25],
    }


def prepare_awg_params_for_version(awg_version):
    awg_params = generate_awg_obfuscation_params(awg_version)
    if detect_awg_version(awg_version, awg_params) == '1':
        for key in ('S3', 'S4', 'I1', 'I2', 'I3', 'I4', 'I5'):
            awg_params[key] = None
    return awg_params


def _parse_h_value_or_range(value):
    normalized = normalize_config_value(value)
    if normalized is None:
        return None
    if re.fullmatch(r'\d+', normalized):
        num = int(normalized)
        if num < 0 or num > 4294967295:
            raise ValueError('H1-H4 numeric values must be in range 0..4294967295')
        return (num, num)
    match = re.fullmatch(r'(\d+)-(\d+)', normalized)
    if not match:
        raise ValueError('H1-H4 must be single number or range "x-y"')
    start = int(match.group(1))
    end = int(match.group(2))
    if start < 0 or end < 0 or start > 4294967295 or end > 4294967295 or start > end:
        raise ValueError('Invalid H1-H4 range')
    return (start, end)


def validate_awg_params(awg_version, awg_params):
    awg_version = detect_awg_version(awg_version, awg_params)

    def _int_in_range(key, minimum, maximum):
        val = normalize_config_value(awg_params.get(key))
        if val is None:
            return
        try:
            num = int(val)
        except ValueError:
            raise ValueError(f'{key} must be an integer')
        if num < minimum or num > maximum:
            raise ValueError(f'{key} must be in range {minimum}..{maximum}')

    _int_in_range('Jc', 0, 128)
    _int_in_range('Jmin', 1, 1280)
    _int_in_range('Jmax', 1, 1280)
    _int_in_range('S1', 0, 1132)
    _int_in_range('S2', 0, 1188)

    if awg_version == '2':
        # Keep backward compatibility with existing presets/installations.
        _int_in_range('S3', 0, 150)
        _int_in_range('S4', 0, 32)

    jmin = normalize_config_value(awg_params.get('Jmin'))
    jmax = normalize_config_value(awg_params.get('Jmax'))
    if jmin is not None and jmax is not None and int(jmin) >= int(jmax):
        raise ValueError('Jmin must be less than Jmax')

    s1 = normalize_config_value(awg_params.get('S1'))
    s2 = normalize_config_value(awg_params.get('S2'))
    if s1 is not None and s2 is not None and int(s1) + 56 == int(s2):
        raise ValueError('S1 + 56 must not equal S2')

    h_ranges = {}
    for key in ('H1', 'H2', 'H3', 'H4'):
        parsed = _parse_h_value_or_range(awg_params.get(key))
        if parsed is not None:
            h_ranges[key] = parsed

    # Must be unique and non-overlapping.
    for key_a, range_a in h_ranges.items():
        for key_b, range_b in h_ranges.items():
            if key_a >= key_b:
                continue
            if not (range_a[1] < range_b[0] or range_b[1] < range_a[0]):
                raise ValueError(f'{key_a} and {key_b} ranges must not overlap')


def prompt_awg_version(default='2'):
    default = detect_awg_version(default, {})
    print("Выберите версию AWG:")
    print("1 - текущая схема (Jc/Jmin/Jmax, S1/S2, H1-H4)")
    print("2 - текущая схема + S3/S4 и I1-I5")
    awg_version = input(f"Версия [по умолчанию {default}]: ").strip() or default
    if awg_version not in ('1', '2'):
        print("Ошибка: поддерживаются только версии 1 и 2")
        return None
    return awg_version


def prompt_version_2_signature_params(awg_params):
    i1 = input("Введите I1 в формате CPS (Enter чтобы пропустить): ").strip()
    if i1:
        awg_params['I1'] = i1
        for key in ('I2', 'I3', 'I4', 'I5'):
            value = input(f"Введите {key} (Enter чтобы пропустить): ").strip()
            awg_params[key] = value or None
    return awg_params


def format_awg_params_for_display(awg_version, awg_params):
    lines = []
    for key in get_awg_param_keys_for_version(awg_version):
        value = normalize_config_value(awg_params.get(key))
        if value is not None:
            lines.append(f'{key}: {value}')
    return lines


def get_filtered_awg_params(awg_version, awg_params):
    filtered = {}
    for key in get_awg_param_keys_for_version(awg_version):
        value = normalize_config_value(awg_params.get(key))
        if value is not None:
            filtered[key] = value
    return filtered


def serialize_interface_row(row):
    awg_params = build_awg_params_from_row(row)
    awg_version = detect_awg_version(row[2], awg_params)
    return {
        'id': row[0],
        'wg_interface': row[1],
        'awg_version': awg_version,
        'port_number': row[3],
        'wg_ip_addr': row[4],
        'wg_ip_cidr': row[5],
        'public_key': row[7],
        'srv_ip': row[8],
        'srv_dns': row[9],
        'awg_params': get_filtered_awg_params(awg_version, awg_params),
    }


def serialize_client_row(row, include_private_key=False):
    settings_row = c.execute(
        'SELECT allowed_ips FROM client_settings WHERE client_id = ?',
        (row[0],)
    ).fetchone()
    allowed_ips = settings_row[0] if settings_row and normalize_config_value(settings_row[0]) is not None else '0.0.0.0/0'
    client_data = {
        'id': row[0],
        'name': row[1],
        'pubkey': row[2],
        'ip': row[4],
        'wg_interface': row[5],
        'allowed_ips': allowed_ips,
    }
    if include_private_key:
        client_data['privkey'] = decrypt_private_key(row[3])
    return client_data


def build_client_config(client_row, interface_row):
    settings_row = c.execute(
        'SELECT allowed_ips FROM client_settings WHERE client_id = ?',
        (client_row[0],)
    ).fetchone()
    allowed_ips = settings_row[0] if settings_row and normalize_config_value(settings_row[0]) is not None else '0.0.0.0/0'
    awg_params = build_awg_params_from_row(interface_row)
    client_lines = build_client_config_lines(
        str(decrypt_private_key(client_row[3])),
        client_row[4],
        interface_row[9],
        interface_row[2],
        awg_params,
        interface_row[7],
        interface_row[8],
        interface_row[3],
        allowed_ips,
    )
    return '\n'.join(client_lines) + '\n'


def build_interface_server_config(interface_row):
    awg_params = build_awg_params_from_row(interface_row)
    lines = [
        '[Interface]',
        f'PrivateKey = {interface_row[6]}',
        f'Address = {interface_row[4]}/{interface_row[5]}',
        f'ListenPort = {interface_row[3]}',
    ]

    if normalize_config_value(interface_row[9]) is not None:
        lines.append(f'DNS = {interface_row[9]}')

    if detect_awg_version(interface_row[2], awg_params) in ('1', '2'):
        for key in ('Jc', 'Jmin', 'Jmax', 'S1', 'S2', 'H1', 'H2', 'H3', 'H4'):
            append_config_param(lines, key, awg_params.get(key))
    if detect_awg_version(interface_row[2], awg_params) == '2':
        for key in ('S3', 'S4', 'I1', 'I2', 'I3', 'I4', 'I5'):
            append_config_param(lines, key, awg_params.get(key))

    peer_rows = c.execute(
        'SELECT pubkey, ip FROM clients WHERE wg_interface = ? ORDER BY id ASC',
        (interface_row[1],)
    ).fetchall()
    for peer_pubkey, peer_ip in peer_rows:
        lines.extend([
            '',
            '[Peer]',
            f'PublicKey = {peer_pubkey}',
            f'AllowedIPs = {peer_ip}/32',
        ])

    return '\n'.join(lines) + '\n'


def generate_keypair():
    priv_key = subprocess.check_output(['awg', 'genkey']).strip().decode('utf-8')
    pub_key = subprocess.check_output(['awg', 'pubkey'], input=priv_key.encode('utf-8')).strip().decode('utf-8')
    return priv_key, pub_key


def create_temp_key_file(private_key):
    temp_file = tempfile.NamedTemporaryFile(mode='w', delete=False)
    try:
        temp_file.write(private_key)
        temp_file.flush()
    finally:
        temp_file.close()
    os.chmod(temp_file.name, 0o600)
    return temp_file.name


def apply_interface_runtime(wg_interface, port_number, wg_ip_addr, wg_ip_cidr, private_key, awg_version, awg_params):
    key_file_path = create_temp_key_file(private_key)
    try:
        subprocess.run(['ip', 'link', 'add', wg_interface, 'type', 'amneziawg'], check=True)
        subprocess.run(['ip', 'address', 'replace', f'{wg_ip_addr}/{wg_ip_cidr}', 'dev', wg_interface], check=True)
        subprocess.run(['ip', 'link', 'set', 'up', 'dev', wg_interface], check=True)
        subprocess.run(
            build_awg_set_command(wg_interface, port_number, key_file_path, awg_version, awg_params),
            check=True
        )
    finally:
        if os.path.exists(key_file_path):
            os.unlink(key_file_path)


def remove_interface_runtime(wg_interface):
    subprocess.run(['ip', 'link', 'set', 'down', 'dev', wg_interface], check=True)
    subprocess.run(['ip', 'link', 'del', wg_interface, 'type', 'amneziawg'], check=True)


def create_interface_service(payload):
    wg_interface = normalize_config_value(payload.get('wg_interface'))
    awg_version = detect_awg_version(payload.get('awg_version', '2'), {})
    port_number = normalize_config_value(payload.get('port_number'))
    wg_ip_addr = normalize_config_value(payload.get('wg_ip_addr'))
    wg_ip_cidr = normalize_config_value(payload.get('wg_ip_cidr'))
    srv_ip = normalize_config_value(payload.get('srv_ip'))
    srv_dns = normalize_config_value(payload.get('srv_dns'))
    private_key = normalize_config_value(payload.get('private_key'))
    public_key = normalize_config_value(payload.get('public_key'))

    if None in (wg_interface, port_number, wg_ip_addr, wg_ip_cidr, srv_ip, srv_dns):
        raise ValueError('Missing required interface fields')
    validate_interface_name(wg_interface)
    if awg_version not in ('1', '2'):
        raise ValueError('Unsupported awg_version')
    port_number = parse_and_validate_port(port_number)
    wg_ip_cidr, network_cidr = parse_and_validate_interface_network(wg_ip_addr, wg_ip_cidr)
    validate_ip_literal(srv_ip, 'server IP')

    if private_key is None or public_key is None:
        private_key, public_key = generate_keypair()

    awg_params = prepare_awg_params_for_version(awg_version)
    payload_awg_params = payload.get('awg_params', {})
    if isinstance(payload_awg_params, dict):
        for key in awg_params.keys():
            if key in payload_awg_params:
                awg_params[key] = normalize_config_value(payload_awg_params.get(key))
    validate_awg_params(awg_version, awg_params)

    row_id = None
    try:
        c.execute('BEGIN IMMEDIATE')
        assert_interface_uniqueness(wg_interface, port_number, network_cidr)
        c.execute('''INSERT INTO wg_interfaces (
                        wg_interface, awg_version, port_number, wg_ip_addr, wg_ip_cidr, private_key, pubkey, srv_ip, srv_dns,
                        Jc, Jmin, Jmax, S1, S2, S3, S4, H1, H2, H3, H4, I1, I2, I3, I4, I5
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                  (
                      wg_interface, awg_version, port_number, wg_ip_addr, wg_ip_cidr, private_key, public_key, srv_ip, srv_dns,
                      awg_params['Jc'], awg_params['Jmin'], awg_params['Jmax'],
                      awg_params['S1'], awg_params['S2'], awg_params['S3'], awg_params['S4'],
                      awg_params['H1'], awg_params['H2'], awg_params['H3'], awg_params['H4'],
                      awg_params['I1'], awg_params['I2'], awg_params['I3'], awg_params['I4'], awg_params['I5'],
                  ))
        row_id = c.lastrowid
        apply_interface_runtime(wg_interface, port_number, wg_ip_addr, wg_ip_cidr, private_key, awg_version, awg_params)
        conn.commit()
    except Exception:
        if row_id is not None:
            try:
                c.execute('DELETE FROM wg_interfaces WHERE id = ?', (row_id,))
                conn.commit()
            except Exception:
                conn.rollback()
        else:
            conn.rollback()
        raise

    row = c.execute(
        f'SELECT {WG_INTERFACE_COLUMNS} FROM wg_interfaces WHERE id = ?',
        (row_id,)
    ).fetchone()
    return row


def delete_interface_service(interface_id):
    row = c.execute(
        f'SELECT {WG_INTERFACE_COLUMNS} FROM wg_interfaces WHERE id = ?',
        (interface_id,)
    ).fetchone()
    if not row:
        raise LookupError('Interface not found')

    clients_count = c.execute(
        'SELECT COUNT(*) FROM clients WHERE wg_interface = ?',
        (row[1],)
    ).fetchone()[0]
    if clients_count:
        raise ValueError('Interface has clients attached')

    remove_interface_runtime(row[1])
    c.execute('DELETE FROM wg_interfaces WHERE id = ?', (interface_id,))
    conn.commit()
    return row


def update_interface_service(interface_id, payload):
    current_row = c.execute(
        f'SELECT {WG_INTERFACE_COLUMNS} FROM wg_interfaces WHERE id = ?',
        (interface_id,)
    ).fetchone()
    if not current_row:
        raise LookupError('Interface not found')

    current_params = build_awg_params_from_row(current_row)
    awg_version = detect_awg_version(payload.get('awg_version', current_row[2]), current_params)
    if awg_version not in ('1', '2'):
        raise ValueError('Unsupported awg_version')

    wg_interface = normalize_config_value(payload.get('wg_interface')) or current_row[1]
    port_number = normalize_config_value(payload.get('port_number')) or str(current_row[3])
    wg_ip_addr = normalize_config_value(payload.get('wg_ip_addr')) or current_row[4]
    wg_ip_cidr = normalize_config_value(payload.get('wg_ip_cidr')) or str(current_row[5])
    private_key = normalize_config_value(payload.get('private_key')) or current_row[6]
    public_key = normalize_config_value(payload.get('public_key')) or current_row[7]
    srv_ip = normalize_config_value(payload.get('srv_ip')) or current_row[8]
    srv_dns = normalize_config_value(payload.get('srv_dns')) or current_row[9]
    validate_interface_name(wg_interface)

    port_number = parse_and_validate_port(port_number)
    wg_ip_cidr, network_cidr = parse_and_validate_interface_network(wg_ip_addr, wg_ip_cidr)
    validate_ip_literal(srv_ip, 'server IP')

    awg_params = prepare_awg_params_for_version(awg_version)
    for key in awg_params.keys():
        if key in current_params and normalize_config_value(current_params[key]) is not None:
            awg_params[key] = current_params[key]
    payload_awg_params = payload.get('awg_params', {})
    if isinstance(payload_awg_params, dict):
        for key in awg_params.keys():
            if key in payload_awg_params:
                awg_params[key] = normalize_config_value(payload_awg_params.get(key))
    validate_awg_params(awg_version, awg_params)

    try:
        c.execute('BEGIN IMMEDIATE')
        assert_interface_uniqueness(wg_interface, port_number, network_cidr, exclude_id=interface_id)
        remove_interface_runtime(current_row[1])
        c.execute('''UPDATE wg_interfaces
                     SET wg_interface=?, awg_version=?, wg_ip_addr=?, wg_ip_cidr=?, port_number=?, private_key=?, pubkey=?, srv_ip=?, srv_dns=?,
                         Jc=?, Jmin=?, Jmax=?, S1=?, S2=?, S3=?, S4=?, H1=?, H2=?, H3=?, H4=?, I1=?, I2=?, I3=?, I4=?, I5=?
                     WHERE id=?''',
                  (
                      wg_interface, awg_version, wg_ip_addr, wg_ip_cidr, port_number, private_key, public_key, srv_ip, srv_dns,
                      awg_params['Jc'], awg_params['Jmin'], awg_params['Jmax'],
                      awg_params['S1'], awg_params['S2'], awg_params['S3'], awg_params['S4'],
                      awg_params['H1'], awg_params['H2'], awg_params['H3'], awg_params['H4'],
                      awg_params['I1'], awg_params['I2'], awg_params['I3'], awg_params['I4'], awg_params['I5'],
                      interface_id
                  ))
        if wg_interface != current_row[1]:
            c.execute(
                'UPDATE clients SET wg_interface = ? WHERE wg_interface = ?',
                (wg_interface, current_row[1])
            )
        apply_interface_runtime(wg_interface, port_number, wg_ip_addr, wg_ip_cidr, private_key, awg_version, awg_params)
        conn.commit()
    except Exception:
        conn.rollback()
        raise

    return c.execute(
        f'SELECT {WG_INTERFACE_COLUMNS} FROM wg_interfaces WHERE id = ?',
        (interface_id,)
    ).fetchone()


def create_client_service(payload):
    name = normalize_config_value(payload.get('name'))
    wg_interface = normalize_config_value(payload.get('wg_interface'))
    client_ip = normalize_config_value(payload.get('ip'))
    private_key = normalize_config_value(payload.get('privkey'))
    public_key = normalize_config_value(payload.get('pubkey'))
    allowed_ips = normalize_config_value(payload.get('allowed_ips')) or '0.0.0.0/0'

    if None in (name, wg_interface):
        raise ValueError('Missing required client fields')
    if c.execute('SELECT 1 FROM wg_interfaces WHERE wg_interface = ?', (wg_interface,)).fetchone() is None:
        raise LookupError('Interface not found')

    if client_ip is None:
        client_ip = get_next_available_ip(wg_interface)
    if private_key is None or public_key is None:
        private_key, public_key = generate_keypair()

    encrypted_private_key = encrypt_private_key(private_key)
    c.execute(
        '''INSERT INTO clients (name, pubkey, privkey, ip, wg_interface)
           VALUES (?, ?, ?, ?, ?)''',
        (name, public_key, encrypted_private_key, client_ip, wg_interface)
    )
    client_id = c.lastrowid
    c.execute(
        'INSERT OR REPLACE INTO client_settings (client_id, allowed_ips) VALUES (?, ?)',
        (client_id, allowed_ips)
    )
    conn.commit()
    subprocess.run(['awg', 'set', wg_interface, 'peer', public_key, 'allowed-ips', client_ip + '/32'], check=True)

    return c.execute('SELECT * FROM clients WHERE id = ?', (client_id,)).fetchone()


def delete_client_service(client_id):
    row = c.execute('SELECT * FROM clients WHERE id = ?', (client_id,)).fetchone()
    if not row:
        raise LookupError('Client not found')

    subprocess.run(['awg', 'set', row[5], 'peer', row[2], 'remove'], check=True)
    c.execute('DELETE FROM client_settings WHERE client_id = ?', (client_id,))
    c.execute('DELETE FROM clients WHERE id = ?', (client_id,))
    conn.commit()
    return row


def update_client_service(client_id, payload):
    current_row = c.execute('SELECT * FROM clients WHERE id = ?', (client_id,)).fetchone()
    if not current_row:
        raise LookupError('Client not found')

    name = normalize_config_value(payload.get('name')) or current_row[1]
    public_key = normalize_config_value(payload.get('pubkey')) or current_row[2]
    private_key = normalize_config_value(payload.get('privkey'))
    requested_ip = normalize_config_value(payload.get('ip'))
    allowed_ips = normalize_config_value(payload.get('allowed_ips'))
    ip_address = requested_ip or current_row[4]
    wg_interface = normalize_config_value(payload.get('wg_interface')) or current_row[5]

    if c.execute('SELECT 1 FROM wg_interfaces WHERE wg_interface = ?', (wg_interface,)).fetchone() is None:
        raise LookupError('Interface not found')

    interface_changed = wg_interface != current_row[5]
    if interface_changed and (requested_ip is None or requested_ip == current_row[4]):
        ip_address = get_next_available_ip(wg_interface, exclude_client_id=client_id)
    else:
        validate_client_ip_for_interface(ip_address, wg_interface, exclude_client_id=client_id)

    encrypted_private_key = current_row[3] if private_key is None else encrypt_private_key(private_key)

    subprocess.run(['awg', 'set', current_row[5], 'peer', current_row[2], 'remove'], check=True)
    c.execute(
        '''UPDATE clients SET name=?, pubkey=?, privkey=?, ip=?, wg_interface=? WHERE id=?''',
        (name, public_key, encrypted_private_key, ip_address, wg_interface, client_id)
    )
    if allowed_ips is not None:
        c.execute(
            'INSERT OR REPLACE INTO client_settings (client_id, allowed_ips) VALUES (?, ?)',
            (client_id, allowed_ips)
        )
    conn.commit()
    subprocess.run(['awg', 'set', wg_interface, 'peer', public_key, 'allowed-ips', ip_address + '/32'], check=True)

    return c.execute('SELECT * FROM clients WHERE id = ?', (client_id,)).fetchone()


def build_awg_set_command(wg_interface, port_number, key_file_path, awg_version, awg_params):
    cmd = [
        'awg', 'set', wg_interface,
        'listen-port', str(port_number),
        'private-key', key_file_path,
    ]

    awg_version = detect_awg_version(awg_version, awg_params)
    ordered_params = []
    if awg_version in ('1', '2'):
        ordered_params.extend([
            ('jc', awg_params.get('Jc')),
            ('jmin', awg_params.get('Jmin')),
            ('jmax', awg_params.get('Jmax')),
            ('s1', awg_params.get('S1')),
            ('s2', awg_params.get('S2')),
            ('h1', awg_params.get('H1')),
            ('h2', awg_params.get('H2')),
            ('h3', awg_params.get('H3')),
            ('h4', awg_params.get('H4')),
        ])
    if awg_version == '2':
        ordered_params.extend([
            ('s3', awg_params.get('S3')),
            ('s4', awg_params.get('S4')),
            ('i1', awg_params.get('I1')),
            ('i2', awg_params.get('I2')),
            ('i3', awg_params.get('I3')),
            ('i4', awg_params.get('I4')),
            ('i5', awg_params.get('I5')),
        ])

    for param_name, value in ordered_params:
        normalized = normalize_config_value(value)
        if normalized is not None:
            cmd.extend([param_name, normalized])

    return cmd


def append_config_param(lines, key, value):
    normalized = normalize_config_value(value)
    if normalized is not None:
        lines.append(f'{key} = {normalized}')


def build_client_config_lines(client_private_key, client_ip, srv_dns, awg_version, awg_params, server_pubkey, srv_ip, port_number, allowed_ips='0.0.0.0/0'):
    awg_version = detect_awg_version(awg_version, awg_params)
    lines = [
        '',
        '[Interface]',
        f'PrivateKey = {client_private_key}',
        f'Address = {client_ip}/32',
        f'DNS = {srv_dns}',
    ]

    if awg_version in ('1', '2'):
        append_config_param(lines, 'Jc', awg_params.get('Jc'))
        append_config_param(lines, 'Jmin', awg_params.get('Jmin'))
        append_config_param(lines, 'Jmax', awg_params.get('Jmax'))
        append_config_param(lines, 'S1', awg_params.get('S1'))
        append_config_param(lines, 'S2', awg_params.get('S2'))
        append_config_param(lines, 'H1', awg_params.get('H1'))
        append_config_param(lines, 'H2', awg_params.get('H2'))
        append_config_param(lines, 'H3', awg_params.get('H3'))
        append_config_param(lines, 'H4', awg_params.get('H4'))
    if awg_version == '2':
        append_config_param(lines, 'S3', awg_params.get('S3'))
        append_config_param(lines, 'S4', awg_params.get('S4'))
        append_config_param(lines, 'I1', awg_params.get('I1'))
        append_config_param(lines, 'I2', awg_params.get('I2'))
        append_config_param(lines, 'I3', awg_params.get('I3'))
        append_config_param(lines, 'I4', awg_params.get('I4'))
        append_config_param(lines, 'I5', awg_params.get('I5'))

    lines.extend([
        '',
        '[Peer]',
        f'PublicKey = {server_pubkey}',
        f'Endpoint = {srv_ip}:{port_number}',
        f'AllowedIPs = {allowed_ips}',
    ])
    return lines


def get_next_available_ip(wg_interface, exclude_client_id=None):
    # Извлекаем IP-адрес и CIDR для интерфейса из таблицы wg_interfaces
    result = c.execute('SELECT wg_ip_addr, wg_ip_cidr FROM wg_interfaces WHERE wg_interface = ?', (wg_interface,)).fetchone()
    
    if not result:
        raise LookupError(f"Интерфейс {wg_interface} не найден в базе данных")
    
    wg_ip_addr, wg_ip_cidr = result
    subnet = f"{wg_ip_addr}/{wg_ip_cidr}"  # Формируем подсеть

    # Преобразуем подсеть в объект IPv4-сети
    network = ipaddress.ip_network(subnet, strict=False)

    # Извлекаем уже использованные IP-адреса из базы данных
    if exclude_client_id is None:
        used_rows = c.execute('SELECT ip FROM clients WHERE wg_interface = ?', (wg_interface,)).fetchall()
    else:
        used_rows = c.execute(
            'SELECT ip FROM clients WHERE wg_interface = ? AND id != ?',
            (wg_interface, exclude_client_id)
        ).fetchall()
    used_ips = [ipaddress.ip_address(row[0]) for row in used_rows]

    # Добавляем IP-адрес самого интерфейса в список занятых
    used_ips.append(ipaddress.ip_address(wg_ip_addr))

    # Ищем первый доступный IP-адрес в сети
    for ip in network.hosts():  # hosts() пропускает сеть и широковещательный адрес
        if ip not in used_ips:
            return str(ip)
    
    raise ValueError("Нет доступных IP-адресов для назначения")


def validate_client_ip_for_interface(client_ip, wg_interface, exclude_client_id=None):
    result = c.execute('SELECT wg_ip_addr, wg_ip_cidr FROM wg_interfaces WHERE wg_interface = ?', (wg_interface,)).fetchone()
    if not result:
        raise LookupError('Interface not found')

    wg_ip_addr, wg_ip_cidr = result
    network = ipaddress.ip_network(f"{wg_ip_addr}/{wg_ip_cidr}", strict=False)
    try:
        client_addr = ipaddress.ip_address(client_ip)
    except ValueError:
        raise ValueError('Invalid client IP')

    if client_addr not in network:
        raise ValueError(f'Client IP {client_ip} is outside interface subnet {network}')
    if client_addr == ipaddress.ip_address(wg_ip_addr):
        raise ValueError('Client IP conflicts with interface IP')

    if exclude_client_id is None:
        conflict = c.execute(
            'SELECT 1 FROM clients WHERE wg_interface = ? AND ip = ?',
            (wg_interface, client_ip)
        ).fetchone()
    else:
        conflict = c.execute(
            'SELECT 1 FROM clients WHERE wg_interface = ? AND ip = ? AND id != ?',
            (wg_interface, client_ip, exclude_client_id)
        ).fetchone()
    if conflict is not None:
        raise ValueError(f'Client IP {client_ip} is already used on interface {wg_interface}')


def add_client():
    # Сбор данных для нового клиента
    name = input("Введите имя клиента: ")
    wg_interface = input("Введите интерфейс WireGuard: ")

    # Динамическое назначение IP-адреса для клиента
    try:
        client_ip = get_next_available_ip(wg_interface)  # Получаем доступный IP-адрес
        print(f"Назначен IP-адрес {client_ip} для клиента {name}")
    except Exception as e:
        print(f"Ошибка при назначении IP-адреса: {e}")
        return

    # Генерация приватного и публичного ключей автоматически
    generate_keys = input("Сгенерировать автоматически-(pub_key|pri_key) yes/no: ")
    if generate_keys.lower() == 'yes':
        priv_key = subprocess.check_output(['awg', 'genkey']).strip().decode('utf-8')
        pub_key = subprocess.check_output(['awg', 'pubkey'], input=priv_key.encode('utf-8')).strip().decode('utf-8')
    else:
        priv_key = input("Введите приватный ключ: ")
        pub_key = input("Введите публичный ключ: ")

    try:
        # Запись данных клиента в базу данных
        priv_key = encrypt_private_key(priv_key)
        c.execute('''INSERT INTO clients (name, pubkey, privkey, ip, wg_interface)
                     VALUES (?, ?, ?, ?, ?)''', 
                  (name, pub_key, priv_key, client_ip, wg_interface))
        conn.commit()
        print(f"Клиент {name} успешно добавлен в базу данных с IP-адресом {client_ip}")

        # Добавление клиента в конфигурацию WireGuard через утилиту awg
        subprocess.run(['awg', 'set', wg_interface, 'peer', pub_key, 'allowed-ips', client_ip + '/32'], check=True)
        print(f"Клиент {name} успешно добавлен в конфигурацию WireGuard")

    except sqlite3.Error as e:
        print(f"Ошибка записи в базу данных: {e}")
    except subprocess.CalledProcessError as e:
        print(f"Ошибка добавления клиента в WireGuard: {e}")
    

def delete_client():
    # Вывод списка клиентов перед удалением
    list_clients()
    
    # Запрос имени клиента, которого нужно удалить
    client_id = input("Введите id клиента для удаления: ")
    
    # Получение информации о клиенте из базы данных
    row = c.execute('SELECT * FROM clients WHERE id = ?', (client_id,)).fetchone()
    if not row:
        # Если клиент не найден, выводим ошибку и выходим из функции
        print(f"Ошибка: клиент c id {client_id} не найден")
        return
    
    # Распаковка кортежа row в переменные
    id, name, pubkey, privkey, ip, wg_interface = row
    
    # Удаляем клиента из файла конфигурации сервера WireGuard
    subprocess.run(['awg', 'set', wg_interface, 'peer', pubkey, 'remove'], check=True)
    
    # Удаление клиента из базы данных
    c.execute('DELETE FROM clients WHERE id = ?', (id,))
    conn.commit()
    
    # Удаление клиента из конфигурации WireGuard на уровне ядра операционной системы
    del_peer(wg_interface, pubkey)
    
    # Выводим сообщение об успешном удалении клиента
    print(f"Клиент {name} удалён.")

def list_clients():
    print("Список клиентов:")
    for id, name, pubkey, privkey, ip, wg_interface in c.execute('SELECT * FROM clients').fetchall():
        print("============================================================================================================================")
        print(f"{id} - {name}: {ip} ({pubkey}) ({decrypt_private_key(privkey)}) {wg_interface}")
        print("============================================================================================================================")

def list_wg_int():
    print("Список интерфейсов:")
    for row in c.execute(f'SELECT {WG_INTERFACE_COLUMNS} FROM wg_interfaces').fetchall():
        id, wg_interface, awg_version, port_number, wg_ip_addr, wg_ip_cidr, private_key, pubkey, srv_ip, srv_dns, Jc, Jmin, Jmax, S1, S2, S3, S4, H1, H2, H3, H4, I1, I2, I3, I4, I5 = row
        awg_params = build_awg_params_from_row(row)
        awg_version = detect_awg_version(awg_version, awg_params)
        print("============================================================================================================================")
        print(f"ID: {id}, Interface: {wg_interface}, AWG version: {awg_version}")
        print(f"IP-address: {wg_ip_addr}/{wg_ip_cidr}, Порт: {port_number}")
        print(f"Public key: {pubkey}, Private Key: {private_key}")
        print(f"Public ip: {srv_ip}, DNS: {srv_dns}")
        for param_line in format_awg_params_for_display(awg_version, awg_params):
            print(param_line)
        print("============================================================================================================================")

def list_wg_int_clients():
    print("Список интерфейсов:")
    for row in c.execute(f'SELECT {WG_INTERFACE_COLUMNS} FROM wg_interfaces').fetchall():
        id, wg_interface, awg_version, port_number, wg_ip_addr, wg_ip_cidr, private_key, pubkey, srv_ip, srv_dns, Jc, Jmin, Jmax, S1, S2, S3, S4, H1, H2, H3, H4, I1, I2, I3, I4, I5 = row
        awg_params = build_awg_params_from_row(row)
        awg_version = detect_awg_version(awg_version, awg_params)
        print("============================================================================================================================")
        print(f"ID: {id}, Interface: {wg_interface}, AWG version: {awg_version}")
        print(f"IP-address: {wg_ip_addr}/{wg_ip_cidr}, Порт: {port_number}")
        print(f"Public key: {pubkey}, Private key: {private_key}")
        print(f"Public ip: {srv_ip}, DNS: {srv_dns}")
        for param_line in format_awg_params_for_display(awg_version, awg_params):
            print(param_line)
        for id, name, pubkey, privkey, ip, wg_interface in c.execute('SELECT * FROM clients WHERE wg_interface = ?', (wg_interface,)).fetchall():
            print("    |-----------------------------------------------------------------------------------------------------------------------")
            print(f"    | ID: {id} - {name}: IP-address: {ip}")
            print(f"    | Public key: {pubkey}")
            print(f"    | Private key: {decrypt_private_key(privkey)}")
            print("    |-----------------------------------------------------------------------------------------------------------------------")


        print("============================================================================================================================")

# Печатаем qr-code
def client_qrencode():
    
    list_clients()
    client_id = input("Введите id клиента: ")
    # Получение информации о клиенте из базы данных
    
    row = c.execute('SELECT * FROM clients WHERE id = ?', (client_id,)).fetchone()
    if not row:
        print(f"Ошибка: клиент {client_id} не найден")
        return
    id, name, client_pubkey, client_privkey, ip, wg_interface = row

    row2 = c.execute(f'SELECT {WG_INTERFACE_COLUMNS} FROM wg_interfaces WHERE wg_interface = ?', (wg_interface,)).fetchone()
    if not row2:
        print(f"Ошибка: {wg_interface}")
        return
    id, wg_interface, awg_version, port_number, wg_ip_addr, wg_ip_cidr, private_key, pubkey, srv_ip, srv_dns, Jc, Jmin, Jmax, S1, S2, S3, S4, H1, H2, H3, H4, I1, I2, I3, I4, I5 = row2

    awg_params = build_awg_params_from_row(row2)
    client_lines = build_client_config_lines(
        str(decrypt_private_key(client_privkey)),
        ip,
        srv_dns,
        awg_version,
        awg_params,
        pubkey,
        srv_ip,
        port_number
    )
    client_config = '\n'.join(client_lines) + '\n'
    
    print(client_config)
    print("QR code:")
    render_qr_in_terminal(client_config)


def show_api_key_status():
    api_key = load_api_key()
    if api_key is None:
        print(f"API key не настроен. Можно задать через переменную окружения {API_KEY_ENV_VAR} или файл {API_KEY_FILE}")
    else:
        print(f"API key настроен: {'*' * max(4, len(api_key) - 4)}{api_key[-4:]}")


def set_api_key():
    api_key = getpass.getpass("Введите API key: ").strip()
    if not api_key:
        print("Ошибка: пустой API key")
        return
    save_api_key(api_key)
    print(f"API key сохранён в {API_KEY_FILE}")


# Занятые ip адреса
def wg_lease_ip(wg_int):
    output = subprocess.check_output(['awg', 'show', wg_int, 'allowed-ips'])
    ips = output.decode().split('\n')[:-1]  # разбиваем вывод на строки и убираем последнюю пустую строку
    
    ip_addresses = []
    for line in ips:
        parts = line.split('\t')
        if len(parts) > 1 and parts[1] != '(none)':
            ip_addresses.append(parts[1])    
        
    #print(ip_addresses)  # выведет список IP-адресов с маской
    return ip_addresses

# Добавить peer
def add_peer(wg_interface, public_key, ip_address):
    try:
        cmd = ['awg', 'set', wg_interface, 'peer', public_key, 'allowed-ips', ip_address]
        print(cmd)
        subprocess.run(cmd, check=True)
        # wg set wg0 peer <public key> allowed-ips <ip address>/<subnet> persistent-keepalive <time in seconds>
    except subprocess.CalledProcessError as e:
        print("--------------------------------------------------------------------------------")
        print(f'Error setting: {e}')
        print("--------------------------------------------------------------------------------")

# Удалить peer
def del_peer(wg_interface, public_key):
    try:
        cmd = ['awg', 'set', wg_interface, 'peer', public_key, 'remove']
        subprocess.run(cmd, check=True)
        # wg set <interface> peer <public-key-1> remove
    except subprocess.CalledProcessError as e:
        print("--------------------------------------------------------------------------------")
        print(f'Error setting: {e}')
        print("--------------------------------------------------------------------------------")

def add_wg_int():
    # Сбор данных для нового интерфейса
    wg_interface = input("Введите wg_interface: ")
    awg_version = prompt_awg_version('2')
    if awg_version is None:
        return
    port_number = input("Введите port_number: ")
    wg_ip_addr = input("Введите wg_ip_addr: ")
    wg_ip_cidr = input("Введите wg_ip_cidr: ")
    srv_ip = input("Введите srv_ip: ")
    srv_dns = input("Введите srv_dns: ")
    
    # Генерация приватного и публичного ключей автоматически
    generate_keys = input("Сгенерировать автоматически-(pub_key|pri_key) yes/no: ")
    if generate_keys.lower() == 'yes':
        priv_key = subprocess.check_output(['awg', 'genkey']).strip().decode('utf-8')
        pub_key = subprocess.check_output(['awg', 'pubkey'], input=priv_key.encode('utf-8')).strip().decode('utf-8')
    else:
        priv_key = input("Введите приватный ключ: ")
        pub_key = input("Введите публичный ключ: ")

    awg_params = prepare_awg_params_for_version(awg_version)
    if awg_version == '2':
        awg_params = prompt_version_2_signature_params(awg_params)

    try:
        c.execute('''INSERT INTO wg_interfaces (
                        wg_interface, awg_version, port_number, wg_ip_addr, wg_ip_cidr, private_key, pubkey, srv_ip, srv_dns,
                        Jc, Jmin, Jmax, S1, S2, S3, S4, H1, H2, H3, H4, I1, I2, I3, I4, I5
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                  (
                      wg_interface, awg_version, port_number, wg_ip_addr, wg_ip_cidr, priv_key, pub_key, srv_ip, srv_dns,
                      awg_params['Jc'], awg_params['Jmin'], awg_params['Jmax'],
                      awg_params['S1'], awg_params['S2'], awg_params['S3'], awg_params['S4'],
                      awg_params['H1'], awg_params['H2'], awg_params['H3'], awg_params['H4'],
                      awg_params['I1'], awg_params['I2'], awg_params['I3'], awg_params['I4'], awg_params['I5'],
                  ))
        conn.commit()
        
        print("Интерфейс успешно добавлен в базу данных")
        # Шаг 1: Создание интерфейса через ip link
        subprocess.run(['ip', 'link', 'add', wg_interface, 'type', 'amneziawg'], check=True)
        subprocess.run(['ip', 'address', 'add', f'{wg_ip_addr}/{wg_ip_cidr}', 'dev', wg_interface], check=True)
        subprocess.run(['ip', 'link', 'set', 'up', 'dev', wg_interface], check=True)

        # Шаг 2: Создание файла ключа
        subprocess.run(['touch', 'key_temp'], check=True)
        subprocess.run(['chmod', '600', 'key_temp'], check=True)

        # Запись приватного ключа в файл
        with open('key_temp', 'w') as key_file:
            key_file.write(priv_key)

        # Шаг 3: Настройка WireGuard через вызов subprocess с использованием утилиты awg
        subprocess.run(
            build_awg_set_command(wg_interface, port_number, 'key_temp', awg_version, awg_params),
            check=True
        )

        print("WireGuard интерфейс настроен успешно")
    except sqlite3.Error as e:
        print(f"Ошибка записи в базу данных: {e}")
    except subprocess.CalledProcessError as e:
        print(f"Ошибка настройки интерфейса WireGuard: {e}")
        
# Удалить wg  интерфейс
def del_wg_int():
    list_wg_int()
    wg_id = input("Введите id интерфейса: ")
    row2 = c.execute(f'SELECT {WG_INTERFACE_COLUMNS} FROM wg_interfaces WHERE id = ?', (wg_id,)).fetchone()
    if not row2:
        print(f"Ошибка: {wg_id}")
        return
    id, wg_interface, awg_version, port_number, wg_ip_addr, wg_ip_cidr, private_key, pubkey, srv_ip, srv_dns, Jc, Jmin, Jmax, S1, S2, S3, S4, H1, H2, H3, H4, I1, I2, I3, I4, I5 = row2
    subprocess.run(['ip', 'link', 'set', 'down', 'dev', wg_interface], check=True)
    subprocess.run(['ip', 'link', 'del', wg_interface, 'type', 'amneziawg'], check=True)
    c.execute('DELETE FROM wg_interfaces WHERE wg_interface = ?', (wg_interface,))
    conn.commit()


def update_interface():
    list_wg_int()
    print("wg_interface - название интерфейса WireGuard, который нужно обновить.")
    print("port_number - номер порта, который используется на сервере для подключения к этому интерфейсу.")
    print("wg_ip_addr - IP-адрес, который нужно назначить для этого интерфейса.")
    print("wg_ip_cidr - длина префикса подсети, которую нужно назначить для этого интерфейса в формате /XX.")
    print("srv_ip - это публичный IP-адрес сервера Wireguard, на котором запущен VPN-сервер.")
    print("srv_dns - это список DNS-серверов, которые будут доступны для клиентов Wireguard.")

    wg_interface = input("Введите wg_interface: ")
    current_row = c.execute(
        f'SELECT {WG_INTERFACE_COLUMNS} FROM wg_interfaces WHERE wg_interface = ?',
        (wg_interface,)
    ).fetchone()
    if not current_row:
        print(f"Ошибка: интерфейс {wg_interface} не найден")
        return

    _, _, current_version, current_port_number, current_wg_ip_addr, current_wg_ip_cidr, _, _, current_srv_ip, current_srv_dns, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _ = current_row

    awg_version = prompt_awg_version(detect_awg_version(current_version, build_awg_params_from_row(current_row)))
    if awg_version is None:
        return

    port_number = input(f"Введите port_number [{current_port_number}]: ").strip() or str(current_port_number)
    wg_ip_addr = input(f"Введите wg_ip_addr [{current_wg_ip_addr}]: ").strip() or str(current_wg_ip_addr)
    wg_ip_cidr = input(f"Введите wg_ip_cidr [{current_wg_ip_cidr}]: ").strip() or str(current_wg_ip_cidr)
    srv_ip = input(f"Введите srv_ip [{current_srv_ip}]: ").strip() or str(current_srv_ip)
    srv_dns = input(f"Введите srv_dns [{current_srv_dns}]: ").strip() or str(current_srv_dns)
    pubkey = input("Введите pub_key: ")
    private_key = input("Введите pri_key: ")

    awg_params = prepare_awg_params_for_version(awg_version)
    if awg_version == '2':
        awg_params = prompt_version_2_signature_params(awg_params)

    subprocess.run(['ip', 'link', 'set', 'down', 'dev', wg_interface], check=True)
    subprocess.run(['ip', 'link', 'del', wg_interface, 'type', 'amneziawg'], check=True)

    c.execute('''UPDATE wg_interfaces
                 SET awg_version=?, wg_ip_addr=?, wg_ip_cidr=?, port_number=?, private_key=?, pubkey=?, srv_ip=?, srv_dns=?,
                     Jc=?, Jmin=?, Jmax=?, S1=?, S2=?, S3=?, S4=?, H1=?, H2=?, H3=?, H4=?, I1=?, I2=?, I3=?, I4=?, I5=?
                 WHERE wg_interface=?''',
              (
                  awg_version, wg_ip_addr, wg_ip_cidr, port_number, private_key, pubkey, srv_ip, str(srv_dns),
                  awg_params['Jc'], awg_params['Jmin'], awg_params['Jmax'],
                  awg_params['S1'], awg_params['S2'], awg_params['S3'], awg_params['S4'],
                  awg_params['H1'], awg_params['H2'], awg_params['H3'], awg_params['H4'],
                  awg_params['I1'], awg_params['I2'], awg_params['I3'], awg_params['I4'], awg_params['I5'],
                  wg_interface
              ))
    conn.commit()

    subprocess.run(['ip', 'link', 'add', wg_interface, 'type', 'amneziawg'], check=True)
    subprocess.run(['ip', 'address', 'add', str(wg_ip_addr)+"/"+str(wg_ip_cidr), 'dev', wg_interface], check=True)
    subprocess.run(['ip', 'link', 'set', 'up', 'dev', wg_interface], check=True)
    subprocess.run(['touch', 'key_temp'], check=True)
    subprocess.run(['chmod', '600', 'key_temp'], check=True)
    with open('key_temp', 'w') as f:
        f.write(private_key)
    subprocess.run(
        build_awg_set_command(wg_interface, port_number, 'key_temp', awg_version, awg_params),
        check=True
    )
    subprocess.run(['rm', 'key_temp'], check=True)

# обновить настройки клиентов
def update_peer():
    list_clients()
    print("id - идентификатор клиента, который нужно обновить")
    print("name - новое имя клиента")
    print("pubkey - новый публичный ключ клиента")
    print("privkey - новый приватный ключ клиента")
    print("ip - новый IP-адрес клиента")
    print("wg_interface - идентификатор интерфейса WireGuard, через который клиент подключается к серверу")
    id  = input("Введите id: ")
    name = input("Введите name: ")
    pubkey = input("Введите pubkey: ")
    privkey = input("Введите privkey: ")
    ip = input("Введите ip: ")
    wg_interface = input("Введите wg_interface: ")


    pubkey2 = c.execute('SELECT pubkey FROM clients WHERE id = ?', (id,)).fetchone()
    del_peer(wg_interface, pubkey2[0])

    # Обновляем запись в таблице
    c.execute('''UPDATE clients SET name=?, pubkey=?, privkey=?, ip=?, wg_interface=? WHERE id=?''', (name, pubkey, encrypt_private_key(privkey), ip, wg_interface, id))

    # Сохраняем изменения в базе данных
    conn.commit()
    add_peer(wg_interface, pubkey, ip)


def sync(_type):

    #hard sync
    if _type == 1:
        try:
            output = subprocess.check_output(['ip', '-o', 'link', 'show'], text=True)
            interfaces = []
            for line in output.splitlines():
                name = line.split(':', 2)[1].strip()
                if '@' in name:
                    name = name.split('@', 1)[0]
                if (name.startswith('wg') and len(name) > 2 and name[2:].isdigit()) or (name.startswith('awg') and len(name) > 3 and name[3:].isdigit()):
                    interfaces.append(name)

            if not interfaces:
                print("No matching interfaces to remove")
            else:    
                for iface_name in interfaces:
                    subprocess.run(['ip', 'link', 'delete', iface_name], check=True)
        except subprocess.CalledProcessError as e:
            print(f'Error setting: {e}')


    # Обновляем запрос и распаковку в соответствии с количеством столбцов в таблице wg_interfaces
    for row in c.execute(f'SELECT {WG_INTERFACE_COLUMNS} FROM wg_interfaces').fetchall():
        id, wg_interface, awg_version, port_number, wg_ip_addr, wg_ip_cidr, private_key, pubkey, srv_ip, srv_dns, Jc, Jmin, Jmax, S1, S2, S3, S4, H1, H2, H3, H4, I1, I2, I3, I4, I5 = row
        print("Интерфейс успешно добавлен в базу данных")
        # Шаг 1: Создание интерфейса через ip link
        exists = subprocess.run(['ip', 'link', 'show', wg_interface], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0
        if not exists:
            add_res = subprocess.run(
                ['ip', 'link', 'add', wg_interface, 'type', 'amneziawg'],
                check=False,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
            if add_res.returncode != 0:
                err = (add_res.stderr or '').strip()
                if 'File exists' not in err:
                    raise subprocess.CalledProcessError(add_res.returncode, add_res.args, add_res.stdout, add_res.stderr)
        subprocess.run(['ip', 'address', 'replace', f'{wg_ip_addr}/{wg_ip_cidr}', 'dev', wg_interface], check=True)
        subprocess.run(['ip', 'link', 'set', 'up', 'dev', wg_interface], check=True)

        # Шаг 2: Создание файла ключа
        subprocess.run(['touch', 'key_temp'], check=True)
        subprocess.run(['chmod', '600', 'key_temp'], check=True)
        # Запись приватного ключа в файл
        with open('key_temp', 'w') as key_file:
            key_file.write(private_key)

        # Шаг 3: Настройка WireGuard через вызов subprocess с использованием утилиты awg
        awg_params = {
            'Jc': Jc,
            'Jmin': Jmin,
            'Jmax': Jmax,
            'S1': S1,
            'S2': S2,
            'S3': S3,
            'S4': S4,
            'H1': H1,
            'H2': H2,
            'H3': H3,
            'H4': H4,
            'I1': I1,
            'I2': I2,
            'I3': I3,
            'I4': I4,
            'I5': I5,
        }
        subprocess.run(
            build_awg_set_command(wg_interface, port_number, 'key_temp', awg_version, awg_params),
            check=True
        )
            

    for id, name, client_pubkey, client_privkey, client_ip, client_wg_interface in c.execute('SELECT * FROM clients').fetchall():
        # Добавление клиента в конфигурацию WireGuard через утилиту awg
        subprocess.run(['awg', 'set', client_wg_interface, 'peer', client_pubkey, 'allowed-ips', client_ip + '/32'], check=True)
        print(f"Клиент {name} успешно добавлен в конфигурацию WireGuard")

    # Restore firewall runtime state (rules/sets/maps/custom tables) from persisted files.
    try:
        apply_firewall_rules()
        print("Firewall runtime restored from persisted manager state")
    except Exception as e:
        print(f"Firewall restore error: {e}")



# Функция для шифрования приватного ключа
def encrypt_private_key(private_key):
    # Создание экземпляра Fernet с использованием ключа шифрования
    f = Fernet(encryption_key)
    # Преобразование приватного ключа в байтовую строку
    private_key_bytes = private_key.encode('utf-8')
    # Шифрование приватного ключа
    encrypted_private_key = f.encrypt(private_key_bytes)
    # Возвращение зашифрованного приватного ключа
    return encrypted_private_key

# Функция для дешифрования приватного ключа
def decrypt_private_key(encrypted_private_key):
    try:
        token = encrypted_private_key
        if isinstance(token, str):
            token = token.encode('utf-8')

        for key in (encryption_key, encryption_key_legacy):
            try:
                f = Fernet(key)
                private_key_bytes = f.decrypt(token)
                return private_key_bytes.decode('utf-8')
            except InvalidToken:
                continue
        return "InvalidToken"
    except Exception:
        return "InvalidToken"
