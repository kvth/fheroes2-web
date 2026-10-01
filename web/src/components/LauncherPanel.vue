<script setup lang="ts">
import { computed, ref } from 'vue';
import ProgressBar from './ProgressBar.vue';
import { engine, startGame } from '../lib/engine';
import { downloadBlob, formatBytes, formatDate } from '../lib/format';
import { removeGameData, type GameDataInfo } from '../lib/gamedata';
import { deleteSave, exportSaves, importSaves, listSaves } from '../lib/saves';

const props = defineProps<{ gameData: GameDataInfo }>();
const emit = defineEmits<{
    'replace-data': [];
    'removed-data': [];
}>();

const saves = ref(listSaves());
const saveInput = ref<HTMLInputElement>();
const message = ref<{ type: 'success' | 'error'; text: string } | null>(null);

const download = computed(() => engine.download);
const waitingForEngine = computed(() => engine.started && !engine.running);

const details = computed(() =>
    [
        `${props.gameData.maps} ${props.gameData.maps === 1 ? 'map' : 'maps'}`,
        props.gameData.music ? 'music' : 'no music'
    ].join(' · ')
);

const refreshSaves = () => (saves.value = listSaves());

const onExport = () => {
    message.value = null;
    downloadBlob(exportSaves(), `fheroes2-saves-${new Date().toISOString().slice(0, 10)}.zip`);
};

const onImport = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = '';
    message.value = null;
    try {
        const names = await importSaves(files, overwritten =>
            confirm(`Replace these existing saved games?\n\n${overwritten.join('\n')}`)
        );
        refreshSaves();
        if (names.length > 0) {
            message.value = { type: 'success', text: `Imported ${names.length} saved ${names.length === 1 ? 'game' : 'games'}.` };
        }
    } catch (err) {
        message.value = { type: 'error', text: err instanceof Error ? err.message : String(err) };
    }
};

const onDeleteSave = async (name: string) => {
    if (!confirm(`Delete the saved game “${name}”?`)) return;
    message.value = null;
    await deleteSave(name);
    refreshSaves();
};

const onRemoveData = async () => {
    if (!confirm('Remove the game files from this browser? Your saved games are kept.')) return;
    await removeGameData();
    emit('removed-data');
};
</script>

<template>
  <section class="launcher">
    <div class="play">
      <p class="edition">{{ gameData.edition }}</p>
      <p class="details muted">{{ details }}</p>

      <button class="btn btn-primary btn-large" :disabled="engine.started" @click="startGame">
        {{ engine.started ? 'Starting…' : 'Play' }}
      </button>

      <ProgressBar
        v-if="waitingForEngine && download.total > 0 && download.loaded < download.total"
        class="play-progress"
        :value="download.loaded / download.total"
        :label="`Loading the game engine · ${formatBytes(download.loaded)} of ${formatBytes(download.total)}`"
      />
    </div>

    <div class="saves">
      <div class="saves-header">
        <h3>Saved games <span class="count muted">{{ saves.length }}</span></h3>
        <div class="saves-actions">
          <button class="btn btn-small" @click="saveInput?.click()">Import</button>
          <button class="btn btn-small" :disabled="saves.length === 0" @click="onExport">Export all</button>
        </div>
      </div>

      <ul v-if="saves.length > 0" class="save-list">
        <li v-for="save in saves" :key="save.name">
          <span class="save-name" :title="save.name">{{ save.name.replace(/\.sav[chm]?$/i, '') }}</span>
          <span class="save-date muted">{{ formatDate(save.date) }}</span>
          <button class="delete" :aria-label="`Delete ${save.name}`" title="Delete" @click="onDeleteSave(save.name)">×</button>
        </li>
      </ul>
      <p v-else class="empty muted">
        No saved games yet. Save in the game, or import saves exported from another browser.
      </p>

      <p v-if="message" class="notice" :class="message.type" role="status">{{ message.text }}</p>

      <input
        ref="saveInput"
        class="visually-hidden"
        type="file"
        multiple
        accept=".zip,.sav,.savc,.savh,.savm"
        tabindex="-1"
        @change="onImport"
      >
    </div>

    <div class="data-actions">
      <button class="btn btn-small" :disabled="engine.started" @click="emit('replace-data')">Change game files</button>
      <button class="btn btn-small btn-danger" :disabled="engine.started" @click="onRemoveData">Remove game files</button>
    </div>
  </section>
</template>

<style scoped>
.launcher {
    display: flex;
    flex-direction: column;
    gap: 28px;
}

.play {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
}

.edition {
    font-family: var(--heading);
    font-size: 1.3rem;
    color: var(--text);
    text-align: center;
}

.details {
    font-size: 0.9rem;
    margin-bottom: 14px;
}

.play-progress {
    width: min(360px, 100%);
    margin-top: 14px;
}

.saves {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 20px;
    background: var(--card);
    border: 1px solid var(--border-soft);
    border-radius: 12px;
}

.saves-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px;
}

.count {
    font-family: system-ui, sans-serif;
    font-size: 0.85rem;
    font-weight: 400;
    margin-left: 4px;
}

.saves-actions {
    display: flex;
    gap: 8px;
}

.save-list {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 264px;
    overflow-y: auto;
    border-top: 1px solid var(--border-soft);
}

.save-list li {
    display: grid;
    grid-template-columns: 1fr auto auto;
    align-items: center;
    gap: 12px;
    padding: 8px 4px;
    border-bottom: 1px solid var(--border-soft);
}

.save-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.save-date {
    font-size: 0.85rem;
    white-space: nowrap;
}

.delete {
    font: inherit;
    font-size: 1.25rem;
    line-height: 1;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: none;
    color: var(--muted);
    cursor: pointer;
}

.delete:hover {
    color: var(--danger);
    background: rgba(233, 139, 116, 0.1);
}

.delete:focus-visible {
    outline: 2px solid var(--gold-light);
}

.empty {
    font-size: 0.95rem;
}

.data-actions {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 10px;
}

@media (max-width: 480px) {
    .save-date {
        display: none;
    }
}
</style>
