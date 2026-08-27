import { ArrowRight, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Dropzone } from "./components/Dropzone";
import { ProgressRail } from "./components/ProgressRail";
import { ResultPanel } from "./components/ResultPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import type { Job, Settings } from "./types";
import "./styles.css";

const defaults: Settings = { sampleInterval: 0.2, topRatio: 0.108, bottomRatio: 0.833 };

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [settings, setSettings] = useState(defaults);
  const [error, setError] = useState("");
  const busy = !!job && !["done", "failed"].includes(job.state);

  useEffect(() => {
    if (!job || ["done", "failed"].includes(job.state)) return;
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/jobs/${job.id}`);
      if (response.ok) setJob(await response.json());
    }, 650);
    return () => window.clearInterval(timer);
  }, [job?.id, job?.state]);

  async function generate() {
    if (!file) return;
    setError("");
    const data = new FormData();
    data.append("video", file);
    data.append("sample_interval", String(settings.sampleInterval));
    data.append("content_top_ratio", String(settings.topRatio));
    data.append("content_bottom_ratio", String(settings.bottomRatio));
    try {
      const response = await fetch("/api/jobs", { method: "POST", body: data });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || "视频上传失败。请重试。");
      setJob(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法连接处理服务。");
    }
  }

  function reset() {
    setFile(null); setJob(null); setError(""); setSettings(defaults);
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
          <div className="proof"><span>像素级衔接</span><span>原画质导出</span><span>本地不留存</span></div>
        </section>

        <section className="console">
          <div className="console-head"><span>新建长图</span><small>单个视频 · 最大 500 MB</small></div>
          <Dropzone file={file} disabled={busy} onFile={(next) => { setFile(next); setJob(null); setError(""); }} />
          <SettingsPanel settings={settings} disabled={busy} onChange={setSettings} />
          {job && job.state !== "done" && <ProgressRail job={job} />}
          {(error || job?.error) && <div className="error">{error || job?.error}</div>}
          <button className="generate" type="button" disabled={!file || busy || job?.state === "done"} onClick={generate}>
            {busy ? job?.stage : job?.state === "done" ? "已生成长图" : "生成长图"}<ArrowRight size={18} />
          </button>
        </section>

        <ResultPanel job={job} onReset={reset} />
      </div>
      <footer className="page-footer" id="architecture"><span>卷轴 / Scrollshot Studio</span><small>视频只在当前设备处理，刷新服务后任务记录自动清空。</small></footer>
    </main>
  );
}
