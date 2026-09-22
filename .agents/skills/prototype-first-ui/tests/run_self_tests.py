#!/usr/bin/env python3
"""End-to-end self-tests for the prototype-first-ui Skill package."""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import sys
import tempfile
import traceback
from typing import Callable, Dict, List, Optional, Sequence
import zipfile

SKILL = Path(__file__).resolve().parent.parent
SCRIPTS = SKILL / "scripts"
PYTHON = sys.executable
BASE_ENV = dict(
    os.environ,
    PYTHONDONTWRITEBYTECODE="1",
    GIT_TERMINAL_PROMPT="0",
    GIT_CONFIG_COUNT="2",
    GIT_CONFIG_KEY_0="commit.gpgsign",
    GIT_CONFIG_VALUE_0="false",
    GIT_CONFIG_KEY_1="tag.gpgsign",
    GIT_CONFIG_VALUE_1="false",
)


class CommandError(AssertionError):
    pass


def run(
    command: Sequence[str],
    *,
    cwd: Optional[Path] = None,
    expect: int = 0,
    env: Optional[Dict[str, str]] = None,
) -> subprocess.CompletedProcess[str]:
    merged = dict(BASE_ENV)
    if env:
        merged.update(env)
    if os.environ.get("PUI_TEST_TRACE") == "1":
        print("TRACE RUN: %s" % " ".join(str(value) for value in command), flush=True)
    result = subprocess.run(
        list(command),
        cwd=str(cwd) if cwd else None,
        env=merged,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
        timeout=45,
    )
    if result.returncode != expect:
        raise CommandError(
            "Command returned %d, expected %d:\n%s\n--- stdout ---\n%s\n--- stderr ---\n%s"
            % (result.returncode, expect, " ".join(command), result.stdout, result.stderr)
        )
    return result


def run_fail(command: Sequence[str], *, cwd: Optional[Path] = None) -> subprocess.CompletedProcess[str]:
    if os.environ.get("PUI_TEST_TRACE") == "1":
        print("TRACE RUN-FAIL: %s" % " ".join(str(value) for value in command), flush=True)
    result = subprocess.run(
        list(command),
        cwd=str(cwd) if cwd else None,
        env=BASE_ENV,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
        timeout=45,
    )
    if result.returncode == 0:
        raise CommandError("Command unexpectedly succeeded: %s" % " ".join(command))
    return result


def git(repo: Path, *args: str, expect: int = 0) -> subprocess.CompletedProcess[str]:
    return run(["git", "-C", str(repo), *args], expect=expect)


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def write_json(path: Path, value: object) -> None:
    write(path, json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def assert_true(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def init_repo(repo: Path) -> None:
    repo.mkdir(parents=True)
    run(["git", "init", "-b", "main", str(repo)])
    git(repo, "config", "user.name", "Prototype Test")
    git(repo, "config", "user.email", "prototype@example.invalid")


def valid_inventory(method: str = "rendered-dom") -> Dict[str, object]:
    return {
        "schemaVersion": 1,
        "profile": "operational-strict",
        "capture": {
            "method": method,
            "sources": ["dom-content.json"],
            "capturedAt": "2026-08-29T00:00:00Z",
            "surfaces": [{"source": "dom-content.json", "url": "http://127.0.0.1/"}],
            "limitations": [],
        },
        "briefSources": [],
        "approvedCopySources": [],
        "items": [
            {
                "id": "content-upload",
                "text": "Upload",
                "channels": ["text", "aria-label"],
                "locations": ["button#upload"],
                "visibility": ["visible"],
                "captures": ["dom-content.json"],
                "purpose": "user-action",
                "origin": "production-behavior",
                "decision": "allow",
                "evidence": {"source": "src/actions.ts", "reference": "upload action"},
                "flags": [],
                "notes": None,
            }
        ],
    }


def test_content_audit() -> str:
    with tempfile.TemporaryDirectory(prefix="pui-content-") as raw:
        root = Path(raw)
        capture = {
            "schemaVersion": 1,
            "generator": "prototype-first-ui/collect_dom_content.js",
            "capturedAt": "2026-08-29T00:00:00Z",
            "page": {
                "url": "http://127.0.0.1:8000/",
                "title": "Objects",
                "language": "en",
                "viewport": {"width": 1280, "height": 800, "devicePixelRatio": 1},
            },
            "items": [
                {"text": "Upload", "channel": "text", "location": "button#upload", "visibility": "visible"},
                {"text": "Upload", "channel": "aria-label", "location": "button#upload", "visibility": "visible"},
                {"text": "No objects", "channel": "text", "location": "main", "visibility": "visible"},
                {
                    "text": "Built for independent developers",
                    "channel": "text",
                    "location": "header p",
                    "visibility": "visible",
                },
                {
                    "text": "object-browser",
                    "channel": "data-*",
                    "location": "main[data-screen-id]",
                    "visibility": "visible",
                },
            ],
            "limitations": ["Only the current state is captured."],
        }
        capture_path = root / "capture.json"
        brief_path = root / "brief.txt"
        inventory_path = root / "content-inventory.json"
        write_json(capture_path, capture)
        write(brief_path, "Design a private object browser built for independent developers.")

        run(
            [
                PYTHON,
                str(SCRIPTS / "content_audit.py"),
                "seed",
                "--capture",
                str(capture_path),
                "--profile",
                "operational-strict",
                "--brief-file",
                str(brief_path),
                "--output",
                str(inventory_path),
            ]
        )
        inventory = json.loads(inventory_path.read_text(encoding="utf-8"))
        assert_true(len(inventory["items"]) == 4, "Duplicate visible/ARIA strings should be grouped")
        by_text = {item["text"]: item for item in inventory["items"]}
        assert_true("brief-overlap" in by_text["Built for independent developers"]["flags"], "Brief leak was not flagged")
        assert_true("promotional-language" in by_text["Built for independent developers"]["flags"], "Promotional copy was not flagged")

        classifications = {
            "Upload": ("user-action", "production-behavior", {"source": "src/actions.ts", "reference": "upload"}),
            "No objects": ("empty-state", "production-behavior", {"source": "src/state.ts", "reference": "empty"}),
            "object-browser": ("machine-identifier", "production-domain", None),
            "Built for independent developers": ("approved-product-copy", "task-brief", None),
        }
        for item in inventory["items"]:
            purpose, origin, evidence = classifications[item["text"]]
            item.update({"purpose": purpose, "origin": origin, "decision": "allow", "evidence": evidence})
        write_json(inventory_path, inventory)
        failed = run_fail([PYTHON, str(SCRIPTS / "content_audit.py"), "check", "--inventory", str(inventory_path)])
        assert_true("prohibited origin" in failed.stderr or "not allowed" in failed.stderr, "Bad copy should fail content check")

        inventory["items"] = [item for item in inventory["items"] if item["text"] != "Built for independent developers"]
        write_json(inventory_path, inventory)
        run([PYTHON, str(SCRIPTS / "content_audit.py"), "check", "--inventory", str(inventory_path)])

        upload_item = next(item for item in inventory["items"] if item["text"] == "Upload")
        upload_item["origin"] = "unknown"
        write_json(inventory_path, inventory)
        unknown = run_fail([PYTHON, str(SCRIPTS / "content_audit.py"), "check", "--inventory", str(inventory_path)])
        assert_true("origin is unknown" in unknown.stderr, "Unknown origin should block final content sign-off")
        upload_item["origin"] = "production-behavior"
        write_json(inventory_path, inventory)
        run([PYTHON, str(SCRIPTS / "content_audit.py"), "check", "--inventory", str(inventory_path)])

        source = root / "source"
        write(source / "index.html", '<main data-screen-id="object-browser"><button aria-label="Upload">Upload</button></main>')
        static_capture = root / "static.json"
        static_inventory = root / "static-inventory.json"
        run([PYTHON, str(SCRIPTS / "content_audit.py"), "static-scan", "--root", str(source), "--output", str(static_capture)])
        run(
            [
                PYTHON,
                str(SCRIPTS / "content_audit.py"),
                "seed",
                "--capture",
                str(static_capture),
                "--profile",
                "operational-strict",
                "--output",
                str(static_inventory),
            ]
        )
        static_data = json.loads(static_inventory.read_text(encoding="utf-8"))
        for item in static_data["items"]:
            if item["text"] == "object-browser":
                item.update({"purpose": "machine-identifier", "origin": "production-domain", "decision": "allow"})
            else:
                item.update({"purpose": "user-action", "origin": "production-behavior", "decision": "allow"})
        write_json(static_inventory, static_data)
        run_fail([PYTHON, str(SCRIPTS / "content_audit.py"), "check", "--inventory", str(static_inventory)])
        run(
            [
                PYTHON,
                str(SCRIPTS / "content_audit.py"),
                "check",
                "--inventory",
                str(static_inventory),
                "--allow-static",
            ]
        )
    return "Rendered inventory grouping, leak flags, strict rejection, and provisional static fallback passed."


def test_bootstrap() -> str:
    with tempfile.TemporaryDirectory(prefix="pui-bootstrap-") as raw:
        root = Path(raw)
        repo = root / "repo"
        snapshot = root / "snapshot"
        init_repo(repo)
        write(repo / ".gitignore", "node_modules/\n")
        write(repo / "README.md", "baseline\n")
        write(repo / "build" / "source.txt", "tracked source despite generated-looking directory\n")
        git(repo, "add", "-A")
        git(repo, "commit", "-m", "old history")
        old_head = git(repo, "rev-parse", "HEAD").stdout.strip()

        write(repo / "README.md", "dirty working tree\n")
        (repo / "staged.bin").write_bytes(bytes(range(256)))
        git(repo, "add", "staged.bin")
        write(repo / "new.txt", "untracked\n")
        write(repo / "build" / "untracked-source.txt", "must survive exclusion\n")
        write(repo / "node_modules" / "ignored.txt", "regenerable\n")
        write(repo / ".env", "LOCAL_SECRET=preserved-only-in-local-recovery\n")
        symlink_created = False
        try:
            os.symlink("README.md", repo / "readme-link")
            symlink_created = True
        except (OSError, NotImplementedError):
            pass
        git(repo, "remote", "add", "origin", "https://user:secret@example.com/repo.git?token=x#fragment")

        run(
            [
                PYTHON,
                str(SCRIPTS / "bootstrap.py"),
                "snapshot",
                "--repo",
                str(repo),
                "--output",
                str(snapshot),
            ]
        )
        run(
            [
                PYTHON,
                str(SCRIPTS / "bootstrap.py"),
                "verify-snapshot",
                "--repo",
                str(repo),
                "--snapshot-dir",
                str(snapshot),
            ]
        )
        metadata_text = (snapshot / "metadata.json").read_text(encoding="utf-8")
        assert_true("user:secret" not in metadata_text and "token=x" not in metadata_text, "Remote credentials were not redacted")
        metadata = json.loads(metadata_text)
        assert_true(metadata["remotesRedacted"][0]["fetch"] == "https://example.com/repo.git", "Unexpected redacted remote")
        assert_true((snapshot / "history.bundle").is_file(), "History bundle missing")
        assert_true((snapshot / "working-tree.patch").is_file(), "Working tree patch missing")
        assert_true((snapshot / "index.patch").is_file(), "Index patch missing")
        assert_true((snapshot / "VERIFIED.json").is_file(), "Verified marker missing")
        if os.name != "nt":
            assert_true(stat.S_IMODE(snapshot.stat().st_mode) == 0o700, "Snapshot directory should be owner-only")
            for protected_file in ("working-tree.zip", "history.bundle", "metadata.json", "SHA256SUMS", "VERIFIED.json"):
                assert_true(
                    stat.S_IMODE((snapshot / protected_file).stat().st_mode) == 0o600,
                    "%s should be owner-readable/writable only" % protected_file,
                )
        bundle_heads = run(["git", "bundle", "list-heads", str(snapshot / "history.bundle")]).stdout
        assert_true(old_head in bundle_heads, "Old HEAD not recoverable from bundle")

        with zipfile.ZipFile(snapshot / "working-tree.zip") as archive:
            names = set(archive.namelist())
            assert_true("README.md" in names, "Tracked file missing from archive")
            assert_true("build/source.txt" in names, "Tracked file under generated-looking directory was lost")
            assert_true("build/untracked-source.txt" in names, "Non-ignored untracked file under generated-looking directory was lost")
            assert_true("new.txt" in names and ".env" in names, "Working tree files missing")
            assert_true("node_modules/ignored.txt" not in names, "Ignored generated dependency should be omitted")
            assert_true(not any(name == ".git" or name.startswith(".git/") for name in names), ".git leaked into working archive")
            if symlink_created:
                info = archive.getinfo("readme-link")
                mode = info.external_attr >> 16
                assert_true(stat.S_ISLNK(mode), "Symlink was followed instead of archived as a link")

        tampered = root / "tampered"
        shutil.copytree(snapshot, tampered)
        with (tampered / "working-tree.zip").open("ab") as handle:
            handle.write(b"tamper")
        run_fail(
            [
                PYTHON,
                str(SCRIPTS / "bootstrap.py"),
                "verify-snapshot",
                "--repo",
                str(repo),
                "--snapshot-dir",
                str(tampered),
            ]
        )

        stale_repo = root / "stale-repo"
        stale_snapshot = root / "stale-snapshot"
        init_repo(stale_repo)
        write(stale_repo / "file.txt", "one\n")
        git(stale_repo, "add", "-A")
        git(stale_repo, "commit", "-m", "one")
        run([PYTHON, str(SCRIPTS / "bootstrap.py"), "snapshot", "--repo", str(stale_repo), "--output", str(stale_snapshot)])
        write(stale_repo / "file.txt", "two\n")
        git(stale_repo, "add", "-A")
        git(stale_repo, "commit", "-m", "two")
        stale = run_fail(
            [
                PYTHON,
                str(SCRIPTS / "bootstrap.py"),
                "init",
                "--repo",
                str(stale_repo),
                "--snapshot-dir",
                str(stale_snapshot),
                "--yes-reset-history",
            ]
        )
        assert_true("HEAD changed" in stale.stderr, "A stale history bundle should block reset")
        assert_true((stale_repo / ".git").is_dir(), "Stale-snapshot refusal was destructive")

        result = run_fail(
            [
                PYTHON,
                str(SCRIPTS / "bootstrap.py"),
                "init",
                "--repo",
                str(repo),
                "--snapshot-dir",
                str(snapshot),
                "--branch",
                "main",
                "--commit",
            ]
        )
        assert_true("--yes-reset-history" in result.stderr, "Explicit reset flag was not enforced")
        assert_true((repo / ".git").is_dir(), "Failed reset attempt removed .git")

        run(
            [
                PYTHON,
                str(SCRIPTS / "bootstrap.py"),
                "scaffold",
                "--repo",
                str(repo),
                "--project-name",
                "Test App",
                "--project-slug",
                "test-app",
                "--surface-type",
                "operational",
                "--content-profile",
                "operational-strict",
            ]
        )
        assert_true("Test App" in (repo / "AGENTS.md").read_text(encoding="utf-8"), "Scaffold replacement failed")

        readonly_metadata = repo / ".git" / "readonly-test"
        write(readonly_metadata, "Read-only Git metadata must not block an authorized reset.\n")
        readonly_metadata.chmod(stat.S_IREAD)

        run(
            [
                PYTHON,
                str(SCRIPTS / "bootstrap.py"),
                "init",
                "--repo",
                str(repo),
                "--snapshot-dir",
                str(snapshot),
                "--branch",
                "main",
                "--yes-reset-history",
                "--commit",
            ]
        )
        assert_true(git(repo, "rev-list", "--count", "HEAD").stdout.strip() == "1", "New history must have one root commit")
        assert_true(git(repo, "remote").stdout.strip() == "", "Remote was reattached")
        assert_true(git(repo, "branch", "--show-current").stdout.strip() == "main", "Wrong branch")
        assert_true(git(repo, "config", "--local", "--get", "user.name").stdout.strip() == "Prototype Test", "Local identity not preserved")
        old_object = subprocess.run(
            ["git", "-C", str(repo), "cat-file", "-e", old_head],
            env=BASE_ENV,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
            timeout=45,
        )
        assert_true(old_object.returncode != 0, "Old commit unexpectedly remains in new object database")

        sub_repo = root / "submodule-repo"
        sub_snapshot = root / "submodule-snapshot"
        init_repo(sub_repo)
        write(sub_repo / "file.txt", "x\n")
        write(
            sub_repo / ".gitmodules",
            '[submodule "vendor/example"]\n\tpath = vendor/example\n\turl = https://example.invalid/vendor.git\n',
        )
        git(sub_repo, "add", "-A")
        git(sub_repo, "commit", "-m", "submodule declaration")
        run([PYTHON, str(SCRIPTS / "bootstrap.py"), "snapshot", "--repo", str(sub_repo), "--output", str(sub_snapshot)])
        refused = run_fail(
            [
                PYTHON,
                str(SCRIPTS / "bootstrap.py"),
                "init",
                "--repo",
                str(sub_repo),
                "--snapshot-dir",
                str(sub_snapshot),
                "--yes-reset-history",
            ]
        )
        assert_true("submodules" in refused.stderr.lower(), "Submodule reset was not refused")
        assert_true((sub_repo / ".git").is_dir(), "Submodule refusal was destructive")

        work_repo = root / "worktree-repo"
        linked = root / "linked-worktree"
        work_snapshot = root / "worktree-snapshot"
        init_repo(work_repo)
        write(work_repo / "file.txt", "x\n")
        git(work_repo, "add", "-A")
        git(work_repo, "commit", "-m", "base")
        git(work_repo, "worktree", "add", "-b", "linked", str(linked))
        run([PYTHON, str(SCRIPTS / "bootstrap.py"), "snapshot", "--repo", str(work_repo), "--output", str(work_snapshot)])
        refused = run_fail(
            [
                PYTHON,
                str(SCRIPTS / "bootstrap.py"),
                "init",
                "--repo",
                str(work_repo),
                "--snapshot-dir",
                str(work_snapshot),
                "--yes-reset-history",
            ]
        )
        assert_true("worktrees" in refused.stderr.lower(), "Multiple worktrees were not refused")
    return "Snapshot privacy modes, redaction, archive completeness, tamper/stale detection, explicit authorization, local reset, submodule and worktree refusal passed."


def make_workflow_repo(root: Path) -> tuple[Path, str]:
    repo = root / "workflow-repo"
    init_repo(repo)
    write(repo / "AGENTS.md", "# Agent rules\n")
    write(repo / "docs" / "product" / "constraints.md", "# Constraints\n")
    write(repo / "src" / "app.ts", "export const existing = true;\n")
    git(repo, "add", "-A")
    git(repo, "commit", "-m", "chore: baseline")

    project = repo / "designs" / "app"
    write(project / "index.html", '<button data-component-id="upload">Upload</button>\n')
    write_json(
        project / "_d_meta.json",
        {
            "type": "design",
            "assets": {
                "Main": {
                    "versions": [
                        {
                            "path": "index.html",
                            "createdAt": "2026-08-29T00:00:00Z",
                            "status": "approved",
                        }
                    ]
                }
            },
        },
    )
    write_json(project / "content-inventory.json", valid_inventory())
    write_json(
        project / "ui-contract.json",
        {
            "schemaVersion": 2,
            "project": {"name": "App", "slug": "app", "surfaceType": "operational"},
            "content": {
                "defaultProfile": "operational-strict",
                "inventory": "content-inventory.json",
                "approvedCopySources": [],
            },
            "designSources": None,
            "surfaces": [
                {
                    "id": "object-browser",
                    "contentProfile": "operational-strict",
                    "prototype": {
                        "entry": "index.html",
                        "assetPath": "index.html",
                        "files": ["index.html"],
                        "states": ["ready", "empty", "error"],
                        "stableIds": ["object-browser", "upload"],
                    },
                    "production": {
                        "routeOrWindow": "/objects",
                        "files": [],
                        "interfaces": ["listObjects", "uploadObject"],
                        "tests": [],
                    },
                    "status": "approved",
                }
            ],
        },
    )
    write(repo / "docs" / "ui" / "capabilities.md", "# Capabilities\n")
    git(repo, "add", "designs", "docs/ui")
    git(repo, "commit", "-m", "design: approve object browser")
    return repo, git(repo, "rev-parse", "HEAD").stdout.strip()


def test_workflow_gate() -> str:
    with tempfile.TemporaryDirectory(prefix="pui-workflow-") as raw:
        root = Path(raw)
        repo, design_commit = make_workflow_repo(root)
        project = repo / "designs" / "app"
        run(
            [
                PYTHON,
                str(SCRIPTS / "validate_workflow.py"),
                "structure",
                "--repo",
                str(repo),
                "--project-dir",
                "designs/app",
            ]
        )
        run(
            [
                PYTHON,
                str(SCRIPTS / "validate_workflow.py"),
                "contract",
                "--project-dir",
                str(project),
                "--phase",
                "approved",
                "--asset-path",
                "index.html",
            ]
        )
        run(
            [
                PYTHON,
                str(SCRIPTS / "validate_workflow.py"),
                "approval",
                "--project-dir",
                str(project),
                "--asset-path",
                "index.html",
            ]
        )
        gate = [
            PYTHON,
            str(SCRIPTS / "validate_workflow.py"),
            "implementation-gate",
            "--repo",
            str(repo),
            "--project-dir",
            "designs/app",
            "--asset-path",
            "index.html",
            "--design-commit",
            design_commit,
        ]
        run(gate)

        write(project / "index.html", '<button data-component-id="upload">Upload objects</button>\n')
        git(repo, "add", "designs/app/index.html")
        git(repo, "commit", "-m", "design: unapproved prototype drift")
        drifted = run_fail(gate)
        assert_true("changed after the design commit" in drifted.stderr, "Committed prototype drift should invalidate approval")
        git(repo, "reset", "--hard", design_commit)

        meta = json.loads((project / "_d_meta.json").read_text(encoding="utf-8"))
        meta["assets"]["Main"]["versions"][0]["status"] = "changes-requested"
        write_json(project / "_d_meta.json", meta)
        git(repo, "add", "designs/app/_d_meta.json")
        git(repo, "commit", "-m", "design: revoke prototype approval")
        revoked = run_fail(gate)
        assert_true("not approved" in revoked.stderr, "Current approval-status reversal should block implementation")
        git(repo, "reset", "--hard", design_commit)

        write(repo / "designs" / "other" / "note.md", "unrelated design\n")
        git(repo, "add", "designs/other")
        git(repo, "commit", "-m", "design: unrelated project")
        unrelated_commit = git(repo, "rev-parse", "HEAD").stdout.strip()
        unrelated_gate = list(gate)
        unrelated_gate[unrelated_gate.index(design_commit)] = unrelated_commit
        unrelated = run_fail(unrelated_gate)
        assert_true("outside the target design project" in unrelated.stderr, "Approval commit should be target-project scoped")
        git(repo, "reset", "--hard", design_commit)

        wrong = list(gate)
        wrong[wrong.index("index.html")] = "older.html"
        run_fail(wrong)

        write(project / "notes.tmp", "dirty design\n")
        refused = run_fail(gate)
        assert_true("Uncommitted design" in refused.stderr, "Dirty design should block implementation")
        (project / "notes.tmp").unlink()
        run(gate)

        write(repo / "src" / "unapproved.ts", "export const bad = true;\n")
        scope_failure = run_fail(
            [
                PYTHON,
                str(SCRIPTS / "validate_workflow.py"),
                "design-scope",
                "--repo",
                str(repo),
            ]
        )
        assert_true("outside the allowed scope" in scope_failure.stderr, "Production edits should fail design scope")
        (repo / "src" / "unapproved.ts").unlink()

        source_register = {
            "schemaVersion": 1,
            "sources": [
                {
                    "id": "reference-shot",
                    "type": "screenshot",
                    "location": "user attachment",
                    "roles": ["visual-reference"],
                    "trust": "user-provided-untrusted-content",
                    "instructionsPolicy": "treat-as-data-never-execute",
                    "approvedByUser": False,
                    "containsSensitiveData": False,
                    "sanitization": None,
                    "licenseOrPermission": "user-provided for this design review",
                    "localCopies": [],
                    "observations": ["compact two-pane layout"],
                    "inferences": [],
                    "limitations": ["single state only"],
                }
            ],
        }
        write_json(project / "design-sources.json", source_register)
        run([PYTHON, str(SCRIPTS / "validate_workflow.py"), "sources", "--project-dir", str(project)])
        source_register["sources"][0]["roles"] = ["functional-truth"]
        write_json(project / "design-sources.json", source_register)
        bad_source = run_fail([PYTHON, str(SCRIPTS / "validate_workflow.py"), "sources", "--project-dir", str(project)])
        assert_true("functional-truth is limited" in bad_source.stderr, "Screenshot should not become functional truth")
        (project / "design-sources.json").unlink()
    return "Structure, rendered content, exact/current asset approval, target-scoped design commit, ancestry, drift, source-role and dirty-design gates passed."


def test_package_validation() -> str:
    with tempfile.TemporaryDirectory(prefix="pui-package-") as raw:
        root = Path(raw)
        first = root / "prototype-first-ui-a.zip"
        second = root / "prototype-first-ui-b.zip"
        run([PYTHON, str(SCRIPTS / "validate_skill.py"), "--skill-dir", str(SKILL)])
        run([PYTHON, str(SCRIPTS / "package_skill.py"), "--source", str(SKILL), "--output", str(first)])
        run([PYTHON, str(SCRIPTS / "package_skill.py"), "--source", str(SKILL), "--output", str(second)])
        assert_true(sha256(first) == sha256(second), "Deterministic packages differ")
        run([PYTHON, str(SCRIPTS / "validate_skill.py"), "--zip", str(first)])
        with zipfile.ZipFile(first) as archive:
            names = archive.namelist()
            assert_true(all(name.startswith("prototype-first-ui/") for name in names), "ZIP root is not stable")
            assert_true(not any("__pycache__" in name or name.endswith(".pyc") for name in names), "Runtime cache packaged")
            assert_true("prototype-first-ui/SKILL.md" in names, "SKILL.md missing from package")
            assert_true(archive.testzip() is None, "ZIP CRC failed")
    return "Agent Skill structure validation, JavaScript/Python syntax checks, ZIP CRC, root layout, cache exclusion and deterministic packaging passed."


def test_javascript_syntax() -> str:
    node = shutil.which("node")
    if not node:
        return "Node.js unavailable; JavaScript syntax validation skipped (reported, not claimed)."
    run([node, "--check", str(SCRIPTS / "collect_dom_content.js")])
    return "DOM collector JavaScript syntax passed under Node.js; live browser DOM behavior remains a separate integration check."


TESTS: List[tuple[str, Callable[[], str]]] = [
    ("content-audit", test_content_audit),
    ("bootstrap-safety", test_bootstrap),
    ("workflow-gates", test_workflow_gate),
    ("package-validation", test_package_validation),
    ("javascript-syntax", test_javascript_syntax),
]


def run_named_case(name: str) -> tuple[str, str, float]:
    mapping = dict(TESTS)
    started = dt.datetime.now(dt.timezone.utc)
    try:
        detail = mapping[name]()
        status = "passed"
        print("PASS %s: %s" % (name, detail), flush=True)
    except Exception as exc:  # noqa: BLE001 - report the complete test failure
        status = "failed"
        detail = "%s: %s" % (type(exc).__name__, exc)
        print("FAIL %s: %s" % (name, detail), file=sys.stderr, flush=True)
        traceback.print_exc()
    duration = (dt.datetime.now(dt.timezone.utc) - started).total_seconds()
    return status, detail, round(duration, 3)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--case", choices=[name for name, _ in TESTS], required=True)
    parser.add_argument("--case-result")
    args = parser.parse_args()

    status, detail, duration = run_named_case(args.case)
    if args.case_result:
        write_json(
            Path(args.case_result).resolve(),
            {"name": args.case, "status": status, "detail": detail, "durationSeconds": duration},
        )
    return 0 if status == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
