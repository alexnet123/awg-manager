from backend.domains.awg import schema
import sqlite3


def test_wg_interface_columns_projection_contains_required_fields():
    columns = [item.strip() for item in schema.WG_INTERFACE_COLUMNS.split(",")]
    assert columns[0] == "id"
    assert "wg_interface" in columns
    assert "private_key" in columns
    assert "pubkey" in columns
    assert "srv_ip" in columns
    assert "I5" in columns
    assert "enabled" in columns
    assert len(columns) == len(set(columns))


def test_ensure_wg_interfaces_schema_adds_enabled_column():
    conn = sqlite3.connect(":memory:")
    try:
        cursor = conn.cursor()
        cursor.execute(
            """CREATE TABLE wg_interfaces (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                wg_interface TEXT,
                awg_version TEXT,
                port_number INTEGER,
                wg_ip_addr TEXT,
                wg_ip_cidr INTEGER,
                private_key TEXT,
                pubkey TEXT,
                srv_ip TEXT,
                srv_dns TEXT
            )"""
        )
        schema.ensure_wg_interfaces_schema(
            cursor,
            print_fn=lambda _message: None,
            integrity_error_type=sqlite3.IntegrityError,
        )
        columns = {row[1] for row in cursor.execute("PRAGMA table_info(wg_interfaces)").fetchall()}
        assert "enabled" in columns
    finally:
        conn.close()
