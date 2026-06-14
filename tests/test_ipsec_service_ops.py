import unittest

from backend.domains.ipsec import service_ops


class _FakeSession:
    def __init__(self):
        self._sas = {
            "peer-a": {
                "state": "ESTABLISHED",
                "child-sas": {
                    "policy-a": {"state": "INSTALLED"},
                },
            }
        }
        self.initiated = []
        self.terminated = []
        self.shared = []
        self.conn = []

    def list_sas(self):
        return self._sas

    def load_shared(self, payload):
        self.shared.append(payload)

    def load_conn(self, payload):
        self.conn.append(payload)

    def initiate(self, payload):
        self.initiated.append(payload)

    def terminate(self, payload):
        self.terminated.append(payload)


class IpsecServiceOpsTest(unittest.TestCase):
    def _build_store(self):
        return {
            "peers": [{"name": "peer-a", "phase1_profile": "p1", "local_addrs": ["10.0.0.1"], "remote_addrs": ["203.0.113.1"]}],
            "identities": [{"peer": "peer-a", "local_id": "local-a", "remote_id": "remote-a", "psk_encrypted": "enc"}],
            "phase1": [{"name": "p1", "proposal_string": "aes256-sha256-modp2048"}],
            "phase2": [{"name": "p2", "proposal_string": "aes128-sha1"}],
            "policies": [{"name": "policy-a", "peer": "peer-a", "proposal": "p2", "local_ts": ["10.0.0.0/24"], "remote_ts": ["10.1.0.0/24"], "enabled": True, "start_action": "start"}],
            "events": [],
        }

    def _io(self, store):
        file_map = {
            "peers.json": "peers",
            "identities.json": "identities",
            "phase1.json": "phase1",
            "phase2.json": "phase2",
            "policies.json": "policies",
            "events.json": "events",
        }

        def read_collection(path):
            return [dict(x) for x in store[file_map[path]]]

        def write_collection(path, items):
            store[file_map[path]] = [dict(x) for x in items]

        def append_event(path, event_type, payload, limit=500):
            key = file_map[path]
            store[key].append({"event": event_type, "payload": payload})
            store[key] = store[key][-int(limit) :]

        def list_events(path):
            return [dict(x) for x in store[file_map[path]]]

        return read_collection, write_collection, append_event, list_events

    def test_list_and_upsert_delete_paths(self):
        store = self._build_store()
        read_collection, write_collection, _append_event, _list_events = self._io(store)
        valid_name = lambda value, field_name="name": str(value).strip()
        normalize_config = lambda value: None if value is None else str(value).strip() or None
        normalize_ip_list = lambda value, _field_name: [str(x).strip() for x in value if str(x).strip()]
        normalize_ts_list = lambda value, _field_name: [str(x).strip() for x in value if str(x).strip()]

        peers = service_ops.list_peers_service(read_collection_fn=read_collection, peers_file="peers.json")
        self.assertEqual(peers[0]["name"], "peer-a")
        identities = service_ops.list_identities_service(read_collection_fn=read_collection, identities_file="identities.json")
        self.assertTrue(identities[0]["has_psk"])
        store["policies"][0]["local_ts"] = ["10.0.0.0/24", "10.2.0.0/24"]
        store["policies"][0]["remote_ts"] = ["10.1.0.0/24", "10.3.0.0/24"]
        listed_policies = service_ops.list_policies_service(
            read_collection_fn=read_collection,
            policies_file="policies.json",
        )
        self.assertEqual(listed_policies[0]["local_ts"], ["10.0.0.0/24"])
        self.assertEqual(listed_policies[0]["remote_ts"], ["10.1.0.0/24"])

        created_peer = service_ops.upsert_peer_service(
            {"name": "peer-b", "phase1_profile": "p1", "remote_addrs": ["198.51.100.1"], "local_addrs": ["10.0.0.2"]},
            valid_name_fn=valid_name,
            normalize_ip_list_fn=normalize_ip_list,
            read_collection_fn=read_collection,
            write_collection_fn=write_collection,
            peers_file="peers.json",
            phase1_profiles_file="phase1.json",
        )
        self.assertEqual(created_peer["name"], "peer-b")

        created_policy = service_ops.upsert_policy_service(
            {"name": "policy-b", "peer": "peer-b", "proposal": "p2", "local_ts": ["10.2.0.0/24"], "remote_ts": ["10.3.0.0/24"]},
            valid_name_fn=valid_name,
            normalize_ts_list_fn=normalize_ts_list,
            normalize_config_value_fn=normalize_config,
            read_collection_fn=read_collection,
            write_collection_fn=write_collection,
            policies_file="policies.json",
            peers_file="peers.json",
            phase2_proposals_file="phase2.json",
        )
        self.assertEqual(created_policy["name"], "policy-b")

        deleted = service_ops.delete_policy_service(
            "policy-b",
            read_collection_fn=read_collection,
            write_collection_fn=write_collection,
            policies_file="policies.json",
        )
        self.assertEqual(deleted["name"], "policy-b")

        apply_calls = []
        deleted = service_ops.delete_policy_service(
            "policy-a",
            read_collection_fn=read_collection,
            write_collection_fn=write_collection,
            policies_file="policies.json",
            apply_after_delete_fn=lambda: apply_calls.append("apply"),
        )
        self.assertEqual(deleted["name"], "policy-a")
        self.assertEqual(apply_calls, ["apply"])

        deleted_identity = service_ops.delete_identity_service(
            "peer-a",
            read_collection_fn=read_collection,
            write_collection_fn=write_collection,
            identities_file="identities.json",
        )
        self.assertEqual(deleted_identity["peer"], "peer-a")
        self.assertTrue(deleted_identity["has_psk"])

        store["policies"] = []
        deleted_phase2 = service_ops.delete_phase2_proposal_service(
            "p2",
            read_collection_fn=read_collection,
            write_collection_fn=write_collection,
            phase2_proposals_file="phase2.json",
            policies_file="policies.json",
        )
        self.assertEqual(deleted_phase2["name"], "p2")

        store["peers"] = [x for x in store["peers"] if x.get("phase1_profile") != "p1"]
        deleted_phase1 = service_ops.delete_phase1_profile_service(
            "p1",
            read_collection_fn=read_collection,
            write_collection_fn=write_collection,
            phase1_profiles_file="phase1.json",
            peers_file="peers.json",
        )
        self.assertEqual(deleted_phase1["name"], "p1")

    def test_runtime_paths(self):
        store = self._build_store()
        read_collection, _write_collection, append_event, list_events = self._io(store)
        fake_session = _FakeSession()
        logs = []

        runtime_module = service_ops.runtime_ops
        original_vici_session = runtime_module.vici_session
        original_run_xfrm = runtime_module.run_ip_xfrm_best_effort
        try:
            runtime_module.vici_session = lambda session_factory=None: fake_session if session_factory is None else session_factory()
            runtime_module.run_ip_xfrm_best_effort = lambda run_command_fn=None: {"state": "ok", "policy": "ok"}

            service_ops.log_event_service(
                "seed",
                {"k": 1},
                append_event_fn=append_event,
                events_file="events.json",
            )
            self.assertEqual(len(service_ops.list_events_service(list_events_fn=list_events, events_file="events.json")), 1)

            loaded = service_ops.load_peer_service(
                "peer-a",
                read_collection_fn=read_collection,
                peers_file="peers.json",
                identities_file="identities.json",
                phase1_profiles_file="phase1.json",
                phase2_proposals_file="phase2.json",
                policies_file="policies.json",
                secret_decrypt_fn=lambda value: f"dec:{value}",
                log_event_fn=lambda event, payload: logs.append((event, payload)),
            )
            self.assertTrue(loaded["loaded"])

            initiated = service_ops.initiate_policy_service(
                "policy-a",
                read_collection_fn=read_collection,
                policies_file="policies.json",
                log_event_fn=lambda event, payload: logs.append((event, payload)),
            )
            self.assertTrue(initiated["initiated"])

            terminated = service_ops.terminate_peer_service(
                "peer-a",
                log_event_fn=lambda event, payload: logs.append((event, payload)),
            )
            self.assertTrue(terminated["terminated"])

            applied = service_ops.apply_config_service(
                read_collection_fn=read_collection,
                peers_file="peers.json",
                identities_file="identities.json",
                phase1_profiles_file="phase1.json",
                phase2_proposals_file="phase2.json",
                policies_file="policies.json",
                secret_decrypt_fn=lambda value: f"dec:{value}",
                log_event_fn=lambda event, payload: logs.append((event, payload)),
            )
            self.assertIn("peer-a", applied["loaded_peers"])
            self.assertIn("policy-a", applied["initiated_policies"])
            self.assertEqual(applied["installed_sas"]["xfrm"]["state"], "ok")
        finally:
            runtime_module.vici_session = original_vici_session
            runtime_module.run_ip_xfrm_best_effort = original_run_xfrm


if __name__ == "__main__":
    unittest.main()
