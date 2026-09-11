# Frontend

Four pages, each built from one of the team's reference designs. They are plain HTML files
with small JavaScript modules: no framework, no build step except the CSS.

| Page | File | Reference | Main job |
|---|---|---|---|
| Login | `public/index.html` + `js/login.js` | 1 | Student / hostel staff sign-in, live pool numbers |
| Explore rooms | `public/rooms.html` + `js/rooms.js` | 4 | Filter rooms, build a ranked list of up to 5, submit (feature 1) |
| Student dashboard | `public/dashboard.html` + `js/dashboard.js` + `js/ring.js` | 2 | Status, swap chain picture, confirm / decline |
| Admin engine room | `public/admin.html` + `js/admin.js` | 3 | Run TTC, compare with 1:1, approve swaps (feature 2) |

Shared modules: `js/api.js` (talks to the server), `js/ui.js` (escaping, toasts, dates),
`js/nav.js` (fills the header with the logged-in user).

## What changed from the reference designs, and why

The layouts, colours, cards and animations are kept. Content that was fake, or wrong for
this project, was replaced with real data or given a real job:

| In the reference | In CampusSwap | Why |
|---|---|---|
| "Gale-Shapley", "Deferred Acceptance", "Edmonds-Karp" | Top Trading Cycles | Those are different algorithms; the proposal uses TTC |
| Invented numbers (1,420 peers, 98% confidence, 99% match, ping) | Real counts from the database | An examiner can check them |
| Shibboleth, Duo 2FA, "cryptographic escrow", Redis | Hashed passwords and session cookies | Those don't exist in our system |
| US universities, `.edu` check | Thapar, `@thapar.edu` check | Our users |
| Hard-coded 3-person swap ring | Ring drawn for any chain length (`ring.js`) | Real chains are 2, 3, 4… students |
| Timer-driven fake terminal log | The engine's real round-by-round trace | Shows how TTC actually decided |
| "Simulation mode" / constraint sliders | Dry run and TTC-vs-1:1 comparison | Matches the proposal's evaluation plan |
| Photos from Google image servers | Initials avatars | Links could break; no real photos of students |

## Styling

Each page has its own Tailwind config in `code/frontend/tailwind/`, copied from its
reference, because the references use different colour names (`text-primary` is a
different colour on two pages). `npm run build` turns them into one CSS file per page in
`public/assets/`, and copies the fonts into `public/fonts/`. Both are committed, so the
app works with no internet and without Node.

## Safety: never trust text from the server

Names and room labels come from the database. If they were put into the page as raw HTML,
a name like `<img onerror=...>` could run code in someone else's browser (*cross-site
scripting*). Every page builds HTML with the `html` helper in `ui.js`, which escapes each
inserted value. Only our own fixed markup is inserted unescaped, through `raw()`.

## States every page handles

- **Loading:** grey shimmering placeholders (`.skeleton`) until data arrives.
- **Empty:** e.g. "No request yet", "No rooms match these filters", "No round yet".
- **Error:** a dark toast with the server's message, or an inline box with *Try again*.
- **Long text:** names and room labels are cut off with `truncate`, and the full text shows on hover.
- **Small screens:** layouts stack on phones; the swap ring becomes a list of cards; the
  ranked list has ↑/↓ buttons because drag-and-drop doesn't work on touch screens.

## Who may see which page

Each page asks the server who is logged in (`requireUser` in `api.js`). Not logged in →
back to the login page. A student opening `admin.html` is sent to their dashboard, and
the server also refuses admin calls from students (403), so hiding the page is not the
only protection.
