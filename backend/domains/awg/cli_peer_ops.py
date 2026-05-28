#!/usr/bin/python3


def update_peer(
    *,
    list_clients_fn,
    input_fn,
    fetch_client_pubkey_by_id_fn,
    del_peer_fn,
    update_client_row_fn,
    encrypt_private_key_fn,
    commit_fn,
    add_peer_fn,
    print_fn,
):
    list_clients_fn()
    print_fn("id - идентификатор клиента, который нужно обновить")
    print_fn("name - новое имя клиента")
    print_fn("pubkey - новый публичный ключ клиента")
    print_fn("privkey - новый приватный ключ клиента")
    print_fn("ip - новый IP-адрес клиента")
    print_fn("wg_interface - идентификатор интерфейса WireGuard, через который клиент подключается к серверу")
    client_id = input_fn("Введите id: ")
    name = input_fn("Введите name: ")
    pubkey = input_fn("Введите pubkey: ")
    privkey = input_fn("Введите privkey: ")
    ip = input_fn("Введите ip: ")
    wg_interface = input_fn("Введите wg_interface: ")

    old_pubkey_row = fetch_client_pubkey_by_id_fn(client_id)
    if not old_pubkey_row:
        print_fn(f"Ошибка: клиент с id {client_id} не найден")
        return
    del_peer_fn(wg_interface, old_pubkey_row[0])

    update_client_row_fn(
        name,
        pubkey,
        encrypt_private_key_fn(privkey),
        ip,
        wg_interface,
        client_id,
    )
    commit_fn()
    add_peer_fn(wg_interface, pubkey, ip)
