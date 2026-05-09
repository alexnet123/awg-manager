#!/usr/bin/python3
import awg_core as manager


def handle_get(path_parts, send_json):
    if path_parts == ['firewall']:
        send_json(200, {'ok': True, 'item': manager.get_firewall_state_service()})
        return True
    return False


def handle_post(path_parts, payload, send_json):
    if path_parts == ['firewall', 'rules']:
        row = manager.create_firewall_rule_service(payload, apply_now=True)
        send_json(201, {'ok': True, 'item': row})
        return True
    if path_parts == ['firewall', 'apply']:
        manager.apply_firewall_rules()
        send_json(200, {'ok': True})
        return True
    return False


def handle_put(path_parts, payload, send_json):
    if len(path_parts) == 3 and path_parts[0] == 'firewall' and path_parts[1] == 'rules':
        row = manager.update_firewall_rule_service(path_parts[2], payload, apply_now=True)
        send_json(200, {'ok': True, 'item': row})
        return True
    return False


def handle_delete(path_parts, send_json):
    if len(path_parts) == 3 and path_parts[0] == 'firewall' and path_parts[1] == 'rules':
        row = manager.delete_firewall_rule_service(path_parts[2], apply_now=True)
        send_json(200, {'ok': True, 'item': row})
        return True
    return False
