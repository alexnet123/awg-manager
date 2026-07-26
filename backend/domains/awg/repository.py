#!/usr/bin/python3
from ...common.manager_access import get_manager


def list_interfaces():
    manager = get_manager()
    return [
        manager.serialize_interface_row(row)
        for row in manager.list_interfaces_rows()
    ]


def get_interface(interface_id):
    manager = get_manager()
    row = manager.get_interface_row(interface_id)
    if not row:
        raise LookupError('Interface not found')
    return manager.serialize_interface_row(row)


def get_interface_for_config(interface_id):
    manager = get_manager()
    row = manager.get_interface_row(interface_id)
    if not row:
        raise LookupError('Interface not found')
    return row


def create_interface(payload):
    manager = get_manager()
    row = manager.create_interface_row(payload)
    return manager.serialize_interface_row(row)


def update_interface(interface_id, payload):
    manager = get_manager()
    row = manager.update_interface_row(interface_id, payload)
    return manager.serialize_interface_row(row)


def delete_interface(interface_id):
    manager = get_manager()
    row = manager.delete_interface_row(interface_id)
    return manager.serialize_interface_row(row)


def set_interface_enabled(interface_id, enabled):
    manager = get_manager()
    row = manager.set_interface_enabled_row(interface_id, enabled)
    return manager.serialize_interface_row(row)


def list_clients():
    manager = get_manager()
    return [
        manager.serialize_client_row(row)
        for row in manager.list_client_rows()
    ]


def get_client(client_id):
    manager = get_manager()
    row = manager.get_client_row(client_id)
    if not row:
        raise LookupError('Client not found')
    return row


def create_client(payload):
    manager = get_manager()
    row = manager.create_client_row(payload)
    return manager.serialize_client_row(row, include_private_key=True)


def update_client(client_id, payload):
    manager = get_manager()
    row = manager.update_client_row(client_id, payload)
    return manager.serialize_client_row(row, include_private_key=True)


def delete_client(client_id):
    manager = get_manager()
    row = manager.delete_client_row(client_id)
    return manager.serialize_client_row(row)


def set_client_enabled(client_id, enabled):
    manager = get_manager()
    row = manager.set_client_enabled_row(client_id, enabled)
    return manager.serialize_client_row(row)


def get_interface_by_name(interface_name):
    manager = get_manager()
    row = manager.get_interface_row_by_name(interface_name)
    if not row:
        raise LookupError('Interface not found')
    return row


def serialize_client(row, include_private_key=False):
    return get_manager().serialize_client_row(row, include_private_key=include_private_key)


def build_client_config(client_row, interface_row):
    return get_manager().build_client_config(client_row, interface_row)


def build_qr_svg(content):
    return get_manager().build_qr_svg(content)
