import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import type { Settings } from "../types";

interface Props {
  settings: Settings;
  disabled?: boolean;
  onChange: (next: Settings) => void;
}

export function SettingsPanel({ settings, disabled, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const patch = (key: keyof Settings, value: number) => onChange({ ...settings, [key]: value });

  return (
    <section className={`settings ${open ? "is-open" : ""}`}>
      <button className="settings-toggle" type="button" onClick={() => setOpen(!open)}>
        <span><SlidersHorizontal size={16} /> 识别设置</span>
        <small>{open ? "收起" : "自动模式"}</small>
      </button>
      {open && (
        <div className="settings-body">
          <Control
            label="采样精度"
            value={settings.sampleInterval}
            min={0.1}
            max={0.5}
            step={0.05}
            display={`${settings.sampleInterval.toFixed(2)} 秒/帧`}
            disabled={disabled}
            onChange={(value) => patch("sampleInterval", value)}
          />
          <Control
            label="固定顶部"
            value={settings.topRatio}
            min={0.05}
            max={0.25}
            step={0.01}
            display={`${Math.round(settings.topRatio * 100)}%`}
            disabled={disabled}
            onChange={(value) => patch("topRatio", value)}
          />
          <Control
            label="内容底线"
            value={settings.bottomRatio}
            min={0.65}
            max={0.95}
            step={0.01}
            display={`${Math.round(settings.bottomRatio * 100)}%`}
            disabled={disabled}
            onChange={(value) => patch("bottomRatio", value)}
          />
          <p>默认值针对竖屏手机录屏优化。底部有固定输入栏时，把内容底线向上调。</p>
        </div>
      )}
    </section>
  );
}

function Control(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="control">
      <span>{props.label}<b>{props.display}</b></span>
      <input
        type="range"
        value={props.value}
        min={props.min}
        max={props.max}
        step={props.step}
        disabled={props.disabled}
        onChange={(event) => props.onChange(Number(event.target.value))}
      />
    </label>
  );
}
