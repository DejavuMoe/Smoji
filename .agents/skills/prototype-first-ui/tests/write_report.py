#!/usr/bin/env python3
"""Aggregate isolated prototype-first-ui self-test case results."""

from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path
import shutil
import subprocess
import sys
from typing import Dict, List, Optional

EXPECTED = [
    "content-audit",
    "workflow-gates",
    "package-validation",
    "javascript-syntax",
    "bootstrap-safety",
]

def command_version(command: List[str]) -> Optional[str]:
    if not shutil.which(command[0]):
        return None
    result = subprocess.run(command, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False, timeout=20)
    return (result.stdout or result.stderr).strip() or None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--result-dir", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    result_dir = Path(args.result_dir).resolve()
    results: List[Dict[str, object]] = []
    missing: List[str] = []
    for name in EXPECTED:
        path = result_dir / (name + ".json")
        if not path.is_file():
            missing.append(name)
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        results.append(data)
    passed = not missing and all(item.get("status") == "passed" for item in results)
    report = {
        "schemaVersion": 1,
        "generatedAt": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "python": sys.version.split()[0],
        "git": command_version(["git", "--version"]),
        "node": command_version(["node", "--version"]),
        "skillsRef": shutil.which("skills-ref"),
        "results": results,
        "missing": missing,
        "passed": passed,
        "limitations": [
            "This suite checks DOM collector syntax, not live-browser integration or browser availability.",
            "This suite uses the package validator; a detected skills-ref executable does not mean it was executed.",
            "Natural-language semantic necessity and visual quality remain rendered-review tasks rather than deterministic tests.",
        ],
    }
    output = Path(args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Report: %s" % output)
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
