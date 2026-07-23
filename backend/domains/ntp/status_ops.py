#!/usr/bin/python3
import concurrent.futures
import csv
import subprocess


CHRONY_SERVICE = 'chrony.service'
STATUS_COMMAND_TIMEOUT_SECONDS = 2
STATUS_COMMANDS = {
    'service_active': ['systemctl', 'is-active', CHRONY_SERVICE],
    'service_enabled': ['systemctl', 'is-enabled', CHRONY_SERVICE],
    'current_time': ['date', '+%s'],
    'system_clock': ['timedatectl', 'show', '-p', 'Timezone', '-p', 'LocalRTC', '-p', 'NTPSynchronized', '-p', 'NTP'],
    'tracking': ['chronyc', '-n', '-c', 'tracking'],
    'activity': ['chronyc', '-n', '-c', 'activity'],
    'sources': ['chronyc', '-n', '-c', 'sources'],
    'source_stats': ['chronyc', '-n', '-c', 'sourcestats'],
    'clients': ['chronyc', '-n', '-c', 'clients'],
}


def collect_status(command_runner=subprocess.run):
    results = _run_status_commands(command_runner)
    service_state = _service_state(results['service_active'], results['service_enabled'])
    errors = []
    current_time = _parse_current_time_result(results['current_time'], errors)
    system_clock = _parse_system_clock_result(results['system_clock'], errors)
    tracking = _parse_chronyc_result('tracking', _parse_tracking, results['tracking'], errors, None)
    activity = _parse_chronyc_result('activity', _parse_activity, results['activity'], errors, None)
    sources = _parse_chronyc_result('sources', _parse_sources, results['sources'], errors, [])
    source_stats = _parse_chronyc_result('sourcestats', _parse_source_stats, results['source_stats'], errors, [])
    clients = _parse_chronyc_result('clients', _parse_clients, results['clients'], errors, [])
    return {
        'service': service_state,
        'current_time': current_time,
        'system_clock': system_clock,
        'tracking': tracking,
        'activity': activity,
        'sources': sources,
        'source_stats': source_stats,
        'clients': clients,
        'errors': errors,
    }


def _run_status_commands(command_runner):
    results = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(STATUS_COMMANDS)) as executor:
        futures = {
            key: executor.submit(_run, command_runner, command)
            for key, command in STATUS_COMMANDS.items()
        }
        for key, future in futures.items():
            results[key] = future.result()
    return results


def _service_state(active_result, enabled_result):
    state = str(active_result.stdout or '').strip() or 'unknown'
    enabled_state = str(enabled_result.stdout or '').strip()
    return {
        'active': active_result.returncode == 0 and state == 'active',
        'enabled': enabled_result.returncode == 0 and enabled_state in ('enabled', 'enabled-runtime'),
        'state': state,
    }


def _parse_chronyc_result(command, parser, result, errors, default):
    if result.returncode != 0:
        errors.append({'command': command, 'error': _result_error(result)})
        return default
    try:
        return parser(result.stdout or '')
    except (ValueError, IndexError) as exc:
        errors.append({'command': command, 'error': str(exc)})
        return default


def _parse_system_clock_result(result, errors):
    if result.returncode != 0:
        errors.append({'command': 'timedatectl', 'error': _result_error(result)})
        return None
    values = {}
    for line in str(result.stdout or '').splitlines():
        if '=' not in line:
            continue
        key, value = line.split('=', 1)
        values[key] = value.strip()
    return {
        'timezone': values.get('Timezone', ''),
        'local_rtc': _yes_no(values.get('LocalRTC')),
        'ntp_synchronized': _yes_no(values.get('NTPSynchronized')),
        'ntp_service': _yes_no(values.get('NTP')),
    }


def _parse_current_time_result(result, errors):
    if result.returncode != 0:
        errors.append({'command': 'date', 'error': _result_error(result)})
        return None
    try:
        return _number(str(result.stdout or '').strip())
    except ValueError as exc:
        errors.append({'command': 'date', 'error': str(exc)})
        return None


def _parse_tracking(output):
    row = _single_row(output, 'tracking', 14)
    return {
        'reference_id': row[0],
        'reference_address': row[1],
        'stratum': _integer(row[2]),
        'reference_time': _number(row[3]),
        'system_time': _number(row[4]),
        'last_offset': _number(row[5]),
        'rms_offset': _number(row[6]),
        'frequency_ppm': _number(row[7]),
        'residual_frequency_ppm': _number(row[8]),
        'skew_ppm': _number(row[9]),
        'root_delay': _number(row[10]),
        'root_dispersion': _number(row[11]),
        'update_interval': _number(row[12]),
        'leap_status': row[13],
    }


def _parse_activity(output):
    row = _single_row(output, 'activity', 5)
    return {
        'sources_online': _integer(row[0]),
        'sources_offline': _integer(row[1]),
        'sources_burst_online': _integer(row[2]),
        'sources_burst_offline': _integer(row[3]),
        'sources_unresolved': _integer(row[4]),
    }


def _parse_sources(output):
    items = []
    for row in _rows(output):
        if len(row) < 10:
            raise ValueError('sources returned an incomplete row')
        items.append({
            'mode': row[0],
            'state': row[1],
            'address': row[2],
            'stratum': _integer(row[3]),
            'poll': _integer(row[4]),
            'reach': _integer(row[5]),
            'last_rx': _integer(row[6]),
            'adjusted_offset': _number(row[7]),
            'measured_offset': _number(row[8]),
            'estimated_error': _number(row[9]),
        })
    return items


def _parse_source_stats(output):
    items = []
    for row in _rows(output):
        if len(row) < 8:
            raise ValueError('sourcestats returned an incomplete row')
        items.append({
            'address': row[0],
            'samples': _integer(row[1]),
            'runs': _integer(row[2]),
            'span': _integer(row[3]),
            'frequency_ppm': _number(row[4]),
            'frequency_skew_ppm': _number(row[5]),
            'offset': _number(row[6]),
            'standard_deviation': _number(row[7]),
        })
    return items


def _parse_clients(output):
    items = []
    for row in _rows(output):
        if len(row) < 10:
            raise ValueError('clients returned an incomplete row')
        items.append({
            'address': row[0],
            'ntp_packets': _integer(row[1]),
            'ntp_drops': _integer(row[2]),
            'ntp_interval': _optional_integer(row[3]),
            'ntp_interval_last': _optional_integer(row[4]),
            'ntp_last': _optional_integer(row[5]),
            'command_packets': _integer(row[6]),
            'command_drops': _integer(row[7]),
            'command_interval': _optional_integer(row[8]),
            'command_last': _optional_integer(row[9]),
        })
    return items


def _single_row(output, command, minimum_fields):
    rows = _rows(output)
    if not rows or len(rows[0]) < minimum_fields:
        raise ValueError(f'{command} returned no complete row')
    return rows[0]


def _rows(output):
    return [row for row in csv.reader(str(output).splitlines()) if row]


def _integer(value):
    return int(value)


def _optional_integer(value):
    if value == '-':
        return None
    return _integer(value)


def _number(value):
    return float(value)


def _yes_no(value):
    if value == 'yes':
        return True
    if value == 'no':
        return False
    return None


def _run(command_runner, command):
    try:
        return command_runner(
            command,
            check=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=STATUS_COMMAND_TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired as exc:
        return subprocess.CompletedProcess(
            command,
            124,
            stdout=getattr(exc, 'stdout', '') or '',
            stderr=f"timed out after {STATUS_COMMAND_TIMEOUT_SECONDS}s",
        )


def _result_error(result):
    return str(result.stderr or result.stdout or f'exit code {result.returncode}').strip()
