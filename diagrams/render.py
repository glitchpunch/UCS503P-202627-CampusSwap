"""Render every diagrams/*.puml to PNG and SVG using the public PlantUML server.

    python diagrams/render.py

Only the diagram text is sent (hex-encoded in the URL). No Java needed.
Output goes to diagrams/out/.
"""
from __future__ import annotations

import sys
import urllib.request
from pathlib import Path

SERVER = "https://www.plantuml.com/plantuml"
HERE = Path(__file__).resolve().parent
OUT = HERE / "out"


def fetch(kind: str, source: str) -> bytes:
    url = f"{SERVER}/{kind}/~h{source.encode('utf-8').hex()}"
    request = urllib.request.Request(url, headers={"User-Agent": "campusswap-diagrams"})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def main() -> int:
    OUT.mkdir(exist_ok=True)
    failed = False
    for puml in sorted(HERE.glob("*.puml")):
        source = puml.read_text(encoding="utf-8")
        for kind in ("png", "svg"):
            data = fetch(kind, source)
            target = OUT / f"{puml.stem}.{kind}"
            target.write_bytes(data)
            # The server still returns an image when the diagram has a syntax error; flag it.
            if kind == "svg" and b"Syntax Error" in data:
                failed = True
                print(f"SYNTAX ERROR in {puml.name}")
            print(f"{target.relative_to(HERE.parent)}  {len(data):,} bytes")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
