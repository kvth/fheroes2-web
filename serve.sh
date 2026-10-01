#!/usr/bin/env bash
# Serve the web build in docs/ with Python's built-in web server.
# Usage: ./serve.sh [IP] [PORT]   (default: 127.0.0.1 8888)
set -euo pipefail

ip="${1:-127.0.0.1}"
port="${2:-8888}"
docs="$(dirname "$(realpath "$0")")/docs"

if [[ ! -f "$docs/index.html" ]]; then
    echo "error: $docs/index.html not found, run ./build.sh first" >&2
    exit 1
fi

echo "Serving $docs on http://$ip:$port/"
exec python3 -m http.server "$port" --bind "$ip" --directory "$docs"
