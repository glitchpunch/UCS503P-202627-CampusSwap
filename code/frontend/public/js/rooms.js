// Explore rooms (reference 4): filter rooms, build a ranked list of up to 5, submit.
import { api, requireUser } from "./api.js";
import { fillHeader } from "./nav.js";
import { $, $$, formatDateTime, html, raw, setBusy, timeAgo, toast, toastError } from "./ui.js";

const MAX = 5;
const PAGE_SIZE = { grid: 6, compact: 12 };
const HOSTEL_STYLE = [
  { badge: "bg-badge-ganga text-amber-900 border-amber-200", icon: "text-amber-700", box: "text-cyan-300", border: "border-cyan-400/60", chip: "bg-cyan-950/90 text-cyan-300 border-cyan-500/30", dots: "bg-[radial-gradient(#38bdf8_1px,transparent_1px)]", bed: "border-cyan-300/80 bg-cyan-500/10 text-cyan-200", size: "bg-airbnb-coral/90" },
  { badge: "bg-badge-tagore text-blue-900 border-blue-200", icon: "text-blue-700", box: "text-sky-300", border: "border-sky-400/60", chip: "bg-blue-950 text-sky-300 border-sky-500/30", dots: "bg-[radial-gradient(#38bdf8_1px,transparent_1px)]", bed: "border-sky-300/80 bg-sky-500/10 text-sky-200", size: "bg-blue-600" },
  { badge: "bg-badge-west text-purple-900 border-purple-200", icon: "text-purple-700", box: "text-purple-300", border: "border-purple-400/60", chip: "bg-purple-950 text-purple-300 border-purple-500/30", dots: "bg-[radial-gradient(#a855f7_1px,transparent_1px)]", bed: "border-purple-300/80 bg-purple-500/10 text-purple-200", size: "bg-purple-600" },
  { badge: "bg-badge-shakti text-emerald-900 border-emerald-200", icon: "text-emerald-700", box: "text-emerald-300", border: "border-emerald-400/60", chip: "bg-emerald-950 text-emerald-300 border-emerald-500/30", dots: "bg-[radial-gradient(#34d399_1px,transparent_1px)]", bed: "border-emerald-300/80 bg-emerald-500/10 text-emerald-200", size: "bg-emerald-600" },
];
const TOGGLE_ON = "pill-btn filter-toggle-btn h-9 px-3.5 rounded-full border-2 border-airbnb-coral bg-airbnb-coral-subtle text-airbnb-coral font-bold text-xs flex items-center gap-1.5 shadow-xs hover:bg-rose-100/60 shrink-0";
const TOGGLE_OFF = "pill-btn filter-toggle-btn h-9 px-3.5 rounded-full border border-gray-200 bg-white hover:border-gray-400 hover:bg-gray-50 text-text-muted hover:text-text-main font-medium text-xs flex items-center gap-1.5 shrink-0";
const VIEW_ON = "relative z-10 px-2.5 py-1 rounded-full bg-white shadow-xs text-text-main text-xs font-bold flex items-center gap-1 transition-all duration-200";
const VIEW_OFF = "relative z-10 px-2.5 py-1 rounded-full text-text-muted hover:text-text-main text-xs font-medium flex items-center gap-1 transition-all duration-200";

const state = {
  rooms: [], hostels: [], lastRun: null, request: null,
  queue: [], filters: { hostel: "", floor: "", seater: "", ac: false, attached: false, open: false, search: "" },
  sort: "open", view: "grid", page: 1,
};
let me;
const draftKey = () => `campusswap-draft-${me.id}`;
const locked = () => state.request && ["open", "matched"].includes(state.request.status);
const bedsLabel = (n) => (n === 1 ? "Single" : n === 2 ? "Double sharing" : "Triple sharing");
const styleFor = (code) => HOSTEL_STYLE[Math.max(0, state.hostels.findIndex((h) => h.code === code)) % HOSTEL_STYLE.length];
const shortName = (room) => `${room.hostel.name} · ${room.number}`;

// ---------------------------------------------------------------- filtering
function filtered() {
  const f = state.filters;
  const q = f.search.trim().toLowerCase();
  const list = state.rooms.filter((r) =>
    (!f.hostel || r.hostel.code === f.hostel)
    && (!f.floor || String(r.floor) === f.floor)
    && (!f.seater || String(r.seater) === f.seater)
    && (!f.ac || r.ac)
    && (!f.attached || r.washroom === "attached")
    && (!f.open || r.open_to_swap > 0)
    && (!q || `${r.hostel.name} ${r.hostel.code} block ${r.block} ${r.number} ${r.tags.join(" ")}`.toLowerCase().includes(q)));
  const byNumber = (a, b) => a.hostel.code.localeCompare(b.hostel.code) || a.number.localeCompare(b.number);
  const sorters = {
    open: (a, b) => b.open_to_swap - a.open_to_swap || byNumber(a, b),
    hostel: byNumber,
    floor: (a, b) => a.floor - b.floor || byNumber(a, b),
  };
  return list.sort(sorters[state.sort]);
}

function activeChips() {
  const f = state.filters;
  const chips = [];
  if (f.hostel) chips.push(["hostel", state.hostels.find((h) => h.code === f.hostel)?.name]);
  if (f.floor) chips.push(["floor", `Floor ${f.floor}`]);
  if (f.seater) chips.push(["seater", bedsLabel(Number(f.seater))]);
  if (f.ac) chips.push(["ac", "AC only"]);
  if (f.attached) chips.push(["attached", "Attached washroom only"]);
  if (f.open) chips.push(["open", "Someone wants to swap"]);
  if (f.search.trim()) chips.push(["search", `“${f.search.trim()}”`]);
  const strip = $("#active-filter-strip");
  if (!chips.length) {
    strip.innerHTML = `<span class="text-[11px] font-bold tracking-wider text-text-light uppercase">No filters · showing every room you can live in</span>`;
    return;
  }
  strip.innerHTML = `<span class="text-[11px] font-bold tracking-wider text-text-light uppercase">Active filters:</span>`
    + chips.map(([key, label]) => html`<span class="filter-chip-fade inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-airbnb-coral-subtle text-airbnb-coral font-semibold text-[11px] border border-airbnb-coral/20 hover:border-airbnb-coral/50 group">${label}<button aria-label="Remove filter ${label}" class="hover:text-airbnb-coral-dark flex items-center p-0.5" data-clear="${key}" type="button"><span class="material-symbols-outlined text-[12px] group-hover:rotate-90 transition-transform duration-200">close</span></button></span>`).join("")
    + `<button class="text-xs font-bold text-text-muted hover:text-airbnb-coral underline ml-2 transition-colors" data-clear="all" type="button">Clear all</button>`;
}

function clearFilter(key) {
  if (key === "all") {
    state.filters = { hostel: "", floor: "", seater: "", ac: false, attached: false, open: false, search: "" };
  } else {
    state.filters[key] = typeof state.filters[key] === "boolean" ? false : "";
  }
  syncControls();
  update();
}

function syncControls() {
  const f = state.filters;
  $("#filter-hostel").value = f.hostel;
  $("#filter-floor").value = f.floor;
  $("#filter-seater").value = f.seater;
  $("#search").value = f.search;
  for (const b of $$("[data-toggle]")) {
    const on = f[b.dataset.toggle];
    b.className = on ? TOGGLE_ON : TOGGLE_OFF;
    b.setAttribute("aria-pressed", String(on));
  }
}

// ---------------------------------------------------------------- room cards
function actionButton(room) {
  const rank = state.queue.findIndex((r) => r.id === room.id);
  const base = "btn-rank-cta h-8 px-4 rounded-full font-bold text-xs flex items-center gap-1.5 shadow-sm group/btn whitespace-nowrap";
  if (room.is_own) return `<button class="${base} bg-gray-100 text-text-muted cursor-not-allowed shadow-none" disabled type="button"><span class="material-symbols-outlined text-[16px]">home</span><span>Your room</span></button>`;
  if (locked()) return `<button class="${base} bg-gray-100 text-text-muted cursor-not-allowed shadow-none" disabled type="button"><span class="material-symbols-outlined text-[16px]">lock</span><span>Request locked</span></button>`;
  if (rank >= 0) return html`<button class="${raw(base)} bg-emerald-50 text-airbnb-emerald border border-emerald-300" data-unrank="${room.id}" title="Remove from your list" type="button"><span class="material-symbols-outlined text-[16px]">bookmark_added</span><span>Ranked #${rank + 1}</span></button>`;
  const full = state.queue.length >= MAX;
  return html`<button class="${raw(base)} ${raw(full ? "bg-gray-100 text-text-muted cursor-not-allowed shadow-none" : "bg-airbnb-coral hover:bg-airbnb-coral-dark text-white")}" data-rank="${room.id}" ${raw(full ? "disabled title=\"You already have 5 choices\"" : "")} type="button"><span class="material-symbols-outlined text-[16px] group-hover/btn:rotate-12 transition-transform duration-200">bookmark_add</span><span>Rank in Preferences</span></button>`;
}

function openPill(room) {
  if (room.is_own) return `<div class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-extrabold text-xs border border-slate-200"><span class="material-symbols-outlined text-[14px]">home</span><span>Your room</span></div>`;
  if (room.open_to_swap > 0) return html`<div class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-airbnb-emerald font-extrabold text-xs border border-emerald-300 ring-2 ring-emerald-400/30 animate-pulse-gentle whitespace-nowrap"><span class="material-symbols-outlined text-[14px]">swap_horiz</span><span>${room.open_to_swap} open to swap</span></div>`;
  return `<div class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-50 text-text-muted font-bold text-xs border border-gray-200 whitespace-nowrap"><span class="material-symbols-outlined text-[14px]">hourglass_empty</span><span>No one swapping yet</span></div>`;
}

function schematic(room) {
  const s = styleFor(room.hostel.code);
  const beds = "ABC".slice(0, room.seater).split("").map((label, i) => {
    const open = i < room.open_to_swap;
    return html`<div class="${raw(open ? `vacant-bed-glow border-dashed ${s.bed}` : "border-slate-600 bg-slate-800/40 text-slate-400")} ${raw(room.seater === 1 ? "w-24" : room.seater === 2 ? "w-14" : "w-10")} h-full border rounded flex flex-col items-center justify-center text-[9px]"><span class="material-symbols-outlined text-[15px] ${raw(open ? "text-emerald-300" : "")}">${room.seater === 1 ? "single_bed" : "bed"}</span><span>Bed ${label}</span><span class="text-[7px] font-extrabold tracking-wider ${raw(open ? "text-emerald-400" : "text-slate-500")}">${open ? "SWAP" : "TAKEN"}</span></div>`;
  }).join("");
  const bath = room.washroom === "attached"
    ? `<div class="flex-1 h-full border ${s.border} rounded bg-blue-500/10 flex flex-col items-center justify-center text-[9px] ${s.box}"><span class="material-symbols-outlined text-[14px]">shower</span><span>Attached</span></div>`
    : `<div class="flex-1 h-full border border-dashed border-slate-600 rounded bg-slate-800/30 flex flex-col items-center justify-center text-[9px] text-slate-400"><span class="material-symbols-outlined text-[14px]">desk</span><span>Study desks</span></div>`;
  const balcony = room.tags.includes("Balcony") ? `<div class="absolute -top-2.5 right-4 bg-amber-400 text-slate-950 text-[8px] font-extrabold px-1.5 rounded uppercase shadow-xs">☀ Balcony</div>` : "";
  return html`
  <div class="schematic-box w-full md:w-60 h-52 flex-shrink-0 rounded-xl bg-slate-900 ${raw(s.box)} p-3 relative flex flex-col justify-between border border-slate-800 shadow-inner overflow-hidden font-mono" aria-hidden="true">
    <div class="absolute inset-0 opacity-20 ${raw(s.dots)} [background-size:12px_12px] pointer-events-none"></div>
    <div class="relative z-10 flex items-center justify-between text-[10px]">
      <span class="${raw(s.chip)} border px-2 py-0.5 rounded font-bold uppercase tracking-wider">ROOM ${room.hostel.code}-${room.number}</span>
      <span class="${raw(s.size)} text-white font-bold px-1.5 py-0.5 rounded text-[10px] shadow-xs">${room.seater} BED${room.seater > 1 ? "S" : ""}</span>
    </div>
    <div class="relative z-10 my-auto py-1 flex flex-col items-center">
      <div class="w-full h-24 border-2 ${raw(s.border)} rounded-sm p-1.5 flex gap-1 relative bg-slate-950/60">${raw(balcony)}${raw(beds)}${raw(bath)}</div>
    </div>
    <div class="relative z-10 flex items-center justify-between text-[10px] pt-1 border-t border-slate-800">
      <span class="flex items-center gap-1 font-medium"><span class="material-symbols-outlined text-[13px] text-amber-400">layers</span> Floor ${room.floor} • Block ${room.block}</span>
      ${raw(room.ac ? `<span class="text-emerald-400 font-bold flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>AC</span>` : `<span class="text-slate-400 font-bold">Non-AC</span>`)}
    </div>
  </div>`;
}

function spec(icon, tone, label, value) {
  return html`<div class="flex items-center gap-1.5 hover:bg-white p-1 rounded-lg transition-colors min-w-0"><div class="w-6 h-6 shrink-0 rounded-md bg-white border border-gray-200 flex items-center justify-center ${raw(tone)} shadow-xs"><span class="material-symbols-outlined text-[15px]">${icon}</span></div><div class="min-w-0"><div class="text-[10px] text-text-light leading-none">${label}</div><div class="font-bold text-[11px] truncate">${value}</div></div></div>`;
}

function gridCard(room, i) {
  const s = styleFor(room.hostel.code);
  const ribbon = room.open_to_swap > 0 && !room.is_own
    ? `<div class="absolute top-0 left-0 bg-airbnb-coral text-white font-bold text-[10px] tracking-wider uppercase px-3 py-1 rounded-br-xl shadow-xs flex items-center gap-1 z-20"><span class="material-symbols-outlined text-[12px]">auto_awesome</span><span>Swap possible</span></div>` : "";
  return html`
  <article class="stagger-in hostel-card-lift bg-white rounded-2xl border ${raw(room.is_own ? "border-slate-300 bg-slate-50/50" : "border-gray-200 hover:border-airbnb-coral/40")} shadow-xs p-5 flex flex-col md:flex-row gap-5 relative overflow-hidden group" style="animation-delay:${Math.min(i, 5) * 60}ms">
    ${raw(ribbon)}
    ${raw(schematic(room))}
    <div class="flex flex-col justify-between flex-1 gap-2.5 min-w-0">
      <div>
        <div class="flex items-start justify-between gap-2 flex-wrap">
          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap mb-1">
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md ${raw(s.badge)} border text-xs font-bold"><span class="material-symbols-outlined text-[13px] ${raw(s.icon)}">corporate_fare</span>${room.hostel.name}</span>
              <span class="text-xs text-text-muted font-medium">• Block ${room.block} • Floor ${room.floor}</span>
              <span class="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200">${bedsLabel(room.seater)}</span>
            </div>
            <h2 class="text-lg font-extrabold text-text-main tracking-tight group-hover:text-airbnb-coral transition-colors">Room ${room.number}</h2>
          </div>
          <div class="flex flex-col items-end flex-shrink-0">${raw(openPill(room))}</div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 py-2.5 my-2 rounded-xl bg-gray-50 border border-gray-100 px-3 text-xs text-text-main font-medium">
          ${raw(spec(room.washroom === "attached" ? "bathroom" : "wc", "text-airbnb-coral", "Washroom", room.washroom === "attached" ? "Attached" : "Common"))}
          ${raw(spec(room.ac ? "ac_unit" : "mode_fan", "text-blue-500", "Cooling", room.ac ? "AC installed" : "Fan only"))}
          ${raw(spec("bed", "text-emerald-600", "Beds", bedsLabel(room.seater)))}
        </div>
        <div class="flex flex-wrap items-center gap-1.5">
          ${room.tags.map((t) => raw(html`<span class="px-2.5 py-0.5 rounded-full bg-gray-100 text-text-muted text-[11px] font-semibold flex items-center gap-1"><span class="material-symbols-outlined text-[12px] text-indigo-500">sell</span>${t}</span>`))}
        </div>
      </div>
      <div class="flex items-center justify-between pt-2 border-t border-gray-100 gap-3 flex-wrap">
        <span class="text-xs text-text-muted">${room.is_own ? "You live here" : `${room.open_to_swap} of ${room.seater} occupant${room.seater > 1 ? "s" : ""} looking to swap`}</span>
        ${raw(actionButton(room))}
      </div>
    </div>
  </article>`;
}

function compactRow(room) {
  return html`
  <div class="bg-white rounded-xl border ${raw(room.is_own ? "border-slate-300" : "border-gray-200")} shadow-xs px-4 py-3 flex items-center gap-4 flex-wrap">
    <span class="font-mono text-xs font-extrabold text-text-main w-20">${room.hostel.code}-${room.number}</span>
    <span class="text-xs text-text-muted flex-1 min-w-[140px]">${room.hostel.name} • Block ${room.block} • Floor ${room.floor}</span>
    <span class="text-[11px] font-semibold text-text-muted w-28">${bedsLabel(room.seater)}</span>
    <span class="text-[11px] font-semibold ${raw(room.ac ? "text-blue-600" : "text-text-light")} w-14">${room.ac ? "AC" : "Non-AC"}</span>
    <span class="text-[11px] font-semibold text-text-muted w-20">${room.washroom === "attached" ? "Attached" : "Common"}</span>
    <span class="text-[11px] font-bold ${raw(room.open_to_swap ? "text-airbnb-emerald" : "text-text-light")} w-20">${room.open_to_swap ? `${room.open_to_swap} open` : "—"}</span>
    ${raw(actionButton(room))}
  </div>`;
}

function renderList() {
  const list = filtered();
  const size = PAGE_SIZE[state.view];
  const pages = Math.max(1, Math.ceil(list.length / size));
  state.page = Math.min(state.page, pages);
  const slice = list.slice((state.page - 1) * size, state.page * size);
  const withOpen = state.rooms.filter((r) => r.open_to_swap > 0 && !r.is_own).length;
  $("#count-label").textContent = `Showing ${list.length} of ${state.rooms.length} rooms`;
  $("#feed-title").textContent = `${state.rooms.length} rooms in ${state.hostels.map((h) => h.name).join(" & ")} · ${withOpen} with someone open to swap`;
  const target = $("#room-list");
  if (!list.length) {
    target.innerHTML = `<div class="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center"><span class="material-symbols-outlined text-[36px] text-text-light">search_off</span><h3 class="font-extrabold text-text-main mt-2">No rooms match these filters</h3><p class="text-xs text-text-muted mt-1">Try removing a filter.</p><button class="mt-4 px-4 py-2 rounded-full bg-airbnb-coral hover:bg-airbnb-coral-dark text-white text-xs font-bold" data-clear="all" type="button">Clear all filters</button></div>`;
  } else {
    target.innerHTML = slice.map((room, i) => (state.view === "grid" ? gridCard(room, i) : compactRow(room))).join("");
  }
  renderPagination(list.length, pages);
}

function renderPagination(total, pages) {
  const size = PAGE_SIZE[state.view];
  const from = total ? (state.page - 1) * size + 1 : 0;
  const to = Math.min(total, state.page * size);
  const btn = (label, page, active = false, disabled = false) => html`<button class="${raw(active ? "w-8 h-8 rounded-full bg-airbnb-coral text-white font-bold shadow-xs" : label.length > 2 ? "px-3 py-1.5 rounded-full bg-white border border-gray-200 hover:border-gray-300 text-text-main shadow-xs disabled:opacity-40" : "w-8 h-8 rounded-full bg-white border border-gray-200 hover:bg-gray-100 text-text-muted font-bold")} transition-all active:scale-95" data-page="${page}" ${raw(disabled ? "disabled" : "")} type="button">${label}</button>`;
  const numbers = Array.from({ length: pages }, (_, i) => btn(String(i + 1), i + 1, i + 1 === state.page)).join("");
  $("#pagination").innerHTML = `<span>Showing ${from}–${to} of ${total} rooms</span>`
    + (pages > 1 ? `<div class="flex items-center gap-1.5">${btn("Prev", state.page - 1, false, state.page === 1)}${numbers}${btn("Next", state.page + 1, false, state.page === pages)}</div>` : "");
}

// ---------------------------------------------------------------- ranked queue
function queueItem(room, i, isLocked) {
  const badge = i === 0 ? "bg-airbnb-coral" : i === 1 ? "bg-slate-800" : "bg-slate-600";
  const controls = isLocked ? "" : html`
    <div class="flex items-center gap-0.5 flex-shrink-0">
      <button aria-label="Move ${shortName(room)} up" class="p-1 rounded-full text-gray-400 hover:text-text-main hover:bg-gray-100 disabled:opacity-30" data-move="${i}" data-dir="-1" ${raw(i === 0 ? "disabled" : "")} type="button"><span class="material-symbols-outlined text-[16px] block">keyboard_arrow_up</span></button>
      <button aria-label="Move ${shortName(room)} down" class="p-1 rounded-full text-gray-400 hover:text-text-main hover:bg-gray-100 disabled:opacity-30" data-move="${i}" data-dir="1" ${raw(i === state.queue.length - 1 ? "disabled" : "")} type="button"><span class="material-symbols-outlined text-[16px] block">keyboard_arrow_down</span></button>
      <button aria-label="Remove ${shortName(room)}" class="remove-btn-spin text-gray-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition-colors" data-remove="${i}" type="button"><span class="material-symbols-outlined text-[15px] block">close</span></button>
    </div>`;
  return html`
  <div class="draggable-item group relative flex items-center justify-between gap-2 p-3 rounded-xl bg-gray-50 hover:bg-rose-50/60 hover:border-airbnb-coral/40 border border-transparent shadow-xs ${raw(isLocked ? "" : "cursor-grab active:cursor-grabbing")}" data-index="${i}" ${raw(isLocked ? "" : "draggable=\"true\"")}>
    <div class="flex items-center gap-2.5 min-w-0">
      ${raw(isLocked ? "" : `<span class="material-symbols-outlined text-[16px] text-gray-400 group-hover:text-airbnb-coral transition-colors">drag_indicator</span>`)}
      <span class="w-6 h-6 shrink-0 rounded-full ${raw(badge)} text-white font-extrabold text-[11px] flex items-center justify-center shadow-xs">${i + 1}</span>
      <div class="flex flex-col min-w-0">
        <span class="text-xs font-bold text-text-main truncate">${shortName(room)}</span>
        <span class="text-[11px] text-text-muted truncate">${bedsLabel(room.seater)} • ${room.ac ? "AC" : "Non-AC"} • Floor ${room.floor}</span>
      </div>
    </div>
    ${raw(controls)}
  </div>`;
}

function renderQueue() {
  const isLocked = locked();
  const queue = isLocked ? state.request.preferences.map((p) => p.room) : state.queue;
  const slots = queue.map((room, i) => queueItem(room, i, isLocked));
  if (!isLocked) {
    for (let n = queue.length + 1; n <= MAX; n++) {
      const text = n === queue.length + 1 ? "Click “Rank in Preferences” on any room" : "Optional backup choice";
      slots.push(html`<button class="empty-slot-pulse w-full flex items-center justify-between p-2.5 rounded-xl border-2 border-dashed border-gray-200 text-text-light group ${raw(n > queue.length + 1 ? "opacity-70" : "")}" data-empty type="button"><span class="flex items-center gap-2.5"><span class="w-6 h-6 rounded-full bg-gray-200 group-hover:bg-airbnb-coral group-hover:text-white transition-colors text-gray-500 font-bold text-[11px] flex items-center justify-center">${n}</span><span class="text-xs font-medium group-hover:text-airbnb-coral transition-colors text-left">${text}</span></span><span class="material-symbols-outlined text-[18px] text-gray-300 group-hover:text-airbnb-coral transition-all">add_circle</span></button>`);
    }
  }
  $("#ranked-queue-container").innerHTML = slots.join("");
  const count = queue.length;
  $("#queue-counter-badge").textContent = isLocked ? `Submitted · ${state.request.tracking_id}` : `${count} of ${MAX} chosen`;
  $("#queue-progress-text").textContent = `${count} of ${MAX}`;
  $("#queue-progress-bar").style.width = `${(count / MAX) * 100}%`;

  const submit = $("#lock-submit-btn");
  const secondary = $("#secondary-btn");
  if (isLocked) {
    const matched = state.request.status === "matched";
    $("#queue-help").textContent = matched
      ? "You're in a proposed swap. Open your dashboard to confirm or decline it."
      : "Your list is locked in the matching pool. Withdraw it if you want to change your choices.";
    submit.disabled = false;
    submit.innerHTML = `<span class="material-symbols-outlined text-[18px]">dashboard</span><span>${matched ? "See my swap" : "Track on my dashboard"}</span>`;
    submit.dataset.mode = "dashboard";
    secondary.hidden = matched;
    secondary.innerHTML = `<span class="material-symbols-outlined text-[15px] text-text-muted">undo</span><span>Withdraw request</span>`;
    secondary.dataset.mode = "withdraw";
  } else {
    $("#queue-help").textContent = "Put your favourite first. Drag to reorder (or use the arrows). Top Trading Cycles always tries your #1 first, then falls back to the next choice that is still free.";
    submit.disabled = count === 0;
    submit.innerHTML = `<span class="material-symbols-outlined text-[18px]">lock</span><span>${count ? `Lock ${count} Preference${count > 1 ? "s" : ""} &amp; Submit` : "Pick at least one room"}</span>`;
    submit.dataset.mode = "submit";
    secondary.hidden = false;
    secondary.disabled = count === 0;
    secondary.innerHTML = `<span class="material-symbols-outlined text-[15px] text-text-muted">backspace</span><span>Clear list</span>`;
    secondary.dataset.mode = "clear";
  }
}

function renderYield() {
  const run = state.lastRun;
  if (run) {
    $("#yield-pill").textContent = `${run.yield_pct}% matched`;
    $("#yield-text").textContent = `${run.matched} of ${run.pool_size} students got a swap in the last round (${formatDateTime(run.created_at)}).`;
  } else {
    $("#yield-pill").textContent = "No rounds yet";
    $("#yield-text").textContent = "The warden hasn't run a matching round yet. Your request will be part of the next one.";
  }
}

function saveDraft() {
  try { localStorage.setItem(draftKey(), JSON.stringify(state.queue.map((r) => r.id))); } catch { /* storage may be blocked */ }
}
function loadDraft() {
  try {
    const ids = JSON.parse(localStorage.getItem(draftKey()) || "[]");
    state.queue = ids.map((id) => state.rooms.find((r) => r.id === id)).filter((r) => r && !r.is_own).slice(0, MAX);
  } catch { state.queue = []; }
}

function update() {
  activeChips();
  renderList();
  renderQueue();
}

// ---------------------------------------------------------------- actions
function rank(id) {
  const room = state.rooms.find((r) => r.id === id);
  if (!room || state.queue.length >= MAX || state.queue.some((r) => r.id === id)) return;
  state.queue.push(room);
  saveDraft();
  update();
  toast(`Added ${shortName(room)} as choice #${state.queue.length}`, "Reorder your list any time before you submit.", { icon: "bookmark_add" });
}
function unrank(index) {
  state.queue.splice(index, 1);
  saveDraft();
  update();
}
function move(index, dir) {
  const to = index + dir;
  if (to < 0 || to >= state.queue.length) return;
  [state.queue[index], state.queue[to]] = [state.queue[to], state.queue[index]];
  saveDraft();
  update();
}

async function submit(button) {
  if (button.dataset.mode === "dashboard") return location.assign("/dashboard.html");
  const restore = setBusy(button, "Submitting…");
  try {
    const result = await api("/api/requests", { method: "POST", body: { room_ids: state.queue.map((r) => r.id) } });
    state.queue = [];
    saveDraft();
    toast(`Request ${result.tracking_id} submitted`, "Taking you to your dashboard…", { icon: "verified" });
    setTimeout(() => location.assign("/dashboard.html"), 1100);
  } catch (error) {
    restore();
    toastError(error);
  }
}

async function secondary(button) {
  if (button.dataset.mode === "clear") {
    state.queue = [];
    saveDraft();
    return update();
  }
  if (!confirm("Withdraw your request? It leaves the matching pool, and you can submit a new list afterwards.")) return;
  const restore = setBusy(button, "Withdrawing…");
  try {
    await api("/api/requests/current", { method: "DELETE" });
    toast("Request withdrawn", "You can now build a new ranked list.", { icon: "undo" });
    await load();
  } catch (error) {
    restore();
    toastError(error);
  }
}

function wire() {
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-rank],[data-unrank],[data-remove],[data-move],[data-clear],[data-page],[data-empty]");
    if (!t || t.disabled) return;
    if (t.dataset.rank) rank(Number(t.dataset.rank));
    else if (t.dataset.unrank) unrank(state.queue.findIndex((r) => r.id === Number(t.dataset.unrank)));
    else if (t.dataset.remove) unrank(Number(t.dataset.remove));
    else if (t.dataset.move) move(Number(t.dataset.move), Number(t.dataset.dir));
    else if (t.dataset.clear) clearFilter(t.dataset.clear);
    else if (t.dataset.page) { state.page = Number(t.dataset.page); renderList(); $("#room-list").scrollIntoView({ behavior: "smooth", block: "start" }); }
    else if (t.hasAttribute("data-empty")) $("#room-list").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  const onChange = (key) => (e) => { state.filters[key] = e.target.value; state.page = 1; update(); };
  $("#filter-hostel").addEventListener("change", onChange("hostel"));
  $("#filter-floor").addEventListener("change", onChange("floor"));
  $("#filter-seater").addEventListener("change", onChange("seater"));
  $("#search").addEventListener("input", onChange("search"));
  $("#sort").addEventListener("change", (e) => { state.sort = e.target.value; update(); });
  for (const b of $$("[data-toggle]")) {
    b.addEventListener("click", () => { state.filters[b.dataset.toggle] = !state.filters[b.dataset.toggle]; state.page = 1; syncControls(); update(); });
  }
  for (const [id, view] of [["#grid-view-btn", "grid"], ["#table-view-btn", "compact"]]) {
    $(id).addEventListener("click", () => {
      state.view = view;
      state.page = 1;
      $("#grid-view-btn").className = view === "grid" ? VIEW_ON : VIEW_OFF;
      $("#table-view-btn").className = view === "grid" ? VIEW_OFF : VIEW_ON;
      $("#grid-view-btn").setAttribute("aria-pressed", String(view === "grid"));
      $("#table-view-btn").setAttribute("aria-pressed", String(view !== "grid"));
      renderList();
    });
  }
  $("#lock-submit-btn").addEventListener("click", (e) => submit(e.currentTarget));
  $("#secondary-btn").addEventListener("click", (e) => secondary(e.currentTarget));

  // Drag to reorder (desktop). Phones use the arrow buttons.
  const box = $("#ranked-queue-container");
  let from = null;
  box.addEventListener("dragstart", (e) => {
    const item = e.target.closest(".draggable-item[draggable]");
    if (!item) return;
    from = Number(item.dataset.index);
    item.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
  });
  box.addEventListener("dragover", (e) => {
    const item = e.target.closest(".draggable-item[draggable]");
    if (from === null || !item) return;
    e.preventDefault();
    $$(".drop-target", box).forEach((el) => el.classList.remove("drop-target"));
    item.classList.add("drop-target");
  });
  box.addEventListener("drop", (e) => {
    const item = e.target.closest(".draggable-item[draggable]");
    if (from === null || !item) return;
    e.preventDefault();
    const to = Number(item.dataset.index);
    const [room] = state.queue.splice(from, 1);
    state.queue.splice(to, 0, room);
    from = null;
    saveDraft();
    update();
  });
  box.addEventListener("dragend", () => {
    from = null;
    $$(".dragging,.drop-target", box).forEach((el) => el.classList.remove("dragging", "drop-target"));
  });
}

function skeleton() {
  $("#room-list").innerHTML = Array.from({ length: 3 }, () => `<div class="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col md:flex-row gap-5"><div class="skeleton w-full md:w-60 h-52"></div><div class="flex-1 flex flex-col gap-3"><div class="skeleton h-5 w-2/3"></div><div class="skeleton h-16 w-full"></div><div class="skeleton h-8 w-1/2"></div></div></div>`).join("");
}

async function load() {
  try {
    const [listing, dashboard] = await Promise.all([api("/api/rooms"), api("/api/me/dashboard")]);
    state.rooms = listing.rooms;
    state.hostels = listing.hostels;
    state.lastRun = listing.last_run;
    state.request = dashboard.request;
    $("#filter-hostel").innerHTML = `<option value="">All hostels (${listing.hostels.length})</option>`
      + listing.hostels.map((h) => html`<option value="${h.code}">${h.name}</option>`).join("");
    if (!locked()) loadDraft();
    syncControls();
    renderYield();
    update();
  } catch (error) {
    if (error.status === 401) return location.replace("/");
    $("#room-list").innerHTML = html`<div class="bg-white rounded-2xl border border-red-200 p-10 text-center"><span class="material-symbols-outlined text-[36px] text-red-500">error</span><h3 class="font-extrabold text-text-main mt-2">Couldn't load rooms</h3><p class="text-xs text-text-muted mt-1">${error.message}</p><button class="mt-4 px-4 py-2 rounded-full bg-text-main text-white text-xs font-bold" id="retry" type="button">Try again</button></div>`;
    $("#retry").addEventListener("click", load);
  }
}

me = await requireUser("student");
fillHeader(me);
skeleton();
wire();
load();
