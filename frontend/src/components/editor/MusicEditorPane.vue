<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { getApiBase } from '@/services/apiBase'
import { useNotification } from '@/composables/useNotification'

type Album = {
  key: string
  title: string
  artist: string
  year?: number | null
  poster?: string | null
  library_id: string
}

const props = defineProps<{ album: Album }>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'cover-updated', url: string): void
}>()

const apiBase = getApiBase()
const { success, error: notifyError } = useNotification()

const loading = ref(false)
const errorMessage = ref('')
const savedMessage = ref('')
const previewUrl = ref('')
const uploadedBackgroundUrl = ref<string | null>(null)
const uploadLoading = ref(false)
const selectedBackground = ref('')

const title = ref(props.album.title)
const artist = ref(props.album.artist || '')

const options = ref({
  posterZoom: 100,
  posterShiftY: 0,
  matteHeight: 0,
  fadeHeight: 0,
  vignette: 0,
  grain: 0,
  borderEnabled: false,
  borderThickness: 8,
  borderColor: '#ffffff',
})

const textOverlayEnabled = ref(false)
const customText = ref('{title}\n{artist}')
const fontSize = ref(110)
const textColor = ref('#ffffff')
const positionY = ref(78)
const shadowEnabled = ref(true)

const currentCoverUrl = computed(() => {
  const poster = props.album.poster || `/api/music/${props.album.key}/cover`
  return poster.startsWith('http') ? poster : `${apiBase}${poster}`
})

const currentOptions = () => ({
  canvas_size: 2000,
  poster_zoom: options.value.posterZoom / 100,
  poster_shift_y: options.value.posterShiftY / 100,
  matte_height_ratio: options.value.matteHeight / 100,
  fade_height_ratio: options.value.fadeHeight / 100,
  vignette_strength: options.value.vignette / 100,
  grain_amount: options.value.grain / 100,
  logo_mode: 'none',
  text_overlay_enabled: textOverlayEnabled.value,
  custom_text: customText.value,
  font_family: 'DejaVu Sans',
  font_size: fontSize.value,
  font_weight: '700',
  text_color: textColor.value,
  text_align: 'center',
  text_transform: 'none',
  letter_spacing: 1,
  line_height: 1.05,
  position_y: positionY.value / 100,
  shadow_enabled: shadowEnabled.value,
  shadow_blur: 10,
  shadow_offset_x: 0,
  shadow_offset_y: 5,
  shadow_color: '#000000',
  shadow_opacity: 0.85,
  stroke_enabled: false,
  stroke_width: 0,
  stroke_color: '#000000',
  border_enabled: options.value.borderEnabled,
  border_px: options.value.borderThickness,
  border_color: options.value.borderColor,
})

const requestPayload = (saveToDisk = false, sendToPlex = false) => ({
  rating_key: props.album.key,
  library_id: props.album.library_id,
  title: title.value,
  artist: artist.value,
  year: props.album.year ? Number(props.album.year) : null,
  background_url: selectedBackground.value,
  options: currentOptions(),
  save_to_disk: saveToDisk,
  send_to_plex: sendToPlex,
  save_beside_media: true,
  output_directory: '/config/output/Music/{artist}/{title}',
  filename: 'cover.jpg',
})

let previewTimer: number | null = null

const renderPreview = async () => {
  if (!selectedBackground.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await fetch(`${apiBase}/api/music/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload()),
    })
    if (!response.ok) throw new Error(await response.text())
    const data = await response.json()
    previewUrl.value = `data:image/jpeg;base64,${data.image_base64}`
  } catch (cause) {
    errorMessage.value = cause instanceof Error ? cause.message : 'Preview failed.'
  } finally {
    loading.value = false
  }
}

const schedulePreview = () => {
  if (previewTimer !== null) window.clearTimeout(previewTimer)
  previewTimer = window.setTimeout(() => {
    previewTimer = null
    void renderPreview()
  }, 300)
}

watch(
  [
    title,
    artist,
    textOverlayEnabled,
    customText,
    fontSize,
    textColor,
    positionY,
    shadowEnabled,
    () => options.value.posterZoom,
    () => options.value.posterShiftY,
    () => options.value.matteHeight,
    () => options.value.fadeHeight,
    () => options.value.vignette,
    () => options.value.grain,
    () => options.value.borderEnabled,
    () => options.value.borderThickness,
    () => options.value.borderColor,
  ],
  schedulePreview,
)

const usePlexCover = async () => {
  uploadedBackgroundUrl.value = null
  selectedBackground.value = `${apiBase}/api/music/${props.album.key}/cover?v=${Date.now()}`
  await renderPreview()
}

const uploadArtwork = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !file.type.startsWith('image/')) return

  uploadLoading.value = true
  errorMessage.value = ''
  try {
    const formData = new FormData()
    formData.append('file', file)
    const response = await fetch(`${apiBase}/api/upload/background`, {
      method: 'POST',
      body: formData,
    })
    if (!response.ok) throw new Error(await response.text())
    const data = await response.json()
    const url = `${apiBase}${data.url}`
    uploadedBackgroundUrl.value = url
    selectedBackground.value = url
    await renderPreview()
  } catch (cause) {
    errorMessage.value = cause instanceof Error ? cause.message : 'Artwork upload failed.'
  } finally {
    uploadLoading.value = false
    input.value = ''
  }
}

const saveCover = async (saveToDisk: boolean, sendToPlex: boolean) => {
  if (!selectedBackground.value) return
  loading.value = true
  errorMessage.value = ''
  savedMessage.value = ''
  try {
    const response = await fetch(`${apiBase}/api/music/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload(saveToDisk, sendToPlex)),
    })
    if (!response.ok) throw new Error(await response.text())
    const data = await response.json()

    const actions: string[] = []
    if (data.saved_path) actions.push(`Saved to ${data.saved_path}`)
    if (data.sent_to_plex) actions.push('Sent to Plex')
    savedMessage.value = [actions.join(' · '), data.warning].filter(Boolean).join(' — ')

    if (data.sent_to_plex) {
      const refreshed = `/api/music/${props.album.key}/cover?v=${Date.now()}`
      emit('cover-updated', refreshed)
    }
    success(actions.join(' and ') || 'Album cover updated')
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Saving the album cover failed.'
    errorMessage.value = message
    notifyError(message)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  selectedBackground.value = currentCoverUrl.value
  await renderPreview()
})
</script>

<template>
  <div class="editor-shell">
    <header class="editor-header">
      <button class="back-btn" @click="emit('close')">← Back to Music</button>
      <div class="heading">
        <p class="kicker">Editing Music Album</p>
        <h2>{{ album.title }}</h2>
        <p>{{ album.artist }}<span v-if="album.year"> · {{ album.year }}</span></p>
      </div>
    </header>

    <div class="editor-grid">
      <section class="preview-panel glass">
        <div class="preview-wrap">
          <img
            v-if="previewUrl"
            :src="previewUrl"
            :alt="`Preview for ${album.title}`"
            class="preview-image"
          />
          <div v-else class="preview-placeholder">
            {{ loading ? 'Rendering preview…' : 'No preview available' }}
          </div>
        </div>

        <div class="save-actions">
          <button class="secondary-btn" :disabled="loading" @click="saveCover(true, false)">
            Save to Disk
          </button>
          <button class="primary-btn" :disabled="loading" @click="saveCover(false, true)">
            Send to Plex
          </button>
          <button class="primary-btn" :disabled="loading" @click="saveCover(true, true)">
            Save + Send
          </button>
        </div>

        <p v-if="savedMessage" class="status success">{{ savedMessage }}</p>
        <p v-if="errorMessage" class="status error">{{ errorMessage }}</p>
      </section>

      <section class="controls-panel">
        <div class="control-section glass">
          <h3>Source Artwork</h3>
          <div class="source-row">
            <button class="secondary-btn" :disabled="loading" @click="usePlexCover">
              Use Current Plex Cover
            </button>
            <label class="upload-btn">
              {{ uploadLoading ? 'Uploading…' : 'Upload Artwork' }}
              <input type="file" accept="image/*" :disabled="uploadLoading" @change="uploadArtwork" />
            </label>
          </div>
          <p class="help-text">
            Current Plex artwork is the default source. Upload an alternate square image to work from.
          </p>
        </div>

        <div class="control-section glass">
          <h3>Metadata</h3>
          <label class="field-label">
            Album Title
            <input v-model="title" type="text" />
          </label>
          <label class="field-label">
            Artist
            <input v-model="artist" type="text" />
          </label>
        </div>

        <div class="control-section glass">
          <h3>Artwork</h3>
          <label class="range-label">
            <span>Zoom <strong>{{ options.posterZoom }}%</strong></span>
            <input v-model.number="options.posterZoom" type="range" min="100" max="200" step="1" />
          </label>
          <label class="range-label">
            <span>Vertical Position <strong>{{ options.posterShiftY }}%</strong></span>
            <input v-model.number="options.posterShiftY" type="range" min="-100" max="100" step="1" />
          </label>
          <label class="range-label">
            <span>Bottom Matte <strong>{{ options.matteHeight }}%</strong></span>
            <input v-model.number="options.matteHeight" type="range" min="0" max="50" step="1" />
          </label>
          <label class="range-label">
            <span>Fade <strong>{{ options.fadeHeight }}%</strong></span>
            <input v-model.number="options.fadeHeight" type="range" min="0" max="100" step="1" />
          </label>
          <label class="range-label">
            <span>Vignette <strong>{{ options.vignette }}%</strong></span>
            <input v-model.number="options.vignette" type="range" min="0" max="100" step="1" />
          </label>
          <label class="range-label">
            <span>Grain <strong>{{ options.grain }}%</strong></span>
            <input v-model.number="options.grain" type="range" min="0" max="60" step="1" />
          </label>
        </div>

        <div class="control-section glass">
          <div class="section-title-row">
            <h3>Text Overlay</h3>
            <label class="switch-label">
              <input v-model="textOverlayEnabled" type="checkbox" />
              <span>Enabled</span>
            </label>
          </div>

          <template v-if="textOverlayEnabled">
            <label class="field-label">
              Text
              <textarea v-model="customText" rows="3" />
              <span class="help-text">Variables: {title}, {artist}, {year}</span>
            </label>
            <label class="range-label">
              <span>Font Size <strong>{{ fontSize }}</strong></span>
              <input v-model.number="fontSize" type="range" min="40" max="220" step="2" />
            </label>
            <label class="range-label">
              <span>Vertical Position <strong>{{ positionY }}%</strong></span>
              <input v-model.number="positionY" type="range" min="10" max="95" step="1" />
            </label>
            <label class="field-label inline-field">
              Text Color
              <input v-model="textColor" type="color" />
            </label>
            <label class="switch-label">
              <input v-model="shadowEnabled" type="checkbox" />
              <span>Text Shadow</span>
            </label>
          </template>
        </div>

        <div class="control-section glass">
          <div class="section-title-row">
            <h3>Border</h3>
            <label class="switch-label">
              <input v-model="options.borderEnabled" type="checkbox" />
              <span>Enabled</span>
            </label>
          </div>
          <template v-if="options.borderEnabled">
            <label class="range-label">
              <span>Thickness <strong>{{ options.borderThickness }}px</strong></span>
              <input v-model.number="options.borderThickness" type="range" min="1" max="40" step="1" />
            </label>
            <label class="field-label inline-field">
              Border Color
              <input v-model="options.borderColor" type="color" />
            </label>
          </template>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.editor-shell {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.editor-header {
  display: flex;
  align-items: flex-start;
  gap: 18px;
  padding: 4px 0 8px;
}
.heading h2 {
  margin: 2px 0 4px;
  color: var(--text-primary);
  font-size: 24px;
}
.heading p {
  margin: 0;
  color: var(--text-muted);
}
.kicker {
  color: var(--accent) !important;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .08em;
  text-transform: uppercase;
}
.back-btn,
.primary-btn,
.secondary-btn,
.upload-btn {
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.back-btn,
.secondary-btn,
.upload-btn {
  border: 1px solid var(--border);
  background: rgba(255,255,255,.04);
  color: var(--text-primary);
}
.primary-btn {
  border: 1px solid color-mix(in srgb, var(--accent) 50%, var(--border));
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  color: var(--text-primary);
}
.editor-grid {
  display: grid;
  grid-template-columns: minmax(320px, .9fr) minmax(420px, 1.35fr);
  gap: 18px;
  align-items: start;
}
.preview-panel {
  position: sticky;
  top: 0;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
}
.preview-wrap {
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 10px;
  background: rgba(255,255,255,.025);
}
.preview-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.preview-placeholder {
  color: var(--text-muted);
  font-size: 13px;
}
.save-actions,
.source-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 12px;
}
.controls-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.control-section {
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
}
.control-section h3 {
  margin: 0 0 12px;
  color: var(--text-primary);
  font-size: 15px;
}
.section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.field-label,
.range-label,
.switch-label {
  display: flex;
  gap: 7px;
  color: var(--text-secondary);
  font-size: 12px;
}
.field-label,
.range-label {
  flex-direction: column;
  margin-top: 10px;
}
.field-label input[type='text'],
.field-label textarea {
  width: 100%;
  padding: 8px 9px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-soft);
  color: var(--text-primary);
}
.range-label > span {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}
.range-label input[type='range'] {
  width: 100%;
}
.inline-field {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}
.inline-field input[type='color'] {
  width: 42px;
  height: 32px;
  border: 0;
  background: transparent;
}
.switch-label {
  flex-direction: row;
  align-items: center;
}
.upload-btn {
  display: inline-flex;
  align-items: center;
}
.upload-btn input {
  display: none;
}
.help-text {
  margin: 7px 0 0;
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.45;
}
.status {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.4;
}
.status.success { color: var(--accent); }
.status.error { color: #ff8f8f; }
button:disabled,
.upload-btn:has(input:disabled) {
  opacity: .5;
  cursor: not-allowed;
}
@media (max-width: 980px) {
  .editor-grid { grid-template-columns: 1fr; }
  .preview-panel { position: static; }
}
@media (max-width: 600px) {
  .editor-header { flex-direction: column; }
}
</style>
