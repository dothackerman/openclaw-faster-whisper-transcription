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

    def test_mixed_complete_and_missing_word_segments_fail_closed(self):
        alpha = SimpleNamespace(text=' alpha', words=[SimpleNamespace(word='alpha', start=0, end=.3)])
        beta = SimpleNamespace(text=' beta', words=None)
        for segments in ([alpha, beta], [beta, alpha]):
            with self.assertRaises(ValueError):
                worker.collect_segments(iter(segments), True)
        beta.words = []
        with self.assertRaises(ValueError):
            worker.collect_segments(iter([alpha, beta]), True)

    def test_mixed_segments_emit_only_generic_error_not_partial_transcript(self):
        segments = [SimpleNamespace(text='alpha', words=[SimpleNamespace(word='alpha', start=0, end=.3)]),
                    SimpleNamespace(text=' beta', words=None)]
        model = SimpleNamespace(transcribe=lambda *a, **kw: (iter(segments), None))
        load = {'op':'load', 'config':{'modelPath':'/tmp', 'device':'cuda', 'computeType':'float16', 'beamSize':5}}
        decode = {'op':'decode', 'audio':base64.b64encode(b'\x00' * 8000).decode(), 'timestamps':True}
        stdin = SimpleNamespace(buffer=io.BytesIO((''.join(json.dumps(r)+'\n' for r in [load,decode])).encode()))
        stdout = io.StringIO()
        modules = {'faster_whisper':SimpleNamespace(WhisperModel=lambda *a, **kw:model),
                   'ctranslate2':SimpleNamespace(get_supported_compute_types=lambda _: {'float16'})}
        with patch.dict('sys.modules', modules), patch('sys.stdin', stdin), patch('sys.stdout', stdout), \
                patch.object(worker, 'decode_mulaw', return_value=SimpleNamespace(any=lambda:True)):
            worker.main()
        self.assertEqual([json.loads(line) for line in stdout.getvalue().splitlines()],
                         [{'ok':True, 'text':'', 'words':[]}, {'ok':False, 'error':'worker_failed'}])

    def test_each_segment_must_cover_its_own_text(self):
        # Global equality alone would miss words assigned to the wrong segment.
        word = lambda text: SimpleNamespace(word=text, start=0, end=.3)
        segments = [SimpleNamespace(text='alpha', words=[word('alpha beta')]),
                    SimpleNamespace(text=' beta', words=[])]
        with self.assertRaises(ValueError):
            worker.collect_segments(iter(segments), True)

    def test_coverage_preserves_lexical_content_ignoring_formatting(self):
        words = [SimpleNamespace(word="älpha DONT 2", start=0, end=.3)]
        text, actual = worker.collect_segments([SimpleNamespace(text="ÄLPHA, don't! ２", words=words)], True)
        self.assertEqual(len(actual), 1)
        for text in ('älpha DONT 2 beta', 'älpha DONT'):
            with self.assertRaises(ValueError):
                worker.collect_segments([SimpleNamespace(text=text, words=words)], True)
        self.assertEqual(worker.collect_segments([SimpleNamespace(text='hello', words=None)], False), ('hello', []))

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
