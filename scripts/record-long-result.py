#!/usr/bin/env python3
"""Append sanitized aggregate evidence; never publish raw transcript/audio or paths."""
import argparse
import hashlib
import json
from pathlib import Path
from score_long import edits
from score import report

p=argparse.ArgumentParser();p.add_argument('run');p.add_argument('id');p.add_argument('decision');p.add_argument('--profile',required=True);a=p.parse_args()
raw=Path(a.run).read_bytes();run=json.loads(raw)
ledger=Path('research/experiments.jsonl')
existing=[json.loads(line) for line in ledger.read_text().splitlines() if line]
if any(row.get('id')==a.id for row in existing): raise SystemExit('Record already exists; append a new decision ID instead')
rows=run['rows'];summary=report(run)
telemetry=[v['values'][1] for v in run.get('telemetry',[]) if len(v['values'])>1]
record=dict(id=a.id,kind='long-duration-synthetic',utc=run['utc'],commit=run['commit'],dirty=run['dirty'],
 longScorerSha256=hashlib.sha256(Path('scripts/score_long.py').read_bytes()).hexdigest(),profile=a.profile,mode=run.get('mode'),incomplete=run['incomplete'],artifactSha256=hashlib.sha256(raw).hexdigest(),
 manifestSha256=run['manifestSha256'],modelSha256=run['modelSha256'],harnessSha256=run['harnessSha256'],workerSha256=run['workerSha256'],sourceHashes=run.get('sourceHashes'),
 config={k:v for k,v in run['config'].items() if k not in ('python','modelPath')},gpuIdentity=run['gpuIdentity'],versions=run['versions'].splitlines(),
 summary=summary,meanGpuUtilization=sum(telemetry)/len(telemetry) if telemetry else None,
 rows=[dict(fixture=r['fixture'],sha256=r['sha256'],seconds=r['seconds'],status=r['status'],error=r.get('error'),readyMs=r.get('readyMs'),finalMs=r.get('finalMs'),
            metrics=r.get('metrics'),edits=edits(r['reference'],r['text']) if r['status']=='ok' else None) for r in rows],decision=a.decision)
with ledger.open('a') as f:f.write(json.dumps(record,ensure_ascii=False,separators=(',',':'))+'\n')
print(a.id)
