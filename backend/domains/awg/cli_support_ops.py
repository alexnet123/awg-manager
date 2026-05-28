#!/usr/bin/python3
from . import cli_misc_ops
from . import runtime_ops


def show_api_key_status(*, load_api_key_fn, api_key_env_var, api_key_file, print_fn):
    return cli_misc_ops.show_api_key_status(
        load_api_key_fn=load_api_key_fn,
        api_key_env_var=api_key_env_var,
        api_key_file=api_key_file,
        print_fn=print_fn,
    )


def set_api_key(*, getpass_fn, save_api_key_fn, api_key_file, print_fn):
    return cli_misc_ops.set_api_key(
        getpass_fn=getpass_fn,
        save_api_key_fn=save_api_key_fn,
        api_key_file=api_key_file,
        print_fn=print_fn,
    )


def wg_lease_ip(wg_int, *, run_check_output_fn):
    return runtime_ops.wg_lease_ip(
        wg_int,
        run_check_output_fn=run_check_output_fn,
    )


def add_peer(
    wg_interface,
    public_key,
    ip_address,
    *,
    run_command_fn,
    print_fn,
    called_process_error_type,
):
    return runtime_ops.add_peer(
        wg_interface,
        public_key,
        ip_address,
        run_command_fn=run_command_fn,
        print_fn=print_fn,
        called_process_error_type=called_process_error_type,
    )


def del_peer(
    wg_interface,
    public_key,
    *,
    run_command_fn,
    print_fn,
    called_process_error_type,
):
    return runtime_ops.del_peer(
        wg_interface,
        public_key,
        run_command_fn=run_command_fn,
        print_fn=print_fn,
        called_process_error_type=called_process_error_type,
    )


def write_text_file(path, content, *, open_fn):
    with open_fn(path, "w") as file_obj:
        file_obj.write(content)
