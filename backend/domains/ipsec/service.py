#!/usr/bin/python3
from . import repository
from . import runtime_adapter


def _strip_prefix(path_parts):
    if len(path_parts) >= 2 and path_parts[0] == 'api' and path_parts[1] == 'ipsec':
        return path_parts[2:]
    if len(path_parts) >= 1 and path_parts[0] == 'ipsec':
        return path_parts[1:]
    return None


def handle_get(path_parts):
    p = _strip_prefix(path_parts)
    if p is None:
        return None
    if p == ['peers']:
        return 200, {'ok': True, 'items': repository.list_peers()}
    if p == ['identities']:
        return 200, {'ok': True, 'items': repository.list_identities()}
    if len(p) == 3 and p[0] == 'identities' and p[2] == 'psk':
        return 200, {'ok': True, 'item': repository.get_identity_psk(p[1])}
    if p == ['policies']:
        return 200, {'ok': True, 'items': repository.list_policies()}
    if p == ['phase1-profiles']:
        return 200, {'ok': True, 'items': repository.list_phase1_profiles()}
    if p == ['phase2-proposals']:
        return 200, {'ok': True, 'items': repository.list_phase2_proposals()}
    if p == ['active-peers']:
        return 200, {'ok': True, 'items': runtime_adapter.list_active_peers()}
    if p == ['installed-sas']:
        return 200, {'ok': True, 'items': runtime_adapter.list_installed_sas()}
    if p == ['config-preview']:
        return 200, {'ok': True, 'item': runtime_adapter.get_config_preview()}
    if p == ['events']:
        return 200, {'ok': True, 'items': repository.list_events()}
    return None


def handle_post(path_parts, payload):
    p = _strip_prefix(path_parts)
    if p is None:
        return None
    if p == ['peers']:
        return 201, {'ok': True, 'item': repository.upsert_peer(payload or {})}
    if p == ['identities']:
        return 201, {'ok': True, 'item': repository.upsert_identity(payload or {})}
    if p == ['policies']:
        return 201, {'ok': True, 'item': repository.upsert_policy(payload or {})}
    if p == ['phase1-profiles']:
        return 201, {'ok': True, 'item': repository.upsert_phase1_profile(payload or {})}
    if p == ['phase2-proposals']:
        return 201, {'ok': True, 'item': repository.upsert_phase2_proposal(payload or {})}
    if p == ['apply']:
        return 200, {'ok': True, 'item': runtime_adapter.apply_config()}
    if len(p) == 2 and p[0] == 'load':
        return 200, {'ok': True, 'item': runtime_adapter.load_peer(p[1])}
    if len(p) == 2 and p[0] == 'initiate':
        return 200, {'ok': True, 'item': runtime_adapter.initiate_policy(p[1])}
    if len(p) == 2 and p[0] == 'terminate':
        return 200, {'ok': True, 'item': runtime_adapter.terminate_peer(p[1])}
    return None


def handle_put(path_parts, payload):
    p = _strip_prefix(path_parts)
    if p is None:
        return None
    if len(p) == 2 and p[0] == 'peers':
        body = dict(payload or {})
        body['name'] = p[1]
        return 200, {'ok': True, 'item': repository.upsert_peer(body)}
    if len(p) == 2 and p[0] == 'policies':
        body = dict(payload or {})
        body['name'] = p[1]
        return 200, {'ok': True, 'item': repository.upsert_policy(body)}
    return None


def handle_delete(path_parts):
    p = _strip_prefix(path_parts)
    if p is None:
        return None
    if len(p) == 2 and p[0] == 'peers':
        return 200, {'ok': True, 'item': repository.delete_peer(p[1])}
    if len(p) == 2 and p[0] == 'policies':
        return 200, {'ok': True, 'item': repository.delete_policy(p[1])}
    if len(p) == 2 and p[0] == 'identities':
        return 200, {'ok': True, 'item': repository.delete_identity(p[1])}
    if len(p) == 2 and p[0] == 'phase1-profiles':
        return 200, {'ok': True, 'item': repository.delete_phase1_profile(p[1])}
    if len(p) == 2 and p[0] == 'phase2-proposals':
        return 200, {'ok': True, 'item': repository.delete_phase2_proposal(p[1])}
    return None
