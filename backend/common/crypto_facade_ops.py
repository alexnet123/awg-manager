#!/usr/bin/python3
from . import crypto_keys


def encrypt_private_key(private_key, encryption_key, fernet_encrypt_fn):
    return crypto_keys.encrypt_with_key(private_key, encryption_key, fernet_encrypt_fn)


def decrypt_private_key(
    encrypted_private_key,
    encryption_key,
    encryption_key_legacy,
    fernet_decrypt_fn,
    invalid_token_type,
):
    try:
        return crypto_keys.decrypt_with_key_fallback(
            token=encrypted_private_key,
            keys=(encryption_key, encryption_key_legacy),
            decrypt_fn=fernet_decrypt_fn,
            continue_exceptions=(invalid_token_type,),
        )
    except Exception:
        return "InvalidToken"
