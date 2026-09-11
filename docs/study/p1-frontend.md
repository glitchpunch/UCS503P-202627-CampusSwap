# P1: Frontend

You own what students and the warden see and touch.

## Your files

| File | What it does |
|---|---|
| `code/frontend/public/index.html`, `js/login.js` | Login page: student / staff switch, email check, sign-in, live numbers |
| `public/rooms.html`, `js/rooms.js` | Explore rooms: filters, room cards, ranked list, submit (feature 1) |
| `public/dashboard.html`, `js/dashboard.js`, `js/ring.js` | Student dashboard: status, swap ring, confirm / decline |
| `public/admin.html`, `js/admin.js` | Admin engine room: run, compare, approve (feature 2) |
| `js/api.js` | `api()` sends requests to the server; `requireUser()` checks who is logged in |
| `js/ui.js` | `html` (safe HTML building), `toast()`, dates, countdown |
| `code/frontend/tailwind/*.config.cjs`, `scripts/build.mjs` | The per-page styling build |

## How every page works (same four steps)

1. **Check who is logged in:** `await requireUser("student")`. Not logged in → sent to the
   login page; wrong role → sent to the right page.
2. **Fetch data:** e.g. `api("/api/me/dashboard")`. The server does all the thinking.
3. **Draw it:** build HTML strings with `html`...`` and put them on the page.
4. **Wire the buttons:** each button calls the API, shows a toast, then reloads the data.

The pages hold **no business rules**. For example, the rooms page stops you ranking your own
room, but the server checks it again, because anyone can send requests without our page.

## Walkthrough of the key code

- **Login (`login.js → submit`)** checks the email ends in `@thapar.edu`, then
  `POST /api/auth/login`. The server sets an HttpOnly cookie that our JavaScript can't even
  read; the browser sends it automatically afterwards. On `wrong_role` it flips the tab.
- **Ranked list (`rooms.js`)** keeps `state.queue` (max 5). `rank()`, `unrank()` and
  `move()` change it; drag-and-drop also calls `splice` to reorder. The draft is kept in
  `localStorage` so a refresh doesn't lose it. Submit sends `room_ids` in order: first = best.
- **Swap ring (`ring.js → positions`)** places *n* cards evenly on an ellipse using
  `cos` and `sin` (start angle `-90 - 180/n` so 2 cards sit left/right, 3 make a triangle,
  4 a square). Arrows are curved SVG paths bowed outward from the centre. The glowing dots
  run backwards along each path because a room moves from the giver to the receiver.
- **Admin run (`admin.js → runRound`)** asks for confirmation (unless dry run), calls
  `POST /api/admin/match-runs`, animates the top progress line, prints the real trace
  in the terminal box, then reloads the KPI cards and table.

## Styling decisions

- Each reference page had its own Tailwind colour names, and some clash, so each page has
  its own config and CSS file. That keeps every page's colours exactly like its reference.
- Tailwind and fonts are built into files in the repo, so the demo works with no internet.

## Safety

Text from the server (names, rooms) goes through `esc()`, inside the `html` helper, before
it touches the page. Without it, a student named `<script>…` could run code in the warden's
browser. That attack is called **cross-site scripting (XSS)**.

## Questions you may get

**Why no React?** The references were already plain HTML, and the pages are small. React
would add a build tool and a lot to learn without making the pages better.

**How does the page know who is logged in?** It asks `/api/auth/me`. The login proof is
an HttpOnly cookie the browser sends automatically; JavaScript never handles the token.

**What if the server is down?** `api()` catches the network error and throws "Can't reach
the CampusSwap server", which the page shows in a toast or an error box with *Try again*.

**How does it work on a phone?** Layouts stack in one column, the ring becomes a list of
cards, and ranking uses ↑/↓ buttons because drag-and-drop doesn't work on touch screens.

**Why does each page have its own CSS file?** See *Styling decisions* above.

## If the demo breaks

- Page unstyled → run `npm run build` in `code/frontend`, then `Ctrl+F5`.
- "Can't reach the server" → start `run.py`.
- A button seems dead → open the browser console (F12) and read the red error.
