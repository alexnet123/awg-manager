#!/usr/bin/python3
from ...common.manager_access import get_manager


def get_state():
    return get_manager().get_firewall_state_service()


def list_rules(family=None, table=None):
    return get_manager().list_firewall_rules_service(family=family, table=table)


def get_schema():
    return get_manager().get_firewall_schema_service()


def list_sets():
    return get_manager().list_firewall_sets_service()


def list_maps():
    return get_manager().list_firewall_maps_service()


def list_tables():
    return get_manager().list_firewall_tables_service()


def list_named_objects(family=None, table=None):
    return get_manager().list_firewall_named_objects_service(family=family, table=table)


def create_rule(payload):
    return get_manager().create_firewall_rule_service(payload, apply_now=True)


def reorder_rules(table, ordered_ids):
    return get_manager().reorder_firewall_rules_service(table, ordered_ids, apply_now=True)


def reset_counters(table=None):
    return get_manager().reset_firewall_counters_service(table=table)


def upsert_set(kind, payload):
    return get_manager().upsert_firewall_set_service(kind, payload or {})


def upsert_map(kind, payload):
    return get_manager().upsert_firewall_map_service(kind, payload or {})


def upsert_table(payload):
    return get_manager().upsert_firewall_table_service(payload or {})


def create_named_object(payload):
    return get_manager().create_firewall_named_object_service(payload or {}, apply_now=True)


def update_rule(rule_id, payload):
    return get_manager().update_firewall_rule_service(rule_id, payload, apply_now=True)


def update_named_object(object_id, payload):
    return get_manager().update_firewall_named_object_service(object_id, payload or {}, apply_now=True)


def delete_rule(rule_id):
    return get_manager().delete_firewall_rule_service(rule_id, apply_now=True)


def delete_set(kind, item_id):
    return get_manager().delete_firewall_set_service(kind, item_id)


def delete_map(kind, item_id):
    return get_manager().delete_firewall_map_service(kind, item_id)


def delete_table(table_id):
    return get_manager().delete_firewall_table_service(table_id)


def delete_named_object(object_id):
    return get_manager().delete_firewall_named_object_service(object_id, apply_now=True)

