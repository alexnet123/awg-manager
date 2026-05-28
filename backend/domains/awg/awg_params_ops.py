#!/usr/bin/python3
import random
import re


def detect_awg_version(awg_version, awg_params, *, normalize_config_value_fn):
    normalized_version = normalize_config_value_fn(awg_version)
    if normalized_version in ("1", "2"):
        return normalized_version
    if normalized_version in ("1.0", "1.5"):
        return "1"
    if normalized_version in ("2.0",):
        return "2"

    if any(normalize_config_value_fn(awg_params.get(key)) is not None for key in ("I1", "I2", "I3", "I4", "I5", "S3", "S4")):
        return "2"
    if any(normalize_config_value_fn(awg_params.get(key)) is not None for key in ("Jc", "Jmin", "Jmax", "S1", "S2", "H1", "H2", "H3", "H4")):
        return "1"
    return "1"


def get_awg_param_keys_for_version(awg_version, *, detect_awg_version_fn):
    awg_version = detect_awg_version_fn(awg_version, {})
    keys = ["Jc", "Jmin", "Jmax", "S1", "S2", "H1", "H2", "H3", "H4"]
    if awg_version == "2":
        keys.extend(["S3", "S4", "I1", "I2", "I3", "I4", "I5"])
    return keys


def build_awg_params_from_row(row):
    return {
        "Jc": row[10],
        "Jmin": row[11],
        "Jmax": row[12],
        "S1": row[13],
        "S2": row[14],
        "S3": row[15],
        "S4": row[16],
        "H1": row[17],
        "H2": row[18],
        "H3": row[19],
        "H4": row[20],
        "I1": row[21],
        "I2": row[22],
        "I3": row[23],
        "I4": row[24],
        "I5": row[25],
    }


def _random_h_value(*, random_randint_fn):
    return random_randint_fn(5, 2147483647)


def _random_h_range(*, random_randint_fn):
    start = _random_h_value(random_randint_fn=random_randint_fn)
    end = min(2147483647, start + random_randint_fn(10, 500))
    return f"{start}-{end}"


def generate_awg_obfuscation_params(
    awg_version="2",
    *,
    detect_awg_version_fn,
    random_randint_fn=None,
    random_sample_fn=None,
):
    if random_randint_fn is None:
        random_randint_fn = random.randint
    if random_sample_fn is None:
        random_sample_fn = random.sample

    awg_version = detect_awg_version_fn(awg_version, {})
    jc = random_randint_fn(4, 12)
    jmin = 8
    jmax = 80
    s1 = random_randint_fn(15, 150)
    s2 = random_randint_fn(15, 150)
    while s1 + 56 == s2:
        s2 = random_randint_fn(15, 150)
    s3 = random_randint_fn(15, 150)
    s4 = random_randint_fn(5, 32)

    # v2 supports dynamic ranges (x-y), v1 keeps single numeric values.
    if awg_version == "2":
        h_values = [
            _random_h_range(random_randint_fn=random_randint_fn),
            _random_h_range(random_randint_fn=random_randint_fn),
            _random_h_range(random_randint_fn=random_randint_fn),
            _random_h_range(random_randint_fn=random_randint_fn),
        ]
        # Ensure unique range strings.
        while len(set(h_values)) < 4:
            h_values = [
                _random_h_range(random_randint_fn=random_randint_fn),
                _random_h_range(random_randint_fn=random_randint_fn),
                _random_h_range(random_randint_fn=random_randint_fn),
                _random_h_range(random_randint_fn=random_randint_fn),
            ]
        h1, h2, h3, h4 = h_values
    else:
        h_values = random_sample_fn(range(5, 2147483648), 4)
        h1, h2, h3, h4 = [str(value) for value in h_values]

    return {
        "Jc": jc,
        "Jmin": jmin,
        "Jmax": jmax,
        "S1": s1,
        "S2": s2,
        "S3": s3,
        "S4": s4,
        "H1": h1,
        "H2": h2,
        "H3": h3,
        "H4": h4,
        "I1": None,
        "I2": None,
        "I3": None,
        "I4": None,
        "I5": None,
    }


def prepare_awg_params_for_version(
    awg_version,
    *,
    generate_awg_obfuscation_params_fn,
    detect_awg_version_fn,
):
    awg_params = generate_awg_obfuscation_params_fn(awg_version)
    if detect_awg_version_fn(awg_version, awg_params) == "1":
        for key in ("S3", "S4", "I1", "I2", "I3", "I4", "I5"):
            awg_params[key] = None
    return awg_params


def parse_h_value_or_range(value, *, normalize_config_value_fn):
    normalized = normalize_config_value_fn(value)
    if normalized is None:
        return None
    if re.fullmatch(r"\d+", normalized):
        num = int(normalized)
        if num < 0 or num > 4294967295:
            raise ValueError("H1-H4 numeric values must be in range 0..4294967295")
        return (num, num)
    match = re.fullmatch(r"(\d+)-(\d+)", normalized)
    if not match:
        raise ValueError('H1-H4 must be single number or range "x-y"')
    start = int(match.group(1))
    end = int(match.group(2))
    if start < 0 or end < 0 or start > 4294967295 or end > 4294967295 or start > end:
        raise ValueError("Invalid H1-H4 range")
    return (start, end)


def validate_awg_params(
    awg_version,
    awg_params,
    *,
    detect_awg_version_fn,
    normalize_config_value_fn,
    parse_h_value_or_range_fn,
):
    awg_version = detect_awg_version_fn(awg_version, awg_params)

    def _int_in_range(key, minimum, maximum):
        val = normalize_config_value_fn(awg_params.get(key))
        if val is None:
            return
        try:
            num = int(val)
        except ValueError:
            raise ValueError(f"{key} must be an integer")
        if num < minimum or num > maximum:
            raise ValueError(f"{key} must be in range {minimum}..{maximum}")

    _int_in_range("Jc", 0, 128)
    _int_in_range("Jmin", 1, 1280)
    _int_in_range("Jmax", 1, 1280)
    _int_in_range("S1", 0, 1132)
    _int_in_range("S2", 0, 1188)

    if awg_version == "2":
        # Keep backward compatibility with existing presets/installations.
        _int_in_range("S3", 0, 150)
        _int_in_range("S4", 0, 32)

    jmin = normalize_config_value_fn(awg_params.get("Jmin"))
    jmax = normalize_config_value_fn(awg_params.get("Jmax"))
    if jmin is not None and jmax is not None and int(jmin) >= int(jmax):
        raise ValueError("Jmin must be less than Jmax")

    s1 = normalize_config_value_fn(awg_params.get("S1"))
    s2 = normalize_config_value_fn(awg_params.get("S2"))
    if s1 is not None and s2 is not None and int(s1) + 56 == int(s2):
        raise ValueError("S1 + 56 must not equal S2")

    h_ranges = {}
    for key in ("H1", "H2", "H3", "H4"):
        parsed = parse_h_value_or_range_fn(awg_params.get(key))
        if parsed is not None:
            h_ranges[key] = parsed

    # Must be unique and non-overlapping.
    for key_a, range_a in h_ranges.items():
        for key_b, range_b in h_ranges.items():
            if key_a >= key_b:
                continue
            if not (range_a[1] < range_b[0] or range_b[1] < range_a[0]):
                raise ValueError(f"{key_a} and {key_b} ranges must not overlap")


def format_awg_params_for_display(
    awg_version,
    awg_params,
    *,
    get_awg_param_keys_for_version_fn,
    normalize_config_value_fn,
):
    lines = []
    for key in get_awg_param_keys_for_version_fn(awg_version):
        value = normalize_config_value_fn(awg_params.get(key))
        if value is not None:
            lines.append(f"{key}: {value}")
    return lines


def get_filtered_awg_params(
    awg_version,
    awg_params,
    *,
    get_awg_param_keys_for_version_fn,
    normalize_config_value_fn,
):
    filtered = {}
    for key in get_awg_param_keys_for_version_fn(awg_version):
        value = normalize_config_value_fn(awg_params.get(key))
        if value is not None:
            filtered[key] = value
    return filtered


def prompt_awg_version(
    default="2",
    *,
    detect_awg_version_fn,
    input_fn,
    print_fn,
):
    default = detect_awg_version_fn(default, {})
    print_fn("Выберите версию AWG:")
    print_fn("1 - текущая схема (Jc/Jmin/Jmax, S1/S2, H1-H4)")
    print_fn("2 - текущая схема + S3/S4 и I1-I5")
    awg_version = input_fn(f"Версия [по умолчанию {default}]: ").strip() or default
    if awg_version not in ("1", "2"):
        print_fn("Ошибка: поддерживаются только версии 1 и 2")
        return None
    return awg_version


def prompt_version_2_signature_params(awg_params, *, input_fn):
    i1 = input_fn("Введите I1 в формате CPS (Enter чтобы пропустить): ").strip()
    if i1:
        awg_params["I1"] = i1
        for key in ("I2", "I3", "I4", "I5"):
            value = input_fn(f"Введите {key} (Enter чтобы пропустить): ").strip()
            awg_params[key] = value or None
    return awg_params
