import os
import subprocess
import stat
import tempfile
import unittest

from backend.domains.ntp import runtime_ops


class _Runner:
    def __init__(self, existing_units=(), failures=(), validation_failure=False, stdout_by_command=None):
        self.existing_units = set(existing_units)
        self.failures = set(failures)
        self.validation_failure = validation_failure
        self.stdout_by_command = stdout_by_command or {}
        self.calls = []

    def __call__(self, command, **kwargs):
        command = tuple(command)
        self.calls.append((command, kwargs))
        returncode = 0
        stderr = ''
        if command[:2] == ('systemctl', 'cat'):
            returncode = 0 if command[2] in self.existing_units else 1
        if self.validation_failure and command[1:3] == ('-p', '-f'):
            returncode = 1
            stderr = 'invalid directive'
        if command in self.failures:
            returncode = 1
            stderr = 'simulated failure'
        if kwargs.get('check') and returncode:
            raise subprocess.CalledProcessError(returncode, command, stderr=stderr)
        return subprocess.CompletedProcess(command, returncode, stdout=self.stdout_by_command.get(command, ''), stderr=stderr)


class NTPRuntimeOpsTestCase(unittest.TestCase):
    def test_system_actions_use_fixed_argument_commands(self):
        runner = _Runner()

        self.assertEqual(runtime_ops.set_timezone('Europe/Moscow', command_runner=runner)['timezone'], 'Europe/Moscow')
        self.assertEqual(runtime_ops.set_manual_time('2026-07-06', '12:34:56', command_runner=runner)['datetime'], '2026-07-06 12:34:56')
        self.assertTrue(runtime_ops.sync_now(command_runner=runner)['synchronized'])
        self.assertEqual(runtime_ops.restart_service(command_runner=runner)['action'], 'restart')
        self.assertEqual(runtime_ops.reload_service(command_runner=runner)['action'], 'reload-or-restart')

        commands = [call[0] for call in runner.calls]
        self.assertIn(('timedatectl', 'set-timezone', 'Europe/Moscow'), commands)
        self.assertIn(('timedatectl', 'set-time', '2026-07-06 12:34:56'), commands)
        self.assertLess(commands.index(('systemctl', 'stop', 'chrony.service')), commands.index(('timedatectl', 'set-time', '2026-07-06 12:34:56')))
        self.assertLess(commands.index(('timedatectl', 'set-time', '2026-07-06 12:34:56')), commands.index(('systemctl', 'start', 'chrony.service')))
        self.assertIn(('chronyc', 'makestep'), commands)
        self.assertIn(('systemctl', 'restart', 'chrony.service'), commands)
        self.assertIn(('systemctl', 'reload-or-restart', 'chrony.service'), commands)

    def test_manual_time_rejects_invalid_format_before_command(self):
        runner = _Runner()

        with self.assertRaisesRegex(ValueError, 'date'):
            runtime_ops.set_manual_time('06.07.2026', '12:34', command_runner=runner)

        self.assertEqual(runner.calls, [])

    def test_list_timezones_uses_fixed_timedatectl_command(self):
        runner = _Runner(stdout_by_command={
            ('timedatectl', 'list-timezones'): 'Europe/Moscow\nUTC\nEurope/Moscow\n',
        })

        result = runtime_ops.list_timezones(command_runner=runner)

        self.assertEqual(result['items'], ['Europe/Moscow', 'UTC'])
        self.assertEqual(runner.calls[0][0], ('timedatectl', 'list-timezones'))

    def test_manual_time_restarts_chrony_and_returns_friendly_error(self):
        command = ('timedatectl', 'set-time', '2026-07-06 12:34:56')
        runner = _Runner(failures={command})

        with self.assertRaisesRegex(RuntimeError, 'Unable to set system time'):
            runtime_ops.set_manual_time('2026-07-06', '12:34:56', command_runner=runner)

        commands = [call[0] for call in runner.calls]
        self.assertIn(('systemctl', 'start', 'chrony.service'), commands)

    def test_apply_validates_replaces_config_and_masks_competitors(self):
        with tempfile.TemporaryDirectory() as tmp:
            config_path = os.path.join(tmp, 'chrony.conf')
            with open(config_path, 'w', encoding='utf-8') as config_file:
                config_file.write('pool old.example.net\n')
            runner = _Runner(existing_units={'systemd-timesyncd.service', 'ntp.service'})

            result = runtime_ops.apply_config(
                'server time.example.net iburst\n',
                config_path=config_path,
                command_runner=runner,
                chronyd_binary='/usr/sbin/chronyd',
            )

            with open(config_path, encoding='utf-8') as config_file:
                self.assertEqual(config_file.read(), 'server time.example.net iburst\n')
            self.assertEqual(result['disabled_services'], ['ntp.service', 'systemd-timesyncd.service'])
            commands = [call[0] for call in runner.calls]
            self.assertTrue(any(command[:3] == ('/usr/sbin/chronyd', '-p', '-f') for command in commands))
            self.assertIn(('systemctl', 'disable', '--now', 'ntp.service'), commands)
            self.assertIn(('systemctl', 'mask', 'ntp.service'), commands)
            self.assertIn(('systemctl', 'unmask', 'chrony.service'), commands)
            self.assertIn(('systemctl', 'enable', 'chrony.service'), commands)
            self.assertIn(('systemctl', 'restart', 'chrony.service'), commands)

    def test_apply_writes_keys_file_with_secure_permissions(self):
        with tempfile.TemporaryDirectory() as tmp:
            config_path = os.path.join(tmp, 'chrony.conf')
            keys_path = os.path.join(tmp, 'chrony.keys')
            runner = _Runner()

            result = runtime_ops.apply_config(
                'keyfile /etc/chrony/chrony.keys\nserver time.example.net key 1\n',
                keys_text='1 SHA256 secret-value\n',
                config_path=config_path,
                keys_path=keys_path,
                command_runner=runner,
                chronyd_binary='/usr/sbin/chronyd',
            )

            with open(keys_path, encoding='utf-8') as keys_file:
                self.assertEqual(keys_file.read(), '1 SHA256 secret-value\n')
            self.assertEqual(stat.S_IMODE(os.stat(keys_path).st_mode), 0o600)
            self.assertEqual(result['keys_path'], keys_path)

    def test_validation_failure_does_not_replace_config_or_touch_services(self):
        with tempfile.TemporaryDirectory() as tmp:
            config_path = os.path.join(tmp, 'chrony.conf')
            with open(config_path, 'w', encoding='utf-8') as config_file:
                config_file.write('pool old.example.net\n')
            runner = _Runner(validation_failure=True)

            with self.assertRaisesRegex(ValueError, 'validation failed'):
                runtime_ops.apply_config(
                    'broken directive\n',
                    config_path=config_path,
                    command_runner=runner,
                    chronyd_binary='/usr/sbin/chronyd',
                )

            with open(config_path, encoding='utf-8') as config_file:
                self.assertEqual(config_file.read(), 'pool old.example.net\n')
            self.assertFalse(any(call[0][0] == 'systemctl' for call in runner.calls))

    def test_restart_failure_restores_previous_config(self):
        with tempfile.TemporaryDirectory() as tmp:
            config_path = os.path.join(tmp, 'chrony.conf')
            with open(config_path, 'w', encoding='utf-8') as config_file:
                config_file.write('pool old.example.net\n')
            runner = _Runner(failures={('systemctl', 'restart', 'chrony.service')})

            with self.assertRaisesRegex(RuntimeError, 'rolled back'):
                runtime_ops.apply_config(
                    'server time.example.net iburst\n',
                    config_path=config_path,
                    command_runner=runner,
                    chronyd_binary='/usr/sbin/chronyd',
                )

            with open(config_path, encoding='utf-8') as config_file:
                self.assertEqual(config_file.read(), 'pool old.example.net\n')


if __name__ == '__main__':
    unittest.main()
