// Admin engine room (reference 3): run TTC rounds, compare with 1:1, approve swaps.
import { api, requireUser } from "./api.js";
import { fillHeader } from "./nav.js";
import { $, $$, formatDateTime, html, plural, raw, toast, toastError } from "./ui.js";

const PAGE_SIZE = 10;
const TABS = [
  ["all", "All requests"], ["open", "In pool"], ["matched", "In a swap"],
  ["awaiting", "Awaiting approval"], ["completed", "Completed"], ["withdrawn", "Withdrawn"],
];
const state = { overview: null, rows: [], filter: "all", search: "", page: 1, dry: false, open: null, busy: false };
const TOAST = { position: "top" };

// ---------------------------------------------------------------- helpers
const matchesFilter = (row, filter) => ({
  all: true,
  open: row.status === "open",
  matched: row.status === "matched",
  awaiting: Boolean(row.cycle?.can_approve),
  completed: row.status === "completed",
  withdrawn: row.status === "withdrawn",
})[filter];

function visibleRows() {
  const q = state.search.trim().toLowerCase();
  return state.rows.filter((r) => matchesFilter(r, state.filter)
    && (!q || `${r.tracking_id} ${r.student.name} ${r.student.roll_no} ${r.offered_room} ${r.assigned_room || ""} ${r.preferences.join(" ")}`.toLowerCase().includes(q)));
}

function chainChip(row) {
  if (!row.cycle) return `<span class="font-mono text-[11px] px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 font-bold border border-slate-200 inline-flex items-center gap-1">—</span>`;
  const n = row.cycle.length;
  if (n === 2) return `<span class="font-mono text-[11px] px-2.5 py-1 rounded-full bg-coral-subtle text-coral font-bold border border-coral-border inline-flex items-center gap-1 shadow-2xs whitespace-nowrap"><span class="material-symbols-outlined text-[13px]">sync_alt</span> 2-way direct</span>`;
  if (n === 3) return `<span class="font-mono text-[11px] px-2.5 py-1 rounded-full bg-teal-subtle text-teal font-bold border border-teal-border inline-flex items-center gap-1 shadow-2xs whitespace-nowrap"><span class="material-symbols-outlined text-[13px]">change_circle</span> 3-way loop</span>`;
  return `<span class="font-mono text-[11px] px-2.5 py-1 rounded-full bg-indigo-subtle text-indigo font-bold border border-indigo-border inline-flex items-center gap-1 shadow-2xs whitespace-nowrap"><span class="material-symbols-outlined text-[13px]">repeat</span> ${n}-way ring</span>`;
}

function statusBadge(row) {
  const c = row.cycle;
  if (row.status === "open") return `<span class="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[11px] inline-flex items-center gap-1 whitespace-nowrap"><span class="w-1.5 h-1.5 rounded-full bg-amber"></span> In pool</span>`;
  if (row.status === "withdrawn") return `<span class="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold text-[11px] inline-flex items-center gap-1 whitespace-nowrap"><span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Withdrawn</span>`;
  if (row.status === "completed") return `<span class="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px] inline-flex items-center gap-1 whitespace-nowrap"><span class="w-1.5 h-1.5 rounded-full bg-emerald"></span> Completed</span>`;
  if (c?.status === "confirmed") return `<span class="px-2.5 py-0.5 rounded-full bg-emerald-subtle text-emerald-700 font-bold text-[11px] border border-emerald-border inline-flex items-center gap-1 whitespace-nowrap"><span class="w-1.5 h-1.5 rounded-full bg-emerald animate-ping"></span> Everyone confirmed</span>`;
  const waiting = c ? c.length - c.accepted : 0;
  return html`<span class="px-2.5 py-0.5 rounded-full bg-teal-subtle text-teal font-bold text-[11px] border border-teal-border inline-flex items-center gap-1 whitespace-nowrap"><span class="w-1.5 h-1.5 rounded-full bg-teal"></span> ${waiting} still to confirm</span>`;
}

function choiceBar(row) {
  if (!row.received_rank) return `<span class="font-mono text-[11px] text-slate-400">${row.preferences.length} ranked</span>`;
  const pct = Math.round(((row.preferences.length - row.received_rank + 1) / row.preferences.length) * 100);
  return html`<div class="flex items-center gap-2"><div class="w-14 bg-slate-100 rounded-full h-2 overflow-hidden"><div class="bg-gradient-to-r from-emerald to-teal h-2 rounded-full" style="width:${pct}%"></div></div><span class="font-mono text-[11px] font-extrabold text-emerald-600 whitespace-nowrap">#${row.received_rank} of ${row.preferences.length}</span></div>`;
}

// ---------------------------------------------------------------- KPI cards
function kpiCards() {
  const o = state.overview;
  const latest = o.latest;
  const lengths = latest?.cycles_by_length || {};
  const two = Number(lengths["2"] || 0);
  const multi = Object.entries(lengths).filter(([k]) => Number(k) >= 3);
  const multiLoops = multi.reduce((s, [, v]) => s + v, 0);
  const multiStudents = multi.reduce((s, [k, v]) => s + Number(k) * v, 0);
  const total = o.open + o.matched + o.completed;
  const poolPct = total ? Math.round((o.open / total) * 100) : 0;
  const card = (filter, classes, body) => html`<div class="metric-card group relative ${raw(classes)} rounded-2xl p-5 shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-300 select-none cursor-pointer ${raw(state.filter === filter ? "active-filter" : "")}" data-filter="${filter}" role="button" tabindex="0">${raw(body)}</div>`;
  return [
    card("open", "bg-gradient-to-br from-white via-rose-50/40 to-coral-subtle/50 border border-rose-100", html`
      <div class="flex items-start justify-between"><div><span class="font-mono text-[11px] font-bold tracking-wider uppercase text-coral">Students in pool</span>
      <div class="text-3xl font-extrabold text-slate-900 mt-1 tracking-tight flex items-baseline gap-2"><span>${o.open}</span><span class="text-xs font-medium text-slate-400">open requests</span></div></div>
      <div class="w-10 h-10 rounded-xl bg-coral/10 text-coral flex items-center justify-center shadow-xs group-hover:rotate-12 transition-transform duration-300"><span class="material-symbols-outlined text-[22px]">groups_3</span></div></div>
      <div class="mt-4"><div class="flex items-center justify-between text-xs font-semibold mb-1"><span class="text-slate-500">Waiting for a round</span><span class="text-coral font-bold">${poolPct}% of requests</span></div>
      <div class="w-full bg-rose-100/80 rounded-full h-2 overflow-hidden"><div class="bg-gradient-to-r from-coral to-rose-400 h-2 rounded-full transition-all duration-1000 ease-out" style="width:${poolPct}%"></div></div>
      <div class="flex justify-between font-mono text-[10px] text-slate-400 mt-1.5"><span>${o.matched} in swaps</span><span class="font-semibold text-slate-600">${o.completed} completed</span></div></div>`),
    card("matched", "bg-gradient-to-br from-white via-amber-50/40 to-amber-subtle border border-amber-100", html`
      <div class="flex items-start justify-between"><div><span class="font-mono text-[11px] font-bold tracking-wider uppercase text-amber-warm">Direct 2-way swaps</span>
      <div class="text-3xl font-extrabold text-slate-900 mt-1 tracking-tight flex items-baseline gap-2"><span>${two}</span><span class="text-xs font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">${plural(two * 2, "student")}</span></div></div>
      <div class="w-10 h-10 rounded-xl bg-amber/15 text-amber-warm flex items-center justify-center shadow-xs group-hover:scale-110 transition-transform duration-300"><span class="material-symbols-outlined text-[22px]">sync_alt</span></div></div>
      <div class="mt-4"><div class="flex items-center justify-between text-xs font-semibold mb-1"><span class="text-slate-500">In the last saved round</span><span class="text-amber-warm font-bold">A ⇄ B</span></div>
      <div class="w-full bg-amber-100 rounded-full h-2 overflow-hidden"><div class="bg-gradient-to-r from-amber to-amber-warm h-2 rounded-full transition-all duration-1000 ease-out" style="width:${latest?.matched ? Math.round((two * 2 / latest.matched) * 100) : 0}%"></div></div>
      <div class="flex justify-between font-mono text-[10px] text-slate-400 mt-1.5"><span>Share of matched students</span><span class="font-semibold text-slate-600">${latest?.matched ? Math.round((two * 2 / latest.matched) * 100) : 0}%</span></div></div>`),
    card("matched", "bg-gradient-to-br from-white via-teal-50/50 to-teal-subtle border border-teal-100", html`
      <div class="flex items-start justify-between"><div><span class="font-mono text-[11px] font-bold tracking-wider uppercase text-teal">Multi-way loops</span>
      <div class="text-3xl font-extrabold text-slate-900 mt-1 tracking-tight flex items-baseline gap-2"><span>${multiLoops}</span><span class="text-xs font-medium text-slate-400">${plural(multiStudents, "student")}</span></div></div>
      <div class="w-10 h-10 rounded-xl bg-teal/15 text-teal flex items-center justify-center shadow-xs group-hover:rotate-45 transition-transform duration-300"><span class="material-symbols-outlined text-[22px]">all_inclusive</span></div></div>
      <div class="mt-4"><div class="flex items-center gap-1.5 font-mono text-[10px] mb-1.5 flex-wrap">${multi.length ? multi.map(([k, v]) => raw(html`<span class="px-2 py-0.5 bg-white font-bold text-teal rounded-md border border-teal-border shadow-2xs">${k}-way: ${v}</span>`)) : raw(`<span class="px-2 py-0.5 bg-white font-bold text-slate-400 rounded-md border border-slate-200">None yet</span>`)}</div>
      <div class="w-full bg-teal-100/80 rounded-full h-2 overflow-hidden"><div class="bg-gradient-to-r from-teal-vibrant to-teal h-2 rounded-full transition-all duration-1000 ease-out" style="width:${latest?.matched ? Math.round((multiStudents / latest.matched) * 100) : 0}%"></div></div>
      <div class="flex justify-between font-mono text-[10px] text-slate-400 mt-1.5"><span>Only TTC finds these</span><span class="font-semibold text-teal">A → B → C → A</span></div></div>`),
    card("all", "bg-gradient-to-br from-white via-emerald-50/40 to-emerald-subtle border border-emerald-100", html`
      <div class="flex items-start justify-between"><div><span class="font-mono text-[11px] font-bold tracking-wider uppercase text-emerald-700">Match Yield</span>
      <div class="text-3xl font-extrabold text-emerald-600 mt-1 tracking-tight flex items-baseline gap-2"><span>${latest ? `${latest.yield_pct}%` : "—"}</span><span class="text-xs font-medium text-emerald-700">${latest ? `${latest.matched} of ${latest.pool_size}` : "no round yet"}</span></div></div>
      <div class="w-10 h-10 rounded-xl bg-emerald/15 text-emerald flex items-center justify-center shadow-xs group-hover:scale-110 transition-transform duration-300"><span class="material-symbols-outlined text-[22px]">verified</span></div></div>
      <div class="mt-4"><div class="flex items-center justify-between text-xs font-semibold mb-1"><span class="text-slate-500">Got 1st choice: <strong class="text-slate-700">${latest ? `${latest.first_choice_pct}%` : "—"}</strong></span><span class="text-emerald-700 font-bold">Target ≥ 60%</span></div>
      <div class="w-full bg-emerald-100 rounded-full h-2 overflow-hidden"><div class="bg-gradient-to-r from-emerald to-teal h-2 rounded-full transition-all duration-1000 ease-out" style="width:${latest ? latest.yield_pct : 0}%"></div></div>
      <div class="flex justify-between font-mono text-[10px] text-slate-400 mt-1.5"><span>Proposal metric (§6.1)</span><span class="font-semibold text-emerald-700">${latest && latest.yield_pct >= 60 ? "Target met" : "Below target"}</span></div></div>`),
  ].join("");
}

// ---------------------------------------------------------------- table
function tabs() {
  $("#table-tabs").innerHTML = TABS.map(([key, label]) => {
    const count = state.rows.filter((r) => matchesFilter(r, key)).length;
    const on = state.filter === key;
    const tone = key === "awaiting" && !on ? "text-amber-700 hover:bg-amber-50" : on ? "bg-white text-coral border border-coral-border shadow-xs font-bold" : "text-slate-600 hover:text-slate-900 hover:bg-white font-semibold";
    return html`<button aria-pressed="${on}" class="px-3.5 py-1.5 rounded-xl text-xs whitespace-nowrap flex items-center gap-1.5 transition-all ${raw(tone)}" data-filter="${key}" type="button">${key === "awaiting" && count ? raw(`<span class="w-2 h-2 rounded-full bg-amber animate-pulse"></span>`) : ""}<span>${label}</span><span class="font-mono text-[10px] px-1.5 rounded-full ${raw(on ? "bg-coral-subtle text-coral" : "bg-slate-200 text-slate-700")}">${count}</span></button>`;
  }).join("");
}

function detailRow(row) {
  const prefs = row.preferences.map((label, i) => {
    const got = row.received_rank === i + 1;
    return html`<li class="p-1.5 rounded ${raw(got ? "bg-coral-subtle text-coral font-bold border border-coral-border" : "bg-slate-50 text-slate-600")} flex items-center justify-between gap-2"><span class="truncate">${i + 1}. ${label}</span><span class="text-[10px] font-bold shrink-0">${got ? "ASSIGNED" : `#${i + 1}`}</span></li>`;
  }).join("");
  const chain = row.cycle
    ? row.cycle.chain.map((m, i) => html`<div class="p-3 bg-white rounded-xl border border-teal-200/70 shadow-2xs min-w-0"><span class="font-mono text-[10px] text-teal font-bold uppercase">Member ${i + 1} · ${m.tracking_id}</span><p class="font-bold text-slate-900 text-xs mt-1 truncate">${m.name}</p><p class="text-[11px] text-slate-500 truncate">Gives: ${m.gives}</p><p class="text-[11px] font-semibold ${raw(m.response === "accepted" ? "text-emerald-600" : m.response === "declined" ? "text-red-600" : "text-amber-600")}">${m.response === "accepted" ? "Confirmed ✓" : m.response === "declined" ? "Declined" : "Not answered yet"}</p></div>`).join("")
    : `<p class="text-xs text-slate-500 font-mono">Not in a swap chain yet. This request joins the next matching round.</p>`;
  return html`
  <tr class="bg-slate-50/80"><td class="p-0" colspan="7"><div class="expand-content ${raw(state.open === row.id ? "open" : "")}" id="detail-${row.id}">
    <div class="p-5 border-t border-slate-200/80 bg-gradient-to-r from-slate-50 via-white to-slate-50 grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs"><div class="flex items-center gap-2 mb-2.5"><span class="material-symbols-outlined text-[17px] text-coral">format_list_numbered</span><span class="font-bold text-slate-800 text-xs">Ranked choices</span></div><ol class="space-y-1.5 font-mono text-[11px]">${raw(prefs)}</ol></div>
      <div class="md:col-span-2 flex flex-col gap-3"><div class="flex items-center justify-between gap-2 flex-wrap"><span class="text-xs font-bold text-slate-800 flex items-center gap-1.5"><span class="material-symbols-outlined text-teal text-[18px]">all_inclusive</span>Swap chain</span>${row.cycle ? raw(html`<span class="font-mono text-[11px] px-2 py-0.5 bg-teal-subtle text-teal border border-teal-border rounded-md font-bold">Cycle #${row.cycle.id} · ${row.cycle.accepted}/${row.cycle.length} confirmed</span>`) : ""}</div>
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">${raw(chain)}</div></div>
    </div></div></td></tr>`;
}

function tableRow(row) {
  const approve = row.cycle?.can_approve
    ? html`<button class="px-3 py-1.5 rounded-lg bg-coral hover:bg-coral-hover text-white font-bold text-xs shadow-xs hover:shadow transition-all flex items-center gap-1 active:scale-95 whitespace-nowrap" data-approve="${row.cycle.id}" type="button"><span class="material-symbols-outlined text-[14px]">verified</span><span>Approve swap</span></button>` : "";
  return html`
  <tr class="request-row hover:bg-coral-subtle/30 transition-colors duration-150 group cursor-pointer ${raw(row.cycle?.can_approve ? "border-l-4 border-l-amber bg-amber-subtle/30" : "")}" data-row="${row.id}">
    <td class="py-3.5 px-4 font-mono font-bold text-coral whitespace-nowrap"><span class="inline-flex items-center gap-1.5"><span class="material-symbols-outlined text-[16px] text-slate-400 group-hover:text-coral rotate-chevron ${raw(state.open === row.id ? "open" : "")}">expand_more</span>${row.tracking_id}</span></td>
    <td class="py-3.5 px-4"><div class="flex items-center gap-2.5 min-w-0"><div class="w-8 h-8 shrink-0 rounded-full bg-gradient-to-tr from-coral to-rose-400 text-white font-mono text-[11px] font-bold flex items-center justify-center shadow-xs">${row.student.initials}</div><div class="flex flex-col min-w-0"><span class="font-bold text-slate-900 text-sm truncate max-w-[160px]" title="${row.student.name}">${row.student.name}</span><span class="font-mono text-[11px] text-slate-400">${row.student.roll_no} • Year ${row.student.year}</span></div></div></td>
    <td class="py-3.5 px-4"><div class="flex items-center gap-2 flex-wrap"><span class="px-2 py-0.5 bg-slate-100 text-slate-700 font-semibold rounded border border-slate-200 whitespace-nowrap">${row.offered_room}</span><span class="material-symbols-outlined text-[16px] text-coral">arrow_forward</span>${row.assigned_room ? raw(html`<span class="px-2 py-0.5 bg-emerald-subtle text-emerald-800 font-bold rounded border border-emerald-border whitespace-nowrap">${row.assigned_room}</span>`) : raw(`<span class="text-slate-400 italic">not matched yet</span>`)}</div></td>
    <td class="py-3.5 px-4">${raw(chainChip(row))}</td>
    <td class="py-3.5 px-4">${raw(choiceBar(row))}</td>
    <td class="py-3.5 px-4">${raw(statusBadge(row))}</td>
    <td class="py-3.5 px-4 text-right"><div class="flex items-center justify-end gap-1.5"><button aria-label="Inspect ${row.tracking_id}" class="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors" data-inspect="${row.id}" title="Inspect" type="button"><span class="material-symbols-outlined text-[16px]">account_tree</span></button>${raw(approve)}</div></td>
  </tr>${raw(detailRow(row))}`;
}

function renderTable() {
  tabs();
  const rows = visibleRows();
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  state.page = Math.min(state.page, pages);
  const slice = rows.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);
  $("#table-body").innerHTML = slice.length
    ? slice.map(tableRow).join("")
    : `<tr><td class="p-10 text-center text-xs text-slate-500" colspan="7"><span class="material-symbols-outlined text-[32px] text-slate-300 block">inbox</span>No requests here.</td></tr>`;
  const from = rows.length ? (state.page - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(rows.length, state.page * PAGE_SIZE);
  const pageBtn = (p, label = String(p), disabled = false) => html`<button class="${raw(p === state.page && label === String(p) ? "bg-coral text-white font-bold shadow-xs" : "bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold")} h-8 min-w-8 px-2.5 rounded-lg font-mono text-xs transition-all disabled:opacity-40" data-page="${p}" ${raw(disabled ? "disabled" : "")} type="button">${label}</button>`;
  $("#table-footer").innerHTML = html`<div class="flex items-center gap-3 text-slate-500 font-mono text-xs"><span>Showing <strong class="text-slate-900">${from}-${to}</strong> of <strong class="text-slate-900">${rows.length}</strong> requests</span></div>`
    + (pages > 1 ? `<div class="flex items-center gap-1.5">${pageBtn(state.page - 1, "‹", state.page === 1)}${Array.from({ length: pages }, (_, i) => pageBtn(i + 1)).join("")}${pageBtn(state.page + 1, "›", state.page === pages)}</div>` : "");
}

// ---------------------------------------------------------------- trace & comparison
function traceTag(line) {
  if (line.startsWith("Pool:")) return ["INIT", "text-teal-400"];
  if (line.startsWith("Round")) return ["ROUND", "text-indigo-400"];
  if (line.includes("Chain found")) return ["CYCLE", "text-emerald-400"];
  if (line.includes("keep their room")) return ["KEPT", "text-amber-400"];
  if (line.startsWith("Matched")) return ["RESULT", "text-emerald-300"];
  return ["INFO", "text-slate-400"];
}

function renderTrace(trace, run, label, animate = false) {
  const box = $("#terminal");
  const time = run ? new Date(run.created_at).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: false }) : "";
  const lines = (trace || "").split("\n").filter(Boolean);
  $("#trace-chip").textContent = run ? label : "No run yet";
  const body = lines.map((line, i) => {
    const [tag, tone] = traceTag(line);
    return html`<div class="${raw(tag === "RESULT" ? "text-emerald-300 font-bold" : "text-slate-300")} flex items-start gap-2 ${raw(animate ? "log-item-new" : "")}" style="${animate ? `animation-delay:${i * 90}ms` : ""}"><span class="text-emerald-400 font-bold shrink-0">[${time}]</span><span class="${raw(tone)} font-semibold shrink-0 w-14">${tag}</span><span class="whitespace-pre-wrap">${line.trim()}</span></div>`;
  }).join("");
  box.innerHTML = body + `<div class="flex items-center gap-2 text-slate-500 pt-1"><span class="text-slate-600">&gt;</span><span>${lines.length ? "engine idle, ready for the next round" : "no round has run yet. Press Run to start one"}</span><span class="terminal-cursor"></span></div>`;
  box.scrollTop = box.scrollHeight;
}

function renderComparison() {
  const c = state.overview.comparison;
  const target = $("#comparison");
  if (!c) {
    target.innerHTML = `<div class="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-500">No comparison yet. Press the button below: both methods run as dry runs on today's pool, so nothing changes for students.</div>`;
    return;
  }
  const bar = (label, value, tone, text) => html`<div class="flex flex-col gap-1"><div class="flex items-center justify-between text-xs font-semibold"><span class="text-slate-800">${label}</span><span class="font-mono font-bold ${raw(text)}">${value}%</span></div><div class="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden"><div class="${raw(tone)} h-2.5 rounded-full transition-all duration-1000" style="width:${Math.max(value, 1)}%"></div></div></div>`;
  const diff = Math.round((c.ttc - c.pairwise) * 10) / 10;
  target.innerHTML = bar("Top Trading Cycles", c.ttc, "bg-gradient-to-r from-coral to-teal", "text-coral")
    + bar("1:1 swaps only", c.pairwise, "bg-slate-400", "text-slate-600")
    + html`<div class="flex items-center justify-between p-2.5 bg-emerald-subtle rounded-xl border border-emerald-border"><span class="text-xs text-slate-800 font-semibold">Extra students matched by multi-way chains</span><span class="font-mono text-[11px] px-2 py-0.5 bg-white text-emerald-700 border border-emerald-border rounded-md font-bold">${diff >= 0 ? "+" : ""}${diff} pts</span></div>`;
}

function renderHeader() {
  const o = state.overview;
  $("#bar-meta").textContent = `Pool: ${o.open} open • ${o.matched} in swaps • ${o.completed} completed`;
  $("#last-run-time").textContent = o.latest ? formatDateTime(o.latest.created_at) : "No saved round yet";
  $("#awaiting-text").textContent = o.awaiting_approval ? `${plural(o.awaiting_approval, "swap")} ready to approve` : "Nothing waiting";
}

function render() {
  renderHeader();
  $("#kpi-grid").innerHTML = kpiCards();
  renderTable();
  renderComparison();
}

async function load({ keepTrace = false } = {}) {
  try {
    const [overview, rows] = await Promise.all([api("/api/admin/overview"), api("/api/admin/requests")]);
    state.overview = overview;
    state.rows = rows;
    render();
    if (!keepTrace) {
      const run = overview.trace_run;
      renderTrace(overview.trace, run, run ? `Run #${run.id} • ${run.algorithm === "pairwise" ? "1:1 comparison" : run.dry_run ? "dry run" : "saved"}` : "");
    }
  } catch (error) {
    if (error.status === 401) return location.replace("/");
    toastError(error, "top");
  }
}

// ---------------------------------------------------------------- actions
function setRunning(on, text) {
  state.busy = on;
  const btn = $("#btn-run");
  btn.disabled = on;
  $("#run-icon").textContent = on ? "sync" : "play_arrow";
  $("#run-icon").classList.toggle("animate-spin", on);
  $("#run-text").textContent = text;
  $("#btn-compare").disabled = on;
}

function progress(pct) {
  $("#solver-progress-bar").style.width = `${pct}%`;
}

function runLabel() {
  return state.dry ? "Preview TTC Round (dry run)" : "Run TTC Matching Round";
}

async function runRound() {
  if (state.busy) return;
  if (!state.dry && !confirm("Run a real matching round now? Students placed in swap chains will be asked to confirm within 48 hours.")) return;
  setRunning(true, "Resolving Top Trading Cycles…");
  progress(35);
  const slow = setTimeout(() => progress(70), 400);
  try {
    const run = await api("/api/admin/match-runs", { method: "POST", body: { algorithm: "ttc", dry_run: state.dry } });
    progress(100);
    renderTrace(run.trace, run, `Run #${run.id} • ${run.dry_run ? "dry run" : "saved"}`, true);
    toast(run.dry_run ? `Dry run: would match ${run.matched} of ${run.pool_size}` : `Round #${run.id}: matched ${run.matched} of ${run.pool_size}`,
      `Match Yield ${run.yield_pct}%${run.dry_run ? " · nothing was saved" : " · students can now confirm"}`, { ...TOAST, icon: "task_alt" });
    await load({ keepTrace: true });
  } catch (error) {
    toastError(error, "top");
  } finally {
    clearTimeout(slow);
    setTimeout(() => progress(0), 500);
    setRunning(false, runLabel());
  }
}

async function compare() {
  if (state.busy) return;
  setRunning(true, "Comparing on the current pool…");
  progress(50);
  try {
    const result = await api("/api/admin/compare", { method: "POST" });
    progress(100);
    renderTrace(`${result.ttc.trace}\n${result.pairwise.trace}`, result.ttc, `Comparison • runs #${result.ttc.id} & #${result.pairwise.id}`, true);
    toast("Comparison finished", `TTC ${result.ttc.yield_pct}% vs 1:1 only ${result.pairwise.yield_pct}% · nothing was saved`, { ...TOAST, icon: "compare_arrows" });
    await load({ keepTrace: true });
  } catch (error) {
    toastError(error, "top");
  } finally {
    setTimeout(() => progress(0), 500);
    setRunning(false, runLabel());
  }
}

async function approve(button, cycleId) {
  if (!confirm(`Approve swap cycle #${cycleId}? The students' rooms will change in CampusSwap's records.`)) return;
  button.disabled = true;
  button.innerHTML = `<span class="material-symbols-outlined text-[14px] animate-spin">sync</span><span>Saving…</span>`;
  try {
    await api(`/api/admin/cycles/${cycleId}/approve`, { method: "POST" });
    toast(`Swap cycle #${cycleId} approved`, "Seats have changed hands. Students can see their new rooms.", { ...TOAST, icon: "verified" });
    await load({ keepTrace: true });
  } catch (error) {
    toastError(error, "top");
    await load({ keepTrace: true });
  }
}

function setDry(on) {
  state.dry = on;
  $("#toggle-dry").checked = on;
  const btn = $("#btn-toggle-dry");
  btn.setAttribute("aria-pressed", String(on));
  $("#dry-label").textContent = on ? "Dry run: ON" : "Dry run: OFF";
  btn.classList.toggle("bg-amber-100", on);
  btn.classList.toggle("border-amber-300", on);
  btn.classList.toggle("text-amber-900", on);
  btn.classList.toggle("bg-slate-100", !on);
  $("#dry-dot").className = `w-2 h-2 rounded-full transition-all duration-300 ${on ? "bg-amber-500 scale-125" : "bg-slate-400"}`;
  $("#run-text").textContent = runLabel();
}

function modal(open) {
  const m = $("#settings-modal"), card = $("#settings-card");
  m.classList.toggle("opacity-0", !open);
  m.classList.toggle("pointer-events-none", !open);
  m.setAttribute("aria-hidden", String(!open));
  card.classList.toggle("scale-95", !open);
  card.classList.toggle("scale-100", open);
  if (open) $("#toggle-dry").checked = state.dry;
}

function wire() {
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-filter],[data-page],[data-inspect],[data-approve],[data-row],[data-close-modal]");
    if (!t) return;
    if (t.dataset.approve) return approve(t, Number(t.dataset.approve));
    if (t.hasAttribute("data-close-modal")) return modal(false);
    if (t.dataset.filter) { state.filter = t.dataset.filter; state.page = 1; $("#kpi-grid").innerHTML = kpiCards(); return renderTable(); }
    if (t.dataset.page) { state.page = Number(t.dataset.page); return renderTable(); }
    const id = Number(t.dataset.inspect || t.dataset.row);
    if (id) {
      state.open = state.open === id ? null : id;
      $$(".expand-content").forEach((el) => el.classList.toggle("open", el.id === `detail-${state.open}`));
      $$("[data-row]").forEach((tr) => tr.querySelector(".rotate-chevron")?.classList.toggle("open", Number(tr.dataset.row) === state.open));
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") modal(false);
    if ((e.key === "Enter" || e.key === " ") && e.target.matches(".metric-card")) { e.preventDefault(); e.target.click(); }
  });
  const onSearch = (e) => {
    state.search = e.target.value;
    state.page = 1;
    $("#table-search").value = state.search;
    $("#header-search").value = state.search;
    renderTable();
  };
  $("#table-search").addEventListener("input", onSearch);
  $("#header-search").addEventListener("input", onSearch);
  $("#btn-run").addEventListener("click", runRound);
  $("#btn-compare").addEventListener("click", compare);
  $("#btn-toggle-dry").addEventListener("click", () => {
    setDry(!state.dry);
    toast(state.dry ? "Dry run is ON" : "Dry run is OFF", state.dry ? "Rounds will be previewed and not saved." : "Rounds will be saved and students told.", { ...TOAST, icon: state.dry ? "science" : "lock" });
  });
  $("#btn-open-settings").addEventListener("click", () => modal(true));
  $("#btn-save-settings").addEventListener("click", () => { setDry($("#toggle-dry").checked); modal(false); toast("Settings saved", state.dry ? "Next run is a dry run." : "Next run will be saved.", { ...TOAST, icon: "save" }); });
  $("#btn-awaiting").addEventListener("click", () => { state.filter = "awaiting"; state.page = 1; $("#kpi-grid").innerHTML = kpiCards(); renderTable(); $("#table-body").scrollIntoView({ behavior: "smooth", block: "center" }); });
  $("#btn-clear-trace").addEventListener("click", () => renderTrace("", null, ""));
}

const me = await requireUser("admin");
fillHeader(me);
wire();
setDry(false);
load();
