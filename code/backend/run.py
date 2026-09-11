"""Start CampusSwap on this computer.

    python code/backend/run.py            # keep existing data (loads demo data the first time)
    python code/backend/run.py --reset    # wipe the database and reload fresh demo data

Then open http://127.0.0.1:8000 (API docs at /docs).
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import uvicorn  # noqa: E402

from app.db import DEFAULT_DB_PATH  # noqa: E402
from app.main import create_app  # noqa: E402
from seed import seed  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the CampusSwap prototype locally.")
    parser.add_argument("--reset", action="store_true", help="delete the database and load fresh demo data")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    if args.reset:
        DEFAULT_DB_PATH.unlink(missing_ok=True)
    fresh = not DEFAULT_DB_PATH.exists()
    app = create_app()
    if fresh:
        with app.state.session_factory() as db:
            seed(db)
        print(f"Loaded demo data into {DEFAULT_DB_PATH.name} (password for every demo account: campus123)")
    print(f"CampusSwap running at http://{args.host}:{args.port}   API docs: http://{args.host}:{args.port}/docs")
    uvicorn.run(app, host=args.host, port=args.port)


if __name__ == "__main__":
    main()
