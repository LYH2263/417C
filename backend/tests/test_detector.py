import os
import sys
import time
import pytest
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import app.detector as detector_module
from app.detector import get_detector, detect_ai_content


class TestGetDetector:
    """Tests for the get_detector() function."""

    def test_normal_load_success(self, mocker):
        mock_pipeline = mocker.patch("app.detector.pipeline")
        fake_detector = mocker.MagicMock(name="fake_detector")
        mock_pipeline.return_value = fake_detector

        result = get_detector()

        assert result is fake_detector
        mock_pipeline.assert_called_once_with(
            "text-classification", model="distilbert-base-uncased"
        )

    def test_disable_ai_detection_env_var(self, mocker, monkeypatch):
        mock_pipeline = mocker.patch("app.detector.pipeline")
        monkeypatch.setenv("DISABLE_AI_DETECTION", "true")

        result = get_detector()

        assert result is None
        mock_pipeline.assert_not_called()

    def test_disable_ai_detection_env_var_false(self, mocker, monkeypatch):
        mock_pipeline = mocker.patch("app.detector.pipeline")
        mock_pipeline.return_value = mocker.MagicMock()
        monkeypatch.setenv("DISABLE_AI_DETECTION", "false")

        result = get_detector()

        assert result is not None
        mock_pipeline.assert_called_once()

    def test_model_load_exception_fallback(self, mocker):
        mock_pipeline = mocker.patch("app.detector.pipeline")
        mock_pipeline.side_effect = RuntimeError("Model download failed")

        result = get_detector()

        assert result is None
        mock_pipeline.assert_called_once()

    def test_global_cache_second_call_no_reload(self, mocker):
        mock_pipeline = mocker.patch("app.detector.pipeline")
        fake_detector = mocker.MagicMock(name="fake_detector")
        mock_pipeline.return_value = fake_detector

        first = get_detector()
        second = get_detector()

        assert first is second
        assert first is fake_detector
        assert mock_pipeline.call_count == 1

    def test_cache_reset_between_tests(self, mocker):
        mock_pipeline = mocker.patch("app.detector.pipeline")
        mock_pipeline.return_value = mocker.MagicMock()

        get_detector()
        assert detector_module._detector is not None

        detector_module._detector = None

        result = get_detector()
        assert result is not None
        assert mock_pipeline.call_count == 2

    def test_exception_sets_cache_to_none(self, mocker):
        mock_pipeline = mocker.patch("app.detector.pipeline")
        mock_pipeline.side_effect = OSError("Network error")

        get_detector()
        assert detector_module._detector is None

    def test_none_cache_triggers_reload(self, mocker):
        mock_pipeline = mocker.patch("app.detector.pipeline")
        mock_pipeline.side_effect = [OSError("First fail"), mocker.MagicMock()]

        first = get_detector()
        assert first is None

        detector_module._detector = None

        second = get_detector()
        assert second is not None
        assert mock_pipeline.call_count == 2


class TestChunkingLogic:
    """Tests for text chunking logic inside detect_ai_content."""

    @pytest.fixture
    def mock_detector(self, mocker):
        mock_pipeline = mocker.patch("app.detector.pipeline")
        detector_instance = mocker.MagicMock()
        detector_instance.return_value = [{"label": "LABEL_1", "score": 0.5}]
        mock_pipeline.return_value = detector_instance
        return detector_instance

    def test_short_text_single_chunk(self, mock_detector):
        text = "Hello world, this is a short text."
        detect_ai_content(text)

        assert mock_detector.call_count == 1
        call_args = mock_detector.call_args[0][0]
        assert call_args == text

    def test_exact_500_chars_boundary(self, mock_detector):
        text = "a" * 500
        detect_ai_content(text)

        assert mock_detector.call_count == 1
        call_args = mock_detector.call_args[0][0]
        assert len(call_args) == 500

    def test_exact_501_chars_two_chunks(self, mock_detector):
        text = "a" * 500 + "b" * 20
        detect_ai_content(text)

        assert mock_detector.call_count == 2
        calls = mock_detector.call_args_list
        assert len(calls[0][0][0]) == 500
        assert len(calls[1][0][0]) == 20

    def test_long_text_2500_chars_five_chunks(self, mock_detector):
        text = "a" * 2500
        detect_ai_content(text)

        assert mock_detector.call_count == 5
        calls = mock_detector.call_args_list
        for call in calls:
            assert len(call[0][0]) == 500

    def test_empty_string(self, mock_detector):
        result = detect_ai_content("")

        mock_detector.assert_not_called()
        assert result["overall_ai_score"] == 0
        assert result["details"] == []

    def test_pure_whitespace(self, mock_detector):
        result = detect_ai_content("     \t\n   ")

        mock_detector.assert_not_called()
        assert result["overall_ai_score"] == 0
        assert result["details"] == []

    def test_short_whitespace_filtered(self, mock_detector):
        text = "   a   "
        detect_ai_content(text)

        mock_detector.assert_not_called()

    def test_unicode_chinese_chunking(self, mock_detector):
        text = "你" * 500 + "好" * 500
        detect_ai_content(text)

        assert mock_detector.call_count == 2
        calls = mock_detector.call_args_list
        assert calls[0][0][0] == "你" * 500
        assert calls[1][0][0] == "好" * 500

    def test_unicode_emoji_chunking(self, mock_detector):
        text = "😀" * 500
        detect_ai_content(text)

        assert mock_detector.call_count == 1
        call_args = mock_detector.call_args[0][0]
        assert call_args == text
        assert len(call_args) == 500

    def test_mixed_unicode_ascii_chunking(self, mock_detector):
        mixed = "Hello世界" * 70
        text = mixed * 2
        detect_ai_content(text)

        call_count = mock_detector.call_count
        assert call_count >= 1
        total_processed = sum(
            len(call[0][0]) for call in mock_detector.call_args_list
        )
        assert total_processed == len(text)


class TestAIDetectionResults:
    """Tests for AI detection score calculation."""

    @pytest.fixture
    def mock_pipeline(self, mocker):
        return mocker.patch("app.detector.pipeline")

    def test_label_1_score_09(self, mock_pipeline):
        detector_instance = mock_pipeline.return_value
        detector_instance.return_value = [{"label": "LABEL_1", "score": 0.9}]

        result = detect_ai_content("Test text content here enough chars")

        assert len(result["details"]) == 1
        assert result["details"][0]["ai_score"] == 0.9
        assert result["overall_ai_score"] == 90.0

    def test_label_0_score_08(self, mock_pipeline):
        detector_instance = mock_pipeline.return_value
        detector_instance.return_value = [{"label": "LABEL_0", "score": 0.8}]

        result = detect_ai_content("Test text content here enough chars")

        assert len(result["details"]) == 1
        assert result["details"][0]["ai_score"] == pytest.approx(0.2)
        assert result["overall_ai_score"] == pytest.approx(20.0)

    def test_label_other_defaults_to_inverse(self, mock_pipeline):
        detector_instance = mock_pipeline.return_value
        detector_instance.return_value = [{"label": "SOMETHING_ELSE", "score": 0.7}]

        result = detect_ai_content("Test text content here enough chars")

        assert result["details"][0]["ai_score"] == pytest.approx(0.3)
        assert result["overall_ai_score"] == pytest.approx(30.0)

    def test_chunk_exception_returns_05(self, mock_pipeline):
        detector_instance = mock_pipeline.return_value
        detector_instance.side_effect = RuntimeError("Inference error")

        result = detect_ai_content("Test text content here enough chars")

        assert len(result["details"]) == 1
        assert result["details"][0]["ai_score"] == 0.5
        assert result["overall_ai_score"] == 50.0

    def test_partial_exception_does_not_affect_others(self, mock_pipeline):
        detector_instance = mock_pipeline.return_value
        detector_instance.side_effect = [
            [{"label": "LABEL_1", "score": 0.9}],
            RuntimeError("Chunk 2 error"),
            [{"label": "LABEL_0", "score": 0.8}],
        ]

        text = "a" * 500 + "b" * 500 + "c" * 500
        result = detect_ai_content(text)

        assert len(result["details"]) == 3
        assert result["details"][0]["ai_score"] == 0.9
        assert result["details"][1]["ai_score"] == 0.5
        assert result["details"][2]["ai_score"] == pytest.approx(0.2)

    def test_overall_score_average_and_rounding(self, mock_pipeline):
        detector_instance = mock_pipeline.return_value
        detector_instance.side_effect = [
            [{"label": "LABEL_1", "score": 0.5555}],
            [{"label": "LABEL_1", "score": 0.3333}],
        ]

        text = "a" * 500 + "b" * 500
        result = detect_ai_content(text)

        expected_avg = (0.5555 + 0.3333) / 2
        assert result["overall_ai_score"] == round(expected_avg * 100, 2)

    def test_overall_score_rounding_two_decimals(self, mock_pipeline):
        detector_instance = mock_pipeline.return_value
        detector_instance.return_value = [{"label": "LABEL_1", "score": 0.12345}]

        result = detect_ai_content("Test text content here enough chars")

        assert result["overall_ai_score"] == 12.35


class TestFallbackBehavior:
    """Tests for fallback when detector is None."""

    def test_fallback_returns_50_percent(self, mocker, monkeypatch):
        mock_pipeline = mocker.patch("app.detector.pipeline")
        mock_pipeline.side_effect = RuntimeError("Model failure")

        text = "Hello world this is test text content enough chars"
        result = detect_ai_content(text)

        assert result["overall_ai_score"] == 50.0
        assert result["note"] == "模型加载中，当前为模拟数据"
        assert len(result["details"]) == 1
        assert result["details"][0]["ai_score"] == 0.5
        assert result["details"][0]["text"] == text[:500]

    def test_fallback_truncates_long_text(self, mocker, monkeypatch):
        mock_pipeline = mocker.patch("app.detector.pipeline")
        mock_pipeline.side_effect = RuntimeError("Model failure")

        text = "x" * 2000
        result = detect_ai_content(text)

        assert len(result["details"][0]["text"]) == 500


class TestIntegrationScenarios:
    """Integration-level test scenarios."""

    def test_all_chunks_filtered_no_zero_division(self, mocker):
        mock_pipeline = mocker.patch("app.detector.pipeline")
        detector_instance = mock_pipeline.return_value

        text = "    " * 50 + "\t" * 100
        result = detect_ai_content(text)

        detector_instance.assert_not_called()
        assert result["overall_ai_score"] == 0
        assert result["details"] == []

    def test_all_short_chunks_filtered(self, mocker):
        mock_pipeline = mocker.patch("app.detector.pipeline")
        detector_instance = mock_pipeline.return_value

        single_chunk = "a" + " " * 499
        text_full = single_chunk * 5
        assert len(text_full) == 500 * 5

        result = detect_ai_content(text_full)

        detector_instance.assert_not_called()
        assert result["overall_ai_score"] == 0
        assert result["details"] == []

    def test_concurrent_call_thread_safety(self, mocker):
        mock_pipeline = mocker.patch("app.detector.pipeline")
        detector_instance = mock_pipeline.return_value
        detector_instance.return_value = [{"label": "LABEL_1", "score": 0.75}]

        detector_module._detector = None

        texts = [f"Thread test text content number {i} with enough chars" for i in range(10)]

        results = []
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(detect_ai_content, t) for t in texts]
            for future in as_completed(futures):
                results.append(future.result())

        assert len(results) == 10
        for r in results:
            assert "overall_ai_score" in r
            assert "details" in r
            assert r["overall_ai_score"] >= 0
            assert r["overall_ai_score"] <= 100

    def test_long_text_100k_chunks_reasonable(self, mocker):
        mock_pipeline = mocker.patch("app.detector.pipeline")
        detector_instance = mock_pipeline.return_value
        detector_instance.return_value = [{"label": "LABEL_1", "score": 0.5}]

        text = "This is a reasonable length sentence. " * 4000
        assert len(text) >= 100000

        start = time.perf_counter()
        result = detect_ai_content(text)
        elapsed = time.perf_counter() - start

        expected_chunks = len(text) // 500 + (1 if len(text) % 500 > 0 else 0)
        actual_calls = detector_instance.call_count
        assert actual_calls == expected_chunks
        assert actual_calls >= 200
        assert elapsed < 30.0

    def test_result_structure_consistency(self, mocker):
        mock_pipeline = mocker.patch("app.detector.pipeline")
        detector_instance = mock_pipeline.return_value
        detector_instance.return_value = [{"label": "LABEL_1", "score": 0.8}]

        result = detect_ai_content("Valid text content here enough characters to pass filter")

        assert isinstance(result, dict)
        assert "overall_ai_score" in result
        assert "details" in result
        assert isinstance(result["overall_ai_score"], (int, float))
        assert isinstance(result["details"], list)
        for detail in result["details"]:
            assert "text" in detail
            assert "ai_score" in detail
            assert isinstance(detail["ai_score"], float)
