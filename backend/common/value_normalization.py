#!/usr/bin/python3


def normalize_config_value(value):
    if value is None:
        return None
    if isinstance(value, bytes):
        value = value.decode('utf-8')
    value = str(value).strip()
    return value if value else None
