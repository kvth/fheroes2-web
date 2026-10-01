<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import LauncherPanel from './components/LauncherPanel.vue';
import ProgressBar from './components/ProgressBar.vue';
import SetupPanel from './components/SetupPanel.vue';
import { engine, fsReady, loadEngine } from './lib/engine';
import { formatBytes } from './lib/format';
import { gameDataInfo, type GameDataInfo } from './lib/gamedata';

// engine files are next to index.html, relative URLs keep the site working in any subdirectory (GitHub Pages)
const bannerUrl = 'fheroes2.jpeg';

const canvas = ref<HTMLCanvasElement>();
const gameData = ref<GameDataInfo | null>(null);
const replacingData = ref(false);
const commit = ref('');

const download = computed(() => engine.download);
const downloading = computed(() => download.value.total > 0 && download.value.loaded < download.value.total);

onMounted(async () => {
    loadEngine(canvas.value!);
    await fsReady;
    gameData.value = gameDataInfo();
});

// COMMIT is written by the build and contains the fheroes2 commit hash
fetch('COMMIT')
    .then(response => (response.ok ? response.text() : ''))
    .then(text => (commit.value = /^[0-9a-f]{40}$/.test(text.trim()) ? text.trim() : ''))
    .catch(() => {});

watch(() => engine.running, running => document.body.classList.toggle('playing', running));

// the engine cannot be restarted on the same page: show the launcher again by reloading it
watch(
    () => engine.quit,
    quit => quit && location.reload()
);

const onInstalled = (info: GameDataInfo | null) => {
    gameData.value = info;
    replacingData.value = false;
};
</script>

<template>
  <canvas id="canvas" ref="canvas" :class="{ visible: engine.running }" tabindex="-1" @contextmenu.prevent></canvas>

  <div v-if="!engine.running" class="page">
    <main class="panel">
      <header class="banner">
        <img :src="bannerUrl" alt="fheroes2: Resurrection">
      </header>

      <div class="content">
        <p class="tagline">
          The free implementation of <em>Heroes of Might and Magic II</em> — right here in your browser.
        </p>

        <p v-if="engine.error" class="notice error">{{ engine.error }}</p>

        <div v-else-if="!engine.fsReady" class="loading">
          <span class="spinner" aria-hidden="true"></span> Loading…
        </div>

        <LauncherPanel
          v-else-if="gameData && !replacingData"
          :game-data="gameData"
          @replace-data="replacingData = true"
          @removed-data="gameData = null"
        />

        <SetupPanel
          v-else
          :can-cancel="replacingData"
          @installed="onInstalled"
          @cancel="replacingData = false"
        />

        <ProgressBar
          v-if="downloading && !engine.started"
          class="engine-progress"
          :value="download.loaded / download.total"
          :label="`Loading the game engine · ${formatBytes(download.loaded)} of ${formatBytes(download.total)}`"
        />
      </div>
    </main>

    <footer class="footer muted">
      <p>
        <a href="https://github.com/ihhub/fheroes2" target="_blank" rel="noopener">fheroes2</a>
        is free software under the GNU GPL v2.
        <template v-if="commit">
          This is build
          <a :href="`https://github.com/ihhub/fheroes2/commit/${commit}`" target="_blank" rel="noopener"><code>{{ commit.slice(0, 10) }}</code></a>.
        </template>
      </p>
      <p>Your game files and saved games stay in this browser — nothing is uploaded.</p>
    </footer>
  </div>
</template>

<style scoped>
.page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    padding: 40px 16px 24px;
}

.panel {
    width: min(780px, 100%);
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 16px;
    overflow: hidden;
    box-shadow:
        0 24px 70px rgba(0, 0, 0, 0.65),
        0 0 0 1px rgba(242, 193, 78, 0.06) inset;
}

.banner {
    position: relative;
    border-bottom: 1px solid var(--border);
}

.banner img {
    display: block;
    width: 100%;
    height: clamp(130px, 32vw, 250px);
    object-fit: cover;
    object-position: center 52%;
}

.banner::after {
    content: '';
    position: absolute;
    inset: auto 0 0;
    height: 40%;
    background: linear-gradient(transparent, rgba(24, 18, 10, 0.7));
    pointer-events: none;
}

.content {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 28px clamp(16px, 4vw, 36px) 32px;
}

.tagline {
    text-align: center;
    font-size: 1.1rem;
    color: var(--muted);
}

.tagline em {
    color: var(--text);
}

.loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 24px;
    color: var(--muted);
}

.spinner {
    width: 22px;
    height: 22px;
    border: 3px solid var(--border);
    border-top-color: var(--gold);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

.footer {
    text-align: center;
    font-size: 0.875rem;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.footer code {
    font-size: 0.85em;
}
</style>
