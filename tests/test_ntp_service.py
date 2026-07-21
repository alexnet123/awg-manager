import json
import os
import tempfile
import unittest
from unittest import mock

from backend.domains.ntp import service


class NTPServiceTestCase(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self._env = mock.patch.dict(os.environ, {"AWG_MANAGER_DATA_DIR": self._tmp.name})
        self._env.start()

    def tearDown(self):
        self._env.stop()
        self._tmp.cleanup()

    def test_get_returns_defaults_without_creating_file(self):
        status, payload = service.handle_get(["ntp"])

        self.assertEqual(status, 200)
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["item"]["schema_version"], 1)
        self.assertTrue(payload["item"]["time"]["ntp_enabled"])
        self.assertTrue(payload["item"]["time"]["rtcsync"])
        self.assertFalse(payload["item"]["server"]["enabled"])
        self.assertEqual(payload["item"]["keys"], [])
        self.assertFalse(os.path.exists(os.path.join(self._tmp.name, "ntp_config.json")))

    @mock.patch('backend.domains.ntp.service.runtime_ops.is_config_current')
    def test_get_reports_whether_desired_config_is_applied(self, is_config_current):
        is_config_current.return_value = False
        service.handle_put(["ntp"], {"sources": [{"address": "time.example.net"}]})

        status, payload = service.handle_get(["ntp"])

        self.assertEqual(status, 200)
        self.assertFalse(payload["item"]["applied_current"])
        self.assertIn('server time.example.net', is_config_current.call_args.args[0])

    def test_put_normalizes_and_persists_desired_config(self):
        status, payload = service.handle_put(
            ["ntp"],
            {
                "time": {"timezone": "Europe/Moscow", "ntp_enabled": "true"},
                "sources": [
                    {
                        "type": "server",
                        "address": "time.example.net",
                        "min_poll": "6",
                        "max_poll": "10",
                        "iburst": "true",
                        "options": "prefer",
                    }
                ],
                "server": {"enabled": "false", "listen_port": "123"},
                "access": [{"action": "allow", "network": "10.0.0.7/24"}],
            },
        )

        self.assertEqual(status, 200)
        item = payload["item"]
        self.assertTrue(item["time"]["ntp_enabled"])
        self.assertTrue(item["time"]["rtcsync"])
        self.assertEqual(item["sources"][0]["min_poll"], 6)
        self.assertEqual(item["access"][0]["network"], "10.0.0.0/24")
        with open(os.path.join(self._tmp.name, "ntp_config.json"), encoding="utf-8") as config_file:
            self.assertEqual(json.load(config_file), item)

    def test_preview_renders_chrony_directives_and_warnings(self):
        service.handle_put(
            ["ntp"],
            {
                "keys": [
                    {
                        "enabled": True,
                        "id": "1",
                        "algorithm": "SHA256",
                        "secret": "secret-value",
                        "comment": "server/source key",
                    }
                ],
                "sources": [
                    {
                        "type": "server",
                        "address": "192.0.2.10",
                        "iburst": True,
                        "min_poll": 6,
                        "max_poll": 10,
                        "options": "prefer",
                        "auth_key": "1",
                    }
                ],
                "server": {"enabled": True, "use_local_clock": True, "local_stratum": 10, "auth_key": "1"},
                "access": [{"action": "allow", "network": "10.0.0.0/24"}],
            },
        )

        status, payload = service.handle_get(["ntp", "config-preview"])

        self.assertEqual(status, 200)
        preview = payload["item"]
        self.assertIn("keyfile /etc/chrony/chrony.keys", preview["content"])
        self.assertIn("server 192.0.2.10 iburst minpoll 6 maxpoll 10 key 1 prefer", preview["content"])
        self.assertIn("makestep 1.0 3", preview["content"])
        self.assertIn("local stratum 10", preview["content"])
        self.assertIn("allow 10.0.0.0/24", preview["content"])
        self.assertIn("rtcsync", preview["content"])
        self.assertEqual(preview["warnings"], [])

    def test_put_rejects_unknown_auth_key_reference(self):
        with self.assertRaisesRegex(ValueError, "unknown auth_key"):
            service.handle_put(
                ["ntp"],
                {"sources": [{"address": "time.example.net", "auth_key": "99"}]},
            )

    def test_preview_omits_rtcsync_when_disabled(self):
        service.handle_put(["ntp"], {"time": {"rtcsync": False}})

        _status, payload = service.handle_get(["ntp", "config-preview"])

        self.assertNotIn("rtcsync", payload["item"]["content"])

    def test_preview_always_keeps_client_logging_directive(self):
        service.handle_put(["ntp"], {"server": {"enabled": False, "collect_client_statistics": False, "client_log_limit": 2097152}})

        _status, payload = service.handle_get(["ntp", "config-preview"])

        self.assertIn("clientloglimit 2097152", payload["item"]["content"])
        self.assertNotIn("noclientlog", payload["item"]["content"])

    def test_put_rejects_invalid_values_without_overwriting_store(self):
        service.handle_put(["ntp"], {"time": {"timezone": "UTC"}})

        with self.assertRaisesRegex(ValueError, "max_poll"):
            service.handle_put(
                ["ntp"],
                {"sources": [{"address": "time.example.net", "min_poll": 10, "max_poll": 6}]},
            )

        _, payload = service.handle_get(["ntp"])
        self.assertEqual(payload["item"]["time"]["timezone"], "UTC")

    @mock.patch('backend.domains.ntp.service.runtime_ops.apply_config')
    def test_post_apply_uses_saved_preview(self, apply_config):
        apply_config.return_value = {'applied': True, 'service': 'active', 'disabled_services': []}
        service.handle_put(
            ["ntp"],
            {
                "keys": [{"id": "1", "algorithm": "SHA256", "secret": "secret-value"}],
                "sources": [{"address": "192.0.2.30", "auth_key": "1"}],
            },
        )

        status, payload = service.handle_post(["ntp", "apply"], {})

        self.assertEqual(status, 200)
        self.assertTrue(payload["item"]["applied"])
        self.assertIn('server 192.0.2.30', apply_config.call_args.args[0])
        self.assertIn('keyfile /etc/chrony/chrony.keys', apply_config.call_args.args[0])
        self.assertEqual(apply_config.call_args.kwargs['keys_text'], '1 SHA256 secret-value\n')

    @mock.patch('backend.domains.ntp.service.status_ops.collect_status')
    def test_get_status_returns_runtime_snapshot(self, collect_status):
        collect_status.return_value = {
            'service': {'active': True, 'enabled': True, 'state': 'active'},
            'tracking': {'stratum': 3},
            'activity': {'sources_online': 4},
            'sources': [],
            'source_stats': [],
            'errors': [],
        }

        status, payload = service.handle_get(['ntp', 'status'])

        self.assertEqual(status, 200)
        self.assertEqual(payload['item']['tracking']['stratum'], 3)

    @mock.patch('backend.domains.ntp.service.runtime_ops.list_timezones')
    def test_get_timezones_returns_host_timezone_list(self, list_timezones):
        list_timezones.return_value = {'items': ['UTC', 'Europe/Moscow']}

        status, payload = service.handle_get(['ntp', 'timezones'])

        self.assertEqual(status, 200)
        self.assertEqual(payload['item']['items'], ['UTC', 'Europe/Moscow'])
        list_timezones.assert_called_once_with()

    @mock.patch('backend.domains.ntp.service.runtime_ops.set_timezone')
    def test_post_timezone_validates_and_applies_timezone(self, set_timezone):
        set_timezone.return_value = {'timezone': 'Europe/Moscow'}

        status, payload = service.handle_post(['ntp', 'timezone'], {'timezone': 'Europe/Moscow'})

        self.assertEqual(status, 200)
        self.assertEqual(payload['item']['timezone'], 'Europe/Moscow')
        set_timezone.assert_called_once_with('Europe/Moscow')

    @mock.patch('backend.domains.ntp.service.runtime_ops.set_manual_time')
    def test_post_manual_time_requires_disabled_ntp(self, set_manual_time):
        service.handle_put(['ntp'], {'time': {'timezone': 'UTC', 'ntp_enabled': True}})
        with self.assertRaisesRegex(ValueError, 'disabled'):
            service.handle_post(['ntp', 'manual-time'], {'date': '2026-07-06', 'time': '12:34:56'})
        set_manual_time.assert_not_called()

    @mock.patch('backend.domains.ntp.service.runtime_ops.reload_service')
    @mock.patch('backend.domains.ntp.service.runtime_ops.restart_service')
    @mock.patch('backend.domains.ntp.service.runtime_ops.sync_now')
    def test_post_runtime_actions(self, sync_now, restart_service, reload_service):
        sync_now.return_value = {'synchronized': True}
        restart_service.return_value = {'action': 'restart', 'service': 'active'}
        reload_service.return_value = {'action': 'reload-or-restart', 'service': 'active'}

        self.assertEqual(service.handle_post(['ntp', 'sync'], {})[1]['item']['synchronized'], True)
        self.assertEqual(service.handle_post(['ntp', 'restart'], {})[1]['item']['action'], 'restart')
        self.assertEqual(service.handle_post(['ntp', 'reload'], {})[1]['item']['action'], 'reload-or-restart')


if __name__ == "__main__":
    unittest.main()
