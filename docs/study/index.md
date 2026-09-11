# Study guide: how to use it

This guide is for the four of us, so we can each explain our part of CampusSwap and
answer the examiner's questions without looking anything up.

## Who owns what

Pick one role each. Your role is the part you must be able to explain line by line;
everyone must know the [whole-system overview](overview.md).

| Role | Owns | Page |
|---|---|---|
| **P1: Frontend** | The four pages, their JavaScript, the Tailwind build, what users see | [P1 Frontend](p1-frontend.md) |
| **P2: Backend and login** | FastAPI routes, login and sessions, request rules, confirm / decline / approve | [P2 Backend](p2-backend.md) |
| **P3: Matching engine** | Top Trading Cycles, the 1:1 comparison, Match Yield, engine tests | [P3 Engine](p3-engine.md) |
| **P4: Data, diagrams and delivery** | Database tables, demo data, the UML diagrams, CI, docs site, the report | [P4 Data and delivery](p4-data-diagrams-delivery.md) |

Write your name next to a role in your journal so it's on record.

## How to prepare (about 2 hours each)

1. Read the [overview](overview.md) twice. Say the 30-second pitch out loud.
2. Read your own role page. Open every file it mentions and find the lines it describes.
3. Run the app and do the [3-minute demo](../getting-started.md#the-3-minute-lab-demo) yourself once.
4. Pair up and quiz each other from the [question bank](viva-questions.md). Answer in
   your own words; don't recite.
5. Read one other person's page, so that if they're absent you can cover the basics.

## How to answer in the viva

- **Start with the plain idea, then the detail.** "TTC finds loops of students who all
  want the next person's room. In code, that's `top_trading_cycles()` in `engine/ttc.py`."
- **Point at real things:** a file, a test, a diagram. It shows the work is yours.
- **If you don't know, say so**, then say where you'd look. Never invent an answer.
- **Know what's not built.** Saying "that's Phase 2, here's why" is a strong answer.
  See [Limitations](../limitations.md).
