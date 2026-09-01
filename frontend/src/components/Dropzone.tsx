import { Film, Plus, ShieldCheck } from "lucide-react";
import { DragEvent, useRef, useState } from "react";

interface Props {
  files: File[];
  disabled?: boolean;
  onFiles: (files: File[]) => void;
}

const formats = ["MP4", "MOV", "M4V"];

export function Dropzone({ files, disabled, onFiles }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function accept(candidates?: FileList | null) {
    if (candidates?.length) onFiles(Array.from(candidates));
  }

  function drop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    accept(event.dataTransfer.files);
  }

  return (
    <button
      className={`dropzone ${dragging ? "is-dragging" : ""} ${files.length ? "has-file" : ""}`}
      type="button"
      disabled={disabled}
      onClick={() => input.current?.click()}
      onDragEnter={() => setDragging(true)}
      onDragLeave={() => setDragging(false)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={drop}
    >
      <input
        ref={input}
        hidden
        type="file"
        multiple
        accept="video/mp4,video/quicktime,video/x-m4v"
        onChange={(event) => {
          accept(event.target.files);
          event.target.value = "";
        }}
      />
      <span className="reel" aria-hidden="true">
        {files.length ? <Film size={30} /> : <Plus size={30} />}
      </span>
      <span className="drop-copy">
        <strong>{files.length ? `${files.length} 段录屏已加入` : "放入多段滚动录屏"}</strong>
        <small>
          {files.length
            ? `共 ${formatBytes(files.reduce((total, file) => total + file.size, 0))} · 可继续添加`
            : "拖到这里，或点击批量选择视频"}
        </small>
      </span>
      <span className="format-row">
        {formats.map((format) => <i key={format}>{format}</i>)}
        <em><ShieldCheck size={13} /> 本地处理</em>
      </span>
    </button>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
