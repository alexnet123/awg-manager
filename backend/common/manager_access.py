#!/usr/bin/python3
import importlib


def get_manager():
    # Resolve facade lazily so tests can swap legacy target module at runtime.
    return importlib.import_module('backend.app.manager_facade')
