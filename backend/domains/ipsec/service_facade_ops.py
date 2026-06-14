#!/usr/bin/python3
from backend.common import crypto_keys

from . import service_layer_ops
from . import store
from . import validation_ops


def _read_collection(path):
    return store.read_collection(path)


def _write_collection(path, items):
    store.write_collection(path, items)


def _valid_name(value, *, normalize_config_value_fn, field_name="name"):
    return validation_ops.valid_name(
        value,
        normalize_config_value_fn=normalize_config_value_fn,
        field_name=field_name,
    )


def _normalize_ip_list(value, *, normalize_config_value_fn, field_name):
    return validation_ops.normalize_ip_list(
        value,
        normalize_config_value_fn=normalize_config_value_fn,
        field_name=field_name,
    )


def _normalize_ts_list(value, *, normalize_config_value_fn, field_name):
    return validation_ops.normalize_ts_list(
        value,
        normalize_ip_list_fn=_build_normalize_ip_list_fn(
            normalize_config_value_fn=normalize_config_value_fn,
        ),
        field_name=field_name,
    )


def _build_phase1_proposal_string(enc, hash_alg, dh_group, prf_alg=None, *, normalize_config_value_fn):
    return validation_ops.build_phase1_proposal_string(
        enc,
        hash_alg,
        dh_group,
        prf_alg,
        valid_name_fn=lambda current_value, field_name: _valid_name(
            current_value,
            normalize_config_value_fn=normalize_config_value_fn,
            field_name=field_name,
        ),
    )


def _build_phase2_proposal_string(enc, auth_alg, pfs_group=None, esn=None, *, normalize_config_value_fn):
    return validation_ops.build_phase2_proposal_string(
        enc,
        auth_alg,
        pfs_group,
        esn,
        valid_name_fn=lambda current_value, field_name: _valid_name(
            current_value,
            normalize_config_value_fn=normalize_config_value_fn,
            field_name=field_name,
        ),
        normalize_config_value_fn=normalize_config_value_fn,
    )


def _secret_encrypt(value, *, encryption_key, fernet_encrypt_fn):
    encrypted = crypto_keys.encrypt_with_key(
        value,
        encryption_key,
        fernet_encrypt_fn,
    )
    return encrypted.decode("utf-8")


def _secret_decrypt(value, *, encryption_key, encryption_key_legacy, fernet_decrypt_fn):
    if value is None:
        return None
    return crypto_keys.decrypt_with_key_fallback(
        token=value,
        keys=(encryption_key, encryption_key_legacy),
        decrypt_fn=fernet_decrypt_fn,
        continue_exceptions=(Exception,),
    )


def _build_valid_name_fn(*, normalize_config_value_fn):
    def _valid_name_callback(current_value, field_name="name"):
        return _valid_name(
            current_value,
            normalize_config_value_fn=normalize_config_value_fn,
            field_name=field_name,
        )

    return _valid_name_callback


def _build_normalize_ip_list_fn(*, normalize_config_value_fn):
    def _normalize_ip_list_callback(value, field_name):
        return _normalize_ip_list(
            value,
            normalize_config_value_fn=normalize_config_value_fn,
            field_name=field_name,
        )

    return _normalize_ip_list_callback


def _build_normalize_ts_list_fn(*, normalize_config_value_fn):
    def _normalize_ts_list_callback(value, field_name):
        return _normalize_ts_list(
            value,
            normalize_config_value_fn=normalize_config_value_fn,
            field_name=field_name,
        )

    return _normalize_ts_list_callback


def _build_phase1_proposal_fn(*, normalize_config_value_fn):
    def _build_phase1_proposal(enc, hash_alg, dh_group, prf_alg=None):
        return _build_phase1_proposal_string(
            enc,
            hash_alg,
            dh_group,
            prf_alg,
            normalize_config_value_fn=normalize_config_value_fn,
        )

    return _build_phase1_proposal


def _build_phase2_proposal_fn(*, normalize_config_value_fn):
    def _build_phase2_proposal(enc, auth_alg, pfs_group=None, esn=None):
        return _build_phase2_proposal_string(
            enc,
            auth_alg,
            pfs_group,
            esn,
            normalize_config_value_fn=normalize_config_value_fn,
        )

    return _build_phase2_proposal


def _build_secret_encrypt_fn(*, encryption_key, fernet_encrypt_fn):
    def _secret_encrypt_callback(value):
        return _secret_encrypt(
            value,
            encryption_key=encryption_key,
            fernet_encrypt_fn=fernet_encrypt_fn,
        )

    return _secret_encrypt_callback


def _build_secret_decrypt_fn(*, encryption_key, encryption_key_legacy, fernet_decrypt_fn):
    def _secret_decrypt_callback(value):
        return _secret_decrypt(
            value,
            encryption_key=encryption_key,
            encryption_key_legacy=encryption_key_legacy,
            fernet_decrypt_fn=fernet_decrypt_fn,
        )

    return _secret_decrypt_callback


def list_peers_service(*, peers_file):
    return service_layer_ops.list_peers(
        read_collection_fn=_read_collection,
        peers_file=peers_file,
    )


def list_identities_service(*, identities_file):
    return service_layer_ops.list_identities(
        read_collection_fn=_read_collection,
        identities_file=identities_file,
    )


def list_phase1_profiles_service(*, phase1_profiles_file):
    return service_layer_ops.list_phase1_profiles(
        read_collection_fn=_read_collection,
        phase1_profiles_file=phase1_profiles_file,
    )


def list_phase2_proposals_service(*, phase2_proposals_file):
    return service_layer_ops.list_phase2_proposals(
        read_collection_fn=_read_collection,
        phase2_proposals_file=phase2_proposals_file,
    )


def list_policies_service(*, policies_file):
    return service_layer_ops.list_policies(
        read_collection_fn=_read_collection,
        policies_file=policies_file,
    )


def upsert_peer_service(
    payload,
    *,
    normalize_config_value_fn,
    peers_file,
    phase1_profiles_file,
    policies_file=None,
    identities_file=None,
):
    valid_name_fn = _build_valid_name_fn(normalize_config_value_fn=normalize_config_value_fn)
    normalize_ip_list_fn = _build_normalize_ip_list_fn(
        normalize_config_value_fn=normalize_config_value_fn,
    )
    return service_layer_ops.upsert_peer(
        payload,
        valid_name_fn=valid_name_fn,
        normalize_ip_list_fn=normalize_ip_list_fn,
        normalize_config_value_fn=normalize_config_value_fn,
        read_collection_fn=_read_collection,
        write_collection_fn=_write_collection,
        peers_file=peers_file,
        phase1_profiles_file=phase1_profiles_file,
        policies_file=policies_file,
        identities_file=identities_file,
    )


def upsert_identity_service(
    payload,
    *,
    normalize_config_value_fn,
    encryption_key,
    peers_file,
    identities_file,
    fernet_encrypt_fn,
):
    valid_name_fn = _build_valid_name_fn(normalize_config_value_fn=normalize_config_value_fn)
    secret_encrypt_fn = _build_secret_encrypt_fn(
        encryption_key=encryption_key,
        fernet_encrypt_fn=fernet_encrypt_fn,
    )
    return service_layer_ops.upsert_identity(
        payload,
        valid_name_fn=valid_name_fn,
        normalize_config_value_fn=normalize_config_value_fn,
        secret_encrypt_fn=secret_encrypt_fn,
        read_collection_fn=_read_collection,
        write_collection_fn=_write_collection,
        identities_file=identities_file,
        peers_file=peers_file,
    )


def upsert_phase1_profile_service(
    payload,
    *,
    normalize_config_value_fn,
    phase1_profiles_file,
    peers_file=None,
):
    valid_name_fn = _build_valid_name_fn(normalize_config_value_fn=normalize_config_value_fn)
    build_phase1_proposal_string_fn = _build_phase1_proposal_fn(
        normalize_config_value_fn=normalize_config_value_fn,
    )
    return service_layer_ops.upsert_phase1_profile(
        payload,
        valid_name_fn=valid_name_fn,
        normalize_config_value_fn=normalize_config_value_fn,
        build_phase1_proposal_string_fn=build_phase1_proposal_string_fn,
        read_collection_fn=_read_collection,
        write_collection_fn=_write_collection,
        phase1_profiles_file=phase1_profiles_file,
        peers_file=peers_file,
    )


def upsert_phase2_proposal_service(
    payload,
    *,
    normalize_config_value_fn,
    phase2_proposals_file,
    policies_file=None,
):
    valid_name_fn = _build_valid_name_fn(normalize_config_value_fn=normalize_config_value_fn)
    build_phase2_proposal_string_fn = _build_phase2_proposal_fn(
        normalize_config_value_fn=normalize_config_value_fn,
    )
    return service_layer_ops.upsert_phase2_proposal(
        payload,
        valid_name_fn=valid_name_fn,
        normalize_config_value_fn=normalize_config_value_fn,
        build_phase2_proposal_string_fn=build_phase2_proposal_string_fn,
        read_collection_fn=_read_collection,
        write_collection_fn=_write_collection,
        phase2_proposals_file=phase2_proposals_file,
        policies_file=policies_file,
    )


def upsert_policy_service(
    payload,
    *,
    normalize_config_value_fn,
    policies_file,
    peers_file,
    phase2_proposals_file,
):
    valid_name_fn = _build_valid_name_fn(normalize_config_value_fn=normalize_config_value_fn)
    normalize_ts_list_fn = _build_normalize_ts_list_fn(
        normalize_config_value_fn=normalize_config_value_fn,
    )
    return service_layer_ops.upsert_policy(
        payload,
        valid_name_fn=valid_name_fn,
        normalize_ts_list_fn=normalize_ts_list_fn,
        normalize_config_value_fn=normalize_config_value_fn,
        read_collection_fn=_read_collection,
        write_collection_fn=_write_collection,
        policies_file=policies_file,
        peers_file=peers_file,
        phase2_proposals_file=phase2_proposals_file,
    )


def delete_peer_service(name, *, peers_file, policies_file, identities_file):
    return service_layer_ops.delete_peer(
        name,
        read_collection_fn=_read_collection,
        write_collection_fn=_write_collection,
        peers_file=peers_file,
        policies_file=policies_file,
        identities_file=identities_file,
    )


def delete_policy_service(name, *, policies_file):
    return service_layer_ops.delete_policy(
        name,
        read_collection_fn=_read_collection,
        write_collection_fn=_write_collection,
        policies_file=policies_file,
    )


def delete_identity_service(name, *, identities_file):
    return service_layer_ops.delete_identity(
        name,
        read_collection_fn=_read_collection,
        write_collection_fn=_write_collection,
        identities_file=identities_file,
    )


def delete_phase1_profile_service(name, *, phase1_profiles_file, peers_file):
    return service_layer_ops.delete_phase1_profile(
        name,
        read_collection_fn=_read_collection,
        write_collection_fn=_write_collection,
        phase1_profiles_file=phase1_profiles_file,
        peers_file=peers_file,
    )


def delete_phase2_proposal_service(name, *, phase2_proposals_file, policies_file):
    return service_layer_ops.delete_phase2_proposal(
        name,
        read_collection_fn=_read_collection,
        write_collection_fn=_write_collection,
        phase2_proposals_file=phase2_proposals_file,
        policies_file=policies_file,
    )


def _log_ipsec_event(event_type, payload, *, events_file):
    service_layer_ops.log_event(
        event_type,
        payload,
        events_file=events_file,
    )


def _build_log_event_fn(*, events_file):
    def _log_event_callback(event_type, payload):
        _log_ipsec_event(
            event_type,
            payload,
            events_file=events_file,
        )

    return _log_event_callback


def list_events_service(*, events_file):
    return service_layer_ops.list_events(
        events_file=events_file,
    )


def list_active_peers_service():
    return service_layer_ops.list_active_peers()


def list_installed_sas_service():
    return service_layer_ops.list_installed_sas()


def get_config_preview_service(
    *,
    peers_file,
    identities_file,
    phase1_profiles_file,
    phase2_proposals_file,
    policies_file,
):
    return service_layer_ops.get_config_preview(
        read_collection_fn=_read_collection,
        peers_file=peers_file,
        identities_file=identities_file,
        phase1_profiles_file=phase1_profiles_file,
        phase2_proposals_file=phase2_proposals_file,
        policies_file=policies_file,
    )


def load_peer_service(
    peer_name,
    *,
    encryption_key,
    encryption_key_legacy,
    peers_file,
    identities_file,
    phase1_profiles_file,
    phase2_proposals_file,
    policies_file,
    events_file,
    fernet_decrypt_fn,
):
    secret_decrypt_fn = _build_secret_decrypt_fn(
        encryption_key=encryption_key,
        encryption_key_legacy=encryption_key_legacy,
        fernet_decrypt_fn=fernet_decrypt_fn,
    )
    log_event_fn = _build_log_event_fn(events_file=events_file)
    return service_layer_ops.load_peer(
        peer_name,
        read_collection_fn=_read_collection,
        peers_file=peers_file,
        identities_file=identities_file,
        phase1_profiles_file=phase1_profiles_file,
        phase2_proposals_file=phase2_proposals_file,
        policies_file=policies_file,
        secret_decrypt_fn=secret_decrypt_fn,
        log_event_fn=log_event_fn,
    )


def initiate_policy_service(policy_name, *, policies_file, events_file):
    log_event_fn = _build_log_event_fn(events_file=events_file)
    return service_layer_ops.initiate_policy(
        policy_name,
        read_collection_fn=_read_collection,
        policies_file=policies_file,
        log_event_fn=log_event_fn,
    )


def terminate_peer_service(peer_name, *, events_file):
    log_event_fn = _build_log_event_fn(events_file=events_file)
    return service_layer_ops.terminate_peer(
        peer_name,
        log_event_fn=log_event_fn,
    )


def apply_config_service(
    *,
    encryption_key,
    encryption_key_legacy,
    peers_file,
    identities_file,
    phase1_profiles_file,
    phase2_proposals_file,
    policies_file,
    events_file,
    fernet_decrypt_fn,
):
    secret_decrypt_fn = _build_secret_decrypt_fn(
        encryption_key=encryption_key,
        encryption_key_legacy=encryption_key_legacy,
        fernet_decrypt_fn=fernet_decrypt_fn,
    )
    log_event_fn = _build_log_event_fn(events_file=events_file)
    return service_layer_ops.apply_config(
        read_collection_fn=_read_collection,
        peers_file=peers_file,
        identities_file=identities_file,
        phase1_profiles_file=phase1_profiles_file,
        phase2_proposals_file=phase2_proposals_file,
        policies_file=policies_file,
        secret_decrypt_fn=secret_decrypt_fn,
        log_event_fn=log_event_fn,
    )
