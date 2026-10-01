<script setup lang="ts">
import { ref } from 'vue';
import ProgressBar from './ProgressBar.vue';
import { formatBytes } from '../lib/format';
import { DEMO_URL, entriesFromFiles, installGameData, type GameDataInfo } from '../lib/gamedata';

withDefaults(defineProps<{ canCancel?: boolean }>(), { canCancel: false });
const emit = defineEmits<{
    installed: [info: GameDataInfo | null];
    cancel: [];
}>();

const folderInput = ref<HTMLInputElement>();
const zipInput = ref<HTMLInputElement>();
const progress = ref<{ done: number; total: number } | null>(null); // while installing
const error = ref('');
const dragging = ref(false);

const install = async (files: File[]) => {
    if (!files?.length || progress.value) return;
    error.value = '';
    progress.value = { done: 0, total: 0 };
    try {
        const entries = await entriesFromFiles(files);
        const info = await installGameData(entries, (done, total) => (progress.value = { done, total }));
        emit('installed', info);
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        progress.value = null;
    }
};

const onPicked = (event: Event) => {
    const input = event.target as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = '';
    install(files);
};

const onDrop = (event: DragEvent) => {
    dragging.value = false;
    const files = [...(event.dataTransfer?.files ?? [])];
    if (files.length === 1 && /\.zip$/i.test(files[0]!.name)) {
        install(files);
    } else {
        error.value = 'Drop a single zip file here, or use “Select game folder” for a folder.';
    }
};
</script>

<template>
  <section
    class="setup"
    :class="{ dragging }"
    @dragover.prevent="dragging = true"
    @dragleave.self="dragging = false"
    @drop.prevent="onDrop"
  >
    <div class="intro">
      <h2>Set up your game</h2>
      <p class="muted">
        fheroes2 needs the files of the original game. Pick your own copy, or start with the free demo.
      </p>
    </div>

    <div v-if="progress" class="installing">
      <ProgressBar
        :value="progress.total ? progress.done / progress.total : 0"
        :label="progress.total ? `Copying game files · ${formatBytes(progress.done)} of ${formatBytes(progress.total)}` : 'Reading files…'"
      />
    </div>

    <div v-else class="options">
      <article class="card">
        <div class="card-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M14.5 6.5 18 3h3v3l-3.5 3.5M5 14l4 4M7 17l-3 3M3 19l2 2" /></svg>
        </div>
        <h3>I own the game</h3>
        <p class="muted">
          Select your Heroes of Might and Magic II folder, e.g. from GOG or the CD. It must contain
          <code>DATA</code>, and may contain <code>MAPS</code>, <code>MUSIC</code> and <code>ANIM</code>.
          A zip of that folder works too.
        </p>
        <div class="actions">
          <button class="btn btn-primary" @click="folderInput?.click()">Select game folder</button>
          <button class="btn" @click="zipInput?.click()">Select zip file</button>
        </div>
      </article>

      <article class="card">
        <div class="card-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM12 7v10M8 11h8" /></svg>
        </div>
        <h3>Try the free demo</h3>
        <p class="muted">
          The official demo with one map, <em>Broken Alliance</em>. Download it from archive.org, then load the
          downloaded <code>h2demo.zip</code> here.
        </p>
        <div class="actions">
          <a class="btn" :href="DEMO_URL" target="_blank" rel="noopener">Download demo (21 MB)</a>
          <button class="btn btn-primary" @click="zipInput?.click()">Load h2demo.zip</button>
        </div>
      </article>
    </div>

    <p v-if="error" class="notice error" role="alert">{{ error }}</p>

    <p v-if="!progress" class="drop-hint muted">You can also drop a zip file anywhere on this panel.</p>

    <div v-if="canCancel && !progress" class="cancel">
      <button class="btn btn-small" @click="emit('cancel')">Keep the current game files</button>
    </div>

    <input ref="folderInput" class="visually-hidden" type="file" webkitdirectory multiple tabindex="-1" @change="onPicked">
    <input ref="zipInput" class="visually-hidden" type="file" accept=".zip" tabindex="-1" @change="onPicked">
  </section>
</template>

<style scoped>
.setup {
    display: flex;
    flex-direction: column;
    gap: 20px;
    border-radius: 12px;
    outline: 2px dashed transparent;
    outline-offset: 8px;
    transition: outline-color 0.15s;
}

.setup.dragging {
    outline-color: var(--gold);
}

.intro {
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.options {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 16px;
}

.card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 22px;
    background: var(--card);
    border: 1px solid var(--border-soft);
    border-radius: 12px;
    transition: border-color 0.15s;
}

.card:hover {
    border-color: var(--border);
}

.card-icon {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border: 1px solid var(--border);
    border-radius: 50%;
    background: radial-gradient(circle, rgba(242, 193, 78, 0.12), transparent 70%);
    color: var(--gold);
}

.card-icon svg {
    width: 22px;
    height: 22px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
}

.card p {
    flex: 1;
    font-size: 0.95rem;
}

.actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 6px;
}

code {
    font-size: 0.85em;
    color: var(--text);
}

.installing {
    padding: 12px 0;
}

.drop-hint {
    text-align: center;
    font-size: 0.85rem;
}

.cancel {
    text-align: center;
}
</style>
