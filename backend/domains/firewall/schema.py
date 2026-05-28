#!/usr/bin/python3

FIREWALL_TABLE_FAMILY = "inet"
FIREWALL_SUPPORTED_TABLE_FAMILIES = ("inet", "ip", "ip6", "bridge", "netdev")
FIREWALL_NAMED_OBJECT_KINDS = ("counter", "limit", "quota", "ct_helper", "ct_timeout", "ct_expectation")
FIREWALL_TABLE_PREFIX = ""
FIREWALL_SCHEMA = {
    "family": FIREWALL_TABLE_FAMILY,
    "tables": {
        "filter": {
            "chains": ["input", "forward", "output"],
            "nat_types": [],
            "supports": [
                "proto", "src", "dst", "sport", "dport", "ct_state", "in_interface", "out_interface", "action",
                "counter", "log", "limit_rate", "user_id", "hour", "dscp", "tcp_flags", "icmp_type", "icmp_code",
                "icmpv6_type", "icmpv6_code", "meta_length", "meta_priority", "meta_cpu", "meta_pkttype",
                "meta_iiftype", "meta_oiftype", "meta_iifgroup", "meta_oifgroup", "mark_match", "ct_mark_match",
                "ct_status", "ct_direction", "ct_expiration", "ct_helper_match", "ct_label", "ct_event",
                "ct_original_saddr", "ct_original_daddr", "ct_reply_saddr", "ct_reply_daddr", "fib_check",
                "socket_match", "rt_nexthop", "ipv6_exthdrs", "vlan_id", "ether_src", "ether_dst", "ether_type",
            ],
        },
        "nat": {
            "chains": ["prerouting", "input", "output", "postrouting"],
            "nat_types_by_chain": {
                "prerouting": ["dnat", "redirect"],
                "input": [],
                "output": ["dnat", "redirect"],
                "postrouting": ["snat", "masquerade"],
            },
            "supports": [
                "proto", "src", "dst", "sport", "dport", "ct_state", "in_interface", "out_interface", "action",
                "counter", "log", "limit_rate", "user_id", "hour", "dscp", "nat_type", "to_addr", "to_port",
                "nat_random", "nat_fully_random", "nat_persistent", "tcp_flags", "icmp_type", "icmp_code",
                "icmpv6_type", "icmpv6_code", "meta_length", "meta_priority", "meta_cpu", "meta_pkttype",
                "meta_iiftype", "meta_oiftype", "meta_iifgroup", "meta_oifgroup", "mark_match", "ct_mark_match",
                "ct_status", "ct_direction", "ct_expiration", "ct_helper_match", "ct_label", "ct_event",
                "ct_original_saddr", "ct_original_daddr", "ct_reply_saddr", "ct_reply_daddr", "fib_check",
                "socket_match", "rt_nexthop", "ipv6_exthdrs", "vlan_id", "ether_src", "ether_dst", "ether_type",
            ],
        },
        "raw": {
            "chains": ["prerouting", "output"],
            "nat_types": [],
            "supports": [
                "proto", "src", "dst", "sport", "dport", "ct_state", "in_interface", "out_interface", "action",
                "counter", "notrack", "raw_expr", "nftrace", "user_id", "hour", "dscp", "tcp_flags", "icmp_type",
                "icmp_code", "icmpv6_type", "icmpv6_code", "meta_length", "meta_priority", "meta_cpu",
                "meta_pkttype", "meta_iiftype", "meta_oiftype", "meta_iifgroup", "meta_oifgroup", "mark_match",
                "ct_mark_match", "ct_status", "ct_direction", "ct_expiration", "ct_helper_match", "ct_label",
                "ct_event", "ct_original_saddr", "ct_original_daddr", "ct_reply_saddr", "ct_reply_daddr",
                "fib_check", "socket_match", "rt_nexthop", "ipv6_exthdrs", "vlan_id", "ether_src", "ether_dst",
                "ether_type",
            ],
        },
        "mangle": {
            "chains": ["prerouting", "input", "forward", "output", "postrouting"],
            "nat_types": [],
            "supports": [
                "proto", "src", "dst", "sport", "dport", "ct_state", "in_interface", "out_interface", "action",
                "counter", "mark_set", "ct_mark_set", "log", "limit_rate", "user_id", "hour", "dscp", "tcp_flags",
                "icmp_type", "icmp_code", "icmpv6_type", "icmpv6_code", "meta_length", "meta_priority", "meta_cpu",
                "meta_pkttype", "meta_iiftype", "meta_oiftype", "meta_iifgroup", "meta_oifgroup", "mark_match",
                "ct_mark_match", "ct_status", "ct_direction", "ct_expiration", "ct_helper_match", "ct_label",
                "ct_event", "ct_original_saddr", "ct_original_daddr", "ct_reply_saddr", "ct_reply_daddr",
                "fib_check", "socket_match", "rt_nexthop", "ipv6_exthdrs", "vlan_id", "ether_src", "ether_dst",
                "ether_type",
            ],
        },
    },
    "actions": ["accept", "drop", "reject", "jump", "goto", "return", "queue", "fwd"],
    "protos": ["tcp", "udp", "icmp", "icmpv6"],
    "ct_states": ["established,related", "new", "invalid", "related", "established", "untracked"],
}
FIREWALL_DEFAULT_TABLE_DEFS = {
    "filter": [
        ("input", "filter", "input", 0, None, "accept"),
        ("forward", "filter", "forward", 0, None, "accept"),
        ("output", "filter", "output", 0, None, "accept"),
    ],
    "nat": [
        ("prerouting", "nat", "prerouting", -100, None, "accept"),
        ("input", "nat", "input", 100, None, "accept"),
        ("output", "nat", "output", -100, None, "accept"),
        ("postrouting", "nat", "postrouting", 100, None, "accept"),
    ],
    "raw": [
        ("prerouting", "filter", "prerouting", -300, None, "accept"),
        ("output", "filter", "output", -300, None, "accept"),
    ],
    "mangle": [
        ("prerouting", "filter", "prerouting", -150, None, "accept"),
        ("input", "filter", "input", -150, None, "accept"),
        ("forward", "filter", "forward", -150, None, "accept"),
        ("output", "filter", "output", -150, None, "accept"),
        ("postrouting", "filter", "postrouting", -150, None, "accept"),
    ],
}
FIREWALL_RESERVED_PRIORITIES = {-300, -150, -100, 0, 100}
