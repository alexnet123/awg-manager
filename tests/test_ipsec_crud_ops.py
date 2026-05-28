import unittest

from backend.domains.ipsec import crud_ops


class IpsecCrudOpsTest(unittest.TestCase):
    def test_upsert_peer_and_delete_peer(self):
        peers = [{"name": "peer-a", "remote_addrs": ["1.1.1.1"], "phase1_profile": "p1"}]
        policies = []
        identities = [{"peer": "peer-a", "psk_encrypted": "enc"}]

        item = crud_ops.upsert_peer(
            {"name": "peer-a", "remote_addrs": ["2.2.2.2"], "local_addrs": [], "phase1_profile": "p1"},
            valid_name_fn=lambda value, field_name="name": str(value),
            normalize_ip_list_fn=lambda value, _field: list(value or []),
            ensure_phase1_exists_fn=lambda _profile: None,
            read_peers_fn=lambda: peers,
            write_peers_fn=lambda rows: peers.__setitem__(slice(None), rows),
        )
        self.assertEqual(item["remote_addrs"], ["2.2.2.2"])

        deleted = crud_ops.delete_peer(
            "peer-a",
            read_policies_fn=lambda: policies,
            read_peers_fn=lambda: peers,
            write_peers_fn=lambda rows: peers.__setitem__(slice(None), rows),
            read_identities_fn=lambda: identities,
            write_identities_fn=lambda rows: identities.__setitem__(slice(None), rows),
        )
        self.assertEqual(deleted["name"], "peer-a")
        self.assertEqual(peers, [])
        self.assertEqual(identities, [])

    def test_upsert_identity(self):
        identities = []
        item = crud_ops.upsert_identity(
            {"peer": "peer-a", "auth_method": "psk", "local_id": "l", "remote_id": "r", "psk": "secret"},
            valid_name_fn=lambda value, field_name="name": str(value),
            ensure_peer_exists_fn=lambda _peer: None,
            normalize_config_value_fn=lambda value: value,
            read_identities_fn=lambda: identities,
            secret_encrypt_fn=lambda value: f"enc:{value}",
            write_identities_fn=lambda rows: identities.__setitem__(slice(None), rows),
        )
        self.assertEqual(item["peer"], "peer-a")
        self.assertTrue(item["has_psk"])
        self.assertNotIn("psk_encrypted", item)

    def test_upsert_profiles_and_policy_and_delete_policy(self):
        p1 = []
        p2 = []
        policies = []

        phase1 = crud_ops.upsert_phase1_profile(
            {"name": "p1", "encryption": "AES", "hash": "SHA", "dh_group": "MODP"},
            valid_name_fn=lambda value, field_name="name": str(value),
            normalize_config_value_fn=lambda value: value,
            build_phase1_proposal_string_fn=lambda e, h, d: f"{e}-{h}-{d}",
            read_profiles_fn=lambda: p1,
            write_profiles_fn=lambda rows: p1.__setitem__(slice(None), rows),
        )
        self.assertEqual(phase1["proposal_string"], "aes-sha-modp")

        phase2 = crud_ops.upsert_phase2_proposal(
            {"name": "child", "encryption": "AES", "auth": "SHA"},
            valid_name_fn=lambda value, field_name="name": str(value),
            normalize_config_value_fn=lambda value: value,
            build_phase2_proposal_string_fn=lambda e, a, p: f"{e}-{a}" if p is None else f"{e}-{a}-{p}",
            read_proposals_fn=lambda: p2,
            write_proposals_fn=lambda rows: p2.__setitem__(slice(None), rows),
        )
        self.assertEqual(phase2["proposal_string"], "aes-sha")

        policy = crud_ops.upsert_policy(
            {"name": "pol1", "peer": "peer-a", "local_ts": ["10.0.0.0/24"], "remote_ts": ["192.0.2.0/24"], "proposal": "child"},
            valid_name_fn=lambda value, field_name="name": str(value),
            normalize_ts_list_fn=lambda value, _field: list(value or []),
            normalize_config_value_fn=lambda value: value,
            ensure_peer_exists_fn=lambda _peer: None,
            ensure_phase2_exists_fn=lambda _proposal: None,
            read_policies_fn=lambda: policies,
            write_policies_fn=lambda rows: policies.__setitem__(slice(None), rows),
        )
        self.assertEqual(policy["name"], "pol1")
        deleted = crud_ops.delete_policy(
            "pol1",
            read_policies_fn=lambda: policies,
            write_policies_fn=lambda rows: policies.__setitem__(slice(None), rows),
        )
        self.assertEqual(deleted["name"], "pol1")

    def test_error_paths(self):
        with self.assertRaisesRegex(ValueError, "peer payload must be object"):
            crud_ops.upsert_peer(
                [],
                valid_name_fn=lambda value, field_name="name": str(value),
                normalize_ip_list_fn=lambda value, _field: list(value or []),
                ensure_phase1_exists_fn=lambda _profile: None,
                read_peers_fn=lambda: [],
                write_peers_fn=lambda _rows: None,
            )
        with self.assertRaisesRegex(ValueError, "local_ts and remote_ts are required"):
            crud_ops.upsert_policy(
                {"name": "p", "peer": "peer-a", "local_ts": [], "remote_ts": [], "proposal": "x"},
                valid_name_fn=lambda value, field_name="name": str(value),
                normalize_ts_list_fn=lambda value, _field: list(value or []),
                normalize_config_value_fn=lambda value: value,
                ensure_peer_exists_fn=lambda _peer: None,
                ensure_phase2_exists_fn=lambda _proposal: None,
                read_policies_fn=lambda: [],
                write_policies_fn=lambda _rows: None,
            )
        with self.assertRaisesRegex(LookupError, "policy not found"):
            crud_ops.delete_policy(
                "missing",
                read_policies_fn=lambda: [],
                write_policies_fn=lambda _rows: None,
            )


if __name__ == "__main__":
    unittest.main()
