import { Download, Expand, Image as ImageIcon, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import type { Job } from "../types";

interface Props {
  jobs: Job[];
  onReset: () => void;
}

export function ResultPanel({ jobs, onReset }: Props) {
  const completed = jobs.filter((job) => job.state === "done");
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    if (!completed.length) setSelectedId("");
    else if (!completed.some((job) => job.id === selectedId)) setSelectedId(completed[0].id);
  }, [completed, selectedId]);

  const job = completed.find((candidate) => candidate.id === selectedId) ?? completed[0];
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
        <img key={job.id} src={job.image_url} alt={`${job.filename} 生成的长图预览`} />
        <a href={job.image_url} target="_blank" rel="noreferrer" aria-label="打开原图"><Expand size={17} /></a>
      </div>
      <footer>
        <div><small>识别滚动</small><b>{job.scroll_pixels}px</b></div>
        <div><small>有效位移</small><b>{job.accepted_moves} 段</b></div>
        <a className="download" href={job.download_url}><Download size={18} /> 下载 PNG</a>
      </footer>
    </section>
  );
}
