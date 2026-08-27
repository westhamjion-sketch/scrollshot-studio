import { Film, Plus, ShieldCheck } from "lucide-react";
import { DragEvent, useRef, useState } from "react";

interface Props {
  file: File | null;
  disabled?: boolean;
  onFile: (file: File) => void;
}

const formats = ["MP4", "MOV", "M4V"];

export function Dropzone({ file, disabled, onFile }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function accept(candidate?: File) {
    if (candidate) onFile(candidate);
  }

  function drop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    accept(event.dataTransfer.files[0]);
  }

  return (
    <button
      className={`dropzone ${dragging ? "is-dragging" : ""} ${file ? "has-file" : ""}`}
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
        accept="video/mp4,video/quicktime,video/x-m4v"
        onChange={(event) => accept(event.target.files?.[0])}
      />
      <span className="reel" aria-hidden="true">
        {file ? <Film size={30} /> : <Plus size={30} />}
      </span>
      <span className="drop-copy">
        <strong>{file ? file.name : "放入一段滚动录屏"}</strong>
        <small>
          {file ? formatBytes(file.size) : "拖到这里，或点击选择视频"}
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

