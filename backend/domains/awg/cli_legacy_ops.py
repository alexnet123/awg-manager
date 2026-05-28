#!/usr/bin/python3


def add_client(
    *,
    input_fn,
    get_next_available_ip_fn,
    run_check_output_fn,
    encrypt_private_key_fn,
    insert_client_row_fn,
    commit_fn,
    run_command_fn,
    print_fn,
    sqlite_error_type,
    called_process_error_type,
):
    name = input_fn("Введите имя клиента: ")
    wg_interface = input_fn("Введите интерфейс WireGuard: ")

    try:
        client_ip = get_next_available_ip_fn(wg_interface)
        print_fn(f"Назначен IP-адрес {client_ip} для клиента {name}")
    except Exception as exc:
        print_fn(f"Ошибка при назначении IP-адреса: {exc}")
        return

    generate_keys = input_fn("Сгенерировать автоматически-(pub_key|pri_key) yes/no: ")
    if str(generate_keys).lower() == "yes":
        priv_key = run_check_output_fn(["awg", "genkey"]).strip().decode("utf-8")
        pub_key = run_check_output_fn(["awg", "pubkey"], input=priv_key.encode("utf-8")).strip().decode("utf-8")
    else:
        priv_key = input_fn("Введите приватный ключ: ")
        pub_key = input_fn("Введите публичный ключ: ")

    try:
        encrypted_priv_key = encrypt_private_key_fn(priv_key)
        insert_client_row_fn(name, pub_key, encrypted_priv_key, client_ip, wg_interface)
        commit_fn()
        print_fn(f"Клиент {name} успешно добавлен в базу данных с IP-адресом {client_ip}")
        run_command_fn(["awg", "set", wg_interface, "peer", pub_key, "allowed-ips", client_ip + "/32"])
        print_fn(f"Клиент {name} успешно добавлен в конфигурацию WireGuard")
    except sqlite_error_type as exc:
        print_fn(f"Ошибка записи в базу данных: {exc}")
    except called_process_error_type as exc:
        print_fn(f"Ошибка добавления клиента в WireGuard: {exc}")


def delete_client(
    *,
    list_clients_fn,
    input_fn,
    fetch_client_by_id_fn,
    run_command_fn,
    delete_client_row_fn,
    commit_fn,
    del_peer_fn,
    print_fn,
):
    list_clients_fn()
    client_id = input_fn("Введите id клиента для удаления: ")
    row = fetch_client_by_id_fn(client_id)
    if not row:
        print_fn(f"Ошибка: клиент c id {client_id} не найден")
        return

    row_id, name, pubkey, _privkey, _ip, wg_interface = row
    run_command_fn(["awg", "set", wg_interface, "peer", pubkey, "remove"])
    delete_client_row_fn(row_id)
    commit_fn()
    del_peer_fn(wg_interface, pubkey)
    print_fn(f"Клиент {name} удалён.")


def sync(
    sync_type,
    *,
    run_check_output_fn,
    run_command_fn,
    fetch_interfaces_fn,
    build_awg_set_command_fn,
    write_key_file_fn,
    fetch_clients_fn,
    apply_firewall_rules_fn,
    print_fn,
    called_process_error_type,
    devnull,
    pipe,
):
    if sync_type == 1:
        try:
            output = run_check_output_fn(["ip", "-o", "link", "show"], text=True)
            interfaces = []
            for line in output.splitlines():
                name = line.split(":", 2)[1].strip()
                if "@" in name:
                    name = name.split("@", 1)[0]
                is_wg = name.startswith("wg") and len(name) > 2 and name[2:].isdigit()
                is_awg = name.startswith("awg") and len(name) > 3 and name[3:].isdigit()
                if is_wg or is_awg:
                    interfaces.append(name)

            if not interfaces:
                print_fn("No matching interfaces to remove")
            else:
                for iface_name in interfaces:
                    run_command_fn(["ip", "link", "delete", iface_name], check=True)
        except called_process_error_type as exc:
            print_fn(f"Error setting: {exc}")

    for row in fetch_interfaces_fn():
        (
            _id,
            wg_interface,
            awg_version,
            port_number,
            wg_ip_addr,
            wg_ip_cidr,
            private_key,
            _pubkey,
            _srv_ip,
            _srv_dns,
            jc,
            jmin,
            jmax,
            s1,
            s2,
            s3,
            s4,
            h1,
            h2,
            h3,
            h4,
            i1,
            i2,
            i3,
            i4,
            i5,
        ) = row
        print_fn("Интерфейс успешно добавлен в базу данных")
        exists = (
            run_command_fn(
                ["ip", "link", "show", wg_interface],
                check=False,
                stdout=devnull,
                stderr=devnull,
            ).returncode
            == 0
        )
        if not exists:
            add_res = run_command_fn(
                ["ip", "link", "add", wg_interface, "type", "amneziawg"],
                check=False,
                stdout=pipe,
                stderr=pipe,
                text=True,
            )
            if add_res.returncode != 0:
                err = (add_res.stderr or "").strip()
                if "File exists" not in err:
                    raise called_process_error_type(
                        add_res.returncode,
                        add_res.args,
                        add_res.stdout,
                        add_res.stderr,
                    )
        run_command_fn(["ip", "address", "replace", f"{wg_ip_addr}/{wg_ip_cidr}", "dev", wg_interface], check=True)
        run_command_fn(["ip", "link", "set", "up", "dev", wg_interface], check=True)

        run_command_fn(["touch", "key_temp"], check=True)
        run_command_fn(["chmod", "600", "key_temp"], check=True)
        write_key_file_fn("key_temp", private_key)

        awg_params = {
            "Jc": jc,
            "Jmin": jmin,
            "Jmax": jmax,
            "S1": s1,
            "S2": s2,
            "S3": s3,
            "S4": s4,
            "H1": h1,
            "H2": h2,
            "H3": h3,
            "H4": h4,
            "I1": i1,
            "I2": i2,
            "I3": i3,
            "I4": i4,
            "I5": i5,
        }
        run_command_fn(
            build_awg_set_command_fn(wg_interface, port_number, "key_temp", awg_version, awg_params),
            check=True,
        )

    for _id, name, client_pubkey, _client_privkey, client_ip, client_wg_interface in fetch_clients_fn():
        run_command_fn(
            ["awg", "set", client_wg_interface, "peer", client_pubkey, "allowed-ips", client_ip + "/32"],
            check=True,
        )
        print_fn(f"Клиент {name} успешно добавлен в конфигурацию WireGuard")

    try:
        apply_firewall_rules_fn()
        print_fn("Firewall runtime restored from persisted manager state")
    except Exception as exc:
        print_fn(f"Firewall restore error: {exc}")
