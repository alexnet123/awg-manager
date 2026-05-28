#!/usr/bin/python3
import time

from ...common import json_store


def read_collection(path):
    data = json_store.read_dict_or_default(path, {'items': []})
    items = data.get('items') if isinstance(data.get('items'), list) else []
    return [x for x in items if isinstance(x, dict)]


def write_collection(path, items):
    json_store.write_json(path, {'items': items}, ensure_dir=True)


def append_event(path, event_type, payload, now_ts=None, limit=500):
    data = json_store.read_dict_or_default(path, {'items': []})
    items = data.get('items') if isinstance(data.get('items'), list) else []
    if now_ts is None:
        now_ts = int(time.time())
    items.append({'t': int(now_ts), 'event': str(event_type), 'payload': payload})
    items = items[-int(limit):]
    json_store.write_json(path, {'items': items}, ensure_dir=True)
    return items


def list_events(path):
    data = json_store.read_dict_or_default(path, {'items': []})
    return data.get('items') if isinstance(data.get('items'), list) else []

