#!/usr/bin/python3
import json
import re
import subprocess

from ...common.manager_access import get_manager


_TABLE_ROW_RE = re.compile(r"^table\s+([A-Za-z0-9_]+)\s+([A-Za-z0-9_.:-]+)$")
_OBJECT_PATTERNS = {
    "counter": re.compile(r"^\s*counter\s+([A-Za-z0-9_.:-]+)\s*\{"),
    "limit": re.compile(r"^\s*limit\s+([A-Za-z0-9_.:-]+)\s*\{"),
    "quota": re.compile(r"^\s*quota\s+([A-Za-z0-9_.:-]+)\s*\{"),
    "ct_helper": re.compile(r"^\s*ct helper\s+([A-Za-z0-9_.:-]+)\s*\{"),
    "ct_timeout": re.compile(r"^\s*ct timeout\s+([A-Za-z0-9_.:-]+)\s*\{"),
    "ct_expectation": re.compile(r"^\s*ct expectation\s+([A-Za-z0-9_.:-]+)\s*\{"),
}
_EMPTY_RUNTIME_COLLECTIONS = {
    "addr": [],
    "port": [],
    "iface": [],
    "map": [],
    "vmap": [],
}


def list_tables(supported_families):
    res = subprocess.run(
        ["nft", "list", "tables"],
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    if res.returncode != 0:
        return []
    out = []
    for line in (res.stdout or "").splitlines():
        match = _TABLE_ROW_RE.match(line.strip())
        if not match:
            continue
        family = str(match.group(1)).lower()
        name = str(match.group(2)).strip().lower()
        if family in supported_families and name:
            out.append((family, name))
    return sorted(set(out))


def delete_table(family, table_name):
    subprocess.run(
        ["nft", "delete", "table", str(family), str(table_name)],
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def apply_script(script_text):
    subprocess.run(["nft", "-f", "-"], input=str(script_text).encode("utf-8"), check=True)


def reset_table_named_counters(family, table_name):
    try:
        subprocess.run(
            ["nft", "reset", "counters", "table", str(family), str(table_name)],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return True
    except Exception:
        return False


def reset_table_named_quotas(family, table_name):
    try:
        subprocess.run(
            ["nft", "reset", "quotas", "table", str(family), str(table_name)],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return True
    except Exception:
        return False


def list_table_objects_by_kind(family, table_name):
    result = {kind: set() for kind in _OBJECT_PATTERNS}
    res = subprocess.run(
        ["nft", "list", "table", str(family), str(table_name)],
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    if res.returncode != 0:
        return result
    for line in (res.stdout or "").splitlines():
        for kind, pattern in _OBJECT_PATTERNS.items():
            match = pattern.match(line)
            if match:
                result[kind].add(str(match.group(1)).lower())
    return result


def _empty_runtime_collections():
    return {kind: [] for kind in _EMPTY_RUNTIME_COLLECTIONS}


def _stringify_nft_value(value):
    if isinstance(value, dict):
        if "prefix" in value and isinstance(value["prefix"], dict):
            addr = value["prefix"].get("addr")
            length = value["prefix"].get("len")
            if addr is not None and length is not None:
                return f"{addr}/{length}"
        for verdict in ("accept", "drop", "queue", "continue", "return"):
            if verdict in value:
                return verdict
        if "val" in value:
            return _stringify_nft_value(value.get("val"))
    return str(value).strip()


def _iter_nft_elements(raw):
    if not isinstance(raw, list):
        return
    for item in raw:
        if isinstance(item, dict) and isinstance(item.get("elem"), dict):
            elem = item["elem"]
            yield _stringify_nft_value(elem.get("val")), _stringify_nft_value(elem.get("data"))
        else:
            yield _stringify_nft_value(item), None


def parse_runtime_collections_from_ruleset_json(nft_json, supported_families):
    out = _empty_runtime_collections()
    supported = {str(fam).lower() for fam in supported_families}
    for item in (nft_json or {}).get("nftables", []):
        if not isinstance(item, dict):
            continue
        payload = item.get("set") or item.get("map")
        if not isinstance(payload, dict):
            continue
        family = str(payload.get("family") or "").lower()
        table_name = str(payload.get("table") or "").strip()
        name = str(payload.get("name") or "").strip()
        key_type = str(payload.get("type") or "").lower()
        map_type = str(payload.get("map") or "").lower()
        if family not in supported or not table_name or not name:
            continue

        collection_kind = None
        if map_type == "verdict":
            collection_kind = "vmap"
        elif map_type:
            collection_kind = "map"
        elif key_type in ("ipv4_addr", "ipv6_addr"):
            collection_kind = "addr"
        elif key_type == "inet_service":
            collection_kind = "port"
        elif key_type == "ifname":
            collection_kind = "iface"
        if collection_kind is None:
            continue

        row = {
            "id": f"runtime:{family}:{table_name}:{collection_kind}:{name}",
            "name": name,
            "family": family,
            "table": table_name,
            "enabled": True,
            "runtime_only": True,
            "kind": collection_kind,
        }
        if collection_kind in ("map", "vmap"):
            entries = []
            for key, value in _iter_nft_elements(payload.get("elem") or []):
                if key and value:
                    entries.append(f"{key}:{value}")
            row["entries"] = entries
        else:
            row["elements"] = [key for key, _value in _iter_nft_elements(payload.get("elem") or []) if key]
        out[collection_kind].append(row)
    for kind in out:
        out[kind].sort(key=lambda row: (row.get("family", ""), row.get("table", ""), row.get("name", "")))
    return out


def list_runtime_collections(supported_families):
    try:
        json_res = subprocess.run(
            ["nft", "-j", "list", "ruleset"],
            check=True,
            capture_output=True,
            text=True,
        )
        nft_json = json.loads(json_res.stdout or "{}")
    except Exception:
        return _empty_runtime_collections()
    return parse_runtime_collections_from_ruleset_json(nft_json, supported_families)


def get_ruleset_text():
    try:
        txt_res = subprocess.run(
            ["nft", "list", "ruleset"],
            check=True,
            capture_output=True,
            text=True,
        )
        return txt_res.stdout
    except Exception:
        return ""


def get_ruleset_counter_index(table_prefix):
    try:
        json_res = subprocess.run(
            ["nft", "-j", "list", "ruleset"],
            check=True,
            capture_output=True,
            text=True,
        )
        nft_json = json.loads(json_res.stdout or "{}")
    except Exception:
        return False, {}
    rules_by_table_chain = {}
    active = False
    for item in nft_json.get("nftables", []):
        rule_payload = item.get("rule")
        if not rule_payload:
            continue
        runtime_family = str(rule_payload.get("family") or "").lower()
        table_name = str(rule_payload.get("table") or "")
        if not table_name.startswith(str(table_prefix)):
            continue
        chain_name = rule_payload.get("chain")
        if chain_name is None:
            continue
        nft_table = table_name.replace(str(table_prefix), "", 1)
        expr = rule_payload.get("expr", [])
        counter_item = next(
            (x.get("counter") for x in expr if isinstance(x, dict) and "counter" in x),
            None,
        )
        if not isinstance(counter_item, dict):
            counter_item = None
        rules_by_table_chain.setdefault((runtime_family, nft_table, chain_name), []).append(
            {
                "packets": int(counter_item.get("packets", 0)) if counter_item else 0,
                "bytes": int(counter_item.get("bytes", 0)) if counter_item else 0,
            }
        )
        active = True
    return active, rules_by_table_chain


def build_runtime_counters_by_rule(rules, rules_by_table_chain, default_family):
    runtime_counters = {}
    chain_runtime_index = {}
    for rule in rules:
        if not rule.get("enabled", True):
            continue
        nft_table = rule.get("table")
        chain_name = rule.get("chain")
        family = str(rule.get("family") or default_family).lower()
        key = (family, nft_table, chain_name)
        idx = chain_runtime_index.get(key, 0)
        counter_list = rules_by_table_chain.get(key, [])
        if idx < len(counter_list):
            runtime_counters[rule["id"]] = counter_list[idx]
        chain_runtime_index[key] = idx + 1
    return runtime_counters


def enrich_rules_with_runtime_stats(rules, runtime_counters, stats_store, now_ts):
    enriched_rules = []
    next_stats_store = dict(stats_store or {})
    for rule in rules:
        payload = dict(rule)
        counter = runtime_counters.get(rule["id"])
        packets = counter.get("packets") if counter else 0
        bytes_count = counter.get("bytes") if counter else 0
        payload["runtime_packets"] = packets
        payload["runtime_bytes"] = bytes_count

        stat_row = (
            next_stats_store.get(rule["id"])
            if isinstance(next_stats_store.get(rule["id"]), dict)
            else {}
        )
        last = stat_row.get("last") if isinstance(stat_row, dict) else None
        prev_packets = int(last.get("packets", packets)) if isinstance(last, dict) else int(packets)
        prev_bytes = int(last.get("bytes", bytes_count)) if isinstance(last, dict) else int(bytes_count)
        prev_t = float(last.get("t", now_ts)) if isinstance(last, dict) else float(now_ts)

        counter_enabled = bool(payload.get("counter"))
        reset_detected = int(packets) < prev_packets or int(bytes_count) < prev_bytes or now_ts < prev_t
        dt = max(0.001, float(now_ts) - float(prev_t))
        dpk = max(0, int(packets) - prev_packets)
        dby = max(0, int(bytes_count) - prev_bytes)
        if not counter_enabled or reset_detected:
            pps = 0.0
            bps = 0.0
        else:
            pps = dpk / dt
            bps = dby / dt
        payload["runtime_pps"] = pps
        payload["runtime_bps"] = bps

        history = stat_row.get("history", []) if isinstance(stat_row, dict) else []
        if not isinstance(history, list):
            history = []
        if not counter_enabled or reset_detected:
            history = []
        history.append(
            {
                "t": now_ts,
                "pps": pps,
                "bps": bps,
                "packets": int(packets),
                "bytes": int(bytes_count),
            }
        )
        history = history[-120:]
        payload["runtime_history"] = history
        next_stats_store[rule["id"]] = {
            "last": {"t": now_ts, "packets": int(packets), "bytes": int(bytes_count)},
            "history": history,
        }
        enriched_rules.append(payload)
    return enriched_rules, next_stats_store


def apply_rules():
    get_manager().apply_firewall_rules()
