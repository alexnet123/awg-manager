#!/usr/bin/python3


def list_ipsec_identities(*, read_collection_fn):
    out = []
    for row in read_collection_fn():
        item = dict(row)
        item.pop("psk_encrypted", None)
        item["enabled"] = bool(row.get("enabled", True))
        item["has_psk"] = bool(row.get("psk_encrypted"))
        out.append(item)
    return out


def list_ipsec_policies(*, read_collection_fn):
    out = []
    for row in read_collection_fn():
        item = dict(row)
        item["local_ts"] = list(row.get("local_ts") or [])[:1]
        item["remote_ts"] = list(row.get("remote_ts") or [])[:1]
        out.append(item)
    return out


def ensure_item_exists_by_name(item_name, *, read_collection_fn, error_message):
    if not any(x.get("name") == str(item_name) for x in read_collection_fn()):
        raise ValueError(error_message)
