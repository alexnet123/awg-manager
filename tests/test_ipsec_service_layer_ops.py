import unittest

from backend.domains.ipsec import service_layer_ops
from backend.domains.ipsec import service_ops
from backend.domains.ipsec import store as ipsec_store


class IpsecServiceLayerOpsTest(unittest.TestCase):
    def test_list_delegation(self):
        calls = []
        originals = (
            service_ops.list_peers_service,
            service_ops.list_identities_service,
            service_ops.list_phase1_profiles_service,
            service_ops.list_phase2_proposals_service,
            service_ops.list_policies_service,
        )
        try:
            service_ops.list_peers_service = lambda **kwargs: (calls.append(("peers", kwargs)), ["peers"])[1]
            service_ops.list_identities_service = lambda **kwargs: (calls.append(("identities", kwargs)), ["identities"])[1]
            service_ops.list_phase1_profiles_service = lambda **kwargs: (calls.append(("phase1", kwargs)), ["phase1"])[1]
            service_ops.list_phase2_proposals_service = lambda **kwargs: (calls.append(("phase2", kwargs)), ["phase2"])[1]
            service_ops.list_policies_service = lambda **kwargs: (calls.append(("policies", kwargs)), ["policies"])[1]

            read_collection_fn = object()
            self.assertEqual(service_layer_ops.list_peers(read_collection_fn=read_collection_fn, peers_file="p.json"), ["peers"])
            self.assertEqual(service_layer_ops.list_identities(read_collection_fn=read_collection_fn, identities_file="i.json"), ["identities"])
            self.assertEqual(service_layer_ops.list_phase1_profiles(read_collection_fn=read_collection_fn, phase1_profiles_file="p1.json"), ["phase1"])
            self.assertEqual(service_layer_ops.list_phase2_proposals(read_collection_fn=read_collection_fn, phase2_proposals_file="p2.json"), ["phase2"])
            self.assertEqual(service_layer_ops.list_policies(read_collection_fn=read_collection_fn, policies_file="pol.json"), ["policies"])
            self.assertEqual(calls[0][1], {"read_collection_fn": read_collection_fn, "peers_file": "p.json"})
        finally:
            (
                service_ops.list_peers_service,
                service_ops.list_identities_service,
                service_ops.list_phase1_profiles_service,
                service_ops.list_phase2_proposals_service,
                service_ops.list_policies_service,
            ) = originals

    def test_upsert_and_delete_delegation(self):
        calls = []
        originals = (
            service_ops.upsert_peer_service,
            service_ops.upsert_identity_service,
            service_ops.upsert_phase1_profile_service,
            service_ops.upsert_phase2_proposal_service,
            service_ops.upsert_policy_service,
            service_ops.delete_peer_service,
            service_ops.delete_policy_service,
        )
        try:
            service_ops.upsert_peer_service = lambda payload, **kwargs: (calls.append(("upsert_peer", payload, kwargs)), {"name": "peer"})[1]
            service_ops.upsert_identity_service = lambda payload, **kwargs: (calls.append(("upsert_identity", payload, kwargs)), {"peer": "peer"})[1]
            service_ops.upsert_phase1_profile_service = lambda payload, **kwargs: (calls.append(("upsert_p1", payload, kwargs)), {"name": "p1"})[1]
            service_ops.upsert_phase2_proposal_service = lambda payload, **kwargs: (calls.append(("upsert_p2", payload, kwargs)), {"name": "p2"})[1]
            service_ops.upsert_policy_service = lambda payload, **kwargs: (calls.append(("upsert_policy", payload, kwargs)), {"name": "policy"})[1]
            service_ops.delete_peer_service = lambda name, **kwargs: (calls.append(("delete_peer", name, kwargs)), {"name": name})[1]
            service_ops.delete_policy_service = lambda name, **kwargs: (calls.append(("delete_policy", name, kwargs)), {"name": name})[1]

            payload = {"name": "x"}
            valid_name_fn = object()
            normalize_ip_list_fn = object()
            normalize_config_value_fn = object()
            normalize_ts_list_fn = object()
            secret_encrypt_fn = object()
            build_phase1_proposal_string_fn = object()
            build_phase2_proposal_string_fn = object()
            read_collection_fn = object()
            write_collection_fn = object()

            self.assertEqual(
                service_layer_ops.upsert_peer(
                    payload,
                    valid_name_fn=valid_name_fn,
                    normalize_ip_list_fn=normalize_ip_list_fn,
                    read_collection_fn=read_collection_fn,
                    write_collection_fn=write_collection_fn,
                    peers_file="peers.json",
                    phase1_profiles_file="phase1.json",
                )["name"],
                "peer",
            )
            self.assertEqual(
                service_layer_ops.upsert_identity(
                    payload,
                    valid_name_fn=valid_name_fn,
                    normalize_config_value_fn=normalize_config_value_fn,
                    secret_encrypt_fn=secret_encrypt_fn,
                    read_collection_fn=read_collection_fn,
                    write_collection_fn=write_collection_fn,
                    identities_file="identities.json",
                    peers_file="peers.json",
                )["peer"],
                "peer",
            )
            self.assertEqual(
                service_layer_ops.upsert_phase1_profile(
                    payload,
                    valid_name_fn=valid_name_fn,
                    normalize_config_value_fn=normalize_config_value_fn,
                    build_phase1_proposal_string_fn=build_phase1_proposal_string_fn,
                    read_collection_fn=read_collection_fn,
                    write_collection_fn=write_collection_fn,
                    phase1_profiles_file="phase1.json",
                )["name"],
                "p1",
            )
            self.assertEqual(
                service_layer_ops.upsert_phase2_proposal(
                    payload,
                    valid_name_fn=valid_name_fn,
                    normalize_config_value_fn=normalize_config_value_fn,
                    build_phase2_proposal_string_fn=build_phase2_proposal_string_fn,
                    read_collection_fn=read_collection_fn,
                    write_collection_fn=write_collection_fn,
                    phase2_proposals_file="phase2.json",
                )["name"],
                "p2",
            )
            self.assertEqual(
                service_layer_ops.upsert_policy(
                    payload,
                    valid_name_fn=valid_name_fn,
                    normalize_ts_list_fn=normalize_ts_list_fn,
                    normalize_config_value_fn=normalize_config_value_fn,
                    read_collection_fn=read_collection_fn,
                    write_collection_fn=write_collection_fn,
                    policies_file="policies.json",
                    peers_file="peers.json",
                    phase2_proposals_file="phase2.json",
                )["name"],
                "policy",
            )
            self.assertEqual(
                service_layer_ops.delete_peer(
                    "peer-a",
                    read_collection_fn=read_collection_fn,
                    write_collection_fn=write_collection_fn,
                    peers_file="peers.json",
                    policies_file="policies.json",
                    identities_file="identities.json",
                )["name"],
                "peer-a",
            )
            self.assertEqual(
                service_layer_ops.delete_policy(
                    "policy-a",
                    read_collection_fn=read_collection_fn,
                    write_collection_fn=write_collection_fn,
                    policies_file="policies.json",
                )["name"],
                "policy-a",
            )
            self.assertEqual(calls[0][0], "upsert_peer")
            self.assertEqual(calls[-1][0], "delete_policy")
        finally:
            (
                service_ops.upsert_peer_service,
                service_ops.upsert_identity_service,
                service_ops.upsert_phase1_profile_service,
                service_ops.upsert_phase2_proposal_service,
                service_ops.upsert_policy_service,
                service_ops.delete_peer_service,
                service_ops.delete_policy_service,
            ) = originals

    def test_event_and_runtime_delegation(self):
        calls = []
        originals = (
            service_ops.log_event_service,
            service_ops.list_events_service,
            service_ops.list_active_peers_service,
            service_ops.list_installed_sas_service,
            service_ops.load_peer_service,
            service_ops.initiate_policy_service,
            service_ops.terminate_peer_service,
            service_ops.apply_config_service,
            ipsec_store.append_event,
            ipsec_store.list_events,
        )
        try:
            service_ops.log_event_service = lambda event, payload, **kwargs: calls.append(("log_event", event, payload, kwargs))
            service_ops.list_events_service = lambda **kwargs: (calls.append(("list_events", kwargs)), ["e"])[1]
            service_ops.list_active_peers_service = lambda: (calls.append(("active",)), [{"peer": "a"}])[1]
            service_ops.list_installed_sas_service = lambda: (calls.append(("sas",)), [{"sa": "x"}])[1]
            service_ops.load_peer_service = lambda peer_name, **kwargs: (calls.append(("load_peer", peer_name, kwargs)), {"loaded": peer_name})[1]
            service_ops.initiate_policy_service = lambda policy_name, **kwargs: (calls.append(("initiate", policy_name, kwargs)), {"initiated": policy_name})[1]
            service_ops.terminate_peer_service = lambda peer_name, **kwargs: (calls.append(("terminate", peer_name, kwargs)), {"terminated": peer_name})[1]
            service_ops.apply_config_service = lambda **kwargs: (calls.append(("apply", kwargs)), {"applied": True})[1]
            ipsec_store.append_event = object()
            ipsec_store.list_events = object()

            self.assertIsNone(service_layer_ops.log_event("load_peer", {"peer": "a"}, events_file="events.json"))
            self.assertEqual(service_layer_ops.list_events(events_file="events.json"), ["e"])
            self.assertEqual(service_layer_ops.list_active_peers(), [{"peer": "a"}])
            self.assertEqual(service_layer_ops.list_installed_sas(), [{"sa": "x"}])
            self.assertEqual(
                service_layer_ops.load_peer(
                    "peer-a",
                    read_collection_fn=object(),
                    peers_file="peers.json",
                    identities_file="identities.json",
                    phase1_profiles_file="phase1.json",
                    phase2_proposals_file="phase2.json",
                    policies_file="policies.json",
                    secret_decrypt_fn=object(),
                    log_event_fn=object(),
                ),
                {"loaded": "peer-a"},
            )
            self.assertEqual(
                service_layer_ops.initiate_policy(
                    "policy-a",
                    read_collection_fn=object(),
                    policies_file="policies.json",
                    log_event_fn=object(),
                ),
                {"initiated": "policy-a"},
            )
            self.assertEqual(
                service_layer_ops.terminate_peer(
                    "peer-a",
                    log_event_fn=object(),
                ),
                {"terminated": "peer-a"},
            )
            self.assertEqual(
                service_layer_ops.apply_config(
                    read_collection_fn=object(),
                    peers_file="peers.json",
                    identities_file="identities.json",
                    phase1_profiles_file="phase1.json",
                    phase2_proposals_file="phase2.json",
                    policies_file="policies.json",
                    secret_decrypt_fn=object(),
                    log_event_fn=object(),
                ),
                {"applied": True},
            )

            self.assertEqual(calls[0][0], "log_event")
            self.assertEqual(calls[0][1], "load_peer")
            self.assertEqual(calls[0][3]["events_file"], "events.json")
            self.assertIs(calls[0][3]["append_event_fn"], ipsec_store.append_event)
        finally:
            (
                service_ops.log_event_service,
                service_ops.list_events_service,
                service_ops.list_active_peers_service,
                service_ops.list_installed_sas_service,
                service_ops.load_peer_service,
                service_ops.initiate_policy_service,
                service_ops.terminate_peer_service,
                service_ops.apply_config_service,
                ipsec_store.append_event,
                ipsec_store.list_events,
            ) = originals


if __name__ == "__main__":
    unittest.main()
