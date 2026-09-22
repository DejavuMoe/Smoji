#!/usr/bin/env python3
"""Safe helpers for one-time prototype-first repository bootstrap.

Subcommands:
  snapshot         Create an external working-tree archive, metadata, patches,
                   checksums, and a Git bundle when committed refs exist.
  verify-snapshot  Verify repository identity, checksums, archive integrity, and
                   Git bundle integrity.
  scaffold         Copy minimal AGENTS/README/constraint templates.
  init             Remove a normal local .git directory only after explicit
                   authorization and verified external recovery material, then
                   initialize and optionally commit a clean baseline.

The script contains no network operations and never runs git push, remote delete,
remote set-head, or force-update commands.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys
import zipfile
from typing import Dict, Iterable, List, Optional, Sequence, Set, Tuple
from urllib.parse import urlsplit, urlunsplit

SNAPSHOT_SCHEMA = 2
ALWAYS_EXCLUDED_NAMES = {
    ".git",
    "node_modules",
    ".cache",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    ".venv",
    "venv",
    "__pycache__",
}
TOP_LEVEL_GENERATED_NAMES = {
    "target",
    "dist",
    "build",
    "out",
    ".next",
    ".nuxt",
    "coverage",
}
BRANCH_RE = re.compile(r"^(?![./])(?!.*\.\.)(?!.*[@{\\ ~^:?*\[])(?!.*//$)(?!.*\.$).+$")


def run(
    cmd: Sequence[str],
    *,
    cwd: Optional[Path] = None,
    check: bool = True,
) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(
            list(cmd),
            cwd=str(cwd) if cwd else None,
            check=check,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
    except FileNotFoundError as exc:
        raise SystemExit("Required command not found: %s" % cmd[0]) from exc


def git(repo: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return run(["git", "-C", str(repo), *args], check=check)


def git_text(repo: Path, *args: str) -> Optional[str]:
    result = git(repo, *args, check=False)
    if result.returncode != 0:
        return None
    return result.stdout.strip()


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def utc_stamp() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def best_effort_chmod(path: Path, mode: int) -> None:
    try:
        path.chmod(mode)
    except OSError:
        # Windows and some mounted filesystems do not implement POSIX modes. The
        # snapshot still remains local; the caller must protect its location.
        pass


def harden_snapshot_permissions(directory: Path) -> None:
    best_effort_chmod(directory, 0o700)
    for path in directory.rglob("*"):
        if path.is_dir():
            best_effort_chmod(path, 0o700)
        elif path.is_file():
            best_effort_chmod(path, 0o600)


def write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def load_json(path: Path) -> object:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise SystemExit("Missing file: %s" % path) from exc
    except json.JSONDecodeError as exc:
        raise SystemExit("Invalid JSON in %s: %s" % (path, exc)) from exc


def is_within(child: Path, parent: Path) -> bool:
    try:
        child.resolve().relative_to(parent.resolve())
        return True
    except ValueError:
        return False


def ensure_external_path(repo: Path, path: Path) -> None:
    if path.resolve() == repo.resolve() or is_within(path, repo):
        raise SystemExit("Snapshot output must be outside the repository being reset.")


def detect_git_form(repo: Path) -> str:
    dot_git = repo / ".git"
    if dot_git.is_symlink():
        return "symlink"
    if dot_git.is_dir():
        return "directory"
    if dot_git.is_file():
        return "gitfile"
    if git_text(repo, "rev-parse", "--is-bare-repository") == "true":
        return "bare"
    return "none"


def require_repository_root(repo: Path, *, allow_non_git: bool = True) -> None:
    top = git_text(repo, "rev-parse", "--show-toplevel")
    if top is None:
        if allow_non_git:
            return
        raise SystemExit("Not a Git working tree: %s" % repo)
    if Path(top).resolve() != repo.resolve():
        raise SystemExit(
            "Run at the actual repository root. Detected root: %s; requested: %s"
            % (Path(top).resolve(), repo.resolve())
        )


def redact_url(value: str) -> str:
    value = value.strip()
    if not value:
        return value
    if "://" in value:
        parts = urlsplit(value)
        host = parts.hostname or ""
        if ":" in host and not host.startswith("["):
            host = "[%s]" % host
        if parts.port:
            host = "%s:%s" % (host, parts.port)
        return urlunsplit((parts.scheme, host, parts.path, "", ""))
    scp = re.match(r"^(?:[^@/\s]+@)?([^:\s]+):(.*)$", value)
    if scp:
        return "%s:%s" % (scp.group(1), scp.group(2))
    return value


def repository_metadata(repo: Path, excluded: Iterable[str]) -> Dict[str, object]:
    git_form = detect_git_form(repo)
    remotes: List[Dict[str, str]] = []
    names = git_text(repo, "remote") if git_form != "none" else None
    for name in names.splitlines() if names else []:
        fetch = git_text(repo, "remote", "get-url", name) or ""
        push = git_text(repo, "remote", "get-url", "--push", name) or ""
        remotes.append({"name": name, "fetch": redact_url(fetch), "push": redact_url(push)})

    head = git_text(repo, "rev-parse", "HEAD") if git_form != "none" else None
    worktrees = git_text(repo, "worktree", "list", "--porcelain") if git_form != "none" else None
    return {
        "schemaVersion": SNAPSHOT_SCHEMA,
        "createdAt": utc_now(),
        "repository": str(repo.resolve()),
        "repositoryName": repo.name,
        "gitForm": git_form,
        "hadCommits": bool(head),
        "branch": git_text(repo, "branch", "--show-current") if git_form != "none" else None,
        "head": head,
        "statusPorcelain": git_text(repo, "status", "--porcelain=v1", "--untracked-files=all")
        if git_form != "none"
        else None,
        "worktreesPorcelain": worktrees,
        "remotesRedacted": remotes,
        "workingTreeArchiveExcludes": sorted(set(excluded)),
        "remoteMutationPerformed": False,
        "note": (
            "Remote repositories were not modified. URL credentials, query strings, "
            "and fragments were removed from recorded remote locations."
        ),
    }


def git_preserved_paths(repo: Path, git_form: str) -> Set[str]:
    """Return tracked and non-ignored untracked paths that must survive exclusions."""
    if git_form == "none":
        return set()
    result = git(repo, "ls-files", "-z", "--cached", "--others", "--exclude-standard", check=False)
    if result.returncode != 0:
        return set()
    return {value.replace("\\", "/") for value in result.stdout.split("\0") if value}


def protected_prefixes(paths: Set[str]) -> Set[str]:
    prefixes: Set[str] = set()
    for value in paths:
        parts = Path(value).parts
        for index in range(1, len(parts)):
            prefixes.add(Path(*parts[:index]).as_posix())
    return prefixes


def matches_exclusion(relative: Path, user_excluded_names: Set[str]) -> bool:
    parts = relative.parts
    if any(part == ".git" for part in parts):
        return True
    if any(part in ALWAYS_EXCLUDED_NAMES for part in parts):
        return True
    if parts and parts[0] in TOP_LEVEL_GENERATED_NAMES:
        return True
    return any(part in user_excluded_names for part in parts)


def normalized_zip_name(relative: Path) -> str:
    return relative.as_posix()


def add_symlink(archive: zipfile.ZipFile, relative: Path, target: str) -> None:
    info = zipfile.ZipInfo(normalized_zip_name(relative), date_time=(1980, 1, 1, 0, 0, 0))
    info.create_system = 3
    info.compress_type = zipfile.ZIP_DEFLATED
    info.external_attr = (stat.S_IFLNK | 0o777) << 16
    archive.writestr(info, target.encode("utf-8", errors="surrogateescape"))


def create_working_tree_zip(
    repo: Path,
    destination: Path,
    user_excluded_names: Set[str],
    preserved_paths: Set[str],
) -> Tuple[int, int, int]:
    file_count = 0
    symlink_count = 0
    exclusion_override_count = 0
    prefixes = protected_prefixes(preserved_paths)
    with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for root, dirs, files in os.walk(repo, topdown=True, followlinks=False):
            root_path = Path(root)
            rel_root = root_path.relative_to(repo)
            retained_dirs: List[str] = []
            for dirname in dirs:
                relative = rel_root / dirname
                relative_posix = relative.as_posix()
                path = root_path / dirname
                excluded = matches_exclusion(relative, user_excluded_names)
                protected = relative_posix in preserved_paths or relative_posix in prefixes
                if excluded and not protected:
                    continue
                if excluded and protected:
                    exclusion_override_count += 1
                if path.is_symlink():
                    add_symlink(archive, relative, os.readlink(path))
                    file_count += 1
                    symlink_count += 1
                else:
                    retained_dirs.append(dirname)
            dirs[:] = retained_dirs

            for filename in files:
                path = root_path / filename
                relative = path.relative_to(repo)
                relative_posix = relative.as_posix()
                excluded = matches_exclusion(relative, user_excluded_names)
                protected = relative_posix in preserved_paths
                if excluded and not protected:
                    continue
                if excluded and protected:
                    exclusion_override_count += 1
                if path.is_symlink():
                    add_symlink(archive, relative, os.readlink(path))
                    symlink_count += 1
                else:
                    archive.write(path, arcname=normalized_zip_name(relative))
                file_count += 1
    return file_count, symlink_count, exclusion_override_count


def write_checksums(directory: Path) -> None:
    lines: List[str] = []
    for path in sorted(directory.iterdir(), key=lambda item: item.name):
        if not path.is_file() or path.name in {"SHA256SUMS", "VERIFIED.json"}:
            continue
        lines.append("%s  %s" % (sha256_file(path), path.name))
    (directory / "SHA256SUMS").write_text("\n".join(lines) + "\n", encoding="utf-8")


def read_checksums(path: Path) -> List[Tuple[str, str]]:
    entries: List[Tuple[str, str]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            digest, name = line.split("  ", 1)
        except ValueError as exc:
            raise SystemExit("Malformed checksum line in %s: %r" % (path, line)) from exc
        if not re.fullmatch(r"[0-9a-f]{64}", digest) or not name or Path(name).name != name:
            raise SystemExit("Unsafe or invalid checksum entry in %s: %r" % (path, line))
        entries.append((digest, name))
    if not entries:
        raise SystemExit("No checksum entries found in %s" % path)
    return entries


def create_patches(repo: Path, output: Path, metadata: Dict[str, object]) -> None:
    for name, git_args in (
        ("working-tree.patch", ("diff", "--binary")),
        ("index.patch", ("diff", "--cached", "--binary")),
    ):
        result = git(repo, *git_args, check=False)
        if result.returncode not in (0, 1):
            metadata.setdefault("warnings", []).append(
                "%s failed: %s" % (name, result.stderr.strip() or "unknown error")
            )
            continue
        if result.stdout:
            (output / name).write_text(result.stdout, encoding="utf-8")
            metadata.setdefault("patches", []).append(name)


def cmd_snapshot(args: argparse.Namespace) -> int:
    repo = Path(args.repo).expanduser().resolve()
    if not repo.is_dir():
        raise SystemExit("Repository directory does not exist: %s" % repo)
    require_repository_root(repo, allow_non_git=True)

    output = (
        Path(args.output).expanduser().resolve()
        if args.output
        else repo.parent / ("%s-pre-ui-reset-%s" % (repo.name, utc_stamp()))
    )
    ensure_external_path(repo, output)
    output.mkdir(parents=True, exist_ok=False, mode=0o700)
    best_effort_chmod(output, 0o700)

    user_excluded = set(args.exclude or [])
    git_form = detect_git_form(repo)
    preserved = git_preserved_paths(repo, git_form)
    recorded_exclusions = set(ALWAYS_EXCLUDED_NAMES) | set(TOP_LEVEL_GENERATED_NAMES) | user_excluded
    metadata = repository_metadata(repo, recorded_exclusions)
    metadata["userRequestedExcludes"] = sorted(user_excluded)
    metadata["preservedTrackedAndNonIgnoredPathCount"] = len(preserved)
    metadata["archivePolicy"] = (
        "Generated/cache directories are omitted unless they contain a tracked or "
        "non-ignored untracked path; such paths override exclusions. Other ignored "
        "or local files outside excluded directories remain in the local archive."
    )

    archive_path = output / "working-tree.zip"
    file_count, symlink_count, override_count = create_working_tree_zip(
        repo, archive_path, user_excluded, preserved
    )
    metadata["workingTreeArchive"] = archive_path.name
    metadata["workingTreeFileCount"] = file_count
    metadata["workingTreeSymlinkCount"] = symlink_count
    metadata["exclusionOverrideCount"] = override_count

    if metadata.get("hadCommits"):
        bundle_path = output / "history.bundle"
        bundle = git(repo, "bundle", "create", str(bundle_path), "--all", check=False)
        if bundle.returncode != 0:
            shutil.rmtree(output, ignore_errors=True)
            raise SystemExit("Unable to create Git history bundle: %s" % (bundle.stderr.strip() or bundle.stdout.strip()))
        verify = git(repo, "bundle", "verify", str(bundle_path), check=False)
        if verify.returncode != 0:
            shutil.rmtree(output, ignore_errors=True)
            raise SystemExit("Created Git bundle did not verify: %s" % (verify.stderr.strip() or verify.stdout.strip()))
        metadata["gitBundle"] = bundle_path.name

    if metadata.get("gitForm") != "none":
        create_patches(repo, output, metadata)

    write_json(output / "metadata.json", metadata)
    write_checksums(output)
    harden_snapshot_permissions(output)

    print("Snapshot created: %s" % output)
    print("Recovery material may contain secrets or private files; keep the snapshot private.")
    print(
        "Working-tree archive: %s (%d entries, %d symlinks, %d protected exclusion overrides)"
        % (archive_path, file_count, symlink_count, override_count)
    )
    if metadata.get("gitBundle"):
        print("Git history bundle: %s" % (output / str(metadata["gitBundle"])))
    print("Verify with: %s verify-snapshot --repo %s --snapshot-dir %s" % (Path(__file__).name, repo, output))
    return 0


def verify_snapshot(repo: Path, snapshot: Path, *, write_marker: bool) -> Dict[str, object]:
    repo = repo.resolve()
    snapshot = snapshot.resolve()
    ensure_external_path(repo, snapshot)
    if not snapshot.is_dir():
        raise SystemExit("Snapshot directory does not exist: %s" % snapshot)

    metadata_path = snapshot / "metadata.json"
    checksums_path = snapshot / "SHA256SUMS"
    data = load_json(metadata_path)
    if not isinstance(data, dict) or data.get("schemaVersion") != SNAPSHOT_SCHEMA:
        raise SystemExit("Unsupported or invalid snapshot metadata: %s" % metadata_path)
    recorded_repo = Path(str(data.get("repository", ""))).resolve()
    if recorded_repo != repo:
        raise SystemExit("Snapshot belongs to %s, not %s" % (recorded_repo, repo))

    for expected, name in read_checksums(checksums_path):
        path = snapshot / name
        if not path.is_file():
            raise SystemExit("Snapshot file missing: %s" % path)
        actual = sha256_file(path)
        if actual != expected:
            raise SystemExit("Checksum mismatch for %s" % path)

    archive = snapshot / str(data.get("workingTreeArchive", "working-tree.zip"))
    if not archive.is_file():
        raise SystemExit("Working-tree archive missing: %s" % archive)
    with zipfile.ZipFile(archive, "r") as handle:
        bad = handle.testzip()
        if bad:
            raise SystemExit("Corrupt entry in working-tree archive: %s" % bad)

    if data.get("hadCommits"):
        bundle_name = data.get("gitBundle")
        if not isinstance(bundle_name, str):
            raise SystemExit("Snapshot says commits existed but has no Git bundle.")
        bundle = snapshot / bundle_name
        if not bundle.is_file():
            raise SystemExit("Git bundle missing: %s" % bundle)
        verify = git(repo, "bundle", "verify", str(bundle), check=False)
        if verify.returncode != 0:
            # The current repository might no longer be a Git repository. git bundle
            # verify can also run in the snapshot directory with an empty temp repo.
            temp_git = snapshot / ".verify-git"
            temp_git.mkdir(exist_ok=True)
            init = run(["git", "init", "--bare", str(temp_git)], check=False)
            if init.returncode != 0:
                raise SystemExit("Unable to create temporary repository for bundle verification.")
            verify = run(["git", "-C", str(temp_git), "bundle", "verify", str(bundle)], check=False)
            shutil.rmtree(temp_git, ignore_errors=True)
            if verify.returncode != 0:
                raise SystemExit("Git bundle verification failed: %s" % (verify.stderr.strip() or verify.stdout.strip()))

    marker: Dict[str, object] = {
        "schemaVersion": 1,
        "verifiedAt": utc_now(),
        "repository": str(repo),
        "metadataSha256": sha256_file(metadata_path),
        "checksumsSha256": sha256_file(checksums_path),
    }
    if write_marker:
        marker_path = snapshot / "VERIFIED.json"
        write_json(marker_path, marker)
        best_effort_chmod(marker_path, 0o600)
        best_effort_chmod(snapshot, 0o700)
    return marker


def cmd_verify_snapshot(args: argparse.Namespace) -> int:
    repo = Path(args.repo).expanduser().resolve()
    snapshot = Path(args.snapshot_dir).expanduser().resolve()
    marker = verify_snapshot(repo, snapshot, write_marker=True)
    print("Snapshot verification passed: %s" % snapshot)
    print("Verified at: %s" % marker["verifiedAt"])
    return 0


def render_template(text: str, replacements: Dict[str, str]) -> str:
    for key, value in replacements.items():
        text = text.replace("{{%s}}" % key, value)
    return text


def copy_template(source: Path, destination: Path, replacements: Dict[str, str], force: bool) -> bool:
    if destination.exists() and not force:
        print("Keep existing: %s" % destination)
        return False
    destination.parent.mkdir(parents=True, exist_ok=True)
    content = render_template(source.read_text(encoding="utf-8"), replacements)
    destination.write_text(content, encoding="utf-8")
    print("Wrote: %s" % destination)
    return True


def cmd_scaffold(args: argparse.Namespace) -> int:
    repo = Path(args.repo).expanduser().resolve()
    if not repo.is_dir():
        raise SystemExit("Repository directory does not exist: %s" % repo)
    assets = Path(__file__).resolve().parent.parent / "assets"
    replacements = {
        "PROJECT_NAME": args.project_name,
        "PROJECT_SLUG": args.project_slug,
        "SURFACE_TYPE": args.surface_type,
        "CONTENT_PROFILE": args.content_profile,
    }
    copy_template(assets / "AGENTS.template.md", repo / "AGENTS.md", replacements, args.force)
    copy_template(assets / "README.template.md", repo / "README.md", replacements, args.force)
    copy_template(
        assets / "CONSTRAINTS.template.md",
        repo / "docs" / "product" / "constraints.md",
        replacements,
        args.force,
    )
    print("Scaffold complete. Resolve every <fill>/<command> placeholder before committing.")
    return 0


def registered_submodules(repo: Path) -> List[str]:
    modules = repo / ".gitmodules"
    if not modules.is_file():
        return []
    result = run(
        ["git", "config", "--file", str(modules), "--get-regexp", r"^submodule\..*\.path$"],
        check=False,
    )
    if result.returncode not in (0, 1):
        raise SystemExit("Unable to inspect .gitmodules: %s" % result.stderr.strip())
    paths: List[str] = []
    for line in result.stdout.splitlines():
        parts = line.split(None, 1)
        if len(parts) == 2:
            paths.append(parts[1].strip())
    return paths


def nested_git_markers(repo: Path) -> List[str]:
    markers: List[str] = []
    skip_names = ALWAYS_EXCLUDED_NAMES | TOP_LEVEL_GENERATED_NAMES
    for root, dirs, files in os.walk(repo, topdown=True, followlinks=False):
        root_path = Path(root)
        original_dirs = list(dirs)
        if root_path != repo and ".git" in files:
            markers.append((root_path / ".git").relative_to(repo).as_posix())
        if root_path != repo and ".git" in original_dirs:
            markers.append((root_path / ".git").relative_to(repo).as_posix())
        dirs[:] = [name for name in original_dirs if name != ".git" and name not in skip_names]
    return sorted(set(markers))


def validate_branch(repo: Path, branch: str) -> str:
    if not branch or branch == "current":
        branch = git_text(repo, "branch", "--show-current") or "main"
    if not BRANCH_RE.match(branch):
        raise SystemExit("Invalid initial branch name: %r" % branch)
    result = run(["git", "check-ref-format", "--branch", branch], check=False)
    if result.returncode != 0:
        raise SystemExit("Invalid initial branch name: %r" % branch)
    return branch


def has_staged_changes(repo: Path) -> bool:
    result = git(repo, "diff", "--cached", "--quiet", check=False)
    return result.returncode == 1


def cmd_init(args: argparse.Namespace) -> int:
    repo = Path(args.repo).expanduser().resolve()
    if not repo.is_dir():
        raise SystemExit("Repository directory does not exist: %s" % repo)
    require_repository_root(repo, allow_non_git=True)

    git_form = detect_git_form(repo)
    if git_form in {"gitfile", "bare", "symlink"}:
        raise SystemExit(
            "Refusing history reset for Git form %r. Linked worktrees, symlinked "
            "Git directories, submodule gitfiles, and bare repositories require an "
            "explicit manual migration." % git_form
        )

    if git_form == "directory":
        submodules = registered_submodules(repo)
        nested_markers = nested_git_markers(repo)
        if submodules or nested_markers:
            details = sorted(set(submodules + nested_markers))
            raise SystemExit(
                "Refusing automatic history reset because submodules or nested Git "
                "repositories were detected: %s. Flatten, detach, or migrate them "
                "explicitly before bootstrap." % ", ".join(details)
            )

    local_user_name = git_text(repo, "config", "--local", "--get", "user.name") if git_form == "directory" else None
    local_user_email = git_text(repo, "config", "--local", "--get", "user.email") if git_form == "directory" else None
    branch = validate_branch(repo, args.branch)

    if git_form == "directory":
        if not args.yes_reset_history:
            raise SystemExit(
                "Refusing to remove existing .git. Explicit current-request authorization "
                "must be represented by --yes-reset-history."
            )
        if not args.snapshot_dir:
            raise SystemExit("--snapshot-dir is required when replacing existing Git history.")
        snapshot = Path(args.snapshot_dir).expanduser().resolve()
        verify_snapshot(repo, snapshot, write_marker=True)
        snapshot_metadata = load_json(snapshot / "metadata.json")
        if not isinstance(snapshot_metadata, dict):
            raise SystemExit("Invalid snapshot metadata object.")
        recorded_head = snapshot_metadata.get("head")
        current_head = git_text(repo, "rev-parse", "HEAD")
        if recorded_head != current_head:
            raise SystemExit(
                "Repository HEAD changed after the recovery snapshot. Create and verify a new snapshot "
                "before replacing history (recorded=%r, current=%r)." % (recorded_head, current_head)
            )

        worktrees = git_text(repo, "worktree", "list", "--porcelain") or ""
        worktree_count = sum(1 for line in worktrees.splitlines() if line.startswith("worktree "))
        if worktree_count > 1:
            raise SystemExit(
                "Refusing history reset while multiple Git worktrees are registered (%d). "
                "Remove or migrate linked worktrees explicitly first." % worktree_count
            )

        git_dir = repo / ".git"
        if git_dir.resolve().parent != repo:
            raise SystemExit("Git metadata path escapes the repository.")

        def retry_readonly_file(function, path, exc_info):
            error = exc_info[1]
            mode = Path(path).lstat().st_mode
            if (os.name != "nt" or not isinstance(error, PermissionError)
                    or function is not os.unlink or not stat.S_ISREG(mode)
                    or mode & stat.S_IWRITE or not is_within(Path(path), git_dir)):
                raise error
            os.chmod(path, mode | stat.S_IWRITE)
            function(path)

        # onerror keeps compatibility with Python 3.9; only retry read-only files.
        shutil.rmtree(git_dir, onerror=retry_readonly_file)
        print("Removed local Git metadata: %s" % (repo / ".git"))

    initial = run(["git", "init", "-b", branch], cwd=repo, check=False)
    if initial.returncode != 0:
        fallback = run(["git", "init"], cwd=repo, check=False)
        if fallback.returncode != 0:
            raise SystemExit(fallback.stderr.strip() or fallback.stdout.strip())
        renamed = git(repo, "branch", "-M", branch, check=False)
        if renamed.returncode != 0:
            raise SystemExit(renamed.stderr.strip() or renamed.stdout.strip())
    print("Initialized Git repository on branch: %s" % branch)

    if local_user_name:
        git(repo, "config", "user.name", local_user_name)
    if local_user_email:
        git(repo, "config", "user.email", local_user_email)

    if args.commit:
        git(repo, "add", "-A")
        if not has_staged_changes(repo):
            print("No files to commit.")
            return 0
        result = git(repo, "commit", "-m", args.message, check=False)
        if result.returncode != 0:
            print(result.stdout, end="")
            print(result.stderr, end="", file=sys.stderr)
            raise SystemExit(
                "Baseline commit failed. Configure user.name/user.email or resolve the reported Git error."
            )
        print(result.stdout, end="")

    remotes = git_text(repo, "remote") or ""
    if remotes.strip():
        raise SystemExit("Safety invariant failed: the new repository unexpectedly contains remotes.")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    snapshot = sub.add_parser("snapshot", help="Create external recovery material.")
    snapshot.add_argument("--repo", default=".")
    snapshot.add_argument("--output")
    snapshot.add_argument("--exclude", action="append", default=[])
    snapshot.set_defaults(func=cmd_snapshot)

    verify = sub.add_parser("verify-snapshot", help="Verify recovery material before reset.")
    verify.add_argument("--repo", default=".")
    verify.add_argument("--snapshot-dir", required=True)
    verify.set_defaults(func=cmd_verify_snapshot)

    scaffold = sub.add_parser("scaffold", help="Write minimal project templates.")
    scaffold.add_argument("--repo", default=".")
    scaffold.add_argument("--project-name", required=True)
    scaffold.add_argument("--project-slug", required=True)
    scaffold.add_argument(
        "--surface-type",
        default="operational",
        choices=["operational", "marketing", "content", "mixed", "mobile", "desktop"],
    )
    scaffold.add_argument(
        "--content-profile",
        default="operational-strict",
        choices=["operational-strict", "marketing-approved", "content-approved", "mixed-approved"],
    )
    scaffold.add_argument("--force", action="store_true")
    scaffold.set_defaults(func=cmd_scaffold)

    init = sub.add_parser("init", help="Initialize a new local Git history.")
    init.add_argument("--repo", default=".")
    init.add_argument("--snapshot-dir")
    init.add_argument("--branch", default="current")
    init.add_argument("--yes-reset-history", action="store_true")
    init.add_argument("--commit", action="store_true")
    init.add_argument("--message", default="chore: establish clean project baseline")
    init.set_defaults(func=cmd_init)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
