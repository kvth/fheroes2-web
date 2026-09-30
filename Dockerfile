ARG EMSDK_VERSION=6.0.10
FROM docker.io/emscripten/emsdk:${EMSDK_VERSION} AS build

# install dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends gettext git && \
    rm -rf /var/lib/apt/lists/*

# pre-build the emscripten ports and system libraries used by fheroes2 (see src/dist/Makefile.emscripten upstream),
# so they are cached in an image layer and not rebuilt for every new fheroes2 commit
RUN echo "int main() { return 0; }" > /tmp/noop.cpp && \
    for flags in "-O0" "-O3 -flto" "-O0 -pthread" "-O3 -flto -pthread"; do \
        em++ $flags --use-port=sdl2 --use-port=sdl2_mixer --use-port=zlib -sSDL2_MIXER_FORMATS=mid,mp3,ogg \
            -sNO_DISABLE_EXCEPTION_CATCHING -lGL -lhtml5 -lidbfs.js -o /tmp/noop.js /tmp/noop.cpp || exit 1; \
    done && \
    rm -f /tmp/noop.*

# fetch the sources; FHEROES2_REF may be a branch, tag or full commit hash
# (build_emscripten.sh resolves it to a commit hash so the layer cache is invalidated on new commits)
ARG FHEROES2_REPO=https://github.com/ihhub/fheroes2.git
ARG FHEROES2_REF=5affbfbba6bcc38eedbfa91cc0e4494cda2c3eb3
WORKDIR /src
RUN git init -q . && \
    git remote add origin "$FHEROES2_REPO" && \
    git fetch -q --depth 1 origin "$FHEROES2_REF" && \
    git checkout -q FETCH_HEAD && \
    git log -1 --format='Building fheroes2 %H (%cd)'

# build (the options are passed only when set, because upstream checks them with "ifdef")
ARG FHEROES2_WITH_THREADS=
ARG FHEROES2_WITH_DEBUG=
ARG FHEROES2_STRICT_COMPILATION=
RUN set -e; \
    for opt in FHEROES2_WITH_THREADS FHEROES2_WITH_DEBUG FHEROES2_STRICT_COMPILATION; do \
        eval "val=\${$opt}"; \
        if [ -n "$val" ]; then export "$opt=ON"; else unset "$opt"; fi; \
    done; \
    emmake make -f Makefile.emscripten -j"$(nproc)"

# collect the files needed to host the game (translations, H2D files and FH2M maps are already bundled into fheroes2.data);
# .nojekyll stops GitHub Pages from running Jekyll on the output
RUN mkdir -p /out && \
    cp LICENSE changelog.txt docs/README.txt fheroes2.data fheroes2.js fheroes2.wasm* files/emscripten/* /out/ && \
    git rev-parse HEAD > /out/COMMIT && \
    touch /out/.nojekyll

# add export/import of save games to the stock launcher (see launcher/savegames.js)
COPY launcher/savegames.js /out/
RUN grep -q '</body>' /out/index.html && \
    sed -i 's#</body>#<script src="./savegames.js"></script>\n</body>#' /out/index.html

# only the build results, export them with: podman build --target out --output type=local,dest=<dir> .
FROM scratch AS out
COPY --from=build /out/ /
