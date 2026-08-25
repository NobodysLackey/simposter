<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSettingsStore } from '@/stores/settings'
import { getApiBase } from '@/services/apiBase'
import AudiobookGrid from '@/components/audiobooks/AudiobookGrid.vue'
import AudiobookEditorPaneV2 from '@/components/editor/AudiobookEditorPaneV2.vue'

interface AudiobookLibrary {
  id: string
  title: string
  type: string
}

interface AudiobookLibraryMapping {
  id: string
  title?: string
  display_name?: string
  enabled?: boolean
  default_preset_id?: string
}

interface AudiobookSettings {
  enabled: boolean
  library_mappings: AudiobookLibraryMapping[]
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

const discoveredLibraries = ref<AudiobookLibrary[]>([])
const audiobookSettings = ref<AudiobookSettings>({ enabled: true, library_mappings: [] })
const selectedLibraryId = ref((route.query.library as string) || '')
const audiobooks = ref<Audiobook[]>([])
const selectedBook = ref<Audiobook | null>(null)
const loading = ref(false)
const configurationLoading = ref(true)
const initialized = ref(false)
const error = ref<string | null>(null)
const page = ref(Number(route.query.page) || 1)
const sortBy = ref<'title' | 'year' | 'addedAt'>((route.query.sortBy as any) || 'title')
const sortOrder = ref<'asc' | 'desc'>((route.query.sortOrder as any) || 'asc')

const pageSize = computed(() => settings.posterDensity.value || 20)

const libraries = computed<AudiobookLibrary[]>(() => {
  const mappings = audiobookSettings.value.library_mappings || []
  if (!mappings.length) return discoveredLibraries.value

  const enabledMappings = mappings.filter((mapping) => mapping.enabled !== false)
  return enabledMappings
    .map((mapping) => {
      const discovered = discoveredLibraries.value.find((library) => String(library.id) === String(mapping.id))
      if (!discovered) return null
      return {
        ...discovered,
        title: mapping.display_name || mapping.title || discovered.title,
      }
    })
    .filter((library): library is AudiobookLibrary => Boolean(library))
})

const activeLibrary = computed(() =>
  libraries.value.find((library) => String(library.id) === String(selectedLibraryId.value)),
)

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

const loadConfiguration = async () => {
  configurationLoading.value = true
  error.value = null
  try {
    const [settingsResponse, librariesResponse] = await Promise.all([
      fetch(`${apiBase}/api/audiobook-settings`),
      fetch(`${apiBase}/api/audiobook-libraries`),
    ])
    if (!settingsResponse.ok) throw new Error(await settingsResponse.text())
    if (!librariesResponse.ok) throw new Error(await librariesResponse.text())
    audiobookSettings.value = await settingsResponse.json()
    discoveredLibraries.value = await librariesResponse.json()

    const requestedLibrary = String(route.query.library || selectedLibraryId.value || '')
    const requestedIsVisible = libraries.value.some((library) => String(library.id) === requestedLibrary)
    selectedLibraryId.value = requestedIsVisible ? requestedLibrary : libraries.value[0]?.id || ''
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Failed to load audiobook configuration.'
  } finally {
    configurationLoading.value = false
  }
}

const loadAudiobooks = async () => {
  if (!selectedLibraryId.value || !audiobookSettings.value.enabled) {
    audiobooks.value = []
    return
  }
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
  await loadConfiguration()
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
  if (!initialized.value || !libraryId) return
  selectedBook.value = null
  page.value = 1
  await router.replace({ query: { library: libraryId } })
  await loadAudiobooks()
})

watch(() => route.query.library, async (libraryId) => {
  if (!initialized.value || !libraryId) return
  const value = String(libraryId)
  if (value !== selectedLibraryId.value && libraries.value.some((library) => String(library.id) === value)) {
    selectedLibraryId.value = value
  }
})

watch(() => route.query.page, (routePage) => {
  if (!initialized.value) return
  const requestedPage = Math.max(1, Number(routePage) || 1)
  const nextPage = Math.min(requestedPage, totalPages.value)
  if (nextPage !== page.value) page.value = nextPage
})

watch([page, sortBy, sortOrder], () => {
  if (selectedBook.value || !initialized.value) return
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
  await loadConfiguration()
  initialized.value = true
  await loadAudiobooks()
})
</script>

<template>
  <AudiobookEditorPaneV2
    v-if="selectedBook"
    :audiobook="selectedBook"
    @close="closeEditor"
    @cover-updated="updateBookCover"
  />

  <div v-else class="view">
    <div class="toolbar glass">
      <div class="controls">
        <div v-if="libraries.length > 0" class="control-group">
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
        <button class="refresh-btn" :disabled="loading || configurationLoading" @click="refreshData">
          {{ loading || configurationLoading ? 'Refreshing...' : 'Refresh Cache' }}
        </button>
        <button class="refresh-btn danger" :disabled="loading" @click="forceCoverRefresh">
          Force Cover Refresh
        </button>
        <button class="settings-btn" @click="router.push({ name: 'audiobook-settings' })">
          ⚙️ Audiobook Settings
        </button>
      </div>
    </div>

    <div v-if="error" class="callout error">
      <p>{{ error }}</p>
      <button @click="refreshData">Retry</button>
    </div>
    <div v-else-if="configurationLoading || loading" class="callout">Loading audiobooks…</div>
    <div v-else-if="!audiobookSettings.enabled" class="callout">
      <p>Audiobook functionality is disabled.</p>
      <button @click="router.push({ name: 'audiobook-settings' })">Open Audiobook Settings</button>
    </div>
    <div v-else-if="libraries.length === 0" class="callout">
      <p>No audiobook libraries are enabled.</p>
      <button @click="router.push({ name: 'audiobook-settings' })">Configure Libraries</button>
    </div>
    <AudiobookGrid
      v-else
      :heading="activeLibrary?.title || 'Audiobooks'"
      :items="paged"
      @select="openEditor"
      @refresh="refreshCover"
    />

    <div v-if="audiobookSettings.enabled && libraries.length > 0" class="toolbar glass pagination">
      <div class="pager">
        <button :disabled="page === 1" @click="prevPage">Prev</button>
        <span>{{ page }} / {{ totalPages }}</span>
        <button :disabled="page === totalPages" @click="nextPage">Next</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.view { display: flex; flex-direction: column; gap: 16px; }
.toolbar { display: flex; align-items: center; justify-content: flex-start; gap: 12px; padding: 12px; flex-wrap: wrap; }
.toolbar.pagination { justify-content: center; }
.controls { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; width: 100%; }
.control-group { display: flex; align-items: center; gap: 8px; }
.control-group label { font-size: 13px; color: #dce6ff; font-weight: 500; }
.control-select { border: 1px solid var(--border); border-radius: 8px; padding: 7px 10px; background: rgba(255,255,255,.04); color: #e6edff; font-size: 13px; cursor: pointer; }
.refresh-btn, .settings-btn { border: 1px solid var(--border); border-radius: 8px; padding: 7px 14px; font-size: 13px; font-weight: 600; cursor: pointer; margin: 0; }
.refresh-btn { background: rgba(61,214,183,.15); color: #3dd6b7; }
.refresh-btn.danger { border-color: rgba(255,107,107,.5); background: rgba(255,107,107,.12); color: #ffb3b3; }
.settings-btn { margin-left: auto; background: rgba(91,141,238,.14); color: #b7c9ff; }
.pager { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #dce6ff; }
.pager button, .callout button { border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px; background: rgba(255,255,255,.05); color: #dce6ff; cursor: pointer; }
.callout { border: 1px solid var(--border); border-radius: 12px; padding: 14px; background: rgba(255,255,255,.03); color: #e1e8ff; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.callout.error { border-color: rgba(255,126,126,.4); }
button:disabled { opacity: .5; cursor: not-allowed; }
@media (max-width: 900px) { .settings-btn { margin-left: 0; } .controls { gap: 10px; } .control-group { flex: 1; min-width: 130px; flex-direction: column; align-items: flex-start; } .control-select { width: 100%; } }
</style>
