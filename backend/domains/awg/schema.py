#!/usr/bin/python3

# Canonical wg_interfaces SELECT projection shared by compat and backend layers.
WG_INTERFACE_COLUMNS = (
    "id, wg_interface, awg_version, port_number, wg_ip_addr, wg_ip_cidr, private_key, pubkey, "
    "srv_ip, srv_dns, Jc, Jmin, Jmax, S1, S2, S3, S4, H1, H2, H3, H4, I1, I2, I3, I4, I5"
)


def ensure_wg_interfaces_schema(cursor, *, print_fn, integrity_error_type):
    expected_columns = {
        "Jc": "INTEGER",
        "Jmin": "INTEGER",
        "Jmax": "INTEGER",
        "awg_version": "TEXT NOT NULL DEFAULT '1'",
        "S1": "INTEGER",
        "S2": "INTEGER",
        "S3": "INTEGER",
        "S4": "INTEGER",
        "H1": "TEXT",
        "H2": "TEXT",
        "H3": "TEXT",
        "H4": "TEXT",
        "I1": "TEXT",
        "I2": "TEXT",
        "I3": "TEXT",
        "I4": "TEXT",
        "I5": "TEXT",
    }
    existing_columns = {
        row[1] for row in cursor.execute("PRAGMA table_info(wg_interfaces)").fetchall()
    }
    for column_name, column_type in expected_columns.items():
        if column_name not in existing_columns:
            cursor.execute(
                f"ALTER TABLE wg_interfaces ADD COLUMN {column_name} {column_type}"
            )

    # Enforce unique interface names for all new writes.
    try:
        cursor.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_wg_interfaces_wg_interface_unique "
            "ON wg_interfaces(wg_interface)"
        )
    except integrity_error_type:
        # Legacy DB may already contain duplicates; keep runtime working and
        # rely on service-level checks to block new duplicates.
        print_fn("Warning: duplicate wg_interface names found, unique index was not created")
