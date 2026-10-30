#!/usr/bin/env python3
"""Audit real browser text boxes with gxkit's gxcore.layout invariants.

Input is emitted by Chromium Playwright from actual DOM geometry and the 2D
Canvas placement engine; this is not a docgx synthetic slide approximation.
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

from gxcore.layout import TextBox, check as check_layout

EXPECTED = {"2d:galaxy-systems", "2d:galaxy-hybrid", "3d:galaxy"}


def inspect(payload: dict) -> list[dict]:
    if payload.get("contract") != 1 or not isinstance(payload.get("surfaces"), list):
        raise ValueError("visual layout evidence must use contract=1 with surfaces")
    names = [surface.get("name") for surface in payload["surfaces"]]
    if len(names) != len(EXPECTED) or set(names) != EXPECTED:
        raise ValueError(f"expected exactly {sorted(EXPECTED)}, got {names}")
    problems: list[dict] = []
    for surface in payload["surfaces"]:
        name = surface["name"]
        width, height = surface.get("width"), surface.get("height")
        if not all(isinstance(x, (float, int)) and math.isfinite(x) and x > 0 for x in (width, height)):
            raise ValueError(f"{name}: invalid surface size")
        raw_boxes = surface.get("boxes")
        if not isinstance(raw_boxes, list) or not raw_boxes:
            raise ValueError(f"{name}: no observed text boxes (cannot silently pass)")
        boxes = []
        for index, item in enumerate(raw_boxes):
            coords = item.get("bbox")
            text = item.get("text")
            size = item.get("fontSize")
            if not isinstance(text, str) or not text.strip():
                raise ValueError(f"{name}: box {index} missing text")
            if (not isinstance(coords, list) or len(coords) != 4
                or any(not isinstance(n, (int, float)) or not math.isfinite(n) for n in coords)
                or coords[0] >= coords[2] or coords[1] >= coords[3]):
                raise ValueError(f"{name}: box {index} has invalid geometry")
            if not isinstance(size, (int, float)) or not math.isfinite(size) or size <= 0:
                raise ValueError(f"{name}: box {index} has invalid font size")
            boxes.append(TextBox(item.get("role", "label"), text, tuple(coords), size))
        for finding in check_layout(boxes, (0.0, 0.0, float(width), float(height)),
                                    target=name, overlap_fraction=0.35, tol=2.0, surface=name):
            problems.append(finding.as_dict())
    return problems


def self_test() -> None:
    surface = lambda name, boxes: {"name": name, "width": 100, "height": 100, "boxes": boxes}
    box = lambda text, rect: {"text": text, "role": "label", "fontSize": 12, "bbox": rect}
    clean = box("A", [10, 10, 20, 20])
    payload = {"contract": 1, "surfaces": [
        surface("2d:galaxy-systems", [clean]),
        surface("2d:galaxy-hybrid", [clean]),
        surface("3d:galaxy", [clean]),
    ]}
    assert inspect(payload) == []
    payload["surfaces"][1]["boxes"].append(box("B", [12, 12, 22, 22]))
    assert any(p["code"] == "text-overlap" for p in inspect(payload))
    payload["surfaces"][1]["boxes"].pop()
    payload["surfaces"][2]["boxes"] = [box("clipped", [91, 10, 108, 20])]
    assert any(p["code"] == "clipped-text" for p in inspect(payload))
    payload["surfaces"][2]["boxes"] = []
    try:
        inspect(payload)
    except ValueError:
        pass
    else:
        raise AssertionError("missing evidence must fail closed")
    print("gxkit visual checker: clean, overlap, clipping and missing-data self-tests PASS")


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "--self-test":
        self_test()
    elif len(sys.argv) == 2:
        try:
            source = Path(sys.argv[1])
            report = inspect(json.loads(source.read_text(encoding="utf-8")))
        except (OSError, ValueError, TypeError, KeyError) as error:
            print(f"gxkit visual checker: invalid evidence: {error}", file=sys.stderr)
            sys.exit(2)
        print(json.dumps({"errors": sum(item["severity"] == "error" for item in report),
                          "problems": report}, ensure_ascii=False, indent=2))
        if any(item["severity"] == "error" for item in report):
            sys.exit(1)
    else:
        print("usage: inspect-gxkit-visual.py --self-test | layout.json", file=sys.stderr)
        sys.exit(2)
