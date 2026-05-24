#!/usr/bin/python3
import awg_core as manager


def _query_first(query_params, key):
    value = (query_params or {}).get(key)
    if not value:
        return None
    first = value[0]
    return str(first) if first is not None else None


def handle_get(path_parts, query_params, send_json):
    if path_parts == ['firewall']:
        send_json(200, {'ok': True, 'item': manager.get_firewall_state_service()})
        return True
    if path_parts == ['firewall', 'rules']:
        family = _query_first(query_params, 'family')
        table = _query_first(query_params, 'table')
        send_json(200, {'ok': True, 'items': manager.list_firewall_rules_service(family=family, table=table)})
        return True
    if path_parts == ['firewall', 'schema']:
        send_json(200, {'ok': True, 'item': manager.get_firewall_schema_service()})
        return True
    if path_parts == ['firewall', 'sets']:
        send_json(200, {'ok': True, 'item': manager.list_firewall_sets_service()})
        return True
    if path_parts == ['firewall', 'maps']:
        send_json(200, {'ok': True, 'item': manager.list_firewall_maps_service()})
        return True
    if path_parts == ['firewall', 'tables']:
        send_json(200, {'ok': True, 'item': manager.list_firewall_tables_service()})
        return True
    if path_parts == ['firewall', 'objects']:
        family = _query_first(query_params, 'family')
        table = _query_first(query_params, 'table')
        send_json(200, {'ok': True, 'item': manager.list_firewall_named_objects_service(family=family, table=table)})
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
    if path_parts == ['firewall', 'rules', 'reorder']:
        table = (payload or {}).get('table')
        ordered_ids = (payload or {}).get('ordered_ids')
        items = manager.reorder_firewall_rules_service(table, ordered_ids, apply_now=True)
        send_json(200, {'ok': True, 'items': items})
        return True
    if path_parts == ['firewall', 'counters', 'reset']:
        table = (payload or {}).get('table')
        result = manager.reset_firewall_counters_service(table=table)
        send_json(200, result)
        return True
    if len(path_parts) == 3 and path_parts[0] == 'firewall' and path_parts[1] == 'sets':
        item = manager.upsert_firewall_set_service(path_parts[2], payload or {})
        send_json(201, {'ok': True, 'item': item})
        return True
    if len(path_parts) == 3 and path_parts[0] == 'firewall' and path_parts[1] == 'maps':
        item = manager.upsert_firewall_map_service(path_parts[2], payload or {})
        send_json(201, {'ok': True, 'item': item})
        return True
    if path_parts == ['firewall', 'tables']:
        item = manager.upsert_firewall_table_service(payload or {})
        send_json(201, {'ok': True, 'item': item})
        return True
    if path_parts == ['firewall', 'objects']:
        item = manager.create_firewall_named_object_service(payload or {}, apply_now=True)
        send_json(201, {'ok': True, 'item': item})
        return True
    return False


def handle_put(path_parts, payload, send_json):
    if len(path_parts) == 3 and path_parts[0] == 'firewall' and path_parts[1] == 'rules':
        row = manager.update_firewall_rule_service(path_parts[2], payload, apply_now=True)
        send_json(200, {'ok': True, 'item': row})
        return True
    if len(path_parts) == 3 and path_parts[0] == 'firewall' and path_parts[1] == 'objects':
        row = manager.update_firewall_named_object_service(path_parts[2], payload or {}, apply_now=True)
        send_json(200, {'ok': True, 'item': row})
        return True
    return False


def handle_delete(path_parts, send_json):
    if len(path_parts) == 3 and path_parts[0] == 'firewall' and path_parts[1] == 'rules':
        row = manager.delete_firewall_rule_service(path_parts[2], apply_now=True)
        send_json(200, {'ok': True, 'item': row})
        return True
    if len(path_parts) == 4 and path_parts[0] == 'firewall' and path_parts[1] == 'sets':
        row = manager.delete_firewall_set_service(path_parts[2], path_parts[3])
        send_json(200, {'ok': True, 'item': row})
        return True
    if len(path_parts) == 4 and path_parts[0] == 'firewall' and path_parts[1] == 'maps':
        row = manager.delete_firewall_map_service(path_parts[2], path_parts[3])
        send_json(200, {'ok': True, 'item': row})
        return True
    if len(path_parts) == 3 and path_parts[0] == 'firewall' and path_parts[1] == 'tables':
        row = manager.delete_firewall_table_service(path_parts[2])
        send_json(200, {'ok': True, 'item': row})
        return True
    if len(path_parts) == 3 and path_parts[0] == 'firewall' and path_parts[1] == 'objects':
        row = manager.delete_firewall_named_object_service(path_parts[2], apply_now=True)
        send_json(200, {'ok': True, 'item': row})
        return True
    return False
