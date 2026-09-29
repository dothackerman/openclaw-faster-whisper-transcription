#!/usr/bin/python3
"""Synthetic transport fixture. No audio decoding or production model imports."""
import json
import sys
import time

for line in sys.stdin:
    request = json.loads(line)
    if request['op'] == 'load':
        mode = request['config']['model']
        if mode == 'load-hang':
            time.sleep(60)
        print(json.dumps({'ok': True, 'text': ''}), flush=True)
    elif mode == 'crash':
        sys.exit(9)
    elif mode == 'oom':
        print(json.dumps({'ok': False, 'error': 'gpu_oom'}), flush=True)
    elif mode == 'oversize':
        print('x' * 70000, flush=True)
    elif mode == 'hang':
        time.sleep(60)
    else:
        print('synthetic private diagnostic', file=sys.stderr, flush=True)
        print(json.dumps({'ok': True, 'text': 'Synthetic result.'}), flush=True)
