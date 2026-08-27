export type JobState = "queued" | "analyzing" | "stitching" | "done" | "failed";

export interface Job {
  id: string;
  filename: string;
  state: JobState;
  progress: number;
  stage: string;
  error?: string;
  width?: number;
  height?: number;
  duration?: number;
  accepted_moves: number;
  scroll_pixels: number;
  image_url?: string;
  download_url?: string;
}

export interface Settings {
  sampleInterval: number;
  topRatio: number;
  bottomRatio: number;
}

