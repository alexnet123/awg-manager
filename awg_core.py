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
if os.path.isdir(bd_path):
    # Подключение к базе данных
    conn = sqlite3.connect(bd_path+"/"+"clients.db")
else:
    print('Directory does not exist')
    os.system("mkdir "+bd_path)
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
    client_data = {
        'id': row[0],
        'name': row[1],
        'pubkey': row[2],
        'ip': row[4],
        'wg_interface': row[5],
    }
    if include_private_key:
        client_data['privkey'] = decrypt_private_key(row[3])
    return client_data


def build_client_config(client_row, interface_row):
    awg_params = build_awg_params_from_row(interface_row)
    client_lines = build_client_config_lines(
        str(decrypt_private_key(client_row[3])),
        client_row[4],
        interface_row[9],
        interface_row[2],
        awg_params,
        interface_row[7],
        interface_row[8],
        interface_row[3]
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
        subprocess.run(['ip', 'address', 'add', f'{wg_ip_addr}/{wg_ip_cidr}', 'dev', wg_interface], check=True)
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
    conn.commit()
    subprocess.run(['awg', 'set', wg_interface, 'peer', public_key, 'allowed-ips', client_ip + '/32'], check=True)

    return c.execute('SELECT * FROM clients WHERE id = last_insert_rowid()').fetchone()


def delete_client_service(client_id):
    row = c.execute('SELECT * FROM clients WHERE id = ?', (client_id,)).fetchone()
    if not row:
        raise LookupError('Client not found')

    subprocess.run(['awg', 'set', row[5], 'peer', row[2], 'remove'], check=True)
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


def build_client_config_lines(client_private_key, client_ip, srv_dns, awg_version, awg_params, server_pubkey, srv_ip, port_number):
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
        'AllowedIPs = 0.0.0.0/0',
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
        for id, name, pubkey, privkey, ip, wg_interface in c.execute("SELECT * FROM clients WHERE wg_interface = '"+wg_interface+"'").fetchall():
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
    c.execute("DELETE FROM wg_interfaces WHERE wg_interface = '"+wg_interface+"';")
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


    pubkey2 = c.execute("SELECT pubkey FROM clients where id = '"+id+"'").fetchone()
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
            # Выполняем команду и сохраняем ее вывод в переменной output
            output = subprocess.check_output("ip link show | awk -F': ' '/^.*wg/{print $2}'", shell=True)

            # Разбиваем вывод по символу переноса строки и преобразуем его в список
            interfaces = output.decode().strip().split('\n')

            count = subprocess.run('ip link show | grep -Pc "wg\\d"', capture_output=True, shell=True, text=True)

            if len(count.stdout.strip()) == 0:
                print("No matching interfaces to remove")
            else:    
                i = 1
                while i < len(interfaces):
                    subprocess.run(['ip', 'link', 'delete', interfaces[i] ], check=True)
                    i = i + 1
        except subprocess.CalledProcessError as e:
            print(f'Error setting: {e}')


    # Обновляем запрос и распаковку в соответствии с количеством столбцов в таблице wg_interfaces
    for row in c.execute(f'SELECT {WG_INTERFACE_COLUMNS} FROM wg_interfaces').fetchall():
        id, wg_interface, awg_version, port_number, wg_ip_addr, wg_ip_cidr, private_key, pubkey, srv_ip, srv_dns, Jc, Jmin, Jmax, S1, S2, S3, S4, H1, H2, H3, H4, I1, I2, I3, I4, I5 = row
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
