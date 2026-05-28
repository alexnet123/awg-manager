#!/usr/bin/python3
import importlib

from . import legacy_manager_target


def load_manager(*, import_module_fn=importlib.import_module):
    # Keep legacy module selection in a dedicated target resolver so the
    # final remove-cycle can switch target in one place.
    return legacy_manager_target.load_manager_module(import_module_fn=import_module_fn)


def call_manager_method(method_name, *args, import_module_fn=importlib.import_module, **kwargs):
    manager = load_manager(import_module_fn=import_module_fn)
    return getattr(manager, method_name)(*args, **kwargs)


def get_manager_attr(name, *, import_module_fn=importlib.import_module):
    manager = load_manager(import_module_fn=import_module_fn)
    return getattr(manager, name)
