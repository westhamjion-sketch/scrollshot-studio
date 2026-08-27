import { Check, ScanLine, Scissors, WandSparkles } from "lucide-react";
import type { Job } from "../types";

const steps = [
  { at: 5, label: "读取", icon: ScanLine },
  { at: 38, label: "追踪", icon: WandSparkles },
  { at: 76, label: "拼接", icon: Scissors },
  { at: 100, label: "完成", icon: Check },
];

export function ProgressRail({ job }: { job: Job }) {
  return (
    <section className="progress-card" aria-live="polite">
      <div className="progress-heading">
        <span>{job.stage}</span><strong>{job.progress}%</strong>
      </div>
      <div className="rail"><i style={{ width: `${job.progress}%` }} /></div>
      <div className="step-row">
        {steps.map(({ at, label, icon: Icon }) => (
          <div key={label} className={job.progress >= at ? "active" : ""}>
            <span><Icon size={14} /></span><small>{label}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

