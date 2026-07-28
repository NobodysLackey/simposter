<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { getApiBase } from '@/services/apiBase'

type CoverOption = {
  source: 'audnexus' | 'google' | 'openlibrary' | string
  url: string
  thumb?: string
  title?: string
  author?: string
  id?: string
  asin?: string
}

const props = defineProps<{
  ratingKey: string
  title: string
  author?: string
  selectedUrl?: string
}>()

const emit = defineEmits<{
  (event: 'select', url: string): void
}>()

const apiBase = getApiBase()
const includeGoogle = ref(true)
const includeOpenLibrary = ref(true)
const includeAudnexus = ref(true)
const loading = ref(false)
const errorMessage = ref('')
const covers = ref<CoverOption[]>([])
const asin = ref<string | null>(null)

const sourceLabel = (source: string) => {
  if (source === 'audnexus') return 'AUDNEXUS'
  if (source === 'openlibrary') return 'OPEN LIBRARY'
  if (source === 'google') return 'GOOGLE'
  return source.toUpperCase()
}

const hasAnyProvider = computed(
  () => includeGoogle.value || includeOpenLibrary.value || includeAudnexus.value,
)

const search = async (forceRefresh = false) => {
  if (!props.ratingKey || !props.title || !hasAnyProvider.value) {
    covers.value = []
    return
  }

  loading.value = true
  errorMessage.value = ''
  try {
    const params = new URLSearchParams({
      title: props.title,
      author: props.author || '',
      google: String(includeGoogle.value),
      openlibrary: String(includeOpenLibrary.value),
      audnexus: String(includeAudnexus.value),
      force_refresh: String(forceRefresh),
    })
    const response = await fetch(
      `${apiBase}/api/audiobook/${encodeURIComponent(props.ratingKey)}/cover-options?${params.toString()}`,
    )
    if (!response.ok) throw new Error(await response.text())
    const data = await response.json()
    covers.value = Array.isArray(data?.covers) ? data.covers : []
    asin.value = data?.asin || null
  } catch (cause) {
    errorMessage.value = cause instanceof Error ? cause.message : 'Cover search failed.'
    covers.value = []
  } finally {
    loading.value = false
  }
}

let timer: ReturnType<typeof setTimeout> | null = null
watch(
  [includeGoogle, includeOpenLibrary, includeAudnexus, () => props.title, () => props.author],
  () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void search(), 250)
  },
)

onMounted(() => void search())
</script>

<template>
  <div class="cover-sources">
    <div class="source-controls">
      <label class="inline-field checkbox">
        <input v-model="includeAudnexus" type="checkbox" />
        <span>Audnexus</span>
      </label>
      <label class="inline-field checkbox">
        <input v-model="includeGoogle" type="checkbox" />
        <span>Google Books</span>
      </label>
      <label class="inline-field checkbox">
        <input v-model="includeOpenLibrary" type="checkbox" />
        <span>Open Library</span>
      </label>
      <button class="refresh-source-btn" :disabled="loading || !hasAnyProvider" title="Refresh cover sources" @click="search(true)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
      </button>
    </div>

    <p v-if="includeAudnexus && !asin && !loading" class="source-hint">
      Audnexus appears when Plex metadata contains an Audible/Audnexus ASIN.
    </p>
    <p v-if="errorMessage" class="source-error">{{ errorMessage }}</p>
    <p v-else-if="loading" class="source-hint">Searching cover sources…</p>

    <div v-if="covers.length" class="cover-strip">
      <button
        v-for="cover in covers"
        :key="`${cover.source}:${cover.id || cover.url}`"
        type="button"
        class="cover-thumb"
        :class="{ active: selectedUrl === cover.url }"
        :title="[cover.title, cover.author].filter(Boolean).join(' — ')"
        @click="emit('select', cover.url)"
      >
        <img :src="cover.thumb || cover.url" alt="" loading="lazy" />
        <span class="source-badge">{{ sourceLabel(cover.source) }}</span>
      </button>
    </div>
    <p v-else-if="!loading && hasAnyProvider" class="source-hint">No external cover matches found.</p>
  </div>
</template>

<style scoped>
.cover-sources { margin-bottom: 14px; }
.source-controls { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
.inline-field.checkbox { display: inline-flex; align-items: center; gap: 6px; color: #dce6ff; font-size: 13px; }
.inline-field.checkbox input { width: auto; }
.refresh-source-btn { width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--border); border-radius: 8px; background: rgba(255,255,255,.04); color: #dce6ff; cursor: pointer; }
.refresh-source-btn:hover:not(:disabled) { background: rgba(61,214,183,.1); border-color: rgba(61,214,183,.3); color: var(--accent); }
.refresh-source-btn:disabled { opacity: .5; cursor: not-allowed; }
.source-hint, .source-error { margin: 4px 0 8px; font-size: 11px; color: var(--muted); }
.source-error { color: #ffb3b3; }
.cover-strip { display: flex; gap: 7px; overflow-x: auto; padding: 5px 1px 9px; }
.cover-thumb { position: relative; flex: 0 0 82px; width: 82px; height: 82px; padding: 0; overflow: hidden; border: 2px solid transparent; border-radius: 9px; background: rgba(255,255,255,.025); cursor: pointer; }
.cover-thumb:hover { border-color: rgba(61,214,183,.35); }
.cover-thumb.active { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
.cover-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.source-badge { position: absolute; left: 3px; bottom: 3px; max-width: calc(100% - 6px); padding: 2px 4px; overflow: hidden; border: 1px solid rgba(61,214,183,.35); border-radius: 4px; background: rgba(0,0,0,.78); color: #3dd6b7; font-size: 8px; font-weight: 700; line-height: 1.1; text-overflow: ellipsis; white-space: nowrap; }
</style>
