#!/usr/bin/env python3
"""Validate a prototype-first-ui Agent Skill directory or packaged ZIP.

The validator follows the portable Agent Skills layout and intentionally uses
only the Python standard library. It performs structural checks, but it does not
claim to validate the quality or safety of every natural-language instruction.
"""

from __future__ import annotations

import argparse
import ast
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import sys
import tempfile
from typing import Dict, Iterable, List, Mapping, Optional, Sequence, Set, Tuple
import zipfile

NAME_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
LINK_PATTERN = re.compile(r"!?(?:\[[^\]]*\])\(([^)]+)\)")
JUNK_NAMES = {".DS_Store", "Thumbs.db", "desktop.ini"}
FATAL_JUNK_PARTS = {".git", ".svn", ".hg", "node_modules"}
RUNTIME_JUNK_PARTS = {"__pycache__", ".pytest_cache", ".mypy_cache"}
MAX_FILES = 500
MAX_FILE_BYTES = 25 * 1024 * 1024
MAX_TOTAL_BYTES = 50 * 1024 * 1024
MAX_SKILL_LINES = 500
MAX_SKILL_TOKEN_ESTIMATE = 5000


class Validation:
    def __init__(self) -> None:
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.notes: List[str] = []

    def error(self, message: str) -> None:
        self.errors.append(message)

    def warn(self, message: str) -> None:
        self.warnings.append(message)

    def note(self, message: str) -> None:
        self.notes.append(message)

    def merge(self, other: "Validation") -> None:
        self.errors.extend(other.errors)
        self.warnings.extend(other.warnings)
        self.notes.extend(other.notes)


def parse_scalar(value: str) -> str:
    value = value.strip()
    if not value:
        return ""
    if value.startswith('"') and value.endswith('"'):
        try:
            parsed = json.loads(value)
            return str(parsed)
        except json.JSONDecodeError:
            return value[1:-1]
    if value.startswith("'") and value.endswith("'"):
        return value[1:-1].replace("''", "'")
    return value


def parse_frontmatter(text: str) -> Tuple[Dict[str, object], str]:
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        raise ValueError("SKILL.md must begin with YAML frontmatter delimited by ---")
    try:
        end = next(index for index in range(1, len(lines)) if lines[index].strip() == "---")
    except StopIteration as exc:
        raise ValueError("SKILL.md frontmatter has no closing ---") from exc

    header_lines = lines[1:end]
    data: Dict[str, object] = {}
    index = 0
    while index < len(header_lines):
        line = header_lines[index]
        if not line.strip() or line.lstrip().startswith("#"):
            index += 1
            continue
        if line.startswith((" ", "\t")):
            raise ValueError("Unexpected indentation in frontmatter line %d" % (index + 2))
        if ":" not in line:
            raise ValueError("Invalid frontmatter line %d: %s" % (index + 2, line))
        key, raw_value = line.split(":", 1)
        key = key.strip()
        raw_value = raw_value.strip()
        if not key:
            raise ValueError("Empty frontmatter key on line %d" % (index + 2))
        if key in data:
            raise ValueError("Duplicate frontmatter key: %s" % key)

        if raw_value in {">", ">-", "|", "|-"}:
            block: List[str] = []
            index += 1
            while index < len(header_lines) and (not header_lines[index].strip() or header_lines[index].startswith("  ")):
                block.append(header_lines[index][2:] if header_lines[index].startswith("  ") else "")
                index += 1
            if raw_value.startswith(">"):
                paragraphs: List[str] = []
                current: List[str] = []
                for value in block:
                    if value.strip():
                        current.append(value.strip())
                    elif current:
                        paragraphs.append(" ".join(current))
                        current = []
                if current:
                    paragraphs.append(" ".join(current))
                data[key] = "\n".join(paragraphs)
            else:
                data[key] = "\n".join(block)
            continue

        if raw_value == "":
            nested: Dict[str, str] = {}
            index += 1
            while index < len(header_lines):
                nested_line = header_lines[index]
                if not nested_line.strip():
                    index += 1
                    continue
                if not nested_line.startswith("  ") or nested_line.startswith("    "):
                    break
                nested_text = nested_line[2:]
                if ":" not in nested_text:
                    raise ValueError("Invalid nested frontmatter line %d" % (index + 2))
                nested_key, nested_value = nested_text.split(":", 1)
                nested_key = nested_key.strip()
                if not nested_key or nested_key in nested:
                    raise ValueError("Invalid or duplicate nested key under %s" % key)
                nested[nested_key] = parse_scalar(nested_value)
                index += 1
            data[key] = nested
            continue

        data[key] = parse_scalar(raw_value)
        index += 1

    body = "\n".join(lines[end + 1 :])
    return data, body


def estimate_tokens(text: str) -> int:
    # Conservative dependency-free estimate: English text tends toward ~4 chars
    # per token, while CJK and punctuation often tokenize more densely.
    ascii_chars = sum(1 for character in text if ord(character) < 128)
    non_ascii_chars = len(text) - ascii_chars
    return int(ascii_chars / 4 + non_ascii_chars / 1.5) + 1


def files_under(root: Path) -> List[Path]:
    result: List[Path] = []
    for path in root.rglob("*"):
        if path.is_file() or path.is_symlink():
            result.append(path)
    return sorted(result, key=lambda value: value.relative_to(root).as_posix().casefold())


def local_markdown_targets(root: Path, markdown_path: Path, text: str) -> Iterable[Tuple[str, Path]]:
    for raw_target in LINK_PATTERN.findall(text):
        target = raw_target.strip()
        if not target or target.startswith(("http://", "https://", "mailto:", "#", "data:")):
            continue
        target = target.split("#", 1)[0]
        target = target.replace("%20", " ")
        if not target:
            continue
        resolved = (markdown_path.parent / target).resolve()
        yield raw_target, resolved


def validate_evals(path: Path, validation: Validation) -> None:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        validation.error("Invalid evals/evals.json: %s" % exc)
        return
    if not isinstance(data, dict) or not isinstance(data.get("evals"), list) or not data["evals"]:
        validation.error("evals/evals.json must contain a non-empty evals array")
        return
    seen: Set[str] = set()
    for index, item in enumerate(data["evals"]):
        label = "evals[%d]" % index
        if not isinstance(item, dict):
            validation.error("%s must be an object" % label)
            continue
        name = item.get("name")
        if not isinstance(name, str) or not name.strip():
            validation.error("%s.name must be non-empty" % label)
        elif name in seen:
            validation.error("Duplicate eval name: %s" % name)
        else:
            seen.add(name)
        if not isinstance(item.get("prompt"), str) or not item["prompt"].strip():
            validation.error("%s.prompt must be non-empty" % label)
        expected = item.get("expected_output")
        if not isinstance(expected, str) or not expected.strip():
            validation.error("%s.expected_output must be non-empty" % label)
        files = item.get("files", [])
        if not isinstance(files, list) or not all(isinstance(value, str) and value.strip() for value in files):
            validation.error("%s.files must be a string list" % label)


def parse_python_compatibility(text: str, filename: str) -> None:
    # On the declared minimum interpreter, the native parser is already the
    # compatibility check. Newer interpreters parse using Python 3.9 grammar so
    # accidental newer syntax does not slip into a release.
    if sys.version_info[:2] > (3, 9):
        ast.parse(text, filename=filename, feature_version=(3, 9))
    else:
        ast.parse(text, filename=filename)


def validate_directory(root: Path, *, run_node: bool = True) -> Validation:
    validation = Validation()
    if sys.version_info < (3, 9):
        validation.error("Validator and packaged scripts require Python 3.9 or newer")
    root = root.resolve()
    if not root.is_dir():
        validation.error("Skill path is not a directory: %s" % root)
        return validation

    all_paths = files_under(root)
    skill_matches = [path for path in all_paths if path.name.casefold() == "skill.md"]
    root_skill = root / "SKILL.md"
    if not root_skill.is_file():
        validation.error("Missing root SKILL.md")
        return validation
    if len(skill_matches) != 1 or skill_matches[0].resolve() != root_skill.resolve():
        validation.error("Package must contain exactly one SKILL.md at the skill root")

    try:
        skill_text = root_skill.read_text(encoding="utf-8")
        frontmatter, body = parse_frontmatter(skill_text)
    except (OSError, UnicodeError, ValueError) as exc:
        validation.error(str(exc))
        return validation

    name = frontmatter.get("name")
    if not isinstance(name, str) or not NAME_PATTERN.fullmatch(name) or len(name) > 64:
        validation.error("frontmatter.name must be 1-64 lowercase alphanumeric/hyphen characters with no edge/consecutive hyphens")
    elif root.name != name:
        validation.error("Skill directory name %r must equal frontmatter.name %r" % (root.name, name))

    description = frontmatter.get("description")
    if not isinstance(description, str) or not (1 <= len(description) <= 1024):
        validation.error("frontmatter.description must be 1-1024 characters")
    elif "use" not in description.casefold():
        validation.warn("Description should state when the skill should be used")

    compatibility = frontmatter.get("compatibility")
    if compatibility is not None and (not isinstance(compatibility, str) or len(compatibility) > 500):
        validation.error("frontmatter.compatibility must be a string of at most 500 characters")
    metadata = frontmatter.get("metadata")
    if metadata is not None:
        if not isinstance(metadata, dict) or not all(isinstance(key, str) and isinstance(value, str) for key, value in metadata.items()):
            validation.error("frontmatter.metadata must be a string-to-string map")
    license_value = frontmatter.get("license")
    if license_value is not None and not isinstance(license_value, str):
        validation.error("frontmatter.license must be a string")

    line_count = len(skill_text.splitlines())
    token_estimate = estimate_tokens(skill_text)
    if line_count > MAX_SKILL_LINES:
        validation.warn("SKILL.md has %d lines; progressive-disclosure guidance recommends <= %d" % (line_count, MAX_SKILL_LINES))
    if token_estimate > MAX_SKILL_TOKEN_ESTIMATE:
        validation.warn("SKILL.md estimated at %d tokens; guidance recommends roughly <= %d" % (token_estimate, MAX_SKILL_TOKEN_ESTIMATE))
    validation.note("SKILL.md: %d lines, ~%d dependency-free estimated tokens" % (line_count, token_estimate))

    if len(all_paths) > MAX_FILES:
        validation.error("Package contains %d files; limit is %d" % (len(all_paths), MAX_FILES))
    total_bytes = 0
    casefold_paths: Dict[str, str] = {}
    python_files: List[Path] = []
    javascript_files: List[Path] = []
    for path in all_paths:
        relative = path.relative_to(root)
        relative_posix = relative.as_posix()
        folded = relative_posix.casefold()
        if folded in casefold_paths and casefold_paths[folded] != relative_posix:
            validation.error("Case-insensitive duplicate paths: %s and %s" % (casefold_paths[folded], relative_posix))
        casefold_paths[folded] = relative_posix
        if path.name in JUNK_NAMES or any(part in FATAL_JUNK_PARTS for part in relative.parts):
            validation.error("Junk/development artifact must not be packaged: %s" % relative_posix)
        elif any(part in RUNTIME_JUNK_PARTS for part in relative.parts) or path.suffix == ".pyc":
            validation.warn("Runtime cache will be excluded from packaging: %s" % relative_posix)
        if path.is_symlink():
            try:
                target = path.resolve(strict=True)
                target.relative_to(root)
            except (OSError, ValueError):
                validation.error("Symlink escapes package or is broken: %s" % relative_posix)
            else:
                validation.warn("Symlink present; portable ZIP packaging will refuse it: %s" % relative_posix)
            continue
        size = path.stat().st_size
        total_bytes += size
        if size > MAX_FILE_BYTES:
            validation.error("File exceeds 25 MiB: %s" % relative_posix)
        try:
            raw = path.read_bytes()
        except OSError as exc:
            validation.error("Cannot read %s: %s" % (relative_posix, exc))
            continue
        if b"\x00" not in raw:
            try:
                text = raw.decode("utf-8")
            except UnicodeDecodeError:
                validation.error("Text-like file is not UTF-8: %s" % relative_posix)
                continue
            if path.suffix.lower() == ".json":
                try:
                    json.loads(text)
                except json.JSONDecodeError as exc:
                    validation.error("Invalid JSON %s: %s" % (relative_posix, exc))
            if path.suffix.lower() == ".md":
                for raw_target, resolved in local_markdown_targets(root, path, text):
                    try:
                        resolved.relative_to(root)
                    except ValueError:
                        validation.error("Markdown link escapes skill root in %s: %s" % (relative_posix, raw_target))
                        continue
                    if not resolved.exists():
                        validation.error("Broken local Markdown link in %s: %s" % (relative_posix, raw_target))
            if path.suffix.lower() == ".py":
                python_files.append(path)
                try:
                    parse_python_compatibility(text, relative_posix)
                except SyntaxError as exc:
                    validation.error("Python 3.9 compatibility syntax error in %s: %s" % (relative_posix, exc))
            if path.suffix.lower() in {".js", ".mjs", ".cjs"}:
                javascript_files.append(path)

    if total_bytes > MAX_TOTAL_BYTES:
        validation.error("Package exceeds 50 MiB uncompressed")
    validation.note("Package: %d files, %d bytes uncompressed" % (len(all_paths), total_bytes))
    validation.note("Python files parsed against the declared Python 3.9 grammar")

    eval_path = root / "evals" / "evals.json"
    if eval_path.exists():
        validate_evals(eval_path, validation)
    else:
        validation.warn("No evals/evals.json; reusable behavior is not represented by portable eval cases")

    required_refs = {
        "references/content-contract.md",
        "references/multimodal-evidence.md",
        "references/workflow.md",
        "references/harness-adaptation.md",
        "references/cleanup-policy.md",
    }
    for relative in sorted(required_refs):
        if not (root / relative).is_file():
            validation.error("Missing required reference: %s" % relative)

    if run_node and javascript_files:
        node = shutil.which("node")
        if not node:
            validation.warn("Node.js unavailable; JavaScript syntax checks skipped")
        else:
            for path in javascript_files:
                result = subprocess.run(
                    [node, "--check", str(path)],
                    check=False,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                )
                if result.returncode != 0:
                    validation.error("JavaScript syntax error in %s: %s" % (path.relative_to(root), result.stderr.strip()))

    if not body.strip():
        validation.error("SKILL.md body is empty")
    return validation


def validate_zip(path: Path) -> Validation:
    validation = Validation()
    if not path.is_file():
        validation.error("ZIP does not exist: %s" % path)
        return validation
    try:
        with zipfile.ZipFile(path, "r") as archive:
            names = archive.namelist()
            if not names:
                validation.error("ZIP is empty")
                return validation
            folded: Set[str] = set()
            roots: Set[str] = set()
            for name in names:
                pure = PurePosixPath(name)
                if pure.is_absolute() or ".." in pure.parts:
                    validation.error("Unsafe ZIP member path: %s" % name)
                if not pure.parts:
                    continue
                roots.add(pure.parts[0])
                if name.casefold() in folded:
                    validation.error("Case-insensitive duplicate ZIP member: %s" % name)
                folded.add(name.casefold())
            if len(roots) != 1:
                validation.error("ZIP must contain exactly one top-level skill directory")
            bad = archive.testzip()
            if bad:
                validation.error("ZIP CRC check failed at %s" % bad)
    except (OSError, zipfile.BadZipFile) as exc:
        validation.error("Invalid ZIP: %s" % exc)
        return validation

    if validation.errors:
        return validation
    with tempfile.TemporaryDirectory(prefix="skill-validate-") as temp:
        with zipfile.ZipFile(path, "r") as archive:
            archive.extractall(temp)
        top = [child for child in Path(temp).iterdir() if child.is_dir()]
        if len(top) == 1:
            validation.merge(validate_directory(top[0]))
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    validation.note("ZIP SHA-256: %s" % digest)
    return validation


def print_validation(validation: Validation) -> int:
    for note in validation.notes:
        print("NOTE: %s" % note)
    for warning in validation.warnings:
        print("WARNING: %s" % warning, file=sys.stderr)
    for error in validation.errors:
        print("ERROR: %s" % error, file=sys.stderr)
    if validation.errors:
        print("Validation failed: %d errors, %d warnings." % (len(validation.errors), len(validation.warnings)), file=sys.stderr)
        return 1
    print("Validation passed (%d warnings)." % len(validation.warnings))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--skill-dir")
    group.add_argument("--zip")
    parser.add_argument("--no-node", action="store_true", help="Skip optional node --check")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    if args.skill_dir:
        result = validate_directory(Path(args.skill_dir), run_node=not args.no_node)
    else:
        result = validate_zip(Path(args.zip))
    return print_validation(result)


if __name__ == "__main__":
    raise SystemExit(main())
