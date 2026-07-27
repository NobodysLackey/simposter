<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSettingsStore } from '@/stores/settings'
import { getApiBase } from '@/services/apiBase'
import AudiobookGrid from '@/components/audiobooks/AudiobookGrid.vue'
import AudiobookEditorPane from '@/components/editor/AudiobookEditorPane.vue'

interface AudiobookLibrary {
  id: string
  title: string
  type: string
}

interface Audiobook {
  key: string
  title: string
  author: string
  year?: number | string | null
  addedAt?: number | null
  poster?: string | null
  library_id: string
  mediaType?: 'audiobook'
}

const props = defineProps<{ search?: string }>()

const apiBase = getApiBase()
const route = useRoute()
const router = useRouter()
const settings = useSettingsStore()

const libraries = ref<AudiobookLibrary[]>([])
const selectedLibraryId = ref((route.query.library as string) || '')
const audiobooks = ref<Audiobook[]>([])
const selectedBook = ref<Audiobook | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const page = ref(Number(route.query.page) || 1)
const sortBy = ref<'title' | 'year' | 'addedAt'>((route.query.sortBy as any) || 'title')
const sortOrder = ref<'asc' | 'desc'>((route.query.sortOrder as any) || 'asc')

const pageSize = computed(() => settings.posterDensity.value || 20)

const normalizeCoverUrl = (book: Audiobook) => {
  const url = book.poster || `/api/audiobook/${book.key}/cover`
  return url.startsWith('http') ? url : `${apiBase}${url}`
}

const filtered = computed(() => {
  const term = (props.search || '').trim().toLowerCase()
  if (!term) return audiobooks.value
  return audiobooks.value.filter((book) =>
    `${book.title} ${book.author || ''} ${book.year || ''}`.toLowerCase().includes(term),
  )
})

const sorted = computed(() => {
  const list = [...filtered.value]
  const multiplier = sortOrder.value === 'asc' ? 1 : -1

  if (sortBy.value === 'title') {
    list.sort((a, b) => multiplier * a.title.localeCompare(b.title))
  } else if (sortBy.value === 'year') {
    list.sort((a, b) => multiplier * ((Number(a.year) || 0) - (Number(b.year) || 0)))
  } else {
    list.sort((a, b) => multiplier * ((a.addedAt || 0) - (b.addedAt || 0)))
  }

  return list
})

const totalPages = computed(() => Math.max(1, Math.ceil(sorted.value.length / pageSize.value)))
const paged = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return sorted.value.slice(start, start + pageSize.value)
})

const loadLibraries = async () => {
  error.value = null
  try {
    const response = await fetch(`${apiBase}/api/audiobook-libraries`)
    if (!response.ok) throw new Error(await response.text())
    libraries.value = await response.json()

    if (!selectedLibraryId.value && libraries.value.length > 0) {
      selectedLibraryId.value = libraries.value[0]!.id
    }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Failed to load Plex music libraries.'
  }
}

const loadAudiobooks = async () => {
  if (!selectedLibraryId.value) return
  loading.value = true
  error.value = null
  try {
    const response = await fetch(
      `${apiBase}/api/audiobooks?library_id=${encodeURIComponent(selectedLibraryId.value)}`,
    )
    if (!response.ok) throw new Error(await response.text())
    const data = (await response.json()) as Audiobook[]
    audiobooks.value = data.map((book) => ({
      ...book,
      poster: normalizeCoverUrl(book),
      mediaType: 'audiobook',
    }))

    const editKey = route.query.edit as string
    if (editKey && !selectedBook.value) {
      const item = audiobooks.value.find((book) => String(book.key) === String(editKey))
      if (item) selectedBook.value = item
    }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Failed to load audiobook albums.'
  } finally {
    loading.value = false
  }
}

const refreshData = async () => {
  page.value = 1
  await loadAudiobooks()
}

const forceCoverRefresh = async () => {
  audiobooks.value = audiobooks.value.map((book) => ({
    ...book,
    poster: `${apiBase}/api/audiobook/${book.key}/cover?v=${Date.now()}`,
  }))
}

const refreshCover = (ratingKey: string) => {
  const item = audiobooks.value.find((book) => book.key === ratingKey)
  if (item) item.poster = `${apiBase}/api/audiobook/${ratingKey}/cover?v=${Date.now()}`
}

const openEditor = (book: Audiobook) => {
  selectedBook.value = book
  router.push({ query: { ...route.query, edit: book.key } })
}

const closeEditor = () => {
  selectedBook.value = null
  const { edit, ...remainingQuery } = route.query
  router.replace({ query: remainingQuery })
}

const updateBookCover = (url: string) => {
  if (!selectedBook.value) return
  const absolute = url.startsWith('http') ? url : `${apiBase}${url}`
  selectedBook.value.poster = absolute
  const item = audiobooks.value.find((book) => book.key === selectedBook.value?.key)
  if (item) item.poster = absolute
}

const nextPage = () => {
  if (page.value < totalPages.value) page.value += 1
}

const prevPage = () => {
  if (page.value > 1) page.value -= 1
}

watch(selectedLibraryId, async (libraryId) => {
  if (!libraryId) return
  selectedBook.value = null
  page.value = 1
  await router.replace({ query: { library: libraryId } })
  await loadAudiobooks()
})

watch([page, sortBy, sortOrder], () => {
  if (selectedBook.value) return
  const query: Record<string, string> = {}
  if (selectedLibraryId.value) query.library = selectedLibraryId.value
  if (page.value > 1) query.page = String(page.value)
  if (sortBy.value !== 'title') query.sortBy = sortBy.value
  if (sortOrder.value !== 'asc') query.sortOrder = sortOrder.value
  router.replace({ query })
})

watch(pageSize, () => {
  page.value = 1
})

watch(() => props.search, () => {
  page.value = 1
})

watch(filtered, () => {
  if (page.value > totalPages.value) page.value = totalPages.value
})

watch(() => route.query.edit, (editKey) => {
  if (!editKey && selectedBook.value) {
    selectedBook.value = null
  } else if (editKey && !selectedBook.value) {
    const item = audiobooks.value.find((book) => String(book.key) === String(editKey))
    if (item) selectedBook.value = item
  }
})

onMounted(async () => {
  await loadLibraries()
  await loadAudiobooks()
})
</script>

<template>
  <AudiobookEditorPane
    v-if="selectedBook"
    :audiobook="selectedBook"
    @close="closeEditor"
    @cover-updated="updateBookCover"
  />

  <div v-else class="view">
    <div class="toolbar glass">
      <div class="controls">
        <div class="control-group">
          <label for="audiobook-library">Library:</label>
          <select id="audiobook-library" v-model="selectedLibraryId" class="control-select">
            <option v-for="library in libraries" :key="library.id" :value="library.id">
              {{ library.title }}
            </option>
          </select>
        </div>
        <div class="control-group">
          <label for="audiobook-sort">Sort by:</label>
          <select id="audiobook-sort" v-model="sortBy" class="control-select">
            <option value="title">Title</option>
            <option value="year">Year</option>
            <option value="addedAt">Date Added</option>
          </select>
        </div>
        <div class="control-group">
          <label for="audiobook-order">Order:</label>
          <select id="audiobook-order" v-model="sortOrder" class="control-select">
            <option value="asc">{{ sortBy === 'title' ? 'A-Z' : 'Oldest First' }}</option>
            <option value="desc">{{ sortBy === 'title' ? 'Z-A' : 'Newest First' }}</option>
          </select>
        </div>
        <button class="refresh-btn" :disabled="loading" @click="refreshData">
          {{ loading ? 'Refreshing...' : 'Refresh Cache' }}
        </button>
        <button class="refresh-btn danger" :disabled="loading" @click="forceCoverRefresh">
          Force Cover Refresh
        </button>
      </div>
    </div>

    <div v-if="error" class="callout error">
      <p>{{ error }}</p>
      <button @click="refreshData">Retry</button>
    </div>
    <div v-else-if="loading" class="callout">Loading audiobooks…</div>
    <div v-else-if="libraries.length === 0" class="callout">
      No Plex music libraries were found.
    </div>
    <AudiobookGrid
      v-else
      heading="Audiobooks"
      :items="paged"
      @select="openEditor"
      @refresh="refreshCover"
    />

    <div class="toolbar glass pagination">
      <div class="pager">
        <button :disabled="page === 1" @click="prevPage">Prev</button>
        <span>{{ page }} / {{ totalPages }}</span>
        <button :disabled="page === totalPages" @click="nextPage">Next</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.view {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  padding: 12px;
  flex-wrap: wrap;
}

.toolbar.pagination {
  justify-content: center;
}

.controls {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.control-group label {
  font-size: 13px;
  color: #dce6ff;
  font-weight: 500;
}

.control-select {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 7px 10px;
  background: rgba(255, 255, 255, 0.04);
  color: #e6edff;
  font-size: 13px;
  cursor: pointer;
}

.refresh-btn {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 7px 14px;
  background: rgba(61, 214, 183, 0.15);
  color: #3dd6b7;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  margin: 0;
}

.refresh-btn.danger {
  border-color: rgba(255, 107, 107, 0.5);
  background: rgba(255, 107, 107, 0.12);
  color: #ffb3b3;
}

.pager {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #dce6ff;
}

.pager button,
.callout button {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.05);
  color: #dce6ff;
  cursor: pointer;
}

.callout {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  color: #e1e8ff;
}

.callout.error {
  border-color: rgba(255, 126, 126, 0.4);
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 900px) {
  .controls {
    gap: 10px;
    width: 100%;
  }

  .control-group {
    flex: 1;
    min-width: 120px;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .control-select,
  .refresh-btn {
    width: 100%;
  }
}
</style>
