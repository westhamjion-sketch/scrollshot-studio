import { Download, Expand, Image as ImageIcon, RotateCcw } from "lucide-react";
import type { Job } from "../types";

interface Props {
  job: Job | null;
  onReset: () => void;
}

export function ResultPanel({ job, onReset }: Props) {
  if (!job || job.state !== "done") {
    return (
      <section className="result empty">
        <div className="ghost-scroll">
          <i /><i /><i /><i />
        </div>
        <ImageIcon size={22} />
        <h2>长图会在这里展开</h2>
        <p>固定标题栏和输入框只保留一次，中间画面按真实滚动距离无损衔接。</p>
      </section>
    );
  }

  return (
    <section className="result ready">
      <header>
        <div>
          <span>拼接完成</span>
          <strong>{job.width} × {job.height} px</strong>
        </div>
        <button type="button" onClick={onReset}><RotateCcw size={15} /> 再做一张</button>
      </header>
      <div className="image-stage">
        <img src={job.image_url} alt="生成的长图预览" />
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

