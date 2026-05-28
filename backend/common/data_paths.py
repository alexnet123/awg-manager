#!/usr/bin/python3
import os


DATA_DIR_ENV_VAR = 'AWG_MANAGER_DATA_DIR'
DEFAULT_DATA_DIR = '/etc/wg-manager'
API_KEY_ENV_VAR = 'AWG_MANAGER_API_KEY'


def resolve_data_dir(env=None):
    source_env = os.environ if env is None else env
    raw_data_dir = str(source_env.get(DATA_DIR_ENV_VAR, '') or '').strip()
    return os.path.abspath(raw_data_dir or DEFAULT_DATA_DIR)


def build_state_paths(base_dir):
    bd_path = os.path.abspath(base_dir)
    return {
        'api_key_file': os.path.join(bd_path, 'api.key'),
        'firewall_rules_file': os.path.join(bd_path, 'firewall_rules.json'),
        'firewall_sets_file': os.path.join(bd_path, 'firewall_sets.json'),
        'firewall_maps_file': os.path.join(bd_path, 'firewall_maps.json'),
        'firewall_tables_file': os.path.join(bd_path, 'firewall_tables.json'),
        'firewall_objects_file': os.path.join(bd_path, 'firewall_objects.json'),
        'firewall_managed_tables_file': os.path.join(bd_path, 'firewall_managed_tables.json'),
        'firewall_stats_file': os.path.join(bd_path, 'firewall_stats.json'),
        'ipsec_peers_file': os.path.join(bd_path, 'ipsec_peers.json'),
        'ipsec_identities_file': os.path.join(bd_path, 'ipsec_identities.json'),
        'ipsec_phase1_profiles_file': os.path.join(bd_path, 'ipsec_phase1_profiles.json'),
        'ipsec_phase2_proposals_file': os.path.join(bd_path, 'ipsec_phase2_proposals.json'),
        'ipsec_policies_file': os.path.join(bd_path, 'ipsec_policies.json'),
        'ipsec_events_file': os.path.join(bd_path, 'ipsec_events.json'),
        'db_file': os.path.join(bd_path, 'clients.db'),
    }

