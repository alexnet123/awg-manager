#!/usr/bin/python3
from ...common.manager_access import get_manager


def list_active_peers():
    return get_manager().list_ipsec_active_peers_service()


def list_installed_sas():
    return get_manager().list_ipsec_installed_sas_service()


def apply_config():
    return get_manager().apply_ipsec_config_service()


def load_peer(peer_name):
    return get_manager().load_ipsec_peer_service(peer_name)


def initiate_policy(policy_name):
    return get_manager().initiate_ipsec_policy_service(policy_name)


def terminate_peer(peer_name):
    return get_manager().terminate_ipsec_peer_service(peer_name)

