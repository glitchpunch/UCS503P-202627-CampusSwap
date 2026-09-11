# CampusSwap — Prototype Plan (UCS503P, prototype-stage evaluation)

## Context

Four students (Jahnavi, Ronit, Ranvir, Krishna) must show a **working prototype** plus a report with **Use Case + UML diagrams** in the lab this week. The proposal (`Proposal_Software_Engineering.pdf`) promises a hostel room-swap system that uses **Top Trading Cycles (TTC)**, a matching method that finds chains of swaps (A→B→C→A) where everyone gets a room they want more.

The proposal defines Phase 1 success as *"accepting a request, persisting it to the database, executing a match, and rendering the result."* The prototype must do exactly that, for real, with no faked screens. The user supplied 4 reference HTML pages (login, student dashboard, admin portal, explore rooms). The UI must stay **as close to them as possible** without any fake functionality.

The repo `ranvir7123/UCS503P-202627-CampusSwap` is public, empty, and not a fork. The course template is `tiet-ucs503/ucs503p-202627odd-template`.

---

## 1. Who uses it and what they need (designed backwards from this)

| Person | Trying to get done | What they see / touch | Where they get stuck today |
|---|---|---|---|
| **Student** (on a phone, usually) | Move to a better room | Their current room, a room browser, a ranked list, and the status of their swap | Offers scattered on WhatsApp. No idea whether anything is happening. Can't find 3-way chains. |
| **Warden / admin** | Run a fair matching round and approve results | Every request, a "Run matching" button, the chains found, and an approve button | Paper forms, no central record |

**Demo story for the lab (≈3 minutes):** a student logs in → browses rooms → ranks 3 → submits and gets a tracking ID. Admin logs in → clicks **Run TTC matching** → sees the chains and the Match Yield %, plus a comparison against 1:1-only swaps. Student refreshes → sees the swap-chain picture → confirms. Admin approves. The student's room changes.

---

## 2. Tech stack (my choice, as you asked) — and why

| Layer | Choice | Plain-words reason |
|---|---|---|
| Pages | Your 4 HTML files, kept as plain HTML + small JavaScript files | They're already HTML. React would add a build tool and a lot to learn, for no gain here. |
| Styling | **Tailwind CSS v3.4, built on your laptop** (with the same colours and animations as your references) | Your references load Tailwind from the internet at page load. If the lab Wi-Fi drops, the page loses all styling in front of the examiner. Building it into one local `.css` file removes that risk. |
| Fonts / icons | Plus Jakarta Sans, JetBrains Mono and Material Symbols, stored in the repo | Same reason: the demo works with no internet. |
| Server | **Python 3.12 + FastAPI** | Short, readable code. It automatically makes an interactive API page at `/docs`, which is great for the demo and for studying. |
| Database | **SQLite through SQLAlchemy** | A real SQL database that keeps a change all-or-nothing (the "ACID" the proposal promises), stored as a single file, with nothing to install. SQLAlchemy lets us move to PostgreSQL later by changing one line. |
| Login | Email + password. Passwords are stored hashed (Python's built-in `scrypt`). A random session token lives in a browser cookie that JavaScript can't read. | This is the "token-based sessions" the proposal mentions, with no extra libraries. |
| Matching engine | Pure Python module with **no database or web code inside** | It can be unit-tested alone, as the proposal says: "unit-test the engine with synthetic data." |
| Tests | pytest (engine tests + API tests) | Standard. |
| CI | GitHub Actions runs the tests on every push and pull request | The proposal promises this. |
| Docs site | MkDocs (already in the template, publishes to GitHub Pages) | The template already has it wired up. |
| Diagrams | **PlantUML** source files → PNG/SVG images | Mermaid can't draw a real UML use case diagram (stick-figure actors, ovals, system box). PlantUML can. No Java here, so I render through the public PlantUML server. Only the diagram text is sent. |

---

## 3. What I will change in your reference HTML — read this, it matters

Your references look great, but a lot of their content is **fake or wrong for your project**. If you show it, the examiner can catch it:

- **Wrong algorithm names.** "Gale-Shapley", "Deferred Acceptance" and "Edmonds-Karp Max-Flow" are *different* algorithms from TTC. Your proposal says TTC. If the admin page says Gale-Shapley, an examiner will ask you to explain Gale-Shapley.
- **Made-up numbers:** "1,420 active peers", "98% match confidence", "99% Match", "Ping 18ms", "96.2% satisfaction", and timer-driven fake terminal logs.
- **Made-up security claims:** Shibboleth, Duo 2FA, InCommon, "cryptographic escrow", "smart contract", Redis cluster. None of these exist in your system.
- **US universities** (Stanford/Harvard/MIT/.edu), and buttons that pretend (magic link, audit sheet, export) with only a toast message.
- **Profile photos hot-linked** from Google image servers. They can disappear, so I'll replace them with initials avatars.
- **Unsafe coding pattern:** user text is put straight into `innerHTML`, which lets someone inject their own code into the page. All user text will be escaped.

**Rule I'll follow:** keep every visual element (layout, colours, cards, animations, the swap-ring drawing, the terminal panel, the KPI cards). Replace each fake value with a **real value from the database**, or give the element a real job. Remove an element only if it can't have a real job in the prototype. Brand name becomes **CampusSwap** (your repo name), and the context becomes Thapar (`@thapar.edu`, lettered hostels).

### Page 1 — Login (`login.html`, from reference 1)
- Keep: floating badges, mesh background, Student / Hostel Staff sliding switch, coral button with shimmer, security box, live card with sparkline.
- Change: the email field checks for `@thapar.edu` (the ".edu auto-verify" badge becomes "Thapar email ✓"). Add a **password** field for both roles. The admin "authorization token" field becomes the admin password. The floating badges show real sample rooms.
- The live card shows real numbers from `/api/public/stats`: requests in the pool, rooms, last round's Match Yield. The sparkline plots requests per day over the last 7 days.
- Remove: magic link, the "Eduroam/ADFS" buttons, the Duo/Shibboleth claims.
- Add: a small **demo accounts** hint, so the lab demo can't stall on a forgotten password.
- States: wrong password (inline red box, like the reference's error style), empty fields, loading spinner, locked button while waiting.

### Page 2 — Explore rooms and ranked list (`rooms.html`, from reference 4) ← feature 1
- Keep: sticky filter pills, active-filter chips, blueprint card per room, right-hand "Ranked Queue" with up to 5 slots, progress bar, shimmer submit button, grid/compact toggle, pagination.
- Filters that really work: hostel, floor, seater (1/2/3), AC, attached washroom. The search box filters by hostel, block or room number.
- The blueprint box is **drawn from the room's data**: number of beds from the seater type, a washroom box if attached, an AC tag.
- The "99% Match" pill becomes a real **"N here open to swap"** (green) or "No one here swapping yet" (grey). Occupant names are hidden for privacy.
- The ranked queue can be **reordered by drag on desktop and ↑/↓ buttons** (drag doesn't work on phones). It blocks your own room, duplicates, more than 5, and a second active request.
- **Submit** saves the request to the database and returns a tracking ID (e.g. `CS-2026-0007`). "Save draft" becomes **Clear list**.
- If you already have an active request, the queue is shown locked, with a **Withdraw** button.
- The "98.2% match rate" box shows the real Match Yield from the last round, or an empty state if no round has run yet.

### Page 3 — Student dashboard (`dashboard.html`, from reference 2)
- Keep: status strip, hero, 3 cards (Current room / You receive / Deadline + consents), the **animated swap-ring picture**, the Property Matrix tab, the confirm bar, event stream, milestones.
- The **ring is drawn from the real cycle**, for any length 2–N (nodes placed on a circle, flowing arrows between them), not the hard-coded 3 nodes. On phones it becomes stacked cards with arrows, just like the reference.
- Milestones = the real status tracker: Submitted → In pool → Match found → Everyone confirmed → Warden approved.
- The event stream = real events from the database.
- Confirm / Decline buttons work (see the question at the end). The countdown counts to the real 48-hour deadline.
- Empty states: no request yet (big invite to Explore Rooms); in the pool but no match yet; not matched this round.
- Remove: "Recalculate matrix" (students can't run matching), ⌘K search, the notification bell.

### Page 4 — Admin engine room (`admin.html`, from reference 3) ← feature 2
- Keep: progress line, 4 KPI cards (click to filter), status banner, table with expandable rows, tabs, search, pagination, terminal panel, side card, modal, toast.
- **Run TTC matching round** calls the real engine. The progress line runs while waiting.
- KPIs, all real: students in the pool · 2-way swaps · multi-way loops (3-way/4-way counts) · **Match Yield %** (the proposal's core metric), with "got 1st choice %" underneath.
- Banner: "Top Trading Cycles — Pareto efficient, strategy-proof, core-stable". These are the 3 guarantees from your proposal.
- Table rows: tracking ID, student, current room → assigned room, cycle type, "got choice #k of n", status. Expanding a row shows the ranked list and the cycle members.
- **Terminal = the engine's real step-by-step trace** (e.g. "Round 1: 14 students point… Cycle found: A→B→C→A"). This is a great thing to walk the examiner through.
- The "Simulation mode" toggle and "Constraints" modal become **Run settings**: *Dry run* (compute without saving) and *Algorithm: TTC or 1:1 swaps only*. The side card shows **TTC vs 1:1 Match Yield side by side**. That is exactly the comparison your proposal's evaluation section promises.
- **Export CSV** downloads real results. **Approve** is enabled only when every member of a cycle has confirmed.
- Remove: gender-wing override (see §4 — hostel gender is enforced automatically), Redis/latency/hash text.

Every page gets these states: loading skeletons, error toast + inline message, empty state, long names cut off with the full name on hover, and a check at 375 px (phone) width.

---

## 4. How it works inside

### Data (tables)
- `users`: one table for both Student and Admin, marked by a role column. The class diagram draws this as Student and Admin inheriting from User. Students also have roll no, name, gender, year and branch.
- `hostels` (name, gender, warden) → `rooms` (block, floor, number, seater, AC, washroom, tags) → `seats` (one bed, one occupant).
- `swap_requests` (tracking ID, student, the seat they give up, status: open / matched / completed / withdrawn) → `preferences` (rank 1–5 → room).
- `match_runs` (who, when, algorithm, dry run?, pool size, matched count, yield, cycles by length, trace text) → `cycles` (status: proposed / confirmed / approved / dissolved, deadline) → `cycle_members` (gives seat, receives seat, response: pending / accepted / declined).
- `events` (the audit log behind the event stream and the terminal) and `sessions` (login tokens, stored hashed).

### Matching rules (TTC)
1. The pool = every open request. Each student points to the **owner of their best still-available room**. A double room has 2 seats, so any seat in a ranked room counts, with ties broken by seat ID so the result is always the same.
2. If none of a student's choices is available, they point to their own seat. That makes a "self-cycle", which means they keep their room (no one is ever made worse off).
3. Find every cycle and assign it. Remove those students and seats. Repeat until everyone is removed.
4. Hostel gender is checked when a request is submitted (you can only rank rooms in eligible hostels), so the engine never sees an invalid pair.
5. The 1:1-only comparison: repeatedly pair two students who each ranked the other's room, best combined rank first. Used only for the comparison, never saved.

### Confirmation (proposed flow)
- All members accept → cycle **confirmed** → warden **approves** → seat owners swap in our database. The proposal's boundary stays: we produce the record; the hostel office keeps its own master records.
- Anyone declines → the cycle **dissolves**. The decliner's request closes; everyone else goes back to the pool.
- Deadline (48 h) passes → the cycle dissolves. Those who didn't answer are withdrawn; those who accepted go back to the pool.
- Only one matching run can happen at a time. The whole run is saved all-or-nothing in one database transaction.

### Server API (all under `/api`, also browsable at `/docs`)
`POST auth/login` · `POST auth/logout` · `GET auth/me` · `GET public/stats` · `GET rooms` · `GET me/dashboard` · `POST requests` · `DELETE requests/current` · `POST cycles/{id}/accept|decline` · admin: `GET admin/overview` · `GET admin/requests` · `POST admin/match-runs` · `GET admin/match-runs/latest` · `POST admin/cycles/{id}/approve` · `GET admin/export.csv`

### Folder layout (inside the template)
```
code/backend/app/        main.py, db.py, models.py, schemas.py, security.py, deps.py, routers/, services/
code/backend/engine/     ttc.py, pairwise.py, metrics.py      ← pure, no DB imports
code/backend/seed.py     synthetic Thapar-style demo data (labelled as demo data)
code/backend/tests/      test_ttc.py, test_pairwise.py, test_api_*.py
code/frontend/           tailwind.config.js, src/input.css, package.json
code/frontend/public/    login.html, rooms.html, dashboard.html, admin.html, js/, assets/app.css, fonts/
diagrams/                *.puml sources + rendered *.png / *.svg
docs/                    MkDocs site: standard docs + study/ guide
project-report-prototype-stage/   TIET LaTeX report
.github/workflows/ci.yml          pytest on every push / PR
```
The template's C++ sample in `code/` is removed. `mkdocs.yml` and `pyproject.toml` are updated to our project (authors = the 4 of you).

---

## 5. Documentation

**Standard docs (`docs/`, published to GitHub Pages):** project home, how to run it, architecture, data model, API, matching engine (with a worked example), frontend, testing, the diagrams, and known limitations / Phase 2.

**Study guide (`docs/study/`), in plain language for 4 readers.** Each file covers: what you own (exact files), how it works in plain words, a code walkthrough, **likely viva questions with model answers**, and "if the demo breaks, check…". Plus one shared `overview.md` that all four must know.

| Person | Owns | Remembers |
|---|---|---|
| **P1 — Frontend** | 4 pages, JS files, Tailwind build, UI states | How a page gets data from the server, escaping user text, responsive layout, drawing the swap ring |
| **P2 — Backend & login** | FastAPI routes, sessions, password hashing, validation, confirmation flow | Request/response, cookies and sessions, why passwords are hashed, status transitions |
| **P3 — Matching engine** | `engine/` (TTC, 1:1-only comparison, metrics) + its tests | TTC step by step, its 3 guarantees, why it's O(N²), Match Yield, the 1:1 comparison |
| **P4 — Data, diagrams & delivery** | SQLAlchemy models, seed data, all UML diagrams, LaTeX report, CI, docs site | Tables and relationships, what each diagram shows and why, how CI blocks bad code |

---

## 6. Diagrams (for the report and viva)
1. **Use Case:** actors Student, Admin (Warden), and the Scheduler/System. Use cases: Login, Browse rooms, Submit ranked request, Withdraw request, View match, Confirm/Decline swap, Run matching round, Compare with 1:1, Approve swap, Export results. Uses «include» (e.g. Submit includes Validate) and «extend» where they fit.
2. **Class diagram:** the models above, with inheritance, multiplicities, and the engine classes.
3. **Sequence diagram:** submit request → admin runs TTC → student confirms → admin approves.
4. **Activity diagram:** the life of a swap request, including the decline and deadline branches.

---

## 7. Order of work
1. **Repo:** clone the template (with its history) into `C:\dev\Swe-Project`, point it at your repo, and push `master`. **I'll ask you before pushing.** All later work happens on branch `prototype`, merged by pull request.
2. **Engine first, with tests.** This is what your proposal promises.
3. Models + seed data. The seed includes a 2-way, 3-way and 4-way cycle plus unmatched students, and 3 fresh demo students for the live demo.
4. API + API tests.
5. Frontend pages (the reference changes in §3) + Tailwind build + self-hosted fonts.
6. Diagrams → docs site → study guide → CI.
7. Report: **blocked until you send the Overleaf zip** (Menu → Download → Source). LaTeX isn't installed here, so the report compiles on Overleaf (or you install MiKTeX).

## 8. Verification (I'll paste real output for each)
- `pytest` on the engine and API. Engine tests cover 2/3/4-cycles, no possible swaps, double rooms, exhausted lists, same result every run, and a random-data check that nobody ends up worse than their own room.
- Start the server and run the full demo story in the in-app browser. Screenshot all 4 pages at desktop and 375 px width, in the empty, loading, error and long-text states.
- Unplug test: the pages still look right with no internet.
- `mkdocs build` passes. CI goes green on GitHub after the push.

## 9. Things only you can do / confirm
- Send the **Overleaf source zip**.
- Check the roll numbers: in the proposal, `10240240152` and `10240240001` have **11 digits**, while the others have 10. That's probably a typo, and they're needed for the journal folders and the report cover.
- In GitHub settings: turn on Pages (`gh-pages` branch), and optionally set branch protection so a failing CI run blocks merging. These are account setting changes, so you'll do them (or tell me to).
- Journals must be written by each of you. I'll only create the empty folders.
