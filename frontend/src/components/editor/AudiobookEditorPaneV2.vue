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

type PresetRecord = {
  id: string
  name?: string
  options?: Record<string, any>
}

type CoverOption = {
  url: string
  thumb?: string
  source: 'google' | 'openlibrary' | 'audnexus'
  title?: string
  author?: string
  year?: number | string | null
  provider_id?: string | null
  asin?: string | null
  narrator?: string | null
}

type AudiobookSettings = {
  enabled: boolean
  library_mappings: Array<{
    id: string
    title?: string
    display_name?: string
    enabled?: boolean
    default_preset_id?: string
  }>
  default_preset_id: string
  save_beside_media: boolean
  fallback_save_path: string
  default_text_enabled: boolean
  default_text: string
  default_logo_mode: 'original' | 'match' | 'hex' | 'none'
  default_matte: number
  default_fade: number
  default_grain: number
  default_vignette: number
}

const props = defineProps<{ audiobook: Audiobook }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'cover-updated', url: string): void }>()

const apiBase = getApiBase()
const { success, error: notifyError } = useNotification()

const defaultSettings: AudiobookSettings = {
  enabled: true,
  library_mappings: [],
  default_preset_id: 'default',
  save_beside_media: true,
  fallback_save_path: '/config/output/{library}/{author}/{title}',
  default_text_enabled: false,
  default_text: '{title}\n{author}',
  default_logo_mode: 'none',
  default_matte: 0,
  default_fade: 15,
  default_grain: 15,
  default_vignette: 15,
}

const loading = ref(false)
const presetLoading = ref(false)
const errorMessage = ref('')
const savedMessage = ref('')
const previewUrl = ref('')
const posterRefreshKey = ref(0)
const availableFonts = ref<string[]>([])
const audiobookSettings = ref<AudiobookSettings>({ ...defaultSettings })

const title = ref(props.audiobook.title)
const author = ref(props.audiobook.author || '')
const narrator = ref('')
const series = ref('')
const seriesNumber = ref('')

const selectedBackground = ref('')
const uploadedBackgroundUrl = ref<string | null>(null)
const posterUploading = ref(false)
const posterDropActive = ref(false)

const coverOptions = ref<CoverOption[]>([])
const coverOptionsLoading = ref(false)
const coverOptionsError = ref('')
const showGoogleBooks = ref(true)
const showOpenLibrary = ref(true)
const showAudnexus = ref(true)
const audibleAsin = ref('')

const selectedLogo = ref<string | null>(null)
const uploadedLogoUrl = ref<string | null>(null)
const logoUploading = ref(false)
const logoDropActive = ref(false)
const logoMode = ref<'original' | 'match' | 'hex' | 'none'>('none')
const logoHex = ref('#ffffff')

const options = ref({
  posterZoom: 100,
  posterShiftY: 0,
  matteHeight: 0,
  fadeHeight: 15,
  vignette: 15,
  grain: 15,
  logoScale: 100,
  uniformLogoMaxW: 1400,
  uniformLogoMaxH: 500,
  uniformLogoOffsetX: 50,
  uniformLogoOffsetY: 78,
  uniformLogoHAlign: 'center' as 'left' | 'center' | 'right',
  uniformLogoVAlign: 'center' as 'top' | 'center' | 'bottom',
  borderEnabled: false,
  borderThickness: 10,
  borderColor: '#ffffff',
})

const textOverlayEnabled = ref(false)
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

const presets = ref<PresetRecord[]>([])
const selectedPreset = ref('default')
const newPresetId = ref('')
const applyingPreset = ref(false)

const sectionOpen = ref({
  preset: true,
  cover: true,
  metadata: false,
  logo: true,
  text: false,
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

const displayedPresets = computed<PresetRecord[]>(() => {
  if (presets.value.length > 0) return presets.value
  return [{ id: 'default', name: 'Default' }]
})

const filteredCoverOptions = computed(() =>
  coverOptions.value.filter((cover) => {
    if (cover.source === 'google') return showGoogleBooks.value
    if (cover.source === 'openlibrary') return showOpenLibrary.value
    if (cover.source === 'audnexus') return showAudnexus.value
    return true
  }),
)

const coverSourceLabel = (source: CoverOption['source']) => {
  if (source === 'google') return 'GOOGLE'
  if (source === 'openlibrary') return 'OPEN LIBRARY'
  return 'AUDNEXUS'
}

const activeLibrarySettings = computed(() =>
  audiobookSettings.value.library_mappings.find(
    (mapping) => String(mapping.id) === String(props.audiobook.library_id || ''),
  ),
)

const effectiveDefaultPreset = computed(() =>
  activeLibrarySettings.value?.default_preset_id || audiobookSettings.value.default_preset_id || 'default',
)

const logoUrl = computed(() => {
  if (logoMode.value === 'none') return null
  return selectedLogo.value
})

const currentOptions = () => ({
  canvas_size: 2000,
  poster_zoom: options.value.posterZoom / 100,
  poster_shift_y: options.value.posterShiftY / 100,
  matte_height_ratio: options.value.matteHeight / 100,
  fade_height_ratio: options.value.fadeHeight / 100,
  vignette_strength: options.value.vignette / 100,
  grain_amount: options.value.grain / 100,
  logo_scale: options.value.logoScale / 100,
  uniform_logo_max_w: options.value.uniformLogoMaxW,
  uniform_logo_max_h: options.value.uniformLogoMaxH,
  uniform_logo_offset_x: options.value.uniformLogoOffsetX / 100,
  uniform_logo_offset_y: options.value.uniformLogoOffsetY / 100,
  uniform_logo_h_align: options.value.uniformLogoHAlign,
  uniform_logo_v_align: options.value.uniformLogoVAlign,
  logo_mode: logoMode.value,
  logo_hex: logoHex.value,
  text_overlay_enabled: textOverlayEnabled.value,
  custom_text: customText.value,
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
})

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
  logo_url: logoUrl.value,
  save_to_disk: saveToDisk,
  send_to_plex: sendToPlex,
  save_beside_media: audiobookSettings.value.save_beside_media,
  output_directory: audiobookSettings.value.fallback_save_path,
  filename: 'cover.jpg',
  options: currentOptions(),
})

const applyPresetOptions = (presetOptions?: Record<string, any>) => {
  if (!presetOptions) return
  applyingPreset.value = true
  try {
    const value = presetOptions
    if (typeof value.poster_zoom === 'number') options.value.posterZoom = Math.round(value.poster_zoom * 100)
    if (typeof value.poster_shift_y === 'number') options.value.posterShiftY = Math.round(value.poster_shift_y * 100)
    if (typeof value.matte_height_ratio === 'number') options.value.matteHeight = Math.round(value.matte_height_ratio * 100)
    if (typeof value.fade_height_ratio === 'number') options.value.fadeHeight = Math.round(value.fade_height_ratio * 100)
    if (typeof value.vignette_strength === 'number') options.value.vignette = Math.round(value.vignette_strength * 100)
    if (typeof value.grain_amount === 'number') options.value.grain = Math.round(value.grain_amount * 100)
    if (typeof value.logo_scale === 'number') options.value.logoScale = Math.round(value.logo_scale * 100)
    if (typeof value.uniform_logo_max_w === 'number') options.value.uniformLogoMaxW = value.uniform_logo_max_w
    if (typeof value.uniform_logo_max_h === 'number') options.value.uniformLogoMaxH = value.uniform_logo_max_h
    if (typeof value.uniform_logo_offset_x === 'number') options.value.uniformLogoOffsetX = Math.round(value.uniform_logo_offset_x * 100)
    if (typeof value.uniform_logo_offset_y === 'number') options.value.uniformLogoOffsetY = Math.round(value.uniform_logo_offset_y * 100)
    if (['left', 'center', 'right'].includes(value.uniform_logo_h_align)) options.value.uniformLogoHAlign = value.uniform_logo_h_align
    if (['top', 'center', 'bottom'].includes(value.uniform_logo_v_align)) options.value.uniformLogoVAlign = value.uniform_logo_v_align
    if (typeof value.logo_mode === 'string' && ['original', 'match', 'hex', 'none'].includes(value.logo_mode)) {
      logoMode.value = value.logo_mode as 'original' | 'match' | 'hex' | 'none'
    }
    if (typeof value.logo_hex === 'string') logoHex.value = value.logo_hex
    if (typeof value.border_enabled === 'boolean') options.value.borderEnabled = value.border_enabled
    if (typeof value.border_px === 'number') options.value.borderThickness = value.border_px
    if (typeof value.border_color === 'string') options.value.borderColor = value.border_color
    if (typeof value.text_overlay_enabled === 'boolean') textOverlayEnabled.value = value.text_overlay_enabled
    if (typeof value.custom_text === 'string') customText.value = value.custom_text
    if (typeof value.font_family === 'string') fontFamily.value = value.font_family
    if (typeof value.font_size === 'number') fontSize.value = value.font_size
    if (typeof value.font_weight === 'string') fontWeight.value = value.font_weight
    if (typeof value.text_color === 'string') textColor.value = value.text_color
    if (typeof value.text_align === 'string') textAlign.value = value.text_align
    if (typeof value.text_transform === 'string') textTransform.value = value.text_transform
    if (typeof value.letter_spacing === 'number') letterSpacing.value = value.letter_spacing
    if (typeof value.line_height === 'number') lineHeight.value = Math.round(value.line_height * 100)
    if (typeof value.position_y === 'number') positionY.value = Math.round(value.position_y * 100)
    if (typeof value.shadow_enabled === 'boolean') shadowEnabled.value = value.shadow_enabled
    if (typeof value.shadow_blur === 'number') shadowBlur.value = value.shadow_blur
    if (typeof value.shadow_offset_x === 'number') shadowOffsetX.value = value.shadow_offset_x
    if (typeof value.shadow_offset_y === 'number') shadowOffsetY.value = value.shadow_offset_y
    if (typeof value.shadow_color === 'string') shadowColor.value = value.shadow_color
    if (typeof value.shadow_opacity === 'number') shadowOpacity.value = Math.round(value.shadow_opacity * 100)
    if (typeof value.stroke_enabled === 'boolean') strokeEnabled.value = value.stroke_enabled
    if (typeof value.stroke_width === 'number') strokeWidth.value = value.stroke_width
    if (typeof value.stroke_color === 'string') strokeColor.value = value.stroke_color
  } finally {
    applyingPreset.value = false
  }
}

const applyAudiobookDefaults = () => {
  textOverlayEnabled.value = audiobookSettings.value.default_text_enabled
  customText.value = audiobookSettings.value.default_text || '{title}\n{author}'
  logoMode.value = audiobookSettings.value.default_logo_mode || 'none'
  options.value.matteHeight = audiobookSettings.value.default_matte ?? 0
  options.value.fadeHeight = audiobookSettings.value.default_fade ?? 15
  options.value.grain = audiobookSettings.value.default_grain ?? 15
  options.value.vignette = audiobookSettings.value.default_vignette ?? 15
}

const loadCoverOptions = async (forceRefresh = false) => {
  coverOptionsLoading.value = true
  coverOptionsError.value = ''

  try {
    const params = new URLSearchParams({
      title: title.value,
      author: author.value,
      google: String(showGoogleBooks.value),
      openlibrary: String(showOpenLibrary.value),
      audnexus: String(showAudnexus.value),
      force_refresh: String(forceRefresh),
    })

    const ratingKey = encodeURIComponent(props.audiobook.key)
    const response = await fetch(
      `${apiBase}/api/audiobook/${ratingKey}/cover-options?${params.toString()}`,
    )

    if (!response.ok) {
      throw new Error(await response.text())
    }

    const data = await response.json()

    coverOptions.value = Array.isArray(data.covers)
      ? data.covers
      : []

    audibleAsin.value =
      typeof data.asin === 'string'
        ? data.asin
        : ''

    const providerLabels: Record<string, string> = {
      google: 'Google Books',
      openlibrary: 'Open Library',
      audnexus: 'Audnexus',
    }

    const providerErrors = Object.entries(data.errors || {})

    coverOptionsError.value = providerErrors
      .map(([provider, message]) =>
        `${providerLabels[provider] || provider}: ${String(message)}`,
      )
      .join(' · ')
  } catch (cause) {
    coverOptionsError.value =
      cause instanceof Error
        ? cause.message
        : 'Cover search failed.'

    coverOptions.value = []
  } finally {
    coverOptionsLoading.value = false
  }
}

const selectCoverOption = (cover: CoverOption) => {
  selectedBackground.value = cover.url
  uploadedBackgroundUrl.value = null
  if (cover.asin && !audibleAsin.value) audibleAsin.value = cover.asin
  if (cover.narrator && !narrator.value) narrator.value = cover.narrator
  void renderPreview()
}

const loadAudiobookSettings = async () => {
  try {
    const response = await fetch(`${apiBase}/api/audiobook-settings`)
    if (!response.ok) return
    audiobookSettings.value = { ...defaultSettings, ...(await response.json()) }
  } catch {
    audiobookSettings.value = { ...defaultSettings }
  }
}

const loadPresets = async () => {
  presetLoading.value = true
  try {
    const response = await fetch(`${apiBase}/api/presets`)
    if (!response.ok) throw new Error(`API error ${response.status}`)
    const data = await response.json()
    presets.value = Array.isArray(data?.audiobookcover?.presets) ? data.audiobookcover.presets : []
  } catch (cause) {
    console.warn('[AudiobookEditor] Failed to load presets:', cause)
    presets.value = []
  } finally {
    presetLoading.value = false
  }
}

const reloadPreset = async () => {
  await loadPresets()
  const preset = presets.value.find((item) => item.id === selectedPreset.value)
  if (preset?.options) {
    applyPresetOptions(preset.options)
    success('Preset reloaded')
  }
}

const savePreset = async (presetId: string) => {
  const target = presetId.trim()
  if (!target) return false
  presetLoading.value = true
  try {
    const response = await fetch(`${apiBase}/api/presets/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_id: 'audiobookcover',
        preset_id: target,
        options: currentOptions(),
      }),
    })
    if (!response.ok) throw new Error(await response.text())
    await loadPresets()
    selectedPreset.value = target
    return true
  } catch (cause) {
    notifyError(cause instanceof Error ? cause.message : 'Preset save failed')
    return false
  } finally {
    presetLoading.value = false
  }
}

const saveCurrentPreset = async () => {
  if (await savePreset(selectedPreset.value || 'default')) success('Preset saved')
}

const saveAsNewPreset = async () => {
  const target = newPresetId.value.trim()
  if (!target) {
    notifyError('Enter a new preset id')
    return
  }
  if (await savePreset(target)) {
    newPresetId.value = ''
    success('Preset saved as new')
  }
}

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

const uploadImage = async (file: File, target: 'background' | 'logo') => {
  if (!file.type.startsWith('image/')) return
  if (target === 'background') posterUploading.value = true
  else logoUploading.value = true
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
    if (target === 'background') {
      uploadedBackgroundUrl.value = url
      selectedBackground.value = url
    } else {
      uploadedLogoUrl.value = url
      selectedLogo.value = url
      if (logoMode.value === 'none') logoMode.value = 'original'
    }
    await renderPreview()
  } catch (cause) {
    errorMessage.value = cause instanceof Error ? cause.message : 'Image upload failed.'
  } finally {
    if (target === 'background') posterUploading.value = false
    else logoUploading.value = false
  }
}

const onPosterFileInput = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) void uploadImage(file, 'background')
}

const onLogoFileInput = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) void uploadImage(file, 'logo')
}

const onPosterDrop = (event: DragEvent) => {
  posterDropActive.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) void uploadImage(file, 'background')
}

const onLogoDrop = (event: DragEvent) => {
  logoDropActive.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) void uploadImage(file, 'logo')
}

const clearUploadedPoster = () => {
  uploadedBackgroundUrl.value = null
  selectedBackground.value = currentCoverUrl.value
  void renderPreview()
}

const clearLogo = () => {
  uploadedLogoUrl.value = null
  selectedLogo.value = null
  logoMode.value = 'none'
  void renderPreview()
}

let previewTimer: ReturnType<typeof setTimeout> | null = null
watch(
  [
    selectedBackground,
    selectedLogo,
    logoMode,
    logoHex,
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
    if (applyingPreset.value || !selectedBackground.value) return
    if (previewTimer) clearTimeout(previewTimer)
    previewTimer = setTimeout(() => void renderPreview(), 400)
  },
  { deep: true },
)

watch(selectedPreset, (presetId) => {
  const preset = presets.value.find((item) => item.id === presetId)
  if (preset?.options) applyPresetOptions(preset.options)
})


onMounted(async () => {
  selectedBackground.value = currentCoverUrl.value
  await Promise.all([
    loadAudiobookSettings(),
    loadPresets(),
    fetch(`${apiBase}/api/fonts`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        availableFonts.value = data?.fonts || []
      })
      .catch(() => undefined),
  ])

  applyAudiobookDefaults()
  selectedPreset.value = effectiveDefaultPreset.value
  const preset = presets.value.find((item) => item.id === selectedPreset.value)
  if (preset?.options) applyPresetOptions(preset.options)
  await Promise.all([renderPreview(), loadCoverOptions()])
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
          <button class="acc-header" @click="toggleSection('preset')">
            <span>Preset</span>
            <span class="chevron" :class="{ open: sectionOpen.preset }">⌃</span>
          </button>
          <div v-show="sectionOpen.preset" class="acc-body">
            <div class="preset-row">
              <label class="field-label preset-select">
                Preset
                <select v-model="selectedPreset">
                  <option v-if="presetLoading" disabled>Loading…</option>
                  <option v-for="preset in displayedPresets" :key="preset.id" :value="preset.id">
                    {{ preset.name || preset.id }}
                  </option>
                </select>
              </label>
              <button class="reload-preset-btn" title="Reload preset values" :disabled="presetLoading" @click="reloadPreset">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
              </button>
              <button class="save-preset-btn" title="Save current settings to preset" :disabled="presetLoading" @click="saveCurrentPreset">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                  <polyline points="17 21 17 13 7 13 7 21"/>
                  <polyline points="7 3 7 8 15 8"/>
                </svg>
              </button>
            </div>
            <div class="preset-row new-preset-row">
              <input v-model="newPresetId" type="text" placeholder="New preset id" class="new-preset-input" />
              <button class="save-preset-btn wide" :disabled="presetLoading" @click="saveAsNewPreset">Save As</button>
            </div>
          </div>
        </div>

        <div class="acc-section">
          <button class="acc-header" @click="toggleSection('cover')">
            <span>Cover</span>
            <span class="chevron" :class="{ open: sectionOpen.cover }">⌃</span>
          </button>
          <div v-show="sectionOpen.cover" class="acc-body">
            <div class="cover-provider-controls">
              <label class="inline-field checkbox"><input v-model="showGoogleBooks" type="checkbox" /><span>Google Books</span></label>
              <label class="inline-field checkbox"><input v-model="showOpenLibrary" type="checkbox" /><span>Open Library</span></label>
              <label class="inline-field checkbox"><input v-model="showAudnexus" type="checkbox" /><span>Audnexus</span></label>
            </div>

            <div v-if="showAudnexus" class="audnexus-row">
              <label class="field-label">
                Detected Audible ASIN
                <input
                  :value="audibleAsin"
                  type="text"
                  readonly
                  placeholder="Not found in Plex metadata"
                />
              </label>
              <button class="reload-preset-btn cover-refresh-btn" :disabled="coverOptionsLoading" title="Refresh cover results" @click="loadCoverOptions(true)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
              </button>
            </div>

            <div class="cover-results">
              <div v-if="coverOptionsLoading" class="cover-results-message">Searching cover providers…</div>
              <div v-else-if="filteredCoverOptions.length" class="cover-thumb-strip">
                <button
                  v-for="cover in filteredCoverOptions"
                  :key="`${cover.source}-${cover.provider_id || cover.url}`"
                  type="button"
                  class="cover-thumb"
                  :class="{ active: selectedBackground === cover.url }"
                  :title="[cover.title, cover.author, cover.year].filter(Boolean).join(' · ')"
                  @click="selectCoverOption(cover)"
                >
                  <img :src="cover.thumb || cover.url" :alt="cover.title || 'Audiobook cover option'" />
                  <span class="source-badge">{{ coverSourceLabel(cover.source) }}</span>
                </button>
              </div>
              <div v-else class="cover-results-message">No matching covers found from the selected sources.</div>
              <p v-if="coverOptionsError" class="cover-provider-error">{{ coverOptionsError }}</p>
            </div>

            <div class="sub-section-title">Custom Upload</div>
            <div
              class="upload-zone"
              :class="{ 'drag-over': posterDropActive, 'has-upload': !!uploadedBackgroundUrl }"
              @dragover.prevent="posterDropActive = true"
              @dragleave="posterDropActive = false"
              @drop.prevent="onPosterDrop"
              @click="!uploadedBackgroundUrl && ($refs.posterFileInput as HTMLInputElement)?.click()"
            >
              <template v-if="uploadedBackgroundUrl">
                <img :src="uploadedBackgroundUrl" class="upload-preview" alt="Uploaded cover" />
                <div class="upload-overlay">
                  <button @click.stop="($refs.posterFileInput as HTMLInputElement)?.click()">Replace</button>
                  <button @click.stop="clearUploadedPoster">✕</button>
                </div>
              </template>
              <span v-else>{{ posterUploading ? 'Uploading…' : '⇧ Drop image or click to upload' }}</span>
            </div>
            <input ref="posterFileInput" type="file" accept="image/*" style="display: none" @change="onPosterFileInput" />

            <div class="sub-section-title">Adjustments</div>
            <div class="slider"><label>Cover Zoom %</label><div class="slider-row"><input v-model.number="options.posterZoom" type="range" min="100" max="200" /><input v-model.number="options.posterZoom" type="number" min="100" max="200" class="slider-num" /></div></div>
            <div class="slider"><label>Cover Shift Y %</label><div class="slider-row"><input v-model.number="options.posterShiftY" type="range" min="-50" max="50" /><input v-model.number="options.posterShiftY" type="number" min="-50" max="50" class="slider-num" /></div></div>
            <div class="slider"><label>Matte Height %</label><div class="slider-row"><input v-model.number="options.matteHeight" type="range" min="0" max="50" /><input v-model.number="options.matteHeight" type="number" min="0" max="50" class="slider-num" /></div></div>
            <div class="slider"><label>Fade Height %</label><div class="slider-row"><input v-model.number="options.fadeHeight" type="range" min="0" max="100" /><input v-model.number="options.fadeHeight" type="number" min="0" max="100" class="slider-num" /></div></div>
            <div class="slider"><label>Vignette</label><div class="slider-row"><input v-model.number="options.vignette" type="range" min="0" max="100" /><input v-model.number="options.vignette" type="number" min="0" max="100" class="slider-num" /></div></div>
            <div class="slider"><label>Grain</label><div class="slider-row"><input v-model.number="options.grain" type="range" min="0" max="60" /><input v-model.number="options.grain" type="number" min="0" max="60" class="slider-num" /></div></div>
          </div>
        </div>

        <div class="acc-section">
          <button class="acc-header" @click="toggleSection('metadata')">
            <span>Book Metadata</span>
            <span class="chevron" :class="{ open: sectionOpen.metadata }">⌃</span>
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
          <button class="acc-header" @click="toggleSection('logo')">
            <span>Logo</span>
            <span class="chevron" :class="{ open: sectionOpen.logo }">⌃</span>
          </button>
          <div v-show="sectionOpen.logo" class="acc-body">
            <label class="field-label">Logo Mode
              <select v-model="logoMode">
                <option value="original">Keep Original</option>
                <option value="match">Color Match Cover</option>
                <option value="hex">Use Custom Hex</option>
                <option value="none">No Logo</option>
              </select>
            </label>
            <label v-if="logoMode === 'hex'" class="field-label">Logo Color<input v-model="logoHex" type="color" /></label>

            <div
              class="upload-zone logo-upload"
              :class="{ 'drag-over': logoDropActive, 'has-upload': !!uploadedLogoUrl }"
              @dragover.prevent="logoDropActive = true"
              @dragleave="logoDropActive = false"
              @drop.prevent="onLogoDrop"
              @click="!uploadedLogoUrl && ($refs.logoFileInput as HTMLInputElement)?.click()"
            >
              <template v-if="uploadedLogoUrl">
                <img :src="uploadedLogoUrl" class="logo-preview" alt="Uploaded logo" />
                <div class="upload-overlay">
                  <button @click.stop="selectedLogo = uploadedLogoUrl; logoMode = 'original'">Use this</button>
                  <button @click.stop="($refs.logoFileInput as HTMLInputElement)?.click()">Replace</button>
                  <button @click.stop="clearLogo">✕</button>
                </div>
              </template>
              <span v-else>{{ logoUploading ? 'Uploading…' : '⇧ Upload transparent logo' }}</span>
            </div>
            <input ref="logoFileInput" type="file" accept="image/*" style="display: none" @change="onLogoFileInput" />

            <div class="logo-choice-row">
              <button :class="['logo-choice', { active: uploadedLogoUrl && selectedLogo === uploadedLogoUrl && logoMode !== 'none' }]" :disabled="!uploadedLogoUrl" @click="selectedLogo = uploadedLogoUrl; logoMode = 'original'">
                <img v-if="uploadedLogoUrl" :src="uploadedLogoUrl" alt="Uploaded logo" />
                <span v-else>Uploaded Logo</span>
              </button>
              <button :class="['logo-choice', { active: logoMode === 'none' }]" @click="logoMode = 'none'">⊘<span>No Logo</span></button>
            </div>

            <div class="sub-section-title">Position & Size</div>
            <div class="slider"><label>Scale %</label><div class="slider-row"><input v-model.number="options.logoScale" type="range" min="10" max="200" /><input v-model.number="options.logoScale" type="number" min="10" max="200" class="slider-num" /></div></div>
            <div class="slider"><label>Max Width (px)</label><div class="slider-row"><input v-model.number="options.uniformLogoMaxW" type="range" min="100" max="2000" /><input v-model.number="options.uniformLogoMaxW" type="number" min="100" max="2000" class="slider-num" /></div></div>
            <div class="slider"><label>Max Height (px)</label><div class="slider-row"><input v-model.number="options.uniformLogoMaxH" type="range" min="50" max="1200" /><input v-model.number="options.uniformLogoMaxH" type="number" min="50" max="1200" class="slider-num" /></div></div>
            <div class="slider"><label>Logo Box X %</label><div class="slider-row"><input v-model.number="options.uniformLogoOffsetX" type="range" min="0" max="100" /><input v-model.number="options.uniformLogoOffsetX" type="number" min="0" max="100" class="slider-num" /></div></div>
            <div class="slider"><label>Logo Box Y %</label><div class="slider-row"><input v-model.number="options.uniformLogoOffsetY" type="range" min="0" max="100" /><input v-model.number="options.uniformLogoOffsetY" type="number" min="0" max="100" class="slider-num" /></div></div>
            <label class="field-label">Horizontal Align
              <div class="segmented"><button v-for="value in ['left','center','right']" :key="value" :class="{ active: options.uniformLogoHAlign === value }" @click="options.uniformLogoHAlign = value as any">{{ value }}</button></div>
            </label>
            <label class="field-label">Vertical Align
              <div class="segmented"><button v-for="value in ['top','center','bottom']" :key="value" :class="{ active: options.uniformLogoVAlign === value }" @click="options.uniformLogoVAlign = value as any">{{ value }}</button></div>
            </label>
          </div>
        </div>

        <div class="acc-section">
          <button class="acc-header" @click="toggleSection('text')">
            <span>Custom Text Overlay</span>
            <span class="chevron" :class="{ open: sectionOpen.text }">⌃</span>
          </button>
          <div v-show="sectionOpen.text" class="acc-body">
            <label class="inline-field checkbox"><input v-model="textOverlayEnabled" type="checkbox" /><span>Enable custom text</span></label>
            <template v-if="textOverlayEnabled">
              <label class="field-label">Text Content<textarea v-model="customText" rows="4"></textarea></label>
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
              <div class="slider"><label>Letter Spacing</label><div class="slider-row"><input v-model.number="letterSpacing" type="range" min="-5" max="20" /><input v-model.number="letterSpacing" type="number" min="-5" max="20" class="slider-num" /></div></div>
              <div class="slider"><label>Line Height %</label><div class="slider-row"><input v-model.number="lineHeight" type="range" min="60" max="250" /><input v-model.number="lineHeight" type="number" min="60" max="250" class="slider-num" /></div></div>
              <div class="slider"><label>Vertical Position %</label><div class="slider-row"><input v-model.number="positionY" type="range" min="5" max="95" /><input v-model.number="positionY" type="number" min="5" max="95" class="slider-num" /></div></div>

              <label class="inline-field checkbox"><input v-model="shadowEnabled" type="checkbox" /><span>Shadow</span></label>
              <template v-if="shadowEnabled">
                <div class="slider"><label>Shadow Blur</label><div class="slider-row"><input v-model.number="shadowBlur" type="range" min="0" max="40" /><input v-model.number="shadowBlur" type="number" min="0" max="40" class="slider-num" /></div></div>
                <div class="slider"><label>Shadow X</label><div class="slider-row"><input v-model.number="shadowOffsetX" type="range" min="-30" max="30" /><input v-model.number="shadowOffsetX" type="number" min="-30" max="30" class="slider-num" /></div></div>
                <div class="slider"><label>Shadow Y</label><div class="slider-row"><input v-model.number="shadowOffsetY" type="range" min="-30" max="30" /><input v-model.number="shadowOffsetY" type="number" min="-30" max="30" class="slider-num" /></div></div>
                <label class="field-label">Shadow Color<input v-model="shadowColor" type="color" /></label>
                <div class="slider"><label>Shadow Opacity %</label><div class="slider-row"><input v-model.number="shadowOpacity" type="range" min="0" max="100" /><input v-model.number="shadowOpacity" type="number" min="0" max="100" class="slider-num" /></div></div>
              </template>

              <label class="inline-field checkbox"><input v-model="strokeEnabled" type="checkbox" /><span>Stroke</span></label>
              <template v-if="strokeEnabled">
                <div class="slider"><label>Stroke Width</label><div class="slider-row"><input v-model.number="strokeWidth" type="range" min="1" max="15" /><input v-model.number="strokeWidth" type="number" min="1" max="15" class="slider-num" /></div></div>
                <label class="field-label">Stroke Color<input v-model="strokeColor" type="color" /></label>
              </template>
            </template>
          </div>
        </div>

        <div class="acc-section">
          <button class="acc-header" @click="toggleSection('effects')">
            <span>Border</span>
            <span class="chevron" :class="{ open: sectionOpen.effects }">⌃</span>
          </button>
          <div v-show="sectionOpen.effects" class="acc-body">
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
          <img :key="posterRefreshKey" :src="currentCoverUrl" alt="Current Plex cover" class="existing-img" />
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
            <div class="preview-actions">
              <button title="Save to Disk" class="btn-save btn-inline" :disabled="loading" @click="saveCover(true, false)">💾 <span>Save to Disk</span></button>
              <button title="Send to Plex" class="btn-plex btn-inline" :disabled="loading" @click="saveCover(false, true)">📺 <span>Send to Plex</span></button>
              <button title="Save and Send" class="btn-plex btn-inline" :disabled="loading" @click="saveCover(true, true)">✓ <span>Save + Send</span></button>
            </div>
          </div>
          <div class="preview-container">
            <img v-if="previewUrl" :src="previewUrl" alt="Audiobook cover preview" class="preview-img" />
            <div v-else-if="selectedBackground" class="placeholder-state">
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
.editor-shell { display: grid; grid-template-columns: 480px 1fr; height: calc(100vh - 60px); background: var(--surface); overflow: hidden; }
.controls-sidebar { background: rgba(17, 20, 30, 0.95); border-right: 1px solid var(--border); display: flex; flex-direction: column; overflow: hidden; }
.pane-header { padding: 16px 18px; border-bottom: 1px solid var(--border); display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.kicker { margin: 0 0 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--muted); }
.pane-header h2 { margin: 0; font-size: 18px; font-weight: 700; color: #eef2ff; }
.pane-header h2 span, .author-line { color: var(--muted); font-weight: 500; }
.author-line { margin: 3px 0 0; font-size: 12px; }
.close-btn { width: 34px; height: 34px; border: 1px solid var(--border); border-radius: 8px; background: rgba(255,255,255,.04); color: #dce6ff; font-size: 22px; cursor: pointer; }
.controls-scroll { flex: 1; overflow-y: auto; padding: 0 18px 20px; }
.acc-section { border-bottom: 1px solid var(--border); }
.acc-header { width: 100%; padding: 15px 0; border: 0; background: transparent; color: #e0e9ff; display: flex; justify-content: space-between; font-size: 14px; font-weight: 600; cursor: pointer; }
.chevron { transition: transform .2s; transform: rotate(180deg); }
.chevron.open { transform: rotate(0); }
.acc-body { padding-bottom: 16px; }
.field-label { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; font-size: 13px; font-weight: 500; color: #dce6ff; }
.field-label input, .field-label select, .field-label textarea, .new-preset-input { width: 100%; padding: 8px; border-radius: 8px; border: 1px solid var(--border); background: rgba(255,255,255,.04); color: #e6edff; font-size: 13px; }
.field-label textarea { resize: vertical; }
.field-label input[type='color'] { height: 38px; padding: 3px; }
.field-hint { margin: -6px 0 12px; color: var(--muted); font-size: 11px; }
.preset-row { display: flex; gap: 8px; align-items: flex-end; }
.preset-select { flex: 1; }
.new-preset-row { margin-top: 8px; }
.new-preset-input { flex: 1; padding: 10px; }
.save-preset-btn.wide { width: 120px; }

.save-preset-btn {
  flex: 0 0 auto;
  min-width: 42px;
  height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(120deg, #3dd6b7, #5b8dee);
  color: #fff;
  font-weight: 600;
  padding: 10px 14px;
  box-shadow: 0 6px 18px rgba(61, 214, 183, 0.18);
  cursor: pointer;
  transition: all 0.2s ease;
}

.save-preset-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 22px rgba(61, 214, 183, 0.24);
}

.save-preset-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.reload-preset-btn {
  flex: 0 0 auto;
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  color: #dce6ff;
  cursor: pointer;
  transition: all 0.2s;
}

.reload-preset-btn:hover:not(:disabled) {
  background: rgba(61, 214, 183, 0.1);
  border-color: rgba(61, 214, 183, 0.3);
  color: var(--accent);
}

.reload-preset-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.sub-section-title { margin: 16px 0 10px; padding-bottom: 7px; border-bottom: 1px solid rgba(255,255,255,.06); color: #bdc9e6; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
.slider { margin-bottom: 14px; }
.slider > label { display: block; margin-bottom: 6px; color: #cdd8f2; font-size: 13px; }
.slider-row { display: grid; grid-template-columns: 1fr 84px; gap: 10px; align-items: center; }
.slider-row input[type='range'] { width: 100%; }
.slider-num { width: 84px; padding: 7px; border: 1px solid var(--border); border-radius: 8px; background: rgba(255,255,255,.04); color: #e6edff; text-align: center; }
.inline-field.checkbox { display: flex; flex-direction: row; align-items: center; gap: 7px; margin: 10px 0; color: #dce6ff; font-size: 13px; }
.inline-field.checkbox input { width: auto; }
.cover-provider-controls { display: flex; flex-wrap: wrap; gap: 2px 14px; margin-bottom: 8px; }
.audnexus-row { display: grid; grid-template-columns: 1fr 38px; gap: 8px; align-items: end; margin-bottom: 10px; }
.audnexus-row .field-label { margin-bottom: 0; }
.cover-refresh-btn { margin-bottom: 0; }
.cover-results { margin-bottom: 14px; }
.cover-thumb-strip { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 8px; max-height: 294px; overflow-y: auto; padding: 3px; }
.cover-thumb { position: relative; aspect-ratio: 1/1; padding: 0; overflow: hidden; border: 2px solid transparent; border-radius: 9px; background: rgba(255,255,255,.025); cursor: pointer; transition: border-color .2s, box-shadow .2s, transform .15s; }
.cover-thumb:hover { border-color: rgba(61,214,183,.4); transform: translateY(-1px); }
.cover-thumb.active { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
.cover-thumb img { display: block; width: 100%; height: 100%; object-fit: cover; }
.cover-thumb .source-badge { position: absolute; left: 4px; bottom: 4px; max-width: calc(100% - 8px); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 2px 5px; border: 1px solid rgba(61,214,183,.3); border-radius: 4px; background: rgba(0,0,0,.78); color: #3dd6b7; font-size: 8px; font-weight: 700; letter-spacing: .25px; }
.cover-results-message { padding: 13px; border: 1px dashed #344154; border-radius: 9px; color: var(--muted); font-size: 12px; text-align: center; }
.cover-provider-error { margin: 7px 0 0; color: #ffb3b3; font-size: 10px; line-height: 1.35; }
.upload-zone { min-height: 94px; border: 1px dashed #344154; border-radius: 10px; display: grid; place-items: center; position: relative; overflow: hidden; color: #aeb9cf; cursor: pointer; }
.upload-zone.drag-over { border-color: var(--accent); background: rgba(61,214,183,.06); }
.upload-zone.has-upload { min-height: 130px; }
.upload-preview { width: 100%; height: 160px; object-fit: cover; }
.logo-upload { min-height: 110px; background: rgba(0,0,0,.16); }
.logo-preview { max-width: 90%; max-height: 100px; object-fit: contain; }
.upload-overlay { position: absolute; inset: auto 0 0; display: flex; justify-content: center; gap: 8px; padding: 8px; background: rgba(0,0,0,.72); }
.upload-overlay button { padding: 6px 9px; border: 1px solid rgba(255,255,255,.18); border-radius: 7px; background: rgba(255,255,255,.08); color: #fff; cursor: pointer; }
.logo-choice-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
.logo-choice { min-height: 82px; padding: 8px; border: 2px solid var(--border); border-radius: 10px; background: rgba(255,255,255,.03); color: #cdd8f2; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; cursor: pointer; }
.logo-choice.active { border-color: var(--accent); }
.logo-choice img { max-width: 100%; max-height: 54px; object-fit: contain; }
.segmented { display: grid; grid-template-columns: repeat(3,1fr); gap: 7px; }
.segmented button { padding: 8px; border: 1px solid var(--border); border-radius: 7px; background: #202a37; color: #b8c4dc; text-transform: capitalize; cursor: pointer; }
.segmented button.active { background: #89c5d7; color: white; }
.acc-actions { padding: 16px 0; display: grid; gap: 8px; }
.btn-primary { padding: 10px 14px; border: 0; border-radius: 9px; background: linear-gradient(120deg,#3dd6b7,#5b8dee); color: #fff; font-weight: 700; cursor: pointer; }
.error-text { color: #ff9b9b; font-size: 12px; }
.preview-pane { min-width: 0; overflow: auto; display: flex; align-items: center; justify-content: center; padding: 24px; }
.preview-inner { width: 100%; display: grid; grid-template-columns: minmax(180px,260px) minmax(360px,760px); justify-content: center; align-items: center; gap: 30px; }
.preview-existing, .preview-main { align-self: center; }
.preview-label { min-height: 38px; margin-bottom: 10px; color: #dce6ff; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 9px; }
.existing-img { width: 100%; aspect-ratio: 1; object-fit: contain; border-radius: 12px; background: #090b10; box-shadow: 0 12px 35px rgba(0,0,0,.35); }
.metadata-summary { padding: 12px 2px; color: var(--muted); font-size: 12px; text-align: center; }
.metadata-summary p { margin: 2px 0; }
.summary-title { color: #eef2ff; font-weight: 700; }
.preview-main { min-width: 0; }
.preview-actions { margin-left: auto; display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.btn-inline { padding: 7px 10px; font-size: 12px; }
.preview-container { width: min(66vh,680px); max-width: 100%; aspect-ratio: 1; margin: 0 auto; position: relative; display: grid; place-items: center; overflow: hidden; border-radius: 14px; background: #080a0f; box-shadow: 0 18px 60px rgba(0,0,0,.4); }
.preview-img, .placeholder-state, .placeholder-img { width: 100%; height: 100%; object-fit: contain; }
.placeholder-state { position: relative; }
.placeholder-overlay { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(0,0,0,.38); color: #dce6ff; }
.loading-overlay { position: absolute; inset: 0; display: grid; place-items: center; align-content: center; gap: 10px; background: rgba(5,7,12,.68); color: #fff; }
.spinner { width: 32px; height: 32px; border: 3px solid rgba(255,255,255,.22); border-top-color: var(--accent); border-radius: 50%; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.status-badge { padding: 3px 7px; border-radius: 999px; background: rgba(255,255,255,.08); color: #bbc7df; font-size: 10px; }
.status-badge.success { background: rgba(61,214,183,.14); color: var(--accent); }
.success-text { margin-top: 10px; color: #7de3bd; font-size: 12px; text-align: center; }
button:disabled { opacity: .5; cursor: not-allowed; }
@media (max-width: 1100px) { .editor-shell { grid-template-columns: 400px 1fr; } .preview-inner { grid-template-columns: 1fr; max-width: 650px; } .preview-existing { display: none; } }
@media (max-width: 800px) { .editor-shell { grid-template-columns: 1fr; height: auto; overflow: visible; } .controls-sidebar { max-height: none; } .controls-scroll { overflow: visible; } .preview-pane { padding: 16px; } .preview-container { width: min(90vw,620px); } }
</style>
