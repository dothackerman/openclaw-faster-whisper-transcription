#!/usr/bin/env python3
"""Generate self-authored synthetic transport fixtures with system eSpeak NG.
Not a microphone-quality corpus. Python 3.12 is required for audioop.
"""
import audioop
import ctypes as C
import hashlib
import json
from pathlib import Path
import numpy as np
from scipy.signal import resample_poly

ROOT = Path(__file__).resolve().parents[1] / 'fixtures/public'
lib = C.CDLL('libespeak-ng.so.1')
lib.espeak_Initialize.argtypes = [C.c_int, C.c_int, C.c_char_p, C.c_int]
rate = lib.espeak_Initialize(2, 0, None, 0)
assert rate == 22050, rate
lib.espeak_Info.restype = C.c_char_p
version = lib.espeak_Info(None).decode()
chunks = []
CALLBACK = C.CFUNCTYPE(C.c_int, C.POINTER(C.c_short), C.c_int, C.c_void_p)
@CALLBACK
def collect(samples, count, _events):
    if samples and count:
        chunks.append(C.string_at(samples, count*2))
    return 0
lib.espeak_SetSynthCallback(collect)
lib.espeak_SetVoiceByName.argtypes = [C.c_char_p]
lib.espeak_Synth.argtypes = [C.c_void_p, C.c_size_t, C.c_uint, C.c_int, C.c_uint, C.c_uint, C.c_void_p, C.c_void_p]

lib.espeak_SetParameter.argtypes = [C.c_int, C.c_int, C.c_int]
assert lib.espeak_SetParameter(1, 170, 0) == 0
scripts = json.loads((ROOT / 'long-scripts.json').read_text())
def synth(language, text):
    chunks.clear()
    assert lib.espeak_SetVoiceByName(language.encode()) == 0
    encoded = text.encode()+b'\0'
    assert lib.espeak_Synth(encoded,len(encoded),0,1,0,1,None,None) == 0
    lib.espeak_Synchronize()
    pcm = np.frombuffer(b''.join(chunks),dtype='<i2').astype(np.float32)
    pcm = resample_poly(pcm,160,441).clip(-32768,32767).astype('<i2')
    return audioop.lin2ulaw(pcm.tobytes(),2)
manifest = {'version':1,'provenance':{'kind':'synthetic','engine':'eSpeak NG','version':version,'speed':170,'note':'Self-authored non-looped scripts. Sentence/paragraph voices en/de. Silence padding and synthetic articulation are not microphone or Swiss-German acceptance.'},'fixtures':[]}
for item in scripts['rapid'] + [{'id':'long-five-minute','language':'mixed','parts':scripts['long']}]:
    parts = [synth(lang,text) for lang,text in item['parts']]
    target = 300 if item['id']=='long-five-minute' else 20
    speech = sum(map(len,parts))
    # Never cut speech to hit a target. A rapid clip may run a little over 20s.
    remaining = max(0, target*8000-speech)
    slots = max(1,len(parts))
    audio = b''.join(bytes([255])*(remaining//slots + (i < remaining%slots)) + part for i,part in enumerate(parts)) if parts else bytes([255])*remaining
    file = item['id']+'.ulaw'; (ROOT/file).write_bytes(audio)
    manifest['fixtures'].append({'id':item['id'],'language':item['language'],'file':file,'sha256':hashlib.sha256(audio).hexdigest(),'seconds':len(audio)/8000,'speechSeconds':speech/8000,'reference':' '.join(text for _,text in item['parts']),'mic':'synthetic','split':'development'})
(ROOT/'long-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
(ROOT/'rapid-manifest.json').write_text(json.dumps({**manifest,'fixtures':manifest['fixtures'][:-1]},ensure_ascii=False,indent=2)+'\n')
(ROOT/'five-minute-manifest.json').write_text(json.dumps({**manifest,'fixtures':manifest['fixtures'][-1:]},ensure_ascii=False,indent=2)+'\n')
print([(x['id'],x['seconds'],x['speechSeconds']) for x in manifest['fixtures']])
