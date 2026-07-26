from backend.common import system_metrics


def test_calculate_cpu_percent_from_proc_stat_delta():
    previous = system_metrics.CpuSample(idle=100, total=200)
    current = system_metrics.CpuSample(idle=125, total=300)

    assert system_metrics.calculate_cpu_percent(previous, current) == 75.0


def test_parse_meminfo_reports_used_percent():
    meminfo = "\n".join([
        "MemTotal:        1000 kB",
        "MemFree:          100 kB",
        "MemAvailable:     250 kB",
    ])

    result = system_metrics.parse_meminfo(meminfo)

    assert result["total_bytes"] == 1024000
    assert result["available_bytes"] == 256000
    assert result["used_bytes"] == 768000
    assert result["percent"] == 75.0


def test_parse_uptime_seconds_from_proc_uptime():
    assert system_metrics.parse_uptime("12345.67 890.12\n") == 12345
