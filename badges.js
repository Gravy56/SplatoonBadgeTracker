const STORAGE_KEY = "splatoon-badge-tracker-v2";
const STATUS_ORDER = ["locked", "in-progress", "earned"];

const GROUPS = [
  { prefix: "Story", category: "Campaign", total: 20, color: "#ff7e6b" },
  { prefix: "Anarchy", category: "Ranked", total: 22, color: "#f68dff" },
  { prefix: "Salmon", category: "Salmon Run", total: 24, color: "#9bf264" },
  { prefix: "Turf", category: "Turf War", total: 22, color: "#6be6ff" },
  { prefix: "Splatfest", category: "Splatfest", total: 18, color: "#ffd866" },
  { prefix: "X Battle", category: "X Rank", total: 16, color: "#9ba2ff" },
  { prefix: "Catalog", category: "Catalog", total: 20, color: "#ff9f43" },
  { prefix: "Tableturf", category: "Tableturf", total: 18, color: "#b983ff" }
];

const BADGES = GROUPS.flatMap(group =>
  Array.from({ length: group.total }, (_, i) => {
    const number = i + 1;
    const marker = `${group.prefix[0]}${String(number).padStart(2, "0")}`;
    return {
      id: `${group.prefix.toLowerCase().replace(/\s+/g, "-")}-${number}`,
      name: `${group.prefix} Badge ${number}`,
      category: group.category,
      requirement: `Complete ${group.prefix} milestone ${number}`,
      marker,
      image: makeBadgeImage(marker, group.color)
    };
  })
);

const ui = {
  grid: document.getElementById("badgeGrid"),
  stats: document.getElementById("stats"),
  filters: document.getElementById("filters"),
  search: document.getElementById("search"),
  resetBtn: document.getElementById("reset"),
  detailBar: document.getElementById("detailBar"),
  statusFilter: document.getElementById("statusFilter"),
  sortBy: document.getElementById("sortBy"),
  themeToggle: document.getElementById("themeToggle"),
  viewToggle: document.getElementById("viewToggle"),
  favoritesOnly: document.getElementById("favoritesOnly"),
  hideEarned: document.getElementById("hideEarned"),
  randomBadge: document.getElementById("randomBadge"),
  focusMode: document.getElementById("focusMode"),
  bulkLocked: document.getElementById("bulkLocked"),
  bulkProgress: document.getElementById("bulkProgress"),
  bulkEarned: document.getElementById("bulkEarned"),
  exportBtn: document.getElementById("exportBtn"),
  importFile: document.getElementById("importFile"),
  shareBtn: document.getElementById("shareBtn"),
  overallBar: document.getElementById("overallBar"),
  categoryProgress: document.getElementById("categoryProgress"),
  dailyChallenge: document.getElementById("dailyChallenge"),
  milestones: document.getElementById("milestones")
};

const defaultState = {
  badgeState: {},
  favorites: [],
  notes: {},
  updatedAt: {},
  activeCategory: "All",
  statusFilter: "all",
  sortBy: "default",
  viewMode: "grid",
  hideEarned: false,
  favoritesOnly: false,
  focusMode: false,
  theme: "dark",
  streak: { date: "", count: 0 },
  lastVisited: ""
};

const state = loadState();
const categories = ["All", ...new Set(BADGES.map(b => b.category))];

init();

function init() {
  applyTheme();
  renderFilters();
  bindEvents();
  updateVisitStreak();
  render();
}

function bindEvents() {
  ui.search.addEventListener("input", render);
  ui.statusFilter.addEventListener("change", () => {
    state.statusFilter = ui.statusFilter.value;
    saveState();
    render();
  });
  ui.sortBy.addEventListener("change", () => {
    state.sortBy = ui.sortBy.value;
    saveState();
    render();
  });
  ui.resetBtn.addEventListener("click", resetAll);
  ui.themeToggle.addEventListener("click", toggleTheme);
  ui.viewToggle.addEventListener("click", toggleView);
  ui.favoritesOnly.addEventListener("click", () => toggleFlag("favoritesOnly"));
  ui.hideEarned.addEventListener("click", () => toggleFlag("hideEarned"));
  ui.focusMode.addEventListener("click", () => toggleFlag("focusMode"));
  ui.randomBadge.addEventListener("click", pickRandomBadge);
  ui.bulkLocked.addEventListener("click", () => bulkSetStatus("locked"));
  ui.bulkProgress.addEventListener("click", () => bulkSetStatus("in-progress"));
  ui.bulkEarned.addEventListener("click", () => bulkSetStatus("earned"));
  ui.exportBtn.addEventListener("click", exportData);
  ui.importFile.addEventListener("change", importData);
  ui.shareBtn.addEventListener("click", shareProgress);

  document.addEventListener("keydown", e => {
    if (e.key === "/") {
      e.preventDefault();
      ui.search.focus();
    }
    if (e.key.toLowerCase() === "t") toggleTheme();
    if (e.key.toLowerCase() === "v") toggleView();
    if (e.key.toLowerCase() === "r") pickRandomBadge();
    if (e.key === "Escape") {
      ui.search.value = "";
      render();
    }
  });
}

function renderFilters() {
  ui.filters.innerHTML = "";
  categories.forEach(category => {
    const btn = document.createElement("button");
    btn.className = "filter-btn" + (category === state.activeCategory ? " active" : "");
    btn.textContent = category;
    btn.addEventListener("click", () => {
      state.activeCategory = category;
      saveState();
      renderFilters();
      render();
    });
    ui.filters.appendChild(btn);
  });
  ui.statusFilter.value = state.statusFilter;
  ui.sortBy.value = state.sortBy;
}

function render() {
  const query = ui.search.value.trim().toLowerCase();
  const filtered = getFilteredBadges(query);

  ui.grid.className = `badge-grid ${state.viewMode === "list" ? "list-view" : ""}`;
  ui.grid.innerHTML = "";

  filtered.forEach(badge => {
    const status = state.badgeState[badge.id] || "locked";
    const tile = document.createElement("article");
    tile.className = `badge-tile ${status}`;
    tile.title = `${badge.name} (${badge.category})`;

    const img = document.createElement("img");
    img.src = badge.image;
    img.alt = badge.name;
    img.className = "badge-image";
    img.addEventListener("click", () => cycleStatus(badge.id));

    const meta = document.createElement("div");
    meta.className = "tile-meta";
    meta.innerHTML = `<strong>${badge.name}</strong><span>${badge.requirement}</span><small>${badge.category}</small>`;

    const controls = document.createElement("div");
    controls.className = "tile-controls";

    const star = document.createElement("button");
    star.className = "mini-btn";
    star.textContent = isFavorite(badge.id) ? "⭐" : "☆";
    star.addEventListener("click", () => toggleFavorite(badge.id));

    const noteBtn = document.createElement("button");
    noteBtn.className = "mini-btn";
    noteBtn.textContent = "📝";
    noteBtn.addEventListener("click", () => editNote(badge.id, badge.name));

    controls.append(star, noteBtn);
    tile.append(img, meta, controls);

    tile.addEventListener("mouseenter", () => {
      const note = state.notes[badge.id] ? ` | Note: ${state.notes[badge.id]}` : "";
      ui.detailBar.textContent = `${badge.name} | ${badge.category} | ${badge.requirement} | ${status}${note}`;
    });

    ui.grid.appendChild(tile);
  });

  if (filtered.length === 0) ui.detailBar.textContent = "No badges match the active filters.";

  renderStats();
  renderCategoryProgress();
  renderMilestones();
  renderDailyChallenge(filtered);
  syncToggleButtons();
}

function getFilteredBadges(query) {
  let items = BADGES.filter(badge => {
    const status = state.badgeState[badge.id] || "locked";
    const matchesCategory = state.activeCategory === "All" || badge.category === state.activeCategory;
    const matchesQuery = [badge.name, badge.category, badge.requirement].join(" ").toLowerCase().includes(query);
    const matchesStatus = state.statusFilter === "all" || status === state.statusFilter;
    const matchesFavorite = !state.favoritesOnly || isFavorite(badge.id);
    const matchesHideEarned = !state.hideEarned || status !== "earned";
    const matchesFocus = !state.focusMode || status !== "earned";
    return matchesCategory && matchesQuery && matchesStatus && matchesFavorite && matchesHideEarned && matchesFocus;
  });

  if (state.sortBy === "name-asc") items = items.sort((a, b) => a.name.localeCompare(b.name));
  if (state.sortBy === "name-desc") items = items.sort((a, b) => b.name.localeCompare(a.name));
  if (state.sortBy === "status") items = items.sort((a, b) => STATUS_ORDER.indexOf(state.badgeState[a.id] || "locked") - STATUS_ORDER.indexOf(state.badgeState[b.id] || "locked"));
  if (state.sortBy === "recent") items = items.sort((a, b) => (state.updatedAt[b.id] || 0) - (state.updatedAt[a.id] || 0));

  return items;
}

function cycleStatus(badgeId) {
  const current = state.badgeState[badgeId] || "locked";
  const next = STATUS_ORDER[(STATUS_ORDER.indexOf(current) + 1) % STATUS_ORDER.length];
  state.badgeState[badgeId] = next;
  state.updatedAt[badgeId] = Date.now();
  saveState();
  render();
}

function renderStats() {
  const total = BADGES.length;
  const values = BADGES.map(b => state.badgeState[b.id] || "locked");
  const earned = values.filter(v => v === "earned").length;
  const inProgress = values.filter(v => v === "in-progress").length;
  const locked = total - earned - inProgress;
  const percent = Math.round((earned / total) * 100);
  const favoriteCount = state.favorites.length;

  ui.stats.innerHTML = `
    <div class="stat"><strong>${earned}</strong>earned</div>
    <div class="stat"><strong>${inProgress}</strong>grinding</div>
    <div class="stat"><strong>${locked}</strong>locked</div>
    <div class="stat"><strong>${favoriteCount}</strong>favorites</div>
    <div class="stat"><strong>${state.streak.count}</strong>day streak</div>
  `;
  ui.overallBar.style.width = `${percent}%`;
  ui.overallBar.textContent = `Overall completion ${percent}%`;
}

function renderCategoryProgress() {
  ui.categoryProgress.innerHTML = "";
  GROUPS.forEach(group => {
    const groupBadges = BADGES.filter(b => b.category === group.category);
    const done = groupBadges.filter(b => (state.badgeState[b.id] || "locked") === "earned").length;
    const pct = Math.round((done / groupBadges.length) * 100);
    const row = document.createElement("div");
    row.className = "category-row";
    row.innerHTML = `<span>${group.category}</span><div class="mini-bar"><div style="width:${pct}%"></div></div><strong>${pct}%</strong>`;
    ui.categoryProgress.appendChild(row);
  });
}

function renderMilestones() {
  const earned = BADGES.filter(b => (state.badgeState[b.id] || "locked") === "earned").length;
  const levels = [10, 25, 50, 75, 100, 125, 150];
  ui.milestones.innerHTML = levels.map(level => `<li>${earned >= level ? "✅" : "⬜"} Reach ${level} earned badges</li>`).join("");
}

function renderDailyChallenge(pool) {
  const list = pool.length ? pool : BADGES;
  const daySeed = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const idx = Number(daySeed) % list.length;
  const badge = list[idx];
  const status = state.badgeState[badge.id] || "locked";
  ui.dailyChallenge.innerHTML = `<h3>Daily Challenge</h3><p>Work on <strong>${badge.name}</strong></p><p>Status: ${status}</p>`;
}

function syncToggleButtons() {
  ui.themeToggle.textContent = state.theme === "dark" ? "🌙 Dark" : "☀️ Light";
  ui.viewToggle.textContent = state.viewMode === "grid" ? "🧱 Grid" : "📋 List";
  ui.favoritesOnly.classList.toggle("active", state.favoritesOnly);
  ui.hideEarned.classList.toggle("active", state.hideEarned);
  ui.focusMode.classList.toggle("active", state.focusMode);
}

function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  applyTheme();
  saveState();
  render();
}

function toggleView() {
  state.viewMode = state.viewMode === "grid" ? "list" : "grid";
  saveState();
  render();
}

function toggleFlag(flag) {
  state[flag] = !state[flag];
  saveState();
  render();
}

function applyTheme() {
  document.body.classList.toggle("light-theme", state.theme === "light");
}

function toggleFavorite(id) {
  state.favorites = isFavorite(id) ? state.favorites.filter(f => f !== id) : [...state.favorites, id];
  saveState();
  render();
}

function isFavorite(id) {
  return state.favorites.includes(id);
}

function editNote(id, name) {
  const current = state.notes[id] || "";
  const next = prompt(`Note for ${name}`, current);
  if (next === null) return;
  state.notes[id] = next.trim();
  saveState();
  render();
}

function pickRandomBadge() {
  const filtered = getFilteredBadges(ui.search.value.trim().toLowerCase());
  if (!filtered.length) return;
  const badge = filtered[Math.floor(Math.random() * filtered.length)];
  ui.detailBar.textContent = `🎲 Random pick: ${badge.name} (${badge.category})`;
}

function bulkSetStatus(status) {
  const filtered = getFilteredBadges(ui.search.value.trim().toLowerCase());
  filtered.forEach(b => {
    state.badgeState[b.id] = status;
    state.updatedAt[b.id] = Date.now();
  });
  saveState();
  render();
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "splatoon-badge-save.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...defaultState, ...parsed }));
      location.reload();
    } catch {
      alert("Invalid backup file.");
    }
  };
  reader.readAsText(file);
}

function shareProgress() {
  const earned = BADGES.filter(b => (state.badgeState[b.id] || "locked") === "earned").length;
  const text = `I have earned ${earned}/${BADGES.length} Splatoon badges!`;
  navigator.clipboard.writeText(text).then(() => {
    ui.detailBar.textContent = "Progress summary copied to clipboard!";
  });
}

function resetAll() {
  if (!confirm("Reset all badge progress and settings?")) return;
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}

function updateVisitStreak() {
  const today = new Date().toISOString().slice(0, 10);
  const last = state.lastVisited;
  if (!last) {
    state.streak = { date: today, count: 1 };
  } else if (last !== today) {
    const diffDays = Math.floor((new Date(today) - new Date(last)) / 86400000);
    state.streak.count = diffDays === 1 ? state.streak.count + 1 : 1;
    state.streak.date = today;
  }
  state.lastVisited = today;
  saveState();
}

function loadState() {
  try {
    return { ...defaultState, ...(JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}) };
  } catch {
    return { ...defaultState };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function makeBadgeImage(marker, color) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'>
    <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop stop-color='${color}'/><stop offset='1' stop-color='#1e1e1e'/></linearGradient></defs>
    <rect width='120' height='120' rx='18' fill='url(#g)'/>
    <circle cx='60' cy='40' r='20' fill='rgba(255,255,255,.35)'/>
    <text x='60' y='78' text-anchor='middle' fill='white' font-family='monospace' font-size='26'>${marker}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
