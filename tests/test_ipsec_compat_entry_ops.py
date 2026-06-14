import unittest

from backend.domains.ipsec import compat_entry_ops
from backend.domains.ipsec import service_layer_ops


class IpsecCompatEntryOpsTest(unittest.TestCase):
    def test_list_and_delete_wiring(self):
        calls = []
        originals = (
            service_layer_ops.list_peers,
            service_layer_ops.delete_policy,
            service_layer_ops.delete_identity,
            service_layer_ops.delete_phase1_profile,
            service_layer_ops.delete_phase2_proposal,
        )
        try:
            service_layer_ops.list_peers = lambda **kwargs: (calls.append(("list", kwargs)), ["peer-a"])[1]
            service_layer_ops.delete_policy = lambda name, **kwargs: (
                calls.append(("delete_policy", name, kwargs)),
                {"name": name},
            )[1]
            service_layer_ops.delete_identity = lambda name, **kwargs: (
                calls.append(("delete_identity", name, kwargs)),
                {"peer": name},
            )[1]
            service_layer_ops.delete_phase1_profile = lambda name, **kwargs: (
                calls.append(("delete_p1", name, kwargs)),
                {"name": name},
            )[1]
            service_layer_ops.delete_phase2_proposal = lambda name, **kwargs: (
                calls.append(("delete_p2", name, kwargs)),
                {"name": name},
            )[1]

            self.assertEqual(
                compat_entry_ops.list_peers_service(peers_file="peers.json"),
                ["peer-a"],
            )
            self.assertEqual(
                compat_entry_ops.delete_policy_service("policy-a", policies_file="policies.json"),
                {"name": "policy-a"},
            )
            self.assertEqual(
                compat_entry_ops.delete_identity_service("peer-a", identities_file="identities.json"),
                {"peer": "peer-a"},
            )
            self.assertEqual(
                compat_entry_ops.delete_phase1_profile_service(
                    "p1",
                    phase1_profiles_file="phase1.json",
                    peers_file="peers.json",
                ),
                {"name": "p1"},
            )
            self.assertEqual(
                compat_entry_ops.delete_phase2_proposal_service(
                    "p2",
                    phase2_proposals_file="phase2.json",
                    policies_file="policies.json",
                ),
                {"name": "p2"},
            )

            self.assertIs(calls[0][1]["read_collection_fn"], compat_entry_ops._read_collection)
            self.assertEqual(calls[0][1]["peers_file"], "peers.json")
            self.assertIs(calls[1][2]["read_collection_fn"], compat_entry_ops._read_collection)
            self.assertIs(calls[1][2]["write_collection_fn"], compat_entry_ops._write_collection)
            self.assertEqual(calls[1][2]["policies_file"], "policies.json")
            self.assertEqual(calls[-1][2]["phase2_proposals_file"], "phase2.json")
        finally:
            (
                service_layer_ops.list_peers,
                service_layer_ops.delete_policy,
                service_layer_ops.delete_identity,
                service_layer_ops.delete_phase1_profile,
                service_layer_ops.delete_phase2_proposal,
            ) = originals

    def test_upsert_identity_wiring_uses_validation_and_crypto(self):
        calls = []
        originals = (
            service_layer_ops.upsert_identity,
            compat_entry_ops.validation_ops.valid_name,
            compat_entry_ops.crypto_keys.encrypt_with_key,
        )
        try:
            service_layer_ops.upsert_identity = lambda payload, **kwargs: (
                calls.append(
                    (
                        "upsert_identity",
                        kwargs["valid_name_fn"]("  user-a  ", "name"),
                        kwargs["secret_encrypt_fn"]("secret"),
                        kwargs["normalize_config_value_fn"]("  psk  "),
                    )
                ),
                payload,
            )[1]
            compat_entry_ops.validation_ops.valid_name = (
                lambda value, normalize_config_value_fn, field_name="name": f"{field_name}:{normalize_config_value_fn(value)}"
            )
            compat_entry_ops.crypto_keys.encrypt_with_key = (
                lambda value, _key, _encrypt_fn: f"enc:{value}".encode("utf-8")
            )

            out = compat_entry_ops.upsert_identity_service(
                {"peer": "peer-a"},
                normalize_config_value_fn=lambda value: str(value).strip(),
                encryption_key=b"k",
                peers_file="peers.json",
                identities_file="identities.json",
                fernet_encrypt_fn=lambda _key, payload: payload,
            )
            self.assertEqual(out["peer"], "peer-a")
            self.assertEqual(calls[0][1], "name:user-a")
            self.assertEqual(calls[0][2], "enc:secret")
            self.assertEqual(calls[0][3], "psk")
        finally:
            (
                service_layer_ops.upsert_identity,
                compat_entry_ops.validation_ops.valid_name,
                compat_entry_ops.crypto_keys.encrypt_with_key,
            ) = originals

    def test_runtime_wiring_uses_decrypt_and_events(self):
        calls = []
        originals = (
            service_layer_ops.load_peer,
            service_layer_ops.initiate_policy,
            service_layer_ops.terminate_peer,
            service_layer_ops.apply_config,
            service_layer_ops.log_event,
            compat_entry_ops.crypto_keys.decrypt_with_key_fallback,
        )
        try:
            service_layer_ops.log_event = lambda event_type, payload, **kwargs: calls.append(
                ("log", event_type, payload, kwargs["events_file"])
            )
            service_layer_ops.load_peer = lambda peer_name, **kwargs: (
                calls.append(("load", peer_name, kwargs["secret_decrypt_fn"]("token-1"))),
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
                calls.append(("apply", kwargs["secret_decrypt_fn"]("token-2"))),
                kwargs["log_event_fn"]("apply_config", {"ok": True}),
                {"applied": True},
            )[2]
            compat_entry_ops.crypto_keys.decrypt_with_key_fallback = (
                lambda token, keys, decrypt_fn, continue_exceptions: f"dec:{token}"
            )

            self.assertEqual(
                compat_entry_ops.load_peer_service(
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
                compat_entry_ops.initiate_policy_service(
                    "policy-a",
                    policies_file="policies.json",
                    events_file="events.json",
                )["initiated"],
                "policy-a",
            )
            self.assertEqual(
                compat_entry_ops.terminate_peer_service(
                    "peer-a",
                    events_file="events.json",
                )["terminated"],
                "peer-a",
            )
            self.assertTrue(
                compat_entry_ops.apply_config_service(
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

            self.assertIn(("load", "peer-a", "dec:token-1"), calls)
            self.assertIn(("apply", "dec:token-2"), calls)
            self.assertTrue(any(call[0] == "log" and call[3] == "events.json" for call in calls))
        finally:
            (
                service_layer_ops.load_peer,
                service_layer_ops.initiate_policy,
                service_layer_ops.terminate_peer,
                service_layer_ops.apply_config,
                service_layer_ops.log_event,
                compat_entry_ops.crypto_keys.decrypt_with_key_fallback,
            ) = originals

    def test_runtime_callback_factories(self):
        calls = []
        originals = (
            compat_entry_ops.crypto_keys.decrypt_with_key_fallback,
            compat_entry_ops.log_event,
        )
        try:
            compat_entry_ops.crypto_keys.decrypt_with_key_fallback = (
                lambda token, keys, decrypt_fn, continue_exceptions: f"dec:{token}:{len(keys)}"
            )
            compat_entry_ops.log_event = (
                lambda event_type, payload, events_file: calls.append((event_type, payload, events_file))
            )

            decrypt_cb = compat_entry_ops._build_secret_decrypt_fn(
                encryption_key=b"k1",
                encryption_key_legacy=b"k2",
                fernet_decrypt_fn=lambda _key, token: token,
            )
            self.assertEqual(decrypt_cb("enc-token"), "dec:enc-token:2")

            log_cb = compat_entry_ops._build_log_event_fn(events_file="events.json")
            log_cb("test_event", {"ok": True})
            self.assertEqual(calls, [("test_event", {"ok": True}, "events.json")])
        finally:
            (
                compat_entry_ops.crypto_keys.decrypt_with_key_fallback,
                compat_entry_ops.log_event,
            ) = originals
