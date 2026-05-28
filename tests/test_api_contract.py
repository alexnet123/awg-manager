import http.client
import importlib
import json
import os
import pathlib
import socket
import sys
import threading
import types
import unittest

PROJECT_ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


class _FakeQueryResult:
    def __init__(self, rows=None, row=None):
        self._rows = rows or []
        self._row = row

    def fetchall(self):
        return list(self._rows)

    def fetchone(self):
        return self._row


class _FakeCursor:
    def __init__(self, manager):
        self.manager = manager

    def execute(self, query, params=()):
        q = " ".join(query.strip().split())
        ql = q.lower()
        if "from wg_interfaces where id = ?" in ql:
            target_id = int(params[0])
            row = next((r for r in self.manager.interfaces if r["id"] == target_id), None)
            return _FakeQueryResult(row=row)
        if "from wg_interfaces where wg_interface = ?" in ql:
            iface = params[0]
            row = next((r for r in self.manager.interfaces if r["wg_interface"] == iface), None)
            return _FakeQueryResult(row=row)
        if "from wg_interfaces" in ql:
            return _FakeQueryResult(rows=self.manager.interfaces)
        if "from clients where id = ?" in ql:
            target_id = int(params[0])
            row = next((r for r in self.manager.clients if r["id"] == target_id), None)
            return _FakeQueryResult(row=self.manager._client_row_tuple(row) if row else None)
        if "from clients" in ql:
            return _FakeQueryResult(rows=[self.manager._client_row_tuple(r) for r in self.manager.clients])
        raise AssertionError(f"Unexpected query in test stub: {q}")


class _ManagerStub:
    WG_INTERFACE_COLUMNS = "id, wg_interface"

    def __init__(self):
        self.api_key = "test-api-key"
        self.interfaces = []
        self.clients = []
        self.ipsec_peers = []
        self.ipsec_identities = []
        self.ipsec_policies = []
        self.ipsec_phase1_profiles = []
        self.ipsec_phase2_proposals = []
        self._next_interface_id = 1
        self._next_client_id = 1
        self.c = _FakeCursor(self)

    def verify_api_auth(self, api_key, _provided_encryption_secret):
        if api_key != self.api_key:
            return False, "Invalid API key"
        return True, None

    def rotate_api_key(self):
        self.api_key = "rotated-api-key"
        return self.api_key

    def detect_awg_version(self, version, _params):
        return "2" if str(version) == "2" else "1"

    def prepare_awg_params_for_version(self, version):
        if str(version) == "2":
            return {"Jc": 6, "S1": 20, "S2": 30, "S3": 10, "S4": 5, "I1": None}
        return {"Jc": 6, "S1": 20, "S2": 30}

    def serialize_interface_row(self, row):
        return dict(row)

    def serialize_client_row(self, row, include_private_key=False):
        if isinstance(row, tuple):
            result = {
                "id": row[0],
                "name": row[1],
                "pubkey": row[2],
                "privkey": row[3],
                "ip": row[4],
                "wg_interface": row[5],
            }
        else:
            result = dict(row)
        if not include_private_key:
            result.pop("privkey", None)
        return result

    def _client_row_tuple(self, row):
        if row is None:
            return None
        return (row["id"], row["name"], row["pubkey"], row["privkey"], row["ip"], row["wg_interface"])

    def create_interface_service(self, payload):
        required = ("wg_interface", "port_number", "wg_ip_addr", "wg_ip_cidr", "srv_ip", "srv_dns")
        if any(not payload.get(k) for k in required):
            raise ValueError("Missing required interface fields")
        if any(it["wg_interface"] == payload["wg_interface"] for it in self.interfaces):
            raise ValueError(f'Interface "{payload["wg_interface"]}" already exists')
        row = {
            "id": self._next_interface_id,
            "wg_interface": payload["wg_interface"],
            "awg_version": str(payload.get("awg_version", "2")),
            "port_number": int(payload["port_number"]),
            "wg_ip_addr": payload["wg_ip_addr"],
            "wg_ip_cidr": int(payload["wg_ip_cidr"]),
            "public_key": "pubkey",
            "srv_ip": payload["srv_ip"],
            "srv_dns": payload["srv_dns"],
            "awg_params": payload.get("awg_params", {}),
        }
        self.interfaces.append(row)
        self._next_interface_id += 1
        return row

    def update_interface_service(self, interface_id, payload):
        row = next((r for r in self.interfaces if r["id"] == int(interface_id)), None)
        if row is None:
            raise LookupError("Interface not found")
        row.update(payload)
        return row

    def delete_interface_service(self, interface_id):
        row = next((r for r in self.interfaces if r["id"] == int(interface_id)), None)
        if row is None:
            raise LookupError("Interface not found")
        self.interfaces = [r for r in self.interfaces if r["id"] != int(interface_id)]
        self.clients = [c for c in self.clients if c["wg_interface"] != row["wg_interface"]]
        return row

    def create_client_service(self, payload):
        if not payload.get("name") or not payload.get("wg_interface"):
            raise ValueError("Missing required client fields")
        if all(i["wg_interface"] != payload["wg_interface"] for i in self.interfaces):
            raise LookupError("Interface not found")
        row = {
            "id": self._next_client_id,
            "name": payload["name"],
            "pubkey": "client-pub",
            "privkey": "client-priv",
            "ip": payload.get("ip", "10.8.0.2"),
            "wg_interface": payload["wg_interface"],
        }
        self.clients.append(row)
        self._next_client_id += 1
        return row

    def update_client_service(self, client_id, payload):
        row = next((r for r in self.clients if r["id"] == int(client_id)), None)
        if row is None:
            raise LookupError("Client not found")
        row.update(payload)
        return row

    def delete_client_service(self, client_id):
        row = next((r for r in self.clients if r["id"] == int(client_id)), None)
        if row is None:
            raise LookupError("Client not found")
        self.clients = [r for r in self.clients if r["id"] != int(client_id)]
        return row

    def build_client_config(self, client_row, interface_row):
        if isinstance(client_row, tuple):
            client_ip = client_row[4]
        else:
            client_ip = client_row["ip"]
        if isinstance(interface_row, tuple):
            srv_ip = interface_row[8]
            port = interface_row[3]
        else:
            srv_ip = interface_row["srv_ip"]
            port = interface_row["port_number"]
        return (
            "[Interface]\n"
            f"Address = {client_ip}/32\n"
            "[Peer]\n"
            f"Endpoint = {srv_ip}:{port}\n"
        )

    def build_qr_svg(self, _content):
        return b"<svg xmlns='http://www.w3.org/2000/svg'><rect width='10' height='10'/></svg>"

    def list_ipsec_peers_service(self):
        return list(self.ipsec_peers)

    def list_ipsec_identities_service(self):
        return list(self.ipsec_identities)

    def list_ipsec_policies_service(self):
        return list(self.ipsec_policies)

    def list_ipsec_phase1_profiles_service(self):
        return list(self.ipsec_phase1_profiles)

    def list_ipsec_phase2_proposals_service(self):
        return list(self.ipsec_phase2_proposals)

    def upsert_ipsec_phase1_profile_service(self, payload):
        self.ipsec_phase1_profiles = [x for x in self.ipsec_phase1_profiles if x.get("name") != payload.get("name")]
        row = dict(payload)
        self.ipsec_phase1_profiles.append(row)
        return row

    def upsert_ipsec_phase2_proposal_service(self, payload):
        self.ipsec_phase2_proposals = [x for x in self.ipsec_phase2_proposals if x.get("name") != payload.get("name")]
        row = dict(payload)
        self.ipsec_phase2_proposals.append(row)
        return row

    def upsert_ipsec_peer_service(self, payload):
        self.ipsec_peers = [x for x in self.ipsec_peers if x.get("name") != payload.get("name")]
        row = dict(payload)
        self.ipsec_peers.append(row)
        return row

    def upsert_ipsec_identity_service(self, payload):
        self.ipsec_identities = [x for x in self.ipsec_identities if x.get("peer") != payload.get("peer")]
        row = dict(payload)
        row.pop("psk", None)
        row["has_psk"] = True
        self.ipsec_identities.append(row)
        return row

    def upsert_ipsec_policy_service(self, payload):
        self.ipsec_policies = [x for x in self.ipsec_policies if x.get("name") != payload.get("name")]
        row = dict(payload)
        self.ipsec_policies.append(row)
        return row

    def delete_ipsec_policy_service(self, name):
        existing = next((x for x in self.ipsec_policies if x.get("name") == name), None)
        if existing is None:
            raise LookupError("policy not found")
        self.ipsec_policies = [x for x in self.ipsec_policies if x.get("name") != name]
        return existing

    def delete_ipsec_peer_service(self, name):
        existing = next((x for x in self.ipsec_peers if x.get("name") == name), None)
        if existing is None:
            raise LookupError("peer not found")
        self.ipsec_peers = [x for x in self.ipsec_peers if x.get("name") != name]
        return existing

    def list_ipsec_active_peers_service(self):
        return [{"peer": "peer-a", "state": "ESTABLISHED", "remote_address": "2.2.2.2"}]

    def list_ipsec_installed_sas_service(self):
        return {"items": [{"child_sa": "lan-to-lan", "state": "INSTALLED"}], "xfrm": {"state": "", "policy": ""}}

    def list_ipsec_events_service(self):
        return []

    def apply_ipsec_config_service(self):
        return {
            "loaded_peers": [x.get("name") for x in self.ipsec_peers],
            "initiated_policies": [x.get("name") for x in self.ipsec_policies],
            "active_peers": [],
            "installed_sas": {"items": []},
            "warnings": [],
        }

    def load_ipsec_peer_service(self, peer_name):
        return {"peer": peer_name, "loaded": True}

    def initiate_ipsec_policy_service(self, policy_name):
        return {"policy": policy_name, "initiated": True}

    def terminate_ipsec_peer_service(self, peer_name):
        return {"peer": peer_name, "terminated": True}


class APITestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._legacy_module_name = "test_api_contract_legacy_stub"
        cls._old_target_env = os.environ.get("AWG_MANAGER_LEGACY_TARGET_MODULE")
        os.environ["AWG_MANAGER_LEGACY_TARGET_MODULE"] = cls._legacy_module_name
        cls._manager_stub = _ManagerStub()
        stub_module = types.SimpleNamespace(**cls._manager_stub.__dict__)
        for name in dir(cls._manager_stub):
            if not name.startswith("_"):
                setattr(stub_module, name, getattr(cls._manager_stub, name))
        sys.modules[cls._legacy_module_name] = stub_module

        cls.awg_api = importlib.import_module("api_core")
        cls.awg_api.manager = cls._manager_stub

        sock = socket.socket()
        sock.bind(("127.0.0.1", 0))
        cls.port = sock.getsockname()[1]
        sock.close()

        cls.httpd = cls.awg_api.HTTPServer(("127.0.0.1", cls.port), cls.awg_api.AWGManagerAPIHandler)
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.thread.join(timeout=3)
        cls.httpd.server_close()
        sys.modules.pop(cls._legacy_module_name, None)
        if cls._old_target_env is None:
            os.environ.pop("AWG_MANAGER_LEGACY_TARGET_MODULE", None)
        else:
            os.environ["AWG_MANAGER_LEGACY_TARGET_MODULE"] = cls._old_target_env

    def _request(self, method, path, body=None, api_key=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        headers = {}
        if api_key is not None:
            headers["X-API-Key"] = api_key
        if body is not None:
            payload = json.dumps(body)
            headers["Content-Type"] = "application/json"
        else:
            payload = None
        conn.request(method, path, body=payload, headers=headers)
        resp = conn.getresponse()
        raw = resp.read()
        conn.close()
        data = json.loads(raw.decode("utf-8")) if raw else {}
        return resp.status, data

    def _auth_key(self):
        return self._manager_stub.api_key

    def setUp(self):
        self._manager_stub.api_key = "test-api-key"
        self._manager_stub.interfaces = []
        self._manager_stub.clients = []
        self._manager_stub.ipsec_peers = []
        self._manager_stub.ipsec_identities = []
        self._manager_stub.ipsec_policies = []
        self._manager_stub.ipsec_phase1_profiles = []
        self._manager_stub.ipsec_phase2_proposals = []
        self._manager_stub._next_interface_id = 1
        self._manager_stub._next_client_id = 1

    def test_health_requires_auth(self):
        status, data = self._request("GET", "/health")
        self.assertEqual(status, 401)
        self.assertFalse(data["ok"])

    def test_health_ok_with_valid_auth(self):
        status, data = self._request("GET", "/health", api_key=self._auth_key())
        self.assertEqual(status, 200)
        self.assertTrue(data["ok"])

    def test_rotate_api_key(self):
        status, data = self._request("POST", "/api-key/rotate", body={}, api_key="test-api-key")
        self.assertEqual(status, 200)
        self.assertEqual(data["api_key"], "rotated-api-key")

    def test_generate_awg_params(self):
        status, data = self._request(
            "POST",
            "/awg/params/generate",
            body={"awg_version": "2"},
            api_key=self._auth_key(),
        )
        self.assertEqual(status, 200)
        self.assertEqual(data["awg_version"], "2")
        self.assertIn("S3", data["awg_params"])

    def test_create_interface_and_list(self):
        payload = {
            "wg_interface": "awg-test0",
            "awg_version": "2",
            "port_number": 51820,
            "wg_ip_addr": "10.8.0.1",
            "wg_ip_cidr": 24,
            "srv_ip": "203.0.113.1",
            "srv_dns": "1.1.1.1",
        }
        status, data = self._request("POST", "/interfaces", body=payload, api_key=self._auth_key())
        self.assertEqual(status, 201)
        self.assertEqual(data["item"]["wg_interface"], "awg-test0")

        status, data = self._request("GET", "/interfaces", api_key=self._auth_key())
        self.assertEqual(status, 200)
        self.assertEqual(len(data["items"]), 1)

    def test_create_duplicate_interface_returns_400(self):
        base = {
            "wg_interface": "awg-test0",
            "port_number": 51820,
            "wg_ip_addr": "10.8.0.1",
            "wg_ip_cidr": 24,
            "srv_ip": "203.0.113.1",
            "srv_dns": "1.1.1.1",
        }
        status, _ = self._request("POST", "/interfaces", body=base, api_key=self._auth_key())
        self.assertEqual(status, 201)

        payload = {
            "wg_interface": "awg-test0",
            "port_number": 51821,
            "wg_ip_addr": "10.8.1.1",
            "wg_ip_cidr": 24,
            "srv_ip": "203.0.113.2",
            "srv_dns": "1.1.1.1",
        }
        status, data = self._request("POST", "/interfaces", body=payload, api_key=self._auth_key())
        self.assertEqual(status, 400)
        self.assertIn("already exists", data["error"])

    def test_create_client_and_fetch_config_and_qr(self):
        status, _ = self._request(
            "POST",
            "/interfaces",
            body={
                "wg_interface": "awg-test0",
                "port_number": 51820,
                "wg_ip_addr": "10.8.0.1",
                "wg_ip_cidr": 24,
                "srv_ip": "203.0.113.1",
                "srv_dns": "1.1.1.1",
            },
            api_key=self._auth_key(),
        )
        self.assertEqual(status, 201)

        payload = {"name": "phone", "wg_interface": "awg-test0"}
        status, data = self._request("POST", "/clients", body=payload, api_key=self._auth_key())
        self.assertEqual(status, 201)
        client_id = data["item"]["id"]

        status, data = self._request("GET", f"/clients/{client_id}/config", api_key=self._auth_key())
        self.assertEqual(status, 200)
        self.assertIn("[Interface]", data["config"])

        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        conn.request("GET", f"/clients/{client_id}/qr?format=svg", headers={"X-API-Key": self._auth_key()})
        resp = conn.getresponse()
        svg = resp.read().decode("utf-8")
        conn.close()
        self.assertEqual(resp.status, 200)
        self.assertIn("<svg", svg)

    def test_create_client_for_missing_interface_returns_404(self):
        status, data = self._request(
            "POST",
            "/clients",
            body={"name": "broken", "wg_interface": "missing0"},
            api_key=self._auth_key(),
        )
        self.assertEqual(status, 404)
        self.assertEqual(data["error"], "Interface not found")

    def test_ipsec_crud_and_apply_routes(self):
        status, _ = self._request(
            "POST",
            "/api/ipsec/phase1-profiles",
            body={"name": "p1", "encryption": "aes256", "hash": "sha256", "dh_group": "modp2048", "lifetime": "1d"},
            api_key=self._auth_key(),
        )
        self.assertEqual(status, 201)

        status, _ = self._request(
            "POST",
            "/api/ipsec/phase2-proposals",
            body={"name": "p2", "encryption": "aes256", "auth": "sha256", "pfs_group": "modp2048", "lifetime": "1h"},
            api_key=self._auth_key(),
        )
        self.assertEqual(status, 201)

        status, _ = self._request(
            "POST",
            "/api/ipsec/peers",
            body={"name": "peer-a", "local_addrs": ["1.1.1.1"], "remote_addrs": ["2.2.2.2"], "phase1_profile": "p1"},
            api_key=self._auth_key(),
        )
        self.assertEqual(status, 201)

        status, data = self._request(
            "POST",
            "/api/ipsec/identities",
            body={"peer": "peer-a", "auth_method": "psk", "local_id": "1.1.1.1", "remote_id": "2.2.2.2", "psk": "secret"},
            api_key=self._auth_key(),
        )
        self.assertEqual(status, 201)
        self.assertNotIn("psk", data.get("item", {}))

        status, _ = self._request(
            "POST",
            "/api/ipsec/policies",
            body={"name": "pol-a", "peer": "peer-a", "local_ts": ["10.0.0.0/24"], "remote_ts": ["10.1.0.0/24"], "proposal": "p2"},
            api_key=self._auth_key(),
        )
        self.assertEqual(status, 201)

        status, data = self._request("POST", "/api/ipsec/apply", body={}, api_key=self._auth_key())
        self.assertEqual(status, 200)
        self.assertTrue(data["ok"])


if __name__ == "__main__":
    unittest.main()
