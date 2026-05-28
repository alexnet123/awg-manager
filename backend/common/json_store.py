#!/usr/bin/python3
import json
import os


def read_json(path, default):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            payload = json.load(f)
            return payload if isinstance(payload, type(default)) else default
    except Exception:
        return default


def read_dict_or_default(path, default_payload):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if isinstance(data, dict):
                return data
    except Exception:
        pass
    return dict(default_payload)


def write_json(path, payload, ensure_dir=False):
    if ensure_dir:
        os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

