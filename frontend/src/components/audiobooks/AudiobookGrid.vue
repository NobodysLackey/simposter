<script setup lang="ts">
import AudiobookCard from './AudiobookCard.vue'

type Audiobook = {
  key: string
  title: string
  author: string
  year?: number | string | null
  addedAt?: number | null
  poster?: string | null
  library_id: string
}

defineProps<{
  heading: string
  items: Audiobook[]
}>()

const emit = defineEmits<{
  (e: 'select', audiobook: Audiobook): void
  (e: 'refresh', key: string): void
}>()
</script>

<template>
  <section class="grid-block">
    <div class="heading-row">
      <h2>{{ heading }}</h2>
      <p class="count">{{ items.length }} items</p>
    </div>
    <div class="grid">
      <AudiobookCard
        v-for="item in items"
        :key="item.key"
        :title="item.title"
        :author="item.author"
        :year="item.year"
        :added-at="item.addedAt"
        :poster="item.poster"
        @select="emit('select', item)"
        @refresh="emit('refresh', item.key)"
      />
    </div>
  </section>
</template>

<style scoped>
.grid-block {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.heading-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #d8e3ff;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}

.heading-row h2 {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.3px;
}

.count {
  font-size: 13px;
  color: var(--muted);
  font-weight: 500;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 14px;
}

@media (max-width: 900px) {
  .grid-block {
    gap: 12px;
  }

  .heading-row h2 {
    font-size: 18px;
  }

  .count {
    font-size: 12px;
  }

  .grid {
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 10px;
  }
}

@media (max-width: 600px) {
  .grid-block {
    gap: 10px;
  }

  .heading-row {
    padding-bottom: 6px;
  }

  .heading-row h2 {
    font-size: 16px;
  }

  .count {
    font-size: 11px;
  }

  .grid {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 8px;
  }
}
</style>
