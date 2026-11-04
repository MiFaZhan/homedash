import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  Box,
  ChartColumn,
  Code,
  Globe,
  Home,
  LayoutGrid,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Sun,
  Moon,
  MonitorSmartphone,
  Trash2,
  Wrench,
} from "lucide-react";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { Appearance, Page, Service } from "@/lib/types";
import { BUILTIN_ICONS } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { Tile } from "@/components/Tile";
import { ServiceDialog } from "@/components/ServiceDialog";
import { SettingsDialog } from "@/components/SettingsDialog";

const PAGE_ICONS = ["home", "code", "wrench", "globe", "layout", "box", "activity", "chart"];

const TILE_PX: Record<Appearance["tile_size"], string> = {
  sm: "72px",
  md: "88px",
  lg: "104px",
};

const RUNTIME_FILTERS = [
  { id: "docker", label: "Docker" },
  { id: "systemd", label: "systemd" },
  { id: "process", label: "宿主机" },
  { id: "tailscale", label: "Tailscale" },
] as const;

function PageIcon({ index, className }: { index: number; className?: string }) {
  const Icon = BUILTIN_ICONS[PAGE_ICONS[index % PAGE_ICONS.length]] ?? Home;
  return <Icon className={className} strokeWidth={1.7} />;
}

function SortableTile({
  service,
  editing,
  showLabels,
  onOpen,
  onEdit,
}: {
  service: Service;
  editing: boolean;
  showLabels: boolean;
  onOpen: () => void;
  onEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: service.id,
    disabled: !editing,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "opacity-40")}
    >
      <Tile
        service={service}
        editing={editing}
        showLabels={showLabels}
        onOpen={onOpen}
        onEdit={onEdit}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

export default function App() {
  const qc = useQueryClient();
  const { mode, cycle } = useTheme();

  const [pageId, setPageId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [runtime, setRuntime] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pagesOpen, setPagesOpen] = useState(false);
  const [serviceDialog, setServiceDialog] = useState<{ open: boolean; service: Service | null }>({
    open: false,
    service: null,
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["config"],
    queryFn: api.config,
    refetchInterval: 60_000,
  });

  const appearance: Appearance =
    data?.appearance ?? {
      wallpaper: "",
      wallpaper_blur: 0,
      wallpaper_dim: 0.35,
      show_labels: true,
      tile_size: "md",
      desktop_mode: false,
      free_layout: true,
      layout: "desktop",
    };

  const pages = data?.pages ?? [];
  const services = data?.services ?? [];

  useEffect(() => {
    if (!pageId && pages.length) setPageId(pages[0].id);
    if (pageId && pages.length && !pages.some((p) => p.id === pageId)) setPageId(pages[0].id);
  }, [pages, pageId]);

  useEffect(() => {
    const hash = location.hash.replace("#", "");
    if (hash && pages.some((p) => p.id === hash)) setPageId(hash);
  }, [pages]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        document.getElementById("global-search")?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return services
      .filter((s) => (pageId ? s.page === pageId : true))
      .filter((s) => (runtime ? s.runtime === runtime : true))
      .filter((s) => !q || [s.name, s.description, s.url].some((v) => v?.toLowerCase().includes(q)))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
  }, [services, pageId, runtime, query]);

  const currentPage = pages.find((p) => p.id === pageId);
  const countByPage = useMemo(() => {
    const map: Record<string, number> = {};
    services.forEach((s) => {
      if (s.page) map[s.page] = (map[s.page] ?? 0) + 1;
    });
    return map;
  }, [services]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !pageId) return;
    const ids = visible.map((s) => s.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    const next = arrayMove(ids, from, to);
    qc.setQueryData(["config"], (old: typeof data) => {
      if (!old) return old;
      return {
        ...old,
        services: old.services.map((s) => {
          const idx = next.indexOf(s.id);
          return idx >= 0 ? { ...s, order: (idx + 1) * 10 } : s;
        }),
      };
    });
    try {
      await api.reorder(pageId, next);
    } catch {
      toast.error("排序保存失败");
    }
    void refetch();
  }

  async function scan() {
    const t = toast.loading("正在扫描本机服务…");
    try {
      const res = await api.scan();
      toast.success(`扫描完成：共 ${res.total} 个服务`, { id: t });
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "扫描失败", { id: t });
    }
  }

  const wallpaperStyle = appearance.wallpaper
    ? {
        backgroundImage: `url("${appearance.wallpaper}")`,
        filter: appearance.wallpaper_blur ? `blur(${appearance.wallpaper_blur}px)` : undefined,
        transform: appearance.wallpaper_blur ? "scale(1.06)" : undefined,
      }
    : undefined;

  return (
    <TooltipProvider>
      <div className="relative flex h-full flex-col overflow-hidden bg-[var(--bg)]">
        {/* 壁纸层 */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {appearance.wallpaper ? (
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={wallpaperStyle}
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(1200px 620px at 12% -8%, color-mix(in srgb, var(--brand) 16%, transparent), transparent 62%)," +
                  "radial-gradient(900px 520px at 105% 8%, color-mix(in srgb, #a06bff 14%, transparent), transparent 60%)",
              }}
            />
          )}
          {appearance.wallpaper && (
            <div
              className="absolute inset-0 bg-black"
              style={{ opacity: appearance.wallpaper_dim }}
            />
          )}
        </div>

        <div className={cn("relative z-10 flex h-full", appearance.desktop_mode && "block")}>
          {!appearance.desktop_mode && (
            <aside className="flex w-[236px] shrink-0 flex-col border-r border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-soft)_82%,transparent)] backdrop-blur-xl">
              <div className="flex items-center gap-2.5 px-5 py-5">
                <div
                  className="grid h-8 w-8 place-items-center rounded-[10px] text-[13px] font-bold"
                  style={{
                    background: "linear-gradient(140deg, var(--brand), #a06bff)",
                    color: "var(--brand-fg)",
                  }}
                >
                  h
                </div>
                <div>
                  <div className="text-[14px] font-semibold leading-tight">homedash</div>
                  <div className="text-[11px] text-[var(--fg-muted)]">本机服务面板</div>
                </div>
              </div>

              <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 pb-4">
                {pages.map((p, i) => {
                  const active = p.id === pageId;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        setPageId(p.id);
                        history.replaceState(null, "", `#${p.id}`);
                      }}
                      className={cn(
                        "group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] transition-colors",
                        active
                          ? "bg-[var(--surface)] text-[var(--fg)] shadow-sm"
                          : "text-[var(--fg-muted)] hover:bg-[color-mix(in_srgb,var(--surface)_60%,transparent)] hover:text-[var(--fg)]",
                      )}
                    >
                      <PageIcon
                        index={i}
                        className={cn("h-4 w-4", active ? "text-[var(--brand)]" : "opacity-70")}
                      />
                      <span className="flex-1 truncate">{p.name}</span>
                      <span className="text-[11px] tabular-nums opacity-60">
                        {countByPage[p.id] ?? 0}
                      </span>
                    </button>
                  );
                })}
                <button
                  onClick={() => setPagesOpen(true)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-[var(--fg-muted)] transition-colors hover:bg-[color-mix(in_srgb,var(--surface)_60%,transparent)] hover:text-[var(--fg)]"
                >
                  <MoreHorizontal className="h-4 w-4" />
                  管理页面
                </button>
              </nav>

              <div className="border-t border-[var(--border)] p-2.5">
                <button
                  onClick={() => setSettingsOpen(true)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-[var(--fg-muted)] transition-colors hover:bg-[color-mix(in_srgb,var(--surface)_60%,transparent)] hover:text-[var(--fg)]"
                >
                  <Settings2 className="h-4 w-4" />
                  外观设置
                </button>
              </div>
            </aside>
          )}

          <div className="flex min-w-0 flex-1 flex-col">
            {/* 顶栏 */}
            <header className="flex h-[60px] shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-soft)_70%,transparent)] px-5 backdrop-blur-xl">
              <div className="min-w-0">
                <h1 className="truncate text-[15px] font-semibold">
                  {currentPage?.name ?? "服务"}
                </h1>
              </div>
              <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] text-[var(--fg-muted)]">
                {visible.length}
              </span>

              <div className="relative ml-auto w-[260px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fg-muted)]" />
                <Input
                  id="global-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索服务…"
                  className="h-9 pl-9"
                />
              </div>

              <div className="hidden items-center gap-1 md:flex">
                {RUNTIME_FILTERS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setRuntime(runtime === f.id ? null : f.id)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[12px] transition-colors",
                      runtime === f.id
                        ? "border-[var(--brand)] text-[var(--fg)]"
                        : "border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)]",
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1">
                <Tooltip content={mode === "system" ? "主题：跟随系统" : mode === "light" ? "主题：浅色" : "主题：深色"}>
                  <Button variant="ghost" size="icon" onClick={cycle}>
                    {mode === "light" ? (
                      <Sun className="h-4 w-4" />
                    ) : mode === "dark" ? (
                      <Moon className="h-4 w-4" />
                    ) : (
                      <MonitorSmartphone className="h-4 w-4" />
                    )}
                  </Button>
                </Tooltip>
                <Tooltip content="重新扫描本机服务">
                  <Button variant="ghost" size="icon" onClick={scan}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </Tooltip>
                <Button
                  variant={editing ? "primary" : "ghost"}
                  size="sm"
                  onClick={() => setEditing((v) => !v)}
                >
                  {editing ? "完成" : "编辑"}
                </Button>
              </div>
            </header>

            {/* 内容 */}
            <main className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
              {isLoading ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-6">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="h-[104px] animate-pulse rounded-[22px] bg-[var(--surface)]" />
                  ))}
                </div>
              ) : visible.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
                  <div className="text-[13px] text-[var(--fg-muted)]">
                    {query || runtime ? "没有匹配的服务" : "这一页还没有服务"}
                  </div>
                  <Button variant="primary" size="sm" onClick={() => setServiceDialog({ open: true, service: null })}>
                    <Plus className="h-4 w-4" />
                    添加服务
                  </Button>
                </div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                  <SortableContext items={visible.map((s) => s.id)} strategy={rectSortingStrategy}>
                    <div
                      className={cn(
                        "grid gap-x-3 gap-y-6",
                        appearance.layout === "panel"
                          ? "rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_55%,transparent)] p-6 backdrop-blur-xl"
                          : "",
                      )}
                      style={{
                        gridTemplateColumns: "repeat(auto-fill, minmax(calc(var(--tile) + 34px), 1fr))",
                        ["--tile" as string]: TILE_PX[appearance.tile_size],
                      }}
                    >
                      {visible.map((service) => (
                        <SortableTile
                          key={service.id}
                          service={service}
                          editing={editing}
                          showLabels={appearance.show_labels}
                          onOpen={() => window.open(service.url, "_blank", "noopener")}
                          onEdit={() => setServiceDialog({ open: true, service })}
                        />
                      ))}

                      {editing && (
                        <button
                          onClick={() => setServiceDialog({ open: true, service: null })}
                          className="group flex h-[var(--tile)] w-[var(--tile)] flex-col items-center justify-center gap-1 self-start rounded-[22px] border border-dashed border-[var(--border-strong)] text-[var(--fg-muted)] transition-colors hover:border-[var(--brand)] hover:text-[var(--brand)]"
                        >
                          <Plus className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </main>
          </div>
        </div>

        {appearance.desktop_mode && (
          <div className="absolute bottom-4 right-4 z-20 flex gap-2">
            <Button variant="default" size="icon" onClick={() => setSettingsOpen(true)}>
              <Settings2 className="h-4 w-4" />
            </Button>
            <Button variant="default" size="icon" onClick={cycle}>
              {mode === "light" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        )}

        <ServiceDialog
          open={serviceDialog.open}
          service={serviceDialog.service}
          pages={pages}
          defaultPage={pageId ?? pages[0]?.id ?? "home"}
          onOpenChange={(open) => setServiceDialog((s) => ({ ...s, open }))}
          onSaved={() => void refetch()}
        />

        <SettingsDialog
          open={settingsOpen}
          appearance={appearance}
          onOpenChange={setSettingsOpen}
          onSaved={() => void refetch()}
        />

        <PagesDialog
          open={pagesOpen}
          pages={pages}
          onOpenChange={setPagesOpen}
          onSaved={() => void refetch()}
        />
      </div>
    </TooltipProvider>
  );
}

function PagesDialog({
  open,
  pages,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  pages: Page[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");

  async function add() {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await api.upsertPage({ name: trimmed, order: (pages.length + 1) * 10 });
      setName("");
      toast.success("页面已添加");
      onSaved();
    } catch {
      toast.error("添加失败");
    }
  }

  async function remove(page: Page) {
    if (!window.confirm(`删除页面「${page.name}」？其中的服务会移到第一个页面。`)) return;
    try {
      await api.deletePage(page.id);
      toast.success("页面已删除");
      onSaved();
    } catch {
      toast.error("删除失败");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="管理页面" description="页面顺序按创建顺序排列">
        <div className="space-y-4">
          <div className="space-y-1.5">
            {pages.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2"
              >
                <span className="text-[13px]">{p.name}</span>
                <Button variant="ghost" size="icon" onClick={() => remove(p)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={name}
              placeholder="新页面名称"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
            />
            <Button variant="primary" size="md" onClick={add}>
              添加
            </Button>
          </div>
          <Label className="block leading-relaxed">
            提示：在编辑模式下双击图标可修改所属页面。
          </Label>
        </div>
      </DialogContent>
    </Dialog>
  );
}
