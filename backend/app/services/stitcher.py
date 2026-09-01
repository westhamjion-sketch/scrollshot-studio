from __future__ import annotations

from collections.abc import Callable
from pathlib import Path

import imageio.v2 as imageio
import numpy as np
from PIL import Image, ImageFilter

from app.models import StitchConfig


Progress = Callable[[int, str], None]


class VideoReadError(RuntimeError):
    pass


class ScrollStitcher:
    """Turn a vertical scrolling screen recording into one lossless PNG."""

    def __init__(self, config: StitchConfig) -> None:
        self.config = config

    def run(self, source: Path, output: Path, progress: Progress) -> dict[str, int | float]:
        progress(3, "读取视频信息")
        try:
            reader = imageio.get_reader(str(source))
            metadata = reader.get_meta_data()
            fps = float(metadata["fps"])
            duration = float(metadata["duration"])
            width, height = map(int, metadata["size"])
        except Exception as exc:
            raise VideoReadError("无法读取视频，请确认文件是有效的 MP4/MOV 录屏。") from exc

        # Dense sampling catches animated transition frames rather than useful
        # settled content on modern web apps.  Keep advanced settings as a
        # lower bound, but auto mode never samples faster than ~2 fps.
        interval = max(0.55, min(self.config.sample_interval, 0.60))
        times = np.arange(0, max(duration - 0.04, 0.01), interval)
        frames: list[np.ndarray] = []
        try:
            for index, timestamp in enumerate(times):
                frame_index = min(int(timestamp * fps), int(max(duration - 0.04, 0) * fps))
                frames.append(reader.get_data(frame_index))
                progress(5 + int(31 * (index + 1) / len(times)), "提取关键帧")
        finally:
            reader.close()

        if len(frames) < 2:
            raise VideoReadError("视频过短，至少需要包含两个可分析画面。")

        top = int(height * self.config.content_top_ratio)
        bottom = int(height * self.config.content_bottom_ratio)
        top = max(0, min(top, height - 2))
        bottom = max(top + 1, min(bottom, height))
        top, bottom = self._detect_content_bounds(frames, top, bottom)

        # The old 13% window silently lost content when a page moved farther
        # between two stable frames.  Search up to the largest displacement
        # that still leaves enough overlap to verify the match.
        available = max(4, bottom - top - 80)
        max_shift = min(
            max(int(height * self.config.max_shift_ratio), int(height * 0.45)),
            available,
        )

        raw_shifts: list[int] = []
        scores: list[float] = []
        for index, (before, after) in enumerate(zip(frames, frames[1:])):
            shift, score = self._register(before, after, top, bottom, max_shift)
            if shift < 2:
                shift = 0
            raw_shifts.append(shift)
            scores.append(score)
            progress(38 + int(37 * (index + 1) / (len(frames) - 1)), "追踪滚动轨迹")

        shifts = self._select_scroll_trajectory(
            raw_shifts,
            scores,
            self.config.match_threshold,
        )

        pieces = [frames[0][:bottom]]
        tail = pieces[0][-220:]
        accepted = 0
        appended_pixels = 0
        for index, (frame, shift) in enumerate(zip(frames[1:], shifts)):
            if shift:
                safe_shift = min(shift, bottom - top)
                piece = frame[bottom - safe_shift : bottom]
                repeated = self._repeated_prefix_height(tail, piece)
                if repeated:
                    piece = piece[repeated:]
                if piece.size:
                    pieces.append(piece)
                    tail = np.concatenate((tail, piece), axis=0)[-220:]
                    appended_pixels += int(piece.shape[0])
                    accepted += 1
            progress(76 + int(17 * (index + 1) / len(shifts)), "拼接新增画面")

        # Preserve the final fixed footer once, and only once.
        pieces.append(frames[-1][bottom:])
        canvas = np.concatenate(pieces, axis=0)
        output.parent.mkdir(parents=True, exist_ok=True)
        Image.fromarray(canvas).save(output, format="PNG", optimize=True)
        progress(100, "长图已生成")
        return {
            "width": int(canvas.shape[1]),
            "height": int(canvas.shape[0]),
            "duration": duration,
            "accepted_moves": accepted,
            "scroll_pixels": appended_pixels,
        }

    @staticmethod
    def _select_scroll_trajectory(
        raw_shifts: list[int],
        scores: list[float],
        configured_threshold: float,
    ) -> list[int]:
        """Accept real scrolling using this video's own score distribution.

        Repetitive cards often score worse than static text even when their
        displacement is correct.  A robust per-video threshold handles normal
        variation, while a bounded continuity bridge preserves a difficult
        frame only when valid motion exists on both sides.
        """
        candidate_scores = np.asarray(
            [score for shift, score in zip(raw_shifts, scores) if shift > 0],
            dtype=np.float32,
        )
        adaptive_threshold = float(configured_threshold)
        if candidate_scores.size >= 4:
            median = float(np.median(candidate_scores))
            deviation = float(np.median(np.abs(candidate_scores - median)))
            distribution_limit = max(
                median + 3.0 * deviation,
                float(np.percentile(candidate_scores, 90)) + 2.0,
            )
            adaptive_threshold = max(
                adaptive_threshold,
                min(32.0, distribution_limit),
            )

        continuity_limit = max(32.0, min(36.0, configured_threshold + 14.0))
        selected: list[int] = []
        for index, (shift, score) in enumerate(zip(raw_shifts, scores)):
            previous_moves = index > 0 and raw_shifts[index - 1] > 0
            next_moves = index + 1 < len(raw_shifts) and raw_shifts[index + 1] > 0
            continuous_bridge = (previous_moves or next_moves) and score <= continuity_limit
            selected.append(
                shift if shift > 0 and (score <= adaptive_threshold or continuous_bridge) else 0
            )

        # Dynamic cards and maps can re-render without scrolling. Suppress a
        # lone, low-confidence jump surrounded by still frames.
        for index in range(1, len(selected) - 1):
            neighbor_score = max(scores[index - 1], scores[index + 1])
            if (
                selected[index] > 0
                and selected[index - 1] == 0
                and selected[index + 1] == 0
                and scores[index]
                > max(configured_threshold * 0.25, neighbor_score * 3.0)
            ):
                selected[index] = 0
        return selected

    @staticmethod
    def _repeated_prefix_height(previous_tail: np.ndarray, piece: np.ndarray) -> int:
        """Find a verified vertical overlap at an append seam.

        Dynamic maps and cards may repaint between frames and make registration
        overestimate a move.  Only textured, near-identical overlaps are removed;
        blank backgrounds and merely similar cards are left untouched.
        """
        limit = min(220, len(previous_tail), len(piece) - 3)
        if limit < 8:
            return 0

        width = piece.shape[1]
        side = max(8, int(width * 0.055))
        previous = previous_tail[:, side:-side].astype(np.float32)
        current = piece[:, side:-side].astype(np.float32)
        repeated = 0
        for overlap in range(8, limit + 1, 2):
            left = previous[-overlap:]
            right = current[:overlap]
            texture = float(np.mean(np.abs(np.diff(left, axis=0))))
            if texture < 3.0:
                continue
            score = float(np.mean(np.abs(left - right)))
            if score < 7.0:
                repeated = overlap
        return repeated

    @classmethod
    def _detect_content_bounds(
        cls,
        frames: list[np.ndarray],
        fallback_top: int,
        fallback_bottom: int,
    ) -> tuple[int, int]:
        """Infer fixed chrome and floating controls from temporal stability.

        Page content changes position while screen-fixed controls keep the same
        textured pixels.  The detector only studies pairs with real activity,
        so pauses and large blank backgrounds do not look like fixed UI.
        """
        if len(frames) < 4:
            return fallback_top, fallback_bottom

        height, width = frames[0].shape[:2]
        side = max(4, int(width * 0.04))
        sample_indexes = np.linspace(0, len(frames) - 1, min(len(frames), 48), dtype=int)
        grays = [cls._grayscale_full(frames[index]) for index in sample_indexes]
        differences = [np.abs(after - before) for before, after in zip(grays, grays[1:])]
        if not differences:
            return fallback_top, fallback_bottom

        activity_top, activity_bottom = int(height * 0.14), int(height * 0.82)
        activities = np.asarray(
            [
                np.mean(diff[activity_top:activity_bottom, side:-side] > 8.0)
                for diff in differences
            ],
            dtype=np.float32,
        )
        cutoff = max(0.01, float(np.percentile(activities, 45)))
        moving = [diff for diff, activity in zip(differences, activities) if activity >= cutoff]
        if len(moving) < 3:
            return fallback_top, fallback_bottom

        stable_count = np.zeros((height, width), dtype=np.uint16)
        for difference in moving:
            stable_count += difference < 5.0
        stable = stable_count >= max(2, int(len(moving) * 0.72))

        representative = grays[0]
        gradient_y = np.abs(np.diff(representative, axis=0, prepend=representative[:1]))
        gradient_x = np.abs(np.diff(representative, axis=1, prepend=representative[:, :1]))
        fixed_features = stable & ((gradient_x + gradient_y) > 10.0)

        row_score = np.mean(fixed_features[:, side:-side], axis=1)
        top = fallback_top
        header_rows = np.flatnonzero(
            (row_score > 0.64) & (np.arange(height) < int(height * 0.30))
        )
        if header_rows.size:
            top = max(top, min(int(header_rows[-1] + height * 0.02), int(height * 0.25)))

        bottom = fallback_bottom
        footer_rows = np.flatnonzero(
            (row_score > 0.64) & (np.arange(height) > int(height * 0.52))
        )
        if footer_rows.size:
            # A divider is usually inside the fixed control, not at its top.
            bottom = min(bottom, int(footer_rows[0] - height * 0.115))

        floating_top = cls._lowest_fixed_component_top(fixed_features)
        if floating_top is not None:
            bottom = min(bottom, floating_top - max(4, int(height * 0.008)))

        top = max(0, min(top, height - 82))
        bottom = max(top + 80, min(bottom, height))
        return top, bottom

    @staticmethod
    def _grayscale_full(frame: np.ndarray) -> np.ndarray:
        return (
            frame[..., 0].astype(np.float32) * 0.299
            + frame[..., 1].astype(np.float32) * 0.587
            + frame[..., 2].astype(np.float32) * 0.114
        )

    @staticmethod
    def _lowest_fixed_component_top(mask: np.ndarray) -> int | None:
        """Return the top of a screen-fixed floating control in the lower half."""
        height, width = mask.shape
        reduced = Image.fromarray(mask.astype(np.uint8) * 255).resize(
            (max(1, width // 2), max(1, height // 2)),
            Image.Resampling.NEAREST,
        )
        connected = reduced.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.MinFilter(5))
        pixels = np.asarray(connected) > 0
        seen = np.zeros_like(pixels, dtype=bool)
        min_width = max(8, int(width * 0.03))
        min_height = max(6, int(height * 0.015))
        candidates: list[int] = []

        for start_y, start_x in zip(*np.nonzero(pixels & ~seen)):
            if seen[start_y, start_x]:
                continue
            stack = [(int(start_y), int(start_x))]
            seen[start_y, start_x] = True
            min_x = max_x = int(start_x)
            min_y = max_y = int(start_y)
            count = 0
            while stack:
                y, x = stack.pop()
                count += 1
                min_x, max_x = min(min_x, x), max(max_x, x)
                min_y, max_y = min(min_y, y), max(max_y, y)
                for next_y, next_x in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                    if (
                        0 <= next_y < pixels.shape[0]
                        and 0 <= next_x < pixels.shape[1]
                        and pixels[next_y, next_x]
                        and not seen[next_y, next_x]
                    ):
                        seen[next_y, next_x] = True
                        stack.append((next_y, next_x))

            component_width = (max_x - min_x + 1) * 2
            component_height = (max_y - min_y + 1) * 2
            component_top = min_y * 2
            if (
                count >= 20
                # Only lower-screen overlays constrain the append seam. A map
                # control or carousel button in the page body is real content.
                and component_top > height * 0.65
                and component_width >= min_width
                and component_height >= min_height
                and component_width <= width * 0.62
            ):
                candidates.append(component_top)

        return min(candidates) if candidates else None

    @staticmethod
    def _register(
        before: np.ndarray,
        after: np.ndarray,
        top: int,
        bottom: int,
        max_shift: int,
    ) -> tuple[int, float]:
        height, width = before.shape[:2]
        side = max(8, int(width * 0.055))
        analysis_top = max(top + 10, int(height * 0.12))
        analysis_bottom = min(bottom - 10, int(height * 0.81))

        def grayscale(frame: np.ndarray) -> np.ndarray:
            crop = frame[analysis_top:analysis_bottom, side : width - side]
            gray = ScrollStitcher._grayscale_full(crop)
            return gray[::2, ::2]

        a, b = grayscale(before), grayscale(after)
        best_score, best_shift = float("inf"), 0
        for shift in range(max_shift // 2 + 1):
            left, right = (a, b) if shift == 0 else (a[shift:], b[:-shift])
            if left.size == 0:
                continue
            score = float(np.mean(np.abs(left - right)))
            if score < best_score:
                best_score, best_shift = score, shift * 2
        return best_shift, best_score
