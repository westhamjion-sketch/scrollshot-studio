import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { Download, Expand, Image as ImageIcon, RotateCcw, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { apiUrl } from "../api";
import type { Job } from "../types";

interface Props {
  jobs: Job[];
  onReset: () => void;
}

export function ResultPanel({ jobs, onReset }: Props) {
  const completed = jobs.filter((job) => job.state === "done");
  const [selectedId, setSelectedId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!completed.length) setSelectedId("");
    else if (!completed.some((job) => job.id === selectedId)) setSelectedId(completed[0].id);
  }, [completed, selectedId]);

  const job = completed.find((candidate) => candidate.id === selectedId) ?? completed[0];

  async function saveNativeImage() {
    if (!job || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      const response = await fetch(apiUrl(job.download_url || `/api/jobs/${job.id}/download`));
      if (!response.ok) throw new Error("长图下载失败");
      const data = await blobToBase64(await response.blob());
      const safeName = job.filename.replace(/\.[^.]+$/, "").replace(/[^\p{L}\p{N}_-]+/gu, "_");
      const saved = await Filesystem.writeFile({
        path: `${safeName || "scrollshot"}_长图.png`,
        data,
        directory: Directory.Cache,
      });
      await Share.share({
        title: `${job.filename} · 长图`,
        text: "由卷轴生成的长图",
        url: saved.uri,
        dialogTitle: "保存或分享长图",
      });
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : "无法打开系统分享面板");
    } finally {
      setSaving(false);
    }
  }
  if (!job) {
    return (
      <section className="result empty">
        <div className="ghost-scroll">
          <i /><i /><i /><i />
        </div>
        <ImageIcon size={22} />
        <h2>{jobs.length ? "长图正在逐条展开" : "长图会在这里展开"}</h2>
        <p>{jobs.length ? "先完成的结果会立即出现，不需要等待整批结束。" : "固定标题栏和输入框只保留一次，中间画面按真实滚动距离无损衔接。"}</p>
      </section>
    );
  }

  return (
    <section className="result ready">
      <header>
        <div>
          <span>{completed.length > 1 ? `${completed.length} 条已完成` : "拼接完成"}</span>
          <strong>{job.width} × {job.height} px</strong>
        </div>
        <button type="button" onClick={onReset}><RotateCcw size={15} /> 清空全部</button>
      </header>
      {completed.length > 1 && (
        <div className="result-tabs" aria-label="已完成的长图">
          {completed.map((candidate, index) => (
            <button
              className={candidate.id === job.id ? "active" : ""}
              key={candidate.id}
              type="button"
              onClick={() => setSelectedId(candidate.id)}
            >
              <small>{String(index + 1).padStart(2, "0")}</small>
              <span>{candidate.filename}</span>
            </button>
          ))}
        </div>
      )}
      <div className="image-stage">
        <img key={job.id} src={apiUrl(job.image_url || `/api/jobs/${job.id}/image`)} alt={`${job.filename} 生成的长图预览`} />
        <a href={apiUrl(job.image_url || `/api/jobs/${job.id}/image`)} target="_blank" rel="noreferrer" aria-label="打开原图"><Expand size={17} /></a>
      </div>
      <footer>
        <div><small>识别滚动</small><b>{job.scroll_pixels}px</b></div>
        <div><small>有效位移</small><b>{job.accepted_moves} 段</b></div>
        {Capacitor.isNativePlatform() ? (
          <button className="download" type="button" disabled={saving} onClick={saveNativeImage}><Share2 size={18} /> {saving ? "准备中" : "保存 / 分享"}</button>
        ) : (
          <a className="download" href={apiUrl(job.download_url || `/api/jobs/${job.id}/download`)}><Download size={18} /> 下载 PNG</a>
        )}
      </footer>
      {saveError && <div className="native-save-error" role="alert">{saveError}</div>}
    </section>
  );
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("无法读取长图文件"));
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.readAsDataURL(blob);
  });
}
