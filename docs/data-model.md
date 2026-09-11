# Data model

All tables are defined in `code/backend/app/models.py` using SQLAlchemy. The database is a
single SQLite file, `code/backend/campusswap.db`. Times are stored in UTC.

## Tables

| Table | One row is… | Important columns |
|---|---|---|
| `users` | anyone who can log in | `email` (unique), `name`, `password_hash`, `role` (`student` / `admin`); students also have `roll_no`, `gender`, `year`, `branch` |
| `login_sessions` | one signed-in browser | `token_hash` (SHA-256 of the cookie), `user_id`, `expires_at` |
| `hostels` | a hostel | `code`, `name`, `gender` (who may live there), `warden_name` |
| `rooms` | a room | `hostel_id`, `block`, `floor`, `number`, `seater` (1–3 beds), `ac`, `washroom`, `tags` |
| `seats` | one bed in a room | `room_id`, `label` (A/B/C), `occupant_id` (**unique**: one student per bed) |
| `swap_requests` | a student asking to move | `tracking_id`, `student_id`, `seat_id` (the bed they offer), `status` |
| `preferences` | one ranked choice | `request_id`, `rank` (1–5), `room_id`; unique on (request, rank) and (request, room) |
| `match_runs` | one press of Run or Compare | `algorithm`, `dry_run`, `pool_size`, `matched`, `yield_pct`, `first_choice_pct`, `cycles_by_length`, `trace` |
| `swap_cycles` | one chain found by a saved run | `match_run_id`, `status`, `deadline` (48 h after the run) |
| `cycle_members` | one student in a chain | `cycle_id`, `request_id`, `position`, `gives_seat_id`, `receives_seat_id`, `received_rank`, `response` |
| `events` | one line of the audit log | `kind`, `message`, `student_id`, `cycle_id` |

`Student` and `Admin` share the `users` table (*single-table inheritance*). In the class
diagram they are drawn as two classes that inherit from `User`.

## Why seats and not just rooms?

A double room has two students in it. A swap moves one student, not the whole room. So a
student owns a **seat**, and a request offers that seat. Preferences are still for
**rooms**, because students choose rooms, not bed labels.

## How statuses change

### Swap request

| From | Event | To |
|---|---|---|
| — | student submits | `open` |
| `open` | student withdraws | `withdrawn` |
| `open` | a saved round puts it in a chain | `matched` |
| `matched` | the chain is dissolved and this student declined or didn't answer | `withdrawn` |
| `matched` | the chain is dissolved but this student had accepted (or someone else declined) | `open` (back in the pool) |
| `matched` | the warden approves the chain | `completed` |

A student can have only one request that is `open` or `matched` at a time.

### Swap cycle

| From | Event | To |
|---|---|---|
| — | saved TTC round | `proposed` |
| `proposed` | every member accepts | `confirmed` |
| `proposed` | any member declines, or the deadline passes | `dissolved` |
| `confirmed` | the warden approves | `approved` (seats change hands) |

### Cycle member response

`pending` → `accepted` or `declined`. Each member can answer once.

## Rules the database itself enforces

- One occupant per seat (`seats.occupant_id` is unique). That's why approval first empties
  every seat in the chain, then refills them.
- A request can't rank the same room twice or use the same rank twice.
- Foreign keys are switched on for SQLite (`PRAGMA foreign_keys=ON` in `db.py`), so rows
  can't point at things that don't exist.

## Demo data

`code/backend/seed.py` builds 4 hostels (J and M for men, K and N for women), 72 rooms,
one student in every seat, the warden account, and 12 open requests arranged into a known
2-way, 3-way and 4-way chain plus 3 students who can't be matched. All of it is made up.
