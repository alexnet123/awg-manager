#!/usr/bin/python3
from ...common.manager_access import get_manager


def build_interface_server_config(row):
    return get_manager().build_interface_server_config(row)


def read_backup_bytes():
    return get_manager().read_database_bytes()


def decode_base64_payload(payload):
    return get_manager().decode_base64_payload(payload)


def restore_database(payload):
    get_manager().restore_database_from_bytes(payload)


def rotate_api_key():
    return get_manager().rotate_api_key()


def detect_awg_version(version):
    return get_manager().detect_awg_version(version, {})


def prepare_awg_params(version):
    return get_manager().prepare_awg_params_for_version(version)

