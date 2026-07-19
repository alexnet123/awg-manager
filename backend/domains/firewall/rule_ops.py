#!/usr/bin/python3
import ipaddress
import re


IDENTITY_KEYS = (
    "table",
    "family",
    "chain",
    "action",
    "proto",
    "src",
    "dst",
    "in_interface",
    "out_interface",
    "ibrname",
    "obrname",
    "sport",
    "dport",
    "comment",
    "ct_state",
    "user_id",
    "hour",
    "dscp",
    "nat_type",
    "target_chain",
    "reject_type",
    "to_addr",
    "to_port",
    "nat_random",
    "nat_fully_random",
    "nat_persistent",
    "notrack",
    "raw_expr",
    "nftrace",
    "tcp_flags",
    "icmp_type",
    "icmp_code",
    "icmpv6_type",
    "icmpv6_code",
    "meta_length",
    "meta_priority",
    "meta_cpu",
    "meta_pkttype",
    "meta_iiftype",
    "meta_oiftype",
    "meta_iifgroup",
    "meta_oifgroup",
    "mark_match",
    "ct_mark_match",
    "ct_status",
    "ct_direction",
    "ct_expiration",
    "ct_helper_match",
    "ct_label",
    "ct_event",
    "ct_original_saddr",
    "ct_original_daddr",
    "ct_reply_saddr",
    "ct_reply_daddr",
    "fib_check",
    "socket_match",
    "rt_nexthop",
    "ipv6_exthdrs",
    "vlan_id",
    "ether_src",
    "ether_dst",
    "ether_type",
    "mark_set",
    "ct_mark_set",
    "log_prefix",
    "log_level",
    "log_flags",
    "log_group",
    "log_snaplen",
    "log_queue_threshold",
    "fib_expr",
    "socket_expr",
    "rt_expr",
    "exthdr_expr",
    "ct_helper_set",
    "ct_timeout_set",
    "ct_expectation_set",
    "counter_name",
    "limit_name",
    "quota_name",
    "queue_num",
    "queue_flags",
    "dup_to",
    "dup_dev",
    "fwd_to",
    "fwd_dev",
    "fwd_family",
    "set_stmt_op",
    "set_stmt_name",
    "set_stmt_expr",
    "set_stmt_timeout",
    "set_stmt_comment",
    "vmap_stmt_expr",
    "vmap_stmt_name",
    "limit_rate",
    "counter",
    "enabled",
)


def extract_normalized_rule_inputs(payload, normalize_value_fn):
    family = normalize_value_fn(payload.get("family")) or "inet"
    nft_table = (normalize_value_fn(payload.get("table")) or "filter").lower()
    chain = (normalize_value_fn(payload.get("chain")) or "").lower()
    action = (normalize_value_fn(payload.get("action")) or "").lower()
    proto = normalize_value_fn(payload.get("proto"))
    src = normalize_value_fn(payload.get("src"))
    dst = normalize_value_fn(payload.get("dst"))
    in_interface = normalize_value_fn(payload.get("in_interface"))
    out_interface = normalize_value_fn(payload.get("out_interface"))
    ibrname = normalize_value_fn(payload.get("ibrname"))
    obrname = normalize_value_fn(payload.get("obrname"))
    dport = normalize_value_fn(payload.get("dport"))
    sport = normalize_value_fn(payload.get("sport"))
    comment = normalize_value_fn(payload.get("comment"))
    ct_state = normalize_value_fn(payload.get("ct_state"))
    user_id = normalize_value_fn(payload.get("user_id"))
    hour = normalize_value_fn(payload.get("hour"))
    dscp = normalize_value_fn(payload.get("dscp"))
    nat_type = normalize_value_fn(payload.get("nat_type"))
    target_chain = normalize_value_fn(payload.get("target_chain"))
    reject_type = normalize_value_fn(payload.get("reject_type"))
    to_addr = normalize_value_fn(payload.get("to_addr"))
    to_port = normalize_value_fn(payload.get("to_port"))
    notrack = payload.get("notrack", False)
    mark_set = normalize_value_fn(payload.get("mark_set"))
    ct_mark_set = normalize_value_fn(payload.get("ct_mark_set"))
    log_prefix = normalize_value_fn(payload.get("log_prefix"))
    log_level = normalize_value_fn(payload.get("log_level"))
    log_flags_raw = payload.get("log_flags")
    log_group = normalize_value_fn(payload.get("log_group"))
    log_snaplen = normalize_value_fn(payload.get("log_snaplen"))
    log_queue_threshold = normalize_value_fn(payload.get("log_queue_threshold"))
    fib_expr = normalize_value_fn(payload.get("fib_expr"))
    socket_expr = normalize_value_fn(payload.get("socket_expr"))
    rt_expr = normalize_value_fn(payload.get("rt_expr"))
    exthdr_expr = normalize_value_fn(payload.get("exthdr_expr"))
    raw_expr = normalize_value_fn(payload.get("raw_expr"))
    nftrace = payload.get("nftrace", False)
    tcp_flags = normalize_value_fn(payload.get("tcp_flags"))
    icmp_type = normalize_value_fn(payload.get("icmp_type"))
    icmp_code = normalize_value_fn(payload.get("icmp_code"))
    icmpv6_type = normalize_value_fn(payload.get("icmpv6_type"))
    icmpv6_code = normalize_value_fn(payload.get("icmpv6_code"))
    meta_length = normalize_value_fn(payload.get("meta_length"))
    meta_priority = normalize_value_fn(payload.get("meta_priority"))
    meta_cpu = normalize_value_fn(payload.get("meta_cpu"))
    meta_pkttype = normalize_value_fn(payload.get("meta_pkttype"))
    meta_iiftype = normalize_value_fn(payload.get("meta_iiftype"))
    meta_oiftype = normalize_value_fn(payload.get("meta_oiftype"))
    meta_iifgroup = normalize_value_fn(payload.get("meta_iifgroup"))
    meta_oifgroup = normalize_value_fn(payload.get("meta_oifgroup"))
    mark_match = normalize_value_fn(payload.get("mark_match"))
    ct_mark_match = normalize_value_fn(payload.get("ct_mark_match"))
    ct_status = normalize_value_fn(payload.get("ct_status"))
    ct_direction = normalize_value_fn(payload.get("ct_direction"))
    ct_expiration = normalize_value_fn(payload.get("ct_expiration"))
    ct_helper_match = normalize_value_fn(payload.get("ct_helper_match"))
    ct_label = normalize_value_fn(payload.get("ct_label"))
    ct_event = normalize_value_fn(payload.get("ct_event"))
    ct_original_saddr = normalize_value_fn(payload.get("ct_original_saddr"))
    ct_original_daddr = normalize_value_fn(payload.get("ct_original_daddr"))
    ct_reply_saddr = normalize_value_fn(payload.get("ct_reply_saddr"))
    ct_reply_daddr = normalize_value_fn(payload.get("ct_reply_daddr"))
    fib_check = normalize_value_fn(payload.get("fib_check"))
    socket_match = normalize_value_fn(payload.get("socket_match"))
    rt_nexthop = normalize_value_fn(payload.get("rt_nexthop"))
    ipv6_exthdrs = normalize_value_fn(payload.get("ipv6_exthdrs"))
    vlan_id = normalize_value_fn(payload.get("vlan_id"))
    ether_src = normalize_value_fn(payload.get("ether_src"))
    ether_dst = normalize_value_fn(payload.get("ether_dst"))
    ether_type = normalize_value_fn(payload.get("ether_type"))
    ct_helper_set = normalize_value_fn(payload.get("ct_helper_set"))
    ct_timeout_set = normalize_value_fn(payload.get("ct_timeout_set"))
    ct_expectation_set = normalize_value_fn(payload.get("ct_expectation_set"))
    counter_name = normalize_value_fn(payload.get("counter_name"))
    limit_name = normalize_value_fn(payload.get("limit_name"))
    quota_name = normalize_value_fn(payload.get("quota_name"))
    queue_num = normalize_value_fn(payload.get("queue_num"))
    queue_flags_raw = payload.get("queue_flags")
    dup_to = normalize_value_fn(payload.get("dup_to"))
    dup_dev = normalize_value_fn(payload.get("dup_dev"))
    fwd_to = normalize_value_fn(payload.get("fwd_to"))
    fwd_dev = normalize_value_fn(payload.get("fwd_dev"))
    fwd_family = normalize_value_fn(payload.get("fwd_family"))
    set_stmt_op = normalize_value_fn(payload.get("set_stmt_op"))
    set_stmt_name = normalize_value_fn(payload.get("set_stmt_name"))
    set_stmt_expr = normalize_value_fn(payload.get("set_stmt_expr"))
    set_stmt_timeout = normalize_value_fn(payload.get("set_stmt_timeout"))
    set_stmt_comment = normalize_value_fn(payload.get("set_stmt_comment"))
    vmap_stmt_expr = normalize_value_fn(payload.get("vmap_stmt_expr"))
    vmap_stmt_name = normalize_value_fn(payload.get("vmap_stmt_name"))
    nat_random = payload.get("nat_random", False)
    nat_fully_random = payload.get("nat_fully_random", False)
    nat_persistent = payload.get("nat_persistent", False)
    limit_rate = normalize_value_fn(payload.get("limit_rate"))
    counter = payload.get("counter", False)
    enabled = payload.get("enabled", True)

    return (
        family,
        nft_table,
        chain,
        action,
        proto,
        src,
        dst,
        in_interface,
        out_interface,
        ibrname,
        obrname,
        dport,
        sport,
        comment,
        ct_state,
        user_id,
        hour,
        dscp,
        nat_type,
        target_chain,
        reject_type,
        to_addr,
        to_port,
        notrack,
        mark_set,
        ct_mark_set,
        log_prefix,
        log_level,
        log_flags_raw,
        log_group,
        log_snaplen,
        log_queue_threshold,
        fib_expr,
        socket_expr,
        rt_expr,
        exthdr_expr,
        raw_expr,
        nftrace,
        tcp_flags,
        icmp_type,
        icmp_code,
        icmpv6_type,
        icmpv6_code,
        meta_length,
        meta_priority,
        meta_cpu,
        meta_pkttype,
        meta_iiftype,
        meta_oiftype,
        meta_iifgroup,
        meta_oifgroup,
        mark_match,
        ct_mark_match,
        ct_status,
        ct_direction,
        ct_expiration,
        ct_helper_match,
        ct_label,
        ct_event,
        ct_original_saddr,
        ct_original_daddr,
        ct_reply_saddr,
        ct_reply_daddr,
        fib_check,
        socket_match,
        rt_nexthop,
        ipv6_exthdrs,
        vlan_id,
        ether_src,
        ether_dst,
        ether_type,
        ct_helper_set,
        ct_timeout_set,
        ct_expectation_set,
        counter_name,
        limit_name,
        quota_name,
        queue_num,
        queue_flags_raw,
        dup_to,
        dup_dev,
        fwd_to,
        fwd_dev,
        fwd_family,
        nat_random,
        nat_fully_random,
        nat_persistent,
        limit_rate,
        counter,
        enabled,
        set_stmt_op,
        set_stmt_name,
        set_stmt_expr,
        set_stmt_timeout,
        set_stmt_comment,
        vmap_stmt_expr,
        vmap_stmt_name,
    )


def normalize_queue_dup_fwd_fields(
    action,
    table_mode,
    family,
    queue_num,
    queue_flags_raw,
    dup_to,
    dup_dev,
    fwd_to,
    fwd_dev,
    fwd_family,
):
    queue_flags = None
    if queue_flags_raw is not None:
        if isinstance(queue_flags_raw, list):
            raw_parts = []
            for token in queue_flags_raw:
                if token is None:
                    continue
                raw_parts.extend([x for x in str(token).split(",") if x.strip()])
        else:
            raw_parts = [x for x in str(queue_flags_raw).split(",") if x.strip()]
        allowed_queue_flags = {"bypass", "fanout"}
        normalized_queue_flags = []
        for token in raw_parts:
            normalized = str(token).strip().lower()
            if normalized not in allowed_queue_flags:
                raise ValueError("queue_flags supports only: bypass, fanout")
            if normalized not in normalized_queue_flags:
                normalized_queue_flags.append(normalized)
        queue_flags = normalized_queue_flags if normalized_queue_flags else None

    if queue_num is not None:
        queue_num = str(queue_num).strip()
        if not re.fullmatch(r"[0-9]{1,5}(-[0-9]{1,5})?", queue_num):
            raise ValueError("queue_num must be like 0 or 0-3")
        if "-" in queue_num:
            left, right = queue_num.split("-", 1)
            q1, q2 = int(left), int(right)
            if q1 < 0 or q2 < 0 or q1 > 65535 or q2 > 65535 or q1 > q2:
                raise ValueError("queue_num range must be within 0..65535 and start <= end")
        else:
            q = int(queue_num)
            if q < 0 or q > 65535:
                raise ValueError("queue_num must be in range 0..65535")

    if action != "queue" and (queue_num is not None or queue_flags is not None):
        raise ValueError("queue_num/queue_flags are only valid when action=queue")
    if action == "queue" and table_mode != "filter":
        raise ValueError("action=queue is currently supported only in filter table")
    if action == "queue" and isinstance(queue_flags, list) and "fanout" in queue_flags:
        if queue_num is None or "-" not in str(queue_num):
            raise ValueError("queue flag fanout requires queue_num range like 0-3")

    if dup_to is not None:
        try:
            ipaddress.ip_address(str(dup_to))
        except ValueError:
            raise ValueError("dup_to must be a valid IPv4/IPv6 address")
        dup_to = str(dup_to)

    if dup_dev is not None:
        if not re.fullmatch(r"[A-Za-z0-9_.:-]+", str(dup_dev)):
            raise ValueError("dup_dev contains invalid characters")
        dup_dev = str(dup_dev)
    if dup_to is None and dup_dev is not None:
        raise ValueError("dup_to is required when dup_dev is set")

    if fwd_family is not None:
        fwd_family = str(fwd_family).lower()
        if fwd_family not in ("ip", "ip6"):
            raise ValueError("fwd_family must be ip or ip6")
    if fwd_to is not None:
        try:
            parsed = ipaddress.ip_address(str(fwd_to))
        except ValueError:
            raise ValueError("fwd_to must be a valid IPv4/IPv6 address")
        expected_family = "ip6" if parsed.version == 6 else "ip"
        if fwd_family is None:
            fwd_family = expected_family
        elif fwd_family != expected_family:
            raise ValueError("fwd_family does not match fwd_to address family")
        fwd_to = str(fwd_to)
    if fwd_dev is not None:
        if not re.fullmatch(r"[A-Za-z0-9_.:-]+", str(fwd_dev)):
            raise ValueError("fwd_dev contains invalid characters")
        fwd_dev = str(fwd_dev)
    if fwd_to is not None and fwd_dev is None:
        raise ValueError("fwd_dev is required when fwd_to is set")
    if fwd_dev is not None and fwd_to is None:
        raise ValueError("fwd_to is required when fwd_dev is set")
    if (fwd_to is not None or fwd_dev is not None or fwd_family is not None) and family != "netdev":
        raise ValueError("fwd_to/fwd_dev/fwd_family are supported only for family=netdev")
    if action == "fwd" and fwd_to is None:
        raise ValueError("fwd_to is required when action=fwd")
    if action == "fwd" and fwd_dev is None:
        raise ValueError("fwd_dev is required when action=fwd")
    if action != "fwd" and (fwd_to is not None or fwd_dev is not None or fwd_family is not None):
        raise ValueError("fwd_to/fwd_dev/fwd_family are only valid when action=fwd")

    if family == "bridge" and (dup_to is not None or dup_dev is not None):
        raise ValueError("dup_to/dup_dev are planned for family=bridge and temporarily disabled on current nft runtime")

    return {
        "queue_num": queue_num,
        "queue_flags": queue_flags,
        "dup_to": dup_to,
        "dup_dev": dup_dev,
        "fwd_to": fwd_to,
        "fwd_dev": fwd_dev,
        "fwd_family": fwd_family,
    }


def resolve_table_chain_context(family, nft_table, chain, default_family, schema_tables, read_tables_fn):
    family = str(family).lower()
    if family not in (default_family, "ip", "ip6", "bridge", "netdev"):
        raise ValueError("family must be inet, ip, ip6, bridge, or netdev")

    table_mode = None
    chain_mode = None
    allowed_chains = ()
    selected_chain = None
    if family == default_family and nft_table in ("filter", "nat", "raw", "mangle"):
        table_mode = nft_table
        allowed_chains = tuple(schema_tables[nft_table]["chains"])
    else:
        if not re.fullmatch(r"[a-zA-Z0-9_.-]+", str(nft_table)):
            raise ValueError("table name contains invalid characters")
        custom_rows = (read_tables_fn() or {}).get("tables", [])
        table_rows = [
            row
            for row in custom_rows
            if isinstance(row, dict)
            and str((row.get("family") or default_family)).lower() == family
            and str(row.get("table_name", "")).lower() == nft_table
        ]
        if not table_rows:
            raise ValueError(f'table "{nft_table}" is not found among built-in or custom tables')
        allowed_chains = tuple(str(row.get("chain_name", "")).lower() for row in table_rows if row.get("chain_name"))
        if chain not in allowed_chains:
            raise ValueError(f'chain "{chain}" is not valid for custom table "{nft_table}"')
        selected_chain = next((row for row in table_rows if str(row.get("chain_name", "")).lower() == chain), None)
        chain_mode = str((selected_chain or {}).get("chain_type") or "filter").lower()
        if chain_mode not in ("filter", "nat", "route"):
            chain_mode = "filter"
        table_mode = "nat" if chain_mode == "nat" else "filter"

    if chain not in allowed_chains:
        raise ValueError(f'chain "{chain}" is not valid for table "{nft_table}"')

    return {
        "family": family,
        "table_mode": table_mode,
        "chain_mode": chain_mode,
        "allowed_chains": allowed_chains,
        "selected_chain": selected_chain,
    }


def validate_action_target_reject_and_proto_fields(
    action,
    family,
    table_mode,
    target_chain,
    selected_chain,
    reject_type,
    proto,
    dport,
    sport,
    allow_empty_action=False,
):
    def _normalize_proto_token(raw):
        if raw is None:
            return None
        value = str(raw).strip().lower()
        if value in ("tcp", "udp", "icmp", "icmpv6"):
            return value
        if re.fullmatch(r"[0-9]{1,3}", value):
            proto_num = int(value)
            if 0 <= proto_num <= 255:
                return value
        raise ValueError("proto must be tcp, udp, icmp, icmpv6, or numeric protocol id 0..255")

    def _proto_allows_ports(value):
        return value in ("tcp", "udp", "6", "17")

    proto = _normalize_proto_token(proto)
    if allow_empty_action and not action:
        if target_chain is not None:
            raise ValueError("target_chain is only valid for jump/goto")
        if reject_type is not None:
            raise ValueError("reject_type is only valid when action=reject")
        if dport is not None and not _proto_allows_ports(proto):
            raise ValueError("dport requires proto tcp or udp")
        if sport is not None and not _proto_allows_ports(proto):
            raise ValueError("sport requires proto tcp or udp")
        return {"proto": proto}
    if action not in ("accept", "drop", "reject", "jump", "goto", "return", "queue", "fwd"):
        raise ValueError("action must be one of: accept, drop, reject, jump, goto, return, queue, fwd")
    if action == "fwd" and family != "netdev":
        raise ValueError("action=fwd is supported only for family=netdev")
    if family == "netdev" and action == "reject":
        raise ValueError("action=reject is not supported for family=netdev")
    if table_mode != "filter" and action in ("jump", "goto", "return"):
        raise ValueError("jump/goto/return are currently supported only in filter table")
    if action in ("jump", "goto"):
        if target_chain is None:
            raise ValueError("target_chain is required for jump/goto")
        if not re.fullmatch(r"[A-Za-z0-9_.-]+", str(target_chain)):
            raise ValueError("target_chain contains invalid characters")
        if str(target_chain).lower() in ("input", "forward", "output"):
            raise ValueError("target_chain must be a user-defined chain, not base hook chain")
    elif target_chain is not None:
        raise ValueError("target_chain is only valid for jump/goto")
    if family == "bridge" and action == "reject":
        selected_hook = str((selected_chain or {}).get("hook") or "").lower()
        if selected_hook not in ("input", "prerouting"):
            raise ValueError("action=reject is valid for family=bridge only when chain hook is input or prerouting")
    if reject_type is not None:
        if action != "reject":
            raise ValueError("reject_type is only valid when action=reject")
        allowed_reject = {
            "icmpx port-unreachable",
            "icmpx admin-prohibited",
            "icmp type host-unreachable",
            "tcp reset",
        }
        if str(reject_type) not in allowed_reject:
            raise ValueError(
                "reject_type must be one of: icmpx port-unreachable | icmpx admin-prohibited | icmp type host-unreachable | tcp reset"
            )
    if dport is not None and not _proto_allows_ports(proto):
        raise ValueError("dport requires proto tcp or udp")
    if sport is not None and not _proto_allows_ports(proto):
        raise ValueError("sport requires proto tcp or udp")

    return {"proto": proto}


def normalize_proto_and_basic_match_fields(
    proto,
    dport,
    sport,
    tcp_flags,
    icmp_type,
    icmp_code,
    icmpv6_type,
    icmpv6_code,
    src,
    dst,
    in_interface,
    out_interface,
    ibrname,
    obrname,
    enabled,
    ct_state,
    user_id,
    hour,
    dscp,
    comment,
    ct_states,
):
    if tcp_flags is not None and proto != "tcp":
        raise ValueError("tcp_flags requires proto tcp")
    if (icmp_type is not None or icmp_code is not None) and proto != "icmp":
        raise ValueError("icmp_type/icmp_code require proto icmp")
    if (icmpv6_type is not None or icmpv6_code is not None) and proto != "icmpv6":
        raise ValueError("icmpv6_type/icmpv6_code require proto icmpv6")

    def _normalize_port_match(raw, field_name):
        value = str(raw).strip()
        if value.startswith("@"):
            if re.fullmatch(r"@[A-Za-z0-9_.-]+", value):
                return value
            raise ValueError(f"{field_name} must be a port, range, comma list, or @collection reference")

        def _normalize_one(token):
            token = token.strip()
            if not token:
                raise ValueError(f"{field_name} must be a port, range, comma list, or @collection reference")
            separator = ":" if ":" in token else ("-" if "-" in token else None)
            if separator:
                left, right = token.split(separator, 1)
                if not re.fullmatch(r"[0-9]{1,5}", left or "") or not re.fullmatch(r"[0-9]{1,5}", right or ""):
                    raise ValueError(f"{field_name} range must be within 1..65535 and start <= end")
                p1, p2 = int(left), int(right)
                if p1 < 1 or p2 < 1 or p1 > 65535 or p2 > 65535 or p1 > p2:
                    raise ValueError(f"{field_name} range must be within 1..65535 and start <= end")
                return f"{p1}:{p2}"
            if not re.fullmatch(r"[0-9]{1,5}", token):
                raise ValueError(f"{field_name} must be a port, range, comma list, or @collection reference")
            port = int(token)
            if port < 1 or port > 65535:
                raise ValueError(f"{field_name} must be in range 1..65535")
            return str(port)

        if "," in value:
            return ",".join(_normalize_one(part) for part in value.split(","))
        return _normalize_one(value)

    if dport is not None:
        dport = _normalize_port_match(dport, "dport")
    if sport is not None:
        sport = _normalize_port_match(sport, "sport")

    def _validate_l3_address_match(raw, field_name):
        value = str(raw).strip()
        if "," in value or "{" in value or "}" in value:
            raise ValueError(f"{field_name} must be one IP/CIDR prefix or one @collection reference")
        if value.startswith("@"):
            if not re.fullmatch(r"@[A-Za-z0-9_.-]+", value):
                raise ValueError(f"{field_name} must be one IP/CIDR prefix or one @collection reference")
            return
        try:
            ipaddress.ip_network(value, strict=False)
        except ValueError as exc:
            raise ValueError(f"{field_name} must be one IP/CIDR prefix or one @collection reference") from exc

    if src is not None:
        _validate_l3_address_match(src, "src")
    if dst is not None:
        _validate_l3_address_match(dst, "dst")

    def _validate_interface_match(raw, field_name):
        value = str(raw).strip()
        if value.startswith("@"):
            if re.fullmatch(r"@[A-Za-z0-9_.-]+", value):
                return value
            raise ValueError(f"{field_name} must be one interface name or one @collection reference")
        if not re.fullmatch(r"[A-Za-z0-9_.:-]+", value):
            raise ValueError(f"{field_name} must be one interface name or one @collection reference")
        return value

    if in_interface is not None:
        in_interface = _validate_interface_match(in_interface, "in_interface")
    if out_interface is not None:
        out_interface = _validate_interface_match(out_interface, "out_interface")
    if ibrname is not None and not re.fullmatch(r"[A-Za-z0-9_.:-]+", str(ibrname)):
        raise ValueError("ibrname contains invalid characters")
    if obrname is not None and not re.fullmatch(r"[A-Za-z0-9_.:-]+", str(obrname)):
        raise ValueError("obrname contains invalid characters")

    if not isinstance(enabled, bool):
        enabled = str(enabled).lower() in ("1", "true", "yes", "on")

    if ct_state is not None:
        ct_state = str(ct_state).lower().replace(" ", "")
        if ct_state not in tuple(ct_states or ()):
            raise ValueError("ct_state must be one of: established,related | new | invalid | related | established | untracked")

    if user_id is not None:
        if not re.fullmatch(r"[0-9]{1,10}", str(user_id)):
            raise ValueError("user_id must be positive integer uid")

    if hour is not None:
        hour = str(hour).strip()
        if not re.fullmatch(r"([01]\d|2[0-3]):[0-5]\d(?:-([01]\d|2[0-3]):[0-5]\d)?", hour):
            raise ValueError("hour must be HH:MM or HH:MM-HH:MM (24h)")

    if dscp is not None:
        dscp = str(dscp).lower().strip()
        if not re.fullmatch(r"cs[0-7]|af[1-4][1-3]|ef|[0-9]{1,2}", dscp):
            raise ValueError("dscp must be class name (cs0..cs7, af11..af43, ef) or integer 0..63")
        if dscp.isdigit() and int(dscp) > 63:
            raise ValueError("dscp integer must be in range 0..63")

    if comment is not None:
        comment = str(comment).replace('"', "'")

    return {
        "proto": proto,
        "dport": dport,
        "sport": sport,
        "src": src,
        "dst": dst,
        "in_interface": in_interface,
        "out_interface": out_interface,
        "ibrname": ibrname,
        "obrname": obrname,
        "enabled": enabled,
        "ct_state": ct_state,
        "user_id": user_id,
        "hour": hour,
        "dscp": dscp,
        "comment": comment,
    }


def validate_l4_icmp_literal_fields(tcp_flags, icmp_type, icmp_code, icmpv6_type, icmpv6_code):
    if tcp_flags is not None and not re.fullmatch(r"[A-Za-z0-9_,/ ]+", str(tcp_flags)):
        raise ValueError("tcp_flags contains invalid characters")
    for fld, val in (("icmp_type", icmp_type), ("icmpv6_type", icmpv6_type)):
        if val is not None and not re.fullmatch(r"[A-Za-z0-9_-]+", str(val)):
            raise ValueError(f"{fld} contains invalid characters")
    for fld, val in (("icmp_code", icmp_code), ("icmpv6_code", icmpv6_code)):
        if val is not None and not re.fullmatch(r"[0-9]{1,3}", str(val)):
            raise ValueError(f"{fld} must be 0..255")
        if val is not None and int(str(val)) > 255:
            raise ValueError(f"{fld} must be 0..255")


def normalize_log_fields(log_level, log_prefix, log_flags_raw, log_group, log_snaplen, log_queue_threshold):
    if log_level is not None:
        log_level = str(log_level).lower()
        if log_level not in ("emerg", "alert", "crit", "err", "warn", "notice", "info", "debug"):
            raise ValueError("log_level must be one of emerg, alert, crit, err, warn, notice, info, debug")

    if log_prefix is not None:
        log_prefix = str(log_prefix).replace('"', "'")

    log_flags = None
    if log_flags_raw is not None:
        if isinstance(log_flags_raw, list):
            raw_parts = []
            for token in log_flags_raw:
                if token is None:
                    continue
                raw_parts.extend([x for x in str(token).split(",") if x.strip()])
        else:
            raw_parts = [x for x in str(log_flags_raw).split(",") if x.strip()]

        allowed_log_flags = {
            "tcp sequence",
            "tcp options",
            "ip options",
            "skuid",
            "ether",
            "all",
        }
        normalized_flags = []
        for token in raw_parts:
            normalized = str(token).strip().lower()
            if normalized not in allowed_log_flags:
                raise ValueError("log_flags supports only: tcp sequence, tcp options, ip options, skuid, ether, all")
            if normalized not in normalized_flags:
                normalized_flags.append(normalized)
        log_flags = normalized_flags if normalized_flags else None

    if log_group is not None:
        if not re.fullmatch(r"[0-9]{1,5}", str(log_group)):
            raise ValueError("log_group must be integer in range 0..65535")
        if int(str(log_group)) > 65535:
            raise ValueError("log_group must be integer in range 0..65535")

    if log_group is not None and log_flags is not None:
        raise ValueError("log_group and log_flags are mutually exclusive")

    for field_name, field_value in (("log_snaplen", log_snaplen), ("log_queue_threshold", log_queue_threshold)):
        if field_value is None:
            continue
        if not re.fullmatch(r"[0-9]{1,10}", str(field_value)):
            raise ValueError(f"{field_name} must be integer in range 0..4294967295")
        if int(str(field_value)) > 4294967295:
            raise ValueError(f"{field_name} must be integer in range 0..4294967295")

    if (log_snaplen is not None or log_queue_threshold is not None) and log_group is None:
        raise ValueError("log_snaplen/log_queue_threshold require log_group")

    return {
        "log_level": log_level,
        "log_prefix": log_prefix,
        "log_flags": log_flags,
        "log_group": log_group,
        "log_snaplen": log_snaplen,
        "log_queue_threshold": log_queue_threshold,
    }


def normalize_nat_raw_fields(
    table_mode,
    chain,
    nat_type,
    nat_random,
    nat_fully_random,
    nat_persistent,
    to_addr,
    to_port,
    notrack,
    nftrace,
    raw_expr,
    nat_types_by_chain,
):
    if nat_type is not None:
        nat_type = str(nat_type).lower()
        if nat_type not in ("masquerade", "snat", "dnat", "redirect"):
            raise ValueError("nat_type must be one of: masquerade, snat, dnat, redirect")
    if table_mode != "nat" and nat_type is not None:
        raise ValueError("nat_type is only valid for nat table")
    if nat_type is not None:
        allowed_nat_types = (nat_types_by_chain or {}).get(chain, [])
        if nat_type not in allowed_nat_types:
            raise ValueError(f"{nat_type} is not valid in {chain} chain for nat table")

    if not isinstance(nat_random, bool):
        nat_random = str(nat_random).lower() in ("1", "true", "yes", "on")
    if not isinstance(nat_fully_random, bool):
        nat_fully_random = str(nat_fully_random).lower() in ("1", "true", "yes", "on")
    if not isinstance(nat_persistent, bool):
        nat_persistent = str(nat_persistent).lower() in ("1", "true", "yes", "on")
    if table_mode != "nat" and (nat_random or nat_fully_random or nat_persistent):
        raise ValueError("nat flags are only valid for nat table")
    if nat_fully_random and nat_type not in ("snat", "dnat", "masquerade", "redirect"):
        raise ValueError("nat_fully_random requires a nat_type statement")
    if nat_random and nat_type not in ("snat", "dnat", "masquerade", "redirect"):
        raise ValueError("nat_random requires a nat_type statement")
    if nat_persistent and nat_type not in ("snat", "dnat", "masquerade", "redirect"):
        raise ValueError("nat_persistent requires a nat_type statement")

    if to_addr is not None:
        try:
            ipaddress.ip_address(str(to_addr))
        except ValueError:
            raise ValueError("to_addr must be a valid IP address")
    if to_port is not None and not re.fullmatch(r"[0-9]{1,5}(-[0-9]{1,5})?", str(to_port)):
        raise ValueError("to_port must be like 53 or 1000-2000")
    if to_addr is not None and nat_type not in ("snat", "dnat"):
        raise ValueError("to_addr is only valid for snat/dnat")
    if to_port is not None and nat_type not in ("snat", "dnat", "masquerade", "redirect"):
        raise ValueError("to_port is only valid for nat statements")

    if not isinstance(notrack, bool):
        notrack = str(notrack).lower() in ("1", "true", "yes", "on")
    if notrack and table_mode != "raw":
        raise ValueError("notrack is only valid for raw table")

    if not isinstance(nftrace, bool):
        nftrace = str(nftrace).lower() in ("1", "true", "yes", "on")
    if nftrace and table_mode != "raw":
        raise ValueError("nftrace is only valid for raw table")
    if raw_expr is not None and table_mode != "raw":
        raise ValueError("raw_expr is only valid for raw table")

    return {
        "nat_type": nat_type,
        "nat_random": nat_random,
        "nat_fully_random": nat_fully_random,
        "nat_persistent": nat_persistent,
        "to_addr": to_addr,
        "to_port": to_port,
        "notrack": notrack,
        "nftrace": nftrace,
        "raw_expr": raw_expr,
    }


def normalize_limit_and_named_object_fields(
    limit_rate,
    counter,
    ct_helper_set,
    ct_timeout_set,
    ct_expectation_set,
    counter_name,
    limit_name,
    quota_name,
    family,
):
    if limit_rate is not None:
        if not re.fullmatch(r"[0-9]+/(second|minute|hour|day)", str(limit_rate).lower()):
            raise ValueError("limit_rate must be like 10/second or 200/minute")
        limit_rate = str(limit_rate).lower()

    if not isinstance(counter, bool):
        counter = str(counter).lower() in ("1", "true", "yes", "on")

    for fld, val in (
        ("ct_helper_set", ct_helper_set),
        ("ct_timeout_set", ct_timeout_set),
        ("ct_expectation_set", ct_expectation_set),
        ("counter_name", counter_name),
        ("limit_name", limit_name),
        ("quota_name", quota_name),
    ):
        if val is not None and not re.fullmatch(r"[A-Za-z0-9_.-]+", str(val)):
            raise ValueError(f"{fld} contains invalid characters")

    if counter_name is not None and counter:
        raise ValueError("counter_name and counter are mutually exclusive")
    if limit_name is not None and limit_rate is not None:
        raise ValueError("limit_name and limit_rate are mutually exclusive")

    if family == "netdev" and (
        ct_helper_set is not None
        or ct_timeout_set is not None
        or ct_expectation_set is not None
        or counter_name is not None
        or limit_name is not None
        or quota_name is not None
    ):
        raise ValueError("named object bindings are not supported for family=netdev")

    if family == "bridge" and ct_expectation_set is not None:
        raise ValueError("ct_expectation_set is not supported for family=bridge")

    return {
        "limit_rate": limit_rate,
        "counter": counter,
        "ct_helper_set": ct_helper_set,
        "ct_timeout_set": ct_timeout_set,
        "ct_expectation_set": ct_expectation_set,
        "counter_name": counter_name,
        "limit_name": limit_name,
        "quota_name": quota_name,
    }


def normalize_dynamic_set_statement_fields(
    set_stmt_op,
    set_stmt_name,
    set_stmt_expr,
    set_stmt_timeout,
    set_stmt_comment,
    family,
    read_sets_fn=None,
):
    has_statement = any(
        value is not None
        for value in (set_stmt_op, set_stmt_name, set_stmt_expr, set_stmt_timeout, set_stmt_comment)
    )
    if not has_statement:
        return {
            "set_stmt_op": None,
            "set_stmt_name": None,
            "set_stmt_expr": None,
            "set_stmt_timeout": None,
            "set_stmt_comment": None,
        }

    if family != "inet":
        raise ValueError("dynamic set statements are supported only for family=inet in current runtime profile")

    if set_stmt_op is None:
        raise ValueError("set_stmt_op is required for dynamic set statements")
    set_stmt_op = str(set_stmt_op).lower()
    if set_stmt_op not in ("add", "update"):
        raise ValueError("set_stmt_op must be add or update")

    if set_stmt_name is None or not re.fullmatch(r"[A-Za-z0-9_.-]+", str(set_stmt_name)):
        raise ValueError("set_stmt_name is invalid")
    set_stmt_name = str(set_stmt_name)

    allowed_expr_kinds = {
        "ip saddr": "addr",
        "ip daddr": "addr",
        "tcp dport": "port",
        "udp dport": "port",
    }
    if set_stmt_expr is None:
        raise ValueError("set_stmt_expr is required for dynamic set statements")
    set_stmt_expr = str(set_stmt_expr).lower()
    if set_stmt_expr not in allowed_expr_kinds:
        raise ValueError("set_stmt_expr must be one of: ip saddr, ip daddr, tcp dport, udp dport")

    if set_stmt_timeout is None:
        raise ValueError("set_stmt_timeout is required for dynamic set statements")
    set_stmt_timeout = str(set_stmt_timeout).lower()
    if not re.fullmatch(r"[0-9]+(ms|s|m|h|d)", set_stmt_timeout):
        raise ValueError("set_stmt_timeout must be like 10s, 1m, or 500ms")

    if set_stmt_comment is not None:
        raise ValueError("set_stmt_comment is not supported by current nft runtime profile")

    sets_data = read_sets_fn() if read_sets_fn is not None else {}
    target_kind = None
    target = None
    for set_kind in ("addr", "port", "iface"):
        for item in (sets_data or {}).get(set_kind, []):
            if isinstance(item, dict) and str(item.get("name") or "") == set_stmt_name:
                target_kind = set_kind
                target = item
                break
        if target is not None:
            break
    if target is None:
        raise ValueError(f'dynamic set "{set_stmt_name}" is not found')
    if not target.get("enabled", True):
        raise ValueError(f'dynamic set "{set_stmt_name}" must be enabled')
    if not target.get("dynamic"):
        raise ValueError(f'dynamic set "{set_stmt_name}" must have dynamic=true')
    if not target.get("size"):
        raise ValueError(f'dynamic set "{set_stmt_name}" must have size')
    if not (target.get("timeout") or set_stmt_timeout):
        raise ValueError(f'dynamic set "{set_stmt_name}" must have timeout')
    if target_kind != allowed_expr_kinds[set_stmt_expr]:
        raise ValueError("target set kind is not compatible with set_stmt_expr")

    return {
        "set_stmt_op": set_stmt_op,
        "set_stmt_name": set_stmt_name,
        "set_stmt_expr": set_stmt_expr,
        "set_stmt_timeout": set_stmt_timeout,
        "set_stmt_comment": set_stmt_comment,
    }


def _infer_vmap_key_type_from_entries(entries):
    for entry in entries or []:
        if not entry or ":" not in str(entry):
            continue
        key, _value = str(entry).split(":", 1)
        key = key.strip()
        if key:
            from . import collection_ops

            return collection_ops.infer_map_token_type(key)
    return None


def normalize_vmap_statement_fields(
    vmap_stmt_expr,
    vmap_stmt_name,
    family,
    action,
    read_maps_fn=None,
):
    has_statement = any(value is not None for value in (vmap_stmt_expr, vmap_stmt_name))
    if not has_statement:
        return {
            "vmap_stmt_expr": None,
            "vmap_stmt_name": None,
        }

    if family != "inet":
        raise ValueError("vmap statements are supported only for family=inet in current runtime profile")
    if action:
        raise ValueError("vmap statements cannot be combined with terminal action in first implementation scope")

    allowed_expr_key_types = {
        "meta l4proto": "inet_proto",
    }
    if vmap_stmt_expr is None:
        raise ValueError("vmap_stmt_expr is required for vmap statements")
    vmap_stmt_expr = str(vmap_stmt_expr).lower()
    if vmap_stmt_expr not in allowed_expr_key_types:
        raise ValueError("vmap_stmt_expr must be one of: meta l4proto")

    if vmap_stmt_name is None or not re.fullmatch(r"[A-Za-z0-9_.-]+", str(vmap_stmt_name)):
        raise ValueError("vmap_stmt_name is invalid")
    vmap_stmt_name = str(vmap_stmt_name)

    maps_data = read_maps_fn() if read_maps_fn is not None else {}
    target = None
    for item in (maps_data or {}).get("vmap", []):
        if isinstance(item, dict) and str(item.get("name") or "") == vmap_stmt_name:
            target = item
            break
    if target is None:
        raise ValueError(f'vmap "{vmap_stmt_name}" is not found')
    if not target.get("enabled", True):
        raise ValueError(f'vmap "{vmap_stmt_name}" must be enabled')

    target_key_type = _infer_vmap_key_type_from_entries(target.get("entries") or [])
    if target_key_type != allowed_expr_key_types[vmap_stmt_expr]:
        raise ValueError("target vmap key type is not compatible with vmap_stmt_expr")

    return {
        "vmap_stmt_expr": vmap_stmt_expr,
        "vmap_stmt_name": vmap_stmt_name,
    }


def normalize_meta_ct_fib_fields(
    meta_length,
    meta_priority,
    meta_cpu,
    meta_pkttype,
    meta_iiftype,
    meta_oiftype,
    meta_iifgroup,
    meta_oifgroup,
    mark_match,
    ct_mark_match,
    ct_status,
    ct_direction,
    ct_expiration,
    ct_helper_match,
    ct_label,
    ct_event,
    fib_check,
    socket_match,
    rt_nexthop,
    ipv6_exthdrs,
    ct_original_saddr,
    ct_original_daddr,
    ct_reply_saddr,
    ct_reply_daddr,
):
    if meta_length is not None:
        if not re.fullmatch(r"[0-9]{1,5}(-[0-9]{1,5})?", str(meta_length)):
            raise ValueError("meta_length must be like 64 or 64-1500")
        if "-" in str(meta_length):
            a, b = str(meta_length).split("-", 1)
            if int(a) > int(b):
                raise ValueError("meta_length range start must be <= end")

    if meta_priority is not None and not re.fullmatch(r"[0-9]{1,5}:[0-9]{1,5}|0x[0-9a-fA-F]+|[0-9]{1,10}", str(meta_priority)):
        raise ValueError("meta_priority must be like 1:10, 10, or 0x10")

    if meta_cpu is not None and not re.fullmatch(r"[0-9]{1,3}", str(meta_cpu)):
        raise ValueError("meta_cpu must be integer (0..255)")
    if meta_cpu is not None and int(str(meta_cpu)) > 255:
        raise ValueError("meta_cpu must be integer (0..255)")

    if meta_pkttype is not None:
        meta_pkttype = str(meta_pkttype).lower()
        if meta_pkttype not in ("host", "broadcast", "multicast", "other"):
            raise ValueError("meta_pkttype must be one of: host, broadcast, multicast, other")

    for fld, val in (("meta_iiftype", meta_iiftype), ("meta_oiftype", meta_oiftype)):
        if val is not None and not re.fullmatch(r"[0-9]{1,10}", str(val)):
            raise ValueError(f"{fld} must be positive integer")
    for fld, val in (("meta_iifgroup", meta_iifgroup), ("meta_oifgroup", meta_oifgroup)):
        if val is not None and not re.fullmatch(r"[0-9]{1,10}", str(val)):
            raise ValueError(f"{fld} must be positive integer")
    for fld, val in (("mark_match", mark_match), ("ct_mark_match", ct_mark_match)):
        if val is not None and not re.fullmatch(r"0x[0-9a-fA-F]+|[0-9]+", str(val)):
            raise ValueError(f"{fld} must be integer or hex (e.g. 10 or 0x1)")

    if ct_status is not None:
        raw_tokens = [t.strip().lower() for t in str(ct_status).split(",") if t.strip()]
        allowed_ct_status = {"expected", "seen-reply", "assured", "confirmed", "snat", "dnat", "dying"}
        if not raw_tokens or any(t not in allowed_ct_status for t in raw_tokens):
            raise ValueError("ct_status must use: expected, seen-reply, assured, confirmed, snat, dnat, dying")
        ct_status = ",".join(raw_tokens)

    if ct_direction is not None:
        ct_direction = str(ct_direction).lower()
        if ct_direction not in ("original", "reply"):
            raise ValueError("ct_direction must be original or reply")

    if ct_expiration is not None and not re.fullmatch(r"[0-9]+(ms|s|m|h|d)", str(ct_expiration).lower()):
        raise ValueError("ct_expiration must be like 30s, 1m, 2h")
    if ct_expiration is not None:
        ct_expiration = str(ct_expiration).lower()

    if ct_helper_match is not None and not re.fullmatch(r"[A-Za-z0-9_.-]+", str(ct_helper_match)):
        raise ValueError("ct_helper_match contains invalid characters")
    if ct_label is not None and not re.fullmatch(r"[A-Za-z0-9_.-]+|0x[0-9a-fA-F]+", str(ct_label)):
        raise ValueError("ct_label must be label name or hex mask (e.g. 0x1)")

    if ct_event is not None:
        raw_events = [t.strip().lower() for t in str(ct_event).split(",") if t.strip()]
        allowed_events = {"new", "related", "destroy", "reply", "assured", "protoinfo", "helper", "mark", "seqadj", "natseqinfo", "secmark", "label"}
        if not raw_events or any(t not in allowed_events for t in raw_events):
            raise ValueError("ct_event must use: new, related, destroy, reply, assured, protoinfo, helper, mark, seqadj, natseqinfo, secmark, label")
        ct_event = ",".join(raw_events)

    for fld, val in (
        ("fib_check", fib_check),
        ("socket_match", socket_match),
        ("rt_nexthop", rt_nexthop),
        ("ipv6_exthdrs", ipv6_exthdrs),
    ):
        if val is not None:
            if len(str(val)) > 160:
                raise ValueError(f"{fld} is too long")
            if not re.fullmatch(r"[A-Za-z0-9_ .:/,!=<>\-]+", str(val)):
                raise ValueError(f"{fld} contains invalid characters")

    for fld, val in (
        ("ct_original_saddr", ct_original_saddr),
        ("ct_original_daddr", ct_original_daddr),
        ("ct_reply_saddr", ct_reply_saddr),
        ("ct_reply_daddr", ct_reply_daddr),
    ):
        if val is not None:
            try:
                ipaddress.ip_address(str(val))
            except ValueError:
                raise ValueError(f"{fld} must be valid IPv4/IPv6 address")

    return {
        "meta_length": meta_length,
        "meta_priority": meta_priority,
        "meta_cpu": meta_cpu,
        "meta_pkttype": meta_pkttype,
        "meta_iiftype": meta_iiftype,
        "meta_oiftype": meta_oiftype,
        "meta_iifgroup": meta_iifgroup,
        "meta_oifgroup": meta_oifgroup,
        "mark_match": mark_match,
        "ct_mark_match": ct_mark_match,
        "ct_status": ct_status,
        "ct_direction": ct_direction,
        "ct_expiration": ct_expiration,
        "ct_helper_match": ct_helper_match,
        "ct_label": ct_label,
        "ct_event": ct_event,
        "fib_check": fib_check,
        "socket_match": socket_match,
        "rt_nexthop": rt_nexthop,
        "ipv6_exthdrs": ipv6_exthdrs,
        "ct_original_saddr": ct_original_saddr,
        "ct_original_daddr": ct_original_daddr,
        "ct_reply_saddr": ct_reply_saddr,
        "ct_reply_daddr": ct_reply_daddr,
    }


def normalize_l2_mark_fields(vlan_id, ether_src, ether_dst, ether_type, mark_set, ct_mark_set):
    if vlan_id is not None:
        if not re.fullmatch(r"[0-9]{1,4}", str(vlan_id)):
            raise ValueError("vlan_id must be integer in range 1..4095")
        if int(str(vlan_id)) < 1 or int(str(vlan_id)) > 4095:
            raise ValueError("vlan_id must be integer in range 1..4095")

    for fld, val in (("ether_src", ether_src), ("ether_dst", ether_dst)):
        if val is not None and not re.fullmatch(r"([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}", str(val)):
            raise ValueError(f"{fld} must be MAC like aa:bb:cc:dd:ee:ff")

    if ether_type is not None:
        ether_type_str = str(ether_type)
        if not re.fullmatch(r"0x[0-9a-fA-F]{1,4}|[0-9]{1,5}", ether_type_str):
            raise ValueError("ether_type must be hex or integer (e.g. 0x0800)")
        if ether_type_str.lower().startswith("0x"):
            ether_type_val = int(ether_type_str, 16)
        else:
            ether_type_val = int(ether_type_str)
        if ether_type_val < 0 or ether_type_val > 65535:
            raise ValueError("ether_type integer value must be in range 0..65535")

    if mark_set is not None and not re.fullmatch(r"0x[0-9a-fA-F]+|[0-9]+", str(mark_set)):
        raise ValueError("mark_set must be integer or hex (e.g. 10 or 0x1)")
    if ct_mark_set is not None and not re.fullmatch(r"0x[0-9a-fA-F]+|[0-9]+", str(ct_mark_set)):
        raise ValueError("ct_mark_set must be integer or hex (e.g. 10 or 0x1)")

    return {
        "vlan_id": vlan_id,
        "ether_src": ether_src,
        "ether_dst": ether_dst,
        "ether_type": ether_type,
        "mark_set": mark_set,
        "ct_mark_set": ct_mark_set,
    }


def validate_expression_fields(fib_expr, socket_expr, rt_expr, exthdr_expr, raw_expr):
    for fld, val in (
        ("fib_expr", fib_expr),
        ("socket_expr", socket_expr),
        ("rt_expr", rt_expr),
        ("exthdr_expr", exthdr_expr),
        ("raw_expr", raw_expr),
    ):
        if val is not None:
            if len(str(val)) > 160:
                raise ValueError(f"{fld} is too long")
            if not re.fullmatch(r"[A-Za-z0-9_ .:/,!=<>\-]+", str(val)):
                raise ValueError(f"{fld} contains invalid characters")


def validate_bridge_runtime_gap_fields(family, fib_check, socket_match, rt_nexthop, ipv6_exthdrs):
    if family == "bridge" and any(
        (
            fib_check is not None,
            socket_match is not None,
            rt_nexthop is not None,
            ipv6_exthdrs is not None,
        )
    ):
        raise ValueError(
            "fib_check/socket_match/rt_nexthop/ipv6_exthdrs are planned for family=bridge and temporarily disabled on current nft runtime"
        )


def validate_bridge_disallowed_fields(family, field_values):
    if family != "bridge":
        return
    for field_name, field_value in field_values:
        if isinstance(field_value, bool):
            if field_value:
                raise ValueError(f"{field_name} is not supported for family=bridge in unified Policy")
        elif field_value is not None:
            raise ValueError(f"{field_name} is not supported for family=bridge in unified Policy")


def validate_netdev_restrictions(family, selected_chain, selected_device, field_values):
    if family != "netdev":
        return
    selected_hook = str((selected_chain or {}).get("hook") or "").lower()
    selected_type = str((selected_chain or {}).get("chain_type") or "filter").lower()
    if selected_hook == "egress":
        raise ValueError("netdev egress hook is not supported by current nft runtime profile")
    if selected_type != "filter" or selected_hook != "ingress" or selected_device is None:
        raise ValueError("family=netdev requires a custom filter chain with hook=ingress and device")
    for field_name, field_value in field_values:
        if isinstance(field_value, bool):
            if field_value:
                raise ValueError(f"{field_name} is not supported for family=netdev in unified Policy")
        elif field_value is not None:
            raise ValueError(f"{field_name} is not supported for family=netdev in unified Policy")


def validate_family_specific_restrictions(
    family,
    selected_chain,
    selected_device,
    src,
    dst,
    in_interface,
    out_interface,
    ibrname,
    obrname,
    user_id,
    hour,
    dscp,
    nat_type,
    to_addr,
    to_port,
    nat_random,
    nat_fully_random,
    nat_persistent,
    notrack,
    mark_set,
    ct_mark_set,
    fib_expr,
    socket_expr,
    rt_expr,
    exthdr_expr,
    raw_expr,
    nftrace,
    tcp_flags,
    icmp_type,
    icmp_code,
    icmpv6_type,
    icmpv6_code,
    meta_length,
    meta_priority,
    meta_cpu,
    meta_iiftype,
    meta_oiftype,
    meta_oifgroup,
    ct_status,
    ct_direction,
    ct_expiration,
    ct_helper_match,
    ct_label,
    ct_event,
    ct_original_saddr,
    ct_original_daddr,
    ct_reply_saddr,
    ct_reply_daddr,
    fwd_to,
    fwd_dev,
    fwd_family,
    dup_to,
    dup_dev,
    fib_check,
    socket_match,
    rt_nexthop,
    ipv6_exthdrs,
    ct_helper_set,
    ct_timeout_set,
    ct_expectation_set,
    counter_name,
    limit_name,
    quota_name,
):
    if family == "bridge":
        bridge_disallowed = (
            ("src", src),
            ("dst", dst),
            ("in_interface", in_interface),
            ("out_interface", out_interface),
            ("user_id", user_id),
            ("hour", hour),
            ("dscp", dscp),
            ("nat_type", nat_type),
            ("to_addr", to_addr),
            ("to_port", to_port),
            ("nat_random", nat_random),
            ("nat_fully_random", nat_fully_random),
            ("nat_persistent", nat_persistent),
            ("notrack", notrack),
            ("mark_set", mark_set),
            ("ct_mark_set", ct_mark_set),
            ("fib_expr", fib_expr),
            ("socket_expr", socket_expr),
            ("rt_expr", rt_expr),
            ("exthdr_expr", exthdr_expr),
            ("raw_expr", raw_expr),
            ("nftrace", nftrace),
            ("tcp_flags", tcp_flags),
            ("icmp_type", icmp_type),
            ("icmp_code", icmp_code),
            ("icmpv6_type", icmpv6_type),
            ("icmpv6_code", icmpv6_code),
            ("meta_length", meta_length),
            ("meta_priority", meta_priority),
            ("meta_cpu", meta_cpu),
            ("meta_iiftype", meta_iiftype),
            ("meta_oiftype", meta_oiftype),
            ("ct_status", ct_status),
            ("ct_direction", ct_direction),
            ("ct_expiration", ct_expiration),
            ("ct_helper_match", ct_helper_match),
            ("ct_label", ct_label),
            ("ct_event", ct_event),
            ("ct_original_saddr", ct_original_saddr),
            ("ct_original_daddr", ct_original_daddr),
            ("ct_reply_saddr", ct_reply_saddr),
            ("ct_reply_daddr", ct_reply_daddr),
            ("fwd_to", fwd_to),
            ("fwd_dev", fwd_dev),
            ("fwd_family", fwd_family),
            ("dup_to", dup_to),
            ("dup_dev", dup_dev),
        )
        validate_bridge_disallowed_fields(family=family, field_values=bridge_disallowed)

    if family == "netdev":
        netdev_disallowed = (
            ("out_interface", out_interface),
            ("ibrname", ibrname),
            ("obrname", obrname),
            ("user_id", user_id),
            ("hour", hour),
            ("nat_type", nat_type),
            ("to_addr", to_addr),
            ("to_port", to_port),
            ("nat_random", nat_random),
            ("nat_fully_random", nat_fully_random),
            ("nat_persistent", nat_persistent),
            ("notrack", notrack),
            ("nftrace", nftrace),
            ("fib_expr", fib_expr),
            ("socket_expr", socket_expr),
            ("rt_expr", rt_expr),
            ("exthdr_expr", exthdr_expr),
            ("raw_expr", raw_expr),
            ("fib_check", fib_check),
            ("socket_match", socket_match),
            ("rt_nexthop", rt_nexthop),
            ("ipv6_exthdrs", ipv6_exthdrs),
            ("meta_oiftype", meta_oiftype),
            ("meta_oifgroup", meta_oifgroup),
            ("ct_status", ct_status),
            ("ct_direction", ct_direction),
            ("ct_expiration", ct_expiration),
            ("ct_helper_match", ct_helper_match),
            ("ct_label", ct_label),
            ("ct_event", ct_event),
            ("ct_original_saddr", ct_original_saddr),
            ("ct_original_daddr", ct_original_daddr),
            ("ct_reply_saddr", ct_reply_saddr),
            ("ct_reply_daddr", ct_reply_daddr),
            ("ct_helper_set", ct_helper_set),
            ("ct_timeout_set", ct_timeout_set),
            ("ct_expectation_set", ct_expectation_set),
            ("counter_name", counter_name),
            ("limit_name", limit_name),
            ("quota_name", quota_name),
            ("dup_to", dup_to),
            ("dup_dev", dup_dev),
        )
        validate_netdev_restrictions(
            family=family,
            selected_chain=selected_chain,
            selected_device=selected_device,
            field_values=netdev_disallowed,
        )


def build_normalized_rule_payload(
    raw_rule_id,
    id_factory,
    nft_table,
    family,
    chain,
    action,
    proto,
    src,
    dst,
    in_interface,
    out_interface,
    ibrname,
    obrname,
    sport,
    dport,
    comment,
    ct_state,
    user_id,
    hour,
    dscp,
    nat_type,
    target_chain,
    reject_type,
    to_addr,
    to_port,
    nat_random,
    nat_fully_random,
    nat_persistent,
    notrack,
    mark_set,
    ct_mark_set,
    log_prefix,
    log_level,
    log_flags,
    log_group,
    log_snaplen,
    log_queue_threshold,
    fib_expr,
    socket_expr,
    rt_expr,
    exthdr_expr,
    raw_expr,
    nftrace,
    tcp_flags,
    icmp_type,
    icmp_code,
    icmpv6_type,
    icmpv6_code,
    meta_length,
    meta_priority,
    meta_cpu,
    meta_pkttype,
    meta_iiftype,
    meta_oiftype,
    meta_iifgroup,
    meta_oifgroup,
    mark_match,
    ct_mark_match,
    ct_status,
    ct_direction,
    ct_expiration,
    ct_helper_match,
    ct_label,
    ct_event,
    ct_original_saddr,
    ct_original_daddr,
    ct_reply_saddr,
    ct_reply_daddr,
    fib_check,
    socket_match,
    rt_nexthop,
    ipv6_exthdrs,
    vlan_id,
    ether_src,
    ether_dst,
    ether_type,
    ct_helper_set,
    ct_timeout_set,
    ct_expectation_set,
    limit_rate,
    counter_name,
    limit_name,
    quota_name,
    queue_num,
    queue_flags,
    dup_to,
    dup_dev,
    fwd_to,
    fwd_dev,
    fwd_family,
    counter,
    enabled,
    set_stmt_op=None,
    set_stmt_name=None,
    set_stmt_expr=None,
    set_stmt_timeout=None,
    set_stmt_comment=None,
    vmap_stmt_expr=None,
    vmap_stmt_name=None,
):
    return {
        "id": str(raw_rule_id or id_factory()),
        "table": nft_table,
        "family": family,
        "chain": chain,
        "action": action,
        "proto": proto,
        "src": src,
        "dst": dst,
        "in_interface": in_interface,
        "out_interface": out_interface,
        "ibrname": ibrname,
        "obrname": obrname,
        "sport": str(sport) if sport is not None else None,
        "dport": str(dport) if dport is not None else None,
        "comment": comment,
        "ct_state": ct_state,
        "user_id": str(user_id) if user_id is not None else None,
        "hour": hour,
        "dscp": dscp,
        "nat_type": nat_type,
        "target_chain": target_chain,
        "reject_type": reject_type,
        "to_addr": to_addr,
        "to_port": str(to_port) if to_port is not None else None,
        "nat_random": nat_random,
        "nat_fully_random": nat_fully_random,
        "nat_persistent": nat_persistent,
        "notrack": notrack,
        "mark_set": str(mark_set) if mark_set is not None else None,
        "ct_mark_set": str(ct_mark_set) if ct_mark_set is not None else None,
        "log_prefix": log_prefix,
        "log_level": log_level,
        "log_flags": log_flags,
        "log_group": int(str(log_group)) if log_group is not None else None,
        "log_snaplen": int(str(log_snaplen)) if log_snaplen is not None else None,
        "log_queue_threshold": int(str(log_queue_threshold)) if log_queue_threshold is not None else None,
        "fib_expr": fib_expr,
        "socket_expr": socket_expr,
        "rt_expr": rt_expr,
        "exthdr_expr": exthdr_expr,
        "raw_expr": raw_expr,
        "nftrace": nftrace,
        "tcp_flags": tcp_flags,
        "icmp_type": icmp_type,
        "icmp_code": str(icmp_code) if icmp_code is not None else None,
        "icmpv6_type": icmpv6_type,
        "icmpv6_code": str(icmpv6_code) if icmpv6_code is not None else None,
        "meta_length": str(meta_length) if meta_length is not None else None,
        "meta_priority": str(meta_priority) if meta_priority is not None else None,
        "meta_cpu": str(meta_cpu) if meta_cpu is not None else None,
        "meta_pkttype": meta_pkttype,
        "meta_iiftype": str(meta_iiftype) if meta_iiftype is not None else None,
        "meta_oiftype": str(meta_oiftype) if meta_oiftype is not None else None,
        "meta_iifgroup": str(meta_iifgroup) if meta_iifgroup is not None else None,
        "meta_oifgroup": str(meta_oifgroup) if meta_oifgroup is not None else None,
        "mark_match": str(mark_match) if mark_match is not None else None,
        "ct_mark_match": str(ct_mark_match) if ct_mark_match is not None else None,
        "ct_status": ct_status,
        "ct_direction": ct_direction,
        "ct_expiration": ct_expiration,
        "ct_helper_match": ct_helper_match,
        "ct_label": str(ct_label) if ct_label is not None else None,
        "ct_event": ct_event,
        "ct_original_saddr": str(ct_original_saddr) if ct_original_saddr is not None else None,
        "ct_original_daddr": str(ct_original_daddr) if ct_original_daddr is not None else None,
        "ct_reply_saddr": str(ct_reply_saddr) if ct_reply_saddr is not None else None,
        "ct_reply_daddr": str(ct_reply_daddr) if ct_reply_daddr is not None else None,
        "fib_check": fib_check,
        "socket_match": socket_match,
        "rt_nexthop": rt_nexthop,
        "ipv6_exthdrs": ipv6_exthdrs,
        "vlan_id": str(vlan_id) if vlan_id is not None else None,
        "ether_src": str(ether_src).lower() if ether_src is not None else None,
        "ether_dst": str(ether_dst).lower() if ether_dst is not None else None,
        "ether_type": str(ether_type).lower() if ether_type is not None else None,
        "ct_helper_set": ct_helper_set,
        "ct_timeout_set": ct_timeout_set,
        "ct_expectation_set": ct_expectation_set,
        "limit_rate": limit_rate,
        "counter_name": counter_name,
        "limit_name": limit_name,
        "quota_name": quota_name,
        "queue_num": queue_num,
        "queue_flags": queue_flags,
        "dup_to": dup_to,
        "dup_dev": dup_dev,
        "fwd_to": fwd_to,
        "fwd_dev": fwd_dev,
        "fwd_family": fwd_family,
        "set_stmt_op": set_stmt_op,
        "set_stmt_name": set_stmt_name,
        "set_stmt_expr": set_stmt_expr,
        "set_stmt_timeout": set_stmt_timeout,
        "set_stmt_comment": set_stmt_comment,
        "vmap_stmt_expr": vmap_stmt_expr,
        "vmap_stmt_name": vmap_stmt_name,
        "counter": counter,
        "enabled": enabled,
    }


def render_firewall_rule(rule, table_family="inet"):
    if table_family == "bridge":
        for field_name in ("nat_type", "raw_expr", "dup_to", "dup_dev"):
            if rule.get(field_name):
                if field_name in ("dup_to", "dup_dev"):
                    raise ValueError("dup_to/dup_dev are not supported for family=bridge in runtime renderer")
                raise ValueError(f"{field_name} is not supported for family=bridge in runtime renderer")

    def _detect_ip_family(value):
        raw = str(value or "").strip()
        if not raw:
            return "ip"
        candidate = raw.split("/", 1)[0]
        try:
            parsed = ipaddress.ip_address(candidate)
            return "ip6" if parsed.version == 6 else "ip"
        except ValueError:
            return "ip6" if ":" in raw else "ip"

    def _render_port_value(raw):
        value = str(raw)
        if value.startswith("@"):
            return value
        if "," in value:
            parts = [part.strip().replace(":", "-") for part in value.split(",")]
            return "{ " + ", ".join(parts) + " }"
        if ":" in value:
            return value.replace(":", "-")
        return value

    def _render_l3_proto_type(raw):
        value = str(raw or "").strip().lower()
        mapping = {
            "0x0800": "ip",
            "2048": "ip",
            "0x86dd": "ip6",
            "34525": "ip6",
            "0x0806": "arp",
            "2054": "arp",
        }
        return mapping.get(value, value)

    def _render_transport_proto(raw):
        value = str(raw or "").strip().lower()
        return {"6": "tcp", "17": "udp"}.get(value, value)

    def _render_dscp_selector():
        return "ip6 dscp" if table_family == "ip6" else "ip dscp"

    def _render_interface_match(raw):
        value = str(raw)
        if value.startswith("@"):
            return value
        return f'"{value}"'

    parts = []
    if table_family == "bridge" and rule.get("ibrname"):
        parts.append(f'ibrname "{rule["ibrname"]}"')
    elif rule["in_interface"]:
        parts.append(f'iifname {_render_interface_match(rule["in_interface"])}')
    if table_family == "bridge" and rule.get("obrname"):
        parts.append(f'obrname "{rule["obrname"]}"')
    elif rule["out_interface"]:
        parts.append(f'oifname {_render_interface_match(rule["out_interface"])}')
    if rule["src"]:
        prefix = "ip6" if ":" in str(rule["src"]) else "ip"
        parts.append(f'{prefix} saddr {rule["src"]}')
    if rule["dst"]:
        prefix = "ip6" if ":" in str(rule["dst"]) else "ip"
        parts.append(f'{prefix} daddr {rule["dst"]}')
    if rule.get("ether_src"):
        parts.append(f'ether saddr {rule["ether_src"]}')
    if rule.get("ether_dst"):
        parts.append(f'ether daddr {rule["ether_dst"]}')
    if rule.get("vlan_id"):
        parts.append(f'vlan id {rule["vlan_id"]}')
    if rule.get("ether_type"):
        if rule.get("vlan_id"):
            parts.append(f'vlan type {_render_l3_proto_type(rule["ether_type"])}')
        else:
            parts.append(f'ether type {rule["ether_type"]}')
    if rule["proto"]:
        parts.append(f'meta l4proto {rule["proto"]}')
    if rule.get("ct_state"):
        parts.append(f'ct state {rule["ct_state"]}')
    if rule.get("user_id"):
        parts.append(f'meta skuid {rule["user_id"]}')
    if rule.get("hour"):
        if "-" in str(rule["hour"]):
            start_h, end_h = str(rule["hour"]).split("-", 1)
            parts.append(f'meta hour "{start_h}"-"{end_h}"')
        else:
            parts.append(f'meta hour "{rule["hour"]}"')
    if rule.get("dscp"):
        parts.append(f'{_render_dscp_selector()} {rule["dscp"]}')
    if rule["sport"]:
        parts.append(f'{_render_transport_proto(rule["proto"])} sport {_render_port_value(rule["sport"])}')
    if rule["dport"]:
        parts.append(f'{_render_transport_proto(rule["proto"])} dport {_render_port_value(rule["dport"])}')
    if rule.get("limit_rate"):
        parts.append(f'limit rate {rule["limit_rate"]}')
    if rule.get("limit_name"):
        parts.append(f'limit name "{rule["limit_name"]}"')
    if rule.get("quota_name"):
        parts.append(f'quota name "{rule["quota_name"]}"')
    if rule.get("fib_expr"):
        parts.append(str(rule["fib_expr"]))
    if rule.get("socket_expr"):
        parts.append(str(rule["socket_expr"]))
    if rule.get("rt_expr"):
        parts.append(str(rule["rt_expr"]))
    if rule.get("exthdr_expr"):
        parts.append(str(rule["exthdr_expr"]))
    if rule.get("raw_expr"):
        parts.append(str(rule["raw_expr"]))
    if rule.get("tcp_flags"):
        parts.append(f'tcp flags {rule["tcp_flags"]}')
    if rule.get("icmp_type"):
        parts.append(f'icmp type {rule["icmp_type"]}')
    if rule.get("icmp_code"):
        parts.append(f'icmp code {rule["icmp_code"]}')
    if rule.get("icmpv6_type"):
        parts.append(f'icmpv6 type {rule["icmpv6_type"]}')
    if rule.get("icmpv6_code"):
        parts.append(f'icmpv6 code {rule["icmpv6_code"]}')
    if rule.get("meta_length"):
        parts.append(f'meta length {rule["meta_length"]}')
    if rule.get("meta_priority"):
        parts.append(f'meta priority set {rule["meta_priority"]}')
    if rule.get("meta_cpu"):
        parts.append(f'meta cpu {rule["meta_cpu"]}')
    if rule.get("meta_pkttype"):
        parts.append(f'meta pkttype {rule["meta_pkttype"]}')
    if rule.get("meta_iiftype"):
        parts.append(f'meta iiftype {rule["meta_iiftype"]}')
    if rule.get("meta_oiftype"):
        parts.append(f'meta oiftype {rule["meta_oiftype"]}')
    if rule.get("meta_iifgroup"):
        parts.append(f'meta iifgroup {rule["meta_iifgroup"]}')
    if rule.get("meta_oifgroup"):
        parts.append(f'meta oifgroup {rule["meta_oifgroup"]}')
    if rule.get("mark_match"):
        parts.append(f'meta mark {rule["mark_match"]}')
    if rule.get("ct_mark_match"):
        parts.append(f'ct mark {rule["ct_mark_match"]}')
    if rule.get("ct_status"):
        parts.append(f'ct status {rule["ct_status"]}')
    if rule.get("ct_direction"):
        parts.append(f'ct direction {rule["ct_direction"]}')
    if rule.get("ct_expiration"):
        parts.append(f'ct expiration {rule["ct_expiration"]}')
    if rule.get("ct_helper_match"):
        parts.append(f'ct helper "{rule["ct_helper_match"]}"')
    if rule.get("ct_label"):
        parts.append(f'ct label {rule["ct_label"]}')
    if rule.get("ct_event"):
        parts.append(f'ct event set {rule["ct_event"]}')
    if rule.get("ct_original_saddr"):
        family = _detect_ip_family(rule["ct_original_saddr"])
        parts.append(f'ct original {family} saddr {rule["ct_original_saddr"]}')
    if rule.get("ct_original_daddr"):
        family = _detect_ip_family(rule["ct_original_daddr"])
        parts.append(f'ct original {family} daddr {rule["ct_original_daddr"]}')
    if rule.get("ct_reply_saddr"):
        family = _detect_ip_family(rule["ct_reply_saddr"])
        parts.append(f'ct reply {family} saddr {rule["ct_reply_saddr"]}')
    if rule.get("ct_reply_daddr"):
        family = _detect_ip_family(rule["ct_reply_daddr"])
        parts.append(f'ct reply {family} daddr {rule["ct_reply_daddr"]}')
    if rule.get("fib_check"):
        parts.append(f'fib {rule["fib_check"]}')
    if rule.get("socket_match"):
        parts.append(f'socket {rule["socket_match"]}')
    if rule.get("rt_nexthop"):
        family = _detect_ip_family(rule["rt_nexthop"])
        parts.append(f'rt {family} nexthop {rule["rt_nexthop"]}')
    if rule.get("ipv6_exthdrs"):
        parts.append(f'exthdr {rule["ipv6_exthdrs"]}')
    if rule.get("log_prefix") or rule.get("log_level") or rule.get("log_flags") or rule.get("log_group") is not None:
        log_parts = ["log"]
        if rule.get("log_group") is not None:
            log_parts.extend(["group", str(rule["log_group"])])
        if rule.get("log_prefix"):
            log_parts.append(f'prefix "{rule["log_prefix"]}"')
        if rule.get("log_level"):
            log_parts.append(f'level {rule["log_level"]}')
        if rule.get("log_flags"):
            if isinstance(rule.get("log_flags"), list):
                flags = ",".join([str(x).strip() for x in rule["log_flags"] if str(x).strip()])
            else:
                flags = str(rule.get("log_flags") or "").strip()
            if flags:
                log_parts.append(f"flags {flags}")
        if rule.get("log_queue_threshold") is not None:
            log_parts.append(f'queue-threshold {rule["log_queue_threshold"]}')
        if rule.get("log_snaplen") is not None:
            log_parts.append(f'snaplen {rule["log_snaplen"]}')
        parts.append(" ".join(log_parts))
    if rule.get("counter"):
        parts.append("counter")
    if rule.get("counter_name"):
        parts.append(f'counter name "{rule["counter_name"]}"')
    if rule.get("notrack"):
        parts.append("notrack")
    if rule.get("nftrace"):
        parts.append("meta nftrace set 1")
    if rule.get("mark_set"):
        parts.append(f'meta mark set {rule["mark_set"]}')
    if rule.get("ct_mark_set"):
        parts.append(f'ct mark set {rule["ct_mark_set"]}')
    if rule.get("ct_helper_set"):
        parts.append(f'ct helper set "{rule["ct_helper_set"]}"')
    if rule.get("ct_timeout_set"):
        parts.append(f'ct timeout set "{rule["ct_timeout_set"]}"')
    if rule.get("ct_expectation_set"):
        parts.append(f'ct expectation set "{rule["ct_expectation_set"]}"')
    if rule.get("set_stmt_op"):
        set_stmt = f'{rule["set_stmt_op"]} @{rule["set_stmt_name"]} {{ {rule["set_stmt_expr"]}'
        if rule.get("set_stmt_timeout"):
            set_stmt += f' timeout {rule["set_stmt_timeout"]}'
        if rule.get("set_stmt_comment"):
            set_stmt += f' comment "{rule["set_stmt_comment"]}"'
        set_stmt += " }"
        parts.append(set_stmt)
    if rule.get("vmap_stmt_expr"):
        parts.append(f'{rule["vmap_stmt_expr"]} vmap @{rule["vmap_stmt_name"]}')
    if rule.get("dup_to"):
        if rule.get("dup_dev"):
            parts.append(f'dup to {rule["dup_to"]} device "{rule["dup_dev"]}"')
        else:
            parts.append(f'dup to {rule["dup_to"]}')
    nat_type = rule.get("nat_type")
    if nat_type:
        nat_stmt = nat_type
        if nat_type in ("snat", "dnat") and rule.get("to_addr"):
            to_addr = str(rule["to_addr"])
            family_prefix = "ip6" if ":" in to_addr else "ip"
            nat_stmt += f" {family_prefix} to {to_addr}"
            if rule.get("to_port"):
                nat_stmt += f':{rule["to_port"]}'
        elif nat_type in ("masquerade", "redirect") and rule.get("to_port"):
            nat_stmt += f' to :{rule["to_port"]}'
        nat_flags = []
        if rule.get("nat_random"):
            nat_flags.append("random")
        if rule.get("nat_fully_random"):
            nat_flags.append("fully-random")
        if rule.get("nat_persistent"):
            nat_flags.append("persistent")
        if nat_flags:
            nat_stmt += " " + ",".join(nat_flags)
        parts.append(nat_stmt)
    elif rule.get("notrack"):
        pass
    else:
        action = rule["action"]
        if action in ("jump", "goto"):
            parts.append(f'{action} {rule.get("target_chain")}')
        elif action == "reject" and rule.get("reject_type"):
            parts.append(f'reject with {rule["reject_type"]}')
        elif action == "queue":
            queue_stmt = "queue"
            if rule.get("queue_num"):
                queue_stmt += f' num {rule["queue_num"]}'
            flags = rule.get("queue_flags") or []
            if isinstance(flags, list):
                normalized_flags = [str(x).strip().lower() for x in flags if str(x).strip()]
            else:
                normalized_flags = [x.strip().lower() for x in str(flags).split(",") if x.strip()]
            if normalized_flags:
                queue_stmt += f' {",".join(normalized_flags)}'
            parts.append(queue_stmt)
        elif action == "fwd":
            family = str(rule.get("fwd_family") or "").strip().lower()
            if family in ("ip", "ip6"):
                parts.append(f'fwd {family} to {rule["fwd_to"]} device "{rule["fwd_dev"]}"')
            else:
                parts.append(f'fwd to {rule["fwd_to"]} device "{rule["fwd_dev"]}"')
        elif action:
            parts.append(action)
    if rule["comment"]:
        parts.append(f'comment "{rule["comment"]}"')
    return " ".join(parts)


def append_enabled_rule_script_lines(
    script_lines,
    table_family,
    nft_table,
    table_name,
    rules,
    default_family,
    render_rule_fn,
):
    for rule in rules:
        if not rule.get("enabled", True):
            continue
        rule_table = str(rule.get("table") or "").lower()
        if rule_table != nft_table:
            continue
        if str(rule.get("family") or default_family).lower() != table_family:
            continue
        rendered = render_rule_fn(rule, table_family=table_family)
        script_lines.append(f'add rule {table_family} {table_name} {rule["chain"]} {rendered}')


def create_rule(payload, apply_now, list_rules_fn, normalize_rule_fn, write_rules_fn, apply_rules_fn):
    rules = list_rules_fn()
    rule = normalize_rule_fn(payload, validate_runtime_objects=True)
    for existing in rules:
        if all(existing.get(key) == rule.get(key) for key in IDENTITY_KEYS):
            if apply_now:
                apply_rules_fn()
            return existing
    out = list(rules)
    out.append(rule)
    write_rules_fn(out)
    try:
        if apply_now:
            apply_rules_fn()
    except Exception:
        write_rules_fn(rules)
        raise
    return rule


def list_rules(family, table, read_rules_fn, normalize_rule_fn, normalize_value_fn):
    family_filter = normalize_value_fn(family)
    table_filter = normalize_value_fn(table)
    if family_filter is not None:
        family_filter = str(family_filter).lower()
    if table_filter is not None:
        table_filter = str(table_filter).lower()
    raw_rules = read_rules_fn()
    normalized = []
    for payload in raw_rules:
        try:
            row = normalize_rule_fn(payload)
            if family_filter and str(row.get("family") or "").lower() != family_filter:
                continue
            if table_filter and str(row.get("table") or "").lower() != table_filter:
                continue
            normalized.append(row)
        except Exception:
            continue
    return normalized


def update_rule(rule_id, payload, apply_now, list_rules_fn, normalize_rule_fn, write_rules_fn, apply_rules_fn):
    rules = list_rules_fn()
    existing = next((row for row in rules if row["id"] == str(rule_id)), None)
    if existing is None:
        raise LookupError("Firewall rule not found")
    merged = {**existing, **(payload or {})}
    merged["id"] = existing["id"]
    updated = normalize_rule_fn(merged, validate_runtime_objects=True)
    out = [updated if row["id"] == existing["id"] else row for row in rules]
    write_rules_fn(out)
    try:
        if apply_now:
            apply_rules_fn()
    except Exception:
        write_rules_fn(rules)
        raise
    return updated


def delete_rule(rule_id, apply_now, list_rules_fn, write_rules_fn, apply_rules_fn):
    rules = list_rules_fn()
    existing = next((row for row in rules if row["id"] == str(rule_id)), None)
    if existing is None:
        raise LookupError("Firewall rule not found")
    out = [row for row in rules if row["id"] != str(rule_id)]
    write_rules_fn(out)
    try:
        if apply_now:
            apply_rules_fn()
    except Exception:
        write_rules_fn(rules)
        raise
    return existing


def reorder_rules(
    table,
    ordered_ids,
    apply_now,
    list_rules_fn,
    read_tables_fn,
    normalize_value_fn,
    default_family,
    default_tables,
    write_rules_fn,
    apply_rules_fn,
):
    nft_table = normalize_value_fn(table)
    if nft_table is None:
        raise ValueError("table is required")
    nft_table = nft_table.lower()
    allowed_tables = set(default_tables or ())
    custom_rows = read_tables_fn().get("tables", [])
    for row in custom_rows:
        if not isinstance(row, dict):
            continue
        if str((row.get("family") or default_family)).lower() != default_family:
            continue
        table_name = normalize_value_fn(row.get("table_name"))
        if table_name:
            allowed_tables.add(str(table_name).lower())
    if nft_table not in allowed_tables:
        raise ValueError("table must be one of built-in or existing custom tables")
    if not isinstance(ordered_ids, list) or not all(isinstance(x, str) and x.strip() for x in ordered_ids):
        raise ValueError("ordered_ids must be a non-empty list of rule ids")

    rules = list_rules_fn()
    table_rules = [row for row in rules if row.get("table") == nft_table]
    table_ids = [row["id"] for row in table_rules]
    incoming_ids = [x.strip() for x in ordered_ids]
    if sorted(table_ids) != sorted(incoming_ids):
        raise ValueError("ordered_ids must contain exactly all ids from selected table")

    by_id = {row["id"]: row for row in table_rules}
    reordered_table_rules = [by_id[rule_id] for rule_id in incoming_ids]
    out = []
    inserted = False
    for row in rules:
        if row.get("table") == nft_table:
            if not inserted:
                out.extend(reordered_table_rules)
                inserted = True
            continue
        out.append(row)
    if not inserted:
        out.extend(reordered_table_rules)

    write_rules_fn(out)
    try:
        if apply_now:
            apply_rules_fn()
    except Exception:
        write_rules_fn(rules)
        raise
    return reordered_table_rules
