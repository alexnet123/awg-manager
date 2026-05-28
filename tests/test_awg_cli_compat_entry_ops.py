import unittest

from backend.domains.awg import cli_compat_entry_ops
from backend.domains.awg import cli_legacy_service_ops
from backend.domains.awg import cli_read_ops
from backend.domains.awg import cli_service_ops
from backend.domains.awg import cli_support_ops


class InterfacesClientsCliCompatEntryOpsTest(unittest.TestCase):
    def test_legacy_and_read_delegation(self):
        calls = []
        originals = (
            cli_legacy_service_ops.add_client,
            cli_legacy_service_ops.delete_client,
            cli_legacy_service_ops.sync,
            cli_read_ops.list_clients,
            cli_read_ops.list_wg_int,
            cli_read_ops.list_wg_int_clients,
            cli_read_ops.client_qrencode,
        )
        try:
            cli_legacy_service_ops.add_client = lambda **kwargs: (calls.append(("add_client", kwargs)), "ok-add")[1]
            cli_legacy_service_ops.delete_client = lambda **kwargs: (calls.append(("delete_client", kwargs)), "ok-del")[1]
            cli_legacy_service_ops.sync = lambda _type, **kwargs: (calls.append(("sync", _type, kwargs)), "ok-sync")[1]
            cli_read_ops.list_clients = lambda **kwargs: (calls.append(("list_clients", kwargs)), ["alice"])[1]
            cli_read_ops.list_wg_int = lambda **kwargs: (calls.append(("list_wg_int", kwargs)), ["awg0"])[1]
            cli_read_ops.list_wg_int_clients = lambda **kwargs: (calls.append(("list_wg_int_clients", kwargs)), ["awg0:alice"])[1]
            cli_read_ops.client_qrencode = lambda **kwargs: (calls.append(("client_qrencode", kwargs)), "qr-ok")[1]

            self.assertEqual(
                cli_compat_entry_ops.add_client(
                    cursor=object(),
                    conn=object(),
                    input_fn=object(),
                    get_next_available_ip_fn=object(),
                    run_check_output_fn=object(),
                    encrypt_private_key_fn=object(),
                    run_command_fn=object(),
                    print_fn=object(),
                    sqlite_error_type=Exception,
                    called_process_error_type=Exception,
                ),
                "ok-add",
            )
            self.assertEqual(
                cli_compat_entry_ops.delete_client(
                    cursor=object(),
                    conn=object(),
                    list_clients_fn=object(),
                    input_fn=object(),
                    run_command_fn=object(),
                    del_peer_fn=object(),
                    print_fn=object(),
                ),
                "ok-del",
            )
            self.assertEqual(
                cli_compat_entry_ops.list_clients(
                    cursor=object(),
                    decrypt_private_key_fn=object(),
                    print_fn=object(),
                ),
                ["alice"],
            )
            self.assertEqual(
                cli_compat_entry_ops.list_wg_int(
                    cursor=object(),
                    wg_interface_columns="id,wg_interface",
                    build_awg_params_from_row_fn=object(),
                    detect_awg_version_fn=object(),
                    format_awg_params_for_display_fn=object(),
                    print_fn=object(),
                ),
                ["awg0"],
            )
            self.assertEqual(
                cli_compat_entry_ops.list_wg_int_clients(
                    cursor=object(),
                    wg_interface_columns="id,wg_interface",
                    build_awg_params_from_row_fn=object(),
                    detect_awg_version_fn=object(),
                    format_awg_params_for_display_fn=object(),
                    decrypt_private_key_fn=object(),
                    print_fn=object(),
                ),
                ["awg0:alice"],
            )
            self.assertEqual(
                cli_compat_entry_ops.client_qrencode(
                    cursor=object(),
                    wg_interface_columns="id,wg_interface",
                    list_clients_fn=object(),
                    input_fn=object(),
                    build_awg_params_from_row_fn=object(),
                    build_client_config_lines_fn=object(),
                    decrypt_private_key_fn=object(),
                    render_qr_in_terminal_fn=object(),
                    print_fn=object(),
                ),
                "qr-ok",
            )
            self.assertEqual(
                cli_compat_entry_ops.sync(
                    "all",
                    cursor=object(),
                    wg_interface_columns="id,wg_interface",
                    run_check_output_fn=object(),
                    run_command_fn=object(),
                    build_awg_set_command_fn=object(),
                    write_key_file_fn=object(),
                    apply_firewall_rules_fn=object(),
                    print_fn=object(),
                    called_process_error_type=Exception,
                    devnull=object(),
                    pipe=object(),
                ),
                "ok-sync",
            )
            self.assertEqual(calls[0][0], "add_client")
            self.assertEqual(calls[-1][0], "sync")
        finally:
            (
                cli_legacy_service_ops.add_client,
                cli_legacy_service_ops.delete_client,
                cli_legacy_service_ops.sync,
                cli_read_ops.list_clients,
                cli_read_ops.list_wg_int,
                cli_read_ops.list_wg_int_clients,
                cli_read_ops.client_qrencode,
            ) = originals

    def test_support_delegation(self):
        calls = []
        originals = (
            cli_support_ops.show_api_key_status,
            cli_support_ops.set_api_key,
            cli_support_ops.wg_lease_ip,
            cli_support_ops.add_peer,
            cli_support_ops.del_peer,
        )
        try:
            cli_support_ops.show_api_key_status = lambda **kwargs: (calls.append(("status", kwargs)), "status-ok")[1]
            cli_support_ops.set_api_key = lambda **kwargs: (calls.append(("set", kwargs)), "set-ok")[1]
            cli_support_ops.wg_lease_ip = lambda wg_int, **kwargs: (calls.append(("lease", wg_int, kwargs)), ["10.8.0.2"])[1]
            cli_support_ops.add_peer = lambda iface, pub, ip, **kwargs: (
                calls.append(("add_peer", iface, pub, ip, kwargs)),
                True,
            )[1]
            cli_support_ops.del_peer = lambda iface, pub, **kwargs: (
                calls.append(("del_peer", iface, pub, kwargs)),
                True,
            )[1]

            self.assertEqual(
                cli_compat_entry_ops.show_api_key_status(
                    load_api_key_fn=object(),
                    api_key_env_var="X",
                    api_key_file="/tmp/key",
                    print_fn=object(),
                ),
                "status-ok",
            )
            self.assertEqual(
                cli_compat_entry_ops.set_api_key(
                    getpass_fn=object(),
                    save_api_key_fn=object(),
                    api_key_file="/tmp/key",
                    print_fn=object(),
                ),
                "set-ok",
            )
            self.assertEqual(
                cli_compat_entry_ops.wg_lease_ip("awg0", run_check_output_fn=object()),
                ["10.8.0.2"],
            )
            self.assertTrue(
                cli_compat_entry_ops.add_peer(
                    "awg0",
                    "pubkey",
                    "10.8.0.2/32",
                    run_command_fn=object(),
                    print_fn=object(),
                    called_process_error_type=Exception,
                )
            )
            self.assertTrue(
                cli_compat_entry_ops.del_peer(
                    "awg0",
                    "pubkey",
                    run_command_fn=object(),
                    print_fn=object(),
                    called_process_error_type=Exception,
                )
            )
            self.assertEqual(calls[0][0], "status")
            self.assertEqual(calls[-1][0], "del_peer")
        finally:
            (
                cli_support_ops.show_api_key_status,
                cli_support_ops.set_api_key,
                cli_support_ops.wg_lease_ip,
                cli_support_ops.add_peer,
                cli_support_ops.del_peer,
            ) = originals

    def test_service_delegation(self):
        calls = []
        originals = (
            cli_service_ops.add_wg_int,
            cli_service_ops.del_wg_int,
            cli_service_ops.update_interface,
            cli_service_ops.update_peer,
        )
        try:
            cli_service_ops.add_wg_int = lambda **kwargs: (calls.append(("add_wg_int", kwargs)), "add-if")[1]
            cli_service_ops.del_wg_int = lambda **kwargs: (calls.append(("del_wg_int", kwargs)), "del-if")[1]
            cli_service_ops.update_interface = lambda **kwargs: (calls.append(("update_interface", kwargs)), "upd-if")[1]
            cli_service_ops.update_peer = lambda **kwargs: (calls.append(("update_peer", kwargs)), "upd-peer")[1]

            self.assertEqual(
                cli_compat_entry_ops.add_wg_int(
                    cursor=object(),
                    conn=object(),
                    input_fn=object(),
                    prompt_awg_version_fn=object(),
                    run_check_output_fn=object(),
                    prepare_awg_params_for_version_fn=object(),
                    prompt_version_2_signature_params_fn=object(),
                    print_fn=object(),
                    run_command_fn=object(),
                    build_awg_set_command_fn=object(),
                    write_key_file_fn=object(),
                    sqlite_error_type=Exception,
                    called_process_error_type=Exception,
                ),
                "add-if",
            )
            self.assertEqual(
                cli_compat_entry_ops.del_wg_int(
                    cursor=object(),
                    conn=object(),
                    wg_interface_columns="id,wg_interface",
                    list_wg_int_fn=object(),
                    input_fn=object(),
                    run_command_fn=object(),
                    print_fn=object(),
                ),
                "del-if",
            )
            self.assertEqual(
                cli_compat_entry_ops.update_interface(
                    cursor=object(),
                    conn=object(),
                    wg_interface_columns="id,wg_interface",
                    list_wg_int_fn=object(),
                    print_fn=object(),
                    input_fn=object(),
                    detect_awg_version_fn=object(),
                    build_awg_params_from_row_fn=object(),
                    prompt_awg_version_fn=object(),
                    prepare_awg_params_for_version_fn=object(),
                    prompt_version_2_signature_params_fn=object(),
                    run_command_fn=object(),
                    build_awg_set_command_fn=object(),
                    write_key_file_fn=object(),
                ),
                "upd-if",
            )
            self.assertEqual(
                cli_compat_entry_ops.update_peer(
                    cursor=object(),
                    conn=object(),
                    list_clients_fn=object(),
                    input_fn=object(),
                    del_peer_fn=object(),
                    encrypt_private_key_fn=object(),
                    add_peer_fn=object(),
                    print_fn=object(),
                ),
                "upd-peer",
            )
            self.assertEqual(calls[0][0], "add_wg_int")
            self.assertEqual(calls[-1][0], "update_peer")
        finally:
            (
                cli_service_ops.add_wg_int,
                cli_service_ops.del_wg_int,
                cli_service_ops.update_interface,
                cli_service_ops.update_peer,
            ) = originals


if __name__ == "__main__":
    unittest.main()
