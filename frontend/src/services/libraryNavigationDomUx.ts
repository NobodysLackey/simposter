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

const STYLE_ID = 'simposter-library-navigation-styles'
const FOOTER_CLASS = 'library-pagination-shell'
const JUMP_CLASS = 'library-jump-strip'
const MAX_CONTEXT_JUMPS = 9

const apiBase = getApiBase()
const settings = useSettingsStore()
const itemCache = new Map<string, Promise<LibraryItem[]>>()

let cacheVersion = 0
let scheduled = false

const installStyles = () => {
  const existing = document.getElementById(STYLE_ID)
  if (existing) existing.remove()

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    .main-pane > .view {
      min-height: 100%;
    }

    .toolbar.pagination.${FOOTER_CLASS} {
      position: static !important;
      inset: auto !important;
      width: 100% !important;
      max-width: 100% !important;
      box-sizing: border-box;
      margin: auto 0 0 !important;
      padding: 10px 12px !important;
      display: flex;
      flex-direction: column;
      flex-wrap: nowrap;
      align-items: center;
      justify-content: center !important;
      gap: 8px !important;
      flex-shrink: 0;
      overflow: visible;
      border-radius: 12px;
      background: rgba(17, 20, 30, 0.72);
      box-shadow: none;
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
      max-width: 100%;
      min-width: 0;
      flex-wrap: wrap;
      overflow: visible;
      pointer-events: auto;
    }

    .library-jump-btn {
      position: relative;
      z-index: 1;
      min-width: 30px;
      height: 28px;
      margin: 0 !important;
      padding: 3px 8px !important;
      border: 1px solid rgba(255, 255, 255, 0.09) !important;
      border-radius: 7px !important;
      background: rgba(255, 255, 255, 0.04) !important;
      color: #cdd8f5 !important;
      font-size: 12px !important;
      font-weight: 650;
      line-height: 1 !important;
      cursor: pointer !important;
      white-space: nowrap;
      pointer-events: auto !important;
      transition: background .16s ease, border-color .16s ease, color .16s ease;
    }

    .library-jump-btn:hover {
      color: var(--accent) !important;
      background: color-mix(in srgb, var(--accent) 10%, transparent) !important;
      border-color: color-mix(in srgb, var(--accent) 32%, var(--border)) !important;
    }

    .library-jump-btn[data-current='true'] {
      color: var(--accent) !important;
      border-color: color-mix(in srgb, var(--accent) 26%, var(--border)) !important;
      background: color-mix(in srgb, var(--accent) 7%, transparent) !important;
    }

    @media (max-width: 600px) {
      .toolbar.pagination.${FOOTER_CLASS} {
        padding: 8px !important;
        gap: 6px !important;
      }

      .${JUMP_CLASS} {
        gap: 4px;
      }

      .library-jump-btn {
        min-width: 27px;
        height: 26px;
        padding: 3px 6px !important;
        font-size: 11px !important;
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
  const queryId = String(router.currentRoute.value.query.library || '')
  if (queryId) return queryId

  if (kind === 'audiobooks') {
    return document.querySelector<HTMLSelectElement>('#audiobook-library')?.value || ''
  }

  return kind === 'tv-shows' ? 'default' : ''
}

const getSort = (kind: LibraryKind): { field: SortField; order: SortOrder } => {
  const query = router.currentRoute.value.query

  if (kind === 'audiobooks') {
    return {
      field: (query.sortBy as SortField) || 'title',
      order: (query.sortOrder as SortOrder) || 'asc',
    }
  }

  const [rawField = 'title', rawOrder = 'asc'] = String(
    settings.defaultSort.value || 'title-asc',
  ).split('-')

  const defaultField: SortField =
    rawField === 'added' ? 'addedAt' : rawField === 'year' ? 'year' : 'title'

  return {
    field: (query.sortBy as SortField) || defaultField,
    order: (query.sortOrder as SortOrder) || (rawOrder === 'desc' ? 'desc' : 'asc'),
  }
}

const invalidate = () => {
  itemCache.clear()
  cacheVersion += 1
}

const fetchItems = (kind: LibraryKind, libraryId: string) => {
  const dedupe = kind === 'movies' && settings.deduplicateMovies.value
  const cacheKey = `${kind}|${libraryId}|${dedupe}|${cacheVersion}`
  const cached = itemCache.get(cacheKey)
  if (cached) return cached

  const request = (async (): Promise<LibraryItem[]> => {
    try {
      if (kind === 'audiobooks' && !libraryId) return []

      const params = new URLSearchParams()
      if (libraryId) params.set('library_id', libraryId)
      if (dedupe) params.set('deduplicate', 'true')

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
    } catch (error) {
      console.warn('[LibraryNavigation] Could not load jump data:', error)
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

const groupsToJumps = (groups: GroupPoint[], pageSize: number, uniquePages = false) => {
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

const getCurrentPageFromPager = () => {
  const text = document.querySelector<HTMLElement>('.view > .toolbar.pagination .pager span')?.textContent || ''
  const match = text.match(/(\d+)\s*\/\s*(\d+)/)
  return match ? Number(match[1]) : 1
}

const jumpToPage = (targetPage: number) => {
  const pager = document.querySelector<HTMLElement>('.view > .toolbar.pagination .pager')
  if (!pager) return

  const buttons = Array.from(pager.querySelectorAll<HTMLButtonElement>('button'))
  if (buttons.length < 2) return

  const currentPage = getCurrentPageFromPager()
  const delta = targetPage - currentPage
  if (delta === 0) return

  const button = delta > 0 ? buttons[buttons.length - 1] : buttons[0]
  const steps = Math.abs(delta)

  for (let step = 0; step < steps; step += 1) {
    if (button.disabled) break
    button.click()
  }

  window.requestAnimationFrame(scheduleEnhance)
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
    button.className = 'library-jump-btn'
    button.textContent = label
    button.title = `Jump to ${label}`
    button.dataset.current = page === currentPage ? 'true' : 'false'
    button.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      jumpToPage(page)
    })
    strip.appendChild(button)
  })

  footer.appendChild(strip)
}

const searchOrFilterActive = () => {
  const search = document.querySelector<HTMLInputElement>('.search-container input')?.value.trim()
  const label = router.currentRoute.value.query.label
  return Boolean(search || label)
}

const enhance = async () => {
  scheduled = false

  const kind = getKind()
  const footer = document.querySelector<HTMLElement>('.view > .toolbar.pagination')
  if (!kind || !footer) return

  footer.classList.add(FOOTER_CLASS)

  const libraryId = getLibraryId(kind)
  const { field, order } = getSort(kind)
  const pageSize = Math.max(1, Number(settings.posterDensity.value) || 20)
  const currentPage = getCurrentPageFromPager()
  const signature = [kind, libraryId, field, order, pageSize, currentPage, cacheVersion].join('|')

  footer.dataset.libraryNavSignature = signature

  if (searchOrFilterActive()) {
    footer.querySelector(`.${JUMP_CLASS}`)?.remove()
    return
  }

  const items = await fetchItems(kind, libraryId)
  if (!footer.isConnected || footer.dataset.libraryNavSignature !== signature) return

  const sorted = sortItems(items, field, order)
  renderJumps(footer, buildJumps(sorted, field, pageSize), currentPage, field)
}

function scheduleEnhance() {
  if (scheduled) return
  scheduled = true
  window.requestAnimationFrame(() => void enhance())
}

const start = () => {
  installStyles()
  scheduleEnhance()

  const observer = new MutationObserver(() => scheduleEnhance())
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  })

  router.afterEach(() => scheduleEnhance())

  window.addEventListener('simposter:libraries-rescanned', () => {
    invalidate()
    scheduleEnhance()
  })

  document.addEventListener('input', (event) => {
    const target = event.target
    if (target instanceof HTMLInputElement && target.matches('.search-container input')) {
      scheduleEnhance()
    }
  })

  document.addEventListener('change', (event) => {
    const target = event.target
    if (target instanceof HTMLSelectElement && target.id === 'audiobook-library') {
      invalidate()
      scheduleEnhance()
    }
  })

  document.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof Element)) return

    if (target.closest('.refresh-btn')) {
      invalidate()
      window.setTimeout(scheduleEnhance, 250)
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
