#!/usr/bin/python3
import json
import os
import tempfile


def read_config(path, default_config):
    try:
        with open(path, 'r', encoding='utf-8') as config_file:
            payload = json.load(config_file)
    except FileNotFoundError:
        return default_config()
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f'Unable to read NTP configuration: {exc}') from exc
    if not isinstance(payload, dict):
        raise ValueError('Stored NTP configuration must be a JSON object')
    return payload


def write_config(path, payload):
    directory = os.path.dirname(path)
    os.makedirs(directory, exist_ok=True)
    file_descriptor, temporary_path = tempfile.mkstemp(prefix='.ntp_config.', suffix='.tmp', dir=directory)
    try:
        with os.fdopen(file_descriptor, 'w', encoding='utf-8') as config_file:
            json.dump(payload, config_file, ensure_ascii=False, indent=2)
            config_file.write('\n')
            config_file.flush()
            os.fsync(config_file.fileno())
        os.replace(temporary_path, path)
    except Exception:
        try:
            os.unlink(temporary_path)
        except FileNotFoundError:
            pass
        raise
