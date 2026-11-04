import { useState } from "react";
import { GripVertical } from "lucide-react";
import { BUILTIN_ICONS, hashHue, isEmoji } from "@/lib/icons";
import type { Service } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";

function LetterMark({ name }: { name: string }) {
  const hue = hashHue(name);
  const label = /[\u4e00-\u9fa5]/.test(name) ? name.slice(0, 1) : name.slice(0, 1).toUpperCase();
  return (
    <span
      className="grid h-full w-full place-items-center text-[26px] font-semibold text-white"
      style={{
        backgroundImage: `linear-gradient(145deg, hsl(${hue} 58% 55%), hsl(${(hue + 38) % 360} 55% 38%))`,
      }}
    >
      {label}
    </span>
  );
}

function ServiceIcon({ service }: { service: Service }) {
  const icon = service.icon ?? "";

  if (icon.startsWith("/")) {
    return (
      <img
        src={icon}
        alt=""
        loading="lazy"
        className="h-[56%] w-[56%] object-contain"
        onError={(e) => {
          const target = e.currentTarget;
          target.style.display = "none";
          target.parentElement?.classList.add("icon-fallback");
        }}
      />
    );
  }

  const Builtin = BUILTIN_ICONS[icon];
  if (Builtin) return <Builtin className="h-[46%] w-[46%]" strokeWidth={1.6} />;

  if (icon && isEmoji(icon)) return <span className="text-[28px] leading-none">{icon}</span>;

  return <LetterMark name={service.name} />;
}

const RUNTIME_LABEL: Record<string, string> = {
  docker: "Docker 容器",
  systemd: "systemd 服务",
  process: "宿主机进程",
  tailscale: "Tailscale 代理",
  unknown: "来源未知",
};

export function Tile({
  service,
  editing,
  showLabels,
  onOpen,
  onEdit,
  dragHandleProps,
}: {
  service: Service;
  editing: boolean;
  showLabels: boolean;
  onOpen: () => void;
  onEdit: () => void;
  dragHandleProps?: Record<string, unknown>;
}) {
  const [failed, setFailed] = useState(false);
  const labelVisible =
    service.show_label === true || (service.show_label !== false && showLabels);

  const content = (
    <div
      className={cn(
        "group relative flex cursor-pointer flex-col items-center gap-2 rounded-2xl p-1.5",
        "transition-transform duration-150 hover:-translate-y-0.5",
        service.status === "offline" && "opacity-70",
      )}
      onClick={() => (editing ? onEdit() : onOpen())}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          editing ? onEdit() : onOpen();
        }
      }}
    >
      <div
        className={cn(
          "relative grid h-[var(--tile)] w-[var(--tile)] place-items-center overflow-hidden rounded-[22px]",
          "border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-tile)]",
          "transition-[border-color,box-shadow] duration-150 group-hover:border-[var(--border-strong)]",
          icon_is_art(service) && "bg-white",
        )}
      >
        {failed ? <LetterMark name={service.name} /> : <ServiceIcon service={service} />}

        <span
          className={cn(
            "absolute right-1.5 top-1.5 h-2 w-2 rounded-full ring-2 ring-[var(--surface)]",
            service.status === "online" && "bg-[var(--ok)]",
            service.status === "offline" && "bg-[var(--danger)]",
            service.status !== "online" && service.status !== "offline" && "bg-[var(--fg-muted)]",
          )}
        />
      </div>

      <span
        className={cn(
          "w-[calc(var(--tile)+28px)] truncate text-center text-[12px] leading-4",
          "text-[var(--fg-muted)] transition-colors group-hover:text-[var(--fg)]",
          !labelVisible && "invisible group-hover:visible",
        )}
      >
        {service.name}
      </span>

      {editing && (
        <span
          {...dragHandleProps}
          className="absolute -left-1 top-0 rounded-md bg-[var(--surface-2)] p-0.5 text-[var(--fg-muted)] opacity-0 shadow group-hover:opacity-100"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </span>
      )}
    </div>
  );

  const tooltip = (
    <div className="space-y-0.5">
      <div className="font-medium text-[var(--fg)]">{service.name}</div>
      {service.description ? <div className="opacity-80">{service.description}</div> : null}
      <div className="opacity-60">{service.url}</div>
      <div className="opacity-60">
        {RUNTIME_LABEL[service.runtime] ?? service.runtime}
        {service.port ? ` · :${service.port}` : ""}
        {typeof service.latency_ms === "number" && service.status === "online"
          ? ` · ${service.latency_ms}ms`
          : ""}
      </div>
    </div>
  );

  return <Tooltip content={tooltip}>{content}</Tooltip>;
}

function icon_is_art(service: Service): boolean {
  const icon = service.icon ?? "";
  return icon.startsWith("/");
}
