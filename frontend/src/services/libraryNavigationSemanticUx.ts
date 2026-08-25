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

type JumpPoint = {
  label: string
  page: number
}

type ClickedJump = {
  label: string
  page: number
  field: SortField
}

const apiBase = getApiBase()
const settings = useSettingsStore()
const itemCache = new Map<string, Promise<LibraryItem[]>>()
const MAX_JUMPS = 10

let scheduled = false
let clickedJump: ClickedJump | null = null

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
  const sortSelect = document.querySelector<HTMLSelectElement>(
    kind === 'audiobooks' ? '#audiobook-sort' : '#sort-select',
  )
  const orderSelect = document.querySelector<HTMLSelectElement>(
    kind === 'audiobooks' ? '#audiobook-order' : '#sort-order',
  )

  return {
    field: (sortSelect?.value as SortField) || 'title',
    order: orderSelect?.value === 'desc' ? 'desc' : 'asc',
  }
}

const getCurrentPage = () => {
  const text = document.querySelector<HTMLElement>(
    '.view > .toolbar.pagination .pager span',
  )?.textContent || ''
  const match = text.match(/(\d+)\s*\/\s*(\d+)/)
  return match ? Number(match[1]) : 1
}

const fetchItems = (kind: LibraryKind, libraryId: string) => {
  const deduplicate = kind === 'movies' && settings.deduplicateMovies.value
  const cacheKey = `${kind}|${libraryId}|${deduplicate ? 'dedupe' : 'all'}`
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
      if (!response.ok) return []

      const data: unknown = await response.json()
      return Array.isArray(data) ? (data as LibraryItem[]) : []
    } catch {
      return []
    }
  })()

  itemCache.set(cacheKey, request)
  return request
}

const sortItems = (items: LibraryItem[], field: SortField, order: SortOrder) => {
  const multiplier = order === 'asc' ? 1 : -1
  return [...items].sort((a, b) => {
    if (field === 'year') {
      return multiplier * ((Number(a.year) || 0) - (Number(b.year) || 0))
    }
    return multiplier * ((Number(a.addedAt) || 0) - (Number(b.addedAt) || 0))
  })
}

const samplePoints = (points: JumpPoint[]) => {
  if (points.length <= MAX_JUMPS) return points

  const indexes = new Set<number>()
  for (let slot = 0; slot < MAX_JUMPS; slot += 1) {
    indexes.add(Math.round((slot * (points.length - 1)) / (MAX_JUMPS - 1)))
  }

  return Array.from(indexes)
    .sort((a, b) => a - b)
    .map((index) => points[index]!)
}

const yearLabel = (item: LibraryItem) => {
  const year = Number(item.year)
  if (!Number.isFinite(year) || year <= 0) return ''
  if (year < 1900) return 'Pre-1900'
  return `${Math.floor(year / 10) * 10}s`
}

const toDate = (value: number | null | undefined) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return null
  const milliseconds = numeric < 10_000_000_000 ? numeric * 1000 : numeric
  const date = new Date(milliseconds)
  return Number.isNaN(date.getTime()) ? null : date
}

const dateMode = (items: LibraryItem[]) => {
  const dates = items
    .map((item) => toDate(item.addedAt))
    .filter((date): date is Date => date !== null)

  if (dates.length < 2) return 'month' as const

  const times = dates.map((date) => date.getTime())
  const oldest = new Date(Math.min(...times))
  const newest = new Date(Math.max(...times))
  const monthSpan =
    (newest.getFullYear() - oldest.getFullYear()) * 12 +
    (newest.getMonth() - oldest.getMonth())

  return monthSpan <= 18 ? ('month' as const) : ('year' as const)
}

const dateLabel = (item: LibraryItem, mode: 'month' | 'year') => {
  const date = toDate(item.addedAt)
  if (!date) return ''

  if (mode === 'year') return String(date.getFullYear())
  return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

const buildPoints = (
  sorted: LibraryItem[],
  field: SortField,
  pageSize: number,
): { points: JumpPoint[]; labelForItem: (item: LibraryItem) => string } => {
  const labelForItem =
    field === 'year'
      ? yearLabel
      : (() => {
          const mode = dateMode(sorted)
          return (item: LibraryItem) => dateLabel(item, mode)
        })()

  const seen = new Set<string>()
  const points: JumpPoint[] = []

  sorted.forEach((item, index) => {
    const label = labelForItem(item)
    if (!label || seen.has(label)) return
    seen.add(label)
    points.push({
      label,
      page: Math.floor(index / pageSize) + 1,
    })
  })

  return { points: samplePoints(points), labelForItem }
}

const renderSemanticJumps = async () => {
  const kind = getKind()
  if (!kind) return

  const { field, order } = getSort(kind)
  if (field === 'title') return

  const strip = document.querySelector<HTMLElement>('.simposter-library-jumps')
  if (!strip) return

  const libraryId = getLibraryId(kind)
  const items = await fetchItems(kind, libraryId)
  if (!strip.isConnected) return

  const sorted = sortItems(items, field, order)
  const pageSize = Math.max(1, Number(settings.posterDensity.value) || 20)
  const currentPage = getCurrentPage()
  const { points, labelForItem } = buildPoints(sorted, field, pageSize)

  if (points.length < 2) return

  const firstVisible = sorted[(currentPage - 1) * pageSize]
  const firstVisibleLabel = firstVisible ? labelForItem(firstVisible) : ''
  const activeLabel =
    clickedJump && clickedJump.field === field && clickedJump.page === currentPage
      ? clickedJump.label
      : firstVisibleLabel

  const signature = points.map((point) => `${point.label}:${point.page}`).join('|')
  if (strip.dataset.semanticSignature !== signature) {
    strip.innerHTML = ''

    points.forEach((point) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'simposter-library-jump'
      button.textContent = point.label
      button.title = `Jump to ${point.label}`
      button.dataset.page = String(point.page)
      button.dataset.semanticField = field
      strip.appendChild(button)
    })

    strip.dataset.semanticSignature = signature
  }

  Array.from(strip.querySelectorAll<HTMLButtonElement>('.simposter-library-jump')).forEach(
    (button) => {
      const label = (button.textContent || '').trim()
      button.dataset.current = label === activeLabel ? 'true' : 'false'
    },
  )
}

const run = async () => {
  scheduled = false
  await renderSemanticJumps()
}

const schedule = () => {
  if (scheduled) return
  scheduled = true
  window.requestAnimationFrame(() => void run())
}

const start = () => {
  schedule()

  const observer = new MutationObserver(() => schedule())
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  })

  router.afterEach(() => schedule())

  document.addEventListener(
    'click',
    (event) => {
      const target = event.target
      if (!(target instanceof Element)) return

      const jump = target.closest<HTMLButtonElement>('.simposter-library-jump')
      if (jump?.dataset.semanticField) {
        clickedJump = {
          label: (jump.textContent || '').trim(),
          page: Number(jump.dataset.page) || 1,
          field: jump.dataset.semanticField as SortField,
        }
        schedule()
        return
      }

      if (target.closest('.view > .toolbar.pagination .pager button')) {
        clickedJump = null
        window.setTimeout(schedule, 0)
      }
    },
    true,
  )

  document.addEventListener('change', (event) => {
    const target = event.target
    if (!(target instanceof HTMLSelectElement)) return

    if (
      target.id === 'sort-select' ||
      target.id === 'sort-order' ||
      target.id === 'audiobook-sort' ||
      target.id === 'audiobook-order' ||
      target.id === 'audiobook-library'
    ) {
      clickedJump = null
      itemCache.clear()
      window.setTimeout(schedule, 0)
    }
  })
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true })
  } else {
    start()
  }
}
