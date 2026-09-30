#!/usr/bin/env bash
# Build the WebAssembly version of fheroes2 (https://github.com/ihhub/fheroes2) in a podman container
# (see Dockerfile) and write the results into an output directory.
set -euo pipefail

usage() {
    cat <<EOF
Usage: $(basename "$0") [options]

Options:
  -r, --ref REF         branch, tag or full commit hash to build (default: 5affbfbba6bcc38eedbfa91cc0e4494cda2c3eb3)
      --repo URL        git repository to build from (default: https://github.com/ihhub/fheroes2.git)
  -o, --output DIR      output directory, replaced on every build (default: docs/ next to this script)
  -t, --threads         build with multithreading support (needs COOP/COEP headers on the web server)
  -d, --debug           build in debug mode (also produces fheroes2.wasm.map)
  -s, --strict          build in strict compilation mode (warnings are errors)
      --emsdk VERSION   emscripten/emsdk image version (default: from Dockerfile)
      --no-cache        do not use the podman build cache
  -h, --help            show this help

Results: fheroes2.{js,wasm,data} + the stock launcher index.html, ready to be served (e.g. by GitHub Pages)
EOF
}

repo=https://github.com/ihhub/fheroes2.git
ref=5affbfbba6bcc38eedbfa91cc0e4494cda2c3eb3
output=
threads=
debug=
strict=
build_args=()
podman_args=()

while [[ $# -gt 0 ]]; do
    case "$1" in
        -r|--ref) ref="$2"; shift 2 ;;
        --repo) repo="$2"; shift 2 ;;
        -o|--output) output="$2"; shift 2 ;;
        -t|--threads) threads=ON; shift ;;
        -d|--debug) debug=ON; shift ;;
        -s|--strict) strict=ON; shift ;;
        --emsdk) build_args+=(--build-arg "EMSDK_VERSION=$2"); shift 2 ;;
        --no-cache) podman_args+=(--no-cache); shift ;;
        -h|--help) usage; exit 0 ;;
        *) echo "unknown option: $1" >&2; usage >&2; exit 1 ;;
    esac
done

# resolve the ref to a commit hash, so a moved branch invalidates the podman layer cache
if [[ "$ref" =~ ^[0-9a-fA-F]{40}$ ]]; then
    commit="$ref"
else
    refs="$(git ls-remote "$repo" "refs/heads/$ref" "refs/tags/$ref" "refs/tags/$ref^{}")"
    # prefer the peeled commit of annotated tags, then tags, then branches
    commit="$(awk -v r="$ref" '$2 == "refs/tags/" r "^{}" { print $1; exit }' <<<"$refs")"
    [[ -n "$commit" ]] || commit="$(awk -v r="$ref" '$2 == "refs/tags/" r { print $1; exit }' <<<"$refs")"
    [[ -n "$commit" ]] || commit="$(awk -v r="$ref" '$2 == "refs/heads/" r { print $1; exit }' <<<"$refs")"
    if [[ -z "$commit" ]]; then
        echo "error: '$ref' is neither a branch nor a tag of $repo (commits must be given as full 40 character hashes)" >&2
        exit 1
    fi
fi
echo "Building $repo @ $ref ($commit)"

script_dir="$(dirname "$(realpath "$0")")"
output="$(realpath -m "${output:-$script_dir/docs}")"
cd "$script_dir"

# export into a temporary directory first, so the output directory only gets replaced by a successful build
mkdir -p "$(dirname "$output")"
tmp="$(mktemp -d "$(dirname "$output")/.build.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT

podman build "${podman_args[@]}" "${build_args[@]}" \
    --build-arg "FHEROES2_REPO=$repo" \
    --build-arg "FHEROES2_REF=$commit" \
    --build-arg "FHEROES2_WITH_THREADS=$threads" \
    --build-arg "FHEROES2_WITH_DEBUG=$debug" \
    --build-arg "FHEROES2_STRICT_COMPILATION=$strict" \
    --target out --output "type=local,dest=$tmp" .

rm -rf "$output"
mv "$tmp" "$output"
chmod 755 "$output"
echo "Done: $output"
