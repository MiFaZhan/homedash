import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import type { Appearance } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

export function SettingsDialog({
  open,
  appearance,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  appearance: Appearance;
  onOpenChange: (open: boolean) => void;
  onSaved: (next: Appearance) => void;
}) {
  const [draft, setDraft] = useState<Appearance>(appearance);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // keep the form in sync whenever the dialog opens
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setDraft(appearance);
  }

  const patch = (next: Partial<Appearance>) => setDraft((d) => ({ ...d, ...next }));

  async function uploadWallpaper(file: File) {
    try {
      const { url } = await api.upload("wallpapers", file);
      patch({ wallpaper: url });
      toast.success("壁纸已上传");
    } catch {
      toast.error("壁纸上传失败");
    }
  }

  async function save() {
    setSaving(true);
    try {
      const saved = await api.saveSettings(draft);
      onSaved(saved);
      toast.success("设置已保存");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="外观设置"
        description="壁纸、图标与布局"
        footer={
          <>
            <span />
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button variant="primary" size="sm" onClick={save} disabled={saving}>
                {saving ? "保存中…" : "保存"}
              </Button>
            </div>
          </>
        }
      >
        <div className="space-y-5">
          <section className="space-y-2.5">
            <Label>壁纸</Label>
            <div className="flex items-center gap-2">
              <Button variant="default" size="sm" onClick={() => fileRef.current?.click()}>
                <ImagePlus className="h-4 w-4" />
                上传图片
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => patch({ wallpaper: "" })}
                disabled={!draft.wallpaper}
              >
                <Trash2 className="h-4 w-4" />
                恢复默认
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".png,.jpg,.jpeg,.webp,.gif,.svg"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadWallpaper(file);
                }}
              />
            </div>
            <p className="truncate text-[12px] text-[var(--fg-muted)]">
              {draft.wallpaper ? draft.wallpaper.split("/").pop() : "当前为默认渐变背景"}
            </p>
          </section>

          <section className="space-y-4 rounded-xl border border-[var(--border)] p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>背景模糊</Label>
                <span className="text-[12px] tabular-nums text-[var(--fg-muted)]">
                  {draft.wallpaper_blur}px
                </span>
              </div>
              <Slider
                value={[draft.wallpaper_blur]}
                min={0}
                max={40}
                step={1}
                onValueChange={([v]) => patch({ wallpaper_blur: v })}
                disabled={!draft.wallpaper}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>背景压暗</Label>
                <span className="text-[12px] tabular-nums text-[var(--fg-muted)]">
                  {Math.round(draft.wallpaper_dim * 100)}%
                </span>
              </div>
              <Slider
                value={[Math.round(draft.wallpaper_dim * 100)]}
                min={0}
                max={80}
                step={5}
                onValueChange={([v]) => patch({ wallpaper_dim: v / 100 })}
                disabled={!draft.wallpaper}
              />
            </div>
          </section>

          <section className="space-y-4 rounded-xl border border-[var(--border)] p-4">
            <div className="grid gap-1.5">
              <Label>布局</Label>
              <Select
                value={draft.layout}
                onValueChange={(v) => patch({ layout: v as Appearance["layout"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desktop">桌面 · 通透铺满</SelectItem>
                  <SelectItem value="panel">面板 · 玻璃卡片</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>图标大小</Label>
              <Select
                value={draft.tile_size}
                onValueChange={(v) => patch({ tile_size: v as Appearance["tile_size"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sm">小</SelectItem>
                  <SelectItem value="md">中</SelectItem>
                  <SelectItem value="lg">大</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </section>

          <section className="space-y-3.5">
            <label className="flex items-center justify-between text-[13px] text-[var(--fg)]">
              显示图标名称
              <Switch
                checked={draft.show_labels}
                onCheckedChange={(v) => patch({ show_labels: v })}
              />
            </label>
            <label className="flex items-center justify-between text-[13px] text-[var(--fg)]">
              桌面模式（隐藏侧栏与顶栏）
              <Switch
                checked={draft.desktop_mode}
                onCheckedChange={(v) => patch({ desktop_mode: v })}
              />
            </label>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
