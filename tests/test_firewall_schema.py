from backend.domains.firewall import schema


def test_firewall_schema_constants_have_expected_shape():
    assert schema.FIREWALL_TABLE_FAMILY == "inet"
    assert "inet" in schema.FIREWALL_SUPPORTED_TABLE_FAMILIES
    assert "counter" in schema.FIREWALL_NAMED_OBJECT_KINDS
    assert isinstance(schema.FIREWALL_TABLE_PREFIX, str)
    assert "filter" in schema.FIREWALL_DEFAULT_TABLE_DEFS
    assert 0 in schema.FIREWALL_RESERVED_PRIORITIES
    assert schema.FIREWALL_SCHEMA.get("family") == schema.FIREWALL_TABLE_FAMILY
