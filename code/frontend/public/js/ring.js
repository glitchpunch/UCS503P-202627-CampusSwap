// Draws a swap chain of any length (2, 3, 4, ...) in the style of reference 2:
// node cards placed around a loop, joined by flowing gradient arrows.
import { html, raw } from "./ui.js";

// Full class strings (Tailwind only keeps classes it can see written out).
const THEMES = [
  { stroke: "#FF385C", card: "border-rose-200 shadow-rose-500/10", ring: "ring-rose-400", box: "bg-rose-50/70 border-rose-100 group-hover:bg-rose-50", chip: "text-rose-600 border-rose-200", avatar: "from-[#FF385C] to-rose-400", step: "bg-rose-500" },
  { stroke: "#7C3AED", card: "border-violet-200 shadow-violet-500/10", ring: "ring-violet-400", box: "bg-violet-50/70 border-violet-100 group-hover:bg-violet-50", chip: "text-violet-700 border-violet-200", avatar: "from-violet-600 to-indigo-500", step: "bg-violet-600" },
  { stroke: "#FFB300", card: "border-amber-300 shadow-amber-500/10", ring: "ring-amber-400", box: "bg-amber-50/70 border-amber-200 group-hover:bg-amber-50", chip: "text-amber-800 border-amber-300", avatar: "from-amber-500 to-orange-500", step: "bg-amber-400" },
  { stroke: "#10B981", card: "border-emerald-200 shadow-emerald-500/10", ring: "ring-emerald-400", box: "bg-emerald-50/70 border-emerald-100 group-hover:bg-emerald-50", chip: "text-emerald-700 border-emerald-200", avatar: "from-emerald-500 to-teal-500", step: "bg-emerald-500" },
  { stroke: "#0EA5E9", card: "border-sky-200 shadow-sky-500/10", ring: "ring-sky-400", box: "bg-sky-50/70 border-sky-100 group-hover:bg-sky-50", chip: "text-sky-700 border-sky-200", avatar: "from-sky-500 to-cyan-500", step: "bg-sky-500" },
  { stroke: "#6366F1", card: "border-indigo-200 shadow-indigo-500/10", ring: "ring-indigo-400", box: "bg-indigo-50/70 border-indigo-100 group-hover:bg-indigo-50", chip: "text-indigo-700 border-indigo-200", avatar: "from-indigo-500 to-violet-500", step: "bg-indigo-500" },
];
const theme = (i) => THEMES[i % THEMES.length];
const first = (name) => name.split(" ")[0];

export function roomDetails(room) {
  const beds = room.seater === 1 ? "Single" : room.seater === 2 ? "Double" : "Triple";
  return `${beds} • ${room.ac ? "AC" : "Non-AC"} • ${room.washroom === "attached" ? "Attached bath" : "Common bath"}`;
}

const RESPONSE = {
  accepted: { tone: "text-emerald-600", dot: "bg-emerald-500", label: "Confirmed" },
  pending: { tone: "text-amber-600", dot: "bg-amber-500 animate-ping", label: "Awaiting answer" },
  declined: { tone: "text-red-600", dot: "bg-red-500", label: "Declined" },
};

// Where each node sits, as percentages of the canvas (start at the left, go clockwise).
function positions(n) {
  const start = -90 - 180 / n;
  return Array.from({ length: n }, (_, i) => {
    const a = ((start + (360 / n) * i) * Math.PI) / 180;
    return { x: 50 + 33 * Math.cos(a), y: 50 + 30 * Math.sin(a) };
  });
}

export function canvasHeight(n) {
  return n <= 3 ? 560 : n === 4 ? 660 : 780;
}

function arrowPaths(points, height) {
  const cx = 500, cy = height / 2;
  return points.map((p, i) => {
    const q = points[(i + 1) % points.length];
    const x1 = p.x * 10, y1 = (p.y / 100) * height, x2 = q.x * 10, y2 = (q.y / 100) * height;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    let dx = mx - cx, dy = my - cy;
    let len = Math.hypot(dx, dy);
    if (len < 1) { // two nodes: bow the two arrows in opposite directions
      dx = 0; dy = i === 0 ? -1 : 1; len = 1;
    }
    const bulge = points.length === 2 ? 170 : 110;
    const qx = mx + (dx / len) * bulge, qy = my + (dy / len) * bulge;
    return `M ${x1.toFixed(0)} ${y1.toFixed(0)} Q ${qx.toFixed(0)} ${qy.toFixed(0)} ${x2.toFixed(0)} ${y2.toFixed(0)}`;
  });
}

function nodeCard(member, i, cycle) {
  const t = theme(i);
  const n = cycle.members.length;
  const next = cycle.members[(i + 1) % n];
  const me = cycle.members.find((m) => m.is_me);
  const isSource = me && next && (me.position + 1) % n === member.position; // the member whose room I receive
  const r = RESPONSE[member.response] || RESPONSE.pending;
  const badge = member.is_me
    ? html`<div class="absolute -top-3 left-5 flex items-center"><span class="absolute -inset-1 rounded-full bg-rose-400 opacity-60 animate-ping"></span><span class="relative bg-gradient-to-r from-primary to-rose-600 text-white text-[10px] font-extrabold uppercase px-3 py-1 rounded-full shadow-md tracking-wider flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>You</span></div>`
    : isSource
      ? html`<div class="absolute -top-3 left-5 flex items-center"><span class="absolute -inset-1 rounded-full bg-amber-400 opacity-60 animate-ping"></span><span class="relative bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-extrabold uppercase px-3 py-1 rounded-full shadow-md tracking-wider flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>Your new room</span></div>`
      : html`<div class="absolute -top-3 left-5 bg-gradient-to-r from-slate-700 to-slate-900 text-white text-[10px] font-extrabold uppercase px-3 py-1 rounded-full shadow-md tracking-wider">Member ${i + 1} of ${n}</div>`;
  const giveLabel = member.is_me ? "You give up:" : isSource ? "You receive:" : "Gives up:";
  return html`
  <div class="w-full md:max-w-[280px] bg-white p-5 rounded-3xl shadow-lg border-2 ${raw(t.card)} flex flex-col gap-3.5 node-interactive-card group relative md:absolute md:left-[var(--x)] md:top-[var(--y)] md:-translate-x-1/2 md:-translate-y-1/2" style="--x:${member._x}%;--y:${member._y}%">
    ${raw(badge)}
    <div class="flex items-center gap-3 pt-3">
      <div class="relative">
        <div class="w-14 h-14 rounded-2xl bg-gradient-to-tr ${raw(t.avatar)} ring-2 ${raw(t.ring)} shadow-sm text-white font-mono font-bold text-base flex items-center justify-center group-hover:scale-105 transition-transform duration-300">${member.initials}</div>
        <span class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full ${raw(member.response === "accepted" ? "bg-emerald-custom" : "bg-amber-400")} ring-2 ring-white flex items-center justify-center text-[8px] text-white font-bold">${member.response === "accepted" ? "✓" : "●"}</span>
      </div>
      <div class="flex flex-col min-w-0">
        <div class="flex items-center gap-1">
          <span class="font-extrabold text-sm text-slate-900 truncate" title="${member.name}">${member.name}</span>
          <span class="material-symbols-outlined text-[15px] text-primary">verified</span>
        </div>
        <span class="text-[10px] font-bold text-slate-400 font-mono">${member.tracking_id}</span>
      </div>
    </div>
    <div class="${raw(t.box)} border p-3 rounded-2xl flex flex-col gap-1 transition-colors">
      <div class="flex items-center justify-between text-xs font-semibold">
        <span class="text-slate-500 uppercase text-[10px] font-bold">${giveLabel}</span>
        <span class="font-mono font-extrabold bg-white px-2 py-0.5 rounded-md border ${raw(t.chip)} text-[11px] shadow-2xs">${member.gives_room.hostel.code}-${member.gives_room.number}</span>
      </div>
      <div class="text-xs font-bold text-slate-900 truncate">${member.gives_room.hostel.name}, Block ${member.gives_room.block}, Room ${member.gives_room.number}</div>
      <div class="text-slate-500 text-[11px] font-medium">${roomDetails(member.gives_room)} • Floor ${member.gives_room.floor}</div>
    </div>
    <div class="flex items-center justify-between pt-1 border-t border-slate-100">
      <div class="flex items-center gap-1.5 text-[11px] font-bold ${raw(r.tone)}"><span class="w-2 h-2 rounded-full ${raw(r.dot)}"></span>${r.label}</div>
      <span class="font-extrabold text-[11px] text-slate-600 flex items-center gap-0.5 group-hover:translate-x-1 transition-transform">
        Room goes to ${cycle.members[(i - 1 + n) % n].is_me ? "you" : first(cycle.members[(i - 1 + n) % n].name)} ${n === 2 ? "⇄" : "→"}
      </span>
    </div>
  </div>`;
}

// Fills the canvas: SVG arrows (desktop) + node cards (stacked on phones).
export function renderRing(canvas, cycle) {
  const n = cycle.members.length;
  const height = canvasHeight(n);
  const points = positions(n);
  cycle.members.forEach((m, i) => { m._x = points[i].x.toFixed(2); m._y = points[i].y.toFixed(2); });
  const paths = arrowPaths(points, height);
  const gradients = paths.map((_, i) => {
    const a = theme(i).stroke, b = theme((i + 1) % n).stroke;
    return `<linearGradient id="ringG${i}" x1="0%" x2="100%" y1="0%" y2="100%"><stop offset="0%" stop-color="${a}" stop-opacity="0.9"/><stop offset="100%" stop-color="${b}" stop-opacity="0.9"/></linearGradient>`;
  }).join("");
  // Arrows point from the giver to the receiver (the room moves that way):
  // member i's room goes to member i-1, so draw from i to i-1 by reversing each path's direction.
  const svg = `
    <svg class="absolute inset-0 w-full h-full pointer-events-none z-0 hidden md:block" preserveAspectRatio="none" viewBox="0 0 1000 ${height}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>${gradients}
        <filter height="140%" id="glowFilter" width="140%" x="-20%" y="-20%"><feGaussianBlur result="blur" stdDeviation="3.5"/><feComposite in="SourceGraphic" in2="blur" operator="over"/></filter>
        <filter height="200%" id="particleGlow" width="200%" x="-50%" y="-50%"><feGaussianBlur result="glow" stdDeviation="4"/><feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      ${paths.map((d) => `<path d="${d}" fill="none" stroke="#E2E8F0" stroke-linecap="round" stroke-width="4"/>`).join("")}
      ${paths.map((d, i) => `<path class="${i % 2 ? "swap-wire-alt" : "swap-wire"}" d="${d}" fill="none" filter="url(#glowFilter)" stroke="url(#ringG${i})" stroke-linecap="round" stroke-width="3.5"/>`).join("")}
      ${paths.map((d, i) => `<circle fill="${theme(i + 1).stroke}" filter="url(#particleGlow)" r="6"><animateMotion dur="3.2s" keyPoints="1;0" keyTimes="0;1" calcMode="linear" path="${d}" repeatCount="indefinite"/></circle>`).join("")}
    </svg>`;
  canvas.style.minHeight = `${height}px`;
  canvas.innerHTML = `
    <div class="absolute inset-0 opacity-40 pointer-events-none bg-[radial-gradient(#94A3B8_1.2px,transparent_1.2px)] [background-size:24px_24px]"></div>
    ${svg}
    <div class="relative z-10 w-full flex flex-col gap-y-10 md:block md:absolute md:inset-0">${cycle.members.map((m, i) => nodeCard(m, i, cycle)).join("")}</div>`;
}

export function renderSteps(el, cycle) {
  el.style.gridTemplateColumns = `repeat(${cycle.members.length}, minmax(0, 1fr))`;
  el.innerHTML = cycle.members.map((m, i) => html`
    <div class="flex items-center gap-3 ${raw(i ? "border-l border-slate-200 pl-3" : "")} min-w-0">
      <div class="w-8 h-8 rounded-full ${raw(m.response === "accepted" ? "bg-emerald-500" : theme(i).step)} ${raw(m.response === "pending" ? "animate-pulse" : "")} text-white font-bold text-xs flex items-center justify-center shadow-sm shrink-0">${m.response === "accepted" ? "✓" : i + 1}</div>
      <div class="hidden sm:flex flex-col min-w-0">
        <span class="text-xs font-bold text-slate-800 truncate">${m.is_me ? `You (${first(m.name)})` : m.name}</span>
        <span class="text-[10px] font-semibold text-slate-500 truncate">Gives ${m.gives_room.hostel.code}-${m.gives_room.number}</span>
      </div>
    </div>`).join("");
}

export function renderMatrix(head, body, cycle) {
  const cols = cycle.members;
  head.innerHTML = html`<tr class="border-b border-slate-200 bg-slate-50/75">
    <th class="py-3 px-4 font-bold text-slate-500 uppercase">Room detail</th>
    ${cols.map((m) => raw(html`<th class="py-3 px-4 font-bold ${raw(m.is_me ? "text-rose-600" : "text-slate-700")}">${m.gives_room.hostel.code}-${m.gives_room.number} ${m.is_me ? "(you give up)" : `(${first(m.name)})`}</th>`))}
  </tr>`;
  const rows = [
    ["Hostel & block", (r) => `${r.hostel.name}, Block ${r.block}`],
    ["Floor", (r) => (r.floor === 0 ? "Ground" : `Floor ${r.floor}`)],
    ["Beds", (r) => (r.seater === 1 ? "Single" : r.seater === 2 ? "Double sharing" : "Triple sharing")],
    ["Cooling", (r) => (r.ac ? "AC" : "Non-AC")],
    ["Washroom", (r) => (r.washroom === "attached" ? "Attached" : "Common")],
    ["Nearby", (r) => r.tags.join(", ") || "—"],
  ];
  body.innerHTML = rows.map(([label, value]) => html`<tr class="hover:bg-slate-50/50">
    <td class="py-3 px-4 font-semibold text-slate-900">${label}</td>
    ${cols.map((m) => raw(html`<td class="py-3 px-4">${value(m.gives_room)}</td>`))}
  </tr>`).join("");
}
