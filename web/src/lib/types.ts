export type Runtime = "docker" | "systemd" | "process" | "tailscale" | "unknown";
export type Status = "online" | "offline" | "unknown";

export interface Service {
  id: string;
  name: string;
  url: string;
  description?: string;
  icon?: string;
  page?: string;
  order?: number;
  pin?: boolean;
  hidden?: boolean;
  show_label?: boolean | null;
  port?: number;
  addr?: string;
  runtime: Runtime;
  runtime_detail?: Record<string, string>;
  managed: "manual" | "discovered";
  status: Status;
  latency_ms?: number;
  http_status?: number;
  last_seen?: string;
}

export interface Page {
  id: string;
  name: string;
  icon?: string;
  order?: number;
}

export interface Appearance {
  wallpaper: string;
  wallpaper_blur: number;
  wallpaper_dim: number;
  show_labels: boolean;
  tile_size: "sm" | "md" | "lg";
  desktop_mode: boolean;
  free_layout: boolean;
  layout: "desktop" | "panel";
}

export interface ConfigResponse {
  pages: Page[];
  services: Service[];
  appearance: Appearance;
  server: { listen: string; external_url?: string };
  auth: { enabled: boolean };
}

export interface ScanResult {
  added: string[] | null;
  removed: string[] | null;
  updated: string[] | null;
  total: number;
}
