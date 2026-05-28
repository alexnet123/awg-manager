#!/usr/bin/python3
import getpass
import sys

from . import crypto_keys


_CACHED_CONTEXT = None


def _argument_value(flag_name, default=None, *, argv):
    if flag_name in argv:
        flag_index = argv.index(flag_name)
        if flag_index + 1 < len(argv):
            return argv[flag_index + 1]
    return default


def load_encryption_secret(*, argv=None, open_fn=open, getpass_fn=getpass.getpass, print_fn=print):
    if argv is None:
        argv = sys.argv
    encryption_key_path = _argument_value("-r", argv=argv)
    if encryption_key_path is not None:
        with open_fn(str(encryption_key_path), "r") as encryption_key_file:
            return encryption_key_file.read().rstrip("\n")
    print_fn("*** Введите ключ шифрования приватного ключа клиента ***")
    return getpass_fn("Введите ключ: ").rstrip("\n")


def build_crypto_context(encryption_secret):
    return {
        "encryption_secret": encryption_secret,
        "encryption_key": crypto_keys.derive_encryption_key_v2(encryption_secret),
        "encryption_key_legacy": crypto_keys.derive_encryption_key_v1_legacy(encryption_secret),
    }


def get_crypto_context(*, argv=None, open_fn=open, getpass_fn=getpass.getpass, print_fn=print):
    global _CACHED_CONTEXT
    if _CACHED_CONTEXT is not None:
        return _CACHED_CONTEXT
    encryption_secret = load_encryption_secret(
        argv=argv,
        open_fn=open_fn,
        getpass_fn=getpass_fn,
        print_fn=print_fn,
    )
    _CACHED_CONTEXT = build_crypto_context(encryption_secret)
    return _CACHED_CONTEXT
