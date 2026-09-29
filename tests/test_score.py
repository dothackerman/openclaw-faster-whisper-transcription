import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('score',Path(__file__).resolve().parents[1]/'scripts/score.py')
scorer=importlib.util.module_from_spec(spec);spec.loader.exec_module(scorer)
class ScoreTests(unittest.TestCase):
    def test_normalization_preserves_german_distinctions(self):
        self.assertEqual(scorer.normalize('  Straße, GRÜN!  '),'straße grün')
        self.assertNotEqual(scorer.normalize('Maße'),scorer.normalize('Masse'))
        self.assertEqual(scorer.normalize('gru\u0308n'), 'grün')
    def test_distance_and_micro_average(self):
        self.assertEqual(scorer.distance('abc','axcd'),2)
        rows=[dict(status='ok',reference='one two',text='one three four',cold=False,finalMs=100,firstPartialMs=200),dict(status='ok',reference='',text='hallucination',cold=False,finalMs=200,firstPartialMs=None)]
        result=scorer.score(rows)
        self.assertEqual(result['wer'],1)
        self.assertEqual(result['silenceFalseWords'],1)
        self.assertTrue(result['percentilesExploratory'])
