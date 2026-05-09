#!/usr/bin/python3
import sys

import awg_core


def run_cli():
    while True:
        print("Select action:")
        print("1 - add client")
        print("2 - delete client")
        print("3 - show list of clients")
        print("4 - show clients qr-code")
        print("5 - show list of interfaces")
        print("6 - add interface")
        print("7 - remove interface")
        print("8 - update interface settings")
        print("9 - loading settings from the database")
        print("10 - update client settings")
        print("11 - show connections interface <--> client")
        print("12 - show API key status")
        print("13 - set API key")
        print("0 - exit")
        choice = input("=>:")
        print("--------------------------------------------")
        if choice == '1':
            awg_core.add_client()
        elif choice == '2':
            awg_core.delete_client()
        elif choice == '3':
            awg_core.list_clients()
        elif choice == '4':
            awg_core.client_qrencode()
        elif choice == '5':
            awg_core.list_wg_int()
        elif choice == '6':
            awg_core.add_wg_int()
        elif choice == '7':
            awg_core.del_wg_int()
        elif choice == '8':
            awg_core.update_interface()
        elif choice == '9':
            awg_core.sync(1)
        elif choice == '10':
            awg_core.update_peer()
        elif choice == '11':
            awg_core.list_wg_int_clients()
        elif choice == '12':
            awg_core.show_api_key_status()
        elif choice == '13':
            awg_core.set_api_key()
        elif choice == '0':
            break
        else:
            print("Ошибка: неверный выбор")


def main():
    if "--api" in sys.argv:
        from awg_api import start_api_server
        api_index = sys.argv.index("--api")
        api_host = sys.argv[api_index + 1] if len(sys.argv) > api_index + 1 else '127.0.0.1'
        api_port = int(sys.argv[api_index + 2]) if len(sys.argv) > api_index + 2 else 8787
        start_api_server(api_host, api_port)
    elif len(sys.argv) > 1 and sys.argv[1] == "-r":
        awg_core.sync(1)
    else:
        run_cli()


if __name__ == "__main__":
    main()
