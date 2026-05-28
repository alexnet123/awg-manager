#!/usr/bin/python3
import base64
import binascii
import io
import sqlite3
import tempfile

import segno

from backend.common import api_key_store


def load_api_key(*, api_key_env_var, api_key_file, normalize_config_value_fn):
    return api_key_store.load_api_key(
        api_key_env_var,
        api_key_file,
        normalize_config_value_fn,
    )


def save_api_key(api_key, *, api_key_file, normalize_config_value_fn):
    return api_key_store.save_api_key(
        api_key,
        api_key_file,
        normalize_config_value_fn,
    )


def verify_api_auth(api_key, _provided_encryption_secret, *, load_api_key_fn, normalize_config_value_fn):
    saved_api_key = load_api_key_fn()
    if saved_api_key is None:
        return False, "API key is not configured"
    if normalize_config_value_fn(api_key) != saved_api_key:
        return False, "Invalid API key"
    return True, None


def rotate_api_key(*, save_api_key_fn):
    return api_key_store.rotate_api_key(save_api_key_fn)


def render_qr_in_terminal(content):
    qr_code = segno.make(content)
    qr_code.terminal(compact=True)


def build_qr_svg(content):
    qr_code = segno.make(content)
    output = io.BytesIO()
    qr_code.save(output, kind="svg", scale=4)
    return output.getvalue()


def read_database_bytes(*, db_file_path):
    with open(db_file_path, "rb") as db_file:
        return db_file.read()


def restore_database_from_bytes(
    raw_bytes,
    *,
    cursor,
    conn,
    sqlite_connect_fn=sqlite3.connect,
    named_temporary_file_factory_fn=tempfile.NamedTemporaryFile,
    path_exists_fn=None,
    unlink_fn=None,
):
    if not raw_bytes:
        raise ValueError("Backup payload is empty")
    if not isinstance(raw_bytes, (bytes, bytearray)):
        raise ValueError("Backup payload must be bytes")
    if len(raw_bytes) < 100:
        raise ValueError("Backup payload is too small")

    if path_exists_fn is None:
        import os

        path_exists_fn = os.path.exists
    if unlink_fn is None:
        import os

        unlink_fn = os.unlink

    temp_path = None
    try:
        with named_temporary_file_factory_fn(delete=False) as temp_db:
            temp_db.write(raw_bytes)
            temp_path = temp_db.name

        src_conn = sqlite_connect_fn(temp_path)
        src_cur = src_conn.cursor()
        src_clients = src_cur.execute("SELECT * FROM clients").fetchall()
        src_interfaces = src_cur.execute("SELECT * FROM wg_interfaces").fetchall()
        src_conn.close()

        cursor.execute("BEGIN IMMEDIATE")
        cursor.execute("DELETE FROM clients")
        cursor.execute("DELETE FROM wg_interfaces")

        if src_interfaces:
            placeholders = ",".join(["?"] * len(src_interfaces[0]))
            cursor.executemany(f"INSERT INTO wg_interfaces VALUES ({placeholders})", src_interfaces)
        if src_clients:
            placeholders = ",".join(["?"] * len(src_clients[0]))
            cursor.executemany(f"INSERT INTO clients VALUES ({placeholders})", src_clients)
        conn.commit()
    except sqlite3.Error as exc:
        conn.rollback()
        raise ValueError(f"Invalid backup database: {exc}")
    finally:
        if temp_path and path_exists_fn(temp_path):
            unlink_fn(temp_path)


def decode_base64_payload(payload):
    try:
        return base64.b64decode(payload, validate=True)
    except (ValueError, binascii.Error):
        raise ValueError("Invalid base64 backup payload")
