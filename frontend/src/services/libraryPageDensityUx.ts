import { watch } from 'vue'
import { router } from '../router'
import { useSettingsStore } from '../stores/settings'
import { getApiBase } from './apiBase'

type LibraryOption = {
  key: string
  label: string
}

type AudiobookSettingsPayload = {
  library_mappings?: Array<{
    id?: string | number
    title?: string
    display_name?: string
    enabled?: boolean
  }>
}

const STORAGE_KEY = 'simposter-library-page-sizes-v1'
const PANEL_ID = 'simposter-library-page-density-panel'
const MIN_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 100

const settings = useSettingsStore()
const apiBase = getApiBase()

let scheduled = false
let audiobookOptions: LibraryOption[] = []
let audiobookOptionsLoaded = false

const readPageSizes = (): Record<string, number> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const result: Record<string, number> = {}

    Object.entries(parsed).forEach(([key, value]) => {
      const numeric = Number(value)
      if (Number.isFinite(numeric) && numeric >= MIN_PAGE_SIZE && numeric <= MAX_PAGE_SIZE) {
        result[key] = Math.round(numeric)
      }
    })

    return result
  } catch {
    return {}
  }
}

const writePageSizes = (values: Record<string, number>) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(values))
  } catch {
    /* ignore localStorage failures */
  }
}

const getFallbackPageSize = () => {
  const value = Number(settings.posterDensity.value)
  return Number.isFinite(value) && value >= MIN_PAGE_SIZE && value <= MAX_PAGE_SIZE
    ? Math.round(value)
    : 20
}

const getCurrentLibraryKey = (): string | null => {
  const route = router.currentRoute.value
  const routeName = String(route.name || '')
  const routeLibrary = String(route.query.library || '')

  if (routeName === 'movies') {
    const fallback = String(settings.plex.value.libraryMappings?.[0]?.id || 'default')
    return `movie:${routeLibrary || fallback}`
  }

  if (routeName === 'tv-shows') {
    const fallback = String(settings.plex.value.tvShowLibraryMappings?.[0]?.id || 'default')
    return `tv:${routeLibrary || fallback}`
  }

  if (routeName === 'audiobooks') {
    const selected =
      routeLibrary ||
      document.querySelector<HTMLSelectElement>('#audiobook-library')?.value ||
      'default'
    return `audiobook:${selected}`
  }

  return null
}

const applyCurrentLibraryPageSize = () => {
  const key = getCurrentLibraryKey()
  if (!key) return

  const saved = readPageSizes()[key]
  if (!saved) return

  if (settings.posterDensity.value !== saved) {
    settings.posterDensity.value = saved
  }
}

const getMovieAndTvOptions = (): LibraryOption[] => {
  const options: LibraryOption[] = []

  const movieMappings = settings.plex.value.libraryMappings || []
  movieMappings.forEach((library, index) => {
    const id = String(library.id || index)
    options.push({
      key: `movie:${id}`,
      label: library.displayName || library.title || `Movie Library ${index + 1}`,
    })
  })

  const tvMappings = settings.plex.value.tvShowLibraryMappings || []
  tvMappings.forEach((library, index) => {
    const id = String(library.id || index)
    options.push({
      key: `tv:${id}`,
      label: library.displayName || library.title || `TV Library ${index + 1}`,
    })
  })

  return options
}

const loadAudiobookOptions = async () => {
  if (audiobookOptionsLoaded) return
  audiobookOptionsLoaded = true

  try {
    const response = await fetch(`${apiBase}/api/audiobook-settings`)
    if (!response.ok) return

    const data = (await response.json()) as AudiobookSettingsPayload
    audiobookOptions = (data.library_mappings || [])
      .filter((library) => library.enabled !== false && library.id !== undefined && library.id !== null)
      .map((library, index) => ({
        key: `audiobook:${String(library.id)}`,
        label: library.display_name || library.title || `Audiobook Library ${index + 1}`,
      }))
  } catch {
    audiobookOptions = []
  }
}

const findOriginalDensityLabel = () => {
  const ranges = Array.from(
    document.querySelectorAll<HTMLInputElement>('input[type="range"][min="10"][max="100"]'),
  )

  return ranges
    .map((range) => range.closest<HTMLLabelElement>('label'))
    .find((label) => label?.textContent?.includes('Items per page')) || null
}

const createDensityRow = (
  option: LibraryOption,
  values: Record<string, number>,
  fallback: number,
) => {
  const row = document.createElement('label')
  row.className = 'simposter-library-density-row'

  const header = document.createElement('div')
  header.className = 'simposter-library-density-header'

  const name = document.createElement('span')
  name.textContent = option.label

  const valueText = document.createElement('strong')
  const initialValue = values[option.key] || fallback
  valueText.textContent = String(initialValue)

  header.append(name, valueText)

  const range = document.createElement('input')
  range.type = 'range'
  range.min = String(MIN_PAGE_SIZE)
  range.max = String(MAX_PAGE_SIZE)
  range.step = '1'
  range.value = String(initialValue)
  range.dataset.libraryDensityKey = option.key

  range.addEventListener('input', () => {
    const value = Math.max(MIN_PAGE_SIZE, Math.min(MAX_PAGE_SIZE, Number(range.value) || fallback))
    valueText.textContent = String(value)

    const next = readPageSizes()
    next[option.key] = value
    writePageSizes(next)

    if (getCurrentLibraryKey() === option.key) {
      settings.posterDensity.value = value
    }
  })

  row.append(header, range)
  return row
}

const ensureSettingsPanel = async () => {
  if (String(router.currentRoute.value.name || '') !== 'settings') return
  if (router.currentRoute.value.query.tab && router.currentRoute.value.query.tab !== 'general') return

  const originalLabel = findOriginalDensityLabel()
  if (!originalLabel) return

  await loadAudiobookOptions()
  if (!originalLabel.isConnected) return

  const options = [...getMovieAndTvOptions(), ...audiobookOptions]
  if (!options.length) return

  const signature = options.map((option) => `${option.key}:${option.label}`).join('|')
  const existing = document.getElementById(PANEL_ID)
  if (existing?.dataset.signature === signature) {
    originalLabel.style.display = 'none'
    return
  }

  existing?.remove()
  originalLabel.style.display = 'none'

  const panel = document.createElement('div')
  panel.id = PANEL_ID
  panel.dataset.signature = signature
  panel.className = 'simposter-library-density-panel'

  const title = document.createElement('div')
  title.className = 'simposter-library-density-title'
  title.textContent = 'Items per page by library'

  const help = document.createElement('div')
  help.className = 'simposter-library-density-help'
  help.textContent = 'Each library remembers its own grid size on this browser.'

  const values = readPageSizes()
  const fallback = getFallbackPageSize()

  panel.append(title)
  options.forEach((option) => panel.append(createDensityRow(option, values, fallback)))
  panel.append(help)

  originalLabel.parentElement?.insertBefore(panel, originalLabel)
}

const installStyles = () => {
  if (document.getElementById('simposter-library-page-density-styles')) return

  const style = document.createElement('style')
  style.id = 'simposter-library-page-density-styles'
  style.textContent = `
    .simposter-library-density-panel {
      display: flex;
      flex-direction: column;
      gap: 14px;
      margin-bottom: 18px;
      max-width: 520px;
    }

    .simposter-library-density-title {
      color: var(--text-primary);
      font-size: 14px;
      font-weight: 600;
    }

    .simposter-library-density-row {
      display: flex !important;
      flex-direction: column;
      gap: 7px !important;
      margin: 0 !important;
    }

    .simposter-library-density-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      max-width: 400px;
      color: var(--text-primary);
      font-size: 13px;
    }

    .simposter-library-density-header strong {
      color: var(--accent);
      font-variant-numeric: tabular-nums;
    }

    .simposter-library-density-row input[type='range'] {
      width: 100%;
      max-width: 400px;
    }

    .simposter-library-density-help {
      color: var(--text-muted);
      font-size: 12px;
    }
  `

  document.head.appendChild(style)
}

const run = async () => {
  scheduled = false
  applyCurrentLibraryPageSize()
  await ensureSettingsPanel()
}

const schedule = () => {
  if (scheduled) return
  scheduled = true
  window.requestAnimationFrame(() => void run())
}

const start = () => {
  installStyles()
  schedule()

  router.afterEach(() => schedule())

  const observer = new MutationObserver(() => schedule())
  observer.observe(document.body, { childList: true, subtree: true })

  document.addEventListener('change', (event) => {
    const target = event.target
    if (target instanceof HTMLSelectElement && target.id === 'audiobook-library') {
      window.setTimeout(schedule, 0)
    }
  })

  watch(settings.loaded, () => schedule())
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true })
  } else {
    start()
  }
}
