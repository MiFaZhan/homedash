import {
  Activity,
  Boxes,
  Box,
  Brain,
  ChartColumn,
  Cloud,
  Code,
  Container,
  Database,
  FileText,
  Globe,
  HardDrive,
  Home,
  Image,
  LayoutGrid,
  Mail,
  Monitor,
  Network,
  Printer,
  Server,
  Settings2,
  Shield,
  TerminalSquare,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const BUILTIN_ICONS: Record<string, LucideIcon> = {
  activity: Activity,
  boxes: Boxes,
  box: Box,
  brain: Brain,
  bot: Brain,
  chart: ChartColumn,
  cloud: Cloud,
  code: Code,
  database: Database,
  docker: Container,
  drive: HardDrive,
  file: FileText,
  globe: Globe,
  home: Home,
  image: Image,
  layout: LayoutGrid,
  "layout-dashboard": LayoutGrid,
  mail: Mail,
  monitor: Monitor,
  network: Network,
  printer: Printer,
  server: Server,
  settings: Settings2,
  shield: Shield,
  terminal: TerminalSquare,
  wrench: Wrench,
};

export function hashHue(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) % 360;
  return h;
}

export function isEmoji(value: string): boolean {
  return /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(value);
}
