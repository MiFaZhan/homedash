import { useCallback, useEffect, useState } from "react";

export type ThemeMode = "system" | "light" | "dark";
const KEY = "homedash.theme";

function apply(mode: ThemeMode) {
  const root = document.documentElement;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = mode === "dark" || (mode === "system" && prefersDark);
  root.classList.toggle("dark", dark);
  root.classList.toggle("light", !dark);
  root.dataset.theme = dark ? "dark" : "light";
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(KEY) as ThemeMode | null;
    return saved ?? "system";
  });

  useEffect(() => {
    apply(mode);
    localStorage.setItem(KEY, mode);
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => apply("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode]);

  const cycle = useCallback(() => {
    setMode((m) => (m === "system" ? "light" : m === "light" ? "dark" : "system"));
  }, []);

  return { mode, setMode, cycle };
}
