#!/usr/bin/python3
from . import repository
from . import runtime_adapter


def _query_first(query_params, key):
    value = (query_params or {}).get(key)
    if not value:
        return None
    first = value[0]
    return str(first) if first is not None else None


def handle_get(path_parts, query_params):
    if path_parts == ['firewall']:
        return 200, {'ok': True, 'item': repository.get_state()}
    if path_parts == ['firewall', 'rules']:
        family = _query_first(query_params, 'family')
        table = _query_first(query_params, 'table')
        return 200, {'ok': True, 'items': repository.list_rules(family=family, table=table)}
    if path_parts == ['firewall', 'schema']:
        return 200, {'ok': True, 'item': repository.get_schema()}
    if path_parts == ['firewall', 'sets']:
        return 200, {'ok': True, 'item': repository.list_sets()}
    if path_parts == ['firewall', 'maps']:
        return 200, {'ok': True, 'item': repository.list_maps()}
    if path_parts == ['firewall', 'tables']:
        return 200, {'ok': True, 'item': repository.list_tables()}
    if path_parts == ['firewall', 'objects']:
        family = _query_first(query_params, 'family')
        table = _query_first(query_params, 'table')
        return 200, {'ok': True, 'item': repository.list_named_objects(family=family, table=table)}
    return None


def handle_post(path_parts, payload):
    if path_parts == ['firewall', 'rules']:
        row = repository.create_rule(payload)
        return 201, {'ok': True, 'item': row}
    if path_parts == ['firewall', 'apply']:
        runtime_adapter.apply_rules()
        return 200, {'ok': True}
    if path_parts == ['firewall', 'rules', 'reorder']:
        table = (payload or {}).get('table')
        ordered_ids = (payload or {}).get('ordered_ids')
        items = repository.reorder_rules(table, ordered_ids)
        return 200, {'ok': True, 'items': items}
    if path_parts == ['firewall', 'counters', 'reset']:
        table = (payload or {}).get('table')
        result = repository.reset_counters(table=table)
        return 200, result
    if len(path_parts) == 3 and path_parts[0] == 'firewall' and path_parts[1] == 'sets':
        item = repository.upsert_set(path_parts[2], payload or {})
        return 201, {'ok': True, 'item': item}
    if len(path_parts) == 3 and path_parts[0] == 'firewall' and path_parts[1] == 'maps':
        item = repository.upsert_map(path_parts[2], payload or {})
        return 201, {'ok': True, 'item': item}
    if path_parts == ['firewall', 'tables']:
        item = repository.upsert_table(payload or {})
        return 201, {'ok': True, 'item': item}
    if path_parts == ['firewall', 'objects']:
        item = repository.create_named_object(payload or {})
        return 201, {'ok': True, 'item': item}
    return None


def handle_put(path_parts, payload):
    if len(path_parts) == 3 and path_parts[0] == 'firewall' and path_parts[1] == 'rules':
        row = repository.update_rule(path_parts[2], payload)
        return 200, {'ok': True, 'item': row}
    if len(path_parts) == 3 and path_parts[0] == 'firewall' and path_parts[1] == 'objects':
        row = repository.update_named_object(path_parts[2], payload or {})
        return 200, {'ok': True, 'item': row}
    return None


def handle_delete(path_parts):
    if len(path_parts) == 3 and path_parts[0] == 'firewall' and path_parts[1] == 'rules':
        row = repository.delete_rule(path_parts[2])
        return 200, {'ok': True, 'item': row}
    if len(path_parts) == 4 and path_parts[0] == 'firewall' and path_parts[1] == 'sets':
        row = repository.delete_set(path_parts[2], path_parts[3])
        return 200, {'ok': True, 'item': row}
    if len(path_parts) == 4 and path_parts[0] == 'firewall' and path_parts[1] == 'maps':
        row = repository.delete_map(path_parts[2], path_parts[3])
        return 200, {'ok': True, 'item': row}
    if len(path_parts) == 3 and path_parts[0] == 'firewall' and path_parts[1] == 'tables':
        row = repository.delete_table(path_parts[2])
        return 200, {'ok': True, 'item': row}
    if len(path_parts) == 3 and path_parts[0] == 'firewall' and path_parts[1] == 'objects':
        row = repository.delete_named_object(path_parts[2])
        return 200, {'ok': True, 'item': row}
    return None
