#!/usr/bin/python3


def client_qrencode(
    *,
    list_clients_fn,
    input_fn,
    fetch_client_by_id_fn,
    fetch_interface_by_name_fn,
    build_awg_params_from_row_fn,
    build_client_config_lines_fn,
    decrypt_private_key_fn,
    render_qr_in_terminal_fn,
    print_fn,
):
    list_clients_fn()
    client_id = input_fn("Введите id клиента: ")

    row = fetch_client_by_id_fn(client_id)
    if not row:
        print_fn(f"Ошибка: клиент {client_id} не найден")
        return

    _id, _name, _client_pubkey, client_privkey, ip, wg_interface = row
    interface_row = fetch_interface_by_name_fn(wg_interface)
    if not interface_row:
        print_fn(f"Ошибка: {wg_interface}")
        return

    (
        _iid,
        _iwg_interface,
        awg_version,
        port_number,
        _wg_ip_addr,
        _wg_ip_cidr,
        _private_key,
        pubkey,
        srv_ip,
        srv_dns,
        *_rest,
    ) = interface_row

    awg_params = build_awg_params_from_row_fn(interface_row)
    client_lines = build_client_config_lines_fn(
        str(decrypt_private_key_fn(client_privkey)),
        ip,
        srv_dns,
        awg_version,
        awg_params,
        pubkey,
        srv_ip,
        port_number,
    )
    client_config = "\n".join(client_lines) + "\n"

    print_fn(client_config)
    print_fn("QR code:")
    render_qr_in_terminal_fn(client_config)


def show_api_key_status(*, load_api_key_fn, api_key_env_var, api_key_file, print_fn):
    api_key = load_api_key_fn()
    if api_key is None:
        print_fn(f"API key не настроен. Можно задать через переменную окружения {api_key_env_var} или файл {api_key_file}")
    else:
        print_fn(f"API key настроен: {'*' * max(4, len(api_key) - 4)}{api_key[-4:]}")


def set_api_key(*, getpass_fn, save_api_key_fn, api_key_file, print_fn):
    api_key = getpass_fn("Введите API key: ").strip()
    if not api_key:
        print_fn("Ошибка: пустой API key")
        return
    save_api_key_fn(api_key)
    print_fn(f"API key сохранён в {api_key_file}")
