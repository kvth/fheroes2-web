# fheroes2-wasm-build

Helper scripts to build official [fheroes2](https://github.com/ihhub/fheroes2) with its built-in Emscripten
(WebAssembly) support, using podman, and host it via GitHub Pages. Only podman and git are needed on the host.

## Usage

```sh
./build_emscripten.sh                      # the pinned default commit (5affbfbba6bcc38eedbfa91cc0e4494cda2c3eb3)
./build_emscripten.sh -r master            # latest commit of master
./build_emscripten.sh -r 1.1.17            # a tag
./build_emscripten.sh -r some-branch       # a branch
./build_emscripten.sh -r <40-char-hash>    # a specific commit
./build_emscripten.sh --help               # all options
```

The ref is resolved to a commit hash before building, so a new commit on a branch always triggers a rebuild,
while rebuilding the same commit is served from the podman cache.
Upstream Emscripten support (`Makefile.emscripten`) exists since release 1.1.6, older refs cannot be built.

The result replaces the contents of `docs/` (override with `-o DIR`): `fheroes2.{js,wasm,data}`, the stock
launcher (`index.html`), license, readme and a `COMMIT` file with the built commit hash.

## Hosting

**GitHub Pages:** commit and push `docs/`, then in the repository settings under *Pages* choose
*Deploy from a branch*, branch `main`, folder `/docs`.

**Locally:**

```sh
./serve.sh              # http://127.0.0.1:8888/, or: ./serve.sh 0.0.0.0 8080
```

The original game data is not included; the stock launcher asks you to pick your game directory in the browser.
It must contain `data/` (`HEROES2.AGG`, `HEROES2X.AGG`) and optionally `maps/` and `music/`.

Without the original game, the launcher offers the free demo instead (the browser version of upstream's
`script/demo` scripts, see [launcher/demo.js](launcher/demo.js)): download `h2demo.zip` via the link
(archive.org does not allow downloading it from the page directly), then load it with
*Load the downloaded h2demo.zip*. The archive is checked against its SHA-256, unpacked and the game starts.

## Save games

Saves only live in the browser (IndexedDB). The build adds two buttons to the stock launcher
(from [launcher/savegames.js](launcher/savegames.js), zip handling in [launcher/zip.js](launcher/zip.js)):

* **Export saves** downloads all save games as `fheroes2-saves-<date>.zip`
* **Import saves** accepts such zip files (or any zip containing save files) and single `.sav`, `.savc`, `.savh`
  and `.savm` files, asking before overwriting existing saves

The save files are regular fheroes2 save games. The buttons are only available on the launcher screen,
so reload the page after saving in-game to export the new saves.

## Multithreading

Multithreaded builds (`-t`) need the following headers, which GitHub Pages and `serve.sh` do not send,
so use the default single-threaded build there:

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```
