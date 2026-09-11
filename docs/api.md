# API

The pages talk to the server only through these JSON endpoints. With the server running,
<http://127.0.0.1:8000/docs> shows the same list as an interactive page where you can try
each call (FastAPI generates it automatically).

## Login

Logging in sets a cookie called `cs_session` (HttpOnly, so page scripts can't read it).
The browser sends it back automatically on every later request.

| Method | Path | Who | What it does |
|---|---|---|---|
| POST | `/api/auth/login` | anyone | Body `{email, password, role}`. Sets the cookie, returns the user. |
| POST | `/api/auth/logout` | anyone | Deletes the session and the cookie. |
| GET | `/api/auth/me` | logged in | The current user (401 if not logged in). |
| GET | `/api/auth/status` | anyone | `{user: ... }` or `{user: null}`; never an error. Used by the login page. |
| GET | `/api/public/stats` | anyone | Numbers for the login page: open requests, rooms, hostels, requests per day, last round. No personal data. |

## Student

| Method | Path | What it does |
|---|---|---|
| GET | `/api/rooms` | Rooms in hostels the student may live in, each with `is_own` and `open_to_swap` (how many occupants there want to swap). |
| GET | `/api/me/dashboard` | Current room, active request, swap chain (if any), progress steps and activity. |
| POST | `/api/requests` | Body `{room_ids: [best, second, ...]}` (1–5 rooms). Returns `201 {tracking_id, status}`. |
| DELETE | `/api/requests/current` | Withdraw the active request (only while it is `open`). |
| POST | `/api/cycles/{id}/accept` | Confirm your place in a proposed chain. |
| POST | `/api/cycles/{id}/decline` | Decline: the chain is cancelled for everyone. |

## Hostel staff

| Method | Path | What it does |
|---|---|---|
| GET | `/api/admin/overview` | Counts, the latest saved round, the latest TTC-vs-1:1 comparison, the latest trace. |
| GET | `/api/admin/requests` | Every request with its chain, if any. |
| POST | `/api/admin/match-runs` | Body `{algorithm: "ttc", dry_run: false}`. Runs a round and returns the summary and trace. |
| POST | `/api/admin/compare` | Dry-runs TTC and 1:1-only on the current pool at the same moment. |
| POST | `/api/admin/cycles/{id}/approve` | Approve a chain everyone confirmed; seats change hands. |
| GET | `/api/admin/export.csv` | Download all requests as a spreadsheet file. |

## Errors

Every error has the same shape, so the pages can show a clear message:

```json
{"error": "own_room", "message": "You can't rank the room you already live in."}
```

| Status | Meaning | Example codes |
|---|---|---|
| 400 | The request breaks a rule | `empty_list`, `too_many`, `duplicate_room`, `own_room`, `unknown_room`, `wrong_hostel_gender`, `pairwise_must_be_dry_run` |
| 401 | Not logged in, or wrong password | `not_logged_in`, `bad_credentials` |
| 403 | Logged in, but not allowed | `forbidden`, `wrong_role`, `not_member` |
| 404 | Doesn't exist | `no_request`, `no_cycle` |
| 409 | Not possible right now | `already_active`, `in_cycle`, `no_seat`, `cycle_closed`, `already_answered`, `not_confirmed`, `run_in_progress` |
| 422 | The body has the wrong shape | `invalid_input` |
