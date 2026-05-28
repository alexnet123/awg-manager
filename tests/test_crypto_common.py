import unittest

from backend.common import crypto_keys


class CryptoCommonTest(unittest.TestCase):
    def test_kdf_v2_is_stable_and_fernet_sized(self):
        key = crypto_keys.derive_encryption_key_v2("secret-value")
        self.assertIsInstance(key, bytes)
        self.assertEqual(len(key), 44)
        self.assertEqual(key, crypto_keys.derive_encryption_key_v2("secret-value"))

    def test_kdf_v1_legacy_is_stable_and_fernet_sized(self):
        key = crypto_keys.derive_encryption_key_v1_legacy("secret-value")
        self.assertIsInstance(key, bytes)
        self.assertEqual(len(key), 44)
        self.assertEqual(key, crypto_keys.derive_encryption_key_v1_legacy("secret-value"))

    def test_decrypt_with_key_fallback_uses_next_key_after_invalid_token(self):
        calls = []

        class _InvalidToken(Exception):
            pass

        def _decrypt_fn(key, token):
            calls.append(key)
            if key == "first":
                raise _InvalidToken("bad")
            if key == "second":
                return b"ok-value"
            raise ValueError("unexpected")

        out = crypto_keys.decrypt_with_key_fallback(
            token=b"blob",
            keys=("first", "second"),
            decrypt_fn=_decrypt_fn,
            continue_exceptions=(_InvalidToken,),
        )
        self.assertEqual(out, "ok-value")
        self.assertEqual(calls, ["first", "second"])


if __name__ == "__main__":
    unittest.main()
