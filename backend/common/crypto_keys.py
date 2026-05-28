#!/usr/bin/python3
import base64
import hashlib


def derive_encryption_key_v2(raw_key):
    digest = hashlib.sha256(str(raw_key).encode('utf-8')).digest()
    return base64.urlsafe_b64encode(digest)


def derive_encryption_key_v1_legacy(raw_key):
    key_bytes = str(raw_key).encode('utf-8')[:32].ljust(32, b'\0')
    return base64.urlsafe_b64encode(key_bytes)


def encrypt_with_key(value, key, encrypt_fn):
    return encrypt_fn(key, str(value).encode('utf-8'))


def decrypt_with_key_fallback(token, keys, decrypt_fn, continue_exceptions=()):
    normalized = token.encode('utf-8') if isinstance(token, str) else token
    for key in keys:
        try:
            decrypted = decrypt_fn(key, normalized)
            return decrypted.decode('utf-8')
        except continue_exceptions:
            continue
    raise ValueError('secret decryption failed')

