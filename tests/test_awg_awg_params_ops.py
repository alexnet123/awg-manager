import unittest

from backend.domains.awg import awg_params_ops


class InterfacesClientsAwgParamsOpsTest(unittest.TestCase):
    def test_detect_version_and_keys(self):
        norm = lambda value: None if value is None else str(value).strip() or None

        self.assertEqual(
            awg_params_ops.detect_awg_version("2", {}, normalize_config_value_fn=norm),
            "2",
        )
        self.assertEqual(
            awg_params_ops.detect_awg_version(None, {"I1": "1"}, normalize_config_value_fn=norm),
            "2",
        )
        self.assertEqual(
            awg_params_ops.detect_awg_version(None, {"Jc": "5"}, normalize_config_value_fn=norm),
            "1",
        )

        keys_v1 = awg_params_ops.get_awg_param_keys_for_version(
            "1",
            detect_awg_version_fn=lambda version, params: awg_params_ops.detect_awg_version(
                version, params, normalize_config_value_fn=norm
            ),
        )
        keys_v2 = awg_params_ops.get_awg_param_keys_for_version(
            "2",
            detect_awg_version_fn=lambda version, params: awg_params_ops.detect_awg_version(
                version, params, normalize_config_value_fn=norm
            ),
        )
        self.assertNotIn("S3", keys_v1)
        self.assertIn("S3", keys_v2)
        self.assertIn("I5", keys_v2)

    def test_build_prepare_and_generate(self):
        row = tuple(range(26))
        mapped = awg_params_ops.build_awg_params_from_row(row)
        self.assertEqual(mapped["Jc"], 10)
        self.assertEqual(mapped["I5"], 25)

        generated_v1 = awg_params_ops.generate_awg_obfuscation_params(
            "1",
            detect_awg_version_fn=lambda version, params: version,
            random_randint_fn=lambda a, b: a,
            random_sample_fn=lambda seq, n: [10, 20, 30, 40],
        )
        self.assertEqual(generated_v1["H1"], "10")
        self.assertEqual(generated_v1["H4"], "40")

        prepared_v1 = awg_params_ops.prepare_awg_params_for_version(
            "1",
            generate_awg_obfuscation_params_fn=lambda _version: {
                "S3": 1,
                "S4": 2,
                "I1": "x",
                "I2": "x",
                "I3": "x",
                "I4": "x",
                "I5": "x",
            },
            detect_awg_version_fn=lambda _version, _params: "1",
        )
        self.assertIsNone(prepared_v1["S3"])
        self.assertIsNone(prepared_v1["I5"])

    def test_parse_validate_format_filter(self):
        norm = lambda value: None if value is None else str(value).strip() or None

        self.assertEqual(
            awg_params_ops.parse_h_value_or_range("12-20", normalize_config_value_fn=norm),
            (12, 20),
        )
        with self.assertRaisesRegex(ValueError, "H1-H4 must be single number"):
            awg_params_ops.parse_h_value_or_range("bad", normalize_config_value_fn=norm)

        good = {
            "Jc": "5",
            "Jmin": "8",
            "Jmax": "80",
            "S1": "10",
            "S2": "20",
            "S3": "5",
            "S4": "7",
            "H1": "10-20",
            "H2": "30-40",
        }
        awg_params_ops.validate_awg_params(
            "2",
            good,
            detect_awg_version_fn=lambda version, params: awg_params_ops.detect_awg_version(
                version, params, normalize_config_value_fn=norm
            ),
            normalize_config_value_fn=norm,
            parse_h_value_or_range_fn=lambda value: awg_params_ops.parse_h_value_or_range(
                value, normalize_config_value_fn=norm
            ),
        )

        bad_overlap = dict(good)
        bad_overlap["H2"] = "15-25"
        with self.assertRaisesRegex(ValueError, "ranges must not overlap"):
            awg_params_ops.validate_awg_params(
                "2",
                bad_overlap,
                detect_awg_version_fn=lambda version, params: awg_params_ops.detect_awg_version(
                    version, params, normalize_config_value_fn=norm
                ),
                normalize_config_value_fn=norm,
                parse_h_value_or_range_fn=lambda value: awg_params_ops.parse_h_value_or_range(
                    value, normalize_config_value_fn=norm
                ),
            )

        lines = awg_params_ops.format_awg_params_for_display(
            "1",
            {"Jc": "5", "S3": "9"},
            get_awg_param_keys_for_version_fn=lambda version: ["Jc", "S3"],
            normalize_config_value_fn=norm,
        )
        filtered = awg_params_ops.get_filtered_awg_params(
            "1",
            {"Jc": "5", "S3": "9"},
            get_awg_param_keys_for_version_fn=lambda version: ["Jc", "S3"],
            normalize_config_value_fn=norm,
        )
        self.assertIn("Jc: 5", lines)
        self.assertEqual(filtered["S3"], "9")

    def test_prompt_awg_version(self):
        printed = []

        selected = awg_params_ops.prompt_awg_version(
            "2",
            detect_awg_version_fn=lambda version, _params: version,
            input_fn=lambda _prompt: "",
            print_fn=lambda line: printed.append(line),
        )
        self.assertEqual(selected, "2")
        self.assertTrue(any("Выберите версию AWG" in line for line in printed))

        printed = []
        selected_invalid = awg_params_ops.prompt_awg_version(
            "1",
            detect_awg_version_fn=lambda version, _params: version,
            input_fn=lambda _prompt: "3",
            print_fn=lambda line: printed.append(line),
        )
        self.assertIsNone(selected_invalid)
        self.assertTrue(any("поддерживаются только версии 1 и 2" in line for line in printed))

    def test_prompt_version_2_signature_params(self):
        answers = iter(["cps-value", "v2", "", "v4", ""])
        awg_params = {"I1": None, "I2": None, "I3": None, "I4": None, "I5": None}
        result = awg_params_ops.prompt_version_2_signature_params(
            awg_params,
            input_fn=lambda _prompt: next(answers),
        )
        self.assertEqual(result["I1"], "cps-value")
        self.assertEqual(result["I2"], "v2")
        self.assertIsNone(result["I3"])
        self.assertEqual(result["I4"], "v4")
        self.assertIsNone(result["I5"])


if __name__ == "__main__":
    unittest.main()
