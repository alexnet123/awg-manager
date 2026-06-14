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
        self.assertEqual(item["rekey_time"], "1d")
        self.assertEqual(item["keyingtries"], "0")

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

    def test_upsert_peer_preserves_vici_connection_fields(self):
        peers = []

        item = crud_ops.upsert_peer(
            {
                "name": "peer-a",
                "remote_addrs": ["203.0.113.10"],
                "local_addrs": ["%any"],
                "ike_version": 1,
                "phase1_profile": "p1",
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
                "send_initial_contact": False,
            },
            valid_name_fn=lambda value, field_name="name": str(value),
            normalize_ip_list_fn=lambda value, _field: list(value or []),
            normalize_config_value_fn=lambda value: str(value).strip() if value is not None else None,
            ensure_phase1_exists_fn=lambda _profile: None,
            read_peers_fn=lambda: peers,
            write_peers_fn=lambda rows: peers.__setitem__(slice(None), rows),
        )

        self.assertEqual(item["ike_version"], 1)
        self.assertEqual(item["dpd_delay"], "45s")
        self.assertEqual(item["dpd_timeout"], "150s")
        self.assertEqual(item["mobike"], "no")
        self.assertEqual(item["fragmentation"], "yes")
        self.assertEqual(item["rekey_time"], "3h")
        self.assertEqual(item["reauth_time"], "0s")
        self.assertEqual(item["over_time"], "15m")
        self.assertEqual(item["rand_time"], "5m")
        self.assertEqual(item["keyingtries"], "3")
        self.assertFalse(item["send_initial_contact"])

    def test_upsert_peer_rejects_unknown_ike_version(self):
        with self.assertRaisesRegex(ValueError, "ike_version must be one of"):
            crud_ops.upsert_peer(
                {
                    "name": "peer-a",
                    "remote_addrs": ["203.0.113.10"],
                    "local_addrs": ["%any"],
                "ike_version": 0,
                    "phase1_profile": "p1",
                },
                valid_name_fn=lambda value, field_name="name": str(value),
                normalize_ip_list_fn=lambda value, _field: list(value or []),
                ensure_phase1_exists_fn=lambda _profile: None,
                read_peers_fn=lambda: [],
                write_peers_fn=lambda _rows: None,
            )

    def test_upsert_identity(self):
        identities = []
        item = crud_ops.upsert_identity(
            {"peer": "peer-a", "auth_method": "psk", "local_id": "l", "remote_id": "r", "psk": "secret", "enabled": False},
            valid_name_fn=lambda value, field_name="name": str(value),
            ensure_peer_exists_fn=lambda _peer: None,
            normalize_config_value_fn=lambda value: value,
            read_identities_fn=lambda: identities,
            secret_encrypt_fn=lambda value: f"enc:{value}",
            write_identities_fn=lambda rows: identities.__setitem__(slice(None), rows),
        )
        self.assertEqual(item["peer"], "peer-a")
        self.assertFalse(item["enabled"])
        self.assertTrue(item["has_psk"])
        self.assertNotIn("psk_encrypted", item)
        self.assertFalse(identities[0]["enabled"])

        deleted = crud_ops.delete_identity(
            "peer-a",
            read_identities_fn=lambda: identities,
            write_identities_fn=lambda rows: identities.__setitem__(slice(None), rows),
        )
        self.assertEqual(deleted["peer"], "peer-a")
        self.assertTrue(deleted["has_psk"])
        self.assertNotIn("psk_encrypted", deleted)
        self.assertEqual(identities, [])

    def test_upsert_identity_allows_empty_ids_for_auto_mode(self):
        identities = []
        item = crud_ops.upsert_identity(
            {"peer": "peer-a", "auth_method": "psk", "local_id": "", "remote_id": "   ", "psk": "secret"},
            valid_name_fn=lambda value, field_name="name": str(value),
            ensure_peer_exists_fn=lambda _peer: None,
            normalize_config_value_fn=lambda value: str(value).strip() if value is not None else None,
            read_identities_fn=lambda: identities,
            secret_encrypt_fn=lambda value: f"enc:{value}",
            write_identities_fn=lambda rows: identities.__setitem__(slice(None), rows),
        )
        self.assertEqual(item["local_id"], "")
        self.assertEqual(item["remote_id"], "")
        self.assertTrue(item["has_psk"])

    def test_upsert_identity_preserves_existing_psk_when_payload_psk_is_blank(self):
        identities = [{"peer": "peer-a", "psk_encrypted": "enc:existing"}]
        item = crud_ops.upsert_identity(
            {"peer": "peer-a", "auth_method": "psk", "local_id": "", "remote_id": "", "psk": "   "},
            valid_name_fn=lambda value, field_name="name": str(value),
            ensure_peer_exists_fn=lambda _peer: None,
            normalize_config_value_fn=lambda value: str(value).strip() if value is not None else None,
            read_identities_fn=lambda: identities,
            secret_encrypt_fn=lambda value: f"enc:{value}",
            write_identities_fn=lambda rows: identities.__setitem__(slice(None), rows),
        )
        self.assertTrue(item["has_psk"])
        self.assertEqual(identities[0]["psk_encrypted"], "enc:existing")

    def test_get_identity_psk_decrypts_only_requested_peer(self):
        identities = [
            {"peer": "peer-a", "psk_encrypted": "enc:a"},
            {"peer": "peer-b", "psk_encrypted": "enc:b"},
        ]
        item = crud_ops.get_identity_psk(
            "peer-b",
            valid_name_fn=lambda value, field_name="name": str(value),
            read_identities_fn=lambda: identities,
            secret_decrypt_fn=lambda value: value.removeprefix("enc:"),
        )
        self.assertEqual(item, {"peer": "peer-b", "psk": "b"})

        with self.assertRaisesRegex(LookupError, "identity not found"):
            crud_ops.get_identity_psk(
                "missing",
                valid_name_fn=lambda value, field_name="name": str(value),
                read_identities_fn=lambda: identities,
                secret_decrypt_fn=lambda value: value,
            )

    def test_upsert_peer_rename_updates_policy_and_identity_references(self):
        peers = [{"name": "old-peer", "remote_addrs": ["1.1.1.1"], "local_addrs": [], "phase1_profile": "p1"}]
        policies = [
            {"name": "policy-a", "peer": "old-peer"},
            {"name": "policy-b", "peer": "other-peer"},
        ]
        identities = [
            {"peer": "old-peer", "psk_encrypted": "enc"},
            {"peer": "other-peer", "psk_encrypted": "enc2"},
        ]

        renamed = crud_ops.upsert_peer(
            {
                "original_name": "old-peer",
                "name": "new-peer",
                "remote_addrs": ["2.2.2.2"],
                "local_addrs": [],
                "phase1_profile": "p1",
            },
            valid_name_fn=lambda value, field_name="name": str(value),
            normalize_ip_list_fn=lambda value, _field: list(value or []),
            normalize_config_value_fn=lambda value: value,
            ensure_phase1_exists_fn=lambda _profile: None,
            read_peers_fn=lambda: peers,
            write_peers_fn=lambda rows: peers.__setitem__(slice(None), rows),
            read_policies_fn=lambda: policies,
            write_policies_fn=lambda rows: policies.__setitem__(slice(None), rows),
            read_identities_fn=lambda: identities,
            write_identities_fn=lambda rows: identities.__setitem__(slice(None), rows),
        )

        self.assertEqual(renamed["name"], "new-peer")
        self.assertEqual([x["name"] for x in peers], ["new-peer"])
        self.assertEqual(policies[0]["peer"], "new-peer")
        self.assertEqual(policies[1]["peer"], "other-peer")
        self.assertEqual(identities[0]["peer"], "new-peer")
        self.assertEqual(identities[1]["peer"], "other-peer")

    def test_upsert_profiles_and_policy_and_delete_policy(self):
        p1 = []
        p2 = []
        policies = []

        phase1 = crud_ops.upsert_phase1_profile(
            {
                "name": "p1",
                "encryption": "AES",
                "hash": "SHA",
                "dh_group": "MODP",
                "prf": "PRFSHA256",
                "enabled": False,
                "extra_proposals": [" AES128-SHA1-PRFSHA1-MODP1024 ", "aes256gcm16-prfsha384-ecp384"],
            },
            valid_name_fn=lambda value, field_name="name": str(value),
            normalize_config_value_fn=lambda value: value,
            build_phase1_proposal_string_fn=lambda e, h, d, prf=None: f"{e}-{h}-{prf}-{d}" if prf else f"{e}-{h}-{d}",
            read_profiles_fn=lambda: p1,
            write_profiles_fn=lambda rows: p1.__setitem__(slice(None), rows),
        )
        self.assertEqual(phase1["prf"], "prfsha256")
        self.assertFalse(phase1["enabled"])
        self.assertEqual(phase1["proposal_string"], "aes-sha-prfsha256-modp")
        self.assertEqual(phase1["extra_proposals"], ["aes128-sha1-prfsha1-modp1024", "aes256gcm16-prfsha384-ecp384"])

        phase1_auto_prf = crud_ops.upsert_phase1_profile(
            {
                "name": "p1-auto",
                "encryption": "AES",
                "hash": "SHA",
                "dh_group": "MODP",
                "prf": "auto",
            },
            valid_name_fn=lambda value, field_name="name": str(value),
            normalize_config_value_fn=lambda value: value,
            build_phase1_proposal_string_fn=lambda e, h, d, prf=None: f"{e}-{h}-{prf}-{d}" if prf else f"{e}-{h}-{d}",
            read_profiles_fn=lambda: p1,
            write_profiles_fn=lambda rows: p1.__setitem__(slice(None), rows),
        )
        self.assertEqual(phase1_auto_prf["prf"], "auto")
        self.assertEqual(phase1_auto_prf["proposal_string"], "aes-sha-modp")

        phase2 = crud_ops.upsert_phase2_proposal(
            {
                "name": "child",
                "encryption": "AES",
                "auth": "SHA",
                "esn": "ESN",
                "enabled": False,
                "extra_proposals": "aes128-sha1, aes256gcm16-modp2048-esn",
            },
            valid_name_fn=lambda value, field_name="name": str(value),
            normalize_config_value_fn=lambda value: value,
            build_phase2_proposal_string_fn=lambda e, a, p, esn=None: "-".join(
                part for part in (e, a, p, esn) if part
            ),
            read_proposals_fn=lambda: p2,
            write_proposals_fn=lambda rows: p2.__setitem__(slice(None), rows),
        )
        self.assertFalse(phase2["enabled"])
        self.assertEqual(phase2["esn"], "esn")
        self.assertEqual(phase2["proposal_string"], "aes-sha-esn")
        self.assertEqual(phase2["extra_proposals"], ["aes128-sha1", "aes256gcm16-modp2048-esn"])

        policy = crud_ops.upsert_policy(
            {
                "name": "pol1",
                "peer": "peer-a",
                "local_ts": ["10.0.0.0/24"],
                "remote_ts": ["192.0.2.0/24"],
                "proposal": "child",
                "mode": "transport",
                "start_action": "trap",
                "close_action": "start",
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
            valid_name_fn=lambda value, field_name="name": str(value),
            normalize_ts_list_fn=lambda value, _field: list(value or []),
            normalize_config_value_fn=lambda value: value,
            ensure_peer_exists_fn=lambda _peer: None,
            ensure_phase2_exists_fn=lambda _proposal: None,
            read_policies_fn=lambda: policies,
            write_policies_fn=lambda rows: policies.__setitem__(slice(None), rows),
        )
        self.assertEqual(policy["name"], "pol1")
        self.assertEqual(policy["mode"], "transport")
        self.assertEqual(policy["start_action"], "trap")
        self.assertEqual(policy["close_action"], "start")
        self.assertEqual(policy["dpd_action"], "restart")
        self.assertEqual(policy["rekey_time"], "45m")
        self.assertEqual(policy["life_time"], "1h")
        self.assertEqual(policy["rand_time"], "5m")
        self.assertEqual(policy["policies"], "no")
        self.assertEqual(policy["policies_fwd_out"], "yes")
        self.assertEqual(policy["reqid"], "42")
        self.assertEqual(policy["priority"], "1000")
        self.assertEqual(policy["interface"], "eth0")
        self.assertEqual(policy["mark_in"], "0x1/0xffffffff")
        self.assertEqual(policy["mark_in_sa"], "yes")
        self.assertEqual(policy["mark_out"], "%unique")
        self.assertEqual(policy["set_mark_in"], "%same")
        self.assertEqual(policy["set_mark_out"], "0x2/0xffffffff")
        self.assertEqual(policy["if_id_in"], "%unique")
        self.assertEqual(policy["if_id_out"], "7")

        default_policy = crud_ops.upsert_policy(
            {
                "name": "pol-default",
                "peer": "peer-a",
                "local_ts": ["10.2.0.0/24"],
                "remote_ts": ["192.0.2.0/24"],
                "proposal": "child",
            },
            valid_name_fn=lambda value, field_name="name": str(value),
            normalize_ts_list_fn=lambda value, _field: list(value or []),
            normalize_config_value_fn=lambda value: value,
            ensure_peer_exists_fn=lambda _peer: None,
            ensure_phase2_exists_fn=lambda _proposal: None,
            read_policies_fn=lambda: policies,
            write_policies_fn=lambda rows: policies.__setitem__(slice(None), rows),
        )
        self.assertEqual(default_policy["dpd_action"], "restart")

        with self.assertRaisesRegex(ValueError, "start_action must be one of"):
            crud_ops.upsert_policy(
                {
                    "name": "pol-invalid-start-action",
                    "peer": "peer-a",
                    "local_ts": ["10.3.0.0/24"],
                    "remote_ts": ["192.0.2.0/24"],
                    "proposal": "child",
                    "start_action": "trap|start",
                },
                valid_name_fn=lambda value, field_name="name": str(value),
                normalize_ts_list_fn=lambda value, _field: list(value or []),
                normalize_config_value_fn=lambda value: value,
                ensure_peer_exists_fn=lambda _peer: None,
                ensure_phase2_exists_fn=lambda _proposal: None,
                read_policies_fn=lambda: policies,
                write_policies_fn=lambda rows: policies.__setitem__(slice(None), rows),
            )

        with self.assertRaisesRegex(ValueError, "mode must be one of"):
            crud_ops.upsert_policy(
                {
                    "name": "pol-invalid-mode",
                    "peer": "peer-a",
                    "local_ts": ["10.4.0.0/24"],
                    "remote_ts": ["192.0.2.0/24"],
                    "proposal": "child",
                    "mode": "fake",
                },
                valid_name_fn=lambda value, field_name="name": str(value),
                normalize_ts_list_fn=lambda value, _field: list(value or []),
                normalize_config_value_fn=lambda value: value,
                ensure_peer_exists_fn=lambda _peer: None,
                ensure_phase2_exists_fn=lambda _proposal: None,
                read_policies_fn=lambda: policies,
                write_policies_fn=lambda rows: policies.__setitem__(slice(None), rows),
            )

        deleted = crud_ops.delete_policy(
            "pol1",
            read_policies_fn=lambda: policies,
            write_policies_fn=lambda rows: policies.__setitem__(slice(None), rows),
        )
        self.assertEqual(deleted["name"], "pol1")
        deleted_default = crud_ops.delete_policy(
            "pol-default",
            read_policies_fn=lambda: policies,
            write_policies_fn=lambda rows: policies.__setitem__(slice(None), rows),
        )
        self.assertEqual(deleted_default["name"], "pol-default")

        deleted_phase2 = crud_ops.delete_phase2_proposal(
            "child",
            read_proposals_fn=lambda: p2,
            write_proposals_fn=lambda rows: p2.__setitem__(slice(None), rows),
            read_policies_fn=lambda: policies,
        )
        self.assertEqual(deleted_phase2["name"], "child")
        self.assertEqual(p2, [])

        deleted_phase1 = crud_ops.delete_phase1_profile(
            "p1",
            read_profiles_fn=lambda: p1,
            write_profiles_fn=lambda rows: p1.__setitem__(slice(None), rows),
            read_peers_fn=lambda: [],
        )
        self.assertEqual(deleted_phase1["name"], "p1")

        deleted_phase1_auto = crud_ops.delete_phase1_profile(
            "p1-auto",
            read_profiles_fn=lambda: p1,
            write_profiles_fn=lambda rows: p1.__setitem__(slice(None), rows),
            read_peers_fn=lambda: [],
        )
        self.assertEqual(deleted_phase1_auto["name"], "p1-auto")
        self.assertEqual(p1, [])

    def test_rename_phase1_profile_updates_referencing_peers(self):
        profiles = [{"name": "old-p1", "encryption": "aes", "hash": "sha", "dh_group": "modp"}]
        peers = [
            {"name": "peer-a", "phase1_profile": "old-p1"},
            {"name": "peer-b", "phase1_profile": "other-p1"},
        ]

        renamed = crud_ops.upsert_phase1_profile(
            {
                "original_name": "old-p1",
                "name": "new-p1",
                "encryption": "AES",
                "hash": "SHA",
                "dh_group": "MODP",
                "prf": "auto",
            },
            valid_name_fn=lambda value, field_name="name": str(value),
            normalize_config_value_fn=lambda value: value,
            build_phase1_proposal_string_fn=lambda e, h, d, prf=None: f"{e}-{h}-{prf}-{d}" if prf else f"{e}-{h}-{d}",
            read_profiles_fn=lambda: profiles,
            write_profiles_fn=lambda rows: profiles.__setitem__(slice(None), rows),
            read_peers_fn=lambda: peers,
            write_peers_fn=lambda rows: peers.__setitem__(slice(None), rows),
        )

        self.assertEqual(renamed["name"], "new-p1")
        self.assertEqual([x["name"] for x in profiles], ["new-p1"])
        self.assertEqual(peers[0]["phase1_profile"], "new-p1")
        self.assertEqual(peers[1]["phase1_profile"], "other-p1")

    def test_upsert_phase2_rename_updates_policy_references(self):
        proposals = [{"name": "old-p2", "encryption": "aes", "auth": "sha", "pfs_group": "modp"}]
        policies = [
            {"name": "policy-a", "proposal": "old-p2"},
            {"name": "policy-b", "proposal": "other-p2"},
        ]

        renamed = crud_ops.upsert_phase2_proposal(
            {
                "original_name": "old-p2",
                "name": "new-p2",
                "encryption": "AES",
                "auth": "SHA",
                "pfs_group": "MODP",
            },
            valid_name_fn=lambda value, field_name="name": str(value),
            normalize_config_value_fn=lambda value: value,
            build_phase2_proposal_string_fn=lambda e, a, p, esn=None: "-".join(
                x for x in (e, a, p, esn) if x
            ),
            read_proposals_fn=lambda: proposals,
            write_proposals_fn=lambda rows: proposals.__setitem__(slice(None), rows),
            read_policies_fn=lambda: policies,
            write_policies_fn=lambda rows: policies.__setitem__(slice(None), rows),
        )

        self.assertEqual(renamed["name"], "new-p2")
        self.assertEqual([x["name"] for x in proposals], ["new-p2"])
        self.assertEqual(policies[0]["proposal"], "new-p2")
        self.assertEqual(policies[1]["proposal"], "other-p2")

    def test_upsert_policy_rename_replaces_existing_item(self):
        policies = [
            {"name": "old-policy", "peer": "peer-a", "proposal": "p2"},
            {"name": "other-policy", "peer": "peer-a", "proposal": "p2"},
        ]

        renamed = crud_ops.upsert_policy(
            {
                "original_name": "old-policy",
                "name": "new-policy",
                "peer": "peer-a",
                "local_ts": ["10.0.0.0/24"],
                "remote_ts": ["10.1.0.0/24"],
                "proposal": "p2",
            },
            valid_name_fn=lambda value, field_name="name": str(value),
            normalize_ts_list_fn=lambda value, _field: list(value or []),
            normalize_config_value_fn=lambda value: value,
            ensure_peer_exists_fn=lambda _peer: None,
            ensure_phase2_exists_fn=lambda _proposal: None,
            read_policies_fn=lambda: policies,
            write_policies_fn=lambda rows: policies.__setitem__(slice(None), rows),
        )

        self.assertEqual(renamed["name"], "new-policy")
        self.assertEqual([x["name"] for x in policies], ["new-policy", "other-policy"])

    def test_upsert_policy_keeps_single_traffic_selector_per_side(self):
        policies = []

        policy = crud_ops.upsert_policy(
            {
                "name": "policy-a",
                "peer": "peer-a",
                "local_ts": ["10.11.12.0/24", "10.1.0.0/24", "10.2.0.0/24"],
                "remote_ts": ["10.11.11.0/24", "10.3.0.0/24"],
                "proposal": "p2",
            },
            valid_name_fn=lambda value, field_name="name": str(value),
            normalize_ts_list_fn=lambda value, _field: list(value or []),
            normalize_config_value_fn=lambda value: value,
            ensure_peer_exists_fn=lambda _peer: None,
            ensure_phase2_exists_fn=lambda _proposal: None,
            read_policies_fn=lambda: policies,
            write_policies_fn=lambda rows: policies.__setitem__(slice(None), rows),
        )

        self.assertEqual(policy["local_ts"], ["10.11.12.0/24"])
        self.assertEqual(policy["remote_ts"], ["10.11.11.0/24"])
        self.assertEqual(policies[0]["local_ts"], ["10.11.12.0/24"])
        self.assertEqual(policies[0]["remote_ts"], ["10.11.11.0/24"])

    def test_delete_profiles_rejects_items_in_use(self):
        with self.assertRaisesRegex(ValueError, "phase1 profile is referenced by peer\\(s\\): peer-a"):
            crud_ops.delete_phase1_profile(
                "p1",
                read_profiles_fn=lambda: [{"name": "p1"}],
                write_profiles_fn=lambda _rows: None,
                read_peers_fn=lambda: [{"name": "peer-a", "phase1_profile": "p1"}],
            )

        with self.assertRaisesRegex(ValueError, "phase2 proposal is referenced by policy\\(s\\): policy-a"):
            crud_ops.delete_phase2_proposal(
                "p2",
                read_proposals_fn=lambda: [{"name": "p2"}],
                write_proposals_fn=lambda _rows: None,
                read_policies_fn=lambda: [{"name": "policy-a", "proposal": "p2"}],
            )

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
        with self.assertRaisesRegex(LookupError, "identity not found"):
            crud_ops.delete_identity(
                "missing",
                read_identities_fn=lambda: [],
                write_identities_fn=lambda _rows: None,
            )


if __name__ == "__main__":
    unittest.main()
