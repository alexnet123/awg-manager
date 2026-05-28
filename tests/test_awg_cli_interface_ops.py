import unittest

from backend.domains.awg import cli_interface_ops


class InterfacesClientsCliInterfaceOpsTest(unittest.TestCase):
    def _interface_row(self):
        return (
            7,
            "awg0",
            "2",
            51820,
            "10.0.0.1",
            24,
            "priv",
            "pub",
            "198.51.100.10",
            "1.1.1.1",
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
        )

    def test_add_wg_int_success(self):
        printed = []
        commands = []
        inserted = []
        written = []
        answers = iter(
            [
                "awg0",
                "51820",
                "10.0.0.1",
                "24",
                "198.51.100.10",
                "1.1.1.1",
                "yes",
            ]
        )

        def _check_output(cmd, input=None):
            if cmd == ["awg", "genkey"]:
                return b"priv\n"
            if cmd == ["awg", "pubkey"]:
                self.assertEqual(input, b"priv")
                return b"pub\n"
            raise AssertionError("unexpected check_output")

        cli_interface_ops.add_wg_int(
            input_fn=lambda _prompt: next(answers),
            prompt_awg_version_fn=lambda _default: "2",
            run_check_output_fn=_check_output,
            prepare_awg_params_for_version_fn=lambda _ver: {"Jc": 1, "Jmin": 2, "Jmax": 3, "S1": 4, "S2": 5, "S3": 6, "S4": 7, "H1": 8, "H2": 9, "H3": 10, "H4": 11, "I1": None, "I2": None, "I3": None, "I4": None, "I5": None},
            prompt_version_2_signature_params_fn=lambda params: params,
            insert_interface_row_fn=lambda *args: inserted.append(args),
            commit_fn=lambda: printed.append("COMMIT"),
            print_fn=lambda line: printed.append(str(line)),
            run_command_fn=lambda cmd: commands.append(cmd),
            build_awg_set_command_fn=lambda *_args: ["awg", "set", "awg0"],
            write_key_file_fn=lambda path, content: written.append((path, content)),
            sqlite_error_type=RuntimeError,
            called_process_error_type=ValueError,
        )

        self.assertEqual(len(inserted), 1)
        self.assertIn(["ip", "link", "add", "awg0", "type", "amneziawg"], commands)
        self.assertEqual(written, [("key_temp", "priv")])
        self.assertTrue(any("WireGuard интерфейс настроен успешно" in line for line in printed))

    def test_del_wg_int_and_update_interface_success(self):
        commands = []
        deleted = []
        updated = []
        written = []
        printed = []

        # delete path
        cli_interface_ops.del_wg_int(
            list_wg_int_fn=lambda: printed.append("LIST"),
            input_fn=lambda _prompt: "7",
            fetch_interface_by_id_fn=lambda _id: self._interface_row(),
            run_command_fn=lambda cmd: commands.append(cmd),
            delete_interface_row_by_name_fn=lambda name: deleted.append(name),
            commit_fn=lambda: printed.append("COMMIT_DEL"),
            print_fn=lambda line: printed.append(str(line)),
        )
        self.assertIn("awg0", deleted)

        # update path
        answers = iter(
            [
                "awg0",
                "",  # port default
                "",  # ip default
                "",  # cidr default
                "",  # srv_ip default
                "",  # srv_dns default
                "new-pub",
                "new-priv",
            ]
        )
        cli_interface_ops.update_interface(
            list_wg_int_fn=lambda: printed.append("LIST2"),
            print_fn=lambda line: printed.append(str(line)),
            input_fn=lambda _prompt: next(answers),
            fetch_interface_by_name_fn=lambda _iface: self._interface_row(),
            detect_awg_version_fn=lambda version, _params: version,
            build_awg_params_from_row_fn=lambda _row: {"Jc": 1},
            prompt_awg_version_fn=lambda _default: "2",
            prepare_awg_params_for_version_fn=lambda _ver: {"Jc": 1, "Jmin": 2, "Jmax": 3, "S1": 4, "S2": 5, "S3": 6, "S4": 7, "H1": 8, "H2": 9, "H3": 10, "H4": 11, "I1": None, "I2": None, "I3": None, "I4": None, "I5": None},
            prompt_version_2_signature_params_fn=lambda params: params,
            run_command_fn=lambda cmd: commands.append(cmd),
            update_interface_row_fn=lambda *args: updated.append(args),
            commit_fn=lambda: printed.append("COMMIT_UPD"),
            build_awg_set_command_fn=lambda *_args: ["awg", "set", "awg0"],
            write_key_file_fn=lambda path, content: written.append((path, content)),
        )
        self.assertEqual(len(updated), 1)
        self.assertIn(("key_temp", "new-priv"), written)

    def test_not_found_and_errors(self):
        printed = []
        # del not found
        cli_interface_ops.del_wg_int(
            list_wg_int_fn=lambda: None,
            input_fn=lambda _prompt: "404",
            fetch_interface_by_id_fn=lambda _id: None,
            run_command_fn=lambda _cmd: None,
            delete_interface_row_by_name_fn=lambda _name: None,
            commit_fn=lambda: None,
            print_fn=lambda line: printed.append(str(line)),
        )
        self.assertTrue(any("Ошибка: 404" in line for line in printed))

        # add sqlite/process errors
        printed = []
        answers = iter(["awg0", "51820", "10.0.0.1", "24", "198.51.100.10", "1.1.1.1", "no", "priv", "pub"])

        class _DbErr(Exception):
            pass

        class _CmdErr(Exception):
            pass

        cli_interface_ops.add_wg_int(
            input_fn=lambda _prompt: next(answers),
            prompt_awg_version_fn=lambda _default: "1",
            run_check_output_fn=lambda *_args, **_kwargs: b"",
            prepare_awg_params_for_version_fn=lambda _ver: {"Jc": 1, "Jmin": 2, "Jmax": 3, "S1": 4, "S2": 5, "S3": None, "S4": None, "H1": 8, "H2": 9, "H3": 10, "H4": 11, "I1": None, "I2": None, "I3": None, "I4": None, "I5": None},
            prompt_version_2_signature_params_fn=lambda params: params,
            insert_interface_row_fn=lambda *_args: (_ for _ in ()).throw(_DbErr("db boom")),
            commit_fn=lambda: None,
            print_fn=lambda line: printed.append(str(line)),
            run_command_fn=lambda _cmd: (_ for _ in ()).throw(_CmdErr("cmd boom")),
            build_awg_set_command_fn=lambda *_args: [],
            write_key_file_fn=lambda _path, _content: None,
            sqlite_error_type=_DbErr,
            called_process_error_type=_CmdErr,
        )
        self.assertTrue(any("Ошибка записи в базу данных" in line for line in printed))


if __name__ == "__main__":
    unittest.main()
