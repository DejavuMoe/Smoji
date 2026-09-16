#!/bin/sh

set -eu

source_dir="${1:-}"
release_id="${2:-}"
deploy_root="${SMOJI_DEPLOY_ROOT:-/deploy}"

if [ -z "$source_dir" ] || [ -z "$release_id" ]; then
  echo "usage: $0 SITE_DIR RELEASE_ID" >&2
  exit 64
fi
if ! printf '%s' "$release_id" | grep -Eq '^[0-9a-f]{40}-[0-9]+-[0-9]+$'; then
  echo "invalid release id: $release_id" >&2
  exit 64
fi
case "$deploy_root" in
  /*) ;;
  *) echo "SMOJI_DEPLOY_ROOT must be absolute: $deploy_root" >&2; exit 64 ;;
esac
if [ "$deploy_root" = "/" ]; then
  echo "refusing to use the filesystem root as SMOJI_DEPLOY_ROOT" >&2
  exit 64
fi
if [ ! -d "$deploy_root" ] || [ -L "$deploy_root" ]; then
  echo "deployment root is not a directory: $deploy_root" >&2
  exit 66
fi
# Docker resolves an old site symlink before mounting it; reject that old release too.
if [ -e "$deploy_root/index.html" ] || [ -L "$deploy_root/index.html" ]; then
  echo "deployment root contains a legacy site; prepare the html/releases layout first" >&2
  exit 66
fi

release_root="$deploy_root/releases"
live_path="$deploy_root/html"
build_dir="$release_root/.build-$release_id"
candidate_dir="$release_root/$release_id"
next_link="$deploy_root/.next-$release_id"
rollback_link="$deploy_root/.rollback-$release_id"
lock_file="$deploy_root/.deploy.lock"

owns_paths=false
cleanup_temporary_paths() {
  [ "$owns_paths" = true ] || return 0
  [ ! -L "$next_link" ] || rm -f -- "$next_link"
  [ ! -L "$rollback_link" ] || rm -f -- "$rollback_link"
  [ ! -d "$build_dir" ] || rm -rf -- "$build_dir"
}
trap cleanup_temporary_paths EXIT HUP INT TERM

node --experimental-strip-types scripts/verify-site-output.mjs "$source_dir"

mkdir -p "$release_root"
if [ ! -d "$release_root" ] || [ -L "$release_root" ]; then
  echo "site release root is not a directory: $release_root" >&2
  exit 66
fi
exec 9>"$lock_file"
if ! flock -x -w 900 9; then
  echo "timed out waiting for the deployment lock: $lock_file" >&2
  exit 75
fi

release_root_real="$(readlink -f "$release_root")"
for reserved_path in "$build_dir" "$candidate_dir" "$next_link" "$rollback_link"; do
  if [ -e "$reserved_path" ] || [ -L "$reserved_path" ]; then
    echo "release path already exists: $reserved_path" >&2
    exit 73
  fi
done

owns_paths=true
mkdir "$build_dir"
cp -a "$source_dir"/. "$build_dir"/
find "$build_dir" -type d -exec chmod 0755 {} +
find "$build_dir" -type f -exec chmod 0644 {} +
node --experimental-strip-types scripts/verify-site-output.mjs "$build_dir"
mv -T -- "$build_dir" "$candidate_dir"


incoming_pipeline="$(printf '%s' "$release_id" | sed -E 's/^[0-9a-f]{40}-([0-9]+)-[0-9]+$/\1/')"
incoming_rerun="$(printf '%s' "$release_id" | sed -E 's/^[0-9a-f]{40}-[0-9]+-([0-9]+)$/\1/')"
old_link_value=""
old_link_target=""

if [ -L "$live_path" ]; then
  if [ ! -d "$live_path" ] || [ ! -s "$live_path/index.html" ]; then
    echo "current site symlink is not a readable site: $live_path" >&2
    exit 67
  fi
  old_link_value="$(readlink "$live_path")"
  old_link_target="$(readlink -f "$live_path")"
  case "$old_link_target" in
    "$release_root_real"/*) ;;
    *) echo "current site target is outside the release root: $old_link_target" >&2; exit 67 ;;
  esac

  current_name="$(basename "$old_link_target")"
  current_id="$current_name"
  if ! printf '%s' "$current_id" | grep -Eq '^[0-9a-f]{40}-[0-9]+-[0-9]+$'; then
    echo "current site target has an invalid release id: $current_name" >&2
    exit 67
  fi
  current_pipeline="$(printf '%s' "$current_id" | sed -E 's/^[0-9a-f]{40}-([0-9]+)-[0-9]+$/\1/')"
  current_rerun="$(printf '%s' "$current_id" | sed -E 's/^[0-9a-f]{40}-[0-9]+-([0-9]+)$/\1/')"
  if [ "$incoming_pipeline" -lt "$current_pipeline" ] || {
    [ "$incoming_pipeline" -eq "$current_pipeline" ] && [ "$incoming_rerun" -le "$current_rerun" ];
  }; then
    rm -rf -- "$candidate_dir"
    echo "stale site release skipped: $release_id is not newer than $current_id"
    trap - EXIT HUP INT TERM
    cleanup_temporary_paths
    exit 0
  fi
elif [ -e "$live_path" ]; then
  echo "refusing to replace a non-symlink site root: $live_path" >&2
  exit 67
fi

if [ ! -d "$candidate_dir" ] || [ -L "$candidate_dir" ] || [ ! -s "$candidate_dir/index.html" ]; then
  echo "site candidate is missing or invalid: $candidate_dir" >&2
  exit 66
fi

# Carry immutable assets forward so already-open pages can still fetch old chunks.
if [ -n "$old_link_target" ]; then
  cp -a -n "$old_link_target/assets"/. "$candidate_dir/assets"/
fi

candidate_name="$(basename "$candidate_dir")"
candidate_link_value="releases/$candidate_name"
ln -s "$candidate_link_value" "$next_link"
if [ ! -s "$next_link/index.html" ]; then
  echo "new site symlink does not resolve to the candidate" >&2
  exit 74
fi

if [ -L "$live_path" ]; then
  mv -T -f -- "$next_link" "$live_path"
else
  mv -T -- "$next_link" "$live_path"
fi

candidate_real="$(readlink -f "$candidate_dir")"
live_real="$(readlink -f "$live_path")"
if [ ! -L "$live_path" ] || [ "$live_real" != "$candidate_real" ] || [ ! -s "$live_path/index.html" ]; then
  echo "site activation verification failed" >&2
  if [ -n "$old_link_value" ]; then
    ln -s "$old_link_value" "$rollback_link"
    if ! mv -T -f -- "$rollback_link" "$live_path"; then
      echo "critical: failed to restore the prior site symlink" >&2
      exit 76
    fi
  else
    rm -f -- "$live_path"
  fi
  exit 74
fi

# Keep earlier releases available for an operator-controlled rollback.

trap - EXIT HUP INT TERM
cleanup_temporary_paths
echo "site activated atomically: html -> $candidate_link_value"
