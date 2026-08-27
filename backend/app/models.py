from __future__ import annotations

from dataclasses import asdict, dataclass, field
from threading import Lock
from typing import Literal


JobState = Literal["queued", "analyzing", "stitching", "done", "failed"]


@dataclass(slots=True)
class StitchConfig:
    sample_interval: float = 0.20
    content_top_ratio: float = 0.108
    content_bottom_ratio: float = 0.833
    max_shift_ratio: float = 0.13
    match_threshold: float = 18.0


@dataclass(slots=True)
class Job:
    id: str
    filename: str
    source_path: str
    output_path: str
    config: StitchConfig
    state: JobState = "queued"
    progress: int = 0
    stage: str = "等待处理"
    error: str | None = None
    width: int | None = None
    height: int | None = None
    duration: float | None = None
    accepted_moves: int = 0
    scroll_pixels: int = 0
    lock: Lock = field(default_factory=Lock, repr=False)

    def update(self, **values: object) -> None:
        with self.lock:
            for key, value in values.items():
                setattr(self, key, value)

    def public(self) -> dict[str, object]:
        with self.lock:
            data: dict[str, object] = {
                "id": self.id,
                "filename": self.filename,
                "state": self.state,
                "progress": self.progress,
                "stage": self.stage,
                "error": self.error,
                "width": self.width,
                "height": self.height,
                "duration": self.duration,
                "accepted_moves": self.accepted_moves,
                "scroll_pixels": self.scroll_pixels,
                "config": asdict(self.config),
            }
        if self.state == "done":
            data["image_url"] = f"/api/jobs/{self.id}/image"
            data["download_url"] = f"/api/jobs/{self.id}/download"
        return data
