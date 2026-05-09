#!/usr/bin/python3

# Backward-compatibility shim.
# Canonical API implementation lives in api_core.py.
from api_core import AWGManagerAPIHandler, start_api_server, main


if __name__ == '__main__':
    main()
