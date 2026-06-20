#!/usr/bin/python3
import uuid

from . import named_object_ops
from . import rule_ops


def _default_rule_id_factory():
    return uuid.uuid4().hex


def normalize_firewall_rule(
    payload,
    *,
    normalize_value_fn,
    default_family,
    schema_tables,
    ct_states,
    read_tables_fn,
    load_effective_objects_fn,
    read_sets_fn=None,
    read_maps_fn=None,
    validate_runtime_objects=False,
    id_factory=None,
):
    if not isinstance(payload, dict):
        raise ValueError("Rule payload must be an object")

    (
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
    ) = rule_ops.extract_normalized_rule_inputs(
        payload=payload,
        normalize_value_fn=normalize_value_fn,
    )

    has_dynamic_set_statement = any(
        value is not None
        for value in (set_stmt_op, set_stmt_name, set_stmt_expr, set_stmt_timeout, set_stmt_comment)
    )
    if has_dynamic_set_statement and str(family).lower() != default_family:
        raise ValueError("dynamic set statements are supported only for family=inet in current runtime profile")
    has_vmap_statement = any(value is not None for value in (vmap_stmt_expr, vmap_stmt_name))
    if has_vmap_statement and str(family).lower() != default_family:
        raise ValueError("vmap statements are supported only for family=inet in current runtime profile")

    table_chain_ctx = rule_ops.resolve_table_chain_context(
        family=family,
        nft_table=nft_table,
        chain=chain,
        default_family=default_family,
        schema_tables=schema_tables,
        read_tables_fn=read_tables_fn,
    )
    family = table_chain_ctx["family"]
    table_mode = table_chain_ctx["table_mode"]
    selected_chain = table_chain_ctx["selected_chain"]
    action_proto_fields = rule_ops.validate_action_target_reject_and_proto_fields(
        action=action,
        family=family,
        table_mode=table_mode,
        target_chain=target_chain,
        selected_chain=selected_chain,
        reject_type=reject_type,
        proto=proto,
        dport=dport,
        sport=sport,
        allow_empty_action=has_vmap_statement,
    )
    proto = action_proto_fields["proto"]
    queue_dup_fwd = rule_ops.normalize_queue_dup_fwd_fields(
        action=action,
        table_mode=table_mode,
        family=family,
        queue_num=queue_num,
        queue_flags_raw=queue_flags_raw,
        dup_to=dup_to,
        dup_dev=dup_dev,
        fwd_to=fwd_to,
        fwd_dev=fwd_dev,
        fwd_family=fwd_family,
    )
    queue_num = queue_dup_fwd["queue_num"]
    queue_flags = queue_dup_fwd["queue_flags"]
    dup_to = queue_dup_fwd["dup_to"]
    dup_dev = queue_dup_fwd["dup_dev"]
    fwd_to = queue_dup_fwd["fwd_to"]
    fwd_dev = queue_dup_fwd["fwd_dev"]
    fwd_family = queue_dup_fwd["fwd_family"]
    dynamic_set_statement = rule_ops.normalize_dynamic_set_statement_fields(
        set_stmt_op=set_stmt_op,
        set_stmt_name=set_stmt_name,
        set_stmt_expr=set_stmt_expr,
        set_stmt_timeout=set_stmt_timeout,
        set_stmt_comment=set_stmt_comment,
        family=family,
        read_sets_fn=read_sets_fn,
    )
    set_stmt_op = dynamic_set_statement["set_stmt_op"]
    set_stmt_name = dynamic_set_statement["set_stmt_name"]
    set_stmt_expr = dynamic_set_statement["set_stmt_expr"]
    set_stmt_timeout = dynamic_set_statement["set_stmt_timeout"]
    set_stmt_comment = dynamic_set_statement["set_stmt_comment"]
    vmap_statement = rule_ops.normalize_vmap_statement_fields(
        vmap_stmt_expr=vmap_stmt_expr,
        vmap_stmt_name=vmap_stmt_name,
        family=family,
        action=action,
        read_maps_fn=read_maps_fn,
    )
    vmap_stmt_expr = vmap_statement["vmap_stmt_expr"]
    vmap_stmt_name = vmap_statement["vmap_stmt_name"]
    basic_match_fields = rule_ops.normalize_proto_and_basic_match_fields(
        proto=proto,
        dport=dport,
        sport=sport,
        tcp_flags=tcp_flags,
        icmp_type=icmp_type,
        icmp_code=icmp_code,
        icmpv6_type=icmpv6_type,
        icmpv6_code=icmpv6_code,
        src=src,
        dst=dst,
        in_interface=in_interface,
        out_interface=out_interface,
        ibrname=ibrname,
        obrname=obrname,
        enabled=enabled,
        ct_state=ct_state,
        user_id=user_id,
        hour=hour,
        dscp=dscp,
        comment=comment,
        ct_states=ct_states,
    )
    proto = basic_match_fields["proto"]
    dport = basic_match_fields["dport"]
    sport = basic_match_fields["sport"]
    src = basic_match_fields["src"]
    dst = basic_match_fields["dst"]
    in_interface = basic_match_fields["in_interface"]
    out_interface = basic_match_fields["out_interface"]
    ibrname = basic_match_fields["ibrname"]
    obrname = basic_match_fields["obrname"]
    enabled = basic_match_fields["enabled"]
    ct_state = basic_match_fields["ct_state"]
    user_id = basic_match_fields["user_id"]
    hour = basic_match_fields["hour"]
    dscp = basic_match_fields["dscp"]
    comment = basic_match_fields["comment"]
    nat_raw_fields = rule_ops.normalize_nat_raw_fields(
        table_mode=table_mode,
        chain=chain,
        nat_type=nat_type,
        nat_random=nat_random,
        nat_fully_random=nat_fully_random,
        nat_persistent=nat_persistent,
        to_addr=to_addr,
        to_port=to_port,
        notrack=notrack,
        nftrace=nftrace,
        raw_expr=raw_expr,
        nat_types_by_chain=schema_tables["nat"]["nat_types_by_chain"],
    )
    nat_type = nat_raw_fields["nat_type"]
    nat_random = nat_raw_fields["nat_random"]
    nat_fully_random = nat_raw_fields["nat_fully_random"]
    nat_persistent = nat_raw_fields["nat_persistent"]
    to_addr = nat_raw_fields["to_addr"]
    to_port = nat_raw_fields["to_port"]
    notrack = nat_raw_fields["notrack"]
    nftrace = nat_raw_fields["nftrace"]
    raw_expr = nat_raw_fields["raw_expr"]
    rule_ops.validate_l4_icmp_literal_fields(
        tcp_flags=tcp_flags,
        icmp_type=icmp_type,
        icmp_code=icmp_code,
        icmpv6_type=icmpv6_type,
        icmpv6_code=icmpv6_code,
    )
    meta_ct_fib = rule_ops.normalize_meta_ct_fib_fields(
        meta_length=meta_length,
        meta_priority=meta_priority,
        meta_cpu=meta_cpu,
        meta_pkttype=meta_pkttype,
        meta_iiftype=meta_iiftype,
        meta_oiftype=meta_oiftype,
        meta_iifgroup=meta_iifgroup,
        meta_oifgroup=meta_oifgroup,
        mark_match=mark_match,
        ct_mark_match=ct_mark_match,
        ct_status=ct_status,
        ct_direction=ct_direction,
        ct_expiration=ct_expiration,
        ct_helper_match=ct_helper_match,
        ct_label=ct_label,
        ct_event=ct_event,
        fib_check=fib_check,
        socket_match=socket_match,
        rt_nexthop=rt_nexthop,
        ipv6_exthdrs=ipv6_exthdrs,
        ct_original_saddr=ct_original_saddr,
        ct_original_daddr=ct_original_daddr,
        ct_reply_saddr=ct_reply_saddr,
        ct_reply_daddr=ct_reply_daddr,
    )
    meta_length = meta_ct_fib["meta_length"]
    meta_priority = meta_ct_fib["meta_priority"]
    meta_cpu = meta_ct_fib["meta_cpu"]
    meta_pkttype = meta_ct_fib["meta_pkttype"]
    meta_iiftype = meta_ct_fib["meta_iiftype"]
    meta_oiftype = meta_ct_fib["meta_oiftype"]
    meta_iifgroup = meta_ct_fib["meta_iifgroup"]
    meta_oifgroup = meta_ct_fib["meta_oifgroup"]
    mark_match = meta_ct_fib["mark_match"]
    ct_mark_match = meta_ct_fib["ct_mark_match"]
    ct_status = meta_ct_fib["ct_status"]
    ct_direction = meta_ct_fib["ct_direction"]
    ct_expiration = meta_ct_fib["ct_expiration"]
    ct_helper_match = meta_ct_fib["ct_helper_match"]
    ct_label = meta_ct_fib["ct_label"]
    ct_event = meta_ct_fib["ct_event"]
    fib_check = meta_ct_fib["fib_check"]
    socket_match = meta_ct_fib["socket_match"]
    rt_nexthop = meta_ct_fib["rt_nexthop"]
    ipv6_exthdrs = meta_ct_fib["ipv6_exthdrs"]
    ct_original_saddr = meta_ct_fib["ct_original_saddr"]
    ct_original_daddr = meta_ct_fib["ct_original_daddr"]
    ct_reply_saddr = meta_ct_fib["ct_reply_saddr"]
    ct_reply_daddr = meta_ct_fib["ct_reply_daddr"]
    l2_mark_fields = rule_ops.normalize_l2_mark_fields(
        vlan_id=vlan_id,
        ether_src=ether_src,
        ether_dst=ether_dst,
        ether_type=ether_type,
        mark_set=mark_set,
        ct_mark_set=ct_mark_set,
    )
    vlan_id = l2_mark_fields["vlan_id"]
    ether_src = l2_mark_fields["ether_src"]
    ether_dst = l2_mark_fields["ether_dst"]
    ether_type = l2_mark_fields["ether_type"]
    mark_set = l2_mark_fields["mark_set"]
    ct_mark_set = l2_mark_fields["ct_mark_set"]
    log_fields = rule_ops.normalize_log_fields(
        log_level=log_level,
        log_prefix=log_prefix,
        log_flags_raw=log_flags_raw,
        log_group=log_group,
        log_snaplen=log_snaplen,
        log_queue_threshold=log_queue_threshold,
    )
    log_level = log_fields["log_level"]
    log_prefix = log_fields["log_prefix"]
    log_flags = log_fields["log_flags"]
    log_group = log_fields["log_group"]
    log_snaplen = log_fields["log_snaplen"]
    log_queue_threshold = log_fields["log_queue_threshold"]
    rule_ops.validate_expression_fields(
        fib_expr=fib_expr,
        socket_expr=socket_expr,
        rt_expr=rt_expr,
        exthdr_expr=exthdr_expr,
        raw_expr=raw_expr,
    )
    limit_named_fields = rule_ops.normalize_limit_and_named_object_fields(
        limit_rate=limit_rate,
        counter=counter,
        ct_helper_set=ct_helper_set,
        ct_timeout_set=ct_timeout_set,
        ct_expectation_set=ct_expectation_set,
        counter_name=counter_name,
        limit_name=limit_name,
        quota_name=quota_name,
        family=family,
    )
    limit_rate = limit_named_fields["limit_rate"]
    counter = limit_named_fields["counter"]
    ct_helper_set = limit_named_fields["ct_helper_set"]
    ct_timeout_set = limit_named_fields["ct_timeout_set"]
    ct_expectation_set = limit_named_fields["ct_expectation_set"]
    counter_name = limit_named_fields["counter_name"]
    limit_name = limit_named_fields["limit_name"]
    quota_name = limit_named_fields["quota_name"]
    rule_ops.validate_bridge_runtime_gap_fields(
        family=family,
        fib_check=fib_check,
        socket_match=socket_match,
        rt_nexthop=rt_nexthop,
        ipv6_exthdrs=ipv6_exthdrs,
    )
    named_object_ops.validate_runtime_named_object_references(
        validate_runtime_objects=validate_runtime_objects,
        family=family,
        nft_table=nft_table,
        ct_helper_set=ct_helper_set,
        ct_timeout_set=ct_timeout_set,
        ct_expectation_set=ct_expectation_set,
        counter_name=counter_name,
        limit_name=limit_name,
        quota_name=quota_name,
        load_effective_objects_fn=load_effective_objects_fn,
    )

    selected_device = normalize_value_fn((selected_chain or {}).get("device")) if family == "netdev" else None
    rule_ops.validate_family_specific_restrictions(
        family=family,
        selected_chain=selected_chain,
        selected_device=selected_device,
        src=src,
        dst=dst,
        in_interface=in_interface,
        out_interface=out_interface,
        ibrname=ibrname,
        obrname=obrname,
        user_id=user_id,
        hour=hour,
        dscp=dscp,
        nat_type=nat_type,
        to_addr=to_addr,
        to_port=to_port,
        nat_random=nat_random,
        nat_fully_random=nat_fully_random,
        nat_persistent=nat_persistent,
        notrack=notrack,
        mark_set=mark_set,
        ct_mark_set=ct_mark_set,
        fib_expr=fib_expr,
        socket_expr=socket_expr,
        rt_expr=rt_expr,
        exthdr_expr=exthdr_expr,
        raw_expr=raw_expr,
        nftrace=nftrace,
        tcp_flags=tcp_flags,
        icmp_type=icmp_type,
        icmp_code=icmp_code,
        icmpv6_type=icmpv6_type,
        icmpv6_code=icmpv6_code,
        meta_length=meta_length,
        meta_priority=meta_priority,
        meta_cpu=meta_cpu,
        meta_iiftype=meta_iiftype,
        meta_oiftype=meta_oiftype,
        meta_oifgroup=meta_oifgroup,
        ct_status=ct_status,
        ct_direction=ct_direction,
        ct_expiration=ct_expiration,
        ct_helper_match=ct_helper_match,
        ct_label=ct_label,
        ct_event=ct_event,
        ct_original_saddr=ct_original_saddr,
        ct_original_daddr=ct_original_daddr,
        ct_reply_saddr=ct_reply_saddr,
        ct_reply_daddr=ct_reply_daddr,
        fwd_to=fwd_to,
        fwd_dev=fwd_dev,
        fwd_family=fwd_family,
        dup_to=dup_to,
        dup_dev=dup_dev,
        fib_check=fib_check,
        socket_match=socket_match,
        rt_nexthop=rt_nexthop,
        ipv6_exthdrs=ipv6_exthdrs,
        ct_helper_set=ct_helper_set,
        ct_timeout_set=ct_timeout_set,
        ct_expectation_set=ct_expectation_set,
        counter_name=counter_name,
        limit_name=limit_name,
        quota_name=quota_name,
    )

    build_id = id_factory or _default_rule_id_factory
    return rule_ops.build_normalized_rule_payload(
        raw_rule_id=payload.get("id"),
        id_factory=build_id,
        nft_table=nft_table,
        family=family,
        chain=chain,
        action=action,
        proto=proto,
        src=src,
        dst=dst,
        in_interface=in_interface,
        out_interface=out_interface,
        ibrname=ibrname,
        obrname=obrname,
        sport=sport,
        dport=dport,
        comment=comment,
        ct_state=ct_state,
        user_id=user_id,
        hour=hour,
        dscp=dscp,
        nat_type=nat_type,
        target_chain=target_chain,
        reject_type=reject_type,
        to_addr=to_addr,
        to_port=to_port,
        nat_random=nat_random,
        nat_fully_random=nat_fully_random,
        nat_persistent=nat_persistent,
        notrack=notrack,
        mark_set=mark_set,
        ct_mark_set=ct_mark_set,
        log_prefix=log_prefix,
        log_level=log_level,
        log_flags=log_flags,
        log_group=log_group,
        log_snaplen=log_snaplen,
        log_queue_threshold=log_queue_threshold,
        fib_expr=fib_expr,
        socket_expr=socket_expr,
        rt_expr=rt_expr,
        exthdr_expr=exthdr_expr,
        raw_expr=raw_expr,
        nftrace=nftrace,
        tcp_flags=tcp_flags,
        icmp_type=icmp_type,
        icmp_code=icmp_code,
        icmpv6_type=icmpv6_type,
        icmpv6_code=icmpv6_code,
        meta_length=meta_length,
        meta_priority=meta_priority,
        meta_cpu=meta_cpu,
        meta_pkttype=meta_pkttype,
        meta_iiftype=meta_iiftype,
        meta_oiftype=meta_oiftype,
        meta_iifgroup=meta_iifgroup,
        meta_oifgroup=meta_oifgroup,
        mark_match=mark_match,
        ct_mark_match=ct_mark_match,
        ct_status=ct_status,
        ct_direction=ct_direction,
        ct_expiration=ct_expiration,
        ct_helper_match=ct_helper_match,
        ct_label=ct_label,
        ct_event=ct_event,
        ct_original_saddr=ct_original_saddr,
        ct_original_daddr=ct_original_daddr,
        ct_reply_saddr=ct_reply_saddr,
        ct_reply_daddr=ct_reply_daddr,
        fib_check=fib_check,
        socket_match=socket_match,
        rt_nexthop=rt_nexthop,
        ipv6_exthdrs=ipv6_exthdrs,
        vlan_id=vlan_id,
        ether_src=ether_src,
        ether_dst=ether_dst,
        ether_type=ether_type,
        ct_helper_set=ct_helper_set,
        ct_timeout_set=ct_timeout_set,
        ct_expectation_set=ct_expectation_set,
        limit_rate=limit_rate,
        counter_name=counter_name,
        limit_name=limit_name,
        quota_name=quota_name,
        queue_num=queue_num,
        queue_flags=queue_flags,
        dup_to=dup_to,
        dup_dev=dup_dev,
        fwd_to=fwd_to,
        fwd_dev=fwd_dev,
        fwd_family=fwd_family,
        counter=counter,
        enabled=enabled,
        set_stmt_op=set_stmt_op,
        set_stmt_name=set_stmt_name,
        set_stmt_expr=set_stmt_expr,
        set_stmt_timeout=set_stmt_timeout,
        set_stmt_comment=set_stmt_comment,
        vmap_stmt_expr=vmap_stmt_expr,
        vmap_stmt_name=vmap_stmt_name,
    )
