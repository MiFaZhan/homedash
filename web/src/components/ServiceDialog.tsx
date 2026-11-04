import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Page, Service } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type Draft = Partial<Service> & { showLabel: boolean };

const EMPTY: Draft = {
  name: "",
  url: "",
  description: "",
  icon: "",
  page: "",
  order: 0,
  hidden: false,
  pin: false,
  showLabel: true,
};

export function ServiceDialog({
  open,
  service,
  pages,
  defaultPage,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  service: Service | null;
  pages: Page[];
  defaultPage: string;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (service) {
      setDraft({
        ...service,
        showLabel: service.show_label !== false,
      });
    } else {
      setDraft({ ...EMPTY, page: defaultPage });
    }
  }, [open, service, defaultPage]);

  const patch = (next: Partial<Draft>) => setDraft((d) => ({ ...d, ...next }));

  async function save() {
    if (!draft.name?.trim() || !draft.url?.trim()) {
      toast.error("名称与地址必填");
      return;
    }
    setSaving(true);
    try {
      const payload: Partial<Service> = {
        name: draft.name.trim(),
        url: draft.url.trim(),
        description: draft.description?.trim() ?? "",
        icon: draft.icon?.trim() ?? "",
        page: draft.page || defaultPage,
        order: Number(draft.order) || 0,
        hidden: !!draft.hidden,
        pin: !!draft.pin,
        show_label: draft.showLabel,
      };
      if (service) {
        await api.updateService(service.id, payload);
        toast.success("已保存");
      } else {
        await api.createService(payload);
        toast.success("已添加");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!service) return;
    if (!window.confirm(`删除「${service.name}」？`)) return;
    try {
      await api.deleteService(service.id);
      toast.success("已删除");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败");
    }
  }

  async function uploadIcon(file: File) {
    try {
      const { url } = await api.upload("icons", file);
      patch({ icon: url });
      toast.success("图标已上传");
    } catch {
      toast.error("上传失败");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={service ? "编辑服务" : "添加服务"}
        description={
          service
            ? `${service.runtime === "docker" ? "容器" : service.runtime === "systemd" ? "systemd" : "进程"} · ${service.url}`
            : "填写地址后即可在面板上打开"
        }
        footer={
          <>
            {service ? (
              <Button variant="danger" size="sm" onClick={remove}>
                删除
              </Button>
            ) : (
              <span />
            )}
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
        <div className="space-y-4">
          <div className="grid gap-1.5">
            <Label htmlFor="svc-name">名称</Label>
            <Input
              id="svc-name"
              value={draft.name ?? ""}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="OpenViking Studio"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="svc-url">地址</Label>
            <Input
              id="svc-url"
              value={draft.url ?? ""}
              onChange={(e) => patch({ url: e.target.value })}
              placeholder="http://192.168.1.10:8080"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="svc-desc">描述</Label>
            <Input
              id="svc-desc"
              value={draft.description ?? ""}
              onChange={(e) => patch({ description: e.target.value })}
              placeholder="可选，一句话说明"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="svc-page">所属页面</Label>
              <Select value={draft.page || defaultPage} onValueChange={(page) => patch({ page })}>
                <SelectTrigger id="svc-page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pages.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="svc-order">排序</Label>
              <Input
                id="svc-order"
                type="number"
                step={10}
                value={draft.order ?? 0}
                onChange={(e) => patch({ order: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="svc-icon">图标</Label>
            <div className="flex gap-2">
              <Input
                id="svc-icon"
                value={draft.icon ?? ""}
                onChange={(e) => patch({ icon: e.target.value })}
                placeholder="内置图标名（如 database）或 /icons/xxx.png"
              />
              <label
                className="inline-flex h-9 shrink-0 cursor-pointer items-center rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)] px-3.5 text-sm transition-colors hover:border-[var(--border-strong)]"
              >
                上传
                <input
                  type="file"
                  accept=".png,.svg,.ico,.jpg,.jpeg,.webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadIcon(file);
                  }}
                />
              </label>
            </div>
            <p className="text-[12px] text-[var(--fg-muted)]">
              留空会自动抓取该服务的 favicon；也可填 database / monitor / network 等内置图标。
            </p>
          </div>

          <div className="flex flex-wrap gap-6 pt-1">
            <label className="flex items-center gap-2.5 text-[13px] text-[var(--fg)]">
              <Switch checked={draft.showLabel} onCheckedChange={(v) => patch({ showLabel: v })} />
              显示名称
            </label>
            <label className="flex items-center gap-2.5 text-[13px] text-[var(--fg)]">
              <Switch checked={!!draft.pin} onCheckedChange={(v) => patch({ pin: v })} />
              置顶
            </label>
            <label className="flex items-center gap-2.5 text-[13px] text-[var(--fg)]">
              <Switch checked={!!draft.hidden} onCheckedChange={(v) => patch({ hidden: v })} />
              隐藏
            </label>
          </div>

          {service?.runtime_detail && Object.keys(service.runtime_detail).length > 0 && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
              <div className="mb-1.5 text-[12px] font-medium text-[var(--fg-muted)]">运行信息</div>
              <dl className="space-y-1 text-[12px]">
                {Object.entries(service.runtime_detail)
                  .filter(([k]) => k !== "cgroup")
                  .map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <dt className="w-24 shrink-0 text-[var(--fg-muted)]">{k}</dt>
                      <dd className="min-w-0 break-all text-[var(--fg)]">{v}</dd>
                    </div>
                  ))}
              </dl>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
