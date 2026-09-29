#!/usr/bin/env python3
"""Long-dictation diagnostics; same lexical-v1 normalization, explicit edit ties.
No alignment is human ground truth. Failed finals are counted, never scored as
successful empty transcripts. Tail check is exact normalized last-five-word match.
"""
import json
import sys
from pathlib import Path
from score import normalize, report

def edits(reference, hypothesis):
    a,b=normalize(reference).split(),normalize(hypothesis).split()
    d=[[0]*(len(b)+1) for _ in range(len(a)+1)]
    for i in range(len(a)+1): d[i][0]=i
    for j in range(len(b)+1): d[0][j]=j
    for i,x in enumerate(a,1):
        for j,y in enumerate(b,1):
            d[i][j]=min(d[i-1][j-1]+(x!=y),d[i-1][j]+1,d[i][j-1]+1)
    counts=dict(substitutions=0,deletions=0,insertions=0,adjacentDuplicateInsertions=0)
    i,j=len(a),len(b)
    while i or j:
        if i and j and d[i][j]==d[i-1][j-1]+(a[i-1]!=b[j-1]):
            counts['substitutions']+=a[i-1]!=b[j-1];i-=1;j-=1
        elif i and d[i][j]==d[i-1][j]+1:
            counts['deletions']+=1;i-=1
        else:
            counts['insertions']+=1
            counts['adjacentDuplicateInsertions']+=bool((j>1 and b[j-1]==b[j-2]) or (j<len(b) and b[j-1]==b[j]))
            j-=1
    counts['tailLastFiveExact']=bool(a and a[-5:]==b[-5:]) if a else not b
    return counts

if __name__=='__main__':
    run=json.loads(Path(sys.argv[1]).read_text())
    output=report(run)
    output['perFixture']=[dict(fixture=r['fixture'],repeat=r['repeat'],status=r['status'],**(edits(r['reference'],r['text']) if r['status']=='ok' else {})) for r in run['rows']]
    print(json.dumps(output,indent=2))
