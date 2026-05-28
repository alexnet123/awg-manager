#!/usr/bin/python3
from . import repository
from . import runtime_adapter


def list_interfaces():
    return repository.list_interfaces()


def get_interface(interface_id):
    return repository.get_interface(interface_id)


def get_interface_config(interface_id):
    row = repository.get_interface_for_config(interface_id)
    return runtime_adapter.build_interface_server_config(row)


def create_interface(payload):
    return repository.create_interface(payload)


def update_interface(interface_id, payload):
    return repository.update_interface(interface_id, payload)


def delete_interface(interface_id):
    return repository.delete_interface(interface_id)


def list_clients():
    return repository.list_clients()


def get_client(client_id):
    row = repository.get_client(client_id)
    return repository.serialize_client(row, include_private_key=True)


def create_client(payload):
    return repository.create_client(payload)


def update_client(client_id, payload):
    return repository.update_client(client_id, payload)


def delete_client(client_id):
    return repository.delete_client(client_id)


def get_client_config(client_id):
    client_row = repository.get_client(client_id)
    interface_row = repository.get_interface_by_name(client_row[5])
    return repository.build_client_config(client_row, interface_row), repository.serialize_client(client_row)


def get_client_qr_svg(client_id):
    client_row = repository.get_client(client_id)
    interface_row = repository.get_interface_by_name(client_row[5])
    client_config = repository.build_client_config(client_row, interface_row)
    qr_svg = repository.build_qr_svg(client_config)
    serialized = repository.serialize_client(client_row)
    return qr_svg, serialized


def get_backup_bytes():
    return runtime_adapter.read_backup_bytes()


def restore_backup(db_base64):
    if not isinstance(db_base64, str) or not db_base64.strip():
        raise ValueError('db_base64 is required')
    backup_bytes = runtime_adapter.decode_base64_payload(db_base64.strip())
    runtime_adapter.restore_database(backup_bytes)


def rotate_api_key():
    return runtime_adapter.rotate_api_key()


def generate_awg_params(awg_version):
    version = runtime_adapter.detect_awg_version(awg_version)
    return version, runtime_adapter.prepare_awg_params(version)
