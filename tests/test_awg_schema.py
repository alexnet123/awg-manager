from backend.domains.awg import schema


def test_wg_interface_columns_projection_contains_required_fields():
    columns = [item.strip() for item in schema.WG_INTERFACE_COLUMNS.split(",")]
    assert columns[0] == "id"
    assert "wg_interface" in columns
    assert "private_key" in columns
    assert "pubkey" in columns
    assert "srv_ip" in columns
    assert "I5" in columns
    assert len(columns) == len(set(columns))
