from __future__ import annotations

from collections.abc import Callable
from pathlib import Path

import imageio.v2 as imageio
import numpy as np
from PIL import Image

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

        interval = max(0.10, min(self.config.sample_interval, 0.60))
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
        max_shift = max(4, int(height * self.config.max_shift_ratio))

        shifts: list[int] = []
        scores: list[float] = []
        for index, (before, after) in enumerate(zip(frames, frames[1:])):
            shift, score = self._register(before, after, top, bottom, max_shift)
            if score > self.config.match_threshold or shift < 2:
                shift = 0
            shifts.append(shift)
            scores.append(score)
            progress(38 + int(37 * (index + 1) / (len(frames) - 1)), "追踪滚动轨迹")

        # Dynamic cards and maps can re-render without scrolling. Suppress a lone,
        # low-confidence jump surrounded by still frames.
        for index in range(1, len(shifts) - 1):
            if (
                shifts[index] > max_shift * 0.72
                and shifts[index - 1] == 0
                and shifts[index + 1] == 0
                and scores[index] > self.config.match_threshold * 0.56
            ):
                shifts[index] = 0

        pieces = [frames[0][:bottom]]
        accepted = 0
        for index, (frame, shift) in enumerate(zip(frames[1:], shifts)):
            if shift:
                safe_shift = min(shift, bottom - top)
                pieces.append(frame[bottom - safe_shift : bottom])
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
            "scroll_pixels": int(sum(shifts)),
        }

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
            gray = (
                crop[..., 0].astype(np.float32) * 0.299
                + crop[..., 1].astype(np.float32) * 0.587
                + crop[..., 2].astype(np.float32) * 0.114
            )
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

