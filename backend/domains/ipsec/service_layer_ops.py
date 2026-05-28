#!/usr/bin/python3
from . import service_ops
from . import store


def list_peers(*, read_collection_fn, peers_file):
    return service_ops.list_peers_service(
        read_collection_fn=read_collection_fn,
        peers_file=peers_file,
    )


def list_identities(*, read_collection_fn, identities_file):
    return service_ops.list_identities_service(
        read_collection_fn=read_collection_fn,
        identities_file=identities_file,
    )


def list_phase1_profiles(*, read_collection_fn, phase1_profiles_file):
    return service_ops.list_phase1_profiles_service(
        read_collection_fn=read_collection_fn,
        phase1_profiles_file=phase1_profiles_file,
    )


def list_phase2_proposals(*, read_collection_fn, phase2_proposals_file):
    return service_ops.list_phase2_proposals_service(
        read_collection_fn=read_collection_fn,
        phase2_proposals_file=phase2_proposals_file,
    )


def list_policies(*, read_collection_fn, policies_file):
    return service_ops.list_policies_service(
        read_collection_fn=read_collection_fn,
        policies_file=policies_file,
    )


def upsert_peer(
    payload,
    *,
    valid_name_fn,
    normalize_ip_list_fn,
    read_collection_fn,
    write_collection_fn,
    peers_file,
    phase1_profiles_file,
):
    return service_ops.upsert_peer_service(
        payload,
        valid_name_fn=valid_name_fn,
        normalize_ip_list_fn=normalize_ip_list_fn,
        read_collection_fn=read_collection_fn,
        write_collection_fn=write_collection_fn,
        peers_file=peers_file,
        phase1_profiles_file=phase1_profiles_file,
    )


def upsert_identity(
    payload,
    *,
    valid_name_fn,
    normalize_config_value_fn,
    secret_encrypt_fn,
    read_collection_fn,
    write_collection_fn,
    identities_file,
    peers_file,
):
    return service_ops.upsert_identity_service(
        payload,
        valid_name_fn=valid_name_fn,
        normalize_config_value_fn=normalize_config_value_fn,
        secret_encrypt_fn=secret_encrypt_fn,
        read_collection_fn=read_collection_fn,
        write_collection_fn=write_collection_fn,
        identities_file=identities_file,
        peers_file=peers_file,
    )


def upsert_phase1_profile(
    payload,
    *,
    valid_name_fn,
    normalize_config_value_fn,
    build_phase1_proposal_string_fn,
    read_collection_fn,
    write_collection_fn,
    phase1_profiles_file,
):
    return service_ops.upsert_phase1_profile_service(
        payload,
        valid_name_fn=valid_name_fn,
        normalize_config_value_fn=normalize_config_value_fn,
        build_phase1_proposal_string_fn=build_phase1_proposal_string_fn,
        read_collection_fn=read_collection_fn,
        write_collection_fn=write_collection_fn,
        phase1_profiles_file=phase1_profiles_file,
    )


def upsert_phase2_proposal(
    payload,
    *,
    valid_name_fn,
    normalize_config_value_fn,
    build_phase2_proposal_string_fn,
    read_collection_fn,
    write_collection_fn,
    phase2_proposals_file,
):
    return service_ops.upsert_phase2_proposal_service(
        payload,
        valid_name_fn=valid_name_fn,
        normalize_config_value_fn=normalize_config_value_fn,
        build_phase2_proposal_string_fn=build_phase2_proposal_string_fn,
        read_collection_fn=read_collection_fn,
        write_collection_fn=write_collection_fn,
        phase2_proposals_file=phase2_proposals_file,
    )


def upsert_policy(
    payload,
    *,
    valid_name_fn,
    normalize_ts_list_fn,
    normalize_config_value_fn,
    read_collection_fn,
    write_collection_fn,
    policies_file,
    peers_file,
    phase2_proposals_file,
):
    return service_ops.upsert_policy_service(
        payload,
        valid_name_fn=valid_name_fn,
        normalize_ts_list_fn=normalize_ts_list_fn,
        normalize_config_value_fn=normalize_config_value_fn,
        read_collection_fn=read_collection_fn,
        write_collection_fn=write_collection_fn,
        policies_file=policies_file,
        peers_file=peers_file,
        phase2_proposals_file=phase2_proposals_file,
    )


def delete_peer(
    name,
    *,
    read_collection_fn,
    write_collection_fn,
    peers_file,
    policies_file,
    identities_file,
):
    return service_ops.delete_peer_service(
        name,
        read_collection_fn=read_collection_fn,
        write_collection_fn=write_collection_fn,
        peers_file=peers_file,
        policies_file=policies_file,
        identities_file=identities_file,
    )


def delete_policy(name, *, read_collection_fn, write_collection_fn, policies_file):
    return service_ops.delete_policy_service(
        name,
        read_collection_fn=read_collection_fn,
        write_collection_fn=write_collection_fn,
        policies_file=policies_file,
    )


def log_event(event_type, payload, *, events_file):
    return service_ops.log_event_service(
        event_type,
        payload,
        append_event_fn=store.append_event,
        events_file=events_file,
    )


def list_events(*, events_file):
    return service_ops.list_events_service(
        list_events_fn=store.list_events,
        events_file=events_file,
    )


def list_active_peers():
    return service_ops.list_active_peers_service()


def list_installed_sas():
    return service_ops.list_installed_sas_service()


def load_peer(
    peer_name,
    *,
    read_collection_fn,
    peers_file,
    identities_file,
    phase1_profiles_file,
    phase2_proposals_file,
    policies_file,
    secret_decrypt_fn,
    log_event_fn,
):
    return service_ops.load_peer_service(
        peer_name,
        read_collection_fn=read_collection_fn,
        peers_file=peers_file,
        identities_file=identities_file,
        phase1_profiles_file=phase1_profiles_file,
        phase2_proposals_file=phase2_proposals_file,
        policies_file=policies_file,
        secret_decrypt_fn=secret_decrypt_fn,
        log_event_fn=log_event_fn,
    )


def initiate_policy(policy_name, *, read_collection_fn, policies_file, log_event_fn):
    return service_ops.initiate_policy_service(
        policy_name,
        read_collection_fn=read_collection_fn,
        policies_file=policies_file,
        log_event_fn=log_event_fn,
    )


def terminate_peer(peer_name, *, log_event_fn):
    return service_ops.terminate_peer_service(
        peer_name,
        log_event_fn=log_event_fn,
    )


def apply_config(
    *,
    read_collection_fn,
    peers_file,
    identities_file,
    phase1_profiles_file,
    phase2_proposals_file,
    policies_file,
    secret_decrypt_fn,
    log_event_fn,
):
    return service_ops.apply_config_service(
        read_collection_fn=read_collection_fn,
        peers_file=peers_file,
        identities_file=identities_file,
        phase1_profiles_file=phase1_profiles_file,
        phase2_proposals_file=phase2_proposals_file,
        policies_file=policies_file,
        secret_decrypt_fn=secret_decrypt_fn,
        log_event_fn=log_event_fn,
    )
