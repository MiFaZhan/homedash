/* homedash dashboard - vanilla JS, no build step */
const THEMES = ["auto", "light", "dark"];
const THEME_LABELS = { auto: "跟随系统", light: "浅色", dark: "深色" };
const THEME_ICONS = { auto: "🌗", light: "☀️", dark: "🌙" };
const THEME_KEY = "homedash.theme";

/* 内置线性图标集（Lucide 风格，stroke=currentColor，24x24） */
const SVG_ICONS = {
  shield: '<path d="M12 3l7 3v6c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6l7-3z"/>',
  monitor: '<rect x="2.5" y="4" width="19" height="12.5" rx="2"/><path d="M8.5 20.5h7M12 16.5v4"/>',
  network: '<circle cx="12" cy="5" r="2.4"/><circle cx="5" cy="19" r="2.4"/><circle cx="19" cy="19" r="2.4"/><path d="M12 7.4v4.1M6.4 16.9l3.4-3M17.6 16.9l-3.4-3"/>',
  terminal: '<rect x="2.5" y="4" width="19" height="16" rx="2.5"/><path d="M7 10l3 2.6-3 2.6M13 15.5h4"/>',
  database: '<ellipse cx="12" cy="6" rx="7.5" ry="3"/><path d="M4.5 6v12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6"/><path d="M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3"/>',
  bot: '<rect x="4" y="7.5" width="16" height="12" rx="3"/><path d="M12 3.5v4M9 13h.01M15 13h.01M9.5 16.5h5"/>',
  activity: '<path d="M3 12h4l2.5-6.5 4 13L16.5 12H21"/>',
  chart: '<path d="M4 20V4M4 20h16"/><rect x="7.5" y="12" width="3" height="5"/><rect x="13" y="8" width="3" height="9"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.3 3.7 5.3 3.7 8.5s-1.3 6.2-3.7 8.5c-2.4-2.3-3.7-5.3-3.7-8.5S9.6 5.8 12 3.5z"/>',
  mail: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M3 7l9 6.5L21 7"/>',
  nginx: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>',
  printer: '<path d="M6.5 9V4h11v5"/><rect x="3.5" y="9" width="17" height="7.5" rx="2"/><path d="M7 16.5h10V21H7z"/>',
  box: '<path d="M12 3l8 4.3v9.4L12 21l-8-4.3V7.3L12 3z"/><path d="M4 7.3l8 4.4 8-4.4M12 11.7V21"/>',
  cloud: '<path d="M7 18.5h10.2a3.8 3.8 0 0 0 .4-7.6A5.6 5.6 0 0 0 6.9 9.5 4.5 4.5 0 0 0 7 18.5z"/>',
  docker: '<path d="M3 12.5h13.5c1.6 0 3-1.3 3-3 1.8 0 3 1.3 2.7 3.4-.4 3.6-3.6 6.1-7.7 6.1H7.5A4.5 4.5 0 0 1 3 14.5z"/><path d="M7 9.5V7M10.5 9.5V7M14 9.5V7"/>',
  server: '<rect x="3" y="4" width="18" height="6.5" rx="2"/><rect x="3" y="13.5" width="18" height="6.5" rx="2"/><path d="M7 7.2h.01M7 16.7h.01"/>',
  code: '<path d="M9 7l-5 5 5 5M15 7l5 5-5 5"/>',
  wrench: '<path d="M15.5 3.5a5 5 0 0 0-4.6 7L4 17.4 6.6 20l6.9-6.9a5 5 0 0 0 6.6-6.2l-3 3-2.4-.6-.6-2.4 3-3c-.5-.2-1-.4-1.6-.4z"/>',
  home: '<path d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>',
  image: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><circle cx="8.5" cy="10" r="1.6"/><path d="M4 17l5-4.5 4 3.5 3-2.5 4 3.5"/>',
  help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .9-1 1.6v.4"/><path d="M12 16.8h.01"/>',
  layout: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 9h18M9.5 9v11"/>',
};

function svgIcon(name, size = 40) {
  const body = SVG_ICONS[name];
  if (!body) return null;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none"
     stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

const PAGE_ICONS = ["home", "code", "wrench", "globe", "layout", "box", "activity", "chart"];

const state = {
  appearance: {
    wallpaper: "", wallpaper_blur: 0, wallpaper_dim: 0.35,
    show_labels: true, tile_size: "md", desktop_mode: false, free_layout: true,
  },
  pages: [],
  services: [],
  page: 0,
  edit: false,
  filter: "",
  runtimeFilter: "",
  editing: null,
};

const $ = (sel) => document.querySelector(sel);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

async function api(path, method = "GET", body) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

async function load() {
  const cfg = await api("/api/config");
  state.pages = cfg.pages || [];
  state.services = cfg.services || [];
  state.appearance = Object.assign(state.appearance, cfg.appearance || {});
  applyAppearance();
  if (state.page >= state.pages.length) state.page = 0;
  render();
}

const currentPage = () => state.pages[state.page];

function visibleServices() {
  const page = currentPage();
  const q = state.filter.toLowerCase();
  return state.services
    .filter((s) => !page || s.page === page.id)
    .filter((s) => !state.runtimeFilter || s.runtime === state.runtimeFilter)
    .filter((s) => !q || (s.name || "").toLowerCase().includes(q) ||
      (s.description || "").toLowerCase().includes(q) ||
      (s.url || "").toLowerCase().includes(q))
    .sort((a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name));
}

/* ---------------- 背景与配色 ---------------- */

function hashHue(text) {
  let h = 0;
  for (let i = 0; i < (text || "").length; i++) h = (h * 31 + text.charCodeAt(i)) % 360;
  return h;
}

function tileGradient(name) {
  const h = hashHue(name || "svc");
  return [`hsl(${h} 68% 56%)`, `hsl(${(h + 42) % 360} 62% 40%)`];
}

function isEmoji(str) {
  return /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(str || "");
}

const runtimeGlyph = {
  docker: "🐳", systemd: "⚙", process: "🖥", tailscale: "🔗", unknown: "❓",
};

/* ---------------- 外观 ---------------- */

const TILE_SIZES = { sm: 56, md: 72, lg: 92 };

function applyAppearance() {
  const ap = state.appearance;
  const wall = document.getElementById("wallpaper");
  if (ap.wallpaper) {
    wall.style.backgroundImage = `url("${ap.wallpaper}")`;
    wall.classList.add("dim");
    wall.style.setProperty("--dim", String(ap.wallpaper_dim ?? 0.35));
    wall.style.filter = ap.wallpaper_blur ? `blur(${ap.wallpaper_blur}px)` : "";
  } else {
    wall.style.backgroundImage = "";
    wall.classList.remove("dim");
    wall.style.filter = "";
  }
  document.body.classList.toggle("desktop-mode", !!ap.desktop_mode);
  document.body.classList.toggle("layout-desktop", (ap.layout || "desktop") === "desktop");
  document.documentElement.style.setProperty("--tile", (TILE_SIZES[ap.tile_size] || 72) + "px");
}

/* ---------------- 渲染 ---------------- */

function renderRail() {
  const rail = $("#rail");
  rail.innerHTML = "";
  state.pages.forEach((p, i) => {
    const btn = el("button", "rail-btn" + (i === state.page ? " active" : ""));
    btn.innerHTML = svgIcon(PAGE_ICONS[i % PAGE_ICONS.length], 20) || "•";
    btn.appendChild(el("span", "rail-label", p.name));
    btn.onclick = () => { state.page = i; location.hash = p.id; render(); };
    if (state.edit) btn.ondblclick = () => openPageDrawer(p);
    rail.appendChild(btn);
  });
  if (state.edit) {
    rail.appendChild(el("div", "rail-sep"));
    const add = el("button", "rail-btn", "＋");
    add.style.fontSize = "18px";
    add.appendChild(el("span", "rail-label", "新建页面"));
    add.onclick = () => openPageDrawer(null);
    rail.appendChild(add);
  }
}

function renderFilters() {
  const box = $("#runtimeFilters");
  box.innerHTML = "";
  ["docker", "systemd", "process", "tailscale"].forEach((k) => {
    const chip = el("div", "chip" + (state.runtimeFilter === k ? " active" : ""),
      `${runtimeGlyph[k]} ${k}`);
    chip.onclick = () => { state.runtimeFilter = state.runtimeFilter === k ? "" : k; render(); };
    box.appendChild(chip);
  });
}

function renderCanvas() {
  const canvas = $("#canvas");
  canvas.innerHTML = "";
  const list = visibleServices();
  $("#empty").classList.toggle("hidden", list.length > 0);
  if (!list.length) return;

  const wrap = el("div", "board");
  const pageTitle = el("div", "board-title");
  pageTitle.appendChild(el("h1", "", currentPage()?.name || "服务"));
  pageTitle.appendChild(el("span", "board-count", `${list.length} 个服务`));
  wrap.appendChild(pageTitle);

  const grid = el("div", "board-grid");
  const tilePx = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--tile"), 10) || 86;
  const avail = canvas.clientWidth - 220;
  const maxCols = Math.max(2, Math.floor(avail / (tilePx + 18)));
  const cols = Math.min(list.length, Math.min(maxCols, 8));
  grid.style.gridTemplateColumns = `repeat(${cols}, ${tilePx + 42}px)`;
  list.forEach((svc) => grid.appendChild(tileNode(svc)));
  wrap.appendChild(grid);
  canvas.appendChild(wrap);

  if (state.edit) enableDragAndDrop(canvas);
  if (state.appearance.free_layout !== false) enableFreeDrag(canvas);
}

function tileNode(svc) {
  const node = el("div", "tile");
  node.draggable = state.edit;
  node.dataset.id = svc.id;

  const inner = el("div", "tile-inner");
  const icon = svc.icon || "";
  if (icon.startsWith("/")) {
    const img = document.createElement("img");
    img.src = icon;
    img.alt = svc.name;
    img.loading = "lazy";
    img.onerror = () => { inner.innerHTML = letterMark(svc.name); };
    inner.appendChild(img);
    inner.classList.add("has-art");
  } else if (isEmoji(icon)) {
    inner.textContent = icon;
    inner.classList.add("has-emoji");
  } else if (SVG_ICONS[icon]) {
    inner.innerHTML = svgIcon(icon, 38);
  } else {
    inner.innerHTML = letterMark(svc.name);
  }

  if (svc.status === "offline") inner.classList.add("offline");
  node.appendChild(inner);

  node.appendChild(el("span", "badge-dot dot-" + (svc.status || "unknown")));

  if (state.edit) {
    node.appendChild(el("span", "rt rt-" + (svc.runtime || "unknown"),
      runtimeGlyph[svc.runtime || "unknown"]));
  }

  const label = el("span", "tile-label", svc.name);
  if (svc.show_label === true || (svc.show_label !== false && state.appearance.show_labels)) {
    node.classList.add("show-label");
  }
  node.appendChild(label);

  node.onclick = () => {
    if (state.edit) { openDrawer(svc); return; }
    window.open(svc.url, "_blank", "noopener");
  };
  node.title = `${svc.name}${svc.description ? " — " + svc.description : ""}\n${svc.url || ""}`;
  return node;
}

/* letterMark 生成字母/首字标记，用于没有图标的服务 */
function letterMark(name) {
  const text = (name || "?").trim();
  const mark = /[\u4e00-\u9fa5]/.test(text) ? text[0] : text.slice(0, 1).toUpperCase();
  const h = hashHue(text);
  return `<span class="letter" style="background:linear-gradient(145deg, hsl(${h} 62% 55%), hsl(${(h + 40) % 360} 58% 38%))">${mark}</span>`;
}

/* 非编辑模式下点击即打开；拖动排序统一走编辑模式 */
function enableFreeDrag() { /* reserved for free-positioning of a future release */ }

function enableDragAndDrop(canvas) {
  let dragged = null;
  canvas.querySelectorAll(".tile").forEach((node) => {
    node.ondragstart = () => { dragged = node; node.classList.add("dragging"); };
    node.ondragend = () => node.classList.remove("dragging");
    node.ondragover = (e) => e.preventDefault();
    node.ondrop = async (e) => {
      e.preventDefault();
      if (!dragged || dragged === node) return;
      const ids = visibleServices().map((s) => s.id);
      const from = ids.indexOf(dragged.dataset.id);
      const to = ids.indexOf(node.dataset.id);
      if (from < 0 || to < 0) return;
      ids.splice(to, 0, ids.splice(from, 1)[0]);
      await api("/api/services/reorder", "POST", { page: currentPage()?.id, ids });
      await load();
    };
  });
}

/* ---------------- 编辑抽屉 ---------------- */

function openDrawer(svc) {
  state.editing = svc || {
    name: "", url: "", description: "", icon: "",
    page: currentPage()?.id, order: 0, hidden: false, pin: false,
  };
  $("#drawerTitle").textContent = svc ? "编辑服务" : "添加服务";
  $("#fName").value = state.editing.name || "";
  $("#fUrl").value = state.editing.url || "";
  $("#fDesc").value = state.editing.description || "";
  $("#fIcon").value = state.editing.icon || "";
  $("#fOrder").value = state.editing.order || 0;
  $("#fHidden").checked = !!state.editing.hidden;
  $("#fPin").checked = !!state.editing.pin;
  $("#fLabel").checked = state.editing.show_label !== false;
  const pageSel = $("#fPage");
  pageSel.innerHTML = "";
  state.pages.forEach((p) => {
    const opt = el("option", "", p.name);
    opt.value = p.id;
    if (p.id === state.editing.page) opt.selected = true;
    pageSel.appendChild(opt);
  });
  const detail = $("#detailBox");
  detail.innerHTML = "";
  if (svc && svc.runtime_detail) {
    Object.entries(svc.runtime_detail).forEach(([k, v]) => {
      detail.appendChild(el("div", "", `${k}: ${v}`));
    });
  }
  $("#deleteBtn").classList.toggle("hidden", !svc);
  $("#drawer").classList.remove("hidden");
}

function closeDrawer() {
  $("#drawer").classList.add("hidden");
  state.editing = null;
}

async function saveService() {
  const svc = Object.assign({}, state.editing || {}, {
    name: $("#fName").value.trim(),
    url: $("#fUrl").value.trim(),
    description: $("#fDesc").value.trim(),
    icon: $("#fIcon").value.trim(),
    page: $("#fPage").value,
    order: parseInt($("#fOrder").value || "0", 10),
    hidden: $("#fHidden").checked,
    pin: $("#fPin").checked,
    show_label: $("#fLabel").checked,
  });
  if (!svc.name || !svc.url) { alert("名称和地址必填"); return; }
  if (state.editing && state.editing.id) {
    await api(`/api/services/${encodeURIComponent(state.editing.id)}`, "PUT", svc);
  } else {
    await api("/api/services", "POST", svc);
  }
  closeDrawer();
  await load();
}

async function deleteService() {
  if (!state.editing || !state.editing.id) return;
  if (!confirm("确认删除该服务？")) return;
  await api(`/api/services/${encodeURIComponent(state.editing.id)}`, "DELETE");
  closeDrawer();
  await load();
}

function openPageDrawer(page) {
  $("#pName").value = page ? page.name : "";
  $("#pId").value = page ? page.id : "";
  const list = $("#pageList");
  list.innerHTML = "";
  state.pages.forEach((p) => {
    const row = el("div");
    row.appendChild(el("span", "", p.name));
    const del = el("button", "btn ghost", "删除");
    del.onclick = async () => {
      if (!confirm(`删除页面「${p.name}」？其中的服务会移到自动发现页`)) return;
      await api(`/api/pages/${encodeURIComponent(p.id)}`, "DELETE");
      await load();
      openPageDrawer(null);
    };
    row.appendChild(del);
    list.appendChild(row);
  });
  $("#pageDrawer").classList.remove("hidden");
}

async function addPage() {
  const name = $("#pName").value.trim();
  if (!name) { alert("请填写页面名称"); return; }
  const id = $("#pId").value.trim() || name.toLowerCase().replace(/\s+/g, "-");
  await api("/api/pages", "POST", { id, name, order: (state.pages.length + 1) * 10 });
  $("#pName").value = "";
  $("#pId").value = "";
  await load();
}

async function uploadIcon() {
  const input = $("#fUpload");
  input.onchange = async () => {
    if (!input.files.length) return;
    const fd = new FormData();
    fd.append("file", input.files[0]);
    const res = await fetch("/api/icons", { method: "POST", body: fd });
    if (!res.ok) { alert("上传失败"); return; }
    const data = await res.json();
    $("#fIcon").value = data.url;
  };
  input.click();
}

function openSettings() {
  const ap = state.appearance;
  $("#optLabels").checked = !!ap.show_labels;
  $("#optFree").checked = ap.free_layout !== false;
  $("#optDesktop").checked = !!ap.desktop_mode;
  $("#optSize").value = ap.tile_size || "md";
  $("#optLayout").value = ap.layout || "desktop";
  $("#wBlur").value = ap.wallpaper_blur || 0;
  $("#wDim").value = Math.round((ap.wallpaper_dim ?? 0.35) * 100);
  $("#wCurrent").textContent = ap.wallpaper ? "当前：" + ap.wallpaper.split("/").pop() : "当前：默认渐变";
  $("#settingsDrawer").classList.remove("hidden");
}

async function saveSettings() {
  const payload = {
    wallpaper: state.appearance.wallpaper || "",
    wallpaper_blur: parseInt($("#wBlur").value || "0", 10),
    wallpaper_dim: parseInt($("#wDim").value || "35", 10) / 100,
    show_labels: $("#optLabels").checked,
    free_layout: $("#optFree").checked,
    desktop_mode: $("#optDesktop").checked,
    tile_size: $("#optSize").value,
    layout: $("#optLayout").value,
  };
  state.appearance = Object.assign(state.appearance, payload);
  applyAppearance();
  await api("/api/settings", "POST", payload);
  await load();
}

/* ---------------- 主题 ---------------- */

function currentTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  return THEMES.includes(saved) ? saved : "auto";
}

function applyTheme(theme) {
  if (theme === "auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
  const btn = document.getElementById("themeBtn");
  if (btn) {
    btn.textContent = THEME_ICONS[theme];
    btn.title = `主题：${THEME_LABELS[theme]}（点击切换）`;
  }
}

function cycleTheme() {
  const next = THEMES[(THEMES.indexOf(currentTheme()) + 1) % THEMES.length];
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
}

/* ---------------- 交互 ---------------- */

function flip(dir) {
  if (!state.pages.length) return;
  state.page = (state.page + dir + state.pages.length) % state.pages.length;
  location.hash = state.pages[state.page].id;
  render();
}

function render() {
  const hash = (location.hash || "").replace("#", "");
  if (hash) {
    const idx = state.pages.findIndex((p) => p.id === hash);
    if (idx >= 0) state.page = idx;
  }
  renderRail();
  renderFilters();
  renderCanvas();
}

function bind() {
  applyTheme(currentTheme());
  $("#scanBtn").onclick = async () => {
    const btn = $("#scanBtn");
    btn.textContent = "…";
    try { await api("/api/scan", "POST"); } catch (e) { alert("扫描失败: " + e.message); }
    btn.textContent = "⟳";
    await load();
  };
  $("#editBtn").onclick = () => {
    state.edit = !state.edit;
    $("#editBtn").classList.toggle("on", state.edit);
    render();
  };
  $("#themeBtn").onclick = cycleTheme;
  $("#settingsBtn").onclick = openSettings;
  $("#closeSettings").onclick = () => $("#settingsDrawer").classList.add("hidden");
  $("#saveSettings").onclick = saveSettings;
  $("#wUploadBtn").onclick = () => $("#wUpload").click();
  $("#wUpload").onchange = async () => {
    if (!$("#wUpload").files.length) return;
    const fd = new FormData();
    fd.append("file", $("#wUpload").files[0]);
    const res = await fetch("/api/wallpapers", { method: "POST", body: fd });
    if (!res.ok) { alert("壁纸上传失败"); return; }
    const data = await res.json();
    state.appearance.wallpaper = data.url;
    applyAppearance();
    $("#wCurrent").textContent = "当前：" + data.url.split("/").pop();
  };
  $("#wClearBtn").onclick = async () => {
    state.appearance.wallpaper = "";
    applyAppearance();
    $("#wCurrent").textContent = "当前：默认渐变";
  };
  $("#search").oninput = (e) => { state.filter = e.target.value.trim(); renderCanvas(); };
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement.tagName !== "INPUT") {
      e.preventDefault(); $("#search").focus();
    }
    if (e.key === "Escape") {
      closeDrawer();
      $("#pageDrawer").classList.add("hidden");
      $("#settingsDrawer").classList.add("hidden");
    }
    if (e.key === "ArrowRight") flip(1);
    if (e.key === "ArrowLeft") flip(-1);
  });
  $("#closeDrawer").onclick = closeDrawer;
  $("#saveBtn").onclick = saveService;
  $("#deleteBtn").onclick = deleteService;
  $("#addBtn").onclick = () => openDrawer(null);
  $("#closePageDrawer").onclick = () => $("#pageDrawer").classList.add("hidden");
  $("#addPageBtn").onclick = addPage;
  $("#uploadBtn").onclick = uploadIcon;

  let startX = null;
  document.addEventListener("touchstart", (e) => { startX = e.touches[0].clientX; }, { passive: true });
  document.addEventListener("touchend", (e) => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 70) flip(dx < 0 ? 1 : -1);
    startX = null;
  }, { passive: true });

  window.addEventListener("resize", () => renderCanvas());
}

bind();
load();
setInterval(load, 60000);
