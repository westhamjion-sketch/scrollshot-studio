from __future__ import annotations

import unittest

import numpy as np

from app.services.stitcher import ScrollStitcher


class ContentBoundsTests(unittest.TestCase):
    def test_detects_fixed_footer_without_treating_page_as_fixed(self) -> None:
        height, width = 240, 120
        rng = np.random.default_rng(7)
        document = rng.integers(0, 255, (height * 3, width, 3), dtype=np.uint8)
        frames: list[np.ndarray] = []

        for offset in range(0, 144, 16):
            frame = document[offset : offset + height].copy()
            frame[:28] = 245
            frame[22:25, 8:-8] = 25
            frame[204:] = 248
            frame[204:208, :] = 20
            frame[218:222, 12:108] = 45
            frames.append(frame)

        top, bottom = ScrollStitcher._detect_content_bounds(frames, 20, 225)

        self.assertGreaterEqual(top, 20)
        self.assertLess(bottom, 204)
        self.assertGreater(bottom - top, 80)

    def test_detects_floating_control_above_footer(self) -> None:
        height, width = 240, 120
        rng = np.random.default_rng(11)
        document = rng.integers(0, 255, (height * 3, width, 3), dtype=np.uint8)
        frames: list[np.ndarray] = []

        for offset in range(0, 144, 16):
            frame = document[offset : offset + height].copy()
            frame[:24] = 250
            frame[210:] = 250
            frame[210:214] = 15
            # A textured, screen-fixed floating button.
            frame[164:190, 47:73] = 240
            frame[164:190, 47:51] = 10
            frame[164:190, 69:73] = 10
            frame[164:168, 47:73] = 10
            frame[186:190, 47:73] = 10
            frame[174:178, 56:64] = 10
            frames.append(frame)

        _, bottom = ScrollStitcher._detect_content_bounds(frames, 20, 225)

        self.assertLessEqual(bottom, 164)

    def test_trims_only_verified_textured_overlap(self) -> None:
        rng = np.random.default_rng(19)
        previous = rng.integers(0, 255, (100, 80, 3), dtype=np.uint8)
        continuation = rng.integers(0, 255, (35, 80, 3), dtype=np.uint8)
        piece = np.concatenate((previous[-24:], continuation), axis=0)

        repeated = ScrollStitcher._repeated_prefix_height(previous, piece)

        self.assertEqual(repeated, 24)

        blank_previous = np.full((100, 80, 3), 245, dtype=np.uint8)
        blank_piece = np.full((40, 80, 3), 245, dtype=np.uint8)
        self.assertEqual(
            ScrollStitcher._repeated_prefix_height(blank_previous, blank_piece),
            0,
        )

    def test_adaptive_trajectory_bridges_a_difficult_real_scroll(self) -> None:
        shifts = [0, 120, 84, 142, 0]
        scores = [1.0, 14.0, 25.6, 15.0, 1.0]

        selected = ScrollStitcher._select_scroll_trajectory(shifts, scores, 18.0)

        self.assertEqual(selected, shifts)

    def test_adaptive_trajectory_rejects_an_isolated_high_score_jump(self) -> None:
        shifts = [0, 96, 0]
        scores = [1.0, 25.6, 1.0]

        selected = ScrollStitcher._select_scroll_trajectory(shifts, scores, 18.0)

        self.assertEqual(selected, [0, 0, 0])

    def test_adaptive_trajectory_keeps_a_difficult_scroll_at_burst_edge(self) -> None:
        shifts = [0, 156, 72, 40]
        scores = [1.0, 24.3, 15.0, 12.0]

        selected = ScrollStitcher._select_scroll_trajectory(shifts, scores, 18.0)

        self.assertEqual(selected, shifts)

    def test_adaptive_trajectory_keeps_a_hard_confidence_ceiling(self) -> None:
        shifts = [20, 80, 90, 70, 20]
        scores = [10.0, 14.0, 45.0, 15.0, 11.0]

        selected = ScrollStitcher._select_scroll_trajectory(shifts, scores, 18.0)

        self.assertEqual(selected[2], 0)


if __name__ == "__main__":
    unittest.main()
