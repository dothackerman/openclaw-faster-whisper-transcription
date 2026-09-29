#!/usr/bin/env python3
"""Explicit provisioning only; never called by Gateway activation or npm install."""
import argparse
import json
import pathlib
import subprocess
import sys
import venv

parser = argparse.ArgumentParser()
parser.add_argument('--root', type=pathlib.Path, required=True, help='New dedicated runtime directory')
parser.add_argument('--gpu', action='store_true')
args = parser.parse_args()
root = args.root.resolve()
if root.exists():
    parser.error('runtime root already exists; choose a new versioned directory')
root.mkdir(parents=True, mode=0o700)
venv.create(root / 'venv', with_pip=True)
python = root / 'venv/bin/python'
requirements = pathlib.Path(__file__).resolve().parents[1] / 'python' / ('requirements-gpu.lock' if args.gpu else 'requirements.lock')
subprocess.run([str(python), '-m', 'pip', 'install', '--disable-pip-version-check', '-r', str(requirements)], check=True)
frozen = subprocess.check_output([str(python), '-m', 'pip', 'freeze'], text=True)
(root / 'requirements-resolved.txt').write_text(frozen)
(root / 'runtime.json').write_text(json.dumps({'python':str(python),'gpu':args.gpu,'pythonVersion':sys.version},indent=2)+'\n')
print('Provisioned dedicated environment. Provision a pinned local model separately; see README.')
