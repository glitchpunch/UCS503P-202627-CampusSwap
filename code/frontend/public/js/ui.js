// Small shared helpers for every page.

// Escape text before putting it inside HTML, so names can never inject code.
export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// Tagged template: html`<p>${name}</p>` escapes every value unless wrapped in raw().
export function html(strings, ...values) {
  return strings.reduce((out, s, i) => {
    if (i === 0) return s;
    const v = values[i - 1];
    const text = Array.isArray(v) ? v.map((x) => (x && x.__raw !== undefined ? x.__raw : esc(x))).join("")
      : v && v.__raw !== undefined ? v.__raw : esc(v);
    return out + text + s;
  }, "");
}
export const raw = (markup) => ({ __raw: String(markup) });

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const IST = { timeZone: "Asia/Kolkata" };
export function formatDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { ...IST, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
export function timeAgo(iso) {
  if (!iso) return "—";
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  return formatDateTime(iso);
}
export function countdown(iso) {
  const ms = Math.max(0, new Date(iso).getTime() - Date.now());
  const s = Math.floor(ms / 1000);
  return { done: ms === 0, days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 };
}
export const pad2 = (n) => String(n).padStart(2, "0");

// Dark toast, as in the references. position: "bottom" (dashboard/rooms) or "top" (admin).
let toastTimer;
export function toast(title, message = "", { icon = "check_circle", tone = "success", position = "bottom" } = {}) {
  let el = document.getElementById("cs-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "cs-toast";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    document.body.appendChild(el);
  }
  const where = position === "top" ? "top-5 right-5" : "bottom-6 right-6";
  const iconTone = tone === "error" ? "bg-red-500/20 text-red-300 border-red-500/30" : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  el.className = `fixed ${where} z-[9999] max-w-md bg-slate-900 text-white px-5 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700 transition-all duration-300 opacity-0 translate-y-2`;
  el.innerHTML = html`
    <div class="w-8 h-8 rounded-xl ${raw(iconTone)} flex items-center justify-center shrink-0 border">
      <span class="material-symbols-outlined text-[20px]">${icon}</span>
    </div>
    <div class="flex flex-col min-w-0">
      <span class="text-xs font-bold text-white">${title}</span>
      ${message ? raw(html`<span class="text-[11px] text-slate-400">${message}</span>`) : ""}
    </div>`;
  requestAnimationFrame(() => el.classList.remove("opacity-0", "translate-y-2"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("opacity-0", "translate-y-2"), 4200);
}
export const toastError = (error, position) =>
  toast("Something went wrong", error?.message || String(error), { icon: "error", tone: "error", position });

// Show a spinner on a button while an action runs; returns a function that restores it.
export function setBusy(button, label) {
  const original = button.innerHTML;
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  button.innerHTML = html`<span class="material-symbols-outlined text-[18px] animate-spin">progress_activity</span><span>${label}</span>`;
  return () => {
    button.disabled = false;
    button.removeAttribute("aria-busy");
    button.innerHTML = original;
  };
}

export const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
export const ordinal = (n) => `${n}${["th", "st", "nd", "rd"][((n % 100) - 20) % 10] || ["th", "st", "nd", "rd"][n % 100] || "th"}`;
