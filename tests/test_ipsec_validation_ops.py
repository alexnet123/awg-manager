import unittest

from backend.domains.ipsec import validation_ops


class IpsecValidationOpsTest(unittest.TestCase):
    def test_valid_name_and_ip_lists(self):
        norm = lambda value: None if value is None else str(value).strip() or None
        self.assertEqual(
            validation_ops.valid_name("peer-1", normalize_config_value_fn=norm),
            "peer-1",
        )
        with self.assertRaisesRegex(ValueError, "name is invalid"):
            validation_ops.valid_name("bad name", normalize_config_value_fn=norm)

        out = validation_ops.normalize_ip_list(
            [" 10.0.0.1 ", "", None, "192.0.2.1"],
            normalize_config_value_fn=norm,
            field_name="remote_addrs",
        )
        self.assertEqual(out, ["10.0.0.1", "192.0.2.1"])
        with self.assertRaisesRegex(ValueError, "remote_addrs must be array"):
            validation_ops.normalize_ip_list(
                "10.0.0.1",
                normalize_config_value_fn=norm,
                field_name="remote_addrs",
            )

    def test_normalize_ts_list(self):
        norm = lambda value: None if value is None else str(value).strip() or None
        out = validation_ops.normalize_ts_list(
            ["10.0.0.0/24", "192.0.2.1/32", "10.0.0.10/32[tcp/443]", "dynamic[udp/500-4500]"],
            normalize_ip_list_fn=lambda value, field_name: validation_ops.normalize_ip_list(
                value,
                normalize_config_value_fn=norm,
                field_name=field_name,
            ),
            field_name="local_ts",
        )
        self.assertEqual(out, ["10.0.0.0/24", "192.0.2.1/32", "10.0.0.10/32[tcp/443]", "dynamic[udp/500-4500]"])
        with self.assertRaisesRegex(ValueError, "local_ts contains invalid traffic selector"):
            validation_ops.normalize_ts_list(
                ["bad-cidr"],
                normalize_ip_list_fn=lambda value, field_name: validation_ops.normalize_ip_list(
                    value,
                    normalize_config_value_fn=norm,
                    field_name=field_name,
                ),
                field_name="local_ts",
            )
        with self.assertRaisesRegex(ValueError, "local_ts contains invalid traffic selector"):
            validation_ops.normalize_ts_list(
                ["10.0.0.0/24[tcp/70000]"],
                normalize_ip_list_fn=lambda value, field_name: validation_ops.normalize_ip_list(
                    value,
                    normalize_config_value_fn=norm,
                    field_name=field_name,
                ),
                field_name="local_ts",
            )

    def test_build_proposals(self):
        norm = lambda value: None if value is None else str(value).strip() or None
        valid_name = lambda value, field_name="name": validation_ops.valid_name(
            value,
            normalize_config_value_fn=norm,
            field_name=field_name,
        )

        phase1 = validation_ops.build_phase1_proposal_string(
            "AES256",
            "SHA256",
            "MODP2048",
            valid_name_fn=valid_name,
        )
        self.assertEqual(phase1, "aes256-sha256-modp2048")

        phase1_with_prf = validation_ops.build_phase1_proposal_string(
            "AES256",
            "SHA256",
            "MODP2048",
            "PRFSHA256",
            valid_name_fn=valid_name,
        )
        self.assertEqual(phase1_with_prf, "aes256-sha256-prfsha256-modp2048")

        phase1_aead = validation_ops.build_phase1_proposal_string(
            "AES256GCM16",
            "SHA256",
            "MODP2048",
            "PRFSHA256",
            valid_name_fn=valid_name,
        )
        self.assertEqual(phase1_aead, "aes256gcm16-prfsha256-modp2048")

        phase2 = validation_ops.build_phase2_proposal_string(
            "AES128",
            "SHA1",
            "MODP1024",
            valid_name_fn=valid_name,
            normalize_config_value_fn=norm,
        )
        self.assertEqual(phase2, "aes128-sha1-modp1024")

        phase2_with_esn = validation_ops.build_phase2_proposal_string(
            "AES128",
            "SHA1",
            "MODP1024",
            "ESN",
            valid_name_fn=valid_name,
            normalize_config_value_fn=norm,
        )
        self.assertEqual(phase2_with_esn, "aes128-sha1-modp1024-esn")

        phase2_aead = validation_ops.build_phase2_proposal_string(
            "AES256GCM16",
            "SHA256",
            "MODP2048",
            "ESN",
            valid_name_fn=valid_name,
            normalize_config_value_fn=norm,
        )
        self.assertEqual(phase2_aead, "aes256gcm16-modp2048-esn")

        phase2_no_pfs = validation_ops.build_phase2_proposal_string(
            "AES128",
            "SHA1",
            None,
            valid_name_fn=valid_name,
            normalize_config_value_fn=norm,
        )
        self.assertEqual(phase2_no_pfs, "aes128-sha1")


if __name__ == "__main__":
    unittest.main()
