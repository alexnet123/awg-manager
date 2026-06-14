import unittest

from backend.domains.ipsec import service_facade_ops
from backend.domains.ipsec import service_layer_ops


class IpsecServiceFacadeOpsTest(unittest.TestCase):
    def test_list_and_delete_wiring(self):
        calls = []
        originals = (
            service_layer_ops.list_peers,
            service_layer_ops.list_identities,
            service_layer_ops.list_phase1_profiles,
            service_layer_ops.list_phase2_proposals,
            service_layer_ops.list_policies,
            service_layer_ops.delete_peer,
            service_layer_ops.delete_policy,
            service_layer_ops.delete_identity,
            service_layer_ops.delete_phase1_profile,
            service_layer_ops.delete_phase2_proposal,
        )
        try:
            service_layer_ops.list_peers = lambda **kwargs: (calls.append(("peers", kwargs)), ["p"])[1]
            service_layer_ops.list_identities = lambda **kwargs: (calls.append(("identities", kwargs)), ["i"])[1]
            service_layer_ops.list_phase1_profiles = lambda **kwargs: (calls.append(("p1", kwargs)), ["p1"])[1]
            service_layer_ops.list_phase2_proposals = lambda **kwargs: (calls.append(("p2", kwargs)), ["p2"])[1]
            service_layer_ops.list_policies = lambda **kwargs: (calls.append(("pol", kwargs)), ["pol"])[1]
            service_layer_ops.delete_peer = lambda name, **kwargs: (calls.append(("del_peer", name, kwargs)), {"name": name})[1]
            service_layer_ops.delete_policy = lambda name, **kwargs: (calls.append(("del_pol", name, kwargs)), {"name": name})[1]
            service_layer_ops.delete_identity = lambda name, **kwargs: (calls.append(("del_identity", name, kwargs)), {"peer": name})[1]
            service_layer_ops.delete_phase1_profile = lambda name, **kwargs: (calls.append(("del_p1", name, kwargs)), {"name": name})[1]
            service_layer_ops.delete_phase2_proposal = lambda name, **kwargs: (calls.append(("del_p2", name, kwargs)), {"name": name})[1]

            self.assertEqual(service_facade_ops.list_peers_service(peers_file="peers.json"), ["p"])
            self.assertEqual(service_facade_ops.list_identities_service(identities_file="identities.json"), ["i"])
            self.assertEqual(service_facade_ops.list_phase1_profiles_service(phase1_profiles_file="phase1.json"), ["p1"])
            self.assertEqual(service_facade_ops.list_phase2_proposals_service(phase2_proposals_file="phase2.json"), ["p2"])
            self.assertEqual(service_facade_ops.list_policies_service(policies_file="policies.json"), ["pol"])
            self.assertEqual(
                service_facade_ops.delete_peer_service(
                    "peer-a",
                    peers_file="peers.json",
                    policies_file="policies.json",
                    identities_file="identities.json",
                )["name"],
                "peer-a",
            )
            self.assertEqual(
                service_facade_ops.delete_policy_service(
                    "policy-a",
                    policies_file="policies.json",
                )["name"],
                "policy-a",
            )
            self.assertEqual(
                service_facade_ops.delete_identity_service(
                    "peer-a",
                    identities_file="identities.json",
                )["peer"],
                "peer-a",
            )
            self.assertEqual(
                service_facade_ops.delete_phase1_profile_service(
                    "p1",
                    phase1_profiles_file="phase1.json",
                    peers_file="peers.json",
                )["name"],
                "p1",
            )
            self.assertEqual(
                service_facade_ops.delete_phase2_proposal_service(
                    "p2",
                    phase2_proposals_file="phase2.json",
                    policies_file="policies.json",
                )["name"],
                "p2",
            )
            self.assertEqual(calls[0][0], "peers")
            self.assertEqual(calls[-1][0], "del_p2")
        finally:
            (
                service_layer_ops.list_peers,
                service_layer_ops.list_identities,
                service_layer_ops.list_phase1_profiles,
                service_layer_ops.list_phase2_proposals,
                service_layer_ops.list_policies,
                service_layer_ops.delete_peer,
                service_layer_ops.delete_policy,
                service_layer_ops.delete_identity,
                service_layer_ops.delete_phase1_profile,
                service_layer_ops.delete_phase2_proposal,
            ) = originals

    def test_upsert_wiring_with_validation_and_crypto(self):
        calls = []
        originals = (
            service_layer_ops.upsert_peer,
            service_layer_ops.upsert_identity,
            service_layer_ops.upsert_phase1_profile,
            service_layer_ops.upsert_phase2_proposal,
            service_layer_ops.upsert_policy,
            service_facade_ops.crypto_keys.encrypt_with_key,
            service_facade_ops.validation_ops.valid_name,
            service_facade_ops.validation_ops.normalize_ip_list,
            service_facade_ops.validation_ops.normalize_ts_list,
            service_facade_ops.validation_ops.build_phase1_proposal_string,
            service_facade_ops.validation_ops.build_phase2_proposal_string,
        )
        try:
            service_layer_ops.upsert_peer = lambda payload, **kwargs: (
                calls.append(("peer", kwargs["valid_name_fn"](" n "), kwargs["normalize_ip_list_fn"](["1.1.1.1"], "f"))),
                {"name": payload["name"]},
            )[1]
            service_layer_ops.upsert_identity = lambda payload, **kwargs: (
                calls.append(("identity", kwargs["valid_name_fn"](" n "), kwargs["secret_encrypt_fn"]("secret"))),
                {"peer": payload["peer"]},
            )[1]
            service_layer_ops.upsert_phase1_profile = lambda payload, **kwargs: (
                calls.append(("p1", kwargs["build_phase1_proposal_string_fn"]("aes", "sha", "modp2048"))),
                {"name": payload["name"]},
            )[1]
            service_layer_ops.upsert_phase2_proposal = lambda payload, **kwargs: (
                calls.append(("p2", kwargs["build_phase2_proposal_string_fn"]("aes", "sha", None))),
                {"name": payload["name"]},
            )[1]
            service_layer_ops.upsert_policy = lambda payload, **kwargs: (
                calls.append(("policy", kwargs["normalize_ts_list_fn"](["10.0.0.0/24"], "field"))),
                {"name": payload["name"]},
            )[1]
            service_facade_ops.crypto_keys.encrypt_with_key = lambda value, _key, _encrypt_fn: f"enc:{value}".encode("utf-8")
            service_facade_ops.validation_ops.valid_name = lambda value, normalize_config_value_fn, field_name="name": f"{field_name}:{normalize_config_value_fn(value)}"
            service_facade_ops.validation_ops.normalize_ip_list = lambda value, normalize_config_value_fn, field_name: [normalize_config_value_fn(x) for x in value]
            service_facade_ops.validation_ops.normalize_ts_list = lambda value, normalize_ip_list_fn, field_name: normalize_ip_list_fn(value, field_name)
            service_facade_ops.validation_ops.build_phase1_proposal_string = lambda enc, hash_alg, dh_group, prf_alg=None, valid_name_fn=None: f"{enc}-{hash_alg}-{prf_alg}-{dh_group}-{valid_name_fn('x', 'f')}"
            service_facade_ops.validation_ops.build_phase2_proposal_string = lambda enc, auth_alg, pfs_group=None, esn=None, valid_name_fn=None, normalize_config_value_fn=None: f"{enc}-{auth_alg}-{pfs_group}-{esn}-{valid_name_fn('y', 'g')}-{normalize_config_value_fn('z')}"

            norm = lambda v: str(v).strip() if v is not None else None
            self.assertEqual(
                service_facade_ops.upsert_peer_service(
                    {"name": "peer-a"},
                    normalize_config_value_fn=norm,
                    peers_file="peers.json",
                    phase1_profiles_file="phase1.json",
                )["name"],
                "peer-a",
            )
            self.assertEqual(
                service_facade_ops.upsert_identity_service(
                    {"peer": "peer-a"},
                    normalize_config_value_fn=norm,
                    encryption_key=b"k",
                    peers_file="peers.json",
                    identities_file="identities.json",
                    fernet_encrypt_fn=lambda _key, blob: blob,
                )["peer"],
                "peer-a",
            )
            self.assertEqual(
                service_facade_ops.upsert_phase1_profile_service(
                    {"name": "p1"},
                    normalize_config_value_fn=norm,
                    phase1_profiles_file="phase1.json",
                )["name"],
                "p1",
            )
            self.assertEqual(
                service_facade_ops.upsert_phase2_proposal_service(
                    {"name": "p2"},
                    normalize_config_value_fn=norm,
                    phase2_proposals_file="phase2.json",
                )["name"],
                "p2",
            )
            self.assertEqual(
                service_facade_ops.upsert_policy_service(
                    {"name": "policy-a"},
                    normalize_config_value_fn=norm,
                    policies_file="policies.json",
                    peers_file="peers.json",
                    phase2_proposals_file="phase2.json",
                )["name"],
                "policy-a",
            )
            self.assertTrue(any(call[0] == "identity" and call[2] == "enc:secret" for call in calls))
        finally:
            (
                service_layer_ops.upsert_peer,
                service_layer_ops.upsert_identity,
                service_layer_ops.upsert_phase1_profile,
                service_layer_ops.upsert_phase2_proposal,
                service_layer_ops.upsert_policy,
                service_facade_ops.crypto_keys.encrypt_with_key,
                service_facade_ops.validation_ops.valid_name,
                service_facade_ops.validation_ops.normalize_ip_list,
                service_facade_ops.validation_ops.normalize_ts_list,
                service_facade_ops.validation_ops.build_phase1_proposal_string,
                service_facade_ops.validation_ops.build_phase2_proposal_string,
            ) = originals

    def test_runtime_wiring_and_event_logging(self):
        calls = []
        originals = (
            service_layer_ops.log_event,
            service_layer_ops.list_events,
            service_layer_ops.list_active_peers,
            service_layer_ops.list_installed_sas,
            service_layer_ops.load_peer,
            service_layer_ops.initiate_policy,
            service_layer_ops.terminate_peer,
            service_layer_ops.apply_config,
            service_facade_ops.crypto_keys.decrypt_with_key_fallback,
        )
        try:
            service_layer_ops.log_event = lambda event_type, payload, **kwargs: calls.append(("log", event_type, payload, kwargs["events_file"]))
            service_layer_ops.list_events = lambda **kwargs: (calls.append(("events", kwargs["events_file"])), ["e"])[1]
            service_layer_ops.list_active_peers = lambda: (calls.append(("active",)), ["a"])[1]
            service_layer_ops.list_installed_sas = lambda: (calls.append(("sas",)), ["s"])[1]
            service_layer_ops.load_peer = lambda peer_name, **kwargs: (
                calls.append(("load", kwargs["secret_decrypt_fn"]("enc"), peer_name)),
                kwargs["log_event_fn"]("load_peer", {"peer": peer_name}),
                {"loaded": peer_name},
            )[2]
            service_layer_ops.initiate_policy = lambda policy_name, **kwargs: (
                kwargs["log_event_fn"]("initiate_policy", {"policy": policy_name}),
                {"initiated": policy_name},
            )[1]
            service_layer_ops.terminate_peer = lambda peer_name, **kwargs: (
                kwargs["log_event_fn"]("terminate_peer", {"peer": peer_name}),
                {"terminated": peer_name},
            )[1]
            service_layer_ops.apply_config = lambda **kwargs: (
                calls.append(("apply", kwargs["secret_decrypt_fn"]("enc2"))),
                kwargs["log_event_fn"]("apply_config", {"ok": True}),
                {"applied": True},
            )[2]
            service_facade_ops.crypto_keys.decrypt_with_key_fallback = lambda token, keys, decrypt_fn, continue_exceptions: f"dec:{token}"

            self.assertEqual(service_facade_ops.list_events_service(events_file="events.json"), ["e"])
            self.assertEqual(service_facade_ops.list_active_peers_service(), ["a"])
            self.assertEqual(service_facade_ops.list_installed_sas_service(), ["s"])
            self.assertEqual(
                service_facade_ops.load_peer_service(
                    "peer-a",
                    encryption_key=b"k1",
                    encryption_key_legacy=b"k2",
                    peers_file="peers.json",
                    identities_file="identities.json",
                    phase1_profiles_file="phase1.json",
                    phase2_proposals_file="phase2.json",
                    policies_file="policies.json",
                    events_file="events.json",
                    fernet_decrypt_fn=lambda _key, token: token,
                )["loaded"],
                "peer-a",
            )
            self.assertEqual(
                service_facade_ops.initiate_policy_service(
                    "policy-a",
                    policies_file="policies.json",
                    events_file="events.json",
                )["initiated"],
                "policy-a",
            )
            self.assertEqual(
                service_facade_ops.terminate_peer_service(
                    "peer-a",
                    events_file="events.json",
                )["terminated"],
                "peer-a",
            )
            self.assertTrue(
                service_facade_ops.apply_config_service(
                    encryption_key=b"k1",
                    encryption_key_legacy=b"k2",
                    peers_file="peers.json",
                    identities_file="identities.json",
                    phase1_profiles_file="phase1.json",
                    phase2_proposals_file="phase2.json",
                    policies_file="policies.json",
                    events_file="events.json",
                    fernet_decrypt_fn=lambda _key, token: token,
                )["applied"]
            )
            self.assertIn(("load", "dec:enc", "peer-a"), calls)
            self.assertIn(("apply", "dec:enc2"), calls)
            self.assertTrue(any(call[0] == "log" and call[3] == "events.json" for call in calls))
        finally:
            (
                service_layer_ops.log_event,
                service_layer_ops.list_events,
                service_layer_ops.list_active_peers,
                service_layer_ops.list_installed_sas,
                service_layer_ops.load_peer,
                service_layer_ops.initiate_policy,
                service_layer_ops.terminate_peer,
                service_layer_ops.apply_config,
                service_facade_ops.crypto_keys.decrypt_with_key_fallback,
            ) = originals

    def test_runtime_callback_factories(self):
        calls = []
        originals = (
            service_facade_ops.crypto_keys.decrypt_with_key_fallback,
            service_facade_ops._log_ipsec_event,
        )
        try:
            service_facade_ops.crypto_keys.decrypt_with_key_fallback = (
                lambda token, keys, decrypt_fn, continue_exceptions: f"dec:{token}:{len(keys)}"
            )
            service_facade_ops._log_ipsec_event = (
                lambda event_type, payload, events_file: calls.append((event_type, payload, events_file))
            )

            decrypt_cb = service_facade_ops._build_secret_decrypt_fn(
                encryption_key=b"k1",
                encryption_key_legacy=b"k2",
                fernet_decrypt_fn=lambda _key, token: token,
            )
            self.assertEqual(decrypt_cb("enc-token"), "dec:enc-token:2")

            log_cb = service_facade_ops._build_log_event_fn(events_file="events.json")
            log_cb("test_event", {"ok": True})
            self.assertEqual(calls, [("test_event", {"ok": True}, "events.json")])
        finally:
            (
                service_facade_ops.crypto_keys.decrypt_with_key_fallback,
                service_facade_ops._log_ipsec_event,
            ) = originals


if __name__ == "__main__":
    unittest.main()
