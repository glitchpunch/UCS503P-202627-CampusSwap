# P2: Backend and login

You own the server: the routes, login, and every rule about requests and swaps.

## Your files

| File | What it does |
|---|---|
| `code/backend/app/main.py` | `create_app()`: connects routes, error handlers and the pages |
| `app/routers/auth.py` | Login, logout, `me`, `status` |
| `app/routers/student.py`, `admin.py`, `public.py` | The other endpoints (see [API](../api.md)) |
| `app/deps.py` | Shared helpers: database session, current time, `current_student`, `current_admin` |
| `app/security.py` | Password hashing and session tokens |
| `app/errors.py` | `DomainError(status, code, message)` |
| `app/services/requests.py` | Submit and withdraw rules |
| `app/services/cycles.py` | Accept, decline, approve, deadline expiry |
| `code/backend/run.py` | One-command start |

## The path of one request

`POST /api/requests` → FastAPI checks the body shape (`schemas.RequestIn`) → `deps.current_student`
finds the session from the cookie → `routers/student.create_request` calls
`services.requests.submit_request` → rules pass → rows added → the route calls `db.commit()`
→ JSON back. If a rule fails, the service raises `DomainError`; `main.py` turns it into
`{"error": code, "message": ...}` with the right status. Nothing was committed, so nothing is saved.

## Login and sessions

- **Passwords** are stored as `scrypt$salt$hash`. `scrypt` is deliberately slow and
  salted, so leaked hashes are hard to crack. `verify_password` compares with
  `hmac.compare_digest`, which takes the same time whether or not the guess is close.
- **Session:** on login we create a random token (`secrets.token_urlsafe(32)`), store only
  its SHA-256 in `login_sessions`, and send the token in the `cs_session` cookie
  (HttpOnly, SameSite=Lax, 12 hours).
- **Unknown email and wrong password both answer "Wrong email or password"**, and take
  about the same time (a dummy hash check), so nobody can discover which emails exist.
- **Roles:** `current_student` / `current_admin` return 403 for the wrong role. The server
  enforces this, not just the page.

## The rules you must know

Submit (`submit_request`): 1 to 5 rooms; no duplicates; not your own room; the room must
exist; the hostel must match your gender; you need a room; only one active request.
Withdraw: only while `open` (once matched, you decline instead).

Confirmation (`cycles.py`):

- Everyone accepts → cycle `confirmed`.
- Anyone declines → cycle `dissolved`; the decliner's request is `withdrawn`, everyone else
  goes back to `open`.
- The 48-hour deadline passes → `dissolved`; people who never answered are withdrawn, those
  who accepted go back to the pool. This check (`expire_overdue`) runs at the start of every
  round and every answer.
- Approve (warden): only `confirmed` cycles. It empties all the chain's seats first, then
  refills them, because a seat may only have one occupant at a time.

## Questions you may get

**Why FastAPI?** Short, readable code, automatic input checking, and a free interactive
API page at `/docs`, which is handy for demos and testing.

**Where are passwords stored?** Nowhere in plain form: only a salted `scrypt` hash.

**What stops a student calling admin endpoints directly?** `current_admin` in `deps.py`
returns 403 for any non-admin, whatever page they use.

**What if two wardens press Run at the same time?** A lock in `matching.py` lets only one
round run; the second gets `409 run_in_progress`.

**What if the server crashes halfway through a round?** Nothing is committed until the end,
so the database keeps the state from before the round (one transaction).

**Is it safe against cross-site request forgery (a malicious site making your browser send
requests)?** Partly: the cookie is `SameSite=Lax`, so other sites can't send it with a POST.
A dedicated CSRF token would be the next step (see Limitations).

## If the demo breaks

- `address already in use` → another server is running; stop it or use `--port 8001`.
- Strange data → restart with `run.py --reset` to reload the demo data.
- Check `/docs`: if it loads, the server is fine.
