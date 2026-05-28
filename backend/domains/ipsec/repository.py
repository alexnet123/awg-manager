#!/usr/bin/python3
from ...common.manager_access import get_manager


def list_peers():
    return get_manager().list_ipsec_peers_service()


def list_identities():
    return get_manager().list_ipsec_identities_service()


def list_policies():
    return get_manager().list_ipsec_policies_service()


def list_phase1_profiles():
    return get_manager().list_ipsec_phase1_profiles_service()


def list_phase2_proposals():
    return get_manager().list_ipsec_phase2_proposals_service()


def list_events():
    return get_manager().list_ipsec_events_service()


def upsert_peer(payload):
    return get_manager().upsert_ipsec_peer_service(payload or {})


def upsert_identity(payload):
    return get_manager().upsert_ipsec_identity_service(payload or {})


def upsert_policy(payload):
    return get_manager().upsert_ipsec_policy_service(payload or {})


def upsert_phase1_profile(payload):
    return get_manager().upsert_ipsec_phase1_profile_service(payload or {})


def upsert_phase2_proposal(payload):
    return get_manager().upsert_ipsec_phase2_proposal_service(payload or {})


def delete_peer(name):
    return get_manager().delete_ipsec_peer_service(name)


def delete_policy(name):
    return get_manager().delete_ipsec_policy_service(name)

