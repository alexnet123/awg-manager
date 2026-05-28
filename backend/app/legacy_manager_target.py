#!/usr/bin/python3
import importlib
import os


_DEFAULT_MANAGER_MODULE = "backend.app.legacy_manager_compat"
_TARGET_ENV_VAR = "AWG_MANAGER_LEGACY_TARGET_MODULE"


def resolve_manager_module_name(*, env_get_fn=os.environ.get):
    value = env_get_fn(_TARGET_ENV_VAR, _DEFAULT_MANAGER_MODULE)
    value = str(value or "").strip()
    return value or _DEFAULT_MANAGER_MODULE


def load_manager_module(*, import_module_fn=importlib.import_module, env_get_fn=os.environ.get):
    return import_module_fn(resolve_manager_module_name(env_get_fn=env_get_fn))
