<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSettingsStore } from '@/stores/settings'
import { getApiBase } from '@/services/apiBase'
import MusicEditorPane from '@/components/editor/MusicEditorPane.vue'

interface MusicLibrary {
  id: string
  title: string
}

interface Album {
  key: string
  title: string
  artist: string
  year?: number | null
  addedAt?: number | null
  poster?: string | null
  library_id: string
}

const props = defineProps<{ search?: string }>()

const apiBase = getApiBase()
const route = useRoute()
const router = useRouter()
const settings = useSettingsStore()

const selectedLibraryId = ref(String(route.query.library || ''))
const albums = ref<Album[]>([])
const selectedAlbum = ref<Album | null>(null)
const loading = ref(false)
const forceRefreshingCovers = ref(false)
const initialized = ref(false)
const error = ref<string | null>(null)
const page = ref(Math.max(1, Number(route.query.page) || 1))

const getDefaultSort = () => {
  const defaultSort = settings.defaultSort?.value || 'title-asc'
  const [field, order] = defaultSort.split('-')
  const sortField = field === 'added' ? 'addedAt' : field
  return {
    sortBy: (['title', 'year', 'addedAt'].includes(sortField) ? sortField : 'title') as 'title' | 'artist' | 'year' | 'addedAt',
    sortOrder: (order === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc',
  }
}

const defaultSortSettings = getDefaultSort()
const sortBy = ref<'title' | 'artist' | 'year' | 'addedAt'>(
  (route.query.sortBy as any) || defaultSortSettings.sortBy,
)
const sortOrder = ref<'asc' | 'desc'>(
  (route.query.sortOrder as any) || defaultSortSettings.sortOrder,
)

const pageSize = computed(() => settings.posterDensity.value || 20)

const libraries = computed<MusicLibrary[]>(() =>
  (settings.plex.value.configuredLibraryMappings || [])
    .filter((library) => library.contentType === 'music' && library.id)
    .map((library) => ({
      id: String(library.id),
      title: library.displayName || library.title || String(library.id),
    })),
)

const activeLibrary = computed(() =>
  libraries.value.find((library) => String(library.id) === String(selectedLibraryId.value)),
)

const normalizeCoverUrl = (album: Album) => {
  const url = album.poster || `/api/music/${album.key}/cover`
  return url.startsWith('http') ? url : `${apiBase}${url}`
}

const filtered = computed(() => {
  const term = (props.search || '').trim().toLowerCase()
  if (!term) return albums.value
  return albums.value.filter((album) =>
    `${album.title} ${album.artist || ''} ${album.year || ''}`.toLowerCase().includes(term),
  )
})

const sorted = computed(() => {
  const list = [...filtered.value]
  const multiplier = sortOrder.value === 'asc' ? 1 : -1

  if (sortBy.value === 'title') {
    list.sort((a, b) => multiplier * a.title.localeCompare(b.title))
  } else if (sortBy.value === 'artist') {
    list.sort((a, b) =>
      multiplier * (a.artist || '').localeCompare(b.artist || '') ||
      multiplier * a.title.localeCompare(b.title),
    )
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

const loadAlbums = async () => {
  if (!selectedLibraryId.value) {
    albums.value = []
    return
  }

  loading.value = true
  error.value = null
  try {
    const response = await fetch(
      `${apiBase}/api/music/albums?library_id=${encodeURIComponent(selectedLibraryId.value)}`,
    )
    if (!response.ok) throw new Error(await response.text())
    const data = (await response.json()) as Album[]
    albums.value = data.map((album) => ({
      ...album,
      poster: normalizeCoverUrl(album),
    }))
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Failed to load music library.'
  } finally {
    loading.value = false
  }
}

const refreshData = async () => {
  page.value = 1
  await loadAlbums()
}

const refreshCover = (key: string) => {
  const album = albums.value.find((item) => item.key === key)
  if (album) album.poster = `${apiBase}/api/music/${key}/cover?v=${Date.now()}`
}

const forceCoverRefresh = async () => {
  if (forceRefreshingCovers.value || loading.value) return
  forceRefreshingCovers.value = true
  try {
    paged.value.forEach((album) => {
      album.poster = `${apiBase}/api/music/${album.key}/cover?v=${Date.now()}`
    })
  } finally {
    forceRefreshingCovers.value = false
  }
}

const openEditor = (album: Album) => {
  selectedAlbum.value = album
  router.push({ query: { ...route.query, edit: album.key } })
}

const closeEditor = () => {
  selectedAlbum.value = null
  const { edit, ...remainingQuery } = route.query
  router.replace({ query: remainingQuery })
}

const updateAlbumCover = (url: string) => {
  if (!selectedAlbum.value) return
  const absolute = url.startsWith('http') ? url : `${apiBase}${url}`
  selectedAlbum.value.poster = absolute
  const item = albums.value.find((album) => album.key === selectedAlbum.value?.key)
  if (item) item.poster = absolute
}

const initializeLibrary = () => {
  const requested = String(route.query.library || selectedLibraryId.value || '')
  selectedLibraryId.value = libraries.value.some((library) => library.id === requested)
    ? requested
    : libraries.value[0]?.id || ''
}

const nextPage = () => {
  if (page.value < totalPages.value) page.value += 1
}

const prevPage = () => {
  if (page.value > 1) page.value -= 1
}

watch(selectedLibraryId, async (libraryId) => {
  if (!initialized.value || !libraryId) return
  selectedAlbum.value = null
  page.value = 1
  await router.replace({ query: { library: libraryId } })
  await loadAlbums()
})

watch(() => route.query.library, async (libraryId) => {
  if (!initialized.value || !libraryId) return
  const value = String(libraryId)
  if (value !== selectedLibraryId.value && libraries.value.some((library) => library.id === value)) {
    selectedLibraryId.value = value
  }
})

watch([page, sortBy, sortOrder], () => {
  if (!initialized.value || selectedAlbum.value) return
  const query: Record<string, string> = {}
  if (selectedLibraryId.value) query.library = selectedLibraryId.value
  if (page.value > 1) query.page = String(page.value)

  const defaults = getDefaultSort()
  if (sortBy.value !== defaults.sortBy) query.sortBy = sortBy.value
  if (sortOrder.value !== defaults.sortOrder) query.sortOrder = sortOrder.value

  router.replace({ query })
})

watch(() => route.query, (query) => {
  if (!initialized.value || selectedAlbum.value) return
  const defaults = getDefaultSort()
  page.value = Math.max(1, Number(query.page) || 1)
  sortBy.value = (query.sortBy as any) || defaults.sortBy
  sortOrder.value = (query.sortOrder as any) || defaults.sortOrder
}, { deep: true })

watch([pageSize, () => props.search], () => {
  page.value = 1
})

watch(filtered, () => {
  if (page.value > totalPages.value) page.value = totalPages.value
})

watch(() => route.query.edit, (editKey) => {
  if (!editKey && selectedAlbum.value) {
    selectedAlbum.value = null
    return
  }
  if (editKey && !selectedAlbum.value) {
    const album = albums.value.find((item) => String(item.key) === String(editKey))
    if (album) selectedAlbum.value = album
  }
})

onMounted(async () => {
  if (!settings.loaded.value) await settings.load()
  initializeLibrary()
  initialized.value = true
  await loadAlbums()

  const editKey = route.query.edit as string
  if (editKey) {
    const album = albums.value.find((item) => String(item.key) === String(editKey))
    if (album) selectedAlbum.value = album
  }
})
</script>

<template>
  <MusicEditorPane
    v-if="selectedAlbum"
    :album="selectedAlbum"
    @close="closeEditor"
    @cover-updated="updateAlbumCover"
  />

  <div v-else class="view">
    <div class="toolbar glass">
      <div class="controls">
        <div class="control-group">
          <label for="music-sort">Sort by:</label>
          <select id="music-sort" v-model="sortBy" class="control-select">
            <option value="title">Album</option>
            <option value="artist">Artist</option>
            <option value="year">Year</option>
            <option value="addedAt">Date Added</option>
          </select>
        </div>

        <div class="control-group">
          <label for="music-order">Order:</label>
          <select id="music-order" v-model="sortOrder" class="control-select">
            <option value="asc">
              {{ sortBy === 'title' || sortBy === 'artist' ? 'A-Z' : 'Oldest First' }}
            </option>
            <option value="desc">
              {{ sortBy === 'title' || sortBy === 'artist' ? 'Z-A' : 'Newest First' }}
            </option>
          </select>
        </div>

        <button class="refresh-btn" :disabled="loading" @click="refreshData">
          {{ loading ? 'Refreshing...' : 'Refresh Cache' }}
        </button>

        <button
          class="refresh-btn danger"
          :disabled="loading || forceRefreshingCovers"
          @click="forceCoverRefresh"
        >
          {{ forceRefreshingCovers ? 'Forcing...' : 'Force Cover Refresh' }}
        </button>
      </div>
    </div>

    <div v-if="error" class="callout error">
      <p>{{ error }}</p>
      <button @click="refreshData">Retry</button>
    </div>

    <div v-else-if="loading" class="callout">Loading music…</div>

    <div v-else-if="libraries.length === 0" class="callout">
      <p>No Plex libraries are classified as Music.</p>
      <button @click="router.push({ name: 'settings', query: { tab: 'libraries' } })">
        Manage Libraries
      </button>
    </div>

    <section v-else class="grid-block">
      <div class="heading-row">
        <div>
          <h2>{{ activeLibrary?.title || 'Music' }}</h2>
          <p class="subheading">Albums</p>
        </div>
        <p class="count">{{ filtered.length }} albums</p>
      </div>

      <div class="album-grid">
        <article
          v-for="album in paged"
          :key="album.key"
          class="album-card glass"
          tabindex="0"
          @click="openEditor(album)"
          @keydown.enter="openEditor(album)"
        >
          <div class="cover" :style="{ backgroundImage: `url(${album.poster})` }">
            <button
              class="cover-refresh"
              title="Refresh cover"
              @click.stop="refreshCover(album.key)"
            >
              ↻
            </button>
          </div>
          <div class="meta">
            <p class="album-title">{{ album.title }}</p>
            <p class="artist">{{ album.artist || 'Unknown Artist' }}</p>
            <p v-if="album.year" class="year">{{ album.year }}</p>
          </div>
        </article>
      </div>
    </section>

    <div v-if="libraries.length > 0 && !loading" class="toolbar glass pagination">
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
  transition: all 0.2s;
}

.control-select:focus {
  outline: none;
  border-color: rgba(61, 214, 183, 0.5);
}

.control-select:hover {
  background: rgba(255, 255, 255, 0.06);
}

.refresh-btn,
.pager button,
.callout button {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 7px 14px;
  background: rgba(61, 214, 183, 0.15);
  color: #3dd6b7;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  margin: 0;
}

.refresh-btn:hover:not(:disabled),
.pager button:hover:not(:disabled),
.callout button:hover:not(:disabled) {
  background: rgba(61, 214, 183, 0.25);
  border-color: rgba(61, 214, 183, 0.5);
}

.refresh-btn.danger {
  border-color: rgba(255, 107, 107, 0.5);
  background: rgba(255, 107, 107, 0.12);
  color: #ffb3b3;
}

.refresh-btn.danger:hover:not(:disabled) {
  background: rgba(255, 107, 107, 0.2);
  border-color: rgba(255, 107, 107, 0.65);
}

.grid-block {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.heading-row {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border);
}

.heading-row h2 {
  margin: 0;
  color: #eaf0ff;
  font-size: 22px;
}

.subheading,
.count {
  margin: 3px 0 0;
  color: var(--muted);
  font-size: 12px;
}

.album-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 14px;
}

.album-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: rgba(255,255,255,.02);
  cursor: pointer;
  transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease;
}

.album-card:hover,
.album-card:focus-visible {
  transform: translateY(-2px);
  border-color: rgba(61, 214, 183, .35);
  box-shadow: 0 6px 20px rgba(0,0,0,.25);
  outline: none;
}

.cover {
  aspect-ratio: 1;
  border-radius: 10px;
  background-size: cover;
  background-position: center;
  background-color: rgba(255,255,255,.04);
  position: relative;
  overflow: hidden;
}

.cover-refresh {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 30px;
  height: 30px;
  padding: 0;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,.15);
  background: rgba(0,0,0,.55);
  color: white;
  opacity: 0;
  cursor: pointer;
}

.album-card:hover .cover-refresh,
.album-card:focus-within .cover-refresh {
  opacity: 1;
}

.meta { min-width: 0; }
.album-title, .artist, .year { margin: 0; }

.album-title {
  color: #eef2ff;
  font-size: 14px;
  font-weight: 650;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.artist {
  margin-top: 4px;
  color: #c9d6ff;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.year {
  margin-top: 3px;
  color: var(--muted);
  font-size: 11px;
}

.callout {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px;
  background: rgba(255,255,255,.03);
  color: #e1e8ff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.callout.error { border-color: rgba(255,126,126,.4); }

.pager {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #dce6ff;
  font-size: 13px;
}

button:disabled {
  opacity: .5;
  cursor: not-allowed;
}

@media (max-width: 900px) {
  .controls { gap: 10px; }
  .control-group {
    flex: 1;
    min-width: 130px;
    flex-direction: column;
    align-items: flex-start;
  }
  .control-select { width: 100%; }
  .album-grid {
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 10px;
  }
  .cover-refresh { opacity: 1; }
}

@media (max-width: 600px) {
  .album-grid {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 8px;
  }
  .album-card {
    padding: 7px;
    gap: 7px;
  }
  .album-title { font-size: 12px; }
  .artist { font-size: 11px; }
}
</style>
