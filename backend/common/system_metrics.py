#!/usr/bin/python3
import os
import time
from dataclasses import dataclass


@dataclass(frozen=True)
class CpuSample:
    idle: int
    total: int


_previous_cpu_sample = None


def parse_proc_stat(text):
    first_line = text.splitlines()[0].split()
    values = [int(value) for value in first_line[1:]]
    idle = values[3] + (values[4] if len(values) > 4 else 0)
    return CpuSample(idle=idle, total=sum(values))


def calculate_cpu_percent(previous, current):
    total_delta = current.total - previous.total
    idle_delta = current.idle - previous.idle
    if total_delta <= 0:
        return None
    used_percent = (1 - (idle_delta / total_delta)) * 100
    return round(max(0, min(100, used_percent)), 1)


def parse_meminfo(text):
    values = {}
    for line in text.splitlines():
        if ":" not in line:
            continue
        key, raw_value = line.split(":", 1)
        parts = raw_value.strip().split()
        if not parts:
            continue
        values[key] = int(parts[0]) * 1024

    total = values.get("MemTotal")
    available = values.get("MemAvailable", values.get("MemFree"))
    if not total or available is None:
        return None

    used = max(0, total - available)
    return {
        "percent": round((used / total) * 100, 1),
        "used_bytes": used,
        "available_bytes": available,
        "total_bytes": total,
    }


def parse_uptime(text):
    return int(float(text.split()[0]))


def _read_cpu_sample():
    with open("/proc/stat", "r", encoding="utf-8") as handle:
        return parse_proc_stat(handle.read())


def _read_memory():
    with open("/proc/meminfo", "r", encoding="utf-8") as handle:
        return parse_meminfo(handle.read())


def _read_uptime():
    with open("/proc/uptime", "r", encoding="utf-8") as handle:
        return parse_uptime(handle.read())


def collect_system_metrics():
    global _previous_cpu_sample

    cpu_sample = None
    cpu_percent = None
    try:
        cpu_sample = _read_cpu_sample()
        if _previous_cpu_sample is not None:
            cpu_percent = calculate_cpu_percent(_previous_cpu_sample, cpu_sample)
        _previous_cpu_sample = cpu_sample
    except OSError:
        pass

    load_average = None
    try:
        load_average = round(os.getloadavg()[0], 2)
    except OSError:
        pass

    memory = None
    try:
        memory = _read_memory()
    except OSError:
        pass

    uptime_seconds = None
    try:
        uptime_seconds = _read_uptime()
    except OSError:
        pass

    return {
        "timestamp": time.time(),
        "uptime_seconds": uptime_seconds,
        "cpu": {
            "percent": cpu_percent,
            "load_average_1m": load_average,
            "cores": os.cpu_count() or 1,
        },
        "memory": memory,
    }
