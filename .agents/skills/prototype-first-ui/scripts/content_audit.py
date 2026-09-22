#!/usr/bin/env python3
"""Build and validate a DOM/UI content inventory.

The tool is deliberately conservative. It can prove that every captured string
was classified under the package's content contract; it cannot determine by
itself whether prose is truthful, useful, or aesthetically appropriate.
"""

from __future__ import annotations

import argparse
from collections import defaultdict
import datetime as dt
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path, PurePosixPath
import re
import sys
from typing import DefaultDict, Dict, Iterable, List, Mapping, MutableMapping, Optional, Sequence, Set, Tuple

SCHEMA_VERSION = 1
PROFILES = {
    "operational-strict",
    "marketing-approved",
    "content-approved",
    "mixed-approved",
}

BASE_PURPOSES = {
    "navigation",
    "orientation",
    "domain-object",
    "domain-field",
    "domain-value",
    "user-action",
    "confirmation",
    "state",
    "progress",
    "completion",
    "validation",
    "error",
    "empty-state",
    "permission",
    "availability",
    "offline",
    "disabled",
    "task-help",
    "legal-approved",
    "machine-identifier",
    "runtime-marker",
}
PROFILE_PURPOSES = {
    "operational-strict": BASE_PURPOSES,
    "marketing-approved": BASE_PURPOSES | {"approved-product-copy", "approved-content"},
    "content-approved": BASE_PURPOSES | {"approved-content"},
    "mixed-approved": BASE_PURPOSES | {"approved-product-copy", "approved-content"},
}

ORIGINS = {
    "production-domain",
    "production-behavior",
    "existing-approved-ui-copy",
    "explicit-user-copy",
    "authoritative-policy",
    "agent-generated-task-copy",
    "agent-generated-approved-copy",
    "framework-runtime",
    "unknown",
    "task-brief",
    "target-audience",
    "technical-explanation",
    "architecture",
    "implementation",
    "aesthetic-rationale",
    "design-instruction",
    "prompt",
    "internal-plan",
}
PROHIBITED_ORIGINS = {
    "task-brief",
    "target-audience",
    "technical-explanation",
    "architecture",
    "implementation",
    "aesthetic-rationale",
    "design-instruction",
    "prompt",
    "internal-plan",
}
DECISIONS = {"allow", "remove", "rewrite", "review"}
EVIDENCE_REQUIRED_PURPOSES = {"legal-approved", "approved-product-copy", "approved-content"}
EVIDENCE_EXCEPTION_ORIGINS = {
    "explicit-user-copy",
    "existing-approved-ui-copy",
    "production-domain",
    "production-behavior",
    "authoritative-policy",
}

PROMOTIONAL_PATTERNS = [
    r"\bbuilt for\b",
    r"\bdesigned for\b",
    r"\bmade for\b",
    r"\bprivacy[- ]first\b",
    r"\bprivate by design\b",
    r"\bnext[- ]generation\b",
    r"\breimagined\b",
    r"\bseamless(?:ly)?\b",
    r"\beffortless(?:ly)?\b",
    r"\bunlock\b",
    r"\belevate\b",
    r"\bpowerful\b",
    r"\bbeautiful\b",
    r"\bmodern experience\b",
    r"专为",
    r"面向.{0,18}(?:打造|设计)",
    r"为.{0,18}打造",
    r"隐私优先",
    r"重新定义",
    r"下一代",
    r"无缝(?:体验|工作流)?",
    r"极致(?:体验|效率)?",
]
TECHNICAL_PATTERNS = [
    r"\b(?:react|vue|svelte|angular|next\.js|nuxt|tauri|electron)\b",
    r"\b(?:frontend|backend|tech stack|implementation detail|component architecture|system architecture)\b",
    r"技术栈",
    r"前端框架",
    r"后端实现",
    r"组件架构",
    r"系统架构",
    r"实现细节",
    r"设计目标",
    r"目标受众",
    r"审美理由",
    r"提示词",
]
INSTRUCTION_PATTERNS = [
    r"\bignore (?:all |any )?(?:previous|prior|system) instructions?\b",
    r"\bsystem prompt\b",
    r"\bdeveloper message\b",
    r"\bdo not follow\b",
    r"忽略.{0,12}(?:指令|提示)",
    r"系统提示词",
    r"开发者消息",
]
SENSITIVE_PATTERN = re.compile(
    r"(?:password|passwd|secret|token|credential|authorization|cookie|session|private[-_]?key|access[-_]?key)",
    re.IGNORECASE,
)
TEXT_FILE_EXTENSIONS = {".html", ".htm", ".json"}
CODE_FILE_EXTENSIONS = {".js", ".jsx", ".ts", ".tsx", ".vue", ".svelte"}
IGNORED_DIRECTORIES = {
    ".git",
    "node_modules",
    "target",
    "dist",
    "build",
    ".next",
    ".nuxt",
    ".cache",
    "coverage",
    "vendor",
    "__pycache__",
}


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_json(path: Path) -> object:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ValueError("Missing file: %s" % path) from exc
    except json.JSONDecodeError as exc:
        raise ValueError("Invalid JSON in %s: %s" % (path, exc)) from exc


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def normalized_text(value: object) -> str:
    return re.sub(r"\s+", " ", str(value if value is not None else "").replace("\u00a0", " ")).strip()


def comparison_text(value: str) -> str:
    return re.sub(r"[^0-9a-z\u3400-\u9fff]+", "", value.casefold())


def stable_id(text: str) -> str:
    return "content-" + hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


def path_is_safe_relative(value: object) -> bool:
    if not isinstance(value, str) or not value.strip():
        return False
    path = PurePosixPath(value.replace("\\", "/"))
    return not path.is_absolute() and ".." not in path.parts


def pattern_matches(text: str, patterns: Sequence[str]) -> bool:
    return any(re.search(pattern, text, flags=re.IGNORECASE) for pattern in patterns)


def brief_overlap(text: str, briefs: Sequence[str]) -> bool:
    compact = comparison_text(text)
    if len(compact) < 8:
        return False
    for brief in briefs:
        brief_compact = comparison_text(brief)
        if compact and compact in brief_compact:
            return True
        words = set(re.findall(r"[a-z0-9]{3,}", text.casefold()))
        brief_words = set(re.findall(r"[a-z0-9]{3,}", brief.casefold()))
        if len(words) >= 3 and len(words & brief_words) / len(words) >= 0.8:
            return True
    return False


def read_text_sources(paths: Sequence[str]) -> Tuple[List[str], List[str]]:
    contents: List[str] = []
    labels: List[str] = []
    for raw in paths:
        path = Path(raw).resolve()
        contents.append(path.read_text(encoding="utf-8", errors="replace"))
        labels.append(str(path))
    return contents, labels


def extract_approved_strings(paths: Sequence[str]) -> Dict[str, str]:
    approved: Dict[str, str] = {}

    def add(value: object, source: str) -> None:
        if isinstance(value, str):
            text = normalized_text(value)
            if text:
                approved[text] = source
        elif isinstance(value, list):
            for item in value:
                add(item, source)
        elif isinstance(value, dict):
            for key, item in value.items():
                if not SENSITIVE_PATTERN.search(str(key)):
                    add(item, source)

    for raw in paths:
        path = Path(raw).resolve()
        if path.suffix.lower() == ".json":
            add(load_json(path), str(path))
        else:
            for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
                stripped = normalized_text(line)
                if stripped and not stripped.startswith("#"):
                    approved[stripped] = str(path)
    return approved


def capture_items(captures: Sequence[Path]) -> Tuple[List[Mapping[str, object]], List[Dict[str, object]], List[str]]:
    items: List[Mapping[str, object]] = []
    surfaces: List[Dict[str, object]] = []
    limitations: List[str] = []
    for capture_path in captures:
        data = load_json(capture_path)
        if not isinstance(data, dict) or data.get("schemaVersion") != 1:
            raise ValueError("Capture must be an object with schemaVersion 1: %s" % capture_path)
        raw_items = data.get("items")
        if not isinstance(raw_items, list):
            raise ValueError("Capture has no items array: %s" % capture_path)
        for raw_item in raw_items:
            if isinstance(raw_item, dict):
                item = dict(raw_item)
                item["_capture"] = str(capture_path)
                items.append(item)
        page = data.get("page") if isinstance(data.get("page"), dict) else {}
        surfaces.append(
            {
                "source": str(capture_path),
                "url": page.get("url"),
                "title": page.get("title"),
                "viewport": page.get("viewport"),
            }
        )
        raw_limitations = data.get("limitations")
        if isinstance(raw_limitations, list):
            limitations.extend(str(value) for value in raw_limitations if str(value).strip())
    return items, surfaces, sorted(set(limitations))


def existing_by_text(path: Optional[str]) -> Dict[str, Mapping[str, object]]:
    if not path:
        return {}
    data = load_json(Path(path).resolve())
    if not isinstance(data, dict) or not isinstance(data.get("items"), list):
        raise ValueError("Existing inventory has no items array: %s" % path)
    result: Dict[str, Mapping[str, object]] = {}
    for item in data["items"]:
        if isinstance(item, dict) and isinstance(item.get("text"), str):
            result[normalized_text(item["text"])] = item
    return result


def make_flags(text: str, briefs: Sequence[str], channels: Sequence[str]) -> List[str]:
    flags: Set[str] = set()
    if brief_overlap(text, briefs):
        flags.add("brief-overlap")
    if pattern_matches(text, PROMOTIONAL_PATTERNS):
        flags.add("promotional-language")
    if pattern_matches(text, TECHNICAL_PATTERNS):
        flags.add("possible-technical-leak")
    if pattern_matches(text, INSTRUCTION_PATTERNS):
        flags.add("embedded-instruction-like-text")
    if "html-comment" in channels:
        flags.add("dom-comment")
    if "data-*" in channels:
        flags.add("dom-metadata")
    return sorted(flags)


def cmd_seed(args: argparse.Namespace) -> int:
    try:
        captures = [Path(path).resolve() for path in args.capture]
        raw_items, surfaces, limitations = capture_items(captures)
        briefs, brief_labels = read_text_sources(args.brief_file)
        approved = extract_approved_strings(args.approved_copy_file)
        previous = existing_by_text(args.existing)
    except (OSError, ValueError) as exc:
        print("ERROR: %s" % exc, file=sys.stderr)
        return 1

    grouped: DefaultDict[str, Dict[str, object]] = defaultdict(
        lambda: {"channels": set(), "locations": set(), "visibility": set(), "captures": set()}
    )
    for raw_item in raw_items:
        text = normalized_text(raw_item.get("text"))
        if not text:
            continue
        group = grouped[text]
        channel = normalized_text(raw_item.get("channel") or raw_item.get("kind") or "unknown")
        location = normalized_text(raw_item.get("location") or "unknown")
        visibility = normalized_text(raw_item.get("visibility") or "unknown")
        group["channels"].add(channel)
        group["locations"].add(location)
        group["visibility"].add(visibility)
        group["captures"].add(str(raw_item.get("_capture") or "unknown"))

    inventory_items: List[Dict[str, object]] = []
    for text in sorted(grouped, key=lambda value: (value.casefold(), value)):
        group = grouped[text]
        channels = sorted(group["channels"])
        prior = previous.get(text)
        item: Dict[str, object] = {
            "id": stable_id(text),
            "text": text,
            "channels": channels,
            "locations": sorted(group["locations"]),
            "visibility": sorted(group["visibility"]),
            "captures": sorted(group["captures"]),
            "purpose": "unclassified",
            "origin": "unknown",
            "decision": "review",
            "evidence": None,
            "flags": make_flags(text, briefs, channels),
            "notes": None,
        }
        if prior:
            for key in ("purpose", "origin", "decision", "evidence", "notes"):
                if key in prior:
                    item[key] = prior[key]
            previous_flags = prior.get("flags")
            if isinstance(previous_flags, list):
                item["flags"] = sorted(set(item["flags"]) | {str(value) for value in previous_flags})
        if text in approved and not prior:
            item["origin"] = "explicit-user-copy"
            item["evidence"] = {"source": approved[text], "reference": "exact approved string"}
            item["flags"] = sorted(set(item["flags"]) | {"approved-copy-exact"})
        inventory_items.append(item)

    methods: Set[str] = set()
    for path in captures:
        try:
            capture_data = load_json(path)
            generator = capture_data.get("generator") if isinstance(capture_data, dict) else None
            methods.add("static-source" if generator == "prototype-first-ui/content_audit.py static-scan" else "rendered-dom")
        except ValueError:
            pass

    inventory = {
        "schemaVersion": SCHEMA_VERSION,
        "profile": args.profile,
        "capture": {
            "method": "mixed" if len(methods) > 1 else (next(iter(methods)) if methods else "unknown"),
            "sources": [str(path) for path in captures],
            "capturedAt": now_iso(),
            "surfaces": surfaces,
            "limitations": limitations,
        },
        "briefSources": brief_labels,
        "approvedCopySources": [str(Path(path).resolve()) for path in args.approved_copy_file],
        "items": inventory_items,
    }
    write_json(Path(args.output).resolve(), inventory)
    flagged = sum(1 for item in inventory_items if item["flags"])
    print("Wrote %d unique strings to %s (%d flagged for review)." % (len(inventory_items), args.output, flagged))
    return 0


class CaptureHTMLParser(HTMLParser):
    def __init__(self, source: str) -> None:
        super().__init__(convert_charrefs=True)
        self.source = source
        self.stack: List[str] = []
        self.items: List[Dict[str, object]] = []

    def location(self) -> str:
        line, column = self.getpos()
        return "%s:%d:%d" % (self.source, line, column)

    def add(self, text: object, channel: str, kind: str) -> None:
        value = normalized_text(text)
        if value:
            self.items.append(
                {
                    "id": stable_id("%s:%s:%s" % (self.location(), channel, value)),
                    "text": value,
                    "kind": kind,
                    "channel": channel,
                    "location": self.location(),
                    "visibility": "unknown-static",
                }
            )

    def handle_starttag(self, tag: str, attrs: List[Tuple[str, Optional[str]]]) -> None:
        self.stack.append(tag.lower())
        attributes = {name.lower(): value for name, value in attrs}
        for name in ("aria-label", "aria-description", "placeholder", "title", "alt", "label", "summary"):
            if name in attributes and attributes[name] is not None:
                self.add(attributes[name], name, "attribute")
        input_type = str(attributes.get("type") or "").lower()
        if tag.lower() == "input" and input_type in {"button", "submit", "reset"}:
            self.add(attributes.get("value"), "control-value", "attribute")
        for name, value in attributes.items():
            if name.startswith("data-") and value is not None and not SENSITIVE_PATTERN.search(name):
                self.add(value, "data-*", "data-attribute")

    def handle_startendtag(self, tag: str, attrs: List[Tuple[str, Optional[str]]]) -> None:
        self.handle_starttag(tag, attrs)
        if self.stack:
            self.stack.pop()

    def handle_endtag(self, tag: str) -> None:
        if self.stack:
            self.stack.pop()

    def handle_data(self, data: str) -> None:
        if self.stack and self.stack[-1] in {"script", "style", "template", "noscript"}:
            return
        self.add(data, "text", "text")

    def handle_comment(self, data: str) -> None:
        self.add(data, "html-comment", "comment")


def json_strings(value: object, location: str, path: str = "$") -> Iterable[Dict[str, object]]:
    if isinstance(value, str):
        text = normalized_text(value)
        if text and not SENSITIVE_PATTERN.search(path):
            yield {
                "id": stable_id("%s:%s:%s" % (location, path, text)),
                "text": text,
                "kind": "client-json",
                "channel": "application/json",
                "location": "%s:%s" % (location, path),
                "visibility": "unknown-static",
            }
    elif isinstance(value, list):
        for index, item in enumerate(value):
            yield from json_strings(item, location, "%s[%d]" % (path, index))
    elif isinstance(value, dict):
        for key, item in value.items():
            if not SENSITIVE_PATTERN.search(str(key)):
                yield from json_strings(item, location, "%s.%s" % (path, key))


def code_strings(text: str, location: str) -> Iterable[Dict[str, object]]:
    # Deliberately conservative fallback: this is not a JavaScript parser. It
    # extracts only quoted strings that look like human-readable UI prose.
    pattern = re.compile(r"(?P<quote>['\"])(?P<value>(?:\\.|(?!\1).){2,500}?)(?P=quote)")
    for match in pattern.finditer(text):
        raw = match.group("value")
        try:
            value = bytes(raw, "utf-8").decode("unicode_escape") if "\\" in raw and raw.isascii() else raw
        except UnicodeDecodeError:
            value = raw
        value = normalized_text(value)
        if not value:
            continue
        if re.fullmatch(r"[.#/@a-zA-Z0-9_:\\-]+", value):
            continue
        if not (re.search(r"\s", value) or re.search(r"[\u3400-\u9fff]", value)):
            continue
        line = text.count("\n", 0, match.start()) + 1
        yield {
            "id": stable_id("%s:%d:%s" % (location, line, value)),
            "text": value,
            "kind": "code-string",
            "channel": "static-code-string",
            "location": "%s:%d" % (location, line),
            "visibility": "unknown-static",
        }


def cmd_static_scan(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    if not root.is_dir():
        print("ERROR: Not a directory: %s" % root, file=sys.stderr)
        return 1
    items: List[Dict[str, object]] = []
    scanned: List[str] = []
    for path in sorted(root.rglob("*")):
        if not path.is_file() or any(part in IGNORED_DIRECTORIES for part in path.relative_to(root).parts):
            continue
        suffix = path.suffix.lower()
        if suffix not in TEXT_FILE_EXTENSIONS and not (args.include_code_strings and suffix in CODE_FILE_EXTENSIONS):
            continue
        relative = path.relative_to(root).as_posix()
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError as exc:
            print("WARNING: Skipping %s: %s" % (path, exc), file=sys.stderr)
            continue
        scanned.append(relative)
        if suffix in {".html", ".htm"}:
            parser = CaptureHTMLParser(relative)
            parser.feed(text)
            parser.close()
            items.extend(parser.items)
        elif suffix == ".json":
            try:
                items.extend(json_strings(json.loads(text), relative))
            except json.JSONDecodeError:
                print("WARNING: Invalid JSON skipped: %s" % relative, file=sys.stderr)
        else:
            items.extend(code_strings(text, relative))

    report = {
        "schemaVersion": 1,
        "generator": "prototype-first-ui/content_audit.py static-scan",
        "capturedAt": now_iso(),
        "page": {"url": None, "title": "Static source scan", "language": None, "viewport": None},
        "items": items,
        "limitations": [
            "Static scanning cannot determine which strings actually render or in which runtime state.",
            "Framework-generated content, pseudo-elements, shadow DOM, native UI, and dynamically fetched copy may be missing.",
            "Code-string extraction is heuristic." if args.include_code_strings else "Code strings were not scanned.",
            "A rendered DOM capture is required for full sign-off.",
            "Scanned files: %d" % len(scanned),
        ],
    }
    write_json(Path(args.output).resolve(), report)
    print("Wrote static capture with %d strings from %d files to %s." % (len(items), len(scanned), args.output))
    return 0


def evidence_present(value: object) -> bool:
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, dict):
        return any(isinstance(item, str) and item.strip() for item in value.values())
    if isinstance(value, list):
        return any(evidence_present(item) for item in value)
    return False


def validate_inventory(data: object, *, allow_static: bool, fail_on_soft_flags: bool) -> Tuple[List[str], List[str]]:
    errors: List[str] = []
    warnings: List[str] = []
    if not isinstance(data, dict):
        return ["Inventory must contain an object"], warnings
    if data.get("schemaVersion") != SCHEMA_VERSION:
        errors.append("Inventory must use schemaVersion %d" % SCHEMA_VERSION)
    profile = data.get("profile")
    if profile not in PROFILES:
        errors.append("Invalid profile: %r" % profile)
        allowed_purposes: Set[str] = set()
    else:
        allowed_purposes = PROFILE_PURPOSES[str(profile)]
    capture = data.get("capture")
    method = capture.get("method") if isinstance(capture, dict) else None
    if method not in {"rendered-dom", "static-source", "mixed"}:
        errors.append("capture.method must be rendered-dom, static-source, or mixed")
    elif method != "rendered-dom" and not allow_static:
        errors.append("Full sign-off requires rendered-dom capture; pass --allow-static only for an explicitly provisional review")
    items = data.get("items")
    if not isinstance(items, list):
        return errors + ["Inventory has no items array"], warnings

    seen_ids: Set[str] = set()
    for index, item in enumerate(items):
        label = "items[%d]" % index
        if not isinstance(item, dict):
            errors.append("%s is not an object" % label)
            continue
        item_id = item.get("id")
        if not isinstance(item_id, str) or not item_id.strip():
            errors.append("%s.id must be non-empty" % label)
            item_id = label
        elif item_id in seen_ids:
            errors.append("Duplicate item id: %s" % item_id)
        else:
            seen_ids.add(item_id)
        text = item.get("text")
        if not isinstance(text, str) or not normalized_text(text):
            errors.append("%s.text must be non-empty" % item_id)
            text = ""
        for key in ("channels", "locations"):
            value = item.get(key)
            if not isinstance(value, list) or not value or not all(isinstance(entry, str) and entry.strip() for entry in value):
                errors.append("%s.%s must be a non-empty string list" % (item_id, key))
        purpose = item.get("purpose")
        if purpose == "unclassified" or purpose is None:
            errors.append("%s is unclassified: %r" % (item_id, text))
        elif purpose not in allowed_purposes:
            errors.append("%s purpose %r is not allowed for profile %r" % (item_id, purpose, profile))
        origin = item.get("origin")
        if origin not in ORIGINS:
            errors.append("%s has invalid origin %r" % (item_id, origin))
        elif origin == "unknown":
            errors.append("%s origin is unknown; final sign-off requires an evidenced origin" % item_id)
        elif origin in PROHIBITED_ORIGINS:
            errors.append("%s comes from prohibited origin %r: %r" % (item_id, origin, text))
        decision = item.get("decision")
        if decision not in DECISIONS:
            errors.append("%s has invalid decision %r" % (item_id, decision))
        elif decision != "allow":
            errors.append("%s decision is %r, not allow: %r" % (item_id, decision, text))
        evidence = item.get("evidence")
        if purpose in EVIDENCE_REQUIRED_PURPOSES and not evidence_present(evidence):
            errors.append("%s purpose %r requires approval/content evidence" % (item_id, purpose))

        channels = item.get("channels") if isinstance(item.get("channels"), list) else []
        if purpose == "machine-identifier":
            if "data-*" not in channels:
                errors.append("%s machine-identifier is only valid in data-*" % item_id)
            if not re.fullmatch(r"[A-Za-z0-9_.:/-]{1,160}", str(text)):
                errors.append("%s machine-identifier must be a compact non-prose identifier" % item_id)
        if purpose == "runtime-marker":
            if "html-comment" not in channels:
                errors.append("%s runtime-marker is only valid in an HTML comment" % item_id)
            if origin != "framework-runtime":
                errors.append("%s runtime-marker must use origin framework-runtime" % item_id)
            if len(str(text)) > 80 or re.search(r"\s{1,}", str(text)):
                errors.append("%s runtime-marker must be a compact framework marker, not prose" % item_id)

        flags = set(str(flag) for flag in item.get("flags", []) if isinstance(flag, str)) if isinstance(item.get("flags"), list) else set()
        evidence_exception = origin in EVIDENCE_EXCEPTION_ORIGINS and evidence_present(evidence)
        hard_flags = flags & {"brief-overlap", "promotional-language", "possible-technical-leak", "embedded-instruction-like-text"}
        for flag in sorted(hard_flags):
            if purpose == "machine-identifier" and flag in {"brief-overlap", "possible-technical-leak"}:
                continue
            if flag == "promotional-language" and purpose in {"approved-product-copy", "approved-content"} and evidence_present(evidence):
                continue
            if evidence_exception and purpose in {"domain-object", "domain-field", "domain-value", "task-help", "approved-content", "approved-product-copy"}:
                continue
            errors.append("%s has unresolved %s flag: %r" % (item_id, flag, text))
        soft_flags = flags - hard_flags - {"approved-copy-exact"}
        if soft_flags:
            message = "%s has review flags %s" % (item_id, ", ".join(sorted(soft_flags)))
            if fail_on_soft_flags:
                errors.append(message)
            else:
                warnings.append(message)
    return errors, warnings


def cmd_check(args: argparse.Namespace) -> int:
    try:
        data = load_json(Path(args.inventory).resolve())
    except ValueError as exc:
        print("ERROR: %s" % exc, file=sys.stderr)
        return 1
    errors, warnings = validate_inventory(data, allow_static=args.allow_static, fail_on_soft_flags=args.fail_on_soft_flags)
    for warning in warnings:
        print("WARNING: %s" % warning, file=sys.stderr)
    if errors:
        for error in errors:
            print("ERROR: %s" % error, file=sys.stderr)
        print("Content audit failed: %d errors, %d warnings." % (len(errors), len(warnings)), file=sys.stderr)
        return 1
    count = len(data.get("items", [])) if isinstance(data, dict) and isinstance(data.get("items"), list) else 0
    print("Content audit passed (%d classified strings, %d warnings)." % (count, len(warnings)))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    seed = subparsers.add_parser("seed", help="Create/update an inventory from one or more captures")
    seed.add_argument("--capture", action="append", required=True, help="DOM/static capture JSON; repeat for multiple states")
    seed.add_argument("--output", required=True)
    seed.add_argument("--profile", choices=sorted(PROFILES), required=True)
    seed.add_argument("--brief-file", action="append", default=[], help="Task/design brief used only for overlap detection")
    seed.add_argument("--approved-copy-file", action="append", default=[], help="Explicit copy source; text or JSON")
    seed.add_argument("--existing", help="Existing inventory whose reviewed classifications should be preserved by exact text")
    seed.set_defaults(func=cmd_seed)

    static_scan = subparsers.add_parser("static-scan", help="Provisional browserless source scan")
    static_scan.add_argument("--root", required=True)
    static_scan.add_argument("--output", required=True)
    static_scan.add_argument("--include-code-strings", action="store_true")
    static_scan.set_defaults(func=cmd_static_scan)

    check = subparsers.add_parser("check", help="Validate a reviewed inventory")
    check.add_argument("--inventory", required=True)
    check.add_argument("--allow-static", action="store_true", help="Permit provisional static/mixed capture")
    check.add_argument("--fail-on-soft-flags", action="store_true")
    check.set_defaults(func=cmd_check)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
