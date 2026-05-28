#!/usr/bin/python3


SEPARATOR = "============================================================================================================================"
CLIENT_SEPARATOR = "    |-----------------------------------------------------------------------------------------------------------------------"


def list_clients(*, fetch_clients_fn, decrypt_private_key_fn, print_fn):
    print_fn("Список клиентов:")
    for row in fetch_clients_fn():
        client_id, name, pubkey, privkey, ip, wg_interface = row
        print_fn(SEPARATOR)
        print_fn(f"{client_id} - {name}: {ip} ({pubkey}) ({decrypt_private_key_fn(privkey)}) {wg_interface}")
        print_fn(SEPARATOR)


def list_wg_int(
    *,
    fetch_interfaces_fn,
    build_awg_params_from_row_fn,
    detect_awg_version_fn,
    format_awg_params_for_display_fn,
    print_fn,
):
    print_fn("Список интерфейсов:")
    for row in fetch_interfaces_fn():
        (
            interface_id,
            wg_interface,
            awg_version,
            port_number,
            wg_ip_addr,
            wg_ip_cidr,
            private_key,
            pubkey,
            srv_ip,
            srv_dns,
            *_rest,
        ) = row
        awg_params = build_awg_params_from_row_fn(row)
        awg_version = detect_awg_version_fn(awg_version, awg_params)
        print_fn(SEPARATOR)
        print_fn(f"ID: {interface_id}, Interface: {wg_interface}, AWG version: {awg_version}")
        print_fn(f"IP-address: {wg_ip_addr}/{wg_ip_cidr}, Порт: {port_number}")
        print_fn(f"Public key: {pubkey}, Private Key: {private_key}")
        print_fn(f"Public ip: {srv_ip}, DNS: {srv_dns}")
        for param_line in format_awg_params_for_display_fn(awg_version, awg_params):
            print_fn(param_line)
        print_fn(SEPARATOR)


def list_wg_int_clients(
    *,
    fetch_interfaces_fn,
    build_awg_params_from_row_fn,
    detect_awg_version_fn,
    format_awg_params_for_display_fn,
    fetch_clients_for_interface_fn,
    decrypt_private_key_fn,
    print_fn,
):
    print_fn("Список интерфейсов:")
    for row in fetch_interfaces_fn():
        (
            interface_id,
            wg_interface,
            awg_version,
            port_number,
            wg_ip_addr,
            wg_ip_cidr,
            private_key,
            pubkey,
            srv_ip,
            srv_dns,
            *_rest,
        ) = row
        awg_params = build_awg_params_from_row_fn(row)
        awg_version = detect_awg_version_fn(awg_version, awg_params)
        print_fn(SEPARATOR)
        print_fn(f"ID: {interface_id}, Interface: {wg_interface}, AWG version: {awg_version}")
        print_fn(f"IP-address: {wg_ip_addr}/{wg_ip_cidr}, Порт: {port_number}")
        print_fn(f"Public key: {pubkey}, Private key: {private_key}")
        print_fn(f"Public ip: {srv_ip}, DNS: {srv_dns}")
        for param_line in format_awg_params_for_display_fn(awg_version, awg_params):
            print_fn(param_line)

        for client_row in fetch_clients_for_interface_fn(wg_interface):
            client_id, name, client_pubkey, client_privkey, ip, _client_wg_interface = client_row
            print_fn(CLIENT_SEPARATOR)
            print_fn(f"    | ID: {client_id} - {name}: IP-address: {ip}")
            print_fn(f"    | Public key: {client_pubkey}")
            print_fn(f"    | Private key: {decrypt_private_key_fn(client_privkey)}")
            print_fn(CLIENT_SEPARATOR)

        print_fn(SEPARATOR)
