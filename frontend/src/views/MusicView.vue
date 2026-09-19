<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSettingsStore } from '@/stores/settings'
import { getApiBase } from '@/services/apiBase'

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
const loading = ref(false)
const initialized = ref(false)
const error = ref<string | null>(null)
const page = ref(Math.max(1, Number(route.query.page) || 1))
const sortBy = ref<'title' | 'artist' | 'year' | 'addedAt'>((route.query.sortBy as any) || 'artist')
const sortOrder = ref<'asc' | 'desc'>((route.query.sortOrder as any) || 'asc')

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
  const direction = sortOrder.value === 'asc' ? 1 : -1

  list.sort((a, b) => {
    if (sortBy.value === 'title') return direction * a.title.localeCompare(b.title)
    if (sortBy.value === 'artist') {
      return direction * (a.artist || '').localeCompare(b.artist || '') ||
        direction * a.title.localeCompare(b.title)
    }
    if (sortBy.value === 'year') {
      return direction * ((Number(a.year) || 0) - (Number(b.year) || 0))
    }
    return direction * ((a.addedAt || 0) - (b.addedAt || 0))
  })

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

const refresh = async () => {
  page.value = 1
  await loadAlbums()
}

const refreshCover = (key: string) => {
  const album = albums.value.find((item) => item.key === key)
  if (album) album.poster = `${apiBase}/api/music/${key}/cover?v=${Date.now()}`
}

const initializeLibrary = () => {
  const requested = String(route.query.library || selectedLibraryId.value || '')
  selectedLibraryId.value = libraries.value.some((library) => library.id === requested)
    ? requested
    : libraries.value[0]?.id || ''
}

watch(selectedLibraryId, async (libraryId) => {
  if (!initialized.value || !libraryId) return
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
  if (!initialized.value) return
  const query: Record<string, string> = {}
  if (selectedLibraryId.value) query.library = selectedLibraryId.value
  if (page.value > 1) query.page = String(page.value)
  if (sortBy.value !== 'artist') query.sortBy = sortBy.value
  if (sortOrder.value !== 'asc') query.sortOrder = sortOrder.value
  router.replace({ query })
})

watch([pageSize, () => props.search], () => {
  page.value = 1
})

watch(filtered, () => {
  if (page.value > totalPages.value) page.value = totalPages.value
})

onMounted(async () => {
  if (!settings.loaded.value) await settings.load()
  initializeLibrary()
  initialized.value = true
  await loadAlbums()
})
</script>

<template>
  <div class="view">
    <div class="toolbar glass">
      <div class="controls">
        <div v-if="libraries.length > 0" class="control-group">
          <label for="music-library">Library:</label>
          <select id="music-library" v-model="selectedLibraryId" class="control-select">
            <option v-for="library in libraries" :key="library.id" :value="library.id">
              {{ library.title }}
            </option>
          </select>
        </div>

        <div class="control-group">
          <label for="music-sort">Sort by:</label>
          <select id="music-sort" v-model="sortBy" class="control-select">
            <option value="artist">Artist</option>
            <option value="title">Album</option>
            <option value="year">Year</option>
            <option value="addedAt">Date Added</option>
          </select>
        </div>

        <div class="control-group">
          <label for="music-order">Order:</label>
          <select id="music-order" v-model="sortOrder" class="control-select">
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>

        <button class="refresh-btn" :disabled="loading" @click="refresh">
          {{ loading ? 'Refreshing...' : 'Refresh' }}
        </button>
      </div>
    </div>

    <div v-if="error" class="callout error">
      <p>{{ error }}</p>
      <button @click="refresh">Retry</button>
    </div>

    <div v-else-if="loading" class="callout">Loading music…</div>

    <div v-else-if="libraries.length === 0" class="callout">
      <p>No Plex libraries are classified as Music.</p>
      <button @click="router.push({ name: 'settings', query: { tab: 'libraries' } })">Manage Libraries</button>
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
        <article v-for="album in paged" :key="album.key" class="album-card glass">
          <div class="cover" :style="{ backgroundImage: `url(${album.poster})` }">
            <button class="cover-refresh" title="Refresh cover" @click="refreshCover(album.key)">
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
        <button :disabled="page === 1" @click="page -= 1">Prev</button>
        <span>{{ page }} / {{ totalPages }}</span>
        <button :disabled="page === totalPages" @click="page += 1">Next</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.view { display: flex; flex-direction: column; gap: 16px; }
.toolbar { display: flex; align-items: center; gap: 12px; padding: 12px; flex-wrap: wrap; }
.toolbar.pagination { justify-content: center; }
.controls { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; width: 100%; }
.control-group { display: flex; align-items: center; gap: 8px; }
.control-group label { font-size: 13px; color: #dce6ff; font-weight: 500; }
.control-select { border: 1px solid var(--border); border-radius: 8px; padding: 7px 10px; background: rgba(255,255,255,.04); color: #e6edff; font-size: 13px; cursor: pointer; }
.refresh-btn, .pager button, .callout button { border: 1px solid var(--border); border-radius: 8px; padding: 7px 12px; background: rgba(61,214,183,.12); color: #7de3cb; cursor: pointer; }
.grid-block { display: flex; flex-direction: column; gap: 16px; }
.heading-row { display: flex; align-items: end; justify-content: space-between; gap: 12px; padding-bottom: 10px; border-bottom: 1px solid var(--border); }
.heading-row h2 { margin: 0; color: #eaf0ff; font-size: 22px; }
.subheading, .count { margin: 3px 0 0; color: var(--muted); font-size: 12px; }
.album-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 14px; }
.album-card { display: flex; flex-direction: column; gap: 10px; padding: 10px; border-radius: 12px; border: 1px solid var(--border); background: rgba(255,255,255,.02); }
.cover { aspect-ratio: 1; border-radius: 10px; background-size: cover; background-position: center; background-color: rgba(255,255,255,.04); position: relative; overflow: hidden; }
.cover-refresh { position: absolute; top: 8px; right: 8px; width: 30px; height: 30px; padding: 0; border-radius: 8px; border: 1px solid rgba(255,255,255,.15); background: rgba(0,0,0,.55); color: white; opacity: 0; cursor: pointer; }
.album-card:hover .cover-refresh { opacity: 1; }
.meta { min-width: 0; }
.album-title, .artist, .year { margin: 0; }
.album-title { color: #eef2ff; font-size: 14px; font-weight: 650; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.artist { margin-top: 4px; color: #c9d6ff; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.year { margin-top: 3px; color: var(--muted); font-size: 11px; }
.callout { border: 1px solid var(--border); border-radius: 12px; padding: 14px; background: rgba(255,255,255,.03); color: #e1e8ff; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.callout.error { border-color: rgba(255,126,126,.4); }
.pager { display: flex; align-items: center; gap: 10px; color: #dce6ff; font-size: 13px; }
button:disabled { opacity: .5; cursor: not-allowed; }
@media (max-width: 900px) {
  .controls { gap: 10px; }
  .control-group { flex: 1; min-width: 130px; flex-direction: column; align-items: flex-start; }
  .control-select { width: 100%; }
  .album-grid { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; }
  .cover-refresh { opacity: 1; }
}
@media (max-width: 600px) {
  .album-grid { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 8px; }
  .album-card { padding: 7px; gap: 7px; }
  .album-title { font-size: 12px; }
  .artist { font-size: 11px; }
}
</style>
