import { watch } from 'vue'
import { router } from '../router'
import { useSettingsStore } from '../stores/settings'
import { getApiBase } from './apiBase'

type LibraryOption = {
  key: string
  label: string
}

type PageLayout = {
  mode: 'auto' | 'manual'
  manualSize: number
}

type AudiobookSettingsPayload = {
  library_mappings?: Array<{
    id?: string | number
    title?: string
    display_name?: string
    enabled?: boolean
  }>
}

const STORAGE_KEY = 'simposter-library-page-layout-v2'
const PANEL_ID = 'simposter-library-page-density-panel'
const STYLE_ID = 'simposter-library-page-density-v2-styles'
const MIN_MANUAL_PAGE_SIZE = 4
const MAX_PAGE_SIZE = 100
const FIT_SAFETY_PX = 3

const settings = useSettingsStore()
const apiBase = getApiBase()

let scheduled = false
let audiobookOptions: LibraryOption[] = []
let audiobookOptionsLoaded = false
let layouts: Record<string, PageLayout> = {}
let lastAppliedKey = ''
let lastAppliedSize = 0

const normalizePageSize = (value: unknown, fallback = 20) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(MIN_MANUAL_PAGE_SIZE, Math.min(MAX_PAGE_SIZE, Math.round(numeric)))
}

const loadLayouts = (): Record<string, PageLayout> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const result: Record<string, PageLayout> = {}

    Object.entries(parsed).forEach(([key, value]) => {
      if (!value || typeof value !== 'object') return
      const candidate = value as Partial<PageLayout>
      result[key] = {
        mode: candidate.mode === 'manual' ? 'manual' : 'auto',
        manualSize: normalizePageSize(candidate.manualSize, 20),
      }
    })

    return result
  } catch {
    return {}
  }
}

const persistLayouts = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts))
  } catch {
    /* ignore localStorage failures */
  }
}

layouts = loadLayouts()

const fallbackPageSize = () => normalizePageSize(settings.posterDensity.value, 20)

const ensureLayout = (key: string): PageLayout => {
  if (!layouts[key]) {
    layouts = {
      ...layouts,
      [key]: {
        mode: 'auto',
        manualSize: fallbackPageSize(),
      },
    }
    persistLayouts()
  }

  return layouts[key]!
}

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

const seedMissingLayouts = (options: LibraryOption[]) => {
  let changed = false

  options.forEach((option) => {
    if (layouts[option.key]) return
    layouts[option.key] = {
      mode: 'auto',
      manualSize: fallbackPageSize(),
    }
    changed = true
  })

  if (changed) persistLayouts()
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

const getColumnCount = (grid: HTMLElement) => {
  const template = getComputedStyle(grid).gridTemplateColumns.trim()
  if (!template || template === 'none') return 0

  // Browsers expose the resolved auto-fill tracks here as pixel values.
  return template.split(/\s+/).filter(Boolean).length
}

const getRepresentativeRowHeight = (grid: HTMLElement) => {
  const cards = Array.from(grid.children).filter((child): child is HTMLElement => child instanceof HTMLElement)
  if (!cards.length) return 0

  // Grid rows can grow slightly when a title wraps. Using the tallest rendered
  // card keeps auto-fit conservative enough to avoid a one-pixel overflow.
  return Math.max(...cards.map((card) => card.getBoundingClientRect().height))
}

const calculateAutoPageSize = () => {
  const view = document.querySelector<HTMLElement>('.main-pane > .view')
  const gridBlock = view?.querySelector<HTMLElement>(':scope > .grid-block')
  const grid = gridBlock?.querySelector<HTMLElement>(':scope > .grid')
  if (!view || !gridBlock || !grid) return null

  const columns = getColumnCount(grid)
  const rowHeight = getRepresentativeRowHeight(grid)
  if (columns < 1 || rowHeight <= 0) return null

  const gridBlockRect = gridBlock.getBoundingClientRect()
  const gridRect = grid.getBoundingClientRect()
  const availableHeight = Math.max(0, gridBlockRect.bottom - gridRect.top - FIT_SAFETY_PX)
  const rowGap = Number.parseFloat(getComputedStyle(grid).rowGap) || 0
  const rows = Math.max(1, Math.floor((availableHeight + rowGap) / (rowHeight + rowGap)))

  return Math.max(columns, Math.min(MAX_PAGE_SIZE, columns * rows))
}

const applyPageSize = (key: string, value: number) => {
  const normalized = normalizePageSize(value, fallbackPageSize())
  if (lastAppliedKey === key && lastAppliedSize === normalized && settings.posterDensity.value === normalized) {
    return
  }

  lastAppliedKey = key
  lastAppliedSize = normalized

  if (settings.posterDensity.value !== normalized) {
    settings.posterDensity.value = normalized
  }
}

const applyCurrentLibraryPageSize = () => {
  const key = currentLibraryKey()
  if (!key) return

  const layout = ensureLayout(key)
  if (layout.mode === 'manual') {
    applyPageSize(key, layout.manualSize)
    return
  }

  const fitted = calculateAutoPageSize()
  if (fitted) applyPageSize(key, fitted)
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
  const layout = ensureLayout(option.key)
  const row = document.createElement('div')
  row.className = 'simposter-library-density-row'

  const header = document.createElement('div')
  header.className = 'simposter-library-density-header'

  const name = document.createElement('span')
  name.textContent = option.label

  const valueText = document.createElement('strong')
  valueText.textContent = layout.mode === 'auto' ? 'Auto-fit' : String(layout.manualSize)

  header.append(name, valueText)

  const autoLabel = document.createElement('label')
  autoLabel.className = 'simposter-library-density-auto'

  const autoCheckbox = document.createElement('input')
  autoCheckbox.type = 'checkbox'
  autoCheckbox.checked = layout.mode === 'auto'

  const autoText = document.createElement('span')
  autoText.textContent = 'Automatically fill available space'
  autoLabel.append(autoCheckbox, autoText)

  const range = document.createElement('input')
  range.type = 'range'
  range.min = String(MIN_MANUAL_PAGE_SIZE)
  range.max = String(MAX_PAGE_SIZE)
  range.step = '1'
  range.value = String(layout.manualSize)
  range.disabled = layout.mode === 'auto'
  range.dataset.libraryDensityKey = option.key

  autoCheckbox.addEventListener('change', (event) => {
    event.stopPropagation()
    const current = ensureLayout(option.key)
    const mode: PageLayout['mode'] = autoCheckbox.checked ? 'auto' : 'manual'
    layouts = { ...layouts, [option.key]: { ...current, mode } }
    persistLayouts()

    range.disabled = mode === 'auto'
    valueText.textContent = mode === 'auto' ? 'Auto-fit' : String(current.manualSize)

    if (currentLibraryKey() === option.key) schedule()
  })

  const saveManualValue = (event: Event) => {
    event.stopPropagation()
    const current = ensureLayout(option.key)
    const manualSize = normalizePageSize(range.value, current.manualSize)
    range.value = String(manualSize)
    layouts = { ...layouts, [option.key]: { ...current, manualSize } }
    persistLayouts()

    if (!autoCheckbox.checked) {
      valueText.textContent = String(manualSize)
      if (currentLibraryKey() === option.key) applyPageSize(option.key, manualSize)
    }
  }

  range.addEventListener('input', saveManualValue)
  range.addEventListener('change', saveManualValue)

  row.append(header, autoLabel, range)
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

  seedMissingLayouts(options)

  const signature = options
    .map((option) => {
      const layout = ensureLayout(option.key)
      return `${option.key}:${option.label}:${layout.mode}:${layout.manualSize}`
    })
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
  help.textContent = 'Auto-fit uses the current window, sidebar width, card shape, and available grid height. Disable it for any library you want to size manually.'

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
      gap: 15px;
      margin-bottom: 18px;
      max-width: 560px;
    }

    .simposter-library-density-title {
      color: var(--text-primary);
      font-size: 14px;
      font-weight: 600;
    }

    .simposter-library-density-row {
      display: flex;
      flex-direction: column;
      gap: 7px;
      padding-bottom: 12px;
      border-bottom: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
    }

    .simposter-library-density-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      max-width: 440px;
      color: var(--text-primary);
      font-size: 13px;
    }

    .simposter-library-density-header strong {
      color: var(--accent);
      font-variant-numeric: tabular-nums;
    }

    .simposter-library-density-auto {
      display: flex !important;
      flex-direction: row !important;
      align-items: center;
      gap: 8px !important;
      margin: 0 !important;
      color: var(--text-secondary);
      font-size: 12px;
      cursor: pointer;
    }

    .simposter-library-density-auto input {
      margin: 0;
    }

    .simposter-library-density-row input[type='range'] {
      width: 100%;
      max-width: 440px;
    }

    .simposter-library-density-row input[type='range']:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }

    .simposter-library-density-help {
      color: var(--text-muted);
      font-size: 12px;
      max-width: 520px;
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

  router.afterEach(() => {
    lastAppliedKey = ''
    lastAppliedSize = 0
    schedule()
  })

  const observer = new MutationObserver(() => schedule())
  observer.observe(document.body, { childList: true, subtree: true })

  if ('ResizeObserver' in window) {
    const resizeObserver = new ResizeObserver(() => schedule())
    const observeLayoutTargets = () => {
      const gridBlock = document.querySelector<HTMLElement>('.main-pane > .view > .grid-block')
      const mainPane = document.querySelector<HTMLElement>('.main-pane')
      if (gridBlock) resizeObserver.observe(gridBlock)
      if (mainPane) resizeObserver.observe(mainPane)
    }
    observeLayoutTargets()
    window.setInterval(observeLayoutTargets, 1000)
  }

  window.addEventListener('resize', schedule)

  document.addEventListener('change', (event) => {
    const target = event.target
    if (target instanceof HTMLSelectElement && target.id === 'audiobook-library') {
      lastAppliedKey = ''
      window.setTimeout(schedule, 0)
    }
  })

  document.addEventListener('click', (event) => {
    const target = event.target
    if (target instanceof Element && target.closest('.collapse-btn')) {
      window.setTimeout(schedule, 240)
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
