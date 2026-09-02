from __future__ import annotations

import os
import shutil
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Lock
from uuid import uuid4

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.models import Job, StitchConfig
from app.services.stitcher import ScrollStitcher


ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = Path(os.environ.get("SCROLLSHOT_DATA_DIR", ROOT / "data" / "jobs"))
FRONTEND_DIST = ROOT / "frontend" / "dist"
ALLOWED_SUFFIXES = {".mp4", ".mov", ".m4v"}
MAX_UPLOAD_BYTES = 500 * 1024 * 1024

app = FastAPI(title="Scrollshot Studio API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "capacitor://localhost",
        "http://localhost",
        "https://localhost",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

jobs: dict[str, Job] = {}
jobs_lock = Lock()
pool = ThreadPoolExecutor(max_workers=2, thread_name_prefix="scrollshot")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/jobs", status_code=202)
async def create_job(
    video: UploadFile = File(...),
    sample_interval: float = Form(0.20),
    content_top_ratio: float = Form(0.108),
    content_bottom_ratio: float = Form(0.833),
) -> dict[str, object]:
    suffix = Path(video.filename or "recording.mp4").suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        raise HTTPException(415, "仅支持 MP4、MOV 或 M4V 视频。")
    if not 0.05 <= content_top_ratio < content_bottom_ratio <= 0.98:
        raise HTTPException(422, "内容区域参数无效。")

    job_id = uuid4().hex[:12]
    job_dir = DATA_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=False)
    source = job_dir / f"source{suffix}"
    output = job_dir / "scrollshot.png"

    size = 0
    with source.open("wb") as destination:
        while chunk := await video.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_UPLOAD_BYTES:
                destination.close()
                shutil.rmtree(job_dir, ignore_errors=True)
                raise HTTPException(413, "视频不能超过 500 MB。")
            destination.write(chunk)

    config = StitchConfig(
        sample_interval=max(0.10, min(sample_interval, 0.60)),
        content_top_ratio=content_top_ratio,
        content_bottom_ratio=content_bottom_ratio,
    )
    job = Job(job_id, video.filename or source.name, str(source), str(output), config)
    with jobs_lock:
        jobs[job_id] = job
    pool.submit(process_job, job)
    return job.public()


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str) -> dict[str, object]:
    return require_job(job_id).public()


@app.get("/api/jobs/{job_id}/image")
def get_image(job_id: str) -> FileResponse:
    job = require_finished_job(job_id)
    return FileResponse(job.output_path, media_type="image/png")


@app.get("/api/jobs/{job_id}/download")
def download_image(job_id: str) -> FileResponse:
    job = require_finished_job(job_id)
    stem = Path(job.filename).stem
    return FileResponse(
        job.output_path,
        media_type="image/png",
        filename=f"{stem}_长图.png",
    )


def process_job(job: Job) -> None:
    try:
        job.update(state="analyzing", progress=1, stage="准备分析")

        def report(progress: int, stage: str) -> None:
            state = "stitching" if progress >= 76 else "analyzing"
            job.update(state=state, progress=progress, stage=stage)

        result = ScrollStitcher(job.config).run(
            Path(job.source_path), Path(job.output_path), report
        )
        job.update(state="done", progress=100, stage="长图已生成", **result)
    except Exception as exc:
        job.update(state="failed", stage="处理失败", error=str(exc))


def require_job(job_id: str) -> Job:
    with jobs_lock:
        job = jobs.get(job_id)
    if not job:
        raise HTTPException(404, "任务不存在或服务已重启。")
    return job


def require_finished_job(job_id: str) -> Job:
    job = require_job(job_id)
    if job.state != "done" or not Path(job.output_path).exists():
        raise HTTPException(409, "长图尚未生成。")
    return job


# Railway exposes one public port. In production the compiled React app is
# served by FastAPI so the browser and API stay on the same HTTPS origin.
# Keep this mount last so it never shadows /api routes.
if FRONTEND_DIST.is_dir():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
