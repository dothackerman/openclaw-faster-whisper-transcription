import importlib.util
import sys
from pathlib import Path
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from score_long import edits
class LongScoreTests(unittest.TestCase):
    def test_missing_and_repeated_words_have_separate_counts(self):
        result=edits('one two three end','one one three end')
        self.assertEqual(result['substitutions']+result['deletions']+result['insertions'],1)
        self.assertFalse(result['tailLastFiveExact'])
        result=edits('one two end','one one two end')
        self.assertEqual(result['insertions'],1)
        self.assertEqual(result['adjacentDuplicateInsertions'],1)
    def test_final_words_and_digital_silence_are_explicit(self):
        self.assertTrue(edits('Bitte das grüne Fahrrad.','Bitte das grüne Fahrrad!')['tailLastFiveExact'])
        self.assertEqual(edits('one two three','one three')['deletions'],1)
        self.assertTrue(edits('','')['tailLastFiveExact'])
        self.assertFalse(edits('','hallucination')['tailLastFiveExact'])
    def test_nonadjacent_phrase_duplication_and_tail_region(self):
        result=edits('the final task was to save the report and close the door',
                     'the final task was to save the report the final task was to save and close the door')
        self.assertEqual(result['repeatedPhraseInsertedWords'],6)
        self.assertGreater(result['tailLastTwentyWordErrors'],0)
