import unittest

from backend.domains.firewall import rule_ops


class FirewallRuleOpsTest(unittest.TestCase):
    def test_append_enabled_rule_script_lines(self):
        lines = []

        def _render(rule, table_family="inet"):
            return f'{table_family}:{rule["id"]}'

        rule_ops.append_enabled_rule_script_lines(
            script_lines=lines,
            table_family="inet",
            nft_table="filter",
            table_name="awg_filter",
            rules=[
                {"id": "r1", "enabled": True, "table": "filter", "family": "inet", "chain": "input"},
                {"id": "r2", "enabled": False, "table": "filter", "family": "inet", "chain": "input"},
                {"id": "r3", "enabled": True, "table": "nat", "family": "inet", "chain": "input"},
                {"id": "r4", "enabled": True, "table": "filter", "family": "bridge", "chain": "input"},
                {"id": "r5", "enabled": True, "table": "filter", "chain": "forward"},
            ],
            default_family="inet",
            render_rule_fn=_render,
        )
        self.assertEqual(
            lines,
            [
                "add rule inet awg_filter input inet:r1",
                "add rule inet awg_filter forward inet:r5",
            ],
        )

    def test_render_firewall_rule(self):
        rule_queue = {
            "in_interface": "eth0",
            "out_interface": None,
            "src": "192.0.2.1/32",
            "dst": None,
            "proto": "tcp",
            "ct_state": None,
            "user_id": None,
            "hour": None,
            "dscp": None,
            "sport": "1000:2000",
            "dport": "443",
            "limit_rate": None,
            "limit_name": None,
            "quota_name": None,
            "fib_expr": None,
            "socket_expr": None,
            "rt_expr": None,
            "exthdr_expr": None,
            "raw_expr": None,
            "tcp_flags": None,
            "icmp_type": None,
            "icmp_code": None,
            "icmpv6_type": None,
            "icmpv6_code": None,
            "meta_length": None,
            "meta_priority": None,
            "meta_cpu": None,
            "meta_pkttype": None,
            "meta_iiftype": None,
            "meta_oiftype": None,
            "meta_iifgroup": None,
            "meta_oifgroup": None,
            "mark_match": None,
            "ct_mark_match": None,
            "ct_status": None,
            "ct_direction": None,
            "ct_expiration": None,
            "ct_helper_match": None,
            "ct_label": None,
            "ct_event": None,
            "ct_original_saddr": None,
            "ct_original_daddr": None,
            "ct_reply_saddr": None,
            "ct_reply_daddr": None,
            "fib_check": None,
            "socket_match": None,
            "rt_nexthop": None,
            "ipv6_exthdrs": None,
            "log_prefix": None,
            "log_level": None,
            "log_flags": None,
            "log_group": None,
            "log_queue_threshold": None,
            "log_snaplen": None,
            "counter": False,
            "counter_name": None,
            "notrack": False,
            "nftrace": False,
            "mark_set": None,
            "ct_mark_set": None,
            "ct_helper_set": None,
            "ct_timeout_set": None,
            "ct_expectation_set": None,
            "dup_to": None,
            "dup_dev": None,
            "nat_type": None,
            "to_addr": None,
            "to_port": None,
            "nat_random": False,
            "nat_fully_random": False,
            "nat_persistent": False,
            "action": "queue",
            "queue_num": "0-3",
            "queue_flags": ["fanout", "bypass"],
            "fwd_family": None,
            "fwd_to": None,
            "fwd_dev": None,
            "target_chain": None,
            "reject_type": None,
            "comment": "ok",
            "ether_src": None,
            "ether_dst": None,
            "vlan_id": None,
            "ether_type": None,
            "ibrname": None,
            "obrname": None,
        }
        rendered_queue = rule_ops.render_firewall_rule(rule_queue, table_family="inet")
        self.assertIn('iifname "eth0"', rendered_queue)
        self.assertIn("tcp sport 1000-2000", rendered_queue)
        self.assertIn("queue num 0-3 fanout,bypass", rendered_queue)
        self.assertTrue(rendered_queue.endswith('comment "ok"'))

        rule_nat = dict(rule_queue)
        rule_nat.update(
            {
                "in_interface": None,
                "action": "accept",
                "nat_type": "snat",
                "to_addr": "2001:db8::1",
                "to_port": "5000",
                "nat_random": True,
                "nat_fully_random": False,
                "nat_persistent": True,
                "comment": None,
            }
        )
        rendered_nat = rule_ops.render_firewall_rule(rule_nat, table_family="bridge")
        self.assertIn("snat ip6 to 2001:db8::1:5000 random,persistent", rendered_nat)

    def test_extract_normalized_rule_inputs(self):
        def _norm(v):
            if v is None:
                return None
            t = str(v).strip()
            return t or None

        values = rule_ops.extract_normalized_rule_inputs(
            payload={
                "family": " INET ",
                "table": " FILTER ",
                "chain": " INPUT ",
                "action": " ACCEPT ",
                "proto": " TCP ",
                "log_flags": ["all"],
                "queue_flags": "bypass",
                "nat_random": True,
                "counter": True,
                "enabled": False,
            },
            normalize_value_fn=_norm,
        )
        self.assertEqual(values[0], "INET")
        self.assertEqual(values[1], "filter")
        self.assertEqual(values[2], "input")
        self.assertEqual(values[3], "accept")
        self.assertEqual(values[4], "TCP")
        self.assertEqual(values[28], ["all"])
        self.assertEqual(values[78], "bypass")
        self.assertTrue(values[84])
        self.assertTrue(values[88])
        self.assertFalse(values[89])

        defaults = rule_ops.extract_normalized_rule_inputs(payload={}, normalize_value_fn=_norm)
        self.assertEqual(defaults[0], "inet")
        self.assertEqual(defaults[1], "filter")
        self.assertEqual(defaults[2], "")
        self.assertEqual(defaults[3], "")
        self.assertFalse(defaults[23])
        self.assertFalse(defaults[37])
        self.assertFalse(defaults[84])
        self.assertFalse(defaults[85])
        self.assertFalse(defaults[86])
        self.assertFalse(defaults[88])
        self.assertTrue(defaults[89])

    def test_build_normalized_rule_payload(self):
        payload = rule_ops.build_normalized_rule_payload(
            raw_rule_id=None,
            id_factory=lambda: "generated-id",
            nft_table="filter",
            family="inet",
            chain="input",
            action="accept",
            proto="tcp",
            src="192.0.2.1/32",
            dst=None,
            in_interface="eth0",
            out_interface=None,
            ibrname=None,
            obrname=None,
            sport=12345,
            dport="443",
            comment="ok",
            ct_state="new",
            user_id=1000,
            hour="10:00-11:00",
            dscp="cs1",
            nat_type=None,
            target_chain=None,
            reject_type=None,
            to_addr=None,
            to_port=None,
            nat_random=False,
            nat_fully_random=False,
            nat_persistent=False,
            notrack=False,
            mark_set="0x10",
            ct_mark_set=15,
            log_prefix="pref",
            log_level="info",
            log_flags=["all"],
            log_group="10",
            log_snaplen="256",
            log_queue_threshold="100",
            fib_expr=None,
            socket_expr=None,
            rt_expr=None,
            exthdr_expr=None,
            raw_expr=None,
            nftrace=False,
            tcp_flags="syn",
            icmp_type=None,
            icmp_code=None,
            icmpv6_type=None,
            icmpv6_code=None,
            meta_length="64",
            meta_priority="0x10",
            meta_cpu=1,
            meta_pkttype="host",
            meta_iiftype=10,
            meta_oiftype=None,
            meta_iifgroup=20,
            meta_oifgroup=None,
            mark_match=2,
            ct_mark_match=None,
            ct_status=None,
            ct_direction=None,
            ct_expiration=None,
            ct_helper_match=None,
            ct_label=None,
            ct_event=None,
            ct_original_saddr=None,
            ct_original_daddr=None,
            ct_reply_saddr=None,
            ct_reply_daddr=None,
            fib_check=None,
            socket_match=None,
            rt_nexthop=None,
            ipv6_exthdrs=None,
            vlan_id=100,
            ether_src="AA:BB:CC:DD:EE:FF",
            ether_dst=None,
            ether_type="0x0800",
            ct_helper_set=None,
            ct_timeout_set=None,
            ct_expectation_set=None,
            limit_rate=None,
            counter_name=None,
            limit_name=None,
            quota_name=None,
            queue_num=None,
            queue_flags=None,
            dup_to=None,
            dup_dev=None,
            fwd_to=None,
            fwd_dev=None,
            fwd_family=None,
            counter=True,
            enabled=True,
        )
        self.assertEqual(payload["id"], "generated-id")
        self.assertEqual(payload["sport"], "12345")
        self.assertEqual(payload["dport"], "443")
        self.assertEqual(payload["user_id"], "1000")
        self.assertEqual(payload["log_group"], 10)
        self.assertEqual(payload["log_snaplen"], 256)
        self.assertEqual(payload["log_queue_threshold"], 100)
        self.assertEqual(payload["meta_iiftype"], "10")
        self.assertEqual(payload["mark_set"], "0x10")
        self.assertEqual(payload["ct_mark_set"], "15")
        self.assertEqual(payload["vlan_id"], "100")
        self.assertEqual(payload["ether_src"], "aa:bb:cc:dd:ee:ff")
        self.assertEqual(payload["ether_type"], "0x0800")

    def test_resolve_table_chain_context(self):
        built_in = rule_ops.resolve_table_chain_context(
            family="INET",
            nft_table="filter",
            chain="input",
            default_family="inet",
            schema_tables={
                "filter": {"chains": ("input", "forward", "output")},
                "nat": {"chains": ("prerouting", "output", "postrouting")},
                "raw": {"chains": ("prerouting", "output")},
                "mangle": {"chains": ("prerouting", "input", "forward", "output", "postrouting")},
            },
            read_tables_fn=lambda: {"tables": []},
        )
        self.assertEqual(built_in["family"], "inet")
        self.assertEqual(built_in["table_mode"], "filter")
        self.assertIsNone(built_in["selected_chain"])

        custom = rule_ops.resolve_table_chain_context(
            family="bridge",
            nft_table="policy2",
            chain="ingress_chain",
            default_family="inet",
            schema_tables={"filter": {"chains": ("input",)}, "nat": {"chains": ()}, "raw": {"chains": ()}, "mangle": {"chains": ()}},
            read_tables_fn=lambda: {
                "tables": [
                    {"family": "bridge", "table_name": "policy2", "chain_name": "ingress_chain", "chain_type": "nat", "hook": "prerouting"},
                ]
            },
        )
        self.assertEqual(custom["family"], "bridge")
        self.assertEqual(custom["table_mode"], "nat")
        self.assertEqual(custom["selected_chain"]["hook"], "prerouting")

        with self.assertRaisesRegex(ValueError, "family must be inet, bridge, or netdev"):
            rule_ops.resolve_table_chain_context(
                family="ip",
                nft_table="filter",
                chain="input",
                default_family="inet",
                schema_tables={"filter": {"chains": ("input",)}},
                read_tables_fn=lambda: {"tables": []},
            )

        with self.assertRaisesRegex(ValueError, "table name contains invalid characters"):
            rule_ops.resolve_table_chain_context(
                family="bridge",
                nft_table="bad table",
                chain="input",
                default_family="inet",
                schema_tables={"filter": {"chains": ("input",)}},
                read_tables_fn=lambda: {"tables": []},
            )

        with self.assertRaisesRegex(ValueError, "table \"policy2\" is not found among built-in or custom tables"):
            rule_ops.resolve_table_chain_context(
                family="bridge",
                nft_table="policy2",
                chain="input",
                default_family="inet",
                schema_tables={"filter": {"chains": ("input",)}},
                read_tables_fn=lambda: {"tables": []},
            )

        with self.assertRaisesRegex(ValueError, "chain \"missing\" is not valid for custom table \"policy2\""):
            rule_ops.resolve_table_chain_context(
                family="bridge",
                nft_table="policy2",
                chain="missing",
                default_family="inet",
                schema_tables={"filter": {"chains": ("input",)}},
                read_tables_fn=lambda: {"tables": [{"family": "bridge", "table_name": "policy2", "chain_name": "present"}]},
            )

    def test_normalize_proto_and_basic_match_fields(self):
        normalized = rule_ops.normalize_proto_and_basic_match_fields(
            proto="tcp",
            dport="80:90",
            sport="443",
            tcp_flags="syn",
            icmp_type=None,
            icmp_code=None,
            icmpv6_type=None,
            icmpv6_code=None,
            src="192.0.2.0/24",
            dst="2001:db8::/64",
            in_interface="eth0",
            out_interface="eth1",
            ibrname=None,
            obrname=None,
            enabled="1",
            ct_state="established, related",
            user_id="1000",
            hour="08:00-09:00",
            dscp="CS1",
            comment='quoted "comment"',
            ct_states=("established,related", "new"),
        )
        self.assertTrue(normalized["enabled"])
        self.assertEqual(normalized["ct_state"], "established,related")
        self.assertEqual(normalized["dscp"], "cs1")
        self.assertEqual(normalized["comment"], "quoted 'comment'")

        with self.assertRaisesRegex(ValueError, "tcp_flags requires proto tcp"):
            rule_ops.normalize_proto_and_basic_match_fields(
                proto="udp",
                dport=None,
                sport=None,
                tcp_flags="syn",
                icmp_type=None,
                icmp_code=None,
                icmpv6_type=None,
                icmpv6_code=None,
                src=None,
                dst=None,
                in_interface=None,
                out_interface=None,
                ibrname=None,
                obrname=None,
                enabled=True,
                ct_state=None,
                user_id=None,
                hour=None,
                dscp=None,
                comment=None,
                ct_states=("new",),
            )

        with self.assertRaisesRegex(ValueError, "hour must be HH:MM or HH:MM-HH:MM \\(24h\\)"):
            rule_ops.normalize_proto_and_basic_match_fields(
                proto="tcp",
                dport=None,
                sport=None,
                tcp_flags=None,
                icmp_type=None,
                icmp_code=None,
                icmpv6_type=None,
                icmpv6_code=None,
                src=None,
                dst=None,
                in_interface=None,
                out_interface=None,
                ibrname=None,
                obrname=None,
                enabled=True,
                ct_state=None,
                user_id=None,
                hour="25:00",
                dscp=None,
                comment=None,
                ct_states=("new",),
            )

    def test_normalize_l2_mark_and_expression_fields(self):
        normalized = rule_ops.normalize_l2_mark_fields(
            vlan_id="100",
            ether_src="aa:bb:cc:dd:ee:ff",
            ether_dst="11:22:33:44:55:66",
            ether_type="0x0800",
            mark_set="0x10",
            ct_mark_set="15",
        )
        self.assertEqual(normalized["vlan_id"], "100")
        self.assertEqual(normalized["mark_set"], "0x10")
        self.assertEqual(normalized["ct_mark_set"], "15")

        with self.assertRaisesRegex(ValueError, "vlan_id must be integer in range 1..4095"):
            rule_ops.normalize_l2_mark_fields(
                vlan_id="5000",
                ether_src=None,
                ether_dst=None,
                ether_type=None,
                mark_set=None,
                ct_mark_set=None,
            )

        with self.assertRaisesRegex(ValueError, "mark_set must be integer or hex \\(e.g. 10 or 0x1\\)"):
            rule_ops.normalize_l2_mark_fields(
                vlan_id=None,
                ether_src=None,
                ether_dst=None,
                ether_type=None,
                mark_set="bad",
                ct_mark_set=None,
            )

        rule_ops.validate_expression_fields(
            fib_expr="meta mark 1",
            socket_expr="transparent 1",
            rt_expr="ip daddr",
            exthdr_expr="rt",
            raw_expr="meta nftrace set 1",
        )
        with self.assertRaisesRegex(ValueError, "fib_expr contains invalid characters"):
            rule_ops.validate_expression_fields(
                fib_expr="bad$expr",
                socket_expr=None,
                rt_expr=None,
                exthdr_expr=None,
                raw_expr=None,
            )

    def test_normalize_meta_ct_fib_fields(self):
        normalized = rule_ops.normalize_meta_ct_fib_fields(
            meta_length="64-1500",
            meta_priority="0x10",
            meta_cpu="10",
            meta_pkttype="HOST",
            meta_iiftype="1",
            meta_oiftype="2",
            meta_iifgroup="3",
            meta_oifgroup="4",
            mark_match="0x1",
            ct_mark_match="10",
            ct_status="assured, snat",
            ct_direction="REPLY",
            ct_expiration="30S",
            ct_helper_match="ftp",
            ct_label="0x1",
            ct_event="new, destroy",
            fib_check="saddr . iif oif exists",
            socket_match="transparent 1",
            rt_nexthop="ip daddr",
            ipv6_exthdrs="rt",
            ct_original_saddr="192.0.2.10",
            ct_original_daddr=None,
            ct_reply_saddr="2001:db8::1",
            ct_reply_daddr=None,
        )
        self.assertEqual(normalized["meta_pkttype"], "host")
        self.assertEqual(normalized["ct_status"], "assured,snat")
        self.assertEqual(normalized["ct_direction"], "reply")
        self.assertEqual(normalized["ct_expiration"], "30s")
        self.assertEqual(normalized["ct_event"], "new,destroy")

        with self.assertRaisesRegex(ValueError, "meta_pkttype must be one of: host, broadcast, multicast, other"):
            rule_ops.normalize_meta_ct_fib_fields(
                meta_length=None,
                meta_priority=None,
                meta_cpu=None,
                meta_pkttype="invalid",
                meta_iiftype=None,
                meta_oiftype=None,
                meta_iifgroup=None,
                meta_oifgroup=None,
                mark_match=None,
                ct_mark_match=None,
                ct_status=None,
                ct_direction=None,
                ct_expiration=None,
                ct_helper_match=None,
                ct_label=None,
                ct_event=None,
                fib_check=None,
                socket_match=None,
                rt_nexthop=None,
                ipv6_exthdrs=None,
                ct_original_saddr=None,
                ct_original_daddr=None,
                ct_reply_saddr=None,
                ct_reply_daddr=None,
            )

        with self.assertRaisesRegex(ValueError, "ct_original_saddr must be valid IPv4/IPv6 address"):
            rule_ops.normalize_meta_ct_fib_fields(
                meta_length=None,
                meta_priority=None,
                meta_cpu=None,
                meta_pkttype=None,
                meta_iiftype=None,
                meta_oiftype=None,
                meta_iifgroup=None,
                meta_oifgroup=None,
                mark_match=None,
                ct_mark_match=None,
                ct_status=None,
                ct_direction=None,
                ct_expiration=None,
                ct_helper_match=None,
                ct_label=None,
                ct_event=None,
                fib_check=None,
                socket_match=None,
                rt_nexthop=None,
                ipv6_exthdrs=None,
                ct_original_saddr="bad-ip",
                ct_original_daddr=None,
                ct_reply_saddr=None,
                ct_reply_daddr=None,
            )

    def test_validate_bridge_and_netdev_restrictions(self):
        rule_ops.validate_bridge_runtime_gap_fields(
            family="inet",
            fib_check="x",
            socket_match=None,
            rt_nexthop=None,
            ipv6_exthdrs=None,
        )
        with self.assertRaisesRegex(
            ValueError,
            "fib_check/socket_match/rt_nexthop/ipv6_exthdrs are planned for family=bridge and temporarily disabled on current nft runtime",
        ):
            rule_ops.validate_bridge_runtime_gap_fields(
                family="bridge",
                fib_check="x",
                socket_match=None,
                rt_nexthop=None,
                ipv6_exthdrs=None,
            )

        rule_ops.validate_bridge_disallowed_fields(
            family="inet",
            field_values=(("src", "1.1.1.1"),),
        )
        with self.assertRaisesRegex(ValueError, "src is not supported for family=bridge in Policy v2 MVP"):
            rule_ops.validate_bridge_disallowed_fields(
                family="bridge",
                field_values=(("src", "1.1.1.1"),),
            )

        with self.assertRaisesRegex(ValueError, "family=netdev requires a custom filter chain with hook=ingress and device"):
            rule_ops.validate_netdev_restrictions(
                family="netdev",
                selected_chain={"chain_type": "filter", "hook": "input"},
                selected_device=None,
                field_values=(),
            )

        with self.assertRaisesRegex(ValueError, "out_interface is not supported for family=netdev in Policy3"):
            rule_ops.validate_netdev_restrictions(
                family="netdev",
                selected_chain={"chain_type": "filter", "hook": "ingress"},
                selected_device="eth0",
                field_values=(("out_interface", "eth1"),),
            )

        rule_ops.validate_netdev_restrictions(
            family="netdev",
            selected_chain={"chain_type": "filter", "hook": "ingress"},
            selected_device="eth0",
            field_values=(("out_interface", None), ("nftrace", False)),
        )

    def test_validate_family_specific_restrictions(self):
        rule_ops.validate_family_specific_restrictions(
            family="inet",
            selected_chain=None,
            selected_device=None,
            src=None,
            dst=None,
            in_interface=None,
            out_interface=None,
            ibrname=None,
            obrname=None,
            user_id=None,
            hour=None,
            dscp=None,
            nat_type=None,
            to_addr=None,
            to_port=None,
            nat_random=False,
            nat_fully_random=False,
            nat_persistent=False,
            notrack=False,
            mark_set=None,
            ct_mark_set=None,
            fib_expr=None,
            socket_expr=None,
            rt_expr=None,
            exthdr_expr=None,
            raw_expr=None,
            nftrace=False,
            tcp_flags=None,
            icmp_type=None,
            icmp_code=None,
            icmpv6_type=None,
            icmpv6_code=None,
            meta_length=None,
            meta_priority=None,
            meta_cpu=None,
            meta_iiftype=None,
            meta_oiftype=None,
            meta_oifgroup=None,
            ct_status=None,
            ct_direction=None,
            ct_expiration=None,
            ct_helper_match=None,
            ct_label=None,
            ct_event=None,
            ct_original_saddr=None,
            ct_original_daddr=None,
            ct_reply_saddr=None,
            ct_reply_daddr=None,
            fwd_to=None,
            fwd_dev=None,
            fwd_family=None,
            dup_to=None,
            dup_dev=None,
            fib_check=None,
            socket_match=None,
            rt_nexthop=None,
            ipv6_exthdrs=None,
            ct_helper_set=None,
            ct_timeout_set=None,
            ct_expectation_set=None,
            counter_name=None,
            limit_name=None,
            quota_name=None,
        )

        with self.assertRaisesRegex(ValueError, "src is not supported for family=bridge in Policy v2 MVP"):
            rule_ops.validate_family_specific_restrictions(
                family="bridge",
                selected_chain=None,
                selected_device=None,
                src="1.1.1.1",
                dst=None,
                in_interface=None,
                out_interface=None,
                ibrname=None,
                obrname=None,
                user_id=None,
                hour=None,
                dscp=None,
                nat_type=None,
                to_addr=None,
                to_port=None,
                nat_random=False,
                nat_fully_random=False,
                nat_persistent=False,
                notrack=False,
                mark_set=None,
                ct_mark_set=None,
                fib_expr=None,
                socket_expr=None,
                rt_expr=None,
                exthdr_expr=None,
                raw_expr=None,
                nftrace=False,
                tcp_flags=None,
                icmp_type=None,
                icmp_code=None,
                icmpv6_type=None,
                icmpv6_code=None,
                meta_length=None,
                meta_priority=None,
                meta_cpu=None,
                meta_iiftype=None,
                meta_oiftype=None,
                meta_oifgroup=None,
                ct_status=None,
                ct_direction=None,
                ct_expiration=None,
                ct_helper_match=None,
                ct_label=None,
                ct_event=None,
                ct_original_saddr=None,
                ct_original_daddr=None,
                ct_reply_saddr=None,
                ct_reply_daddr=None,
                fwd_to=None,
                fwd_dev=None,
                fwd_family=None,
                dup_to=None,
                dup_dev=None,
                fib_check=None,
                socket_match=None,
                rt_nexthop=None,
                ipv6_exthdrs=None,
                ct_helper_set=None,
                ct_timeout_set=None,
                ct_expectation_set=None,
                counter_name=None,
                limit_name=None,
                quota_name=None,
            )

        with self.assertRaisesRegex(ValueError, "family=netdev requires a custom filter chain with hook=ingress and device"):
            rule_ops.validate_family_specific_restrictions(
                family="netdev",
                selected_chain={"chain_type": "filter", "hook": "input"},
                selected_device=None,
                src=None,
                dst=None,
                in_interface=None,
                out_interface=None,
                ibrname=None,
                obrname=None,
                user_id=None,
                hour=None,
                dscp=None,
                nat_type=None,
                to_addr=None,
                to_port=None,
                nat_random=False,
                nat_fully_random=False,
                nat_persistent=False,
                notrack=False,
                mark_set=None,
                ct_mark_set=None,
                fib_expr=None,
                socket_expr=None,
                rt_expr=None,
                exthdr_expr=None,
                raw_expr=None,
                nftrace=False,
                tcp_flags=None,
                icmp_type=None,
                icmp_code=None,
                icmpv6_type=None,
                icmpv6_code=None,
                meta_length=None,
                meta_priority=None,
                meta_cpu=None,
                meta_iiftype=None,
                meta_oiftype=None,
                meta_oifgroup=None,
                ct_status=None,
                ct_direction=None,
                ct_expiration=None,
                ct_helper_match=None,
                ct_label=None,
                ct_event=None,
                ct_original_saddr=None,
                ct_original_daddr=None,
                ct_reply_saddr=None,
                ct_reply_daddr=None,
                fwd_to=None,
                fwd_dev=None,
                fwd_family=None,
                dup_to=None,
                dup_dev=None,
                fib_check=None,
                socket_match=None,
                rt_nexthop=None,
                ipv6_exthdrs=None,
                ct_helper_set=None,
                ct_timeout_set=None,
                ct_expectation_set=None,
                counter_name=None,
                limit_name=None,
                quota_name=None,
            )

    def test_normalize_limit_and_named_object_fields(self):
        normalized = rule_ops.normalize_limit_and_named_object_fields(
            limit_rate="10/SECOND",
            counter="true",
            ct_helper_set=None,
            ct_timeout_set=None,
            ct_expectation_set=None,
            counter_name=None,
            limit_name=None,
            quota_name=None,
            family="inet",
        )
        self.assertEqual(normalized["limit_rate"], "10/second")
        self.assertTrue(normalized["counter"])

        bridge_ok = rule_ops.normalize_limit_and_named_object_fields(
            limit_rate=None,
            counter=False,
            ct_helper_set="helper1",
            ct_timeout_set="timeout1",
            ct_expectation_set=None,
            counter_name="counter1",
            limit_name="limit1",
            quota_name="quota1",
            family="bridge",
        )
        self.assertEqual(bridge_ok["ct_helper_set"], "helper1")
        self.assertEqual(bridge_ok["quota_name"], "quota1")

        with self.assertRaisesRegex(ValueError, "counter_name and counter are mutually exclusive"):
            rule_ops.normalize_limit_and_named_object_fields(
                limit_rate=None,
                counter=True,
                ct_helper_set=None,
                ct_timeout_set=None,
                ct_expectation_set=None,
                counter_name="counter1",
                limit_name=None,
                quota_name=None,
                family="bridge",
            )

        with self.assertRaisesRegex(ValueError, "ct_helper_set/ct_timeout_set/ct_expectation_set are supported only for family=bridge in this sprint"):
            rule_ops.normalize_limit_and_named_object_fields(
                limit_rate=None,
                counter=False,
                ct_helper_set="helper1",
                ct_timeout_set=None,
                ct_expectation_set=None,
                counter_name=None,
                limit_name=None,
                quota_name=None,
                family="inet",
            )

        with self.assertRaisesRegex(ValueError, "ct_expectation_set is planned for family=bridge and is temporarily disabled"):
            rule_ops.normalize_limit_and_named_object_fields(
                limit_rate=None,
                counter=False,
                ct_helper_set=None,
                ct_timeout_set=None,
                ct_expectation_set="exp1",
                counter_name=None,
                limit_name=None,
                quota_name=None,
                family="bridge",
            )

    def test_normalize_nat_raw_fields(self):
        nat_types_by_chain = {
            "prerouting": ["dnat", "redirect"],
            "output": ["dnat", "redirect"],
            "postrouting": ["snat", "masquerade"],
            "input": [],
        }
        normalized = rule_ops.normalize_nat_raw_fields(
            table_mode="nat",
            chain="postrouting",
            nat_type="masquerade",
            nat_random="true",
            nat_fully_random=False,
            nat_persistent=False,
            to_addr=None,
            to_port="1000-2000",
            notrack=False,
            nftrace=False,
            raw_expr=None,
            nat_types_by_chain=nat_types_by_chain,
        )
        self.assertEqual(normalized["nat_type"], "masquerade")
        self.assertTrue(normalized["nat_random"])
        self.assertEqual(normalized["to_port"], "1000-2000")

        raw_ok = rule_ops.normalize_nat_raw_fields(
            table_mode="raw",
            chain="prerouting",
            nat_type=None,
            nat_random=False,
            nat_fully_random=False,
            nat_persistent=False,
            to_addr=None,
            to_port=None,
            notrack="1",
            nftrace="yes",
            raw_expr="meta mark 1",
            nat_types_by_chain=nat_types_by_chain,
        )
        self.assertTrue(raw_ok["notrack"])
        self.assertTrue(raw_ok["nftrace"])

        with self.assertRaisesRegex(ValueError, "nat_type is only valid for nat table"):
            rule_ops.normalize_nat_raw_fields(
                table_mode="filter",
                chain="input",
                nat_type="snat",
                nat_random=False,
                nat_fully_random=False,
                nat_persistent=False,
                to_addr=None,
                to_port=None,
                notrack=False,
                nftrace=False,
                raw_expr=None,
                nat_types_by_chain=nat_types_by_chain,
            )

        with self.assertRaisesRegex(ValueError, "to_addr is only valid for snat/dnat"):
            rule_ops.normalize_nat_raw_fields(
                table_mode="nat",
                chain="postrouting",
                nat_type="masquerade",
                nat_random=False,
                nat_fully_random=False,
                nat_persistent=False,
                to_addr="192.0.2.10",
                to_port=None,
                notrack=False,
                nftrace=False,
                raw_expr=None,
                nat_types_by_chain=nat_types_by_chain,
            )

        with self.assertRaisesRegex(ValueError, "raw_expr is only valid for raw table"):
            rule_ops.normalize_nat_raw_fields(
                table_mode="filter",
                chain="input",
                nat_type=None,
                nat_random=False,
                nat_fully_random=False,
                nat_persistent=False,
                to_addr=None,
                to_port=None,
                notrack=False,
                nftrace=False,
                raw_expr="payload",
                nat_types_by_chain=nat_types_by_chain,
            )

    def test_normalize_log_fields(self):
        normalized = rule_ops.normalize_log_fields(
            log_level="INFO",
            log_prefix='hello "x"',
            log_flags_raw=["tcp options", "ether"],
            log_group=None,
            log_snaplen=None,
            log_queue_threshold=None,
        )
        self.assertEqual(normalized["log_level"], "info")
        self.assertEqual(normalized["log_prefix"], "hello 'x'")
        self.assertEqual(normalized["log_flags"], ["tcp options", "ether"])

        with self.assertRaisesRegex(ValueError, "log_group and log_flags are mutually exclusive"):
            rule_ops.normalize_log_fields(
                log_level=None,
                log_prefix=None,
                log_flags_raw=["all"],
                log_group="10",
                log_snaplen=None,
                log_queue_threshold=None,
            )

        with self.assertRaisesRegex(ValueError, "log_snaplen/log_queue_threshold require log_group"):
            rule_ops.normalize_log_fields(
                log_level=None,
                log_prefix=None,
                log_flags_raw=None,
                log_group=None,
                log_snaplen="256",
                log_queue_threshold=None,
            )

        with self.assertRaisesRegex(ValueError, "log_flags supports only: tcp sequence, tcp options, ip options, skuid, ether, all"):
            rule_ops.normalize_log_fields(
                log_level=None,
                log_prefix=None,
                log_flags_raw="invalid",
                log_group=None,
                log_snaplen=None,
                log_queue_threshold=None,
            )

    def test_normalize_queue_dup_fwd_fields(self):
        normalized = rule_ops.normalize_queue_dup_fwd_fields(
            action="queue",
            table_mode="filter",
            family="inet",
            queue_num="10-12",
            queue_flags_raw=["fanout", "bypass"],
            dup_to=None,
            dup_dev=None,
            fwd_to=None,
            fwd_dev=None,
            fwd_family=None,
        )
        self.assertEqual(normalized["queue_num"], "10-12")
        self.assertEqual(normalized["queue_flags"], ["fanout", "bypass"])

        netdev = rule_ops.normalize_queue_dup_fwd_fields(
            action="fwd",
            table_mode="filter",
            family="netdev",
            queue_num=None,
            queue_flags_raw=None,
            dup_to=None,
            dup_dev=None,
            fwd_to="192.0.2.1",
            fwd_dev="eth0",
            fwd_family=None,
        )
        self.assertEqual(netdev["fwd_family"], "ip")
        self.assertEqual(netdev["fwd_to"], "192.0.2.1")

        with self.assertRaisesRegex(ValueError, "queue_flags supports only: bypass, fanout"):
            rule_ops.normalize_queue_dup_fwd_fields(
                action="queue",
                table_mode="filter",
                family="inet",
                queue_num="1-2",
                queue_flags_raw="invalid",
                dup_to=None,
                dup_dev=None,
                fwd_to=None,
                fwd_dev=None,
                fwd_family=None,
            )

        with self.assertRaisesRegex(ValueError, "fwd_to/fwd_dev/fwd_family are supported only for family=netdev"):
            rule_ops.normalize_queue_dup_fwd_fields(
                action="fwd",
                table_mode="filter",
                family="inet",
                queue_num=None,
                queue_flags_raw=None,
                dup_to=None,
                dup_dev=None,
                fwd_to="192.0.2.1",
                fwd_dev="eth0",
                fwd_family="ip",
            )

    def test_validate_action_target_reject_and_proto_fields(self):
        normalized = rule_ops.validate_action_target_reject_and_proto_fields(
            action="reject",
            family="bridge",
            table_mode="filter",
            target_chain=None,
            selected_chain={"hook": "input"},
            reject_type="tcp reset",
            proto="TCP",
            dport="443",
            sport=None,
        )
        self.assertEqual(normalized["proto"], "tcp")

        with self.assertRaisesRegex(ValueError, "target_chain is required for jump/goto"):
            rule_ops.validate_action_target_reject_and_proto_fields(
                action="jump",
                family="inet",
                table_mode="filter",
                target_chain=None,
                selected_chain=None,
                reject_type=None,
                proto=None,
                dport=None,
                sport=None,
            )

        with self.assertRaisesRegex(ValueError, "action=reject is valid for family=bridge only when chain hook is input or prerouting"):
            rule_ops.validate_action_target_reject_and_proto_fields(
                action="reject",
                family="bridge",
                table_mode="filter",
                target_chain=None,
                selected_chain={"hook": "forward"},
                reject_type="icmpx port-unreachable",
                proto=None,
                dport=None,
                sport=None,
            )

        with self.assertRaisesRegex(ValueError, "sport requires proto tcp or udp"):
            rule_ops.validate_action_target_reject_and_proto_fields(
                action="accept",
                family="inet",
                table_mode="filter",
                target_chain=None,
                selected_chain=None,
                reject_type=None,
                proto="icmp",
                dport=None,
                sport="53",
            )

    def test_validate_l4_icmp_literal_fields(self):
        rule_ops.validate_l4_icmp_literal_fields(
            tcp_flags="syn,ack",
            icmp_type="echo-request",
            icmp_code="0",
            icmpv6_type="echo-request",
            icmpv6_code="255",
        )

        with self.assertRaisesRegex(ValueError, "tcp_flags contains invalid characters"):
            rule_ops.validate_l4_icmp_literal_fields(
                tcp_flags="syn$ack",
                icmp_type=None,
                icmp_code=None,
                icmpv6_type=None,
                icmpv6_code=None,
            )

        with self.assertRaisesRegex(ValueError, "icmp_type contains invalid characters"):
            rule_ops.validate_l4_icmp_literal_fields(
                tcp_flags=None,
                icmp_type="echo request!",
                icmp_code=None,
                icmpv6_type=None,
                icmpv6_code=None,
            )

        with self.assertRaisesRegex(ValueError, "icmpv6_code must be 0..255"):
            rule_ops.validate_l4_icmp_literal_fields(
                tcp_flags=None,
                icmp_type=None,
                icmp_code=None,
                icmpv6_type=None,
                icmpv6_code="999",
            )

    def test_list_rules_filters_and_skips_invalid_rows(self):
        raw_rows = [
            {"id": "r1", "table": "filter", "family": "inet"},
            {"id": "r2", "table": "nat", "family": "inet"},
            {"id": "r3", "table": "filter", "family": "ip"},
            {"id": "bad"},
        ]

        def _read_rules():
            return list(raw_rows)

        def _normalize(payload, validate_runtime_objects=True):
            if payload.get("id") == "bad":
                raise ValueError("broken row")
            return dict(payload)

        def _norm(v):
            if v is None:
                return None
            t = str(v).strip()
            return t or None

        all_rows = rule_ops.list_rules(
            family=None,
            table=None,
            read_rules_fn=_read_rules,
            normalize_rule_fn=_normalize,
            normalize_value_fn=_norm,
        )
        self.assertEqual([x["id"] for x in all_rows], ["r1", "r2", "r3"])

        filtered = rule_ops.list_rules(
            family="inet",
            table="filter",
            read_rules_fn=_read_rules,
            normalize_rule_fn=_normalize,
            normalize_value_fn=_norm,
        )
        self.assertEqual([x["id"] for x in filtered], ["r1"])

    def test_create_rule_is_idempotent_for_same_identity(self):
        rules_state = [{"id": "r1", "table": "filter", "family": "inet", "chain": "input", "action": "accept", "enabled": True}]
        writes = {"count": 0}
        applied = {"count": 0}

        def _list_rules():
            return [dict(x) for x in rules_state]

        def _normalize(payload, validate_runtime_objects=True):
            row = dict(payload or {})
            row.setdefault("id", "r2")
            row.setdefault("table", "filter")
            row.setdefault("family", "inet")
            row.setdefault("chain", "input")
            row.setdefault("action", "accept")
            row.setdefault("enabled", True)
            return row

        def _write_rules(data):
            writes["count"] += 1
            rules_state[:] = [dict(x) for x in data]

        def _apply():
            applied["count"] += 1

        row = rule_ops.create_rule(
            payload={"id": "r2"},
            apply_now=True,
            list_rules_fn=_list_rules,
            normalize_rule_fn=_normalize,
            write_rules_fn=_write_rules,
            apply_rules_fn=_apply,
        )
        self.assertEqual(row["id"], "r1")
        self.assertEqual(writes["count"], 0)
        self.assertEqual(applied["count"], 1)

    def test_update_and_delete_rule_with_rollback_on_apply_error(self):
        rules_state = [{"id": "r1", "table": "filter", "enabled": True}]

        def _list_rules():
            return [dict(x) for x in rules_state]

        def _normalize(payload, validate_runtime_objects=True):
            return dict(payload or {})

        def _write_rules(data):
            rules_state[:] = [dict(x) for x in data]

        def _apply_fail():
            raise RuntimeError("apply failed")

        with self.assertRaisesRegex(RuntimeError, "apply failed"):
            rule_ops.update_rule(
                rule_id="r1",
                payload={"table": "nat"},
                apply_now=True,
                list_rules_fn=_list_rules,
                normalize_rule_fn=_normalize,
                write_rules_fn=_write_rules,
                apply_rules_fn=_apply_fail,
            )
        self.assertEqual(rules_state[0]["table"], "filter")

        with self.assertRaisesRegex(RuntimeError, "apply failed"):
            rule_ops.delete_rule(
                rule_id="r1",
                apply_now=True,
                list_rules_fn=_list_rules,
                write_rules_fn=_write_rules,
                apply_rules_fn=_apply_fail,
            )
        self.assertEqual(len(rules_state), 1)
        self.assertEqual(rules_state[0]["id"], "r1")

    def test_reorder_rules_validates_ids_and_reorders_selected_table(self):
        rules_state = [
            {"id": "r1", "table": "filter"},
            {"id": "r2", "table": "nat"},
            {"id": "r3", "table": "filter"},
        ]
        applied = {"count": 0}

        def _list_rules():
            return [dict(x) for x in rules_state]

        def _read_tables():
            return {"tables": []}

        def _write_rules(data):
            rules_state[:] = [dict(x) for x in data]

        def _norm(v):
            if v is None:
                return None
            t = str(v).strip()
            return t or None

        with self.assertRaisesRegex(ValueError, "ordered_ids must contain exactly all ids"):
            rule_ops.reorder_rules(
                table="filter",
                ordered_ids=["r1"],
                apply_now=False,
                list_rules_fn=_list_rules,
                read_tables_fn=_read_tables,
                normalize_value_fn=_norm,
                default_family="inet",
                default_tables=("filter", "nat"),
                write_rules_fn=_write_rules,
                apply_rules_fn=lambda: applied.update(count=applied["count"] + 1),
            )

        items = rule_ops.reorder_rules(
            table="filter",
            ordered_ids=["r3", "r1"],
            apply_now=True,
            list_rules_fn=_list_rules,
            read_tables_fn=_read_tables,
            normalize_value_fn=_norm,
            default_family="inet",
            default_tables=("filter", "nat"),
            write_rules_fn=_write_rules,
            apply_rules_fn=lambda: applied.update(count=applied["count"] + 1),
        )
        self.assertEqual([x["id"] for x in items], ["r3", "r1"])
        self.assertEqual([x["id"] for x in rules_state], ["r3", "r1", "r2"])
        self.assertEqual(applied["count"], 1)


if __name__ == "__main__":
    unittest.main()
