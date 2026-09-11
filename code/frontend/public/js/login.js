// Login page: student / hostel staff sign-in, live pool numbers.
import { api } from "./api.js";
import { $, html, plural } from "./ui.js";

const DOMAIN = "@thapar.edu";
const DEMO = { student: "student1@thapar.edu", admin: "warden@thapar.edu" };
const TAB_ACTIVE = "relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 text-center font-bold text-xs sm:text-sm rounded-xl transition-colors duration-200 text-primary cursor-pointer";
const TAB_IDLE = "relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 text-center font-medium text-xs sm:text-sm rounded-xl transition-colors duration-200 text-text-secondary hover:text-text-primary cursor-pointer";
const COPY = {
  student: {
    title: "Find a better hostel room in a few clicks!",
    desc: "Sign in with your Thapar email to browse rooms, rank your choices and track your swap.",
    label: "Thapar Email Address", placeholder: "yourname_be24@thapar.edu", button: "Sign in to CampusSwap", icon: "arrow_forward",
  },
  admin: {
    title: "Hostel Staff Terminal 🔑",
    desc: "Run matching rounds, review swap chains and approve swaps everyone has confirmed.",
    label: "Staff Email Address", placeholder: "warden@thapar.edu", button: "Sign in to Admin Portal", icon: "admin_panel_settings",
  },
};

let role = "student";
const email = $("#campus-identity");
const password = $("#password");
const notice = $("#notice-box");
const defaultNotice = notice.innerHTML;

function buttonLabel() {
  const c = COPY[role];
  return html`<span>${c.button}</span><span class="material-symbols-outlined text-[18px] transition-transform duration-200 group-hover:translate-x-1.5">${c.icon}</span>`;
}

function switchRole(next) {
  role = next;
  const student = role === "student";
  $("#toggle-pill").style.transform = student ? "translateX(0%)" : "translateX(100%)";
  $("#tab-student").className = student ? TAB_ACTIVE : TAB_IDLE;
  $("#tab-admin").className = student ? TAB_IDLE : TAB_ACTIVE;
  $("#tab-student").setAttribute("aria-selected", String(student));
  $("#tab-admin").setAttribute("aria-selected", String(!student));
  $("#student-icon").className = `material-symbols-outlined text-[17px] transition-colors${student ? " text-primary" : ""}`;
  $("#admin-icon").className = `material-symbols-outlined text-[17px] transition-colors${student ? "" : " text-primary"}`;
  const c = COPY[role];
  $("#panel-title").textContent = c.title;
  $("#panel-desc").textContent = c.desc;
  $("#label-identity").innerHTML = html`<span>${c.label}</span><span class="text-primary">*</span>`;
  email.placeholder = c.placeholder;
  $("#btn-text").innerHTML = buttonLabel();
  showNotice("default");
}

function checkDomain(value) {
  const indicator = $("#domain-indicator");
  const v = value.trim().toLowerCase();
  if (v.endsWith(DOMAIN) && v.length > DOMAIN.length) {
    indicator.className = "font-mono text-[11px] font-bold text-success-mint bg-mint-subtle px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs ring-2 ring-emerald-300/40 transition-all";
    indicator.innerHTML = `<span class="material-symbols-outlined text-[13px]">verified</span> Thapar email ✓`;
  } else if (v.length > 5 && v.includes("@")) {
    indicator.className = "font-mono text-[11px] font-bold text-primary bg-coral-subtle px-2 py-0.5 rounded-full flex items-center gap-1 transition-all";
    indicator.innerHTML = `<span class="material-symbols-outlined text-[13px]">error</span> @thapar.edu required`;
  } else {
    indicator.className = "font-mono text-[11px] font-semibold text-text-tertiary bg-stone-100 px-2 py-0.5 rounded-full flex items-center gap-1 transition-all";
    indicator.innerHTML = `<span class="material-symbols-outlined text-[13px]">sync</span> Waiting for @thapar.edu`;
  }
}

function showNotice(kind, title = "", message = "") {
  if (kind === "default") {
    notice.className = "mt-5 p-3 rounded-2xl bg-coral-subtle/70 border border-pink-100 transition-all duration-200";
    notice.innerHTML = defaultNotice;
    return;
  }
  const styles = {
    error: ["mt-5 p-3.5 rounded-2xl bg-red-50 border border-red-200 transition-all duration-200 animate-fade-in-stagger", "error", "text-red-500", "text-red-800", "text-red-600"],
    busy: ["mt-5 p-3 rounded-2xl bg-amber-50 border border-amber-200/80 transition-all duration-200", "", "", "text-text-primary", "text-text-secondary"],
    success: ["mt-5 p-3.5 rounded-2xl bg-mint-subtle border border-emerald-200 transition-all duration-200", "celebration", "text-success-mint", "text-emerald-950", "text-emerald-800"],
  }[kind];
  const [box, icon, iconTone, titleTone, textTone] = styles;
  notice.className = box;
  const lead = kind === "busy"
    ? `<span class="w-4 h-4 rounded-full border-2 border-amber-500 border-t-transparent animate-spin shrink-0 mt-0.5"></span>`
    : html`<span class="material-symbols-outlined text-[20px] ${iconTone} shrink-0 mt-0.5">${icon}</span>`;
  notice.innerHTML = html`<div class="flex items-start gap-2.5">${{ __raw: lead }}<div>
    <p class="font-bold text-xs ${titleTone}">${title}</p>
    ${message ? { __raw: html`<p class="text-[11px] ${textTone} mt-0.5">${message}</p>` } : ""}</div></div>`;
}

async function submit(event) {
  event.preventDefault();
  const address = email.value.trim().toLowerCase();
  if (!address.endsWith(DOMAIN) || address.length <= DOMAIN.length) {
    showNotice("error", "Use your Thapar email", `Your email must end with ${DOMAIN}.`);
    email.focus();
    return;
  }
  if (!password.value) {
    showNotice("error", "Enter your password", "The password box is empty.");
    password.focus();
    return;
  }
  const button = $("#btn-submit");
  button.disabled = true;
  $("#btn-text").innerHTML = `<span class="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin inline-block"></span><span>Checking your details…</span>`;
  showNotice("busy", "Signing you in…");
  try {
    const me = await api("/api/auth/login", { method: "POST", body: { email: address, password: password.value, role } });
    showNotice("success", `Welcome, ${me.name.split(" ")[0]}! 🎓`,
      me.role === "admin" ? "Opening the admin portal…" : "Opening your dashboard…");
    setTimeout(() => location.assign(me.role === "admin" ? "/admin.html" : "/dashboard.html"), 500);
  } catch (error) {
    button.disabled = false;
    $("#btn-text").innerHTML = buttonLabel();
    showNotice("error", error.code === "bad_credentials" ? "Wrong email or password" : "Couldn't sign you in", error.message);
    if (error.code === "wrong_role") switchRole(role === "student" ? "admin" : "student");
  }
}

function drawSparkline(counts) {
  const max = Math.max(1, ...counts);
  const points = counts.map((v, i) => [Math.round((i * 128) / (counts.length - 1)), Math.round(32 - (v / max) * 30)]);
  const line = points.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");
  $("#spark-line").setAttribute("d", line);
  $("#spark-area").setAttribute("d", `${line} V36 H0 Z`);
  const [lastX, lastY] = points.at(-1);
  for (const id of ["#spark-ping", "#spark-dot"]) {
    $(id).setAttribute("cx", lastX);
    $(id).setAttribute("cy", lastY);
  }
}

async function loadStats() {
  try {
    const s = await api("/api/public/stats");
    $("#stat-open").textContent = s.open_requests.toLocaleString("en-IN");
    $("#stat-open-sub").textContent = `Students waiting to swap across ${plural(s.hostels, "hostel")}`;
    $("#badge-rooms").textContent = `${s.rooms} rooms, ${s.hostels} hostels`;
    $("#badge-rooms-sub").textContent = "Thapar-style demo hostels";
    $("#badge-pool").textContent = plural(s.open_requests, "open swap request");
    if (s.last_run) {
      $("#stat-yield").textContent = `${s.last_run.yield_pct}%`;
      $("#badge-yield").textContent = `Last round: ${s.last_run.yield_pct}% matched`;
      $("#badge-yield-sub").textContent = `${s.last_run.matched} of ${s.last_run.pool_size} students`;
    } else {
      $("#badge-yield").textContent = "No matching round yet";
      $("#badge-yield-sub").textContent = "The warden runs rounds";
    }
    drawSparkline(s.requests_per_day);
  } catch {
    $("#stat-open-sub").textContent = "Live numbers unavailable right now";
    $("#badge-rooms-sub").textContent = "—";
    $("#badge-yield-sub").textContent = "—";
  }
}

// Already signed in? Go straight to the right page.
api("/api/auth/status")
  .then(({ user }) => {
    if (user) location.replace(user.role === "admin" ? "/admin.html" : "/dashboard.html");
  })
  .catch(() => {});

$("#tab-student").addEventListener("click", () => switchRole("student"));
$("#tab-admin").addEventListener("click", () => switchRole("admin"));
email.addEventListener("input", () => checkDomain(email.value));
$("#chip-domain").addEventListener("click", () => {
  const local = email.value.split("@")[0].trim();
  email.value = `${local}${DOMAIN}`;
  email.focus();
  email.setSelectionRange(0, local.length);
  checkDomain(email.value);
});
$("#toggle-password").addEventListener("click", () => {
  const show = password.type === "password";
  password.type = show ? "text" : "password";
  $("#toggle-password-icon").textContent = show ? "visibility_off" : "visibility";
  $("#toggle-password").setAttribute("aria-label", show ? "Hide password" : "Show password");
});
for (const button of document.querySelectorAll("[data-demo]")) {
  button.addEventListener("click", () => {
    switchRole(button.dataset.demo);
    email.value = DEMO[button.dataset.demo];
    password.value = "campus123";
    checkDomain(email.value);
    $("#btn-submit").focus();
  });
}
$("#auth-form").addEventListener("submit", submit);
loadStats();
