#!/usr/bin/env python3
"""Deterministic checks for the prototype-first UI workflow.

These checks enforce structural and state-machine invariants. They supplement,
but cannot replace, visual inspection and semantic content review.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
from typing import Dict, Iterable, List, Optional, Sequence, Set, Tuple

from content_audit import validate_inventory

CONTENT_PROFILES = {
    "operational-strict",
    "marketing-approved",
    "content-approved",
    "mixed-approved",
}
SURFACE_STATUSES = {"prototype", "needs-review", "approved", "implemented", "drift"}
SOURCE_TYPES = {
    "code",
    "runtime",
    "test",
    "api-schema",
    "screenshot",
    "image",
    "video",
    "animation",
    "pdf",
    "figma",
    "html",
    "design-system",
    "brand-asset",
    "copy-brief",
    "webpage",
    "issue-attachment",
    "other",
}
SOURCE_ROLES = {
    "functional-truth",
    "visual-reference",
    "interaction-reference",
    "brand-authority",
    "content-authority",
    "inspiration-only",
}
SOURCE_TRUST = {
    "repository-trusted",
    "user-provided-untrusted-content",
    "external-untrusted",
    "generated-untrusted",
    "authoritative-content-source",
}


def run_git(repo: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", "-C", str(repo), *args],
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def require_git(repo: Path) -> None:
    result = run_git(repo, "rev-parse", "--show-toplevel")
    if result.returncode != 0:
        raise SystemExit(result.stderr.strip() or "Not a Git working tree.")
    if Path(result.stdout.strip()).resolve() != repo.resolve():
        raise SystemExit("Run at repository root: %s" % result.stdout.strip())


def changed_paths(repo: Path) -> Set[str]:
    paths: Set[str] = set()
    for args in (
        ("diff", "--name-only"),
        ("diff", "--cached", "--name-only"),
        ("ls-files", "--others", "--exclude-standard"),
    ):
        result = run_git(repo, *args)
        if result.returncode != 0:
            raise SystemExit(result.stderr.strip() or "Unable to inspect Git changes.")
        paths.update(line.strip().replace("\\", "/") for line in result.stdout.splitlines() if line.strip())
    return paths


def load_json(path: Path) -> object:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise SystemExit("Missing file: %s" % path) from exc
    except json.JSONDecodeError as exc:
        raise SystemExit("Invalid JSON in %s: %s" % (path, exc)) from exc


def load_json_text(text: str, label: str) -> object:
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise SystemExit("Invalid JSON in %s: %s" % (label, exc)) from exc


def safe_relative(value: object, label: str) -> Optional[str]:
    if value is None:
        return None
    if not isinstance(value, str) or not value.strip():
        raise ValueError("%s must be a non-empty relative POSIX path" % label)
    normalized = value.replace("\\", "/")
    path = PurePosixPath(normalized)
    if path.is_absolute() or ".." in path.parts:
        raise ValueError("%s must not be absolute or traverse parents: %r" % (label, value))
    return str(path)


def ensure_string_list(value: object, label: str, *, allow_empty: bool = True) -> List[str]:
    if not isinstance(value, list) or not all(isinstance(item, str) and item.strip() for item in value):
        raise ValueError("%s must be a list of non-empty strings" % label)
    if not allow_empty and not value:
        raise ValueError("%s must not be empty" % label)
    return list(value)


def allowed_design_path(path: str, allow_constraints: bool, allow_agents: bool) -> bool:
    if path.startswith("designs/") or path.startswith("docs/ui/"):
        return True
    if allow_constraints and path == "docs/product/constraints.md":
        return True
    if allow_agents and path == "AGENTS.md":
        return True
    return False


def cmd_structure(args: argparse.Namespace) -> int:
    repo = Path(args.repo).resolve()
    required = [repo / "AGENTS.md", repo / "docs" / "product" / "constraints.md"]
    if args.project_dir:
        project = (repo / args.project_dir).resolve() if not Path(args.project_dir).is_absolute() else Path(args.project_dir).resolve()
        required.extend(
            [
                project / "_d_meta.json",
                project / "ui-contract.json",
                project / "content-inventory.json",
            ]
        )
    missing = [path for path in required if not path.exists()]
    if missing:
        for path in missing:
            print("MISSING: %s" % path, file=sys.stderr)
        return 1
    print("Structure check passed.")
    return 0


def cmd_design_scope(args: argparse.Namespace) -> int:
    repo = Path(args.repo).resolve()
    require_git(repo)
    paths = sorted(changed_paths(repo))
    violations = [
        path
        for path in paths
        if not allowed_design_path(path, args.allow_constraints, args.allow_agents)
    ]
    if violations:
        print("Design phase contains changes outside the allowed scope:", file=sys.stderr)
        for path in violations:
            print("  - %s" % path, file=sys.stderr)
        return 1
    print("Design scope check passed (%d changed paths)." % len(paths))
    return 0


def approved_asset(data: object, asset_path: str) -> Tuple[str, Dict[str, object]]:
    if not isinstance(data, dict):
        raise ValueError("_d_meta.json must contain an object")
    assets = data.get("assets")
    if not isinstance(assets, dict):
        raise ValueError("_d_meta.json has no assets map")

    matches: List[Tuple[str, Dict[str, object]]] = []
    for name, asset in assets.items():
        if not isinstance(asset, dict):
            continue
        versions = asset.get("versions")
        if not isinstance(versions, list):
            continue
        for version in versions:
            if isinstance(version, dict) and version.get("path") == asset_path:
                matches.append((str(name), version))

    if not matches:
        raise ValueError("No Baoyu-Design asset version matches path %r" % asset_path)
    # If malformed metadata contains duplicate path records, the last record is the
    # effective latest one and duplicates are reported as an error.
    if len(matches) != 1:
        raise ValueError("Asset path %r appears %d times; expected exactly once" % (asset_path, len(matches)))
    name, version = matches[0]
    if version.get("status") != "approved":
        raise ValueError("Asset %r at %r is %r, not approved" % (name, asset_path, version.get("status")))
    return name, version


def cmd_approval(args: argparse.Namespace) -> int:
    project = Path(args.project_dir).resolve()
    try:
        normalized = safe_relative(args.asset_path, "asset path")
    except ValueError as exc:
        print("ERROR: %s" % exc, file=sys.stderr)
        return 1
    assert normalized is not None
    data = load_json(project / "_d_meta.json")
    try:
        name, version = approved_asset(data, normalized)
    except ValueError as exc:
        print("ERROR: %s" % exc, file=sys.stderr)
        return 1
    target = project / normalized
    if not target.is_file():
        print("ERROR: Approved asset file does not exist: %s" % target, file=sys.stderr)
        return 1
    print("APPROVED: %s -> %s (createdAt=%s)" % (name, normalized, version.get("createdAt", "unknown")))
    return 0


def validate_contract(
    data: object,
    project: Path,
    phase: str,
    *,
    target_asset: Optional[str] = None,
    check_files: bool = True,
) -> List[str]:
    errors: List[str] = []
    if not isinstance(data, dict):
        return ["ui-contract.json must contain an object"]
    if data.get("schemaVersion") != 2:
        errors.append("ui-contract.json must use schemaVersion 2")

    project_info = data.get("project")
    if not isinstance(project_info, dict):
        errors.append("missing project object")
    else:
        for key in ("name", "slug", "surfaceType"):
            value = project_info.get(key)
            if not isinstance(value, str) or not value.strip():
                errors.append("project.%s must be a non-empty string" % key)
        slug = project_info.get("slug")
        if isinstance(slug, str) and not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug):
            errors.append("project.slug must be lowercase hyphenated")

    inventory_relative: Optional[str] = None
    content = data.get("content")
    if not isinstance(content, dict):
        errors.append("missing content object")
    else:
        profile = content.get("defaultProfile")
        if profile not in CONTENT_PROFILES:
            errors.append("invalid content.defaultProfile: %r" % profile)
        try:
            inventory_relative = safe_relative(content.get("inventory"), "content.inventory")
            if (
                check_files
                and inventory_relative
                and phase in {"approved", "implemented"}
                and not (project / inventory_relative).is_file()
            ):
                errors.append("content inventory does not exist: %s" % inventory_relative)
        except ValueError as exc:
            errors.append(str(exc))
        approved_sources = content.get("approvedCopySources")
        if not isinstance(approved_sources, list) or not all(
            isinstance(value, str) and value.strip() for value in approved_sources
        ):
            errors.append("content.approvedCopySources must be a list of non-empty strings")

    design_sources = data.get("designSources")
    if design_sources is not None:
        try:
            design_relative = safe_relative(design_sources, "designSources")
            if (
                check_files
                and design_relative
                and phase in {"approved", "implemented"}
                and not (project / design_relative).is_file()
            ):
                errors.append("designSources file does not exist: %s" % design_relative)
        except ValueError as exc:
            errors.append(str(exc))

    surfaces = data.get("surfaces")
    if not isinstance(surfaces, list) or not surfaces:
        return errors + ["ui-contract.json must contain at least one surface"]

    seen: Set[str] = set()
    matching_target = 0
    for index, surface in enumerate(surfaces):
        prefix = "surfaces[%d]" % index
        if not isinstance(surface, dict):
            errors.append("%s is not an object" % prefix)
            continue
        surface_id = surface.get("id")
        if not isinstance(surface_id, str) or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", surface_id):
            errors.append("%s.id must be a stable lowercase hyphenated identifier" % prefix)
            surface_id = prefix
        elif surface_id in seen:
            errors.append("duplicate surface id: %s" % surface_id)
        else:
            seen.add(surface_id)

        profile = surface.get("contentProfile")
        if profile not in CONTENT_PROFILES:
            errors.append("%s: invalid contentProfile %r" % (surface_id, profile))
        status = surface.get("status")
        if status not in SURFACE_STATUSES:
            errors.append("%s: invalid status %r" % (surface_id, status))

        prototype = surface.get("prototype")
        asset_path: Optional[str] = None
        if not isinstance(prototype, dict):
            errors.append("%s: missing prototype mapping" % surface_id)
        else:
            try:
                entry = safe_relative(prototype.get("entry"), "%s.prototype.entry" % surface_id)
                asset_path = safe_relative(prototype.get("assetPath"), "%s.prototype.assetPath" % surface_id)
                if entry and check_files and phase in {"approved", "implemented"} and not (project / entry).is_file():
                    errors.append("%s: prototype entry does not exist: %s" % (surface_id, entry))
                if asset_path and check_files and phase in {"approved", "implemented"} and not (project / asset_path).is_file():
                    errors.append("%s: prototype asset does not exist: %s" % (surface_id, asset_path))
                files = ensure_string_list(prototype.get("files"), "%s.prototype.files" % surface_id)
                for file_index, value in enumerate(files):
                    safe_relative(value, "%s.prototype.files[%d]" % (surface_id, file_index))
                ensure_string_list(
                    prototype.get("states"),
                    "%s.prototype.states" % surface_id,
                    allow_empty=phase == "draft",
                )
                stable_ids = ensure_string_list(prototype.get("stableIds"), "%s.prototype.stableIds" % surface_id)
                for value in stable_ids:
                    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", value):
                        errors.append("%s: invalid stableId %r" % (surface_id, value))
            except ValueError as exc:
                errors.append(str(exc))

        if target_asset is not None and asset_path == target_asset:
            matching_target += 1
            if status not in {"approved", "implemented"}:
                errors.append(
                    "%s maps target asset %r but status is %r, not approved/implemented"
                    % (surface_id, target_asset, status)
                )

        production = surface.get("production")
        if not isinstance(production, dict):
            errors.append("%s: missing production mapping" % surface_id)
        else:
            route = production.get("routeOrWindow")
            if route is not None and (not isinstance(route, str) or not route.strip()):
                errors.append("%s.production.routeOrWindow must be null or non-empty string" % surface_id)
            for key in ("files", "interfaces", "tests"):
                try:
                    values = ensure_string_list(production.get(key), "%s.production.%s" % (surface_id, key))
                    if key in {"files", "tests"}:
                        for value_index, value in enumerate(values):
                            safe_relative(value, "%s.production.%s[%d]" % (surface_id, key, value_index))
                except ValueError as exc:
                    errors.append(str(exc))
            if phase == "implemented" and status == "implemented":
                files = production.get("files")
                if not isinstance(files, list) or not files:
                    errors.append("%s: implemented surface requires production.files" % surface_id)

    if target_asset is not None and matching_target != 1:
        errors.append(
            "target asset %r must map to exactly one ui-contract surface; found %d"
            % (target_asset, matching_target)
        )
    return errors


def cmd_contract(args: argparse.Namespace) -> int:
    project = Path(args.project_dir).resolve()
    path = project / "ui-contract.json"
    data = load_json(path)
    errors = validate_contract(data, project, args.phase, target_asset=args.asset_path)
    warnings: List[str] = []
    if args.phase in {"approved", "implemented"} and isinstance(data, dict):
        content = data.get("content")
        inventory_relative = content.get("inventory") if isinstance(content, dict) else None
        if isinstance(inventory_relative, str) and path_is_safe_for_project(inventory_relative):
            inventory_path = project / inventory_relative
            if inventory_path.is_file():
                inventory = load_json(inventory_path)
                inventory_errors, inventory_warnings = validate_inventory(
                    inventory,
                    allow_static=False,
                    fail_on_soft_flags=args.fail_on_content_warnings,
                )
                errors.extend("content inventory: %s" % value for value in inventory_errors)
                warnings.extend(inventory_warnings)
    for warning in warnings:
        print("WARNING: %s" % warning, file=sys.stderr)
    if errors:
        for error in errors:
            print("ERROR: %s" % error, file=sys.stderr)
        return 1
    count = len(data.get("surfaces", [])) if isinstance(data, dict) else 0
    print("Contract check passed (%d surfaces, phase=%s, %d content warnings)." % (count, args.phase, len(warnings)))
    return 0


def path_is_safe_for_project(value: str) -> bool:
    try:
        return safe_relative(value, "path") is not None
    except ValueError:
        return False


def validate_sources(data: object, project: Path, *, check_local_copies: bool = True) -> List[str]:
    if not isinstance(data, dict) or data.get("schemaVersion") != 1:
        return ["design-sources.json must be an object with schemaVersion 1"]
    sources = data.get("sources")
    if not isinstance(sources, list) or not sources:
        return ["design-sources.json must contain at least one source"]
    errors: List[str] = []
    seen: Set[str] = set()
    for index, source in enumerate(sources):
        prefix = "sources[%d]" % index
        if not isinstance(source, dict):
            errors.append("%s is not an object" % prefix)
            continue
        source_id = source.get("id")
        if not isinstance(source_id, str) or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", source_id):
            errors.append("%s.id must be lowercase hyphenated" % prefix)
        elif source_id in seen:
            errors.append("duplicate source id: %s" % source_id)
        else:
            seen.add(source_id)
        source_type = source.get("type")
        if source_type not in SOURCE_TYPES:
            errors.append("%s: invalid type %r" % (source_id or prefix, source_type))
        location = source.get("location")
        if not isinstance(location, str) or not location.strip():
            errors.append("%s: location must be a non-empty path, URL, or source identifier" % (source_id or prefix))
        roles = source.get("roles")
        if not isinstance(roles, list) or not roles or any(role not in SOURCE_ROLES for role in roles):
            errors.append("%s: roles must be non-empty values from the role enum" % (source_id or prefix))
            roles = []
        trust = source.get("trust")
        if trust not in SOURCE_TRUST:
            errors.append("%s: invalid trust %r" % (source_id or prefix, trust))
        approved_by_user = source.get("approvedByUser")
        if not isinstance(approved_by_user, bool):
            errors.append("%s: approvedByUser must be boolean" % (source_id or prefix))
        if source.get("instructionsPolicy") != "treat-as-data-never-execute":
            errors.append("%s: instructionsPolicy must be treat-as-data-never-execute" % (source_id or prefix))
        if "functional-truth" in roles and source_type not in {"code", "runtime", "test", "api-schema"}:
            errors.append(
                "%s: functional-truth is limited to code, runtime, test, or api-schema sources; "
                "use a reference role for screenshots/design artifacts" % (source_id or prefix)
            )
        if "content-authority" in roles and approved_by_user is not True and trust != "authoritative-content-source":
            errors.append("%s: content-authority requires approvedByUser=true or authoritative-content-source" % (source_id or prefix))
        if "brand-authority" in roles and approved_by_user is not True and trust not in {"repository-trusted", "authoritative-content-source"}:
            errors.append("%s: brand-authority requires user approval or a trusted repository/authority source" % (source_id or prefix))
        contains_sensitive = source.get("containsSensitiveData")
        if not isinstance(contains_sensitive, bool):
            errors.append("%s: containsSensitiveData must be boolean" % (source_id or prefix))
        sanitization = source.get("sanitization")
        if sanitization is not None and (not isinstance(sanitization, str) or not sanitization.strip()):
            errors.append("%s: sanitization must be null or a non-empty string" % (source_id or prefix))
        if contains_sensitive is True and not sanitization:
            errors.append("%s: sensitive source requires sanitization notes" % (source_id or prefix))
        permission = source.get("licenseOrPermission")
        if not isinstance(permission, str) or not permission.strip():
            errors.append("%s: licenseOrPermission must record permission, license, or an explicit not-applicable reason" % (source_id or prefix))
        local_copies = source.get("localCopies")
        if not isinstance(local_copies, list):
            errors.append("%s: localCopies must be a list" % (source_id or prefix))
        else:
            for copy_index, value in enumerate(local_copies):
                try:
                    relative = safe_relative(value, "%s.localCopies[%d]" % (source_id or prefix, copy_index))
                    if check_local_copies and relative and not (project / relative).exists():
                        errors.append("%s: local copy does not exist: %s" % (source_id or prefix, relative))
                except ValueError as exc:
                    errors.append(str(exc))
        for key in ("observations", "inferences", "limitations"):
            value = source.get(key)
            if not isinstance(value, list) or not all(isinstance(item, str) and item.strip() for item in value):
                errors.append("%s.%s must be a list of non-empty strings" % (source_id or prefix, key))
    return errors


def cmd_sources(args: argparse.Namespace) -> int:
    project = Path(args.project_dir).resolve()
    path = project / "design-sources.json"
    if not path.exists() and args.optional:
        print("No design-sources.json present; optional check skipped.")
        return 0
    data = load_json(path)
    errors = validate_sources(data, project)
    if errors:
        for error in errors:
            print("ERROR: %s" % error, file=sys.stderr)
        return 1
    print("Design-source check passed (%d sources)." % len(data.get("sources", [])))
    return 0


def commit_paths(repo: Path, commit: str) -> List[str]:
    result = run_git(repo, "diff-tree", "--root", "--no-commit-id", "--name-only", "-r", commit)
    if result.returncode != 0:
        raise ValueError(result.stderr.strip() or "Unable to inspect design commit")
    return [line.strip().replace("\\", "/") for line in result.stdout.splitlines() if line.strip()]


def commit_parent_count(repo: Path, commit: str) -> int:
    result = run_git(repo, "rev-list", "--parents", "-n", "1", commit)
    if result.returncode != 0 or not result.stdout.strip():
        raise ValueError(result.stderr.strip() or "Unable to inspect design commit parents")
    # rev-list prints the commit itself followed by zero or more parent hashes.
    return max(0, len(result.stdout.split()) - 1)


def allowed_approval_commit_path(path: str, project_rel: str) -> bool:
    return path.startswith(project_rel + "/") or path.startswith("docs/ui/")


def git_show(repo: Path, commit: str, path: str) -> str:
    result = run_git(repo, "show", "%s:%s" % (commit, path))
    if result.returncode != 0:
        raise ValueError(result.stderr.strip() or "Unable to read %s at %s" % (path, commit))
    return result.stdout


def git_object_exists(repo: Path, commit: str, path: str) -> bool:
    result = run_git(repo, "cat-file", "-e", "%s:%s" % (commit, path))
    return result.returncode == 0


def cmd_implementation_gate(args: argparse.Namespace) -> int:
    repo = Path(args.repo).resolve()
    require_git(repo)
    project = Path(args.project_dir)
    project_rel = project.as_posix().strip("/") if not project.is_absolute() else None
    if project_rel is None:
        try:
            project_rel = project.resolve().relative_to(repo).as_posix()
        except ValueError:
            print("ERROR: project-dir must be inside the repository", file=sys.stderr)
            return 1
    try:
        asset_path = safe_relative(args.asset_path, "asset path")
    except ValueError as exc:
        print("ERROR: %s" % exc, file=sys.stderr)
        return 1
    assert asset_path is not None

    commit_check = run_git(repo, "cat-file", "-e", "%s^{commit}" % args.design_commit)
    if commit_check.returncode != 0:
        print("ERROR: Unknown design commit %s" % args.design_commit, file=sys.stderr)
        return 1
    ancestor = run_git(repo, "merge-base", "--is-ancestor", args.design_commit, "HEAD")
    if ancestor.returncode != 0:
        print("ERROR: Design commit is not an ancestor of HEAD", file=sys.stderr)
        return 1

    try:
        parents = commit_parent_count(repo, args.design_commit)
        if parents != 1:
            raise ValueError(
                "Design approval commit must be a normal single-parent commit; found %d parent(s)" % parents
            )
        paths = commit_paths(repo, args.design_commit)
    except ValueError as exc:
        print("ERROR: %s" % exc, file=sys.stderr)
        return 1
    violations = [path for path in paths if not allowed_approval_commit_path(path, project_rel)]
    if violations:
        print(
            "ERROR: Design approval commit contains paths outside the target design project/docs/ui:",
            file=sys.stderr,
        )
        for path in violations:
            print("  - %s" % path, file=sys.stderr)
        return 1

    meta_rel = "%s/_d_meta.json" % project_rel
    contract_rel = "%s/ui-contract.json" % project_rel
    asset_rel = "%s/%s" % (project_rel, asset_path)
    warnings: List[str] = []
    try:
        if not git_object_exists(repo, args.design_commit, asset_rel):
            raise ValueError("Approved asset file is absent at design commit: %s" % asset_rel)
        design_asset_text = git_show(repo, args.design_commit, asset_rel)
        meta = load_json_text(
            git_show(repo, args.design_commit, meta_rel),
            "%s:%s" % (args.design_commit, meta_rel),
        )
        approved_asset(meta, asset_path)

        # Approval is for the exact current deliverable, not merely a historical
        # commit. A later committed prototype edit or status reversal requires a
        # new approval even when the old commit remains in ancestry.
        if not git_object_exists(repo, "HEAD", asset_rel):
            raise ValueError("Approved asset is absent at current HEAD: %s" % asset_rel)
        if git_show(repo, "HEAD", asset_rel) != design_asset_text:
            raise ValueError(
                "Approved asset changed after the design commit; approve the current deliverable before implementation"
            )
        current_meta = load_json_text(git_show(repo, "HEAD", meta_rel), "HEAD:%s" % meta_rel)
        approved_asset(current_meta, asset_path)
        contract = load_json_text(
            git_show(repo, args.design_commit, contract_rel),
            "%s:%s" % (args.design_commit, contract_rel),
        )
        contract_errors = validate_contract(
            contract,
            repo / project_rel,
            "approved",
            target_asset=asset_path,
            check_files=False,
        )
        if contract_errors:
            raise ValueError("; ".join(contract_errors))

        content = contract.get("content") if isinstance(contract, dict) else None
        inventory_value = content.get("inventory") if isinstance(content, dict) else None
        inventory_project_path = safe_relative(inventory_value, "content.inventory")
        assert inventory_project_path is not None
        inventory_rel = "%s/%s" % (project_rel, inventory_project_path)
        inventory = load_json_text(
            git_show(repo, args.design_commit, inventory_rel),
            "%s:%s" % (args.design_commit, inventory_rel),
        )
        inventory_errors, inventory_warnings = validate_inventory(
            inventory,
            allow_static=False,
            fail_on_soft_flags=args.fail_on_content_warnings,
        )
        if inventory_errors:
            raise ValueError("content inventory: " + "; ".join(inventory_errors))
        warnings.extend(inventory_warnings)

        design_sources_value = contract.get("designSources") if isinstance(contract, dict) else None
        if design_sources_value is not None:
            design_sources_project_path = safe_relative(design_sources_value, "designSources")
            assert design_sources_project_path is not None
            design_sources_rel = "%s/%s" % (project_rel, design_sources_project_path)
            sources = load_json_text(
                git_show(repo, args.design_commit, design_sources_rel),
                "%s:%s" % (args.design_commit, design_sources_rel),
            )
            source_errors = validate_sources(
                sources,
                repo / project_rel,
                check_local_copies=False,
            )
            if source_errors:
                raise ValueError("design sources: " + "; ".join(source_errors))
    except (AssertionError, ValueError) as exc:
        print("ERROR: %s" % exc, file=sys.stderr)
        return 1

    if not args.allow_dirty_design:
        dirty = [
            path
            for path in changed_paths(repo)
            if path == project_rel
            or path.startswith(project_rel + "/")
            or path.startswith("docs/ui/")
        ]
        if dirty:
            print("ERROR: Uncommitted design/audit changes exist after the approved commit:", file=sys.stderr)
            for path in sorted(dirty):
                print("  - %s" % path, file=sys.stderr)
            return 1

    for warning in warnings:
        print("WARNING: content inventory: %s" % warning, file=sys.stderr)
    print(
        "Implementation gate passed: commit=%s asset=%s (%d content warnings)"
        % (args.design_commit, asset_path, len(warnings))
    )
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    structure = sub.add_parser("structure")
    structure.add_argument("--repo", default=".")
    structure.add_argument("--project-dir", help="Project path relative to repo, e.g. designs/my-app")
    structure.set_defaults(func=cmd_structure)

    scope = sub.add_parser("design-scope")
    scope.add_argument("--repo", default=".")
    scope.add_argument("--allow-constraints", action="store_true")
    scope.add_argument("--allow-agents", action="store_true")
    scope.set_defaults(func=cmd_design_scope)

    approval = sub.add_parser("approval")
    approval.add_argument("--project-dir", required=True)
    approval.add_argument("--asset-path", required=True)
    approval.set_defaults(func=cmd_approval)

    contract = sub.add_parser("contract")
    contract.add_argument("--project-dir", required=True)
    contract.add_argument("--phase", choices=["draft", "approved", "implemented"], default="draft")
    contract.add_argument("--asset-path", help="Require this exact asset to map to one approved/implemented surface")
    contract.add_argument("--fail-on-content-warnings", action="store_true")
    contract.set_defaults(func=cmd_contract)

    sources = sub.add_parser("sources")
    sources.add_argument("--project-dir", required=True)
    sources.add_argument("--optional", action="store_true")
    sources.set_defaults(func=cmd_sources)

    gate = sub.add_parser("implementation-gate")
    gate.add_argument("--repo", default=".")
    gate.add_argument("--project-dir", required=True)
    gate.add_argument("--asset-path", required=True)
    gate.add_argument("--design-commit", required=True)
    gate.add_argument("--allow-dirty-design", action="store_true")
    gate.add_argument("--fail-on-content-warnings", action="store_true")
    gate.set_defaults(func=cmd_implementation_gate)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
