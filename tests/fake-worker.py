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
        print(json.dumps({'ok': True, 'text': '', 'words': []}), flush=True)
    elif mode == 'silence':
        print(json.dumps({'ok':True,'text':'','words':[]}),flush=True)
    elif mode == 'uncertain':
        text = '[uncertain: earlier: not approved | later: approved]'
        print(json.dumps({'ok':True,'text':text,'words':[{'text':text,'start':0,'end':0}]}),flush=True)
    elif mode == 'crash':
        sys.exit(9)
    elif mode == 'oom':
        print(json.dumps({'ok': False, 'error': 'gpu_oom'}), flush=True)
    elif mode == 'oversize':
        print('x' * 70000, flush=True)
    elif mode == 'bad-time':
        print(json.dumps({'ok':True,'text':'Synthetic','words':[{'text':'Synthetic','start':0,'end':1000}]}),flush=True)
    elif mode == 'missing-words':
        print(json.dumps({'ok':True,'text':'Synthetic'}),flush=True)
    elif mode == 'partial-coverage':
        print(json.dumps({'ok':True,'text':'alpha beta','words':[{'text':'alpha','start':0,'end':0.3}]}),flush=True)
    elif mode == 'coverage-formatting':
        print(json.dumps({'ok':True,'text':"ÄLPHA, don't! ２",'words':[{'text':"älpha DONT 2",'start':0,'end':0.3}]}),flush=True)
    elif mode == 'hang':
        time.sleep(60)
    else:
        print('synthetic private diagnostic', file=sys.stderr, flush=True)
        print(json.dumps({'ok': True, 'text': 'Synthetic result.', 'words': [{'text':'Synthetic result.','start':0,'end':0}]}), flush=True)
