<script setup lang="ts">
withDefaults(
    defineProps<{
        value: number; // 0 to 1
        label?: string;
    }>(),
    { label: '' }
);
</script>

<template>
  <div class="progress">
    <div class="track" role="progressbar" :aria-valuenow="Math.round(value * 100)" aria-valuemin="0" aria-valuemax="100">
      <div class="fill" :style="{ width: `${Math.min(100, value * 100)}%` }"></div>
    </div>
    <p v-if="label" class="label muted">{{ label }}</p>
  </div>
</template>

<style scoped>
.progress {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.track {
    height: 8px;
    border-radius: 4px;
    background: var(--border-soft);
    overflow: hidden;
}

.fill {
    height: 100%;
    border-radius: 4px;
    background: linear-gradient(90deg, var(--gold-dark), var(--gold-light));
    transition: width 0.2s;
}

.label {
    font-size: 0.875rem;
    text-align: center;
}
</style>
