#!/usr/bin/python3


def add_wg_int(
    *,
    input_fn,
    prompt_awg_version_fn,
    run_check_output_fn,
    prepare_awg_params_for_version_fn,
    prompt_version_2_signature_params_fn,
    insert_interface_row_fn,
    commit_fn,
    print_fn,
    run_command_fn,
    build_awg_set_command_fn,
    write_key_file_fn,
    sqlite_error_type,
    called_process_error_type,
):
    wg_interface = input_fn("Введите wg_interface: ")
    awg_version = prompt_awg_version_fn("2")
    if awg_version is None:
        return
    port_number = input_fn("Введите port_number: ")
    wg_ip_addr = input_fn("Введите wg_ip_addr: ")
    wg_ip_cidr = input_fn("Введите wg_ip_cidr: ")
    srv_ip = input_fn("Введите srv_ip: ")
    srv_dns = input_fn("Введите srv_dns: ")

    generate_keys = input_fn("Сгенерировать автоматически-(pub_key|pri_key) yes/no: ")
    if generate_keys.lower() == "yes":
        priv_key = run_check_output_fn(["awg", "genkey"]).strip().decode("utf-8")
        pub_key = run_check_output_fn(["awg", "pubkey"], input=priv_key.encode("utf-8")).strip().decode("utf-8")
    else:
        priv_key = input_fn("Введите приватный ключ: ")
        pub_key = input_fn("Введите публичный ключ: ")

    awg_params = prepare_awg_params_for_version_fn(awg_version)
    if awg_version == "2":
        awg_params = prompt_version_2_signature_params_fn(awg_params)

    try:
        insert_interface_row_fn(
            wg_interface,
            awg_version,
            port_number,
            wg_ip_addr,
            wg_ip_cidr,
            priv_key,
            pub_key,
            srv_ip,
            srv_dns,
            awg_params,
        )
        commit_fn()
        print_fn("Интерфейс успешно добавлен в базу данных")

        run_command_fn(["ip", "link", "add", wg_interface, "type", "amneziawg"])
        run_command_fn(["ip", "address", "add", f"{wg_ip_addr}/{wg_ip_cidr}", "dev", wg_interface])
        run_command_fn(["ip", "link", "set", "up", "dev", wg_interface])
        run_command_fn(["touch", "key_temp"])
        run_command_fn(["chmod", "600", "key_temp"])
        write_key_file_fn("key_temp", priv_key)
        run_command_fn(build_awg_set_command_fn(wg_interface, port_number, "key_temp", awg_version, awg_params))
        print_fn("WireGuard интерфейс настроен успешно")
    except sqlite_error_type as e:
        print_fn(f"Ошибка записи в базу данных: {e}")
    except called_process_error_type as e:
        print_fn(f"Ошибка настройки интерфейса WireGuard: {e}")


def del_wg_int(
    *,
    list_wg_int_fn,
    input_fn,
    fetch_interface_by_id_fn,
    run_command_fn,
    delete_interface_row_by_name_fn,
    commit_fn,
    print_fn,
):
    list_wg_int_fn()
    wg_id = input_fn("Введите id интерфейса: ")
    row = fetch_interface_by_id_fn(wg_id)
    if not row:
        print_fn(f"Ошибка: {wg_id}")
        return
    wg_interface = row[1]
    run_command_fn(["ip", "link", "set", "down", "dev", wg_interface])
    run_command_fn(["ip", "link", "del", wg_interface, "type", "amneziawg"])
    delete_interface_row_by_name_fn(wg_interface)
    commit_fn()


def update_interface(
    *,
    list_wg_int_fn,
    print_fn,
    input_fn,
    fetch_interface_by_name_fn,
    detect_awg_version_fn,
    build_awg_params_from_row_fn,
    prompt_awg_version_fn,
    prepare_awg_params_for_version_fn,
    prompt_version_2_signature_params_fn,
    run_command_fn,
    update_interface_row_fn,
    commit_fn,
    build_awg_set_command_fn,
    write_key_file_fn,
):
    list_wg_int_fn()
    print_fn("wg_interface - название интерфейса WireGuard, который нужно обновить.")
    print_fn("port_number - номер порта, который используется на сервере для подключения к этому интерфейсу.")
    print_fn("wg_ip_addr - IP-адрес, который нужно назначить для этого интерфейса.")
    print_fn("wg_ip_cidr - длина префикса подсети, которую нужно назначить для этого интерфейса в формате /XX.")
    print_fn("srv_ip - это публичный IP-адрес сервера Wireguard, на котором запущен VPN-сервер.")
    print_fn("srv_dns - это список DNS-серверов, которые будут доступны для клиентов Wireguard.")

    wg_interface = input_fn("Введите wg_interface: ")
    current_row = fetch_interface_by_name_fn(wg_interface)
    if not current_row:
        print_fn(f"Ошибка: интерфейс {wg_interface} не найден")
        return

    (
        _id,
        _wg_interface,
        current_version,
        current_port_number,
        current_wg_ip_addr,
        current_wg_ip_cidr,
        _private_key,
        _pubkey,
        current_srv_ip,
        current_srv_dns,
        *_rest,
    ) = current_row

    awg_version = prompt_awg_version_fn(
        detect_awg_version_fn(current_version, build_awg_params_from_row_fn(current_row))
    )
    if awg_version is None:
        return

    port_number = input_fn(f"Введите port_number [{current_port_number}]: ").strip() or str(current_port_number)
    wg_ip_addr = input_fn(f"Введите wg_ip_addr [{current_wg_ip_addr}]: ").strip() or str(current_wg_ip_addr)
    wg_ip_cidr = input_fn(f"Введите wg_ip_cidr [{current_wg_ip_cidr}]: ").strip() or str(current_wg_ip_cidr)
    srv_ip = input_fn(f"Введите srv_ip [{current_srv_ip}]: ").strip() or str(current_srv_ip)
    srv_dns = input_fn(f"Введите srv_dns [{current_srv_dns}]: ").strip() or str(current_srv_dns)
    pubkey = input_fn("Введите pub_key: ")
    private_key = input_fn("Введите pri_key: ")

    awg_params = prepare_awg_params_for_version_fn(awg_version)
    if awg_version == "2":
        awg_params = prompt_version_2_signature_params_fn(awg_params)

    run_command_fn(["ip", "link", "set", "down", "dev", wg_interface])
    run_command_fn(["ip", "link", "del", wg_interface, "type", "amneziawg"])

    update_interface_row_fn(
        awg_version,
        wg_ip_addr,
        wg_ip_cidr,
        port_number,
        private_key,
        pubkey,
        srv_ip,
        str(srv_dns),
        awg_params,
        wg_interface,
    )
    commit_fn()

    run_command_fn(["ip", "link", "add", wg_interface, "type", "amneziawg"])
    run_command_fn(["ip", "address", "add", str(wg_ip_addr) + "/" + str(wg_ip_cidr), "dev", wg_interface])
    run_command_fn(["ip", "link", "set", "up", "dev", wg_interface])
    run_command_fn(["touch", "key_temp"])
    run_command_fn(["chmod", "600", "key_temp"])
    write_key_file_fn("key_temp", private_key)
    run_command_fn(build_awg_set_command_fn(wg_interface, port_number, "key_temp", awg_version, awg_params))
    run_command_fn(["rm", "key_temp"])
