import { ArrowRight, Check, CircleAlert, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Dropzone } from "./components/Dropzone";
import { ResultPanel } from "./components/ResultPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import type { Job, Settings } from "./types";
import "./styles.css";

const defaults: Settings = { sampleInterval: 0.2, topRatio: 0.108, bottomRatio: 0.833 };
const maxBatchSize = 10;

interface UploadItem {
  key: string;
  file: File;
  uploading: boolean;
  job?: Job;
  error?: string;
}

export default function App() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [settings, setSettings] = useState(defaults);
  const [error, setError] = useState("");
  const busy = items.some((item) => item.uploading || (item.job && !["done", "failed"].includes(item.job.state)));
  const readyCount = items.filter((item) => !item.uploading && !item.job && !item.error).length;
  const jobs = items.flatMap((item) => item.job ? [item.job] : []);
  const pollingKey = jobs.map((job) => `${job.id}:${job.state}`).join("|");

  useEffect(() => {
    const active = jobs.filter((job) => !["done", "failed"].includes(job.state));
    if (!active.length) return;
    const timer = window.setInterval(async () => {
      const updates = await Promise.all(active.map(async (job) => {
        const response = await fetch(`/api/jobs/${job.id}`);
        return response.ok ? await response.json() as Job : job;
      }));
      const byId = new Map(updates.map((job) => [job.id, job]));
      setItems((current) => current.map((item) => item.job && byId.has(item.job.id)
        ? { ...item, job: byId.get(item.job.id) }
        : item));
    }, 650);
    return () => window.clearInterval(timer);
  }, [pollingKey]);

  function addFiles(candidates: File[]) {
    const supported = candidates.filter((file) => /\.(mp4|mov|m4v)$/i.test(file.name));
    if (supported.length !== candidates.length) setError("已跳过不支持的文件，仅接受 MP4、MOV 或 M4V。");
    else setError("");
    setItems((current) => {
      const known = new Set(current.map((item) => item.key));
      const additions = supported
        .map((file) => ({ key: `${file.name}:${file.size}:${file.lastModified}`, file, uploading: false }))
        .filter((item) => !known.has(item.key));
      const next = [...current, ...additions].slice(0, maxBatchSize);
      if (current.length + additions.length > maxBatchSize) setError(`单批最多 ${maxBatchSize} 段视频，多余文件未加入。`);
      return next;
    });
  }

  async function generate() {
    const pending = items.filter((item) => !item.job && !item.error);
    if (!pending.length) return;
    setError("");
    const pendingKeys = new Set(pending.map((item) => item.key));
    setItems((current) => current.map((item) => pendingKeys.has(item.key) ? { ...item, uploading: true } : item));
    await Promise.all(pending.map(async (item) => {
      const data = new FormData();
      data.append("video", item.file);
      data.append("sample_interval", String(settings.sampleInterval));
      data.append("content_top_ratio", String(settings.topRatio));
      data.append("content_bottom_ratio", String(settings.bottomRatio));
      try {
        const response = await fetch("/api/jobs", { method: "POST", body: data });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.detail || "上传失败");
        setItems((current) => current.map((candidate) => candidate.key === item.key
          ? { ...candidate, uploading: false, job: payload as Job }
          : candidate));
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : "无法连接处理服务";
        setItems((current) => current.map((candidate) => candidate.key === item.key
          ? { ...candidate, uploading: false, error: message }
          : candidate));
      }
    }));
  }

  function reset() {
    setItems([]); setError(""); setSettings(defaults);
  }

  return (
    <main>
      <nav>
        <a className="brand" href="#top"><i><Sparkles size={16} /></i><span>卷轴</span><small>SCROLLSHOT</small></a>
        <div><span className="local-dot">处理服务就绪</span><a className="code-mark" href="#architecture" aria-label="代码架构">&lt;/&gt;</a></div>
      </nav>

      <div className="workspace" id="top">
        <section className="intro">
          <div className="eyebrow"><i /> 滚动录屏 → 一张长图</div>
          <h1>让页面<br /><em>完整展开。</em></h1>
          <p>自动追踪每一次纵向滚动，裁掉固定栏与重复画面，把手机录屏还原成清晰、连续的 PNG。</p>
          <div className="proof"><span>像素级衔接</span><span>原画质导出</span><span>任务隔离处理</span></div>
        </section>

        <section className="console">
          <div className="console-head"><span>批量生成长图</span><small>最多 10 条 · 单条 500 MB</small></div>
          <Dropzone files={items.map((item) => item.file)} disabled={busy} onFiles={addFiles} />
          {items.length > 0 && (
            <div className="batch-queue" aria-live="polite">
              {items.map((item, index) => {
                const failed = item.error || item.job?.state === "failed";
                const done = item.job?.state === "done";
                const progress = item.job?.progress ?? (item.uploading ? 3 : 0);
                const label = item.error || item.job?.error || (item.uploading ? "上传中" : item.job?.stage ?? "等待处理");
                return (
                  <div className={`queue-item ${done ? "is-done" : ""} ${failed ? "is-failed" : ""}`} key={item.key}>
                    <span className="queue-index">{String(index + 1).padStart(2, "0")}</span>
                    <div className="queue-copy">
                      <strong>{item.file.name}</strong>
                      <small>{label}</small>
                      <i><b style={{ width: `${progress}%` }} /></i>
                    </div>
                    <span className="queue-state">
                      {done ? <Check size={15} /> : failed ? <CircleAlert size={15} /> : `${progress}%`}
                    </span>
                    {!busy && !item.job && (
                      <button type="button" aria-label={`移除 ${item.file.name}`} onClick={() => setItems((current) => current.filter((candidate) => candidate.key !== item.key))}><X size={14} /></button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <SettingsPanel settings={settings} disabled={busy} onChange={setSettings} />
          {error && <div className="error">{error}</div>}
          <button className="generate" type="button" disabled={!readyCount || busy} onClick={generate}>
            {busy ? "正在批量处理" : readyCount ? `生成 ${readyCount} 张长图` : "本批次已完成"}<ArrowRight size={18} />
          </button>
        </section>

        <ResultPanel jobs={jobs} onReset={reset} />
      </div>
      <footer className="page-footer" id="architecture"><span>卷轴 / Scrollshot Studio</span><small>视频上传至处理服务；服务重启后任务记录自动清空。</small></footer>
    </main>
  );
}
