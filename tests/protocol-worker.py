#!/usr/bin/python3
"""Run production framing/validation with a deterministic inference substitute.

No model, GPU, resampling, or timing claims: return the decoded payload byte count
and digest to prove every byte crossed the real protocol unchanged.
"""
import hashlib
import importlib.util
from pathlib import Path
import sys
from types import SimpleNamespace

spec = importlib.util.spec_from_file_location(
    'worker', Path(__file__).resolve().parents[1] / 'python/worker.py')
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)


class Audio(bytes):
    def any(self):
        return True


class Model:
    def __init__(self, *args, **kwargs):
        pass

    def transcribe(self, audio, **kwargs):
        text = f'{len(audio)}:{hashlib.sha256(audio).hexdigest()}'
        return [SimpleNamespace(text=text, words=[SimpleNamespace(word=text,start=0,end=len(audio)/8000)])], None


sys.modules['faster_whisper'] = SimpleNamespace(WhisperModel=Model)
sys.modules['ctranslate2'] = SimpleNamespace(get_supported_compute_types=lambda _: {'float16'})
worker.decode_mulaw = Audio
worker.main()
