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
const STYLE_ID = 'simposter-library-page-density-v2-styles'
const MIN_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 100

const settings = useSettingsStore()
const apiBase = getApiBase()

let scheduled = false
let audiobookOptions: LibraryOption[] = []
let audiobookOptionsLoaded = false
let pageSizes: Record<string, number> = {}

const normalizePageSize = (value: unknown, fallback = 20) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(MIN_PAGE_SIZE, Math.min(MAX_PAGE_SIZE, Math.round(numeric)))
}

const loadPageSizes = () => {
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

const persistPageSizes = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pageSizes))
  } catch {
    /* ignore localStorage failures */
  }
}

pageSizes = loadPageSizes()

const getFallbackPageSize = () => normalizePageSize(settings.posterDensity.value, 20)

const movieAndTvOptions = (): LibraryOption[] => {
  const options: LibraryOption[] = []

  ;(settings.plex.value.libraryMappings || []).forEach((library, index) => {
    const id = String(library.id || index)
    options.push({
      key: `movie:${id}`,
      label: library.displayName || library.title || `Movie Library ${index + 1}`,
    })
  })

  ;(settings.plex.value.tvShowLibraryMappings || []).forEach((library, index) => {
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

const allOptions = () => [...movieAndTvOptions(), ...audiobookOptions]

const seedMissingPageSizes = (options: LibraryOption[]) => {
  const fallback = getFallbackPageSize()
  let changed = false

  options.forEach((option) => {
    if (pageSizes[option.key] !== undefined) return
    pageSizes[option.key] = fallback
    changed = true
  })

  if (changed) persistPageSizes()
}

const currentLibraryKey = (): string | null => {
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
  const key = currentLibraryKey()
  if (!key) return

  if (pageSizes[key] === undefined) {
    pageSizes[key] = getFallbackPageSize()
    persistPageSizes()
  }

  const next = pageSizes[key]!
  if (settings.posterDensity.value !== next) {
    settings.posterDensity.value = next
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

const createDensityRow = (option: LibraryOption) => {
  const row = document.createElement('label')
  row.className = 'simposter-library-density-row'

  const header = document.createElement('div')
  header.className = 'simposter-library-density-header'

  const name = document.createElement('span')
  name.textContent = option.label

  const valueText = document.createElement('strong')
  const initialValue = pageSizes[option.key] ?? getFallbackPageSize()
  valueText.textContent = String(initialValue)

  header.append(name, valueText)

  const range = document.createElement('input')
  range.type = 'range'
  range.min = String(MIN_PAGE_SIZE)
  range.max = String(MAX_PAGE_SIZE)
  range.step = '1'
  range.value = String(initialValue)
  range.dataset.libraryDensityKey = option.key

  const saveValue = (event: Event) => {
    event.stopPropagation()

    const value = normalizePageSize(range.value, initialValue)
    range.value = String(value)
    valueText.textContent = String(value)
    pageSizes = { ...pageSizes, [option.key]: value }
    persistPageSizes()
  }

  range.addEventListener('input', saveValue)
  range.addEventListener('change', saveValue)

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

  const options = allOptions()
  if (!options.length) return

  seedMissingPageSizes(options)

  const signature = options
    .map((option) => `${option.key}:${option.label}:${pageSizes[option.key]}`)
    .join('|')

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
  help.textContent = 'Each library has its own independent page size.'

  panel.append(title)
  options.forEach((option) => panel.append(createDensityRow(option)))
  panel.append(help)

  originalLabel.parentElement?.insertBefore(panel, originalLabel)
}

const installStyles = () => {
  if (document.getElementById(STYLE_ID)) return

  const style = document.createElement('style')
  style.id = STYLE_ID
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
