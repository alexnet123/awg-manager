#!/usr/bin/python3
import os
import re
import shutil
import subprocess
import tempfile


CHRONY_CONFIG_PATH = '/etc/chrony/chrony.conf'
CHRONY_KEYS_PATH = '/etc/chrony/chrony.keys'
CHRONYD_BINARY = '/usr/sbin/chronyd'
CHRONY_SERVICE = 'chrony.service'
COMPETING_TIME_SERVICES = (
    'systemd-timesyncd.service',
    'ntp.service',
    'ntpsec.service',
    'openntpd.service',
)
_DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')
_TIME_RE = re.compile(r'^\d{2}:\d{2}:\d{2}$')


def set_timezone(timezone, command_runner=subprocess.run):
    value = str(timezone or '').strip()
    if not value:
        raise ValueError('timezone is required')
    _run(command_runner, ['timedatectl', 'set-timezone', value], check=True)
    return {'timezone': value}


def list_timezones(command_runner=subprocess.run):
    result = _run(command_runner, ['timedatectl', 'list-timezones'], check=True)
    items = sorted({
        line.strip()
        for line in str(result.stdout or '').splitlines()
        if line.strip()
    })
    if not items:
        raise RuntimeError('timedatectl returned no timezones')
    return {'items': items}


def set_manual_time(date_value, time_value, command_runner=subprocess.run):
    date_text = str(date_value or '').strip()
    time_text = str(time_value or '').strip()
    if not _DATE_RE.fullmatch(date_text):
        raise ValueError('date must use YYYY-MM-DD format')
    if not _TIME_RE.fullmatch(time_text):
        raise ValueError('time must use HH:MM:SS format')
    combined = f'{date_text} {time_text}'
    _run(command_runner, ['systemctl', 'stop', CHRONY_SERVICE], check=True)
    set_time_error = None
    try:
        _run(command_runner, ['timedatectl', 'set-time', combined], check=True)
    except subprocess.CalledProcessError as exc:
        set_time_error = exc
    restart_error = None
    try:
        _run(command_runner, ['systemctl', 'start', CHRONY_SERVICE], check=True)
        _run(command_runner, ['systemctl', 'is-active', '--quiet', CHRONY_SERVICE], check=True)
    except subprocess.CalledProcessError as exc:
        restart_error = exc
    if set_time_error is not None:
        detail = _error_detail(set_time_error)
        if restart_error is not None:
            detail = f'{detail}; Chrony restart also failed: {_error_detail(restart_error)}'
        raise RuntimeError(f'Unable to set system time: {detail}') from set_time_error
    if restart_error is not None:
        raise RuntimeError(f'System time was set, but Chrony could not be restarted: {_error_detail(restart_error)}') from restart_error
    return {'datetime': combined}


def sync_now(command_runner=subprocess.run):
    _run(command_runner, ['chronyc', 'makestep'], check=True)
    return {'synchronized': True}


def restart_service(command_runner=subprocess.run):
    _run(command_runner, ['systemctl', 'restart', CHRONY_SERVICE], check=True)
    _run(command_runner, ['systemctl', 'is-active', '--quiet', CHRONY_SERVICE], check=True)
    return {'action': 'restart', 'service': 'active'}


def reload_service(command_runner=subprocess.run):
    _run(command_runner, ['systemctl', 'reload-or-restart', CHRONY_SERVICE], check=True)
    _run(command_runner, ['systemctl', 'is-active', '--quiet', CHRONY_SERVICE], check=True)
    return {'action': 'reload-or-restart', 'service': 'active'}


def apply_config(
    config_text,
    keys_text=None,
    config_path=CHRONY_CONFIG_PATH,
    keys_path=CHRONY_KEYS_PATH,
    command_runner=subprocess.run,
    chronyd_binary=CHRONYD_BINARY,
):
    directory = os.path.dirname(config_path)
    os.makedirs(directory, exist_ok=True)
    file_descriptor, temporary_path = tempfile.mkstemp(
        prefix=f'.{os.path.basename(config_path)}.awg-manager.',
        suffix='.tmp',
        dir=directory,
    )
    backup_path = f'{config_path}.awg-manager.bak'
    replaced = False
    previous_exists = os.path.exists(config_path)
    keys_replaced = False
    keys_previous_exists = os.path.exists(keys_path)
    keys_backup_path = f'{keys_path}.awg-manager.bak'

    try:
        with os.fdopen(file_descriptor, 'w', encoding='utf-8') as config_file:
            config_file.write(str(config_text))
            config_file.flush()
            os.fsync(config_file.fileno())
        os.chmod(temporary_path, 0o644)

        if keys_text is not None:
            os.makedirs(os.path.dirname(keys_path), exist_ok=True)
            if keys_previous_exists:
                shutil.copy2(keys_path, keys_backup_path)
            _atomic_write(keys_path, str(keys_text), 0o600)
            keys_replaced = True

        _validate_config(temporary_path, chronyd_binary, command_runner)

        if previous_exists:
            shutil.copy2(config_path, backup_path)
        os.replace(temporary_path, config_path)
        temporary_path = None
        os.chmod(config_path, 0o644)
        replaced = True

        disabled_services = _disable_competing_services(command_runner)
        _start_chrony(command_runner)
        return {
            'applied': True,
            'service': 'active',
            'config_path': config_path,
            'keys_path': keys_path if keys_text is not None else '',
            'backup_path': backup_path if previous_exists else '',
            'disabled_services': disabled_services,
        }
    except ValueError:
        if keys_replaced:
            _restore_previous_file(keys_path, keys_backup_path, keys_previous_exists)
        raise
    except Exception as exc:
        if replaced:
            _restore_previous_config(config_path, backup_path, previous_exists)
            if keys_replaced:
                _restore_previous_file(keys_path, keys_backup_path, keys_previous_exists)
            _run(command_runner, ['systemctl', 'restart', CHRONY_SERVICE], check=False)
            detail = _error_detail(exc)
            raise RuntimeError(f'Chrony apply failed and configuration was rolled back: {detail}') from exc
        if keys_replaced:
            _restore_previous_file(keys_path, keys_backup_path, keys_previous_exists)
        raise
    finally:
        if temporary_path and os.path.exists(temporary_path):
            os.unlink(temporary_path)


def is_config_current(config_text, config_path=CHRONY_CONFIG_PATH, keys_text=None, keys_path=CHRONY_KEYS_PATH):
    try:
        with open(config_path, encoding='utf-8') as config_file:
            if config_file.read() != str(config_text):
                return False
    except OSError:
        return False
    if keys_text is None:
        return True
    try:
        with open(keys_path, encoding='utf-8') as keys_file:
            return keys_file.read() == str(keys_text)
    except OSError:
        return False


def _atomic_write(path, content, mode):
    directory = os.path.dirname(path)
    file_descriptor, temporary_path = tempfile.mkstemp(
        prefix=f'.{os.path.basename(path)}.awg-manager.',
        suffix='.tmp',
        dir=directory,
    )
    try:
        with os.fdopen(file_descriptor, 'w', encoding='utf-8') as target_file:
            target_file.write(content)
            target_file.flush()
            os.fsync(target_file.fileno())
        os.chmod(temporary_path, mode)
        os.replace(temporary_path, path)
        os.chmod(path, mode)
        temporary_path = None
    finally:
        if temporary_path and os.path.exists(temporary_path):
            os.unlink(temporary_path)


def _validate_config(path, chronyd_binary, command_runner):
    try:
        _run(
            command_runner,
            [chronyd_binary, '-p', '-f', path],
            check=True,
        )
    except subprocess.CalledProcessError as exc:
        raise ValueError(f'Chrony configuration validation failed: {_error_detail(exc)}') from exc


def _disable_competing_services(command_runner):
    disabled = []
    for unit in COMPETING_TIME_SERVICES:
        if not _unit_exists(unit, command_runner):
            continue
        _run(command_runner, ['systemctl', 'disable', '--now', unit], check=True)
        _run(command_runner, ['systemctl', 'mask', unit], check=True)
        disabled.append(unit)
    return sorted(disabled)


def _unit_exists(unit, command_runner):
    result = _run(command_runner, ['systemctl', 'cat', unit], check=False)
    return result.returncode == 0


def _start_chrony(command_runner):
    _run(command_runner, ['systemctl', 'unmask', CHRONY_SERVICE], check=True)
    _run(command_runner, ['systemctl', 'enable', CHRONY_SERVICE], check=True)
    _run(command_runner, ['systemctl', 'restart', CHRONY_SERVICE], check=True)
    _run(command_runner, ['systemctl', 'is-active', '--quiet', CHRONY_SERVICE], check=True)


def _restore_previous_config(config_path, backup_path, previous_exists):
    _restore_previous_file(config_path, backup_path, previous_exists)


def _restore_previous_file(path, backup_path, previous_exists):
    if previous_exists and os.path.exists(backup_path):
        shutil.copy2(backup_path, path)
    else:
        try:
            os.unlink(path)
        except FileNotFoundError:
            pass


def _run(command_runner, command, check):
    return command_runner(
        command,
        check=check,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )


def _error_detail(exc):
    stderr = str(getattr(exc, 'stderr', '') or '').strip()
    return stderr or str(exc)
