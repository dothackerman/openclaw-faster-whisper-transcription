import importlib.util
import io
import json
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('worker', Path(__file__).resolve().parents[1] / 'python/worker.py')
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)


class ProtocolTests(unittest.TestCase):
    def failure(self, message):
        def load(*args, **kwargs):
            raise RuntimeError(message)
        request = {'op': 'load', 'config': {'modelPath': '/tmp', 'device': 'cuda', 'computeType': 'float16'}}
        stdin = SimpleNamespace(buffer=io.BytesIO((json.dumps(request)+'\n').encode()))
        stdout = io.StringIO()
        modules = {'faster_whisper': SimpleNamespace(WhisperModel=load),
                   'ctranslate2': SimpleNamespace(get_supported_compute_types=lambda _: {'float16'})}
        with patch.dict('sys.modules', modules), patch('sys.stdin', stdin), patch('sys.stdout', stdout):
            worker.main()
        return json.loads(stdout.getvalue())

    def test_gpu_oom_is_classified_without_native_details(self):
        self.assertEqual(self.failure('CUDA out of memory: synthetic private detail'),
                         {'ok': False, 'error': 'gpu_oom'})

    def test_other_failures_do_not_expose_native_details(self):
        self.assertEqual(self.failure('synthetic transcript and path detail'),
                         {'ok': False, 'error': 'worker_failed'})
