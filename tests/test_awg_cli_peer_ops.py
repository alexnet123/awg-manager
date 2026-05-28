import unittest

from backend.domains.awg import cli_peer_ops


class InterfacesClientsCliPeerOpsTest(unittest.TestCase):
    def test_update_peer_success(self):
        printed = []
        calls = []
        answers = iter(["1", "alice", "new-pub", "new-priv", "10.0.0.7", "awg0"])

        cli_peer_ops.update_peer(
            list_clients_fn=lambda: calls.append(("list",)),
            input_fn=lambda _prompt: next(answers),
            fetch_client_pubkey_by_id_fn=lambda client_id: ("old-pub",) if client_id == "1" else None,
            del_peer_fn=lambda iface, pub: calls.append(("del", iface, pub)),
            update_client_row_fn=lambda name, pub, encrypted, ip, iface, cid: calls.append(
                ("update", name, pub, encrypted, ip, iface, cid)
            ),
            encrypt_private_key_fn=lambda value: f"enc:{value}",
            commit_fn=lambda: calls.append(("commit",)),
            add_peer_fn=lambda iface, pub, ip: calls.append(("add", iface, pub, ip)),
            print_fn=lambda line: printed.append(str(line)),
        )

        self.assertIn(("list",), calls)
        self.assertIn(("del", "awg0", "old-pub"), calls)
        self.assertIn(("update", "alice", "new-pub", "enc:new-priv", "10.0.0.7", "awg0", "1"), calls)
        self.assertIn(("commit",), calls)
        self.assertIn(("add", "awg0", "new-pub", "10.0.0.7"), calls)
        self.assertTrue(any("идентификатор клиента" in line for line in printed))

    def test_update_peer_missing_client(self):
        printed = []
        calls = []
        answers = iter(["99", "alice", "new-pub", "new-priv", "10.0.0.7", "awg0"])

        cli_peer_ops.update_peer(
            list_clients_fn=lambda: calls.append(("list",)),
            input_fn=lambda _prompt: next(answers),
            fetch_client_pubkey_by_id_fn=lambda _client_id: None,
            del_peer_fn=lambda iface, pub: calls.append(("del", iface, pub)),
            update_client_row_fn=lambda *args: calls.append(("update", args)),
            encrypt_private_key_fn=lambda value: f"enc:{value}",
            commit_fn=lambda: calls.append(("commit",)),
            add_peer_fn=lambda iface, pub, ip: calls.append(("add", iface, pub, ip)),
            print_fn=lambda line: printed.append(str(line)),
        )

        self.assertIn(("list",), calls)
        self.assertFalse(any(tag in ("del", "update", "commit", "add") for (tag, *_) in calls))
        self.assertTrue(any("клиент с id 99 не найден" in line for line in printed))


if __name__ == "__main__":
    unittest.main()
