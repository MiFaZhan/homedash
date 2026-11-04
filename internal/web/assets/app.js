/* homedash dashboard - vanilla JS, no build step */
const state = {
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
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${text}`);
  }
  return res.status === 204 ? null : res.json();
}

async function load() {
  const cfg = await api("/api/config");
  state.pages = cfg.pages || [];
  state.services = cfg.services || [];
  if (state.page >= state.pages.length) state.page = 0;
  render();
}

function currentPage() {
  return state.pages[state.page];
}

function visibleServices() {
  const page = currentPage();
  const q = state.filter.toLowerCase();
  return state.services
    .filter((s) => !page || s.page === page.id)
    .filter((s) => !state.runtimeFilter || s.runtime === state.runtimeFilter)
    .filter((s) => {
      if (!q) return true;
      return (s.name || "").toLowerCase().includes(q) ||
        (s.description || "").toLowerCase().includes(q) ||
        (s.url || "").toLowerCase().includes(q);
    })
    .sort((a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name));
}

function renderTabs() {
  const tabs = $("#tabs");
  tabs.innerHTML = "";
  state.pages.forEach((p, i) => {
    const tab = el("div", "tab" + (i === state.page ? " active" : ""));
    tab.appendChild(document.createTextNode(p.name));
    const count = state.services.filter((s) => s.page === p.id).length;
    tab.appendChild(el("span", "count", count));
    tab.onclick = () => { state.page = i; render(); };
    if (state.edit) {
      tab.ondblclick = () => openPageDrawer(p);
    }
    tabs.appendChild(tab);
  });
  if (state.edit) {
    const add = el("div", "tab", "＋ 页面");
    add.onclick = () => openPageDrawer(null);
    tabs.appendChild(add);
  }
}

function renderFilters() {
  const box = $("#runtimeFilters");
  box.innerHTML = "";
  const kinds = ["docker", "systemd", "process", "tailscale"];
  kinds.forEach((k) => {
    const chip = el("div", "chip" + (state.runtimeFilter === k ? " active" : ""), runtimeLabel(k));
    chip.onclick = () => { state.runtimeFilter = state.runtimeFilter === k ? "" : k; render(); };
    box.appendChild(chip);
  });
}

function runtimeLabel(rt) {
  switch (rt) {
    case "docker": return "🐳 Docker";
    case "systemd": return "⚙ systemd";
    case "process": return "🖥 宿主机";
    case "tailscale": return "🔗 Tailscale";
    default: return "❓ 未知";
  }
}

function renderGrid() {
  const grid = $("#grid");
  grid.innerHTML = "";
  const list = visibleServices();
  $("#empty").classList.toggle("hidden", list.length > 0);
  list.forEach((svc) => grid.appendChild(card(svc)));
  if (state.edit) enableDragAndDrop(grid);
}

function card(svc) {
  const node = el("div", "card" + (svc.hidden ? " hidden-service" : ""));
  node.draggable = state.edit;
  node.dataset.id = svc.id;

  const head = el("div", "card-head");
  const icon = el("div", "icon");
  if (svc.icon && svc.icon.startsWith("/")) {
    const img = document.createElement("img");
    img.src = svc.icon;
    img.alt = svc.name;
    icon.appendChild(img);
  } else {
    icon.textContent = svc.icon || "•";
  }
  head.appendChild(icon);
  head.appendChild(el("div", "card-name", svc.name));
  node.appendChild(head);

  if (svc.description) node.appendChild(el("div", "card-desc", svc.description));

  const foot = el("div", "card-foot");
  foot.appendChild(el("span", "dot " + (svc.status || "unknown")));
  foot.appendChild(el("span", "", svc.status === "online" ? `${svc.latency_ms || 0}ms` : (svc.status || "unknown")));
  foot.appendChild(el("span", "badge " + (svc.runtime || "unknown"), runtimeLabel(svc.runtime)));
  if (svc.port) foot.appendChild(el("span", "", ":" + svc.port));
  if (svc.pin) foot.appendChild(el("span", "", "📌"));
  node.appendChild(foot);

  node.onclick = () => {
    if (state.edit) { openDrawer(svc); return; }
    window.open(svc.url, "_blank", "noopener");
  };
  return node;
}

function enableDragAndDrop(grid) {
  let dragged = null;
  grid.querySelectorAll(".card").forEach((node) => {
    node.ondragstart = () => { dragged = node; node.classList.add("dragging"); };
    node.ondragend = () => { node.classList.remove("dragging"); };
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

function openDrawer(svc) {
  state.editing = svc || { name: "", url: "", description: "", icon: "", page: currentPage()?.id, order: 0, hidden: false, pin: false };
  $("#drawerTitle").textContent = svc ? "编辑服务" : "添加服务";
  $("#fName").value = state.editing.name || "";
  $("#fUrl").value = state.editing.url || "";
  $("#fDesc").value = state.editing.description || "";
  $("#fIcon").value = state.editing.icon || "";
  $("#fOrder").value = state.editing.order || 0;
  $("#fHidden").checked = !!state.editing.hidden;
  $("#fPin").checked = !!state.editing.pin;
  const pageSel = $("#fPage");
  pageSel.innerHTML = "";
  state.pages.forEach((p) => {
    const opt = el("option", "", p.name);
    opt.value = p.id;
    if (p.id === state.editing.page) opt.selected = true;
    pageSel.appendChild(opt);
  });
  const detail = $("#detailBox");
  detail.textContent = "";
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

function flip(dir) {
  if (!state.pages.length) return;
  state.page = (state.page + dir + state.pages.length) % state.pages.length;
  render();
}

function bind() {
  $("#scanBtn").onclick = async () => {
    $("#scanBtn").textContent = "扫描中…";
    try { await api("/api/scan", "POST"); } catch (e) { alert("扫描失败: " + e.message); }
    $("#scanBtn").textContent = "扫描";
    await load();
  };
  $("#editBtn").onclick = () => {
    state.edit = !state.edit;
    $("#editBtn").classList.toggle("on", state.edit);
    $("#editBtn").textContent = state.edit ? "完成" : "编辑";
    render();
  };
  $("#search").oninput = (e) => { state.filter = e.target.value.trim(); renderGrid(); };
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement.tagName !== "INPUT") { e.preventDefault(); $("#search").focus(); }
    if (e.key === "Escape") { closeDrawer(); $("#pageDrawer").classList.add("hidden"); }
    if (e.key === "ArrowRight") flip(1);
    if (e.key === "ArrowLeft") flip(-1);
  });
  $("#prevPage").onclick = () => flip(-1);
  $("#nextPage").onclick = () => flip(1);
  $("#closeDrawer").onclick = closeDrawer;
  $("#saveBtn").onclick = saveService;
  $("#deleteBtn").onclick = deleteService;
  $("#addBtn").onclick = () => openDrawer(null);
  $("#closePageDrawer").onclick = () => $("#pageDrawer").classList.add("hidden");
  $("#addPageBtn").onclick = addPage;
  $("#uploadBtn").onclick = uploadIcon;

  // swipe between pages
  let startX = null;
  document.addEventListener("touchstart", (e) => { startX = e.touches[0].clientX; }, { passive: true });
  document.addEventListener("touchend", (e) => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 70) flip(dx < 0 ? 1 : -1);
    startX = null;
  }, { passive: true });
}

function render() {
  renderTabs();
  renderFilters();
  renderGrid();
}

bind();
load();
setInterval(load, 60000);
