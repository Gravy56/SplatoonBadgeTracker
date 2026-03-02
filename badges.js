const STORAGE_KEY = "splatoon-badge-tracker-v1";

const GROUPS = [
  { prefix: "Story", category: "Campaign", total: 20 },
  { prefix: "Anarchy", category: "Ranked", total: 22 },
  { prefix: "Salmon", category: "Salmon Run", total: 24 },
  { prefix: "Turf", category: "Turf War", total: 22 },
  { prefix: "Splatfest", category: "Splatfest", total: 18 },
  { prefix: "X Battle", category: "X Rank", total: 16 },
  { prefix: "Catalog", category: "Catalog", total: 20 },
  { prefix: "Tableturf", category: "Tableturf", total: 18 }
];

const BADGES = GROUPS.flatMap(group =>
  Array.from({ length: group.total }, (_, i) => {
    const number = i + 1;
    return {
      id: `${group.prefix.toLowerCase().replace(/\s+/g, "-")}-${number}`,
      name: `${group.prefix} Badge ${number}`,
      category: group.category,
      requirement: `Complete ${group.prefix} milestone ${number}`,
      marker: `${group.prefix[0]}${String(number).padStart(2, "0")}`
    };
  })
);

const STATUS_ORDER = ["locked", "in-progress", "earned"];

const state = loadState();

const grid = document.getElementById("badgeGrid");
const stats = document.getElementById("stats");
const filters = document.getElementById("filters");
const search = document.getElementById("search");
const resetBtn = document.getElementById("reset");
const detailBar = document.getElementById("detailBar");

const categories = ["All", ...new Set(BADGES.map(b => b.category))];
let activeCategory = "All";

renderFilters();
render();

search.addEventListener("input", render);
resetBtn.addEventListener("click", () => {
  if (!confirm("Reset all badge progress?")) return;
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
});

function renderFilters() {
  filters.innerHTML = "";
  categories.forEach(category => {
    const btn = document.createElement("button");
    btn.className = "filter-btn" + (category === activeCategory ? " active" : "");
    btn.textContent = category;
    btn.addEventListener("click", () => {
      activeCategory = category;
      renderFilters();
      render();
    });
    filters.appendChild(btn);
  });
}

function render() {
  const query = search.value.trim().toLowerCase();
  const filtered = BADGES.filter(badge => {
    const matchesCategory = activeCategory === "All" || badge.category === activeCategory;
    const matchesQuery = badge.name.toLowerCase().includes(query) || badge.category.toLowerCase().includes(query);
    return matchesCategory && matchesQuery;
  });

  grid.innerHTML = "";
  filtered.forEach(badge => {
    const status = state[badge.id] || "locked";
    const tile = document.createElement("button");
    tile.className = `badge-tile ${status}`;
    tile.type = "button";
    tile.title = `${badge.name} (${badge.category})`;
    tile.innerHTML = `<span class="tile-mark">${badge.marker}</span>`;
    tile.addEventListener("click", () => {
      const next = nextStatus(status);
      state[badge.id] = next;
      saveState();
      render();
    });
    tile.addEventListener("mouseenter", () => {
      detailBar.textContent = `${badge.name} | ${badge.category} | ${badge.requirement} | ${status}`;
    });
    grid.appendChild(tile);
  });

  if (filtered.length === 0) {
    detailBar.textContent = "No badges match this filter.";
  }

  renderStats();
}

function renderStats() {
  const total = BADGES.length;
  const earned = Object.values(state).filter(v => v === "earned").length;
  const inProgress = Object.values(state).filter(v => v === "in-progress").length;
  const locked = total - earned - inProgress;

  stats.innerHTML = `
    <div class="stat"><strong>${earned}</strong>got</div>
    <div class="stat"><strong>${inProgress}</strong>grinding</div>
    <div class="stat"><strong>${locked}</strong>left</div>
  `;
}

function nextStatus(current) {
  const idx = STATUS_ORDER.indexOf(current);
  return STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
}

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
