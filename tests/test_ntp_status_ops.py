import subprocess
import threading
import time
import unittest

from backend.domains.ntp import status_ops


class _Runner:
    def __init__(self, outputs):
        self.outputs = outputs
        self.calls = []

    def __call__(self, command, **kwargs):
        command = tuple(command)
        self.calls.append((command, kwargs))
        return self.outputs.get(command, subprocess.CompletedProcess(command, 1, stdout='', stderr='missing'))


class _ConcurrentRunner(_Runner):
    def __init__(self, outputs):
        super().__init__(outputs)
        self.active = 0
        self.max_active = 0
        self.lock = threading.Lock()

    def __call__(self, command, **kwargs):
        with self.lock:
            self.active += 1
            self.max_active = max(self.max_active, self.active)
        try:
            time.sleep(0.03)
            return super().__call__(command, **kwargs)
        finally:
            with self.lock:
                self.active -= 1


class NTPStatusOpsTestCase(unittest.TestCase):
    def test_collect_status_parses_tracking_activity_sources_and_stats(self):
        runner = _Runner({
            ('systemctl', 'is-active', 'chrony.service'): subprocess.CompletedProcess([], 0, stdout='active\n', stderr=''),
            ('systemctl', 'is-enabled', 'chrony.service'): subprocess.CompletedProcess([], 0, stdout='enabled\n', stderr=''),
            ('date', '+%s'): subprocess.CompletedProcess([], 0, stdout='1783267206\n', stderr=''),
            ('timedatectl', 'show', '-p', 'Timezone', '-p', 'LocalRTC', '-p', 'NTPSynchronized', '-p', 'NTP'): subprocess.CompletedProcess([], 0, stdout='Timezone=UTC\nLocalRTC=no\nNTPSynchronized=yes\nNTP=yes\n', stderr=''),
            ('chronyc', '-n', '-c', 'tracking'): subprocess.CompletedProcess([], 0, stdout='5292353A,82.146.53.58,3,1783267206.8,0.000011,-0.000011,0.000011,41.339,0.656,0.221,0.0035,0.0005,64.8,Normal\n', stderr=''),
            ('chronyc', '-n', '-c', 'activity'): subprocess.CompletedProcess([], 0, stdout='4,0,0,0,0\n', stderr=''),
            ('chronyc', '-n', '-c', 'sources'): subprocess.CompletedProcess([], 0, stdout='^,*,82.146.53.58,2,6,37,56,-0.0000003,-0.0000115,0.0021\n', stderr=''),
            ('chronyc', '-n', '-c', 'sourcestats'): subprocess.CompletedProcess([], 0, stdout='82.146.53.58,5,3,71,0.652,12.438,0.000038,0.000069\n', stderr=''),
            ('chronyc', '-n', '-c', 'clients'): subprocess.CompletedProcess([], 0, stdout='192.0.2.10,12,1,6,-,8,0,0,-,-\n', stderr=''),
        })

        status = status_ops.collect_status(command_runner=runner)

        self.assertEqual(status['service'], {'active': True, 'enabled': True, 'state': 'active'})
        self.assertEqual(status['current_time'], 1783267206.0)
        self.assertEqual(status['system_clock'], {'timezone': 'UTC', 'local_rtc': False, 'ntp_synchronized': True, 'ntp_service': True})
        self.assertEqual(status['tracking']['stratum'], 3)
        self.assertEqual(status['tracking']['leap_status'], 'Normal')
        self.assertEqual(status['activity']['sources_online'], 4)
        self.assertEqual(status['sources'][0]['state'], '*')
        self.assertAlmostEqual(status['sources'][0]['estimated_error'], 0.0021)
        self.assertEqual(status['source_stats'][0]['samples'], 5)
        self.assertEqual(status['clients'][0]['address'], '192.0.2.10')
        self.assertEqual(status['clients'][0]['ntp_packets'], 12)
        self.assertEqual(status['clients'][0]['ntp_drops'], 1)
        self.assertEqual(status['clients'][0]['ntp_interval'], 6)
        self.assertEqual(status['clients'][0]['ntp_interval_last'], None)
        self.assertEqual(status['clients'][0]['ntp_last'], 8)
        self.assertEqual(status['clients'][0]['command_packets'], 0)
        self.assertEqual(status['errors'], [])

    def test_collect_status_keeps_service_state_when_chronyc_fails(self):
        runner = _Runner({
            ('systemctl', 'is-active', 'chrony.service'): subprocess.CompletedProcess([], 3, stdout='inactive\n', stderr=''),
            ('systemctl', 'is-enabled', 'chrony.service'): subprocess.CompletedProcess([], 0, stdout='enabled\n', stderr=''),
            ('date', '+%s'): subprocess.CompletedProcess([], 0, stdout='1783267206\n', stderr=''),
            ('timedatectl', 'show', '-p', 'Timezone', '-p', 'LocalRTC', '-p', 'NTPSynchronized', '-p', 'NTP'): subprocess.CompletedProcess([], 1, stdout='', stderr='timedatectl failed'),
        })

        status = status_ops.collect_status(command_runner=runner)

        self.assertFalse(status['service']['active'])
        self.assertTrue(status['service']['enabled'])
        self.assertEqual(status['current_time'], 1783267206.0)
        self.assertIsNone(status['system_clock'])
        self.assertIsNone(status['tracking'])
        self.assertEqual(status['sources'], [])
        self.assertEqual(status['clients'], [])
        self.assertEqual(len(status['errors']), 6)

    def test_collect_status_runs_independent_commands_concurrently(self):
        runner = _ConcurrentRunner({
            ('systemctl', 'is-active', 'chrony.service'): subprocess.CompletedProcess([], 0, stdout='active\n', stderr=''),
            ('systemctl', 'is-enabled', 'chrony.service'): subprocess.CompletedProcess([], 0, stdout='enabled\n', stderr=''),
            ('date', '+%s'): subprocess.CompletedProcess([], 0, stdout='1783267206\n', stderr=''),
            ('timedatectl', 'show', '-p', 'Timezone', '-p', 'LocalRTC', '-p', 'NTPSynchronized', '-p', 'NTP'): subprocess.CompletedProcess([], 0, stdout='Timezone=UTC\nLocalRTC=no\nNTPSynchronized=yes\nNTP=yes\n', stderr=''),
        })

        status_ops.collect_status(command_runner=runner)

        self.assertGreater(runner.max_active, 1)

    def test_collect_status_reports_command_timeout(self):
        def runner(command, **kwargs):
            if command == ['chronyc', '-n', '-c', 'tracking']:
                raise subprocess.TimeoutExpired(command, kwargs.get('timeout', 0))
            if command == ['date', '+%s']:
                return subprocess.CompletedProcess(command, 0, stdout='1783267206\n', stderr='')
            return subprocess.CompletedProcess(command, 0, stdout='active\n' if command == ['systemctl', 'is-active', 'chrony.service'] else '', stderr='')

        status = status_ops.collect_status(command_runner=runner)

        self.assertIsNone(status['tracking'])
        self.assertIn('timed out after 2s', status['errors'][0]['error'])


if __name__ == '__main__':
    unittest.main()
