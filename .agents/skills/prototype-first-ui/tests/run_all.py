#!/usr/bin/env python3
"""Run prototype-first-ui self-tests in isolated child process groups."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import tempfile
import time
from typing import Dict, List, Sequence, Tuple

SCRIPT_DIR = Path(__file__).resolve().parent
CASE_RUNNER = SCRIPT_DIR / "run_self_tests.py"
REPORT_WRITER = SCRIPT_DIR / "write_report.py"
CASES = [
    "content-audit",
    "workflow-gates",
    "package-validation",
    "javascript-syntax",
    "bootstrap-safety",
]


def process_kwargs() -> Dict[str, object]:
    kwargs: Dict[str, object] = {
        "cwd": str(SCRIPT_DIR.parent),
        "env": dict(os.environ, PYTHONDONTWRITEBYTECODE="1", GIT_TERMINAL_PROMPT="0"),
        "text": True,
        "stdout": subprocess.PIPE,
        "stderr": subprocess.PIPE,
    }
    if os.name == "nt":
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP  # type: ignore[attr-defined]
    else:
        kwargs["start_new_session"] = True
    return kwargs


def kill_process_tree(process: subprocess.Popen[str]) -> None:
    """Kill the child and descendants without optional third-party packages."""
    if process.poll() is not None:
        return
    if os.name == "nt":
        taskkill = shutil.which("taskkill")
        if taskkill:
            try:
                subprocess.run(
                    [taskkill, "/PID", str(process.pid), "/T", "/F"],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    check=False,
                    timeout=20,
                )
                return
            except (OSError, subprocess.TimeoutExpired):
                pass
        process.kill()
    else:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except (ProcessLookupError, PermissionError):
            process.kill()


def launch_cases(result_dir: Path, python: str) -> List[Tuple[str, Path, subprocess.Popen[str], float]]:
    """Launch every case before waiting, isolating destructive Git subprocesses."""
    children: List[Tuple[str, Path, subprocess.Popen[str], float]] = []
    for name in CASES:
        result_path = result_dir / (name + ".json")
        command: Sequence[str] = [
            python,
            str(CASE_RUNNER),
            "--case",
            name,
            "--case-result",
            str(result_path),
        ]
        process = subprocess.Popen(list(command), **process_kwargs())  # type: ignore[arg-type]
        children.append((name, result_path, process, time.monotonic()))
    return children


def collect_case(
    name: str,
    result_path: Path,
    process: subprocess.Popen[str],
    started: float,
    timeout_seconds: int,
) -> Dict[str, object]:
    remaining = max(0.1, timeout_seconds - (time.monotonic() - started))
    timed_out = False
    try:
        stdout, stderr = process.communicate(timeout=remaining)
    except subprocess.TimeoutExpired:
        timed_out = True
        kill_process_tree(process)
        try:
            stdout, stderr = process.communicate(timeout=10)
        except subprocess.TimeoutExpired:
            stdout, stderr = "", "Child process tree did not close after forced termination."

    if stdout:
        print(stdout, end="" if stdout.endswith("\n") else "\n", flush=True)
    if stderr:
        print(stderr, end="" if stderr.endswith("\n") else "\n", file=sys.stderr, flush=True)

    if timed_out:
        result: Dict[str, object] = {
            "name": name,
            "status": "failed",
            "detail": "Case exceeded the isolated %d-second timeout; its process group was terminated." % timeout_seconds,
            "durationSeconds": timeout_seconds,
        }
    elif result_path.is_file():
        try:
            result = json.loads(result_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            result = {
                "name": name,
                "status": "failed",
                "detail": "Invalid case result file: %s" % exc,
                "durationSeconds": None,
            }
    else:
        result = {
            "name": name,
            "status": "failed",
            "detail": "Case exited with code %d without writing a result file." % process.returncode,
            "durationSeconds": None,
        }

    if process.returncode != 0 and result.get("status") == "passed":
        result["status"] = "failed"
        result["detail"] = "Case reported success but exited with code %d." % process.returncode
    result_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", help="Write the aggregate JSON report to this path")
    parser.add_argument("--case-timeout", type=int, default=180, help="Absolute timeout per case in seconds")
    parser.add_argument("--python", default=sys.executable, help="Python interpreter used for child cases")
    args = parser.parse_args()
    if args.case_timeout < 30:
        parser.error("--case-timeout must be at least 30 seconds")

    with tempfile.TemporaryDirectory(prefix="prototype-first-ui-tests-") as raw:
        result_dir = Path(raw)
        children = launch_cases(result_dir, args.python)
        results = [
            collect_case(name, result_path, process, started, args.case_timeout)
            for name, result_path, process, started in children
        ]
        passed = all(item.get("status") == "passed" for item in results)
        if args.report:
            report_command = [
                args.python,
                str(REPORT_WRITER),
                "--result-dir",
                str(result_dir),
                "--output",
                str(Path(args.report).resolve()),
            ]
            report = subprocess.run(report_command, text=True, check=False, timeout=60)
            if report.returncode != 0:
                passed = False
        if passed:
            print("All isolated self-test cases passed.", flush=True)
        return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
