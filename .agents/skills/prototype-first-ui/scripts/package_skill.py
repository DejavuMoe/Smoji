#!/usr/bin/env python3
"""Create a deterministic, validated Agent Skill ZIP."""

from __future__ import annotations

import argparse
import hashlib
from pathlib import Path
import stat
import sys
import zipfile

from validate_skill import print_validation, validate_directory, validate_zip

EXCLUDED_PARTS = {".git", "__pycache__", ".pytest_cache", ".mypy_cache", "node_modules"}
EXCLUDED_NAMES = {".DS_Store", "Thumbs.db", "desktop.ini"}
FIXED_TIMESTAMP = (2024, 1, 1, 0, 0, 0)


def package(source: Path, output: Path) -> int:
    source = source.resolve()
    output = output.resolve()
    validation = validate_directory(source)
    if print_validation(validation) != 0:
        return 1

    paths = []
    for path in source.rglob("*"):
        if not path.is_file() and not path.is_symlink():
            continue
        relative = path.relative_to(source)
        if path.name in EXCLUDED_NAMES or any(part in EXCLUDED_PARTS for part in relative.parts):
            continue
        if path.is_symlink():
            print("ERROR: Refusing to package symlink: %s" % relative, file=sys.stderr)
            return 1
        paths.append(path)
    paths.sort(key=lambda value: value.relative_to(source).as_posix().casefold())

    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_name(output.name + ".tmp")
    temporary.unlink(missing_ok=True)
    with zipfile.ZipFile(temporary, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in paths:
            relative = Path(source.name) / path.relative_to(source)
            info = zipfile.ZipInfo(relative.as_posix(), date_time=FIXED_TIMESTAMP)
            info.compress_type = zipfile.ZIP_DEFLATED
            mode = path.stat().st_mode
            permissions = 0o755 if mode & stat.S_IXUSR else 0o644
            info.external_attr = (stat.S_IFREG | permissions) << 16
            info.create_system = 3
            archive.writestr(info, path.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
    temporary.replace(output)

    zip_validation = validate_zip(output)
    if print_validation(zip_validation) != 0:
        output.unlink(missing_ok=True)
        return 1
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    checksum_path = output.with_suffix(output.suffix + ".sha256")
    checksum_path.write_text("%s  %s\n" % (digest, output.name), encoding="ascii")
    print("Packaged: %s" % output)
    print("Checksum: %s" % checksum_path)
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True)
    parser.add_argument("--output", required=True)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    return package(Path(args.source), Path(args.output))


if __name__ == "__main__":
    raise SystemExit(main())
