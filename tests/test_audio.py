import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('worker', Path(__file__).resolve().parents[1] / 'python/worker.py')
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)


class AudioTests(unittest.TestCase):
    def test_silence_and_duration(self):
        import numpy as np
        data = worker.decode_mulaw(bytes([255, 127]) * 4000)
        self.assertEqual(data.dtype, np.float32)
        self.assertEqual(len(data), 16000)
        self.assertFalse(data.any())

    def test_all_codewords_match_independent_g711_decoder(self):
        import audioop
        import numpy as np
        from scipy.signal import resample_poly
        source = bytes(range(256)) * 20
        pcm = np.frombuffer(audioop.ulaw2lin(source, 2), dtype='<i2').astype(np.float32) / 32768
        expected = resample_poly(pcm, 2, 1)
        np.testing.assert_array_equal(worker.decode_mulaw(source), expected)
        self.assertEqual(int.from_bytes(audioop.ulaw2lin(b'\x00', 2), 'little', signed=True), -32124)
        self.assertEqual(int.from_bytes(audioop.ulaw2lin(b'\x80', 2), 'little', signed=True), 32124)

    def test_1khz_tone_preserves_time_pitch_and_level(self):
        import audioop
        import numpy as np
        samples = (np.sin(2*np.pi*1000*np.arange(8000)/8000)*12000).astype('<i2')
        audio = worker.decode_mulaw(audioop.lin2ulaw(samples.tobytes(), 2))
        self.assertEqual(len(audio), 16000)
        self.assertEqual(np.argmax(abs(np.fft.rfft(audio))), 1000)
        self.assertLess(float(abs(audio).max()), 0.4)
        self.assertGreater(float(abs(audio).max()), 0.3)


if __name__ == '__main__':
    unittest.main()
