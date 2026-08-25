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
let enhanceScheduled = false

const installStyles = () => {
  if (document.getElementById(STYLE_ID)) return

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    .toolbar.pagination.${FOOTER_CLASS} {
      position: fixed !important;
      bottom: 0;
      z-index: 45;
      box-sizing: border-box;
      margin: 0 !important;
      padding: 9px 12px 10px !important;
      flex-direction: column;
      flex-wrap: nowrap;
      justify-content: center !important;
      gap: 7px !important;
      border-radius: 14px 14px 0 0;
      background: rgba(17, 20, 30, 0.94);
      backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);
      box-shadow: 0 -10px 28px rgba(0, 0, 0, 0.28);
    }

    .toolbar.pagination.${FOOTER_CLASS} .pager {
      justify-content: center;
      flex-shrink: 0;
    }

    .toolbar.pagination.${FOOTER_CLASS} .pager button {
      margin: 0 !important;
    }

    .${JUMP_CLASS} {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      width: 100%;
      min-width: 0;
      flex-wrap: wrap;
    }

    .library-jump-btn {
      min-width: 27px;
      height: 25px;
      margin: 0 !important;
      padding: 2px 7px !important;
      border: 1px solid rgba(255, 255, 255, 0.08) !important;
      border-radius: 7px !important;
      background: rgba(255, 255, 255, 0.035) !important;
      color: #cdd8f5 !important;
      font-size: 11px !important;
      font-weight: 650;
      line-height: 1 !important;
      cursor: pointer;
      white-space: nowrap;
      transition: background .16s ease, border-color .16s ease, color .16s ease;
    }

    .library-jump-btn:hover {
      color: var(--accent) !important;
      background: color-mix(in srgb, var(--accent) 10%, transparent) !important;
      border-color: color-mix(in srgb, var(--accent) 32%, var(--border)) !important;
    }

    .library-jump-btn[data-current='true'] {
      color: var(--accent) !important;
      border-color: color-mix(in srgb, var(--accent) 28%, var(--border)) !important;
      background: color-mix(in srgb, var(--accent) 7%, transparent) !important;
    }

    @media (max-width: 600px) {
      .toolbar.pagination.${FOOTER_CLASS} {
        padding: 7px 8px 8px !important;
        gap: 5px !important;
      }

      .${JUMP_CLASS} {
        gap: 3px;
      }

      .library-jump-btn {
        min-width: 24px;
        height: 23px;
        padding: 2px 5px !important;
        font-size: 10px !important;
      }
    }
  `
  document.head.appendChild(style)
}

const getLibraryKind = (): LibraryKind | null => {
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

const getSort = (kind: LibraryKind): { sortBy: SortField; sortOrder: SortOrder } => {
  const route = router.currentRoute.value

  if (kind === 'audiobooks') {
    return {
      sortBy: (route.query.sortBy as SortField) || 'title',
      sortOrder: (route.query.sortOrder as SortOrder) || 'asc',
    }
  }

  const [defaultField = 'title', defaultOrder = 'asc'] = String(
    settings.defaultSort.value || 'title-asc',
  ).split('-')

  const normalizedDefaultField: SortField =
    defaultField === 'added' ? 'addedAt' :
    defaultField === 'year' ? 'year' :
    'title'

  return {
    sortBy: (route.query.sortBy as SortField) || normalizedDefaultField,
    sortOrder: (route.query.sortOrder as SortOrder) || (defaultOrder === 'desc' ? 'desc' : 'asc'),
  }
}

const getSearchActive = () => {
  const input = document.querySelector<HTMLInputElement>('.search-container input')
  return Boolean(input?.value.trim())
}

const invalidateItems = () => {
  itemCache.clear()
  cacheVersion += 1
}

const getItems = (kind: LibraryKind, libraryId: string): Promise<LibraryItem[]> => {
  const deduplicate = kind === 'movies' && settings.deduplicateMovies.value
  const cacheKey = `${kind}|${libraryId}|${deduplicate ? 'dedupe' : 'all'}|${cacheVersion}`
  const existing = itemCache.get(cacheKey)
  if (existing) return existing

  const request = (async () => {
    try {
      const params = new URLSearchParams()
      if (libraryId) params.set('library_id', libraryId)
      if (deduplicate) params.set('deduplicate', 'true')

      let path = '/api/movies'
      if (kind === 'tv-shows') path = '/api/tv-shows'
      if (kind === 'audiobooks') path = '/api/audiobooks'

      if (kind === 'audiobooks' && !libraryId) return []

      const response = await fetch(`${apiBase}${path}${params.toString() ? `?${params}` : ''}`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data = await response.json()
      return Array.isArray(data) ? data : []
    } catch (cause) {
      console.warn('[LibraryNavigation] Failed to load jump navigation data:', cause)
      return []
    }
  })()

  itemCache.set(cacheKey, request)
  return request
}

const sortItems = (items: LibraryItem[], sortBy: SortField, sortOrder: SortOrder) => {
  const list = [...items]
  const multiplier = sortOrder === 'asc' ? 1 : -1

  if (sortBy === 'title') {
    list.sort((a, b) => multiplier * String(a.title || '').localeCompare(String(b.title || '')))
  } else if (sortBy === 'year') {
    list.sort((a, b) => multiplier * ((Number(a.year) || 0) - (Number(b.year) || 0)))
  } else {
    list.sort((a, b) => multiplier * ((Number(a.addedAt) || 0) - (Number(b.addedAt) || 0)))
  }

  return list
}

const sampleGroups = (groups: GroupPoint[], max = MAX_CONTEXT_JUMPS) => {
  if (groups.length <= max) return groups

  const indexes = new Set<number>()
  for (let slot = 0; slot < max; slot += 1) {
    indexes.add(Math.round((slot * (groups.length - 1)) / (max - 1)))
  }

  return Array.from(indexes)
    .sort((a, b) => a - b)
    .map((index) => groups[index])
}

const groupToJumps = (
  groups: GroupPoint[],
  pageSize: number,
  deduplicatePages = false,
): JumpPoint[] => {
  const jumps = groups.map((group) => ({
    label: group.label,
    page: Math.floor(group.index / pageSize) + 1,
  }))

  if (!deduplicatePages) return jumps

  const seenPages = new Set<number>()
  return jumps.filter((jump) => {
    if (seenPages.has(jump.page)) return false
    seenPages.add(jump.page)
    return true
  })
}

const buildTitleJumps = (items: LibraryItem[], pageSize: number): JumpPoint[] => {
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

  return groupToJumps(groups, pageSize)
}

const buildYearJumps = (items: LibraryItem[], pageSize: number): JumpPoint[] => {
  const groups: GroupPoint[] = []
  const seen = new Set<number>()

  items.forEach((item, index) => {
    const year = Number(item.year)
    if (!Number.isFinite(year) || year <= 0 || seen.has(year)) return
    seen.add(year)
    groups.push({ label: String(year), index })
  })

  return groupToJumps(sampleGroups(groups), pageSize, true)
}

const toDate = (value: number | null | undefined) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return null
  const milliseconds = numeric < 10_000_000_000 ? numeric * 1000 : numeric
  const date = new Date(milliseconds)
  return Number.isNaN(date.getTime()) ? null : date
}

const getWeekStart = (date: Date) => {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  const mondayOffset = (copy.getDay() + 6) % 7
  copy.setDate(copy.getDate() - mondayOffset)
  return copy
}

const buildDateAddedJumps = (items: LibraryItem[], pageSize: number): JumpPoint[] => {
  const validDates = items
    .map((item) => toDate(item.addedAt))
    .filter((date): date is Date => Boolean(date))

  if (!validDates.length) return []

  const times = validDates.map((date) => date.getTime())
  const spanDays = (Math.max(...times) - Math.min(...times)) / 86_400_000
  const mode: 'week' | 'month' | 'year' = spanDays <= 120 ? 'week' : spanDays <= 730 ? 'month' : 'year'
  const groups: GroupPoint[] = []
  const seen = new Set<string>()

  items.forEach((item, index) => {
    const date = toDate(item.addedAt)
    if (!date) return

    let key = ''
    let label = ''

    if (mode === 'week') {
      const week = getWeekStart(date)
      key = `${week.getFullYear()}-${week.getMonth()}-${week.getDate()}`
      label = week.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
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

  return groupToJumps(sampleGroups(groups), pageSize, true)
}

const buildJumps = (
  items: LibraryItem[],
  sortBy: SortField,
  pageSize: number,
): JumpPoint[] => {
  if (sortBy === 'title') return buildTitleJumps(items, pageSize)
  if (sortBy === 'year') return buildYearJumps(items, pageSize)
  return buildDateAddedJumps(items, pageSize)
}

const jumpToPage = (page: number) => {
  const current = router.currentRoute.value
  const query = { ...current.query }

  if (page <= 1) delete query.page
  else query.page = String(page)

  void router.push({ path: current.path, query, hash: current.hash })
}

const renderJumps = (
  footer: HTMLElement,
  jumps: JumpPoint[],
  currentPage: number,
  sortBy: SortField,
) => {
  footer.querySelector(`.${JUMP_CLASS}`)?.remove()
  if (jumps.length < 2) return

  const strip = document.createElement('div')
  strip.className = JUMP_CLASS
  strip.setAttribute(
    'aria-label',
    sortBy === 'title' ? 'Jump by title' : sortBy === 'year' ? 'Jump by year' : 'Jump by date added',
  )

  jumps.forEach((jump) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'library-jump-btn'
    button.textContent = jump.label
    button.dataset.current = jump.page === currentPage ? 'true' : 'false'
    button.title = `Jump to ${jump.label}`
    button.addEventListener('click', () => jumpToPage(jump.page))
    strip.appendChild(button)
  })

  footer.appendChild(strip)
}

const layoutFooter = (footer?: HTMLElement | null) => {
  const target = footer || document.querySelector<HTMLElement>(`.toolbar.pagination.${FOOTER_CLASS}`)
  if (!target?.isConnected) return

  const view = target.closest<HTMLElement>('.view')
  if (!view) return

  const rect = view.getBoundingClientRect()
  const left = Math.max(0, rect.left)
  const width = Math.max(0, Math.min(rect.width, window.innerWidth - left))

  target.style.left = `${left}px`
  target.style.width = `${width}px`
  target.style.right = 'auto'

  window.requestAnimationFrame(() => {
    if (!target.isConnected || !view.isConnected) return
    view.style.paddingBottom = `${target.getBoundingClientRect().height + 16}px`
  })
}

const enhanceNavigation = async () => {
  enhanceScheduled = false
  const kind = getLibraryKind()
  const footer = document.querySelector<HTMLElement>('.view > .toolbar.pagination')
  if (!kind || !footer) return

  footer.classList.add(FOOTER_CLASS)
  layoutFooter(footer)

  const libraryId = getLibraryId(kind)
  const { sortBy, sortOrder } = getSort(kind)
  const pageSize = Math.max(1, Number(settings.posterDensity.value) || 20)
  const currentPage = Math.max(1, Number(router.currentRoute.value.query.page) || 1)
  const searchActive = getSearchActive()
  const labelActive = Boolean(router.currentRoute.value.query.label)

  const signature = [
    kind,
    libraryId,
    sortBy,
    sortOrder,
    pageSize,
    currentPage,
    searchActive ? 'search' : 'no-search',
    labelActive ? 'label' : 'no-label',
    cacheVersion,
  ].join('|')

  if (footer.dataset.libraryNavSignature === signature) return
  footer.dataset.libraryNavSignature = signature

  if (searchActive || labelActive) {
    footer.querySelector(`.${JUMP_CLASS}`)?.remove()
    layoutFooter(footer)
    return
  }

  const items = await getItems(kind, libraryId)
  if (!footer.isConnected || footer.dataset.libraryNavSignature !== signature) return

  const sorted = sortItems(items, sortBy, sortOrder)
  const jumps = buildJumps(sorted, sortBy, pageSize)
  renderJumps(footer, jumps, currentPage, sortBy)
  layoutFooter(footer)
}

const scheduleEnhance = () => {
  if (enhanceScheduled) return
  enhanceScheduled = true
  window.requestAnimationFrame(() => void enhanceNavigation())
}

const start = () => {
  installStyles()
  scheduleEnhance()

  const observer = new MutationObserver(() => scheduleEnhance())
  observer.observe(document.body, { childList: true, subtree: true })

  router.afterEach(() => scheduleEnhance())

  window.addEventListener('resize', () => layoutFooter())
  window.addEventListener('simposter:libraries-rescanned', () => {
    invalidateItems()
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
      invalidateItems()
      scheduleEnhance()
    }
  })

  document.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof Element)) return

    if (target.closest('.refresh-btn')) {
      invalidateItems()
      window.setTimeout(scheduleEnhance, 250)
    }

    if (target.closest('.collapse-btn')) {
      window.setTimeout(() => layoutFooter(), 240)
    }
  })

  watch(
    [settings.posterDensity, settings.defaultSort, settings.deduplicateMovies],
    () => {
      invalidateItems()
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
