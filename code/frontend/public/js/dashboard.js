// Student dashboard: current room, request status, the swap chain, confirm / decline.
import { api, requireUser } from "./api.js";
import { fillHeader } from "./nav.js";
import { renderMatrix, renderRing, renderSteps, roomDetails } from "./ring.js";
import { $, countdown, formatDateTime, html, ordinal, pad2, raw, setBusy, timeAgo, toast, toastError } from "./ui.js";

const root = $("#dash-root");
let data;
let clockTimer;

const EVENT_TONE = {
  request_submitted: ["bg-amber-500", "ring-amber-100", "USER_INPUT", "bg-amber-50 text-amber-800"],
  request_withdrawn: ["bg-slate-400", "ring-slate-100", "WITHDRAWN", "bg-slate-100 text-slate-700"],
  match_found: ["bg-emerald-500", "ring-emerald-100", "TTC_MATCH", "bg-emerald-50 text-emerald-700"],
  swap_accepted: ["bg-violet-600", "ring-violet-100", "CONFIRMED", "bg-violet-50 text-violet-700"],
  cycle_confirmed: ["bg-emerald-500", "ring-emerald-100", "ALL_CONFIRMED", "bg-emerald-50 text-emerald-700"],
  cycle_dissolved: ["bg-red-500", "ring-red-100", "CANCELLED", "bg-red-50 text-red-700"],
  swap_approved: ["bg-emerald-600", "ring-emerald-100", "APPROVED", "bg-emerald-100 text-emerald-800"],
};

function statusChip() {
  const { request, cycle } = data;
  if (!request) return ["No request yet", "bg-slate-100 border-slate-200 text-slate-700", "bg-slate-400"];
  if (request.status === "completed") return ["Swap approved", "bg-emerald-50 border-emerald-200 text-emerald-700", "bg-emerald-500"];
  if (cycle?.status === "confirmed") return ["Everyone confirmed", "bg-violet-50 border-violet-200 text-violet-700", "bg-violet-500 animate-ping"];
  if (cycle) return [`Chain formed (${cycle.length}-way)`, "bg-emerald-50 border-emerald-200 text-emerald-700", "bg-emerald-500 animate-ping"];
  return ["In the matching pool", "bg-amber-50 border-amber-200 text-amber-800", "bg-amber-500 animate-ping"];
}

function heroCopy() {
  const { request, cycle, room } = data;
  if (!request) return ["Start your room exchange", "Pick up to 5 rooms you'd rather live in. The next matching round looks for chains of swaps where everyone moves somewhere they prefer."];
  if (request.status === "completed") return ["Your swap is approved 🎉", `The warden approved it. Your room is now ${room.label}.`];
  if (cycle?.status === "confirmed") return ["Waiting for warden approval", "Everyone in your chain confirmed. The hostel office approves it next, and then the rooms change hands."];
  if (cycle) return ["We found you a swap", `A ${cycle.length}-way chain gives you your ${ordinal(cycle.received_rank)} choice. Everyone must confirm before ${formatDateTime(cycle.deadline)}.`];
  return ["You're in the matching pool", "Your ranked list is saved. When the warden runs the next matching round, you'll see your swap chain here."];
}

function roomCard(title, room, badge, tone) {
  const tones = {
    rose: ["border-slate-200/80 hover:border-rose-300", "bg-rose-50", "text-rose-500"],
    violet: ["border-violet-200/90 hover:border-violet-400", "bg-violet-50", "text-violet-600"],
  }[tone];
  return html`
  <div class="bg-white rounded-3xl p-6 border-2 ${raw(tones[0])} shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col justify-between relative overflow-hidden group min-w-0">
    <div class="absolute top-0 right-0 w-28 h-28 ${raw(tones[1])} rounded-bl-[48px] pointer-events-none group-hover:scale-110 transition-transform duration-300"></div>
    <div class="relative z-10">
      <div class="flex items-center justify-between mb-3 gap-2">
        <span class="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">${title}</span>
        ${raw(badge)}
      </div>
      <span class="text-xs font-bold uppercase tracking-wider ${raw(tones[2])} font-mono">${room.hostel.name} • Block ${room.block}</span>
      <h3 class="text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">Room ${room.number}</h3>
      <p class="text-xs font-medium text-slate-500">${roomDetails(room)} • Floor ${room.floor}</p>
      <div class="flex flex-wrap gap-1.5 mt-4">
        ${room.tags.map((t) => raw(html`<span class="text-[11px] font-semibold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200">${t}</span>`))}
      </div>
    </div>
  </div>`;
}

function promptCard(title, heading, text, href, cta) {
  return html`
  <div class="bg-white rounded-3xl p-6 border-2 border-dashed border-violet-200 shadow-sm flex flex-col justify-between gap-4 relative overflow-hidden">
    <div>
      <span class="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">${title}</span>
      <h3 class="text-xl font-extrabold text-slate-900 tracking-tight mt-2">${heading}</h3>
      <p class="text-xs text-slate-500 mt-1 leading-relaxed">${text}</p>
    </div>
    ${href ? raw(html`<a class="self-start inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors" href="${href}"><span class="material-symbols-outlined text-[16px]">explore</span>${cta}</a>`) : ""}
  </div>`;
}

function progressCard() {
  const { cycle, milestones } = data;
  const done = milestones.filter((m) => m.state === "done").length;
  if (cycle && cycle.status === "proposed") {
    const pct = Math.round((cycle.accepted / cycle.length) * 100);
    return html`
    <div class="bg-gradient-to-br from-white via-white to-amber-50/50 rounded-3xl p-6 border-2 border-amber-200 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col justify-between relative overflow-hidden">
      <div class="absolute -right-6 -top-6 w-24 h-24 bg-amber-200/40 rounded-full blur-xl pointer-events-none"></div>
      <div class="relative z-10">
        <div class="flex items-center justify-between mb-3 gap-2">
          <span class="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Confirm by</span>
          <span class="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-0.5 rounded-full"><span class="material-symbols-outlined text-[13px]">schedule</span> Confirmed: ${cycle.accepted}/${cycle.length}</span>
        </div>
        <div class="flex items-baseline gap-2 mt-3">
          <div class="px-4 py-2 rounded-2xl bg-slate-900 text-amber-300 font-mono text-2xl sm:text-3xl font-bold tracking-tight shadow-md border border-slate-800 animate-glow-pulse flex items-center gap-1.5" id="countdown">--</div>
        </div>
        <p class="text-xs text-slate-500 mt-2 font-medium">Deadline ${formatDateTime(cycle.deadline)}. If anyone hasn't answered by then, the swap is cancelled.</p>
      </div>
      <div class="mt-6 flex flex-col gap-2 relative z-10">
        <div class="flex justify-between text-xs font-mono"><span class="text-slate-500">Members confirmed</span><span class="text-primary font-bold">${pct}%</span></div>
        <div class="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200 relative">
          <div class="h-full bg-gradient-to-r from-amber-400 via-rose-500 to-violet-600 rounded-full transition-all duration-700 relative overflow-hidden" style="width:${Math.max(pct, 4)}%"><div class="absolute inset-0 shimmer-gradient"></div></div>
        </div>
      </div>
    </div>`;
  }
  const pct = Math.round((done / milestones.length) * 100);
  const current = milestones.find((m) => m.state === "current");
  return html`
  <div class="bg-gradient-to-br from-white via-white to-amber-50/50 rounded-3xl p-6 border-2 border-amber-200 shadow-sm flex flex-col justify-between relative overflow-hidden">
    <div class="relative z-10">
      <span class="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Your progress</span>
      <h3 class="text-xl font-extrabold text-slate-900 tracking-tight mt-2">${current ? current.label : "All steps done"}</h3>
      <p class="text-xs text-slate-500 mt-1">${current ? "This is the step you're on now." : "Your exchange is complete."}</p>
    </div>
    <div class="mt-6 flex flex-col gap-2">
      <div class="flex justify-between text-xs font-mono"><span class="text-slate-500">Steps done</span><span class="text-primary font-bold">${done} of ${milestones.length}</span></div>
      <div class="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
        <div class="h-full bg-gradient-to-r from-amber-400 via-rose-500 to-violet-600 rounded-full" style="width:${Math.max(pct, 4)}%"></div>
      </div>
    </div>
  </div>`;
}

function hero() {
  const [chip, chipTone, dot] = statusChip();
  const [title, text] = heroCopy();
  const { request, cycle } = data;
  const withdraw = request?.status === "open"
    ? `<button class="group flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200/90 text-slate-700 font-bold text-xs transition-all shadow-2xs border border-slate-200 active:scale-95" id="btn-withdraw" type="button"><span class="material-symbols-outlined text-[18px]">undo</span><span>Withdraw request</span></button>`
    : "";
  return html`
  <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-5 bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-sm relative overflow-hidden">
    <div class="absolute -right-10 -bottom-10 w-48 h-48 rounded-full bg-rose-50/50 pointer-events-none blur-2xl"></div>
    <div class="flex flex-col gap-2 relative z-10 min-w-0">
      <div class="flex items-center gap-2.5 flex-wrap">
        ${request ? raw(html`<span class="text-[11px] font-bold uppercase tracking-wider bg-slate-900 text-white px-3 py-1 rounded-full shadow-2xs font-mono">${request.tracking_id}</span>`) : ""}
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border ${raw(chipTone)} text-xs font-bold shadow-2xs"><span class="w-2 h-2 rounded-full ${raw(dot)}"></span>${chip}</span>
        ${cycle ? raw(html`<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold shadow-2xs"><span class="material-symbols-outlined text-[14px] text-amber-500">star</span>Your ${ordinal(cycle.received_rank)} choice</span>`) : ""}
      </div>
      <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">${title}</h1>
      <p class="text-sm text-slate-600 max-w-2xl">${text}</p>
    </div>
    <div class="flex items-center gap-3 self-start lg:self-center relative z-10 flex-wrap">
      ${raw(withdraw)}
      <a class="flex items-center gap-2 px-4 py-2.5 rounded-full ${raw(request ? "bg-white hover:bg-slate-50 text-slate-800 border border-slate-300" : "bg-primary hover:bg-primary-hover text-white shadow-lg shadow-rose-500/30")} font-bold text-xs transition-all shadow-xs active:scale-95" href="/rooms.html">
        <span class="material-symbols-outlined text-[18px]">${request ? "explore" : "add_circle"}</span><span>${request ? "Explore rooms" : "Choose rooms to swap into"}</span>
      </a>
    </div>
  </div>`;
}

function cards() {
  const { room, request, cycle } = data;
  const current = room
    ? roomCard(request?.status === "completed" ? "Your new room" : "Current room", room,
      `<span class="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full shadow-2xs"><span class="material-symbols-outlined text-[13px]">check_circle</span> Seat ${room.seat_label}</span>`, "rose")
    : promptCard("Current room", "No room allocated", "You need an allocated room before you can swap. Contact the hostel office.");
  let target;
  if (cycle) {
    target = roomCard("You receive", cycle.receive_room,
      html`<span class="inline-flex items-center gap-1 text-[11px] font-bold bg-violet-100 text-violet-700 border border-violet-200 px-2.5 py-0.5 rounded-full shadow-2xs"><span class="material-symbols-outlined text-[13px] text-amber-500">star</span> Choice #${cycle.received_rank}</span>`, "violet");
  } else if (request && request.status !== "completed") {
    const top = request.preferences[0];
    target = roomCard("Your top choice", top.room,
      `<span class="inline-flex items-center gap-1 text-[11px] font-bold bg-violet-100 text-violet-700 border border-violet-200 px-2.5 py-0.5 rounded-full shadow-2xs">Rank #1 of ${request.preferences.length}</span>`, "violet");
  } else if (request?.status === "completed") {
    target = promptCard("Want another change?", "Start a new request", "You can ask for another swap any time.", "/rooms.html", "Explore rooms");
  } else {
    target = promptCard("Rooms you want", "Pick up to 5 rooms", "Browse rooms in your hostels, rank them best-first and submit. You can withdraw any time before a match.", "/rooms.html", "Explore rooms");
  }
  return `<div class="grid grid-cols-1 md:grid-cols-3 gap-6">${current}${target}${progressCard()}</div>`;
}

function chainSection() {
  const { cycle } = data;
  if (!cycle) return "";
  return html`
  <section class="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 flex flex-col gap-6 relative overflow-hidden scroll-mt-24" id="swap-chain">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 flex-wrap">
          <h2 class="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">${cycle.length === 2 ? "Direct swap" : `${cycle.length}-way swap ring`}</h2>
          <span class="text-[11px] font-bold bg-violet-100 text-violet-700 border border-violet-200 px-3 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-violet-600 animate-ping"></span>All-or-nothing</span>
        </div>
        <p class="text-xs sm:text-sm text-slate-500 mt-1">Rooms change hands only if every member confirms and the warden approves. Arrows show where each room goes.</p>
      </div>
      <div class="flex items-center gap-1 bg-slate-100 p-1.5 rounded-full border border-slate-200 self-start sm:self-auto" role="tablist">
        <button aria-selected="true" class="px-4 py-1.5 rounded-full bg-white text-slate-900 text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5" id="view-graph" role="tab" type="button"><span class="material-symbols-outlined text-[15px] text-primary">hub</span><span>Swap ring</span></button>
        <button aria-selected="false" class="px-4 py-1.5 rounded-full text-slate-600 hover:text-slate-900 text-xs font-bold transition-all flex items-center gap-1.5" id="view-matrix" role="tab" type="button"><span class="material-symbols-outlined text-[15px]">table_rows</span><span>Compare rooms</span></button>
      </div>
    </div>
    <div class="grid gap-2 sm:gap-4 bg-slate-50/80 p-3 sm:p-4 rounded-2xl border border-slate-200/70" id="steps"></div>
    <div class="relative w-full bg-gradient-to-b from-slate-50/90 to-white rounded-2xl p-6 md:p-0 border border-slate-200/80 shadow-inner overflow-hidden" id="ring-canvas"></div>
    <div class="hidden overflow-x-auto" id="matrix-view">
      <table class="w-full text-left text-xs text-slate-700 border-collapse"><thead id="matrix-head"></thead><tbody class="divide-y divide-slate-100" id="matrix-body"></tbody></table>
    </div>
    <div class="self-center bg-white px-5 py-2.5 rounded-full border border-slate-200 shadow-md flex items-center gap-3 text-xs text-slate-700 flex-wrap justify-center">
      <div class="flex items-center gap-1.5 font-bold text-emerald-600"><span class="material-symbols-outlined text-[16px]">lock</span>${cycle.accepted} of ${cycle.length} confirmed</div>
      <div class="h-3 w-px bg-slate-200"></div>
      <span class="font-mono text-[11px] text-slate-500">Cycle #${cycle.id}</span>
    </div>
  </section>`;
}

function confirmBar() {
  const { cycle } = data;
  if (!cycle || cycle.status !== "proposed") return "";
  if (cycle.my_response === "accepted") {
    const waiting = cycle.length - cycle.accepted;
    return html`
    <div class="bg-gradient-to-r from-emerald-50 via-white to-emerald-50/40 p-5 sm:p-6 rounded-3xl border-2 border-emerald-200 flex items-center gap-3.5">
      <div class="w-12 h-12 rounded-2xl bg-white shadow-sm border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0"><span class="material-symbols-outlined text-[26px]">task_alt</span></div>
      <div><h4 class="font-extrabold text-base text-slate-900">You confirmed this swap ✓</h4>
      <p class="text-xs text-slate-600 mt-1">Waiting for ${waiting} more member${waiting === 1 ? "" : "s"} to confirm.</p></div>
    </div>`;
  }
  return html`
  <div class="bg-gradient-to-r from-rose-50 via-pink-50/50 to-amber-50/40 p-5 sm:p-6 rounded-3xl border-2 border-rose-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 transition-all duration-300 hover:border-rose-300">
    <div class="flex items-start gap-3.5">
      <div class="w-12 h-12 rounded-2xl bg-white shadow-sm border border-rose-200 flex items-center justify-center text-primary shrink-0"><span class="material-symbols-outlined text-[26px]">assignment_turned_in</span></div>
      <div class="flex flex-col">
        <h4 class="font-extrabold text-base text-slate-900 flex items-center gap-2 flex-wrap">Confirm your swap <span class="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-rose-100 text-primary">Action needed</span></h4>
        <p class="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">By confirming, you agree to give up ${cycle.give_room.label} and move to ${cycle.receive_room.label} once the warden approves. If anyone declines, the swap is cancelled and the others go back into the pool.</p>
      </div>
    </div>
    <div class="flex items-center gap-3 w-full md:w-auto shrink-0 flex-col sm:flex-row">
      <button class="w-full sm:w-auto px-5 py-3 rounded-full bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs transition-all border border-slate-300 shadow-xs active:scale-95" id="btn-decline" type="button">Decline swap</button>
      <button class="relative overflow-hidden w-full sm:w-auto px-7 py-3.5 rounded-full bg-gradient-to-r from-[#FF385C] to-rose-600 hover:from-[#E00B41] hover:to-rose-700 text-white font-extrabold text-xs tracking-wide uppercase transition-all duration-200 shadow-lg shadow-rose-500/30 hover:shadow-rose-500/50 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 group" id="btn-accept" type="button">
        <span class="absolute inset-0 shimmer-gradient pointer-events-none opacity-40 group-hover:opacity-100 transition-opacity"></span>
        <span class="material-symbols-outlined text-[18px]">verified</span><span>Confirm swap</span>
      </button>
    </div>
  </div>`;
}

function lowerGrid() {
  const { events, milestones, room } = data;
  const stream = events.length
    ? events.map((e) => {
      const [dot, ring, tag, tagTone] = EVENT_TONE[e.kind] || ["bg-slate-400", "ring-slate-100", "EVENT", "bg-slate-100 text-slate-700"];
      return html`
      <div class="py-3 flex items-start justify-between gap-4 hover:bg-slate-50/70 transition-colors px-2 rounded-xl">
        <div class="flex items-start gap-3 min-w-0">
          <div class="mt-1 w-2.5 h-2.5 rounded-full ${raw(dot)} shrink-0 ring-4 ${raw(ring)}"></div>
          <div class="flex flex-col min-w-0">
            <span class="text-[10px] font-mono font-bold ${raw(tagTone)} px-1.5 py-0.5 rounded self-start">${tag}</span>
            <p class="text-xs text-slate-600 mt-1">${e.message}</p>
          </div>
        </div>
        <span class="text-[11px] font-mono text-slate-400 whitespace-nowrap">${timeAgo(e.created_at)}</span>
      </div>`;
    }).join("")
    : `<p class="py-6 text-center text-xs text-slate-400">Nothing yet. Your activity will show up here.</p>`;
  const steps = milestones.map((m) => {
    if (m.state === "done") return html`<div class="milestone-item flex items-start gap-3 p-3 rounded-2xl bg-emerald-50/60 border border-emerald-100"><span class="material-symbols-outlined text-[20px] text-emerald-600">check_circle</span><span class="text-xs font-bold text-slate-600 mt-0.5">${m.label}</span></div>`;
    if (m.state === "current") return html`<div class="milestone-item flex items-start gap-3 p-3 rounded-2xl bg-rose-50 border-2 border-rose-300 shadow-xs"><span class="material-symbols-outlined text-[20px] text-primary">radio_button_checked</span><div class="flex flex-col"><span class="text-xs font-extrabold text-slate-900">${m.label}</span><span class="text-[10px] font-bold text-primary flex items-center gap-1 mt-0.5"><span class="w-1.5 h-1.5 rounded-full bg-primary animate-ping"></span>You are here</span></div></div>`;
    return html`<div class="milestone-item flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100 opacity-65"><span class="material-symbols-outlined text-[20px] text-slate-400">lock</span><span class="text-xs font-semibold text-slate-700 mt-0.5">${m.label}</span></div>`;
  }).join("");
  const pending = milestones.filter((m) => m.state !== "done").length;
  return html`
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <div class="lg:col-span-2 bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm flex flex-col gap-4">
      <div class="flex items-center justify-between pb-2 border-b border-slate-100">
        <div class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full bg-violet-600 animate-pulse"></span><h3 class="font-extrabold text-base text-slate-900">Activity</h3></div>
        <span class="text-xs font-mono text-slate-400">${events.length} event${events.length === 1 ? "" : "s"}</span>
      </div>
      <div class="flex flex-col divide-y divide-slate-100 max-h-96 overflow-y-auto">${raw(stream)}</div>
    </div>
    <div class="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm flex flex-col justify-between">
      <div class="flex flex-col gap-4">
        <div class="flex items-center justify-between pb-2 border-b border-slate-100">
          <h3 class="font-extrabold text-base text-slate-900">Your steps</h3>
          <span class="text-[10px] font-bold uppercase bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full">${pending ? `${pending} to go` : "Complete"}</span>
        </div>
        <div class="flex flex-col gap-2.5">${raw(steps)}</div>
      </div>
      ${room ? raw(html`<div class="mt-6 pt-3 border-t border-slate-100 flex items-center gap-3"><div class="w-10 h-10 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0"><span class="material-symbols-outlined text-[20px]">support_agent</span></div><div class="flex flex-col"><span class="text-xs font-bold text-slate-800">${room.warden}</span><span class="text-[10px] text-slate-500">Warden, ${room.hostel.name}</span></div></div>`) : ""}
    </div>
  </div>`;
}

function tickCountdown() {
  const el = $("#countdown");
  if (!el || !data.cycle) return;
  const c = countdown(data.cycle.deadline);
  el.innerHTML = c.done ? "Expired"
    : `<span>${pad2(c.days)}d</span><span class="text-slate-500">:</span><span>${pad2(c.hours)}h</span><span class="text-slate-500">:</span><span>${pad2(c.minutes)}m</span><span class="text-slate-500">:</span><span class="text-rose-400 w-10 text-right">${pad2(c.seconds)}s</span>`;
}

function render() {
  const run = data.last_run;
  $("#strip-run").textContent = run
    ? `Last matching round ${timeAgo(run.created_at)} · ${run.yield_pct}% matched`
    : "No matching round yet";
  root.innerHTML = hero() + cards() + chainSection() + confirmBar() + lowerGrid();
  if (data.cycle) {
    renderSteps($("#steps"), data.cycle);
    renderRing($("#ring-canvas"), data.cycle);
    renderMatrix($("#matrix-head"), $("#matrix-body"), data.cycle);
    wireTabs();
  }
  clearInterval(clockTimer);
  if (data.cycle?.status === "proposed") {
    tickCountdown();
    clockTimer = setInterval(tickCountdown, 1000);
  }
  wireActions();
}

function wireTabs() {
  const graph = $("#view-graph"), matrix = $("#view-matrix");
  const on = "px-4 py-1.5 rounded-full bg-white text-slate-900 text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5";
  const off = "px-4 py-1.5 rounded-full text-slate-600 hover:text-slate-900 text-xs font-bold transition-all flex items-center gap-1.5";
  const show = (isGraph) => {
    $("#ring-canvas").hidden = !isGraph;
    $("#matrix-view").classList.toggle("hidden", isGraph);
    graph.className = isGraph ? on : off;
    matrix.className = isGraph ? off : on;
    graph.setAttribute("aria-selected", String(isGraph));
    matrix.setAttribute("aria-selected", String(!isGraph));
  };
  graph.addEventListener("click", () => show(true));
  matrix.addEventListener("click", () => show(false));
}

async function act(button, label, path, success) {
  const restore = setBusy(button, label);
  try {
    await api(path, { method: path.includes("requests") ? "DELETE" : "POST" });
    toast(...success);
    await load();
  } catch (error) {
    restore();
    toastError(error);
    await load();
  }
}

function wireActions() {
  const { cycle } = data;
  $("#btn-withdraw")?.addEventListener("click", (e) => {
    if (!confirm("Withdraw your request? You can submit a new one later.")) return;
    act(e.currentTarget, "Withdrawing…", "/api/requests/current", ["Request withdrawn", "You're no longer in the matching pool.", { icon: "undo" }]);
  });
  $("#btn-accept")?.addEventListener("click", (e) =>
    act(e.currentTarget, "Confirming…", `/api/cycles/${cycle.id}/accept`, ["Swap confirmed", "We'll tell you when everyone has confirmed.", { icon: "verified" }]));
  $("#btn-decline")?.addEventListener("click", (e) => {
    if (!confirm("Decline this swap? The chain will be cancelled for everyone and your request will close.")) return;
    act(e.currentTarget, "Declining…", `/api/cycles/${cycle.id}/decline`, ["Swap declined", "The chain was cancelled. Your request is closed.", { icon: "block", tone: "error" }]);
  });
}

async function load() {
  try {
    data = await api("/api/me/dashboard");
    render();
  } catch (error) {
    if (error.status === 401) return location.replace("/");
    root.innerHTML = html`<div class="bg-white rounded-3xl border border-red-200 p-8 text-center"><span class="material-symbols-outlined text-red-500 text-[32px]">error</span><h2 class="font-extrabold text-slate-900 mt-2">Couldn't load your dashboard</h2><p class="text-sm text-slate-500 mt-1">${error.message}</p><button class="mt-4 px-4 py-2 rounded-full bg-slate-900 text-white text-xs font-bold" id="btn-retry" type="button">Try again</button></div>`;
    $("#btn-retry").addEventListener("click", load);
  }
}

const me = await requireUser("student");
fillHeader(me);
load();
