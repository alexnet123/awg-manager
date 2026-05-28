#!/usr/bin/python3
import ipaddress
import re


def parse_and_validate_interface_network(wg_ip_addr, wg_ip_cidr):
    try:
        cidr_int = int(str(wg_ip_cidr))
    except (TypeError, ValueError):
        raise ValueError("CIDR must be an integer")
    if cidr_int < 1 or cidr_int > 32:
        raise ValueError("CIDR must be in range 1..32")
    try:
        network = ipaddress.ip_network(f"{wg_ip_addr}/{cidr_int}", strict=False)
    except ValueError:
        raise ValueError("Invalid interface IP/CIDR")
    return cidr_int, str(network)


def parse_and_validate_port(port_number):
    try:
        port_int = int(str(port_number))
    except (TypeError, ValueError):
        raise ValueError("Port must be an integer")
    if port_int < 1 or port_int > 65535:
        raise ValueError("Port must be in range 1..65535")
    return port_int


def validate_ip_literal(value, field_name):
    try:
        ipaddress.ip_address(str(value))
    except ValueError:
        raise ValueError(f"Invalid {field_name}")


def validate_interface_name(wg_interface):
    # Linux interface name (IFNAMSIZ-1) is up to 15 chars.
    if len(wg_interface) > 15:
        raise ValueError("Interface name must be 15 characters or fewer")
    if not re.fullmatch(r"[A-Za-z0-9_.-]+", wg_interface):
        raise ValueError("Interface name contains unsupported characters")


def assert_interface_uniqueness(
    wg_interface,
    port_number,
    network_cidr,
    *,
    parse_network_fn,
    has_interface_name_conflict_fn,
    has_port_conflict_fn,
    fetch_all_interface_network_rows_fn,
    exclude_id=None,
):
    if has_interface_name_conflict_fn(wg_interface, exclude_id):
        raise ValueError(f'Interface "{wg_interface}" already exists')
    if has_port_conflict_fn(port_number, exclude_id):
        raise ValueError(f"Port {port_number} is already used by another interface")

    rows = fetch_all_interface_network_rows_fn(exclude_id)
    for row_ip, row_cidr in rows:
        try:
            _, row_network = parse_network_fn(row_ip, row_cidr)
        except ValueError:
            # Skip legacy invalid rows; they should be fixed separately.
            continue
        if row_network == network_cidr:
            raise ValueError(f"Subnet {network_cidr} is already used by another interface")
