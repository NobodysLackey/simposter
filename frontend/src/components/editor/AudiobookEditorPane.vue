<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { getApiBase } from '@/services/apiBase'
import { useNotification } from '@/composables/useNotification'

type Audiobook = {
  key: string
  title: string
  author?: string
  year?: number | string | null
  addedAt?: number | null
  poster?: string | null
  library_id?: string | number
}

const props = defineProps<{ audiobook: Audiobook }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'cover-updated', url: string): void }>()

const apiBase = getApiBase()
const { success, error: notifyError } = useNotification()

const loading = ref(false)
const errorMessage = ref('')
const savedMessage = ref('')
const previewUrl = ref('')
const uploadedBackgroundUrl = ref<string | null>(null)
const selectedBackground = ref('')
const posterUploading = ref(false)
const posterDropActive = ref(false)
const posterRefreshKey = ref(0)
const availableFonts = ref<string[]>([])

const title = ref(props.audiobook.title)
const author = ref(props.audiobook.author || '')
const narrator = ref('')
const series = ref('')
const seriesNumber = ref('')

const options = ref({
  posterZoom: 100,
  posterShiftY: 0,
  matteHeight: 25,
  fadeHeight: 22,
  vignette: 20,
  grain: 0,
  borderEnabled: false,
  borderThickness: 10,
  borderColor: '#ffffff',
})

const textOverlayEnabled = ref(true)
const customText = ref('{title}\n{author}')
const fontFamily = ref('DejaVu Sans')
const fontSize = ref(120)
const fontWeight = ref('700')
const textColor = ref('#ffffff')
const textAlign = ref('center')
const textTransform = ref('none')
const letterSpacing = ref(1)
const lineHeight = ref(105)
const positionY = ref(72)
const shadowEnabled = ref(true)
const shadowBlur = ref(10)
const shadowOffsetX = ref(0)
const shadowOffsetY = ref(5)
const shadowColor = ref('#000000')
const shadowOpacity = ref(85)
const strokeEnabled = ref(false)
const strokeWidth = ref(3)
const strokeColor = ref('#000000')

const sectionOpen = ref({
  cover: true,
  metadata: true,
  text: true,
  effects: false,
})

const toggleSection = (key: keyof typeof sectionOpen.value) => {
  sectionOpen.value[key] = !sectionOpen.value[key]
}

const currentCoverUrl = computed(() => {
  const poster = props.audiobook.poster || `/api/audiobook/${props.audiobook.key}/cover`
  if (poster.startsWith('http')) return poster
  return `${apiBase}${poster}`
})

const replaceVariables = (value: string) => {
  const replacements: Record<string, string> = {
    '{title}': title.value,
    '{author}': author.value,
    '{narrator}': narrator.value,
    '{series}': series.value,
    '{series_number}': seriesNumber.value,
    '{year}': props.audiobook.year ? String(props.audiobook.year) : '',
  }

  return Object.entries(replacements).reduce(
    (result, [variable, replacement]) => result.split(variable).join(replacement),
    value,
  )
}

const requestPayload = (saveToDisk = false, sendToPlex = false) => ({
  rating_key: props.audiobook.key,
  library_id: props.audiobook.library_id ? String(props.audiobook.library_id) : null,
  title: title.value,
  author: author.value,
  narrator: narrator.value,
  series: series.value,
  series_number: seriesNumber.value,
  year: props.audiobook.year ? Number(props.audiobook.year) : null,
  background_url: selectedBackground.value,
  save_to_disk: saveToDisk,
  send_to_plex: sendToPlex,
  filename: 'cover.jpg',
  options: {
    canvas_size: 2000,
    poster_zoom: options.value.posterZoom / 100,
    poster_shift_y: options.value.posterShiftY / 100,
    matte_height_ratio: options.value.matteHeight / 100,
    fade_height_ratio: options.value.fadeHeight / 100,
    vignette_strength: options.value.vignette / 100,
    grain_amount: options.value.grain / 100,
    logo_mode: 'none',
    text_overlay_enabled: textOverlayEnabled.value,
    custom_text: replaceVariables(customText.value),
    font_family: fontFamily.value,
    font_size: fontSize.value,
    font_weight: fontWeight.value,
    text_color: textColor.value,
    text_align: textAlign.value,
    text_transform: textTransform.value,
    letter_spacing: letterSpacing.value,
    line_height: lineHeight.value / 100,
    position_y: positionY.value / 100,
    shadow_enabled: shadowEnabled.value,
    shadow_blur: shadowBlur.value,
    shadow_offset_x: shadowOffsetX.value,
    shadow_offset_y: shadowOffsetY.value,
    shadow_color: shadowColor.value,
    shadow_opacity: shadowOpacity.value / 100,
    stroke_enabled: strokeEnabled.value,
    stroke_width: strokeWidth.value,
    stroke_color: strokeColor.value,
    border_enabled: options.value.borderEnabled,
    border_px: options.value.borderThickness,
    border_color: options.value.borderColor,
  },
})

const renderPreview = async () => {
  if (!selectedBackground.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await fetch(`${apiBase}/api/audiobook/preview`, {
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

const saveCover = async (saveToDisk: boolean, sendToPlex: boolean) => {
  loading.value = true
  errorMessage.value = ''
  savedMessage.value = ''
  try {
    const response = await fetch(`${apiBase}/api/audiobook/save`, {
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
      const refreshed = `/api/audiobook/${props.audiobook.key}/cover?v=${Date.now()}`
      emit('cover-updated', refreshed)
      posterRefreshKey.value += 1
    }

    success(actions.join(' and ') || 'Audiobook cover updated')
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Saving the cover failed.'
    errorMessage.value = message
    notifyError(message)
  } finally {
    loading.value = false
  }
}

const uploadPosterFile = async (file: File) => {
  if (!file.type.startsWith('image/')) return
  posterUploading.value = true
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
    uploadedBackgroundUrl.value = `${apiBase}${data.url}`
    selectedBackground.value = uploadedBackgroundUrl.value
    await renderPreview()
  } catch (cause) {
    errorMessage.value = cause instanceof Error ? cause.message : 'Background upload failed.'
  } finally {
    posterUploading.value = false
  }
}

const onPosterFileInput = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) void uploadPosterFile(file)
}

const onPosterDrop = (event: DragEvent) => {
  posterDropActive.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) void uploadPosterFile(file)
}

const clearUploadedPoster = () => {
  uploadedBackgroundUrl.value = null
  selectedBackground.value = currentCoverUrl.value
  void renderPreview()
}

let previewTimer: ReturnType<typeof setTimeout> | null = null
watch(
  [
    selectedBackground,
    options,
    textOverlayEnabled,
    customText,
    fontFamily,
    fontSize,
    fontWeight,
    textColor,
    textAlign,
    textTransform,
    letterSpacing,
    lineHeight,
    positionY,
    shadowEnabled,
    shadowBlur,
    shadowOffsetX,
    shadowOffsetY,
    shadowColor,
    shadowOpacity,
    strokeEnabled,
    strokeWidth,
    strokeColor,
    title,
    author,
    narrator,
    series,
    seriesNumber,
  ],
  () => {
    if (previewTimer) clearTimeout(previewTimer)
    previewTimer = setTimeout(() => void renderPreview(), 400)
  },
  { deep: true },
)

onMounted(async () => {
  selectedBackground.value = currentCoverUrl.value
  try {
    const response = await fetch(`${apiBase}/api/fonts`)
    if (response.ok) {
      const data = await response.json()
      availableFonts.value = data.fonts || []
    }
  } catch {
    /* non-critical */
  }
  await renderPreview()
})
</script>

<template>
  <div class="editor-shell">
    <div class="controls-sidebar">
      <div class="pane-header">
        <div>
          <p class="kicker">Editing Audiobook</p>
          <h2>{{ audiobook.title }} <span v-if="audiobook.year">({{ audiobook.year }})</span></h2>
          <p v-if="audiobook.author" class="author-line">{{ audiobook.author }}</p>
        </div>
        <button class="close-btn" title="Return to audiobooks" @click="emit('close')">×</button>
      </div>

      <div class="controls-scroll">
        <div class="acc-section">
          <button class="acc-header" @click="toggleSection('cover')">
            <span>Cover</span>
            <svg class="acc-chevron" :class="{ open: sectionOpen.cover }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9" /></svg>
          </button>
          <div v-show="sectionOpen.cover" class="acc-body">
            <div
              class="poster-upload-zone"
              :class="{ 'drag-over': posterDropActive, 'has-upload': !!uploadedBackgroundUrl }"
              @dragover.prevent="posterDropActive = true"
              @dragleave="posterDropActive = false"
              @drop.prevent="onPosterDrop"
              @click="!uploadedBackgroundUrl && ($refs.posterFileInput as HTMLInputElement)?.click()"
            >
              <template v-if="uploadedBackgroundUrl">
                <img :src="uploadedBackgroundUrl" class="upload-preview" alt="Uploaded cover" />
                <div class="upload-overlay">
                  <button class="upload-replace" @click.stop="($refs.posterFileInput as HTMLInputElement)?.click()">Replace</button>
                  <button class="upload-remove" @click.stop="clearUploadedPoster">✕</button>
                </div>
              </template>
              <template v-else>
                <div class="upload-prompt">
                  <span v-if="posterUploading">Uploading…</span>
                  <span v-else>&#8679; Drop image or click to upload</span>
                </div>
              </template>
            </div>
            <input ref="posterFileInput" type="file" accept="image/*" style="display: none" @change="onPosterFileInput" />

            <div class="sub-section-title">Adjustments</div>
            <div class="slider">
              <label>Cover Zoom %</label>
              <div class="slider-row"><input v-model.number="options.posterZoom" type="range" min="100" max="200" /><input v-model.number="options.posterZoom" type="number" min="100" max="200" class="slider-num" /></div>
            </div>
            <div class="slider">
              <label>Cover Shift Y %</label>
              <div class="slider-row"><input v-model.number="options.posterShiftY" type="range" min="-50" max="50" /><input v-model.number="options.posterShiftY" type="number" min="-50" max="50" class="slider-num" /></div>
            </div>
            <div class="slider">
              <label>Matte Height %</label>
              <div class="slider-row"><input v-model.number="options.matteHeight" type="range" min="0" max="50" /><input v-model.number="options.matteHeight" type="number" min="0" max="50" class="slider-num" /></div>
            </div>
            <div class="slider">
              <label>Fade Height %</label>
              <div class="slider-row"><input v-model.number="options.fadeHeight" type="range" min="0" max="100" /><input v-model.number="options.fadeHeight" type="number" min="0" max="100" class="slider-num" /></div>
            </div>
          </div>
        </div>

        <div class="acc-section">
          <button class="acc-header" @click="toggleSection('metadata')">
            <span>Book Metadata</span>
            <svg class="acc-chevron" :class="{ open: sectionOpen.metadata }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9" /></svg>
          </button>
          <div v-show="sectionOpen.metadata" class="acc-body">
            <label class="field-label">Title<input v-model="title" type="text" /></label>
            <label class="field-label">Author<input v-model="author" type="text" /></label>
            <label class="field-label">Narrator<input v-model="narrator" type="text" /></label>
            <label class="field-label">Series<input v-model="series" type="text" /></label>
            <label class="field-label">Series Number<input v-model="seriesNumber" type="text" /></label>
          </div>
        </div>

        <div class="acc-section">
          <button class="acc-header" @click="toggleSection('text')">
            <span>Text</span>
            <svg class="acc-chevron" :class="{ open: sectionOpen.text }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9" /></svg>
          </button>
          <div v-show="sectionOpen.text" class="acc-body">
            <label class="inline-field checkbox"><input v-model="textOverlayEnabled" type="checkbox" /><span>Enable custom text</span></label>
            <template v-if="textOverlayEnabled">
              <label class="field-label">Text Content<textarea v-model="customText" rows="3" /></label>
              <p class="field-hint">Variables: {title}, {author}, {narrator}, {series}, {series_number}, {year}</p>
              <label class="field-label">Font Family
                <select v-model="fontFamily">
                  <option v-for="font in availableFonts" :key="font" :value="font">{{ font }}</option>
                  <option v-if="!availableFonts.includes('DejaVu Sans')" value="DejaVu Sans">DejaVu Sans</option>
                </select>
              </label>
              <div class="slider"><label>Font Size</label><div class="slider-row"><input v-model.number="fontSize" type="range" min="20" max="400" /><input v-model.number="fontSize" type="number" min="20" max="400" class="slider-num" /></div></div>
              <label class="field-label">Font Weight<select v-model="fontWeight"><option v-for="weight in ['100','200','300','400','500','600','700','800','900']" :key="weight" :value="weight">{{ weight }}</option></select></label>
              <label class="field-label">Text Color<input v-model="textColor" type="color" /></label>
              <label class="field-label">Text Align<select v-model="textAlign"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
              <label class="field-label">Text Transform<select v-model="textTransform"><option value="none">None</option><option value="uppercase">Uppercase</option><option value="lowercase">Lowercase</option><option value="capitalize">Capitalize</option></select></label>
              <div class="slider"><label>Vertical Position %</label><div class="slider-row"><input v-model.number="positionY" type="range" min="5" max="95" /><input v-model.number="positionY" type="number" min="5" max="95" class="slider-num" /></div></div>
              <label class="inline-field checkbox"><input v-model="shadowEnabled" type="checkbox" /><span>Shadow</span></label>
              <label class="inline-field checkbox"><input v-model="strokeEnabled" type="checkbox" /><span>Stroke</span></label>
              <div v-if="strokeEnabled" class="slider"><label>Stroke Width</label><div class="slider-row"><input v-model.number="strokeWidth" type="range" min="1" max="15" /><input v-model.number="strokeWidth" type="number" min="1" max="15" class="slider-num" /></div></div>
            </template>
          </div>
        </div>

        <div class="acc-section">
          <button class="acc-header" @click="toggleSection('effects')">
            <span>Effects & Border</span>
            <svg class="acc-chevron" :class="{ open: sectionOpen.effects }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9" /></svg>
          </button>
          <div v-show="sectionOpen.effects" class="acc-body">
            <div class="slider"><label>Vignette</label><div class="slider-row"><input v-model.number="options.vignette" type="range" min="0" max="100" /><input v-model.number="options.vignette" type="number" min="0" max="100" class="slider-num" /></div></div>
            <div class="slider"><label>Grain</label><div class="slider-row"><input v-model.number="options.grain" type="range" min="0" max="60" /><input v-model.number="options.grain" type="number" min="0" max="60" class="slider-num" /></div></div>
            <label class="inline-field checkbox"><input v-model="options.borderEnabled" type="checkbox" /><span>Border</span></label>
            <div v-if="options.borderEnabled" class="slider"><label>Border Thickness</label><div class="slider-row"><input v-model.number="options.borderThickness" type="range" min="1" max="50" /><input v-model.number="options.borderThickness" type="number" min="1" max="50" class="slider-num" /></div></div>
            <label v-if="options.borderEnabled" class="field-label">Border Color<input v-model="options.borderColor" type="color" /></label>
          </div>
        </div>

        <div class="acc-actions">
          <button class="btn-primary" :disabled="loading" @click="renderPreview">Preview</button>
          <span v-if="errorMessage" class="error-text">{{ errorMessage }}</span>
        </div>
      </div>
    </div>

    <div class="preview-pane">
      <div class="preview-inner">
        <div class="preview-existing">
          <div class="preview-label">Current Plex Cover</div>
          <img :key="posterRefreshKey" :src="currentCoverUrl" alt="Current Plex cover" class="existing-img square" />
          <div class="metadata-summary">
            <p class="summary-title">{{ title }}</p>
            <p>{{ author || 'Unknown author' }}</p>
            <p v-if="narrator">Narrated by {{ narrator }}</p>
            <p v-if="series">{{ series }}<span v-if="seriesNumber"> #{{ seriesNumber }}</span></p>
          </div>
        </div>

        <div class="preview-main">
          <div class="preview-label">
            Preview
            <span v-if="loading" class="status-badge">Rendering...</span>
            <span v-else-if="previewUrl" class="status-badge success">Rendered</span>
            <div class="preview-actions float-right">
              <button title="Save to Disk" class="btn-save btn-inline" :disabled="loading" @click="saveCover(true, false)">💾 <span class="btn-label">Save to Disk</span></button>
              <button title="Send to Plex" class="btn-plex btn-inline" :disabled="loading" @click="saveCover(false, true)">📺 <span class="btn-label">Send to Plex</span></button>
              <button title="Save and Send" class="btn-plex btn-inline" :disabled="loading" @click="saveCover(true, true)">✓ <span class="btn-label">Save + Send</span></button>
            </div>
          </div>
          <div class="preview-container square-preview">
            <img v-if="previewUrl" :src="previewUrl" alt="Audiobook cover preview" class="preview-img square" />
            <div v-else-if="selectedBackground" class="placeholder-state square">
              <img :src="selectedBackground" alt="Selected cover" class="placeholder-img" />
              <div class="placeholder-overlay"><p>Adjust settings to render</p></div>
            </div>
            <div v-if="loading" class="loading-overlay"><div class="spinner"></div><p>Rendering...</p></div>
          </div>
          <p v-if="savedMessage" class="success-text">{{ savedMessage }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.editor-shell {
  display: grid;
  grid-template-columns: 480px 1fr;
  gap: 0;
  height: calc(100vh - 60px);
  background: var(--surface);
  overflow: hidden;
}

.controls-sidebar {
  background: rgba(17, 20, 30, 0.95);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.pane-header {
  padding: 16px 18px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.kicker {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--muted);
  margin-bottom: 4px;
}

.pane-header h2 {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.2px;
  color: #eef2ff;
}

.pane-header h2 span,
.author-line {
  color: var(--muted);
  font-weight: 500;
}

.author-line {
  margin-top: 3px;
  font-size: 12px;
}

.close-btn {
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: rgba(255,255,255,0.04);
  color: #dce6ff;
  font-size: 22px;
  cursor: pointer;
}

.controls-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 0 18px 20px;
}

.acc-section {
  border-bottom: 1px solid var(--border);
}

.acc-header {
  width: 100%;
  padding: 15px 0;
  border: 0;
  background: transparent;
  color: #e0e9ff;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.acc-chevron {
  transition: transform 0.2s ease;
}

.acc-chevron.open {
  transform: rotate(180deg);
}

.acc-body {
  padding-bottom: 16px;
}

.field-label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
  font-size: 13px;
  font-weight: 500;
  color: #dce6ff;
}

.field-label input,
.field-label select,
.field-label textarea {
  width: 100%;
  padding: 8px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.04);
  color: #e6edff;
  font-size: 13px;
}

.field-label textarea {
  resize: vertical;
}

.field-label input[type='color'] {
  height: 38px;
  padding: 3px;
  cursor: pointer;
}

.field-hint {
  margin: -6px 0 12px;
  color: var(--muted);
  font-size: 11px;
}

.inline-field.checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #dce6ff;
  font-size: 13px;
  margin-bottom: 12px;
}

.inline-field.checkbox input {
  width: auto;
}

.sub-section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.6px;
  margin: 14px 0 10px;
}

.slider {
  margin-bottom: 12px;
}

.slider > label {
  display: block;
  margin-bottom: 6px;
  color: #dce6ff;
  font-size: 13px;
}

.slider-row {
  display: grid;
  grid-template-columns: 1fr 70px;
  gap: 8px;
  align-items: center;
}

.slider-row input[type='range'] {
  width: 100%;
}

.slider-num {
  width: 70px;
  padding: 6px;
  border-radius: 7px;
  border: 1px solid var(--border);
  background: rgba(255,255,255,0.04);
  color: #e6edff;
}

.poster-upload-zone {
  min-height: 110px;
  border: 1px dashed rgba(255,255,255,0.18);
  border-radius: 10px;
  overflow: hidden;
  position: relative;
  display: grid;
  place-items: center;
  cursor: pointer;
  background: rgba(255,255,255,0.02);
}

.poster-upload-zone.drag-over {
  border-color: var(--accent);
  background: rgba(61,214,183,0.08);
}

.upload-preview {
  width: 100%;
  height: 150px;
  object-fit: cover;
}

.upload-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  gap: 6px;
  padding: 8px;
  background: linear-gradient(transparent, rgba(0,0,0,0.65));
}

.upload-overlay button {
  border: 1px solid rgba(255,255,255,0.18);
  border-radius: 7px;
  background: rgba(0,0,0,0.55);
  color: #fff;
  padding: 6px 8px;
  cursor: pointer;
}

.upload-prompt {
  color: var(--muted);
  font-size: 12px;
}

.acc-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-top: 16px;
}

.btn-primary {
  border: none;
  border-radius: 10px;
  padding: 9px 14px;
  background: linear-gradient(120deg, #3dd6b7, #5b8dee);
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}

.error-text {
  color: #ff9f9f;
  font-size: 12px;
}

.preview-pane {
  overflow: auto;
  padding: 20px;
  background: rgba(10,12,18,0.72);
}

.preview-inner {
  display: grid;
  grid-template-columns: 230px minmax(400px, 1fr);
  gap: 22px;
  min-height: 100%;
}

.preview-existing,
.preview-main {
  min-width: 0;
}

.preview-label {
  display: flex;
  align-items: center;
  min-height: 34px;
  gap: 8px;
  color: #dce6ff;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 10px;
}

.preview-actions.float-right {
  margin-left: auto;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.btn-inline {
  margin: 0;
  font-size: 12px;
  white-space: nowrap;
}

.existing-img.square {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 10px;
  border: 1px solid var(--border);
}

.metadata-summary {
  margin-top: 14px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: rgba(255,255,255,0.025);
  color: var(--muted);
  font-size: 12px;
}

.metadata-summary p + p {
  margin-top: 4px;
}

.metadata-summary .summary-title {
  color: #eef2ff;
  font-weight: 600;
}

.preview-container.square-preview {
  position: relative;
  width: min(100%, 760px);
  margin: 0 auto;
  aspect-ratio: 1;
  border-radius: 12px;
  overflow: hidden;
  background: #090b10;
  border: 1px solid var(--border);
  box-shadow: 0 16px 50px rgba(0,0,0,0.35);
}

.preview-img.square,
.placeholder-state.square,
.placeholder-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.placeholder-state {
  position: relative;
}

.placeholder-overlay,
.loading-overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(0,0,0,0.45);
  color: #eef2ff;
}

.loading-overlay {
  gap: 8px;
  align-content: center;
}

.spinner {
  width: 28px;
  height: 28px;
  border: 3px solid rgba(255,255,255,0.2);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.status-badge {
  padding: 3px 7px;
  border-radius: 999px;
  background: rgba(255,255,255,0.08);
  color: var(--muted);
  font-size: 10px;
}

.status-badge.success,
.success-text {
  color: #68e6c8;
}

.success-text {
  margin-top: 12px;
  font-size: 12px;
}

button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

@media (max-width: 1200px) {
  .editor-shell {
    grid-template-columns: 420px 1fr;
  }

  .preview-inner {
    grid-template-columns: 180px minmax(320px, 1fr);
  }
}

@media (max-width: 900px) {
  .editor-shell {
    display: flex;
    flex-direction: column;
    height: auto;
    min-height: calc(100vh - 60px);
    overflow: visible;
  }

  .controls-sidebar {
    border-right: 0;
    border-bottom: 1px solid var(--border);
    max-height: none;
  }

  .controls-scroll {
    overflow: visible;
  }

  .preview-inner {
    grid-template-columns: 1fr;
  }

  .preview-existing {
    max-width: 260px;
  }
}

@media (max-width: 600px) {
  .preview-pane {
    padding: 12px;
  }

  .preview-actions.float-right {
    width: 100%;
    margin-left: 0;
  }

  .btn-inline {
    flex: 1;
  }
}
</style>
