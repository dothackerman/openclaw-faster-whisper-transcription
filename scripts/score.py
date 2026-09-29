#!/usr/bin/env python3
"""Frozen lexical scorer v1: NFC + lower (preserves ß) + punctuation removal.
Apostrophes/hyphens are removed without splitting; whitespace is collapsed.
Edit distance is micro-averaged. Empty-reference false positives are separate.
"""
import argparse
import hashlib
import json
import unicodedata
from pathlib import Path


def normalize(text):
    return ' '.join(''.join(c for c in unicodedata.normalize('NFC', text).lower()
                           if not unicodedata.category(c).startswith('P')).split())


def distance(a, b):
    row = list(range(len(b)+1))
    for i, x in enumerate(a, 1):
        following = [i]
        for j, y in enumerate(b, 1):
            following.append(min(following[-1]+1,row[j]+1,row[j-1]+(x != y)))
        row = following
    return row[-1]


def percentile(values, fraction):
    if not values:
        return None
    values = sorted(values)
    import math
    return values[max(0,math.ceil(len(values)*fraction)-1)]


def score(rows):
    words = chars = word_errors = char_errors = false_words = 0
    for row in rows:
        if row['status'] != 'ok':
            continue
        a, b = normalize(row['reference']), normalize(row['text'])
        if not a:
            false_words += len(b.split())
            continue
        words += len(a.split()); chars += len(a)
        word_errors += distance(a.split(), b.split()); char_errors += distance(a, b)
    warm = [r for r in rows if r['status']=='ok' and not r['cold']]
    finals=[r['finalMs'] for r in warm]
    partials=[r['firstPartialMs'] for r in warm if r['firstPartialMs'] is not None]
    return dict(n=len(rows),failures=sum(r['status']!='ok' for r in rows),words=words,wordErrors=word_errors,
                chars=chars,charErrors=char_errors,wer=word_errors/words if words else None,
                cer=char_errors/chars if chars else None,silenceFalseWords=false_words,
                warmFinalP50=percentile(finals,.5),warmFinalP95=percentile(finals,.95),
                warmPartialP50=percentile(partials,.5),warmPartialP95=percentile(partials,.95),
                warmLatencyCount=len(finals),percentilesExploratory=len(finals)<20)


def report(run):
    return {'scorer':'lexical-v1','scorerSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
            'summary':score(run['rows']),
            'languages':{lang:score([r for r in run['rows'] if r['language']==lang]) for lang in sorted({r['language'] for r in run['rows']})},
            'baselineMemoryMiB':run['baselineMemoryMiB'],'peakMemoryMiB':run['peakMemoryMiB'],
            'incrementalPeakMemoryMiB':run['peakMemoryMiB']-run['baselineMemoryMiB'] if run['peakMemoryMiB'] is not None and run['baselineMemoryMiB'] is not None else None}


if __name__ == '__main__':
    parser=argparse.ArgumentParser();parser.add_argument('run');args=parser.parse_args()
    print(json.dumps(report(json.loads(Path(args.run).read_text())),indent=2))
