#!/usr/bin/python3
from . import crud_ops
from . import query_ops
from . import runtime_ops


def list_peers_service(*, read_collection_fn, peers_file):
    return read_collection_fn(peers_file)


def list_identities_service(*, read_collection_fn, identities_file):
    return query_ops.list_ipsec_identities(
        read_collection_fn=lambda: read_collection_fn(identities_file),
    )


def list_phase1_profiles_service(*, read_collection_fn, phase1_profiles_file):
    return read_collection_fn(phase1_profiles_file)


def list_phase2_proposals_service(*, read_collection_fn, phase2_proposals_file):
    return read_collection_fn(phase2_proposals_file)


def list_policies_service(*, read_collection_fn, policies_file):
    return read_collection_fn(policies_file)


def ensure_peer_exists(
    peer_name,
    *,
    read_collection_fn,
    peers_file,
):
    return query_ops.ensure_item_exists_by_name(
        peer_name,
        read_collection_fn=lambda: read_collection_fn(peers_file),
        error_message="peer not found",
    )


def ensure_phase1_exists(
    profile_name,
    *,
    read_collection_fn,
    phase1_profiles_file,
):
    return query_ops.ensure_item_exists_by_name(
        profile_name,
        read_collection_fn=lambda: read_collection_fn(phase1_profiles_file),
        error_message="phase1 profile not found",
    )


def ensure_phase2_exists(
    proposal_name,
    *,
    read_collection_fn,
    phase2_proposals_file,
):
    return query_ops.ensure_item_exists_by_name(
        proposal_name,
        read_collection_fn=lambda: read_collection_fn(phase2_proposals_file),
        error_message="phase2 proposal not found",
    )


def upsert_peer_service(
    payload,
    *,
    valid_name_fn,
    normalize_ip_list_fn,
    read_collection_fn,
    write_collection_fn,
    peers_file,
    phase1_profiles_file,
):
    return crud_ops.upsert_peer(
        payload,
        valid_name_fn=valid_name_fn,
        normalize_ip_list_fn=normalize_ip_list_fn,
        ensure_phase1_exists_fn=lambda profile_name: ensure_phase1_exists(
            profile_name,
            read_collection_fn=read_collection_fn,
            phase1_profiles_file=phase1_profiles_file,
        ),
        read_peers_fn=lambda: read_collection_fn(peers_file),
        write_peers_fn=lambda items: write_collection_fn(peers_file, items),
    )


def upsert_identity_service(
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
    return crud_ops.upsert_identity(
        payload,
        valid_name_fn=valid_name_fn,
        ensure_peer_exists_fn=lambda peer_name: ensure_peer_exists(
            peer_name,
            read_collection_fn=read_collection_fn,
            peers_file=peers_file,
        ),
        normalize_config_value_fn=normalize_config_value_fn,
        read_identities_fn=lambda: read_collection_fn(identities_file),
        secret_encrypt_fn=secret_encrypt_fn,
        write_identities_fn=lambda items: write_collection_fn(identities_file, items),
    )


def upsert_phase1_profile_service(
    payload,
    *,
    valid_name_fn,
    normalize_config_value_fn,
    build_phase1_proposal_string_fn,
    read_collection_fn,
    write_collection_fn,
    phase1_profiles_file,
):
    return crud_ops.upsert_phase1_profile(
        payload,
        valid_name_fn=valid_name_fn,
        normalize_config_value_fn=normalize_config_value_fn,
        build_phase1_proposal_string_fn=build_phase1_proposal_string_fn,
        read_profiles_fn=lambda: read_collection_fn(phase1_profiles_file),
        write_profiles_fn=lambda items: write_collection_fn(phase1_profiles_file, items),
    )


def upsert_phase2_proposal_service(
    payload,
    *,
    valid_name_fn,
    normalize_config_value_fn,
    build_phase2_proposal_string_fn,
    read_collection_fn,
    write_collection_fn,
    phase2_proposals_file,
):
    return crud_ops.upsert_phase2_proposal(
        payload,
        valid_name_fn=valid_name_fn,
        normalize_config_value_fn=normalize_config_value_fn,
        build_phase2_proposal_string_fn=build_phase2_proposal_string_fn,
        read_proposals_fn=lambda: read_collection_fn(phase2_proposals_file),
        write_proposals_fn=lambda items: write_collection_fn(phase2_proposals_file, items),
    )


def upsert_policy_service(
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
    return crud_ops.upsert_policy(
        payload,
        valid_name_fn=valid_name_fn,
        normalize_ts_list_fn=normalize_ts_list_fn,
        normalize_config_value_fn=normalize_config_value_fn,
        ensure_peer_exists_fn=lambda peer_name: ensure_peer_exists(
            peer_name,
            read_collection_fn=read_collection_fn,
            peers_file=peers_file,
        ),
        ensure_phase2_exists_fn=lambda proposal_name: ensure_phase2_exists(
            proposal_name,
            read_collection_fn=read_collection_fn,
            phase2_proposals_file=phase2_proposals_file,
        ),
        read_policies_fn=lambda: read_collection_fn(policies_file),
        write_policies_fn=lambda items: write_collection_fn(policies_file, items),
    )


def delete_peer_service(
    name,
    *,
    read_collection_fn,
    write_collection_fn,
    peers_file,
    policies_file,
    identities_file,
):
    return crud_ops.delete_peer(
        name,
        read_policies_fn=lambda: read_collection_fn(policies_file),
        read_peers_fn=lambda: read_collection_fn(peers_file),
        write_peers_fn=lambda items: write_collection_fn(peers_file, items),
        read_identities_fn=lambda: read_collection_fn(identities_file),
        write_identities_fn=lambda items: write_collection_fn(identities_file, items),
    )


def delete_policy_service(name, *, read_collection_fn, write_collection_fn, policies_file):
    return crud_ops.delete_policy(
        name,
        read_policies_fn=lambda: read_collection_fn(policies_file),
        write_policies_fn=lambda items: write_collection_fn(policies_file, items),
    )


def log_event_service(event_type, payload, *, append_event_fn, events_file):
    runtime_ops.log_event(
        event_type,
        payload,
        append_event_fn=lambda current_event, current_payload, limit: append_event_fn(
            events_file,
            current_event,
            current_payload,
            limit=limit,
        ),
    )


def list_events_service(*, list_events_fn, events_file):
    return runtime_ops.list_events(
        list_events_fn=lambda: list_events_fn(events_file),
    )


def _collect_runtime_refs(
    *,
    read_collection_fn,
    peers_file,
    identities_file,
    phase1_profiles_file,
    phase2_proposals_file,
    policies_file,
):
    return runtime_ops.collect_refs(
        list_peers_fn=lambda: list_peers_service(
            read_collection_fn=read_collection_fn,
            peers_file=peers_file,
        ),
        read_identities_fn=lambda: read_collection_fn(identities_file),
        list_phase1_profiles_fn=lambda: list_phase1_profiles_service(
            read_collection_fn=read_collection_fn,
            phase1_profiles_file=phase1_profiles_file,
        ),
        list_phase2_proposals_fn=lambda: list_phase2_proposals_service(
            read_collection_fn=read_collection_fn,
            phase2_proposals_file=phase2_proposals_file,
        ),
        list_policies_fn=lambda: list_policies_service(
            read_collection_fn=read_collection_fn,
            policies_file=policies_file,
        ),
    )


def list_active_peers_service():
    return runtime_ops.list_active_peers()


def list_installed_sas_service():
    return runtime_ops.list_installed_sas()


def load_peer_service(
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
    return runtime_ops.load_peer(
        peer_name,
        collect_refs_fn=lambda: _collect_runtime_refs(
            read_collection_fn=read_collection_fn,
            peers_file=peers_file,
            identities_file=identities_file,
            phase1_profiles_file=phase1_profiles_file,
            phase2_proposals_file=phase2_proposals_file,
            policies_file=policies_file,
        ),
        build_connection_fn=runtime_ops.build_vici_connection_for_peer,
        build_secret_fn=lambda peer, identity: runtime_ops.build_vici_secret_for_peer(
            peer,
            identity,
            secret_decrypt_fn=secret_decrypt_fn,
        ),
        log_event_fn=log_event_fn,
    )


def initiate_policy_service(policy_name, *, read_collection_fn, policies_file, log_event_fn):
    return runtime_ops.initiate_policy(
        policy_name,
        list_policies_fn=lambda: list_policies_service(
            read_collection_fn=read_collection_fn,
            policies_file=policies_file,
        ),
        log_event_fn=log_event_fn,
    )


def terminate_peer_service(peer_name, *, log_event_fn):
    return runtime_ops.terminate_peer(
        peer_name,
        log_event_fn=log_event_fn,
    )


def apply_config_service(
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
    return runtime_ops.apply_config(
        collect_refs_fn=lambda: _collect_runtime_refs(
            read_collection_fn=read_collection_fn,
            peers_file=peers_file,
            identities_file=identities_file,
            phase1_profiles_file=phase1_profiles_file,
            phase2_proposals_file=phase2_proposals_file,
            policies_file=policies_file,
        ),
        build_connection_fn=runtime_ops.build_vici_connection_for_peer,
        build_secret_fn=lambda peer, identity: runtime_ops.build_vici_secret_for_peer(
            peer,
            identity,
            secret_decrypt_fn=secret_decrypt_fn,
        ),
        log_event_fn=log_event_fn,
    )
