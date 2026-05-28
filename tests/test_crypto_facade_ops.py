import unittest

from backend.common import crypto_facade_ops


class CryptoFacadeOpsTest(unittest.TestCase):
    def test_encrypt_private_key_delegates_to_crypto_keys(self):
        original = crypto_facade_ops.crypto_keys.encrypt_with_key
        calls = []
        try:
            def _encrypt_with_key(value, key, fn):
                calls.append((value, key, fn("k", b"v")))
                return b"enc"

            crypto_facade_ops.crypto_keys.encrypt_with_key = _encrypt_with_key
            out = crypto_facade_ops.encrypt_private_key(
                "priv",
                encryption_key=b"key",
                fernet_encrypt_fn=lambda _key, blob: b"wrapped:" + blob,
            )
        finally:
            crypto_facade_ops.crypto_keys.encrypt_with_key = original
        self.assertEqual(out, b"enc")
        self.assertEqual(calls, [("priv", b"key", b"wrapped:v")])

    def test_decrypt_private_key_success(self):
        class _InvalidToken(Exception):
            pass

        original = crypto_facade_ops.crypto_keys.decrypt_with_key_fallback
        calls = []
        try:
            def _decrypt_with_key_fallback(token, keys, decrypt_fn, continue_exceptions):
                calls.append((token, keys, continue_exceptions))
                return decrypt_fn("k", b"x")

            crypto_facade_ops.crypto_keys.decrypt_with_key_fallback = _decrypt_with_key_fallback
            out = crypto_facade_ops.decrypt_private_key(
                b"blob",
                encryption_key=b"k1",
                encryption_key_legacy=b"k0",
                fernet_decrypt_fn=lambda _key, token: b"dec:" + token,
                invalid_token_type=_InvalidToken,
            )
        finally:
            crypto_facade_ops.crypto_keys.decrypt_with_key_fallback = original
        self.assertEqual(out, b"dec:x")
        self.assertEqual(calls, [(b"blob", (b"k1", b"k0"), (_InvalidToken,))])

    def test_decrypt_private_key_error_returns_invalidtoken(self):
        class _InvalidToken(Exception):
            pass

        original = crypto_facade_ops.crypto_keys.decrypt_with_key_fallback
        try:
            def _decrypt_with_key_fallback(*args, **kwargs):
                raise RuntimeError("boom")

            crypto_facade_ops.crypto_keys.decrypt_with_key_fallback = _decrypt_with_key_fallback
            out = crypto_facade_ops.decrypt_private_key(
                b"blob",
                encryption_key=b"k1",
                encryption_key_legacy=b"k0",
                fernet_decrypt_fn=lambda _key, token: token,
                invalid_token_type=_InvalidToken,
            )
        finally:
            crypto_facade_ops.crypto_keys.decrypt_with_key_fallback = original
        self.assertEqual(out, "InvalidToken")


if __name__ == "__main__":
    unittest.main()
