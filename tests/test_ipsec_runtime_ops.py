import types
import unittest

from backend.domains.ipsec import runtime_ops


class _FakeSession:
    def __init__(self, sas=None, raise_on_initiate=False):
        self._sas = sas if sas is not None else {}
        self.raise_on_initiate = raise_on_initiate
        self.loaded_shared = []
        self.loaded_conn = []
        self.initiated = []
        self.terminated = []

    def list_sas(self):
        return self._sas

    def load_shared(self, payload):
        self.loaded_shared.append(payload)

    def load_conn(self, payload):
        self.loaded_conn.append(payload)

    def initiate(self, payload):
        if self.raise_on_initiate:
            raise RuntimeError("initiate failed")
        self.initiated.append(payload)

    def terminate(self, payload):
        self.terminated.append(payload)


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
            list_phase1_profiles_fn=lambda: [{"name": "p1", "proposal_string": "aes256-sha256-modp2048"}],
            list_phase2_proposals_fn=lambda: [{"name": "p2", "proposal_string": "aes128-sha1"}],
            list_policies_fn=lambda: [
                {
                    "name": "pol-a",
                    "peer": "peer-a",
                    "proposal": "p2",
                    "local_ts": ["10.0.0.0/24"],
                    "remote_ts": ["10.1.0.0/24"],
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
        secret = runtime_ops.build_vici_secret_for_peer(
            peer,
            identity,
            secret_decrypt_fn=lambda value: f"dec:{value}",
        )
        self.assertEqual(secret["id"], "ike-peer-a")
        self.assertEqual(secret["type"], "IKE")
        self.assertEqual(secret["data"], "dec:enc")

    def test_sas_extractors(self):
        sas = {
            "peer-a": {
                "remote-host": "203.0.113.10",
                "version": "2",
                "state": "ESTABLISHED",
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
                    }
                },
            }
        }
        active = runtime_ops.extract_active_peers_from_sas(sas)
        self.assertEqual(active[0]["peer"], "peer-a")
        installed = runtime_ops.extract_installed_sas_from_sas(sas)
        self.assertEqual(installed[0]["child_sa"], "pol-a")
        self.assertEqual(installed[0]["bytes_in"], 11)

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
        self.assertEqual(logs[-1][0], "initiate")

        terminate_result = runtime_ops.terminate_peer(
            "peer-a",
            session_factory=lambda: session,
            log_event_fn=lambda event, payload: logs.append((event, payload)),
        )
        self.assertTrue(terminate_result["terminated"])
        self.assertEqual(logs[-1][0], "terminate")

    def test_errors_and_best_effort(self):
        with self.assertRaisesRegex(LookupError, "peer not found"):
            runtime_ops.load_peer(
                "peer-z",
                collect_refs_fn=lambda: [],
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
