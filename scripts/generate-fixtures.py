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
fixtures = [
 ('en-short','en','Please open the window and bring a glass of water.'),
 ('de-short','de','Bitte öffne das Fenster und bring ein Glas Wasser.'),
 ('en-technical','en','The new browser plugin runs locally. Review the final message before sending it. We will test three microphones on Friday.'),
 ('de-technical','de','Das neue Plugin läuft auf diesem Computer. Bitte prüfe den Text vor dem Senden. Am Freitag testen wir drei Mikrofone.'),
 ('mixed','de','Bitte starte den Browser. The final message is ready for review.'),
 ('silence','none',''),
]
manifest = {'version':1,'provenance':{'kind':'synthetic','engine':'eSpeak NG','version':version,'sourceRate':rate,'resampler':'scipy.signal.resample_poly','note':'Self-authored scripts; no recorded voices or private content. Not evidence of real microphone quality.'},'fixtures':[]}
ROOT.mkdir(parents=True, exist_ok=True)
for name,language,text in fixtures:
    chunks.clear()
    if text:
        assert lib.espeak_SetVoiceByName(language.encode()) == 0
        encoded = text.encode()+b'\0'
        assert lib.espeak_Synth(encoded,len(encoded),0,1,0,1,None,None) == 0
        lib.espeak_Synchronize()
        pcm = np.frombuffer(b''.join(chunks),dtype='<i2').astype(np.float32)
        pcm = resample_poly(pcm,160,441).clip(-32768,32767).astype('<i2')
        pcm = np.concatenate([np.zeros(1600,dtype='<i2'),pcm,np.zeros(2400,dtype='<i2')])
        audio = audioop.lin2ulaw(pcm.tobytes(),2)
    else:
        audio = bytes([255])*24000
    assert len(audio)<=240000
    path = ROOT / f'{name}.ulaw'
    path.write_bytes(audio)
    manifest['fixtures'].append({'id':name,'file':path.name,'sha256':hashlib.sha256(audio).hexdigest(),'seconds':len(audio)/8000,'reference':text,'language':language,'mic':'synthetic','split':'development'})
(ROOT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(f'Generated {len(fixtures)} synthetic fixtures with eSpeak NG {version}')
