import type { Appearance, ConfigResponse, ScanResult, Service } from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `${res.status} ${res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  config: () => request<ConfigResponse>("/api/config"),

  scan: () => request<ScanResult>("/api/scan", { method: "POST" }),

  createService: (svc: Partial<Service>) =>
    request<Service>("/api/services", { method: "POST", body: JSON.stringify(svc) }),

  updateService: (id: string, svc: Partial<Service>) =>
    request<Service>(`/api/services/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(svc),
    }),

  deleteService: (id: string) =>
    request<{ removed: boolean }>(`/api/services/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  reorder: (page: string, ids: string[]) =>
    request<{ ok: boolean }>("/api/services/reorder", {
      method: "POST",
      body: JSON.stringify({ page, ids }),
    }),

  upsertPage: (page: { id?: string; name: string; order?: number }) =>
    request<unknown>("/api/pages", { method: "POST", body: JSON.stringify(page) }),

  deletePage: (id: string) =>
    request<{ removed: boolean }>(`/api/pages/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  saveSettings: (patch: Partial<Appearance>) =>
    request<Appearance>("/api/settings", { method: "POST", body: JSON.stringify(patch) }),

  upload: async (kind: "icons" | "wallpapers", file: File) => {
    const body = new FormData();
    body.append("file", file);
    const res = await fetch(`/api/${kind}`, { method: "POST", body });
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()) as { url: string };
  },
};
