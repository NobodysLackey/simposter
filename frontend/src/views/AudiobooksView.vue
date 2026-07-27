<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { getApiBase } from '@/services/apiBase'

interface AudiobookLibrary {
  id: string
  title: string
  type: string
}

interface Audiobook {
  key: string
  title: string
  author: string
  year?: number | null
  addedAt?: number | null
  poster: string
  library_id: string
}

const apiBase = getApiBase()

const libraries = ref<AudiobookLibrary[]>([])
const selectedLibraryId = ref('')
const audiobooks = ref<Audiobook[]>([])
const loading = ref(false)
const editorLoading = ref(false)
const message = ref('')
const error = ref('')
const searchQuery = ref('')
const selectedBook = ref<Audiobook | null>(null)
const previewUrl = ref('')
const selectedBackground = ref('')
const uploadedBackground = ref('')

const title = ref('')
const author = ref('')
const narrator = ref('')
const series = ref('')
const seriesNumber = ref('')
const customText = ref('{title}\n{author}')
const fontFamily = ref('DejaVu Sans')
const fontSize = ref(120)
const textColor = ref('#ffffff')
const positionY = ref(72)
const textAlign = ref<'left' | 'center' | 'right'>('center')
const textTransform = ref<'none' | 'uppercase' | 'lowercase'>('none')
const posterZoom = ref(100)
const posterShiftY = ref(0)
const matteHeight = ref(25)
const fadeHeight = ref(22)
const vignette = ref(20)
const grain = ref(0)
const shadowEnabled = ref(true)
const strokeEnabled = ref(false)
const strokeWidth = ref(3)
const borderEnabled = ref(false)
const borderThickness = ref(10)
const borderColor = ref('#ffffff')

const filteredAudiobooks = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return audiobooks.value
  return audiobooks.value.filter((book) =>
    `${book.title} ${book.author} ${book.year || ''}`.toLowerCase().includes(query),
  )
})

const activeLibrary = computed(() =>
  libraries.value.find((library) => library.id === selectedLibraryId.value),
)

const coverUrl = (book: Audiobook) => {
  const url = book.poster || `/api/audiobook/${book.key}/cover`
  return url.startsWith('http') ? url : `${apiBase}${url}`
}

const loadLibraries = async () => {
  loading.value = true
  error.value = ''
  try {
    const response = await fetch(`${apiBase}/api/audiobook-libraries`)
    if (!response.ok) throw new Error(await response.text())
    libraries.value = await response.json()
    if (!selectedLibraryId.value && libraries.value.length > 0) {
      selectedLibraryId.value = libraries.value[0]!.id
    }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Failed to load Plex music libraries.'
  } finally {
    loading.value = false
  }
}

const loadAudiobooks = async () => {
  if (!selectedLibraryId.value) return
  loading.value = true
  error.value = ''
  try {
    const response = await fetch(
      `${apiBase}/api/audiobooks?library_id=${encodeURIComponent(selectedLibraryId.value)}`,
    )
    if (!response.ok) throw new Error(await response.text())
    audiobooks.value = await response.json()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Failed to load audiobook albums.'
  } finally {
    loading.value = false
  }
}

const openEditor = (book: Audiobook) => {
  selectedBook.value = book
  title.value = book.title
  author.value = book.author || ''
  narrator.value = ''
  series.value = ''
  seriesNumber.value = ''
  selectedBackground.value = coverUrl(book)
  uploadedBackground.value = ''
  previewUrl.value = ''
  message.value = ''
  error.value = ''
  void renderPreview()
}

const closeEditor = () => {
  selectedBook.value = null
  previewUrl.value = ''
  uploadedBackground.value = ''
  message.value = ''
  error.value = ''
}

const uploadBackground = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !file.type.startsWith('image/')) return

  editorLoading.value = true
  error.value = ''
  try {
    const formData = new FormData()
    formData.append('file', file)
    const response = await fetch(`${apiBase}/api/upload/background`, {
      method: 'POST',
      body: formData,
    })
    if (!response.ok) throw new Error(await response.text())
    const data = await response.json()
    uploadedBackground.value = `${apiBase}${data.url}`
    selectedBackground.value = uploadedBackground.value
    await renderPreview()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Background upload failed.'
  } finally {
    editorLoading.value = false
  }
}

const requestPayload = (saveToDisk = false, sendToPlex = false) => {
  if (!selectedBook.value) return null
  return {
    rating_key: selectedBook.value.key,
    library_id: selectedBook.value.library_id,
    title: title.value,
    author: author.value,
    narrator: narrator.value,
    series: series.value,
    series_number: seriesNumber.value,
    year: selectedBook.value.year || null,
    background_url: selectedBackground.value,
    save_to_disk: saveToDisk,
    send_to_plex: sendToPlex,
    filename: 'cover.jpg',
    options: {
      canvas_size: 2000,
      poster_zoom: posterZoom.value / 100,
      poster_shift_y: posterShiftY.value / 100,
      matte_height_ratio: matteHeight.value / 100,
      fade_height_ratio: fadeHeight.value / 100,
      vignette_strength: vignette.value / 100,
      grain_amount: grain.value / 100,
      logo_mode: 'none',
      text_overlay_enabled: true,
      custom_text: customText.value,
      font_family: fontFamily.value,
      font_size: fontSize.value,
      font_weight: '700',
      text_color: textColor.value,
      text_align: textAlign.value,
      text_transform: textTransform.value,
      letter_spacing: 1,
      line_height: 1.05,
      position_y: positionY.value / 100,
      shadow_enabled: shadowEnabled.value,
      shadow_blur: 10,
      shadow_offset_x: 0,
      shadow_offset_y: 5,
      shadow_color: '#000000',
      shadow_opacity: 0.85,
      stroke_enabled: strokeEnabled.value,
      stroke_width: strokeWidth.value,
      stroke_color: '#000000',
      border_enabled: borderEnabled.value,
      border_px: borderThickness.value,
      border_color: borderColor.value,
    },
  }
}

const renderPreview = async () => {
  const payload = requestPayload()
  if (!payload || !payload.background_url) return

  editorLoading.value = true
  error.value = ''
  try {
    const response = await fetch(`${apiBase}/api/audiobook/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) throw new Error(await response.text())
    const data = await response.json()
    previewUrl.value = `data:image/jpeg;base64,${data.image_base64}`
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Preview failed.'
  } finally {
    editorLoading.value = false
  }
}

const saveCover = async (saveToDisk: boolean, sendToPlex: boolean) => {
  const payload = requestPayload(saveToDisk, sendToPlex)
  if (!payload) return

  editorLoading.value = true
  message.value = ''
  error.value = ''
  try {
    const response = await fetch(`${apiBase}/api/audiobook/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) throw new Error(await response.text())
    const data = await response.json()
    const actions = []
    if (data.saved_path) actions.push(`Saved to ${data.saved_path}`)
    if (data.sent_to_plex) actions.push('Sent to Plex')
    message.value = [actions.join(' · '), data.warning].filter(Boolean).join(' — ')

    if (data.sent_to_plex && selectedBook.value) {
      selectedBook.value.poster = `/api/audiobook/${selectedBook.value.key}/cover?v=${Date.now()}`
    }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Saving the cover failed.'
  } finally {
    editorLoading.value = false
  }
}

let previewTimer: number | undefined
watch(
  [
    customText,
    fontFamily,
    fontSize,
    textColor,
    positionY,
    textAlign,
    textTransform,
    posterZoom,
    posterShiftY,
    matteHeight,
    fadeHeight,
    vignette,
    grain,
    shadowEnabled,
    strokeEnabled,
    strokeWidth,
    borderEnabled,
    borderThickness,
    borderColor,
    title,
    author,
    narrator,
    series,
    seriesNumber,
  ],
  () => {
    if (!selectedBook.value) return
    window.clearTimeout(previewTimer)
    previewTimer = window.setTimeout(() => void renderPreview(), 350)
  },
)

watch(selectedLibraryId, () => void loadAudiobooks())

onMounted(async () => {
  await loadLibraries()
  await loadAudiobooks()
})
</script>

<template>
  <main class="audiobooks-page">
    <header class="page-header">
      <div>
        <p class="eyebrow">PLEX MUSIC</p>
        <h1>Audiobook Covers</h1>
        <p class="subtitle">Treat each Plex album as an audiobook and create square cover artwork.</p>
      </div>
      <button class="secondary-button" :disabled="loading" @click="loadAudiobooks">
        {{ loading ? 'Loading…' : 'Refresh Albums' }}
      </button>
    </header>

    <section class="toolbar">
      <label>
        <span>Music library</span>
        <select v-model="selectedLibraryId">
          <option v-for="library in libraries" :key="library.id" :value="library.id">
            {{ library.title }}
          </option>
        </select>
      </label>
      <label class="search-field">
        <span>Search</span>
        <input v-model="searchQuery" type="search" placeholder="Title, author, or year" />
      </label>
      <div class="album-count">
        {{ filteredAudiobooks.length }} album{{ filteredAudiobooks.length === 1 ? '' : 's' }}
        <span v-if="activeLibrary">in {{ activeLibrary.title }}</span>
      </div>
    </section>

    <p v-if="error && !selectedBook" class="status error">{{ error }}</p>
    <p v-if="!loading && libraries.length === 0" class="empty-state">
      No Plex music libraries were found. Create or select a Plex Music library containing your audiobooks.
    </p>

    <section class="album-grid">
      <button
        v-for="book in filteredAudiobooks"
        :key="book.key"
        class="album-card"
        type="button"
        @click="openEditor(book)"
      >
        <div class="cover-shell">
          <img :src="coverUrl(book)" :alt="`${book.title} cover`" loading="lazy" />
        </div>
        <strong>{{ book.title }}</strong>
        <span>{{ book.author || 'Unknown author' }}</span>
        <small v-if="book.year">{{ book.year }}</small>
      </button>
    </section>

    <div v-if="selectedBook" class="editor-backdrop" @click.self="closeEditor">
      <section class="editor-dialog" role="dialog" aria-modal="true">
        <header class="editor-header">
          <div>
            <p class="eyebrow">EDITING ALBUM</p>
            <h2>{{ selectedBook.title }}</h2>
          </div>
          <button class="icon-button" type="button" aria-label="Close editor" @click="closeEditor">×</button>
        </header>

        <div class="editor-layout">
          <div class="preview-column">
            <div class="preview-shell">
              <img
                v-if="previewUrl || selectedBackground"
                :src="previewUrl || selectedBackground"
                alt="Audiobook cover preview"
              />
              <div v-if="editorLoading" class="preview-loading">Rendering…</div>
            </div>
            <label class="upload-button">
              Replace background
              <input type="file" accept="image/*" @change="uploadBackground" />
            </label>
          </div>

          <div class="controls-column">
            <fieldset>
              <legend>Book metadata</legend>
              <div class="two-column">
                <label><span>Title</span><input v-model="title" /></label>
                <label><span>Author</span><input v-model="author" /></label>
                <label><span>Narrator</span><input v-model="narrator" /></label>
                <label><span>Series</span><input v-model="series" /></label>
                <label><span>Series number</span><input v-model="seriesNumber" /></label>
              </div>
              <label>
                <span>Cover text</span>
                <textarea v-model="customText" rows="3" />
                <small>Variables: {title}, {author}, {narrator}, {series}, {series_number}, {year}</small>
              </label>
            </fieldset>

            <fieldset>
              <legend>Typography</legend>
              <div class="two-column">
                <label><span>Font</span><input v-model="fontFamily" /></label>
                <label><span>Font size</span><input v-model.number="fontSize" type="number" min="30" max="400" /></label>
                <label><span>Color</span><input v-model="textColor" type="color" /></label>
                <label>
                  <span>Alignment</span>
                  <select v-model="textAlign">
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </label>
                <label>
                  <span>Transform</span>
                  <select v-model="textTransform">
                    <option value="none">None</option>
                    <option value="uppercase">Uppercase</option>
                    <option value="lowercase">Lowercase</option>
                  </select>
                </label>
                <label><span>Vertical position {{ positionY }}%</span><input v-model.number="positionY" type="range" min="5" max="95" /></label>
              </div>
              <div class="check-row">
                <label><input v-model="shadowEnabled" type="checkbox" /> Shadow</label>
                <label><input v-model="strokeEnabled" type="checkbox" /> Stroke</label>
                <label v-if="strokeEnabled"><span>Stroke {{ strokeWidth }}px</span><input v-model.number="strokeWidth" type="range" min="1" max="15" /></label>
              </div>
            </fieldset>

            <fieldset>
              <legend>Artwork</legend>
              <div class="slider-grid">
                <label><span>Zoom {{ posterZoom }}%</span><input v-model.number="posterZoom" type="range" min="100" max="200" /></label>
                <label><span>Vertical shift {{ posterShiftY }}%</span><input v-model.number="posterShiftY" type="range" min="-50" max="50" /></label>
                <label><span>Matte {{ matteHeight }}%</span><input v-model.number="matteHeight" type="range" min="0" max="50" /></label>
                <label><span>Fade {{ fadeHeight }}%</span><input v-model.number="fadeHeight" type="range" min="0" max="70" /></label>
                <label><span>Vignette {{ vignette }}%</span><input v-model.number="vignette" type="range" min="0" max="100" /></label>
                <label><span>Grain {{ grain }}%</span><input v-model.number="grain" type="range" min="0" max="60" /></label>
              </div>
              <div class="check-row">
                <label><input v-model="borderEnabled" type="checkbox" /> Border</label>
                <label v-if="borderEnabled"><span>Thickness {{ borderThickness }}px</span><input v-model.number="borderThickness" type="range" min="1" max="50" /></label>
                <label v-if="borderEnabled"><span>Border color</span><input v-model="borderColor" type="color" /></label>
              </div>
            </fieldset>

            <p v-if="message" class="status success">{{ message }}</p>
            <p v-if="error" class="status error">{{ error }}</p>

            <footer class="editor-actions">
              <button class="secondary-button" :disabled="editorLoading" @click="renderPreview">Preview</button>
              <button class="secondary-button" :disabled="editorLoading" @click="saveCover(true, false)">Save cover.jpg</button>
              <button class="primary-button" :disabled="editorLoading" @click="saveCover(false, true)">Send to Plex</button>
              <button class="primary-button" :disabled="editorLoading" @click="saveCover(true, true)">Save + Send</button>
            </footer>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.audiobooks-page {
  min-height: 100%;
  padding: 28px;
  color: var(--text-primary, #f4f4f5);
}

.page-header,
.toolbar,
.editor-header,
.editor-actions,
.check-row {
  display: flex;
  align-items: center;
}

.page-header {
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 24px;
}

h1,
h2,
p {
  margin: 0;
}

h1 {
  font-size: clamp(2rem, 4vw, 3.2rem);
}

.subtitle,
.album-card span,
.album-card small,
small {
  color: var(--text-secondary, #a1a1aa);
}

.eyebrow {
  margin-bottom: 6px;
  color: var(--accent, #6ee7ff);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.16em;
}

.toolbar {
  gap: 16px;
  padding: 16px;
  margin-bottom: 22px;
  border: 1px solid var(--border-color, #30303a);
  border-radius: 14px;
  background: var(--surface, #17171d);
}

.toolbar label,
.controls-column label {
  display: grid;
  gap: 6px;
}

.toolbar label span,
.controls-column label > span {
  font-size: 0.76rem;
  font-weight: 700;
  color: var(--text-secondary, #a1a1aa);
}

.search-field {
  flex: 1;
}

.album-count {
  margin-left: auto;
  font-size: 0.85rem;
  color: var(--text-secondary, #a1a1aa);
}

.album-count span {
  display: block;
}

input,
select,
textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid var(--border-color, #3f3f46);
  border-radius: 8px;
  color: inherit;
  background: var(--input-bg, #0f0f13);
}

input[type='range'],
input[type='checkbox'],
input[type='color'] {
  padding: 0;
}

input[type='checkbox'] {
  width: auto;
}

input[type='color'] {
  height: 40px;
}

.album-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 20px;
}

.album-card {
  display: grid;
  gap: 6px;
  padding: 0;
  border: 0;
  color: inherit;
  text-align: left;
  background: transparent;
  cursor: pointer;
}

.cover-shell,
.preview-shell {
  position: relative;
  overflow: hidden;
  aspect-ratio: 1;
  border-radius: 12px;
  background: #09090b;
  box-shadow: 0 12px 30px rgb(0 0 0 / 25%);
}

.cover-shell img,
.preview-shell img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.album-card:hover .cover-shell {
  transform: translateY(-3px);
  outline: 2px solid var(--accent, #6ee7ff);
}

.editor-backdrop {
  position: fixed;
  z-index: 1000;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgb(0 0 0 / 78%);
}

.editor-dialog {
  width: min(1440px, 96vw);
  max-height: 94vh;
  overflow: auto;
  border: 1px solid var(--border-color, #34343d);
  border-radius: 18px;
  background: var(--surface, #17171d);
  box-shadow: 0 30px 100px rgb(0 0 0 / 55%);
}

.editor-header {
  justify-content: space-between;
  position: sticky;
  z-index: 2;
  top: 0;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-color, #34343d);
  background: inherit;
}

.editor-layout {
  display: grid;
  grid-template-columns: minmax(340px, 0.8fr) minmax(500px, 1.4fr);
  gap: 28px;
  padding: 24px;
}

.preview-column {
  position: sticky;
  top: 100px;
  align-self: start;
}

.preview-loading {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgb(0 0 0 / 50%);
}

.upload-button,
.primary-button,
.secondary-button,
.icon-button {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  border-radius: 9px;
  cursor: pointer;
}

.upload-button {
  padding: 11px 14px;
  margin-top: 12px;
  border: 1px dashed var(--border-color, #52525b);
}

.upload-button input {
  display: none;
}

.primary-button,
.secondary-button {
  padding: 10px 15px;
  border: 1px solid transparent;
  font-weight: 700;
}

.primary-button {
  color: #071015;
  background: var(--accent, #6ee7ff);
}

.secondary-button {
  color: inherit;
  border-color: var(--border-color, #464651);
  background: var(--input-bg, #101015);
}

.icon-button {
  width: 42px;
  height: 42px;
  border: 0;
  color: inherit;
  font-size: 2rem;
  background: transparent;
}

button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.controls-column {
  display: grid;
  gap: 18px;
}

fieldset {
  display: grid;
  gap: 14px;
  padding: 18px;
  border: 1px solid var(--border-color, #34343d);
  border-radius: 12px;
}

legend {
  padding: 0 8px;
  font-weight: 800;
}

.two-column,
.slider-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.check-row {
  flex-wrap: wrap;
  gap: 18px;
}

.check-row label {
  display: flex;
  align-items: center;
  gap: 7px;
}

.editor-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
  position: sticky;
  bottom: 0;
  padding: 14px 0 2px;
  background: var(--surface, #17171d);
}

.status,
.empty-state {
  padding: 12px 14px;
  margin-bottom: 16px;
  border-radius: 9px;
}

.status.success {
  background: rgb(34 197 94 / 14%);
}

.status.error {
  background: rgb(239 68 68 / 14%);
}

.empty-state {
  text-align: center;
  color: var(--text-secondary, #a1a1aa);
}

@media (max-width: 900px) {
  .editor-layout {
    grid-template-columns: 1fr;
  }

  .preview-column {
    position: static;
  }

  .toolbar,
  .page-header {
    align-items: stretch;
    flex-direction: column;
  }

  .album-count {
    margin-left: 0;
  }
}

@media (max-width: 620px) {
  .audiobooks-page {
    padding: 16px;
  }

  .two-column,
  .slider-grid {
    grid-template-columns: 1fr;
  }

  .editor-backdrop {
    padding: 0;
  }

  .editor-dialog {
    width: 100vw;
    max-height: 100vh;
    border-radius: 0;
  }
}
</style>
