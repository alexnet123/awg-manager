from backend.domains.firewall import helper_service_ops


def _normalize(value):
    if value is None:
        return None
    return str(value).strip() or None


def test_normalize_nft_timeout_and_timeout_to_seconds():
    assert helper_service_ops.normalize_nft_timeout("2m30s", normalize_value_fn=_normalize) == "150s"
    assert helper_service_ops.timeout_to_seconds(
        "2m30s",
        normalize_value_fn=_normalize,
        normalize_nft_timeout_fn=lambda value: helper_service_ops.normalize_nft_timeout(
            value, normalize_value_fn=_normalize
        ),
    ) == 150


def test_load_effective_table_objects_by_kind_merges_runtime_and_declared():
    runtime = {"counter": {"rt1"}, "limit": set()}
    objects = {
        "objects": [
            {"family": "inet", "table": "filter", "kind": "counter", "name": "decl1", "enabled": True},
            {"family": "inet", "table": "filter", "kind": "quota", "name": "decl2", "enabled": True},
            {"family": "inet", "table": "filter", "kind": "counter", "name": "off", "enabled": False},
        ]
    }
    out = helper_service_ops.load_effective_table_objects_by_kind(
        "inet",
        "filter",
        named_object_kinds=("counter", "limit", "quota"),
        read_objects_fn=lambda: objects,
        list_runtime_objects_fn=lambda family, table: runtime,
        normalize_value_fn=_normalize,
    )
    assert out["counter"] == {"rt1", "decl1"}
    assert out["quota"] == {"decl2"}


def test_append_table_script_lines_builds_table_chain_and_rule_lines():
    script_lines = []
    helper_service_ops.append_table_script_lines(
        script_lines=script_lines,
        table_family="inet",
        nft_table="filter",
        table_defs={("inet", "filter"): [("input", "filter", "input", 0, None, "accept")]},
        sets_data={"addr": [], "port": [], "iface": []},
        maps_data={"map": [], "vmap": []},
        rules=[
            {
                "enabled": True,
                "table": "filter",
                "family": "inet",
                "chain": "input",
                "expr": "meta l4proto tcp accept",
            }
        ],
        named_objects_data={"objects": []},
        table_prefix="",
        default_family="inet",
        normalize_value_fn=_normalize,
        render_rule_fn=lambda rule, table_family="inet": rule["expr"],
        include_runtime_objects=False,
    )
    assert script_lines[0] == "add table inet filter"
    assert script_lines[1] == "add chain inet filter input { type filter hook input priority 0; policy accept; }"
    assert script_lines[2] == "add rule inet filter input meta l4proto tcp accept"


def test_collect_table_defs_merges_default_and_custom_tables():
    out = helper_service_ops.collect_table_defs(
        default_table_defs={"filter": [("input", "filter", "input", 0, None, "accept")]},
        read_tables_fn=lambda: {
            "tables": [
                {
                    "family": "inet",
                    "table_name": "custom",
                    "chain_name": "custom_input",
                    "chain_type": "filter",
                    "hook": "input",
                    "priority": 10,
                    "policy": "accept",
                    "enabled": True,
                }
            ]
        },
        normalize_value_fn=_normalize,
        supported_families=("inet", "ip", "ip6"),
        default_family="inet",
    )
    assert ("inet", "filter") in out
    assert ("inet", "custom") in out
