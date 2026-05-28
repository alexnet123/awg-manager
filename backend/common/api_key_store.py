#!/usr/bin/python3
import os
import secrets


def load_api_key(api_key_env_var, api_key_file, normalize_fn):
    env_api_key = normalize_fn(os.environ.get(api_key_env_var))
    if env_api_key is not None:
        return env_api_key
    if os.path.isfile(api_key_file):
        with open(api_key_file, 'r') as api_key_reader:
            return normalize_fn(api_key_reader.read())
    return None


def save_api_key(api_key, api_key_file, normalize_fn):
    normalized_api_key = normalize_fn(api_key)
    if normalized_api_key is None:
        raise ValueError('API key is empty')
    with open(api_key_file, 'w') as api_key_writer:
        api_key_writer.write(normalized_api_key + '\n')
    os.chmod(api_key_file, 0o600)


def rotate_api_key(save_fn):
    new_key = secrets.token_hex(32)
    save_fn(new_key)
    return new_key

