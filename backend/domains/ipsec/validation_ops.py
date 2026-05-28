#!/usr/bin/python3
import ipaddress
import re


def valid_name(value, *, normalize_config_value_fn, field_name="name"):
    val = normalize_config_value_fn(value)
    if val is None or not re.fullmatch(r"[A-Za-z0-9_.:-]+", str(val)):
        raise ValueError(f"{field_name} is invalid")
    return str(val)


def normalize_ip_list(value, *, normalize_config_value_fn, field_name):
    if value is None:
        return []
    if not isinstance(value, list):
        raise ValueError(f"{field_name} must be array")
    out = []
    for raw in value:
        v = normalize_config_value_fn(raw)
        if v is None:
            continue
        out.append(str(v))
    return out


def normalize_ts_list(value, *, normalize_ip_list_fn, field_name):
    out = normalize_ip_list_fn(value, field_name)
    for token in out:
        try:
            ipaddress.ip_network(token, strict=False)
        except Exception:
            raise ValueError(f"{field_name} contains invalid CIDR")
    return out


def build_phase1_proposal_string(enc, hash_alg, dh_group, *, valid_name_fn):
    e = valid_name_fn(enc, field_name="encryption").lower()
    h = valid_name_fn(hash_alg, field_name="hash").lower()
    d = valid_name_fn(dh_group, field_name="dh_group").lower()
    return f"{e}-{h}-{d}"


def build_phase2_proposal_string(enc, auth_alg, pfs_group=None, *, valid_name_fn, normalize_config_value_fn):
    e = valid_name_fn(enc, field_name="encryption").lower()
    a = valid_name_fn(auth_alg, field_name="auth").lower()
    p = normalize_config_value_fn(pfs_group)
    if p is None:
        return f"{e}-{a}"
    return f'{e}-{a}-{valid_name_fn(p, field_name="pfs_group").lower()}'
