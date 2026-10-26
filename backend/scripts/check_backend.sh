#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
cargo fmt --check
cargo clippy --locked --all-targets -- -D warnings
cargo test --locked
python3 scripts/generate_openapi.py --check
if [[ "${1:-}" == "--database" ]]; then
    python3 scripts/test_database.py
elif [[ $# -gt 0 ]]; then
    echo '用法：check_backend.sh [--database]' >&2
    exit 2
fi
