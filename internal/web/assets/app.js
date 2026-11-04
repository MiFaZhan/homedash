/* homedash dashboard - vanilla JS, no build step */
const THEMES = ["auto", "light", "dark"];
const THEME_LABELS = { auto: "跟随系统", light: "浅色", dark: "深色" };
const THEME_ICONS = { auto: "🌗", light: "☀️", dark: "🌙" };
const THEME_KEY = "homedash.theme";

const ICON_GLYPHS = {
  database: "🗄️", monitor: "🖥️", network: "🌐", shield: "🛡️", terminal: "💻",
  nginx: "🧱", printer: "🖨️", box: "📦", bot: "🤖", activity: "📈", chart: "📊",
  globe: "🌍", mail: "✉️", "layout-dashboard": "🗂️", "help-circle": "❓",
  image: "🖼️", docker: "🐳", server: "🗄️", cloud: "☁️", code: "🧑‍💻",
};
const PAGE_GLYPHS = ["🏠", "🧑‍💻", "🛠️", "🌍", "🔎", "📦", "🧪", "⭐"];

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

function iconGlyph(icon) {
  if (!icon) return "🔹";
  if (icon.startsWith("/")) return null;
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(icon)) return icon;
  return ICON_GLYPHS[icon] || "🔹";
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
  document.documentElement.style.setProperty("--tile", (TILE_SIZES[ap.tile_size] || 72) + "px");
}

/* ---------------- 渲染 ---------------- */

function renderRail() {
  const rail = $("#rail");
  rail.innerHTML = "";
  state.pages.forEach((p, i) => {
    const btn = el("button", "rail-btn" + (i === state.page ? " active" : ""));
    btn.innerHTML = PAGE_GLYPHS[i % PAGE_GLYPHS.length];
    btn.appendChild(el("span", "rail-label", p.name));
    btn.onclick = () => { state.page = i; location.hash = p.id; render(); };
    if (state.edit) btn.ondblclick = () => openPageDrawer(p);
    rail.appendChild(btn);
  });
  if (state.edit) {
    rail.appendChild(el("div", "rail-sep"));
    const add = el("button", "rail-btn", "＋");
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

  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const tile = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--tile"), 10) || 72;
  const railSpace = state.appearance.desktop_mode ? 40 : 110;
  const usable = Math.max(200, w - railSpace - 40);
  const gap = Math.round(tile * (usable < 520 ? 0.28 : 0.47));
  const maxSpread = Math.max(tile, usable - tile - 40);
  const perCluster = Math.max(2, Math.min(7, Math.floor(maxSpread / (tile + gap)) + 1));
  const free = state.appearance.free_layout !== false;

  const placed = list.filter((s) => free && s.x !== null && s.x !== undefined && s.y !== null && s.y !== undefined);
  const auto = list.filter((s) => !placed.includes(s));

  // 已固定位置的图标
  placed.forEach((svc) => {
    const node = tileNode(svc, svc.x, svc.y);
    node.classList.add("pinned");
    canvas.appendChild(node);
  });

  // 自动排布的图标（沿弧线成组）
  const clusters = [];
  for (let i = 0; i < auto.length; i += perCluster) clusters.push(auto.slice(i, i + perCluster));
  const bandH = tile + 190;
  const cols = w < 1180 ? 1 : 2;

  clusters.forEach((group, ci) => {
    const col = cols === 1 ? 0 : ci % cols;
    const row = cols === 1 ? ci : Math.floor(ci / cols);
    const spread = Math.min((group.length - 1) * (tile + gap), maxSpread);
    const clusterW = spread + tile + 110;
    const usable = w - railSpace;
    const cx = clusters.length === 1
      ? railSpace + (w - railSpace) / 2
      : railSpace + (w - railSpace) * (cols === 1 ? 0.5 : 0.26 + col * 0.48);
    const cy = Math.max(150, h * 0.42) + row * bandH;

    const blob = el("div", "cluster");
    blob.style.width = `${clusterW}px`;
    blob.style.height = `${tile + 140}px`;
    blob.style.left = `${cx - clusterW / 2}px`;
    blob.style.top = `${cy - tile / 2 - 66}px`;
    blob.style.transform = `rotate(${(ci % 2 ? 1.3 : -1.1)}deg)`;
    canvas.appendChild(blob);

    group.forEach((svc, i) => {
      const t = group.length === 1 ? 0 : (i / (group.length - 1)) - 0.5;
      const x = cx + t * spread;
      const y = cy + Math.pow(Math.abs(t), 1.7) * 140 + Math.sin(i * 1.6) * 5;
      canvas.appendChild(tileNode(svc, x - tile / 2, y - tile / 2));
    });
  });

  if (state.edit) enableDragAndDrop(canvas);
  if (state.appearance.free_layout !== false) enableFreeDrag(canvas);
}

function tileNode(svc, left, top) {
  const node = el("div", "tile");
  node.style.left = `${left}px`;
  node.style.top = `${top}px`;
  node.draggable = state.edit;
  node.dataset.id = svc.id;

  const inner = el("div", "tile-inner");
  const [c1, c2] = tileGradient(svc.name);
  inner.style.setProperty("--c1", c1);
  inner.style.setProperty("--c2", c2);
  const glyph = iconGlyph(svc.icon);
  if (glyph === null) {
    const img = document.createElement("img");
    img.src = svc.icon;
    img.alt = svc.name;
    img.onerror = () => { inner.textContent = "🔹"; };
    inner.appendChild(img);
  } else {
    inner.textContent = glyph;
  }
  node.appendChild(inner);

  const dot = el("span", "badge-dot dot-" + (svc.status || "unknown"));
  node.appendChild(dot);

  if (state.edit) {
    const rt = el("span", "rt rt-" + (svc.runtime || "unknown"), runtimeGlyph[svc.runtime || "unknown"]);
    node.appendChild(rt);
  }

  const label = el("span", "tile-label", svc.name);
  const showLabel = svc.show_label === true || (svc.show_label !== false && state.appearance.show_labels);
  if (showLabel) node.classList.add("show-label");
  node.appendChild(label);

  node.onclick = () => {
    if (state.edit) { openDrawer(svc); return; }
    window.open(svc.url, "_blank", "noopener");
  };
  node.title = `${svc.name}${svc.description ? " — " + svc.description : ""}`;
  return node;
}

function enableFreeDrag(canvas) {
  canvas.querySelectorAll(".tile").forEach((node) => {
    node.onmousedown = (e) => {
      if (state.edit) return;           // 编辑模式用排序拖拽
      const svc = state.services.find((s) => s.id === node.dataset.id);
      if (!svc) return;
      const startX = e.clientX;
      const startY = e.clientY;
      const originLeft = node.offsetLeft;
      const originTop = node.offsetTop;
      let moved = false;

      const move = (ev) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
        node.style.left = `${originLeft + dx}px`;
        node.style.top = `${originTop + dy}px`;
        node.style.zIndex = "5";
      };
      const up = async () => {
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
        node.style.zIndex = "";
        if (!moved) return;
        const x = Math.round(node.offsetLeft);
        const y = Math.round(node.offsetTop);
        node.classList.add("pinned");
        await api(`/api/services/${encodeURIComponent(svc.id)}`, "PUT",
          Object.assign({}, svc, { x, y }));
        await load();
      };
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    };
  });
}

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
