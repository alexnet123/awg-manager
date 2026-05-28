import pathlib
import tempfile
import unittest

from backend.domains.ipsec import store


class IpsecStoreTest(unittest.TestCase):
    def test_collection_roundtrip_filters_non_dict_items(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = pathlib.Path(tmp) / "ipsec_peers.json"
            store.write_collection(str(path), [{"name": "a"}, "bad", 1, {"name": "b"}])
            rows = store.read_collection(str(path))
            self.assertEqual(rows, [{"name": "a"}, {"name": "b"}])

    def test_append_event_keeps_tail_limit(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = pathlib.Path(tmp) / "ipsec_events.json"
            store.append_event(str(path), "e1", {"k": 1}, now_ts=1, limit=2)
            store.append_event(str(path), "e2", {"k": 2}, now_ts=2, limit=2)
            store.append_event(str(path), "e3", {"k": 3}, now_ts=3, limit=2)
            events = store.list_events(str(path))
            self.assertEqual(len(events), 2)
            self.assertEqual(events[0]["event"], "e2")
            self.assertEqual(events[1]["event"], "e3")


if __name__ == "__main__":
    unittest.main()
