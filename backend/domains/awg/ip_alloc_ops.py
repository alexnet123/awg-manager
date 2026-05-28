#!/usr/bin/python3
import ipaddress


def get_next_available_ip(wg_interface, fetch_interface_subnet_fn, fetch_used_ips_fn, exclude_client_id=None):
    result = fetch_interface_subnet_fn(wg_interface)
    if not result:
        raise LookupError(f"Интерфейс {wg_interface} не найден в базе данных")

    wg_ip_addr, wg_ip_cidr = result
    network = ipaddress.ip_network(f"{wg_ip_addr}/{wg_ip_cidr}", strict=False)

    used_rows = fetch_used_ips_fn(wg_interface, exclude_client_id)
    used_ips = [ipaddress.ip_address(row[0]) for row in used_rows]
    used_ips.append(ipaddress.ip_address(wg_ip_addr))

    for ip in network.hosts():
        if ip not in used_ips:
            return str(ip)

    raise ValueError("Нет доступных IP-адресов для назначения")


def validate_client_ip_for_interface(client_ip, wg_interface, fetch_interface_subnet_fn, has_ip_conflict_fn, exclude_client_id=None):
    result = fetch_interface_subnet_fn(wg_interface)
    if not result:
        raise LookupError("Interface not found")

    wg_ip_addr, wg_ip_cidr = result
    network = ipaddress.ip_network(f"{wg_ip_addr}/{wg_ip_cidr}", strict=False)
    try:
        client_addr = ipaddress.ip_address(client_ip)
    except ValueError:
        raise ValueError("Invalid client IP")

    if client_addr not in network:
        raise ValueError(f"Client IP {client_ip} is outside interface subnet {network}")
    if client_addr == ipaddress.ip_address(wg_ip_addr):
        raise ValueError("Client IP conflicts with interface IP")

    if has_ip_conflict_fn(wg_interface, client_ip, exclude_client_id):
        raise ValueError(f"Client IP {client_ip} is already used on interface {wg_interface}")
