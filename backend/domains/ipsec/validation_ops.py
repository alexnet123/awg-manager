#!/usr/bin/python3
import ipaddress
import re


_TS_SELECTOR_RE = re.compile(
    r"^(?P<base>[^\[\]]+)(?:\[(?P<proto>[A-Za-z0-9_-]+)(?:/(?P<port_start>\d+)(?:-(?P<port_end>\d+))?)?\])?$"
)


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
        _validate_traffic_selector(token, field_name=field_name)
    return out


def _validate_traffic_selector(token, *, field_name):
    match = _TS_SELECTOR_RE.fullmatch(str(token))
    if not match:
        raise ValueError(f"{field_name} contains invalid traffic selector")

    base = match.group("base").strip()
    if base == "dynamic":
        pass
    else:
        try:
            ipaddress.ip_network(base, strict=False)
        except Exception:
            raise ValueError(f"{field_name} contains invalid traffic selector")

    port_start = match.group("port_start")
    port_end = match.group("port_end")
    if port_start is None:
        return
    start = int(port_start)
    end = int(port_end) if port_end is not None else start
    if start > end or start < 0 or end > 65535:
        raise ValueError(f"{field_name} contains invalid traffic selector")


def is_aead_algorithm(value):
    alg = str(value or "").lower()
    return "gcm" in alg or "ccm" in alg or alg == "chacha20poly1305"


def build_phase1_proposal_string(enc, hash_alg, dh_group, prf_alg=None, *, valid_name_fn):
    e = valid_name_fn(enc, field_name="encryption").lower()
    d = valid_name_fn(dh_group, field_name="dh_group").lower()
    p = valid_name_fn(prf_alg, field_name="prf").lower() if prf_alg else None
    if is_aead_algorithm(e):
        return "-".join(part for part in (e, p, d) if part)
    h = valid_name_fn(hash_alg, field_name="hash").lower()
    if p:
        return f"{e}-{h}-{p}-{d}"
    return f"{e}-{h}-{d}"


def build_phase2_proposal_string(
    enc,
    auth_alg,
    pfs_group=None,
    esn=None,
    *,
    valid_name_fn,
    normalize_config_value_fn,
):
    e = valid_name_fn(enc, field_name="encryption").lower()
    p = normalize_config_value_fn(pfs_group)
    esn_value = normalize_config_value_fn(esn)
    parts = [e]
    if not is_aead_algorithm(e):
        parts.append(valid_name_fn(auth_alg, field_name="auth").lower())
    if p is not None:
        parts.append(valid_name_fn(p, field_name="pfs_group").lower())
    if esn_value is not None:
        parts.append(valid_name_fn(esn_value, field_name="esn").lower())
    return "-".join(parts)
