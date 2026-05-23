#!/usr/bin/python3
import awg_core as manager


def _strip_prefix(path_parts):
    if len(path_parts) >= 2 and path_parts[0] == 'api' and path_parts[1] == 'ipsec':
        return path_parts[2:]
    if len(path_parts) >= 1 and path_parts[0] == 'ipsec':
        return path_parts[1:]
    return None


def handle_get(path_parts, send_json):
    p = _strip_prefix(path_parts)
    if p is None:
        return False
    if p == ['peers']:
        send_json(200, {'ok': True, 'items': manager.list_ipsec_peers_service()})
        return True
    if p == ['identities']:
        send_json(200, {'ok': True, 'items': manager.list_ipsec_identities_service()})
        return True
    if p == ['policies']:
        send_json(200, {'ok': True, 'items': manager.list_ipsec_policies_service()})
        return True
    if p == ['phase1-profiles']:
        send_json(200, {'ok': True, 'items': manager.list_ipsec_phase1_profiles_service()})
        return True
    if p == ['phase2-proposals']:
        send_json(200, {'ok': True, 'items': manager.list_ipsec_phase2_proposals_service()})
        return True
    if p == ['active-peers']:
        send_json(200, {'ok': True, 'items': manager.list_ipsec_active_peers_service()})
        return True
    if p == ['installed-sas']:
        send_json(200, {'ok': True, 'items': manager.list_ipsec_installed_sas_service()})
        return True
    if p == ['events']:
        send_json(200, {'ok': True, 'items': manager.list_ipsec_events_service()})
        return True
    return False


def handle_post(path_parts, payload, send_json):
    p = _strip_prefix(path_parts)
    if p is None:
        return False
    if p == ['peers']:
        send_json(201, {'ok': True, 'item': manager.upsert_ipsec_peer_service(payload or {})})
        return True
    if p == ['identities']:
        send_json(201, {'ok': True, 'item': manager.upsert_ipsec_identity_service(payload or {})})
        return True
    if p == ['policies']:
        send_json(201, {'ok': True, 'item': manager.upsert_ipsec_policy_service(payload or {})})
        return True
    if p == ['phase1-profiles']:
        send_json(201, {'ok': True, 'item': manager.upsert_ipsec_phase1_profile_service(payload or {})})
        return True
    if p == ['phase2-proposals']:
        send_json(201, {'ok': True, 'item': manager.upsert_ipsec_phase2_proposal_service(payload or {})})
        return True
    if p == ['apply']:
        send_json(200, {'ok': True, 'item': manager.apply_ipsec_config_service()})
        return True
    if len(p) == 2 and p[0] == 'load':
        send_json(200, {'ok': True, 'item': manager.load_ipsec_peer_service(p[1])})
        return True
    if len(p) == 2 and p[0] == 'initiate':
        send_json(200, {'ok': True, 'item': manager.initiate_ipsec_policy_service(p[1])})
        return True
    if len(p) == 2 and p[0] == 'terminate':
        send_json(200, {'ok': True, 'item': manager.terminate_ipsec_peer_service(p[1])})
        return True
    return False


def handle_put(path_parts, payload, send_json):
    p = _strip_prefix(path_parts)
    if p is None:
        return False
    if len(p) == 2 and p[0] == 'peers':
        body = dict(payload or {})
        body['name'] = p[1]
        send_json(200, {'ok': True, 'item': manager.upsert_ipsec_peer_service(body)})
        return True
    if len(p) == 2 and p[0] == 'policies':
        body = dict(payload or {})
        body['name'] = p[1]
        send_json(200, {'ok': True, 'item': manager.upsert_ipsec_policy_service(body)})
        return True
    return False


def handle_delete(path_parts, send_json):
    p = _strip_prefix(path_parts)
    if p is None:
        return False
    if len(p) == 2 and p[0] == 'peers':
        send_json(200, {'ok': True, 'item': manager.delete_ipsec_peer_service(p[1])})
        return True
    if len(p) == 2 and p[0] == 'policies':
        send_json(200, {'ok': True, 'item': manager.delete_ipsec_policy_service(p[1])})
        return True
    return False
