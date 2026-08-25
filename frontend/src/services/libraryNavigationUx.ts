import { watch } from 'vue'
import { router } from '../router'
import { useSettingsStore } from '../stores/settings'
import { getApiBase } from './apiBase'

type LibraryKind = 'movies' | 'tv-shows' | 'audiobooks'
type SortField = 'title' | 'year' | 'addedAt'
type SortOrder = 'asc' | 'desc'

type LibraryItem = {
  title?: string
  year?: number | string | null
  addedAt?: number | null
}

type GroupPoint = {
  label: string
  index: number
}

type JumpPoint = {
  label: string
  page: number
}

const STYLE_ID = 'simposter-library-navigation-ux-styles'
const FOOTER_CLASS = 'simposter-library-navigation'
const JUMP_CLASS = 'simposter-library-jumps'
const MAX_CONTEXT_JUMPS = 9

const apiBase = getApiBase()
const settings = useSettingsStore()
const itemCache = new Map<string, Promise<LibraryItem[]>>()

let cacheVersion = 0
let scheduled = false
let lastSignature = ''

const installStyles = () => {
  if (document.getElementById(STYLE_ID)) return

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    .toolbar.pagination.${FOOTER_CLASS} {
      position: fixed !important;
      left: calc(var(--sidebar-w, 260px) + 42px);
      right: 28px;
      bottom: 12px;
      z-index: 60;
      width: auto !important;
      max-width: none !important;
      box-sizing: border-box;
      margin: 0 !important;
      padding: 9px 12px 10px !important;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center !important;
      gap: 7px !important;
      border-radius: 12px;
      background: rgba(17, 20, 30, 0.94);
      backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);
      box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.24);
    }

    .toolbar.pagination.${FOOTER_CLASS} .pager {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      flex-shrink: 0;
    }

    .toolbar.pagination.${FOOTER_CLASS} .pager button {
      margin: 0 !important;
    }

    .${JUMP_CLASS} {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      width: 100%;
      min-width: 0;
      flex-wrap: wrap;
    }

    .simposter-library-jump {
      min-width: 29px;
      height: 27px;
      margin: 0 !important;
      padding: 3px 7px !important;
      border: 1px solid rgba(255, 255, 255, 0.09) !important;
      border-radius: 7px !important;
      background: rgba(255, 255, 255, 0.045) !important;
      color: #cdd8f5 !important;
      font-size: 11px !important;
      font-weight: 650;
      line-height: 1 !important;
      cursor: pointer !important;
      white-space: nowrap;
      pointer-events: auto !important;
      transition: background .16s ease, border-color .16s ease, color .16s ease;
    }

    .simposter-library-jump:hover {
      color: var(--accent) !important;
      background: color-mix(in srgb, var(--accent) 10%, transparent) !important;
      border-color: color-mix(in srgb, var(--accent) 32%, var(--border)) !important;
    }

    .simposter-library-jump[data-current='true'] {
      color: var(--accent) !important;
      border-color: color-mix(in srgb, var(--accent) 28%, var(--border)) !important;
      background: color-mix(in srgb, var(--accent) 8%, transparent) !important;
    }

    @media (max-width: 900px) {
      .toolbar.pagination.${FOOTER_CLASS} {
        left: 24px;
        right: 24px;
      }
    }

    @media (max-width: 600px) {
      .toolbar.pagination.${FOOTER_CLASS} {
        left: 18px;
        right: 18px;
        bottom: 8px;
        padding: 7px 8px 8px !important;
        gap: 5px !important;
      }

      .${JUMP_CLASS} {
        gap: 3px;
      }

      .simposter-library-jump {
        min-width: 25px;
        height: 24px;
        padding: 2px 5px !important;
        font-size: 10px !important;
      }
    }
  `
  document.head.appendChild(style)
}

const getKind = (): LibraryKind | null => {
  const routeName = String(router.currentRoute.value.name || '')
  if (routeName === 'movies') return 'movies'
  if (routeName === 'tv-shows') return 'tv-shows'
  if (routeName === 'audiobooks') return 'audiobooks'
  return null
}

const getLibraryId = (kind: LibraryKind) => {
  const queryLibrary = String(router.currentRoute.value.query.library || '')
  if (queryLibrary) return queryLibrary

  if (kind === 'audiobooks') {
    return document.querySelector<HTMLSelectElement>('#audiobook-library')?.value || ''
  }

  return kind === 'tv-shows' ? 'default' : ''
}

const getSort = (kind: LibraryKind): { field: SortField; order: SortOrder } => {
  const route = router.currentRoute.value
  const sortSelect = document.querySelector<HTMLSelectElement>(
    kind === 'audiobooks' ? '#audiobook-sort' : '#sort-select',
  )
  const orderSelect = document.querySelector<HTMLSelectElement>(
    kind === 'audiobooks' ? '#audiobook-order' : '#sort-order',
  )

  if (sortSelect && orderSelect) {
    return {
      field: sortSelect.value as SortField,
      order: orderSelect.value as SortOrder,
    }
  }

  if (kind === 'audiobooks') {
    return {
      field: (route.query.sortBy as SortField) || 'title',
      order: (route.query.sortOrder as SortOrder) || 'asc',
    }
  }

  const [rawField = 'title', rawOrder = 'asc'] = String(
    settings.defaultSort.value || 'title-asc',
  ).split('-')

  const defaultField: SortField =
    rawField === 'added' ? 'addedAt' : rawField === 'year' ? 'year' : 'title'

  return {
    field: (route.query.sortBy as SortField) || defaultField,
    order: (route.query.sortOrder as SortOrder) || (rawOrder === 'desc' ? 'desc' : 'asc'),
  }
}

const getCurrentPage = () => {
  const text = document.querySelector<HTMLElement>('.view > .toolbar.pagination .pager span')?.textContent || ''
  const match = text.match(/(\d+)\s*\/\s*(\d+)/)
  return match ? Number(match[1]) : 1
}

const searchOrFilterActive = () => {
  const search = document.querySelector<HTMLInputElement>('.search-container input')?.value.trim()
  const label = router.currentRoute.value.query.label
  return Boolean(search || label)
}

const invalidate = () => {
  itemCache.clear()
  cacheVersion += 1
  lastSignature = ''
}

const fetchItems = (kind: LibraryKind, libraryId: string) => {
  const deduplicate = kind === 'movies' && settings.deduplicateMovies.value
  const cacheKey = `${kind}|${libraryId}|${deduplicate ? 'dedupe' : 'all'}|${cacheVersion}`
  const cached = itemCache.get(cacheKey)
  if (cached) return cached

  const request = (async (): Promise<LibraryItem[]> => {
    try {
      if (kind === 'audiobooks' && !libraryId) return []

      const params = new URLSearchParams()
      if (libraryId) params.set('library_id', libraryId)
      if (deduplicate) params.set('deduplicate', 'true')

      const path =
        kind === 'tv-shows'
          ? '/api/tv-shows'
          : kind === 'audiobooks'
            ? '/api/audiobooks'
            : '/api/movies'

      const query = params.toString()
      const response = await fetch(`${apiBase}${path}${query ? `?${query}` : ''}`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data: unknown = await response.json()
      return Array.isArray(data) ? (data as LibraryItem[]) : []
    } catch (cause) {
      console.warn('[LibraryNavigation] Could not load jump data:', cause)
      return []
    }
  })()

  itemCache.set(cacheKey, request)
  return request
}

const sortItems = (items: LibraryItem[], field: SortField, order: SortOrder) => {
  const list = [...items]
  const multiplier = order === 'asc' ? 1 : -1

  list.sort((a, b) => {
    if (field === 'title') {
      return multiplier * String(a.title || '').localeCompare(String(b.title || ''))
    }
    if (field === 'year') {
      return multiplier * ((Number(a.year) || 0) - (Number(b.year) || 0))
    }
    return multiplier * ((Number(a.addedAt) || 0) - (Number(b.addedAt) || 0))
  })

  return list
}

const sampleGroups = (groups: GroupPoint[], max = MAX_CONTEXT_JUMPS): GroupPoint[] => {
  if (groups.length <= max) return groups

  const indexes = new Set<number>()
  for (let slot = 0; slot < max; slot += 1) {
    indexes.add(Math.round((slot * (groups.length - 1)) / (max - 1)))
  }

  return Array.from(indexes)
    .sort((a, b) => a - b)
    .map((index) => groups[index]!)
}

const groupsToJumps = (groups: GroupPoint[], pageSize: number, uniquePages = false): JumpPoint[] => {
  const jumps = groups.map(({ label, index }) => ({
    label,
    page: Math.floor(index / pageSize) + 1,
  }))

  if (!uniquePages) return jumps

  const pages = new Set<number>()
  return jumps.filter(({ page }) => {
    if (pages.has(page)) return false
    pages.add(page)
    return true
  })
}

const titleJumps = (items: LibraryItem[], pageSize: number): JumpPoint[] => {
  const groups: GroupPoint[] = []
  const seen = new Set<string>()

  items.forEach((item, index) => {
    const first = String(item.title || '').trim().charAt(0).toUpperCase()
    if (!first) return

    const label = /^[A-Z]$/.test(first) ? first : '#'
    if (seen.has(label)) return

    seen.add(label)
    groups.push({ label, index })
  })

  return groupsToJumps(groups, pageSize)
}

const yearJumps = (items: LibraryItem[], pageSize: number): JumpPoint[] => {
  const groups: GroupPoint[] = []
  const seen = new Set<number>()

  items.forEach((item, index) => {
    const year = Number(item.year)
    if (!Number.isFinite(year) || year <= 0 || seen.has(year)) return
    seen.add(year)
    groups.push({ label: String(year), index })
  })

  return groupsToJumps(sampleGroups(groups), pageSize, true)
}

const toDate = (value: number | null | undefined) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return null
  const milliseconds = numeric < 10_000_000_000 ? numeric * 1000 : numeric
  const date = new Date(milliseconds)
  return Number.isNaN(date.getTime()) ? null : date
}

const mondayOf = (date: Date) => {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7))
  return result
}

const dateJumps = (items: LibraryItem[], pageSize: number): JumpPoint[] => {
  const dated = items
    .map((item) => toDate(item.addedAt))
    .filter((date): date is Date => date !== null)

  if (!dated.length) return []

  const times = dated.map((date) => date.getTime())
  const spanDays = (Math.max(...times) - Math.min(...times)) / 86_400_000
  const mode: 'week' | 'month' | 'year' = spanDays <= 120 ? 'week' : spanDays <= 730 ? 'month' : 'year'
  const groups: GroupPoint[] = []
  const seen = new Set<string>()

  items.forEach((item, index) => {
    const date = toDate(item.addedAt)
    if (!date) return

    let key: string
    let label: string

    if (mode === 'week') {
      const monday = mondayOf(date)
      key = `${monday.getFullYear()}-${monday.getMonth()}-${monday.getDate()}`
      label = monday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    } else if (mode === 'month') {
      key = `${date.getFullYear()}-${date.getMonth()}`
      label = date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
    } else {
      key = String(date.getFullYear())
      label = key
    }

    if (seen.has(key)) return
    seen.add(key)
    groups.push({ label, index })
  })

  return groupsToJumps(sampleGroups(groups), pageSize, true)
}

const buildJumps = (items: LibraryItem[], field: SortField, pageSize: number) => {
  if (field === 'title') return titleJumps(items, pageSize)
  if (field === 'year') return yearJumps(items, pageSize)
  return dateJumps(items, pageSize)
}

const goToPage = (targetPage: number) => {
  const pager = document.querySelector<HTMLElement>('.view > .toolbar.pagination .pager')
  if (!pager) return

  const buttons = Array.from(pager.querySelectorAll<HTMLButtonElement>('button'))
  if (buttons.length < 2) return

  const moveOnePage = () => {
    const currentPage = getCurrentPage()
    if (currentPage === targetPage) return

    const movingForward = targetPage > currentPage
    const button = movingForward ? buttons[buttons.length - 1] : buttons[0]
    if (!button || button.disabled) return

    button.click()
    window.requestAnimationFrame(moveOnePage)
  }

  moveOnePage()
}

const renderJumps = (
  footer: HTMLElement,
  jumps: JumpPoint[],
  currentPage: number,
  field: SortField,
) => {
  footer.querySelector(`.${JUMP_CLASS}`)?.remove()
  if (jumps.length < 2) return

  const strip = document.createElement('div')
  strip.className = JUMP_CLASS
  strip.setAttribute(
    'aria-label',
    field === 'title' ? 'Jump by title' : field === 'year' ? 'Jump by year' : 'Jump by date added',
  )

  jumps.forEach(({ label, page }) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'simposter-library-jump'
    button.textContent = label
    button.title = `Jump to ${label}`
    button.dataset.current = page === currentPage ? 'true' : 'false'
    button.dataset.page = String(page)
    button.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      goToPage(page)
    })
    strip.appendChild(button)
  })

  footer.appendChild(strip)

  const view = footer.closest<HTMLElement>('.view')
  if (view) {
    window.requestAnimationFrame(() => {
      if (footer.isConnected && view.isConnected) {
        view.style.paddingBottom = `${footer.offsetHeight + 18}px`
      }
    })
  }
}

const currentSignature = () => {
  const kind = getKind()
  if (!kind) return ''

  const libraryId = getLibraryId(kind)
  const { field, order } = getSort(kind)
  const pageSize = Math.max(1, Number(settings.posterDensity.value) || 20)
  const currentPage = getCurrentPage()
  const filtered = searchOrFilterActive() ? 'filtered' : 'unfiltered'
  return [kind, libraryId, field, order, pageSize, currentPage, filtered, cacheVersion].join('|')
}

const enhance = async () => {
  scheduled = false

  const kind = getKind()
  const footer = document.querySelector<HTMLElement>('.view > .toolbar.pagination')
  if (!kind || !footer) return

  footer.classList.add(FOOTER_CLASS)

  const signature = currentSignature()
  const existingStrip = footer.querySelector(`.${JUMP_CLASS}`)
  if (signature && signature === lastSignature && existingStrip) return

  if (searchOrFilterActive()) {
    existingStrip?.remove()
    lastSignature = signature
    return
  }

  const libraryId = getLibraryId(kind)
  const { field, order } = getSort(kind)
  const pageSize = Math.max(1, Number(settings.posterDensity.value) || 20)
  const currentPage = getCurrentPage()
  const items = await fetchItems(kind, libraryId)

  if (!footer.isConnected || currentSignature() !== signature) return
  if (footer.querySelector(`.${JUMP_CLASS}`) && signature === lastSignature) return

  const sorted = sortItems(items, field, order)
  renderJumps(footer, buildJumps(sorted, field, pageSize), currentPage, field)
  lastSignature = signature
}

const scheduleEnhance = () => {
  if (scheduled) return
  scheduled = true
  window.requestAnimationFrame(() => void enhance())
}

const start = () => {
  installStyles()
  scheduleEnhance()

  const observer = new MutationObserver(() => scheduleEnhance())
  observer.observe(document.body, { childList: true, subtree: true, characterData: true })

  router.afterEach(() => {
    lastSignature = ''
    window.requestAnimationFrame(scheduleEnhance)
  })

  window.addEventListener('simposter:libraries-rescanned', () => {
    invalidate()
    scheduleEnhance()
  })

  document.addEventListener('input', (event) => {
    const target = event.target
    if (target instanceof HTMLInputElement && target.matches('.search-container input')) {
      lastSignature = ''
      scheduleEnhance()
    }
  })

  document.addEventListener('change', (event) => {
    const target = event.target
    if (!(target instanceof HTMLSelectElement)) return

    if (
      target.id === 'audiobook-library' ||
      target.id === 'audiobook-sort' ||
      target.id === 'audiobook-order' ||
      target.id === 'sort-select' ||
      target.id === 'sort-order' ||
      target.id === 'label-select'
    ) {
      lastSignature = ''
      if (target.id === 'audiobook-library') invalidate()
      scheduleEnhance()
    }
  })

  document.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof Element)) return
    if (target.closest('.refresh-btn')) {
      invalidate()
      window.setTimeout(scheduleEnhance, 300)
    }
  })

  watch(
    [settings.posterDensity, settings.defaultSort, settings.deduplicateMovies],
    () => {
      invalidate()
      scheduleEnhance()
    },
  )
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true })
  } else {
    start()
  }
}
