import types
import unittest
from collections import OrderedDict

from backend.domains.ipsec import runtime_ops


class _FakeSession:
    def __init__(self, sas=None, raise_on_initiate=False, auto_install_initiated=True):
        self._sas = sas if sas is not None else {}
        self._conns = {}
        self.raise_on_initiate = raise_on_initiate
        self.auto_install_initiated = auto_install_initiated
        self.loaded_shared = []
        self.loaded_conn = []
        self.unloaded_conn = []
        self.initiated = []
        self.initiate_events_consumed = False
        self.terminated = []
        self.terminate_events_consumed = False

    def list_sas(self):
        if isinstance(self._sas, list):
            if len(self._sas) > 1:
                return self._sas.pop(0)
            return self._sas[0] if self._sas else {}
        return self._sas

    def list_conns(self):
        return self._conns

    def load_shared(self, payload):
        self.loaded_shared.append(payload)

    def load_conn(self, payload):
        self.loaded_conn.append(payload)
        self._conns.update(payload)

    def unload_conn(self, payload):
        self.unloaded_conn.append(payload)
        self._conns.pop(str(payload.get("name")), None)
        def _events():
            yield {"success": "yes"}
        return _events()

    def initiate(self, payload):
        if self.raise_on_initiate:
            raise RuntimeError("initiate failed")
        self.initiated.append(payload)
        def _events():
            self.initiate_events_consumed = True
            if self.auto_install_initiated and isinstance(self._sas, dict):
                peer_name = next(iter(self._sas), "peer-a")
                peer = self._sas.setdefault(peer_name, {"state": "ESTABLISHED", "child-sas": {}})
                children = peer.setdefault("child-sas", {})
                child_name = str(payload.get("child") or "")
                if child_name:
                    children.setdefault(child_name, {"state": "INSTALLED", "name": child_name})
            yield {"success": "yes"}
        return _events()

    def terminate(self, payload):
        self.terminated.append(payload)
        def _events():
            self.terminate_events_consumed = True
            yield {"success": "yes"}
        return _events()


class IpsecRuntimeOpsTest(unittest.TestCase):
    def test_collect_refs_and_builders(self):
        refs = runtime_ops.collect_refs(
            list_peers_fn=lambda: [
                {
                    "name": "peer-a",
                    "phase1_profile": "p1",
                    "local_addrs": ["10.0.0.1"],
                    "remote_addrs": ["203.0.113.10"],
                }
            ],
            read_identities_fn=lambda: [
                {
                    "peer": "peer-a",
                    "local_id": "local-a",
                    "remote_id": "remote-a",
                    "psk_encrypted": "enc",
                }
            ],
            list_phase1_profiles_fn=lambda: [
                {
                    "name": "p1",
                    "proposal_string": "aes256-sha256-prfsha256-modp2048",
                    "proposal_check": "strict",
                    "extra_proposals": ["aes128-sha1-prfsha1-modp1024"],
                }
            ],
            list_phase2_proposals_fn=lambda: [
                {
                    "name": "p2",
                    "proposal_string": "aes128-sha1",
                    "extra_proposals": ["aes256gcm16-modp2048-esn"],
                }
            ],
            list_policies_fn=lambda: [
                {
                    "name": "pol-a",
                    "peer": "peer-a",
                    "proposal": "p2",
                    "local_ts": ["10.0.0.0/24"],
                    "remote_ts": ["10.1.0.0/24"],
                    "start_action": "start",
                    "mode": "tunnel",
                    "close_action": "trap",
                    "dpd_action": "restart",
                    "rekey_time": "45m",
                    "life_time": "1h",
                    "rand_time": "5m",
                    "policies": "no",
                    "policies_fwd_out": "yes",
                    "reqid": "42",
                    "priority": "1000",
                    "interface": "eth0",
                    "mark_in": "0x1/0xffffffff",
                    "mark_in_sa": "yes",
                    "mark_out": "%unique",
                    "set_mark_in": "%same",
                    "set_mark_out": "0x2/0xffffffff",
                    "if_id_in": "%unique",
                    "if_id_out": "7",
                },
                {
                    "name": "pol-default",
                    "peer": "peer-a",
                    "proposal": "p2",
                    "local_ts": ["10.2.0.0/24"],
                    "remote_ts": ["10.3.0.0/24"],
                    "start_action": "start",
                    "mode": "tunnel",
                }
            ],
        )
        self.assertEqual(len(refs), 1)
        peer, identity, profile, policies, phase2_index = refs[0]
        conn = runtime_ops.build_vici_connection_for_peer(peer, identity, profile, policies, phase2_index)
        self.assertIn("peer-a", conn)
        self.assertIn("pol-a", conn["peer-a"]["children"])
        self.assertEqual(
            conn["peer-a"]["proposals"],
            ["aes256-sha256-prfsha256-modp2048", "aes128-sha1-prfsha1-modp1024"],
        )
        self.assertNotIn("proposal_check", conn["peer-a"])
        child = conn["peer-a"]["children"]["pol-a"]
        self.assertEqual(child["esp_proposals"], ["aes128-sha1", "aes256gcm16-modp2048-esn"])
        self.assertEqual(child["close_action"], "trap")
        self.assertEqual(child["dpd_action"], "restart")
        self.assertEqual(child["rekey_time"], "45m")
        self.assertEqual(child["life_time"], "1h")
        self.assertEqual(child["rand_time"], "5m")
        self.assertEqual(child["policies"], "no")
        self.assertEqual(child["policies_fwd_out"], "yes")
        self.assertEqual(child["reqid"], "42")
        self.assertEqual(child["priority"], "1000")
        self.assertEqual(child["interface"], "eth0")
        self.assertEqual(child["mark_in"], "0x1/0xffffffff")
        self.assertEqual(child["mark_in_sa"], "yes")
        self.assertEqual(child["mark_out"], "%unique")
        self.assertEqual(child["set_mark_in"], "%same")
        self.assertEqual(child["set_mark_out"], "0x2/0xffffffff")
        self.assertEqual(child["if_id_in"], "%unique")
        self.assertEqual(child["if_id_out"], "7")
        self.assertEqual(conn["peer-a"]["children"]["pol-default"]["dpd_action"], "restart")
        secret = runtime_ops.build_vici_secret_for_peer(
            peer,
            identity,
            secret_decrypt_fn=lambda value: f"dec:{value}",
        )
        self.assertEqual(secret["id"], "ike-peer-a")
        self.assertEqual(secret["type"], "IKE")
        self.assertEqual(secret["data"], "dec:enc")

    def test_build_vici_connection_preserves_supported_child_modes(self):
        peer = {
            "name": "peer-a",
            "phase1_profile": "p1",
            "local_addrs": ["10.0.0.1"],
            "remote_addrs": ["203.0.113.10"],
        }
        identity = {"peer": "peer-a", "psk_encrypted": "enc"}
        profile = {"name": "p1", "proposal_string": "aes256-sha256-prfsha256-modp2048"}
        phase2_index = {"p2": {"name": "p2", "proposal_string": "aes256-sha256-modp2048"}}

        for mode in ("tunnel", "transport", "beet", "pass", "drop"):
            with self.subTest(mode=mode):
                policies = [
                    {
                        "name": f"pol-{mode}",
                        "peer": "peer-a",
                        "proposal": "p2",
                        "local_ts": ["10.0.0.0/24"],
                        "remote_ts": ["10.1.0.0/24"],
                        "start_action": "start",
                        "mode": mode,
                    }
                ]

                conn = runtime_ops.build_vici_connection_for_peer(
                    peer,
                    identity,
                    profile,
                    policies,
                    phase2_index,
                )

                child = conn["peer-a"]["children"][f"pol-{mode}"]
                self.assertEqual(child["mode"], mode)

    def test_build_vici_connection_maps_peer_runtime_flags(self):
        peer = {
            "name": "peer-a",
            "phase1_profile": "p1",
            "local_addrs": ["10.0.0.1"],
            "remote_addrs": ["203.0.113.10"],
            "dpd": True,
            "dpd_delay": "45s",
            "dpd_timeout": "150s",
            "nat_t": True,
            "mobike": "no",
            "fragmentation": "yes",
            "rekey_time": "3h",
            "reauth_time": "0s",
            "over_time": "15m",
            "rand_time": "5m",
            "keyingtries": "3",
            "send_initial_contact": True,
        }
        identity = {"local_id": "local-a", "remote_id": "remote-a"}
        profile = {"proposal_string": "aes256-sha256-modp2048"}
        policies = [
            {
                "name": "pol-a",
                "proposal": "p2",
                "local_ts": ["10.0.0.0/24"],
                "remote_ts": ["10.1.0.0/24"],
            }
        ]
        phase2_index = {"p2": {"proposal_string": "aes128-sha1"}}

        conn = runtime_ops.build_vici_connection_for_peer(peer, identity, profile, policies, phase2_index)

        self.assertEqual(conn["peer-a"]["dpd_delay"], "45s")
        self.assertEqual(conn["peer-a"]["dpd_timeout"], "150s")
        self.assertEqual(conn["peer-a"]["encap"], "yes")
        self.assertEqual(conn["peer-a"]["mobike"], "no")
        self.assertEqual(conn["peer-a"]["fragmentation"], "yes")
        self.assertEqual(conn["peer-a"]["rekey_time"], "3h")
        self.assertEqual(conn["peer-a"]["reauth_time"], "0s")
        self.assertEqual(conn["peer-a"]["over_time"], "15m")
        self.assertEqual(conn["peer-a"]["rand_time"], "5m")
        self.assertEqual(conn["peer-a"]["keyingtries"], "3")
        self.assertEqual(conn["peer-a"]["unique"], "replace")

        peer_without_runtime_flags = dict(peer)
        peer_without_runtime_flags.update(
            {
                "dpd": False,
                "nat_t": False,
                "mobike": "",
                "fragmentation": "",
                "over_time": "",
                "rand_time": "",
                "send_initial_contact": False,
            }
        )
        disabled_conn = runtime_ops.build_vici_connection_for_peer(
            peer_without_runtime_flags, identity, profile, policies, phase2_index
        )
        self.assertNotIn("dpd_delay", disabled_conn["peer-a"])
        self.assertNotIn("encap", disabled_conn["peer-a"])
        self.assertNotIn("mobike", disabled_conn["peer-a"])
        self.assertNotIn("fragmentation", disabled_conn["peer-a"])
        self.assertNotIn("over_time", disabled_conn["peer-a"])
        self.assertNotIn("rand_time", disabled_conn["peer-a"])
        self.assertEqual(disabled_conn["peer-a"]["unique"], "never")

        peer_without_keyingtries = dict(peer)
        peer_without_keyingtries.pop("keyingtries")
        peer_without_keyingtries.pop("rekey_time")
        default_conn = runtime_ops.build_vici_connection_for_peer(
            peer_without_keyingtries, identity, profile, policies, phase2_index
        )
        self.assertEqual(default_conn["peer-a"]["rekey_time"], "1d")
        self.assertEqual(default_conn["peer-a"]["keyingtries"], "0")

    def test_build_vici_connection_maps_ikev1_esp_proposals_to_noesn(self):
        peer = {
            "name": "peer-a",
            "phase1_profile": "p1",
            "local_addrs": ["10.0.0.1"],
            "remote_addrs": ["203.0.113.10"],
            "ike_version": 1,
        }
        identity = {"local_id": "", "remote_id": ""}
        profile = {"proposal_string": "aes256-sha256-modp2048"}
        policies = [
            {
                "name": "pol-a",
                "proposal": "p2",
                "local_ts": ["10.0.0.0/24"],
                "remote_ts": ["10.1.0.0/24"],
            }
        ]
        phase2_index = {
            "p2": {
                "proposal_string": "aes256-sha256-modp2048",
                "extra_proposals": ["aes128-sha1-modp1024", "aes256gcm16-modp2048-esn"],
            }
        }

        conn = runtime_ops.build_vici_connection_for_peer(peer, identity, profile, policies, phase2_index)

        self.assertEqual(
            conn["peer-a"]["children"]["pol-a"]["esp_proposals"],
            ["aes256-sha256-modp2048-noesn", "aes128-sha1-modp1024-noesn", "aes256gcm16-modp2048-esn"],
        )

    def test_build_vici_connection_omits_empty_auto_identity_ids(self):
        peer = {
            "name": "peer-a",
            "phase1_profile": "p1",
            "local_addrs": ["10.0.0.1"],
            "remote_addrs": ["203.0.113.10"],
        }
        profile = {"proposal_string": "aes256-sha256-modp2048"}
        policies = [{"name": "pol-a", "proposal": "p2", "local_ts": ["10.0.0.0/24"], "remote_ts": ["10.1.0.0/24"]}]
        conn = runtime_ops.build_vici_connection_for_peer(
            peer,
            {"local_id": "", "remote_id": ""},
            profile,
            policies,
            {"p2": {"proposal_string": "aes128-sha1"}},
        )
        self.assertEqual(conn["peer-a"]["local"], {"auth": "psk"})
        self.assertEqual(conn["peer-a"]["remote"], {"auth": "psk"})
        secret = runtime_ops.build_vici_secret_for_peer(
            peer,
            {"local_id": "", "remote_id": "", "psk_encrypted": "enc"},
            secret_decrypt_fn=lambda value: f"dec:{value}",
        )
        self.assertEqual(secret["owners"], [])

    def test_build_config_preview_returns_vici_payload_without_touching_session_or_psk(self):
        refs = [
            (
                {
                    "name": "peer-a",
                    "phase1_profile": "p1",
                    "local_addrs": ["10.0.0.1"],
                    "remote_addrs": ["203.0.113.10"],
                },
                {
                    "peer": "peer-a",
                    "local_id": "local-a",
                    "remote_id": "remote-a",
                    "psk_encrypted": "encrypted-secret",
                },
                {"name": "p1", "proposal_string": "aes256-sha256-prfsha256-modp2048"},
                [
                    {
                        "name": "pol-a",
                        "peer": "peer-a",
                        "proposal": "p2",
                        "local_ts": ["10.0.0.0/24"],
                        "remote_ts": ["10.1.0.0/24"],
                        "start_action": "start",
                    },
                    {
                        "name": "pol-disabled",
                        "peer": "peer-a",
                        "proposal": "p2",
                        "local_ts": ["10.2.0.0/24"],
                        "remote_ts": ["10.3.0.0/24"],
                        "enabled": False,
                    },
                ],
                {"p2": {"name": "p2", "proposal_string": "aes256-sha256-modp2048"}},
            ),
            (
                {
                    "name": "peer-disabled",
                    "phase1_profile": "p1-disabled",
                    "local_addrs": ["10.0.0.2"],
                    "remote_addrs": ["203.0.113.11"],
                    "enabled": False,
                },
                {"peer": "peer-disabled", "psk_encrypted": "other-secret"},
                {"name": "p1-disabled", "proposal_string": "aes256-sha256-modp2048"},
                [
                    {
                        "name": "pol-b",
                        "peer": "peer-disabled",
                        "proposal": "p2",
                        "local_ts": ["10.4.0.0/24"],
                        "remote_ts": ["10.5.0.0/24"],
                    }
                ],
                {"p2": {"name": "p2", "proposal_string": "aes256-sha256-modp2048"}},
            ),
        ]

        preview = runtime_ops.build_config_preview(
            collect_refs_fn=lambda: refs,
            build_connection_fn=runtime_ops.build_vici_connection_for_peer,
        )

        self.assertEqual(sorted(preview.keys()), ["connections", "secrets", "warnings"])
        self.assertIn("peer-a", preview["connections"])
        self.assertNotIn("peer-disabled", preview["connections"])
        child = preview["connections"]["peer-a"]["children"]["pol-a"]
        self.assertEqual(child["start_action"], "none")
        self.assertEqual(child["esp_proposals"], ["aes256-sha256-modp2048"])
        self.assertNotIn("pol-disabled", preview["connections"]["peer-a"]["children"])
        self.assertEqual(
            preview["secrets"],
            [{"id": "ike-peer-a", "type": "IKE", "owners": ["local-a", "remote-a"], "secret_set": True}],
        )
        self.assertNotIn("encrypted-secret", str(preview))
        self.assertIn("peer peer-disabled is disabled", preview["warnings"])

    def test_sas_extractors(self):
        sas = {
            "peer-a": {
                "local-host": "198.51.100.1",
                "local-port": "4500",
                "remote-host": "203.0.113.10",
                "remote-port": "4500",
                "version": "2",
                "state": "ESTABLISHED",
                "established": "611",
                "child-sas": {
                    "pol-a": {
                        "state": "INSTALLED",
                        "spi-in": "0x01",
                        "spi-out": "0x02",
                        "local-ts": ["10.0.0.0/24"],
                        "remote-ts": ["10.1.0.0/24"],
                        "proposal": "aes128-sha1",
                        "bytes-in": 11,
                        "bytes-out": 22,
                        "packets-in": 1,
                        "packets-out": 2,
                        "reqid": "42",
                        "uniqueid": "7",
                        "mode": "TUNNEL",
                        "protocol": "ESP",
                        "rekey-time": "50",
                        "life-time": "60",
                        "install-time": "10",
                        "use-in": 21,
                        "use-out": 17,
                    }
                },
            }
        }
        active = runtime_ops.extract_active_peers_from_sas(sas)
        self.assertEqual(active[0]["peer"], "peer-a")
        self.assertEqual(active[0]["local_address"], "198.51.100.1")
        self.assertEqual(active[0]["local_port"], "4500")
        self.assertEqual(active[0]["remote_address"], "203.0.113.10")
        self.assertEqual(active[0]["remote_port"], "4500")
        self.assertEqual(active[0]["dynamic_address"], "")
        self.assertEqual(active[0]["side"], "")
        self.assertEqual(active[0]["uptime"], "00:10:11")
        self.assertEqual(active[0]["last_seen"], "00:00:17")
        self.assertEqual(active[0]["ph2_total"], 1)
        self.assertEqual(active[0]["tx_bytes"], 22)
        self.assertEqual(active[0]["rx_bytes"], 11)
        self.assertEqual(active[0]["tx_packets"], 2)
        self.assertEqual(active[0]["rx_packets"], 1)
        installed = runtime_ops.extract_installed_sas_from_sas(sas)
        self.assertEqual(installed[0]["child_sa"], "pol-a")
        self.assertEqual(installed[0]["bytes_in"], 11)
        self.assertEqual(installed[0]["bytes_out"], 22)
        self.assertEqual(installed[0]["packets_in"], 1)
        self.assertEqual(installed[0]["packets_out"], 2)
        self.assertEqual(installed[0]["reqid"], "42")
        self.assertEqual(installed[0]["uniqueid"], "7")
        self.assertEqual(installed[0]["mode"], "TUNNEL")
        self.assertEqual(installed[0]["protocol"], "ESP")
        self.assertEqual(installed[0]["rekey_time"], "00:00:50")
        self.assertEqual(installed[0]["life_time"], "00:01:00")
        self.assertEqual(installed[0]["install_time"], "00:00:10")
        self.assertEqual(installed[0]["last_seen"], "00:00:17")

    def test_active_peer_without_child_sas_does_not_invent_runtime_values(self):
        sas = {
            "peer-a": {
                "local-host": "198.51.100.1",
                "remote-host": "203.0.113.10",
                "state": "ESTABLISHED",
                "established": "61",
                "child-sas": {},
            }
        }

        active = runtime_ops.extract_active_peers_from_sas(sas)

        self.assertEqual(active[0]["dynamic_address"], "")
        self.assertEqual(active[0]["side"], "")
        self.assertEqual(active[0]["last_seen"], "")
        self.assertEqual(active[0]["ph2_total"], 0)
        self.assertEqual(active[0]["tx_bytes"], 0)
        self.assertEqual(active[0]["rx_bytes"], 0)
        self.assertEqual(active[0]["tx_packets"], 0)
        self.assertEqual(active[0]["rx_packets"], 0)

    def test_list_installed_sas_live_can_skip_xfrm_probe(self):
        session = _FakeSession(
            sas={
                "peer-a": {
                    "child-sas": {
                        "pol-a": {
                            "state": "INSTALLED",
                            "bytes-in": 1,
                            "bytes-out": 2,
                        }
                    }
                }
            }
        )
        calls = []

        result = runtime_ops.list_installed_sas(
            session_factory=lambda: session,
            run_command_fn=lambda cmd: calls.append(cmd) or types.SimpleNamespace(stdout="xfrm"),
            include_xfrm=False,
        )

        self.assertEqual(result["items"][0]["bytes_in"], 1)
        self.assertNotIn("xfrm", result)
        self.assertEqual(calls, [])

    def test_sanitize_vici_sas_normalizes_streamed_python_vici_shape(self):
        raw = iter(
            [
                OrderedDict(
                    [
                        (
                            "peer-a",
                            OrderedDict(
                                [
                                    ("version", b"2"),
                                    ("state", b"ESTABLISHED"),
                                    ("remote-host", b"203.0.113.10"),
                                    ("established", b"51"),
                                    ("rekey-time", b"120"),
                                    (
                                        "child-sas",
                                        OrderedDict(
                                            [
                                                (
                                                    "pol-a-1",
                                                    OrderedDict(
                                                        [
                                                            ("name", b"pol-a"),
                                                            ("state", b"INSTALLED"),
                                                            ("spi-in", b"c2ed7db6"),
                                                            ("spi-out", b"09b5e3d4"),
                                                            ("local-ts", [b"10.0.0.0/24"]),
                                                            ("remote-ts", [b"10.1.0.0/24"]),
                                                            ("bytes-in", b"100"),
                                                            ("bytes-out", b"200"),
                                                        ]
                                                    ),
                                                )
                                            ]
                                        ),
                                    ),
                                ]
                            ),
                        )
                    ]
                )
            ]
        )

        sas = runtime_ops.sanitize_vici_sas(raw)
        active = runtime_ops.extract_active_peers_from_sas(sas)
        installed = runtime_ops.extract_installed_sas_from_sas(sas)

        self.assertEqual(active[0]["peer"], "peer-a")
        self.assertEqual(active[0]["remote_address"], "203.0.113.10")
        self.assertEqual(active[0]["state"], "ESTABLISHED")
        self.assertEqual(installed[0]["child_sa"], "pol-a")
        self.assertEqual(installed[0]["spi_in"], "c2ed7db6")
        self.assertEqual(installed[0]["local_ts"], ["10.0.0.0/24"])
        self.assertEqual(installed[0]["bytes_in"], 100)
        self.assertEqual(installed[0]["bytes_out"], 200)

    def test_runtime_service_flow(self):
        logs = []
        sas = {
            "peer-a": {
                "state": "ESTABLISHED",
                "child-sas": {"pol-a": {"state": "INSTALLED"}},
            }
        }
        session = _FakeSession(sas=sas)
        refs = [
            (
                {"name": "peer-a"},
                {"local_id": "lid", "remote_id": "rid", "psk_encrypted": "enc"},
                {"proposal_string": "ike-prop"},
                [{"name": "pol-a", "enabled": True, "start_action": "start"}],
                {"p2": {"proposal_string": "esp-prop"}},
            )
        ]
        result = runtime_ops.apply_config(
            collect_refs_fn=lambda: refs,
            build_connection_fn=lambda *args: {"peer-a": {"children": {"pol-a": {}}}},
            build_secret_fn=lambda *args: {"id": "ike-peer-a", "type": "IKE", "data": "psk"},
            session_factory=lambda: session,
            run_command_fn=lambda _cmd: types.SimpleNamespace(stdout="ok"),
            log_event_fn=lambda event, payload: logs.append((event, payload)),
        )
        self.assertEqual(result["loaded_peers"], ["peer-a"])
        self.assertEqual(result["initiated_policies"], ["pol-a"])
        self.assertEqual(logs[-1][0], "apply")

        load_result = runtime_ops.load_peer(
            "peer-a",
            collect_refs_fn=lambda: refs,
            build_connection_fn=lambda *args: {"peer-a": {}},
            build_secret_fn=lambda *args: {"id": "ike-peer-a", "type": "IKE", "data": "psk"},
            session_factory=lambda: session,
            log_event_fn=lambda event, payload: logs.append((event, payload)),
        )
        self.assertTrue(load_result["loaded"])
        self.assertEqual(logs[-1][0], "load_peer")

        initiate_result = runtime_ops.initiate_policy(
            "pol-a",
            list_policies_fn=lambda: [{"name": "pol-a"}],
            session_factory=lambda: session,
            log_event_fn=lambda event, payload: logs.append((event, payload)),
        )
        self.assertTrue(initiate_result["initiated"])
        self.assertTrue(session.initiate_events_consumed)
        self.assertEqual(logs[-1][0], "initiate")

        terminate_result = runtime_ops.terminate_peer(
            "peer-a",
            session_factory=lambda: session,
            log_event_fn=lambda event, payload: logs.append((event, payload)),
        )
        self.assertTrue(terminate_result["terminated"])
        self.assertTrue(session.terminate_events_consumed)
        self.assertEqual(logs[-1][0], "terminate")

    def test_runtime_respects_disabled_peer_and_policy(self):
        logs = []
        session = _FakeSession(sas={})
        built = []
        refs = [
            (
                {"name": "peer-a", "enabled": True},
                {"local_id": "lid", "remote_id": "rid", "psk_encrypted": "enc"},
                {"proposal_string": "ike-prop"},
                [
                    {"name": "pol-enabled", "enabled": True, "start_action": "start"},
                    {"name": "pol-disabled", "enabled": False, "start_action": "start"},
                ],
                {"p2": {"proposal_string": "esp-prop"}},
            ),
            (
                {"name": "peer-disabled", "enabled": False},
                {"local_id": "lid2", "remote_id": "rid2", "psk_encrypted": "enc2"},
                {"proposal_string": "ike-prop"},
                [{"name": "pol-other", "enabled": True, "start_action": "start"}],
                {"p2": {"proposal_string": "esp-prop"}},
            ),
        ]

        def _build_connection(peer, _identity, _profile, policies, _phase2):
            built.append((peer["name"], [policy["name"] for policy in policies]))
            return {peer["name"]: {"children": {policy["name"]: {} for policy in policies}}}

        result = runtime_ops.apply_config(
            collect_refs_fn=lambda: refs,
            build_connection_fn=_build_connection,
            build_secret_fn=lambda peer, _identity: {"id": f"ike-{peer['name']}", "type": "IKE", "data": "psk"},
            session_factory=lambda: session,
            run_command_fn=lambda _cmd: types.SimpleNamespace(stdout="ok"),
            log_event_fn=lambda event, payload: logs.append((event, payload)),
        )

        self.assertEqual(result["loaded_peers"], ["peer-a"])
        self.assertEqual(result["initiated_policies"], ["pol-enabled"])
        self.assertEqual(built, [("peer-a", ["pol-enabled"])])
        self.assertEqual(session.initiated, [{"child": "pol-enabled", "timeout": runtime_ops.VICI_INITIATE_TIMEOUT_MS}])
        self.assertIn({"name": "peer-disabled"}, session.unloaded_conn)
        self.assertIn("peer peer-disabled is disabled", result["warnings"])

        with self.assertRaisesRegex(ValueError, "peer is disabled"):
            runtime_ops.load_peer(
                "peer-disabled",
                collect_refs_fn=lambda: refs,
                build_connection_fn=_build_connection,
                build_secret_fn=lambda *args: {"id": "ike-peer-disabled", "type": "IKE", "data": "psk"},
                session_factory=lambda: session,
                log_event_fn=lambda event, payload: logs.append((event, payload)),
            )

        with self.assertRaisesRegex(ValueError, "phase1 profile p1-disabled is disabled"):
            runtime_ops.load_peer(
                "peer-phase1-disabled",
                collect_refs_fn=lambda: [
                    (
                        {"name": "peer-phase1-disabled", "enabled": True, "phase1_profile": "p1-disabled"},
                        {"local_id": "lid", "remote_id": "rid", "psk_encrypted": "enc"},
                        {"name": "p1-disabled", "enabled": False, "proposal_string": "ike-prop"},
                        [{"name": "pol-a", "enabled": True, "proposal": "p2"}],
                        {"p2": {"proposal_string": "esp-prop"}},
                    )
                ],
                build_connection_fn=_build_connection,
                build_secret_fn=lambda *args: {"id": "ike-peer-phase1-disabled", "type": "IKE", "data": "psk"},
                session_factory=lambda: session,
                log_event_fn=lambda event, payload: logs.append((event, payload)),
            )

        with self.assertRaisesRegex(ValueError, "identity is disabled"):
            runtime_ops.load_peer(
                "peer-identity-disabled",
                collect_refs_fn=lambda: [
                    (
                        {"name": "peer-identity-disabled", "enabled": True},
                        {"local_id": "lid", "remote_id": "rid", "psk_encrypted": "enc", "enabled": False},
                        {"name": "p1", "enabled": True, "proposal_string": "ike-prop"},
                        [{"name": "pol-a", "enabled": True, "proposal": "p2"}],
                        {"p2": {"proposal_string": "esp-prop"}},
                    )
                ],
                build_connection_fn=_build_connection,
                build_secret_fn=lambda *args: {"id": "ike-peer-identity-disabled", "type": "IKE", "data": "psk"},
                session_factory=lambda: session,
                log_event_fn=lambda event, payload: logs.append((event, payload)),
            )

        with self.assertRaisesRegex(ValueError, "policy is disabled"):
            runtime_ops.initiate_policy(
                "pol-disabled",
                list_policies_fn=lambda: [{"name": "pol-disabled", "enabled": False}],
                session_factory=lambda: session,
                log_event_fn=lambda event, payload: logs.append((event, payload)),
            )

    def test_apply_config_flushes_stale_child_sas_before_reloading_peer(self):
        session = _FakeSession(
            sas={
                "peer-a": {
                    "state": "ESTABLISHED",
                    "child-sas": {
                        "pol-enabled": {"state": "INSTALLED"},
                        "pol-disabled": {"state": "INSTALLED"},
                    },
                }
            }
        )
        refs = [
            (
                {"name": "peer-a", "enabled": True},
                {"local_id": "lid", "remote_id": "rid", "psk_encrypted": "enc"},
                {"proposal_string": "ike-prop"},
                [
                    {"name": "pol-enabled", "enabled": True, "start_action": "start"},
                    {"name": "pol-disabled", "enabled": False, "start_action": "start"},
                ],
                {"p2": {"proposal_string": "esp-prop"}},
            )
        ]

        result = runtime_ops.apply_config(
            collect_refs_fn=lambda: refs,
            build_connection_fn=lambda peer, _identity, _profile, policies, _phase2: {
                peer["name"]: {"children": {policy["name"]: {} for policy in policies}}
            },
            build_secret_fn=lambda peer, _identity: {"id": f"ike-{peer['name']}", "type": "IKE", "data": "psk"},
            session_factory=lambda: session,
            run_command_fn=lambda _cmd: types.SimpleNamespace(stdout="ok"),
            log_event_fn=lambda _event, _payload: None,
        )

        self.assertEqual(session.terminated, [{"ike": "peer-a", "force": True}])
        self.assertEqual(session.loaded_conn, [{"peer-a": {"children": {"pol-enabled": {}}}}])
        self.assertEqual(result["loaded_peers"], ["peer-a"])
        self.assertEqual(result["initiated_policies"], ["pol-enabled"])

    def test_load_peer_replaces_existing_runtime_connection(self):
        session = _FakeSession()
        logs = []
        refs = [
            (
                {"name": "peer-a", "enabled": True, "ike_version": 2},
                {"local_id": "lid", "remote_id": "rid", "psk_encrypted": "enc"},
                {"proposal_string": "ike-prop"},
                [{"name": "pol-a", "enabled": True, "start_action": "start"}],
                {"p2": {"proposal_string": "esp-prop"}},
            )
        ]

        result = runtime_ops.load_peer(
            "peer-a",
            collect_refs_fn=lambda: refs,
            build_connection_fn=lambda peer, _identity, _profile, policies, _phase2: {
                peer["name"]: {"version": str(peer["ike_version"]), "children": {policy["name"]: {} for policy in policies}}
            },
            build_secret_fn=lambda peer, _identity: {"id": f"ike-{peer['name']}", "type": "IKE", "data": "psk"},
            session_factory=lambda: session,
            log_event_fn=lambda event, payload: logs.append((event, payload)),
        )

        self.assertTrue(result["loaded"])
        self.assertEqual(session.terminated, [{"ike": "peer-a", "force": True}])
        self.assertEqual(session.unloaded_conn, [{"name": "peer-a"}])
        self.assertEqual(session.loaded_conn, [{"peer-a": {"version": "2", "children": {"pol-a": {}}}}])
        self.assertEqual(logs, [("load_peer", {"peer": "peer-a"})])

    def test_apply_config_unloads_peer_when_all_policies_are_disabled(self):
        session = _FakeSession(
            sas={
                "peer-a": {
                    "state": "ESTABLISHED",
                    "child-sas": {"pol-disabled": {"state": "INSTALLED"}},
                }
            }
        )
        refs = [
            (
                {"name": "peer-a", "enabled": True},
                {"local_id": "lid", "remote_id": "rid", "psk_encrypted": "enc"},
                {"proposal_string": "ike-prop"},
                [{"name": "pol-disabled", "enabled": False, "start_action": "start"}],
                {"p2": {"proposal_string": "esp-prop"}},
            )
        ]

        result = runtime_ops.apply_config(
            collect_refs_fn=lambda: refs,
            build_connection_fn=lambda *args: {"peer-a": {"children": {}}},
            build_secret_fn=lambda *args: {"id": "ike-peer-a", "type": "IKE", "data": "psk"},
            session_factory=lambda: session,
            run_command_fn=lambda _cmd: types.SimpleNamespace(stdout="ok"),
            log_event_fn=lambda _event, _payload: None,
        )

        self.assertEqual(session.terminated, [{"ike": "peer-a", "force": True}])
        self.assertEqual(session.unloaded_conn, [{"name": "peer-a"}])
        self.assertEqual(session.loaded_conn, [])
        self.assertEqual(result["loaded_peers"], [])
        self.assertEqual(result["initiated_policies"], [])
        self.assertIn("peer peer-a has no enabled policies", result["warnings"])

    def test_apply_config_unloads_obsolete_runtime_conn_with_same_endpoints(self):
        session = _FakeSession()
        session._conns = {
            "old-peer": {
                "local_addrs": ["195.133.67.169"],
                "remote_addrs": ["195.133.53.242"],
            }
        }
        logs = []
        refs = [
            (
                {
                    "name": "new-peer",
                    "enabled": True,
                    "local_addrs": ["195.133.67.169"],
                    "remote_addrs": ["195.133.53.242"],
                },
                {"local_id": "", "remote_id": "", "psk_encrypted": "enc"},
                {"proposal_string": "ike-prop"},
                [{"name": "child-a", "enabled": True, "start_action": "none", "proposal": "p2"}],
                {"p2": {"proposal_string": "esp-prop"}},
            )
        ]

        result = runtime_ops.apply_config(
            collect_refs_fn=lambda: refs,
            build_connection_fn=lambda peer, _identity, _profile, policies, _phase2: {
                peer["name"]: {
                    "local_addrs": peer["local_addrs"],
                    "remote_addrs": peer["remote_addrs"],
                    "children": {policy["name"]: {} for policy in policies},
                }
            },
            build_secret_fn=lambda peer, _identity: {"id": f"ike-{peer['name']}", "type": "IKE", "data": "psk"},
            session_factory=lambda: session,
            run_command_fn=lambda _cmd: types.SimpleNamespace(stdout="ok"),
            log_event_fn=lambda event, payload: logs.append((event, payload)),
        )

        self.assertIn({"name": "old-peer"}, session.unloaded_conn)
        self.assertEqual(result["loaded_peers"], ["new-peer"])
        self.assertIn("unloaded obsolete runtime connection old-peer", result["warnings"])

    def test_apply_config_unloads_peer_when_phase1_identity_or_phase2_dependency_is_disabled(self):
        session = _FakeSession(sas={})
        refs = [
            (
                {"name": "phase1-peer", "enabled": True},
                {"local_id": "lid", "remote_id": "rid", "psk_encrypted": "enc"},
                {"name": "p1-disabled", "enabled": False, "proposal_string": "ike-prop"},
                [{"name": "phase1-pol", "enabled": True, "proposal": "p2", "start_action": "start"}],
                {"p2": {"name": "p2", "enabled": True, "proposal_string": "esp-prop"}},
            ),
            (
                {"name": "identity-peer", "enabled": True},
                {"local_id": "lid", "remote_id": "rid", "psk_encrypted": "enc", "enabled": False},
                {"name": "p1", "enabled": True, "proposal_string": "ike-prop"},
                [{"name": "identity-pol", "enabled": True, "proposal": "p2", "start_action": "start"}],
                {"p2": {"name": "p2", "enabled": True, "proposal_string": "esp-prop"}},
            ),
            (
                {"name": "phase2-peer", "enabled": True},
                {"local_id": "lid", "remote_id": "rid", "psk_encrypted": "enc"},
                {"name": "p1", "enabled": True, "proposal_string": "ike-prop"},
                [{"name": "phase2-pol", "enabled": True, "proposal": "p2-disabled", "start_action": "start"}],
                {"p2-disabled": {"name": "p2-disabled", "enabled": False, "proposal_string": "esp-prop"}},
            ),
        ]

        result = runtime_ops.apply_config(
            collect_refs_fn=lambda: refs,
            build_connection_fn=lambda peer, _identity, _profile, policies, _phase2: {
                peer["name"]: {"children": {policy["name"]: {} for policy in policies}}
            },
            build_secret_fn=lambda peer, _identity: {"id": f"ike-{peer['name']}", "type": "IKE", "data": "psk"},
            session_factory=lambda: session,
            run_command_fn=lambda _cmd: types.SimpleNamespace(stdout="ok"),
            log_event_fn=lambda _event, _payload: None,
        )

        self.assertEqual(session.loaded_conn, [])
        self.assertEqual(session.initiated, [])
        self.assertEqual(
            session.unloaded_conn,
            [{"name": "phase1-peer"}, {"name": "identity-peer"}, {"name": "phase2-peer"}],
        )
        self.assertIn("peer phase1-peer phase1 profile p1-disabled is disabled", result["warnings"])
        self.assertIn("peer identity-peer identity is disabled", result["warnings"])
        self.assertIn("policy phase2-pol phase2 proposal p2-disabled is disabled", result["warnings"])
        self.assertIn("peer phase2-peer has no enabled policies", result["warnings"])

    def test_apply_config_drains_initiate_events_before_returning_state(self):
        session = _FakeSession(
            sas={"peer-a": {"state": "ESTABLISHED", "child-sas": {}}},
            auto_install_initiated=True,
        )
        refs = [
            (
                {"name": "peer-a", "enabled": True},
                {"local_id": "lid", "remote_id": "rid", "psk_encrypted": "enc"},
                {"proposal_string": "ike-prop"},
                [
                    {"name": "pol-a", "enabled": True, "start_action": "start"},
                    {"name": "pol-b", "enabled": True, "start_action": "start"},
                ],
                {"p2": {"proposal_string": "esp-prop"}},
            )
        ]

        result = runtime_ops.apply_config(
            collect_refs_fn=lambda: refs,
            build_connection_fn=lambda peer, _identity, _profile, policies, _phase2: {
                peer["name"]: {"children": {policy["name"]: {} for policy in policies}}
            },
            build_secret_fn=lambda peer, _identity: {"id": f"ike-{peer['name']}", "type": "IKE", "data": "psk"},
            session_factory=lambda: session,
            run_command_fn=lambda _cmd: types.SimpleNamespace(stdout="ok"),
            log_event_fn=lambda _event, _payload: None,
        )

        self.assertTrue(session.initiate_events_consumed)
        self.assertEqual(result["initiated_policies"], ["pol-a", "pol-b"])
        self.assertEqual(
            [item["child_sa"] for item in result["installed_sas"]["items"]],
            ["pol-a", "pol-b"],
        )

    def test_apply_config_treats_post_initiate_installed_child_as_success(self):
        session = _FakeSession(
            sas=[
                {"peer-a": {"state": "ESTABLISHED", "child-sas": {}}},
                {
                    "peer-a": {
                        "state": "ESTABLISHED",
                        "child-sas": {"pol-a": {"state": "INSTALLED", "name": "pol-a"}},
                    }
                },
            ],
            raise_on_initiate=True,
        )
        refs = [
            (
                {"name": "peer-a", "enabled": True, "ike_version": 2},
                {"local_id": "lid", "remote_id": "rid", "psk_encrypted": "enc"},
                {"proposal_string": "ike-prop"},
                [{"name": "pol-a", "enabled": True, "start_action": "start"}],
                {"p2": {"proposal_string": "esp-prop"}},
            )
        ]

        result = runtime_ops.apply_config(
            collect_refs_fn=lambda: refs,
            build_connection_fn=lambda peer, _identity, _profile, policies, _phase2: {
                peer["name"]: {"children": {policy["name"]: {} for policy in policies}}
            },
            build_secret_fn=lambda peer, _identity: {"id": f"ike-{peer['name']}", "type": "IKE", "data": "psk"},
            session_factory=lambda: session,
            run_command_fn=lambda _cmd: types.SimpleNamespace(stdout="ok"),
            log_event_fn=lambda _event, _payload: None,
            sleep_fn=lambda _seconds: None,
        )

        self.assertEqual(result["initiated_policies"], ["pol-a"])
        self.assertEqual([item["child_sa"] for item in result["installed_sas"]["items"]], ["pol-a"])
        self.assertEqual(result["warnings"], [])

    def test_apply_config_waits_for_ikev1_children_instead_of_direct_initiate(self):
        session = _FakeSession(
            sas=[
                {"peer-a": {"state": "ESTABLISHED", "version": "1", "child-sas": {}}},
                {
                    "peer-a": {
                        "state": "ESTABLISHED",
                        "version": "1",
                        "child-sas": {"pol-a": {"state": "INSTALLED", "name": "pol-a"}},
                    }
                },
            ]
        )
        refs = [
            (
                {"name": "peer-a", "enabled": True, "ike_version": 1},
                {"local_id": "lid", "remote_id": "rid", "psk_encrypted": "enc"},
                {"proposal_string": "ike-prop"},
                [{"name": "pol-a", "enabled": True, "start_action": "start"}],
                {"p2": {"proposal_string": "esp-prop"}},
            )
        ]

        result = runtime_ops.apply_config(
            collect_refs_fn=lambda: refs,
            build_connection_fn=lambda peer, _identity, _profile, policies, _phase2: {
                peer["name"]: {"children": {policy["name"]: {} for policy in policies}}
            },
            build_secret_fn=lambda peer, _identity: {"id": f"ike-{peer['name']}", "type": "IKE", "data": "psk"},
            session_factory=lambda: session,
            run_command_fn=lambda _cmd: types.SimpleNamespace(stdout="ok"),
            log_event_fn=lambda _event, _payload: None,
            sleep_fn=lambda _seconds: None,
        )

        self.assertEqual(session.initiated, [])
        self.assertEqual(result["initiated_policies"], ["pol-a"])
        self.assertEqual([item["child_sa"] for item in result["installed_sas"]["items"]], ["pol-a"])
        self.assertEqual(result["warnings"], [])

    def test_apply_config_builds_full_vici_payload_fixture(self):
        logs = []
        session = _FakeSession(
            sas={
                "branch-peer": {
                    "state": "ESTABLISHED",
                    "remote-host": "198.51.100.10",
                    "version": "2",
                    "child-sas": {
                        "branch-lan": {
                            "state": "INSTALLED",
                            "spi-in": "0x01",
                            "spi-out": "0x02",
                            "local-ts": ["10.10.0.0/24"],
                            "remote-ts": ["10.20.0.0/24"],
                            "proposal": "aes256gcm16-prfsha384-ecp384-esn",
                            "bytes-in": 100,
                            "bytes-out": 200,
                        }
                    },
                }
            }
        )

        refs_fn = lambda: runtime_ops.collect_refs(
            list_peers_fn=lambda: [
                {
                    "name": "branch-peer",
                    "enabled": True,
                    "phase1_profile": "ike-strong",
                    "local_addrs": ["203.0.113.5"],
                    "remote_addrs": ["198.51.100.10"],
                    "ike_version": 1,
                    "dpd": True,
                    "dpd_delay": "20s",
                    "dpd_timeout": "90s",
                    "nat_t": True,
                    "mobike": "no",
                    "fragmentation": "force",
                    "rekey_time": "3h",
                    "reauth_time": "0s",
                    "over_time": "10m",
                    "rand_time": "3m",
                    "keyingtries": "2",
                    "send_initial_contact": True,
                }
            ],
            read_identities_fn=lambda: [
                {
                    "peer": "branch-peer",
                    "local_id": "203.0.113.5",
                    "remote_id": "198.51.100.10",
                    "psk_encrypted": "encrypted-psk",
                }
            ],
            list_phase1_profiles_fn=lambda: [
                {
                    "name": "ike-strong",
                    "proposal_string": "aes256-sha256-prfsha256-modp2048",
                    "proposal_check": "strict",
                    "extra_proposals": ["aes256gcm16-prfsha384-ecp384"],
                }
            ],
            list_phase2_proposals_fn=lambda: [
                {
                    "name": "esp-strong",
                    "proposal_string": "aes256gcm16-ecp384-esn",
                    "extra_proposals": ["aes256-sha256-modp2048-noesn"],
                }
            ],
            list_policies_fn=lambda: [
                {
                    "name": "branch-lan",
                    "peer": "branch-peer",
                    "enabled": True,
                    "proposal": "esp-strong",
                    "local_ts": ["10.10.0.0/24"],
                    "remote_ts": ["10.20.0.0/24"],
                    "mode": "tunnel",
                    "start_action": "start",
                    "close_action": "trap",
                    "dpd_action": "restart",
                    "rekey_time": "50m",
                    "life_time": "1h",
                    "rand_time": "5m",
                    "policies": "yes",
                    "policies_fwd_out": "yes",
                    "reqid": "42",
                    "priority": "1000",
                    "interface": "xfrm0",
                    "mark_in": "0x1/0xffffffff",
                    "mark_in_sa": "yes",
                    "mark_out": "%unique",
                    "set_mark_in": "%same",
                    "set_mark_out": "0x2/0xffffffff",
                    "if_id_in": "%unique",
                    "if_id_out": "7",
                },
                {
                    "name": "disabled-lan",
                    "peer": "branch-peer",
                    "enabled": False,
                    "proposal": "esp-strong",
                    "local_ts": ["10.30.0.0/24"],
                    "remote_ts": ["10.40.0.0/24"],
                    "start_action": "start",
                },
            ],
        )

        result = runtime_ops.apply_config(
            collect_refs_fn=refs_fn,
            build_connection_fn=runtime_ops.build_vici_connection_for_peer,
            build_secret_fn=lambda peer, identity: runtime_ops.build_vici_secret_for_peer(
                peer,
                identity,
                secret_decrypt_fn=lambda value: f"decrypted:{value}",
            ),
            session_factory=lambda: session,
            run_command_fn=lambda _cmd: types.SimpleNamespace(stdout="ok"),
            log_event_fn=lambda event, payload: logs.append((event, payload)),
        )

        self.assertEqual(result["loaded_peers"], ["branch-peer"])
        self.assertEqual(result["initiated_policies"], ["branch-lan"])
        self.assertEqual(result["active_peers"][0]["peer"], "branch-peer")
        self.assertEqual(result["installed_sas"]["items"][0]["child_sa"], "branch-lan")
        self.assertEqual(logs[-1], ("apply", {"loaded_peers": ["branch-peer"], "initiated_policies": ["branch-lan"]}))

        self.assertEqual(
            session.loaded_shared,
            [
                {
                    "id": "ike-branch-peer",
                    "type": "IKE",
                    "data": "decrypted:encrypted-psk",
                    "owners": ["203.0.113.5", "198.51.100.10"],
                }
            ],
        )
        conn = session.loaded_conn[0]["branch-peer"]
        self.assertEqual(conn["version"], "1")
        self.assertEqual(conn["local_addrs"], ["203.0.113.5"])
        self.assertEqual(conn["remote_addrs"], ["198.51.100.10"])
        self.assertEqual(conn["local"], {"auth": "psk", "id": "203.0.113.5"})
        self.assertEqual(conn["remote"], {"auth": "psk", "id": "198.51.100.10"})
        self.assertEqual(conn["proposals"], ["aes256-sha256-prfsha256-modp2048", "aes256gcm16-prfsha384-ecp384"])
        self.assertNotIn("proposal_check", conn)
        self.assertEqual(conn["dpd_delay"], "20s")
        self.assertEqual(conn["dpd_timeout"], "90s")
        self.assertEqual(conn["encap"], "yes")
        self.assertEqual(conn["mobike"], "no")
        self.assertEqual(conn["fragmentation"], "force")
        self.assertEqual(conn["rekey_time"], "3h")
        self.assertEqual(conn["reauth_time"], "0s")
        self.assertEqual(conn["over_time"], "10m")
        self.assertEqual(conn["rand_time"], "3m")
        self.assertEqual(conn["keyingtries"], "2")
        self.assertEqual(conn["unique"], "replace")
        self.assertEqual(set(conn["children"].keys()), {"branch-lan"})

        child = conn["children"]["branch-lan"]
        self.assertEqual(child["local_ts"], ["10.10.0.0/24"])
        self.assertEqual(child["remote_ts"], ["10.20.0.0/24"])
        self.assertEqual(child["esp_proposals"], ["aes256gcm16-ecp384-esn", "aes256-sha256-modp2048-noesn"])
        self.assertEqual(child["start_action"], "none")
        self.assertEqual(child["close_action"], "trap")
        self.assertEqual(child["dpd_action"], "restart")
        self.assertEqual(child["rekey_time"], "50m")
        self.assertEqual(child["life_time"], "1h")
        self.assertEqual(child["rand_time"], "5m")
        self.assertEqual(child["policies"], "yes")
        self.assertEqual(child["policies_fwd_out"], "yes")
        self.assertEqual(child["reqid"], "42")
        self.assertEqual(child["priority"], "1000")
        self.assertEqual(child["interface"], "xfrm0")
        self.assertEqual(child["mark_in"], "0x1/0xffffffff")
        self.assertEqual(child["mark_in_sa"], "yes")
        self.assertEqual(child["mark_out"], "%unique")
        self.assertEqual(child["set_mark_in"], "%same")
        self.assertEqual(child["set_mark_out"], "0x2/0xffffffff")
        self.assertEqual(child["if_id_in"], "%unique")
        self.assertEqual(child["if_id_out"], "7")

    def test_errors_and_best_effort(self):
        with self.assertRaisesRegex(ValueError, "peer peer-a references unknown phase1 profile"):
            runtime_ops.collect_refs(
                list_peers_fn=lambda: [{"name": "peer-a", "phase1_profile": "missing"}],
                read_identities_fn=lambda: [],
                list_phase1_profiles_fn=lambda: [],
                list_phase2_proposals_fn=lambda: [],
                list_policies_fn=lambda: [],
            )

        with self.assertRaisesRegex(ValueError, "peer peer-a has no identity"):
            runtime_ops.collect_refs(
                list_peers_fn=lambda: [{"name": "peer-a", "phase1_profile": "p1"}],
                read_identities_fn=lambda: [],
                list_phase1_profiles_fn=lambda: [{"name": "p1"}],
                list_phase2_proposals_fn=lambda: [],
                list_policies_fn=lambda: [],
            )

        with self.assertRaisesRegex(ValueError, "peer peer-a has no policies"):
            runtime_ops.collect_refs(
                list_peers_fn=lambda: [{"name": "peer-a", "phase1_profile": "p1"}],
                read_identities_fn=lambda: [{"peer": "peer-a"}],
                list_phase1_profiles_fn=lambda: [{"name": "p1"}],
                list_phase2_proposals_fn=lambda: [],
                list_policies_fn=lambda: [],
            )

        with self.assertRaisesRegex(ValueError, "policy pol-a references unknown phase2 proposal"):
            runtime_ops.build_vici_connection_for_peer(
                {"name": "peer-a"},
                {"local_id": "local", "remote_id": "remote"},
                {"proposal_string": "ike-prop"},
                [{"name": "pol-a", "proposal": "missing"}],
                {},
            )

        with self.assertRaisesRegex(LookupError, "peer not found"):
            runtime_ops.load_peer(
                "peer-z",
                collect_refs_fn=lambda: [],
                build_connection_fn=lambda *args: {},
                build_secret_fn=lambda *args: {},
                session_factory=lambda: _FakeSession(),
                log_event_fn=lambda _event, _payload: None,
            )

        with self.assertRaisesRegex(ValueError, "peer has no enabled policies"):
            runtime_ops.load_peer(
                "peer-a",
                collect_refs_fn=lambda: [
                    (
                        {"name": "peer-a", "enabled": True},
                        {"local_id": "local", "remote_id": "remote"},
                        {"proposal_string": "ike-prop"},
                        [{"name": "pol-disabled", "enabled": False}],
                        {"p2": {"proposal_string": "esp-prop"}},
                    )
                ],
                build_connection_fn=lambda *args: {},
                build_secret_fn=lambda *args: {},
                session_factory=lambda: _FakeSession(),
                log_event_fn=lambda _event, _payload: None,
            )

        with self.assertRaisesRegex(LookupError, "policy not found"):
            runtime_ops.initiate_policy(
                "pol-z",
                list_policies_fn=lambda: [],
                session_factory=lambda: _FakeSession(),
                log_event_fn=lambda _event, _payload: None,
            )

        result = runtime_ops.apply_config(
            collect_refs_fn=lambda: [
                (
                    {"name": "peer-a", "enabled": True},
                    {"local_id": "local", "remote_id": "remote"},
                    {"proposal_string": "ike-prop"},
                    [{"name": "pol-a", "enabled": True, "start_action": "start"}],
                    {"p2": {"proposal_string": "esp-prop"}},
                )
            ],
            build_connection_fn=lambda *args: {"peer-a": {"children": {"pol-a": {}}}},
            build_secret_fn=lambda *args: {"id": "ike-peer-a", "type": "IKE", "data": "psk"},
            session_factory=lambda: _FakeSession(raise_on_initiate=True),
            run_command_fn=lambda _cmd: types.SimpleNamespace(stdout="ok"),
            log_event_fn=lambda _event, _payload: None,
        )
        self.assertIn("initiate failed for pol-a: initiate failed", result["warnings"])

        xfrm = runtime_ops.run_ip_xfrm_best_effort(
            run_command_fn=lambda _cmd: (_ for _ in ()).throw(RuntimeError("boom"))
        )
        self.assertEqual(xfrm, {"state": "", "policy": ""})

        no_vici_active = runtime_ops.list_active_peers(
            session_factory=lambda: (_ for _ in ()).throw(RuntimeError("no vici"))
        )
        self.assertEqual(no_vici_active, [])

        no_vici_installed = runtime_ops.list_installed_sas(
            session_factory=lambda: (_ for _ in ()).throw(RuntimeError("no vici")),
            run_command_fn=lambda _cmd: types.SimpleNamespace(stdout=""),
        )
        self.assertEqual(no_vici_installed["items"], [])


if __name__ == "__main__":
    unittest.main()
