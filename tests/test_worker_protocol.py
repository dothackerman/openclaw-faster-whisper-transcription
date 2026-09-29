import importlib.util
import base64
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
    def decode_request(self, length):
        load = {'op': 'load', 'config': {'modelPath': '/tmp', 'device': 'cuda',
                                       'computeType': 'float16', 'beamSize': 5}}
        decode = {'op': 'decode', 'audio': base64.b64encode(bytes(length)).decode()}
        payload = ''.join(json.dumps(r) + '\n' for r in (load, decode)).encode()
        stdin = SimpleNamespace(buffer=io.BytesIO(payload))
        stdout = io.StringIO()
        modules = {'faster_whisper': SimpleNamespace(WhisperModel=lambda *a, **kw: object()),
                   'ctranslate2': SimpleNamespace(get_supported_compute_types=lambda _: {'float16'})}
        with patch.dict('sys.modules', modules), patch('sys.stdin', stdin), patch('sys.stdout', stdout), \
                patch.object(worker, 'decode_mulaw', return_value=SimpleNamespace(any=lambda: False)) as decode_audio:
            worker.main()
        return [json.loads(line) for line in stdout.getvalue().splitlines()], decode_audio

    def test_python_accepts_protocol_maximum(self):
        seconds = 30
        self.assertEqual(worker.MAX_AUDIO, seconds * 8000)
        replies, decode = self.decode_request(seconds * 8000)
        self.assertEqual(replies, [{'ok': True, 'text': '', 'words': []}] * 2)
        self.assertEqual(len(decode.call_args.args[0]), worker.MAX_AUDIO)

    def test_python_rejects_one_byte_over_capacity_before_audio_decode(self):
        replies, decode = self.decode_request(worker.MAX_AUDIO + 1)
        self.assertEqual(replies[-1], {'ok': False, 'error': 'worker_failed'})
        decode.assert_not_called()

    def test_python_rejects_oversized_frame(self):
        stdout = io.StringIO()
        stdin = SimpleNamespace(buffer=io.BytesIO(b' ' * worker.MAX_LINE + b'\n'))
        with patch('sys.stdin', stdin), patch('sys.stdout', stdout):
            worker.main()
        self.assertEqual(json.loads(stdout.getvalue()), {'ok': False, 'error': 'worker_failed'})

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
