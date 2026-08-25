import { router } from '../router'
import { useSettingsStore } from '../stores/settings'
import { getApiBase } from './apiBase'

type LibraryKind = 'movies' | 'tv-shows' | 'audiobooks'
type SortOrder = 'asc' | 'desc'

type MediaItem = {
  title?: string
  key?: string | number
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
}

const apiBase = getApiBase()
const settings = useSettingsStore()
const itemCache = new Map<string, Promise<MediaItem[]>>()

const nativeArraySort = Array.prototype.sort
let scheduled = false
let clickedJump: ClickedJump | null = null

export const getSortTitle = (title: string | null | undefined) => {
  const original = String(title || '').trim()
  if (!original) return ''

  const withoutArticle = original.replace(/^(?:the|an|a)\s+/i, '').trim()
  return withoutArticle || original
}

const getStartLabel = (title: string | null | undefined) => {
  const first = getSortTitle(title).charAt(0).toUpperCase()
  if (!first) return ''
  return /^[A-Z]$/.test(first) ? first : '#'
}

const compareTitles = (a: string | null | undefined, b: string | null | undefined) => {
  const aSort = getSortTitle(a)
  const bSort = getSortTitle(b)
  const primary = aSort.localeCompare(bSort)
  if (primary !== 0) return primary
  return String(a || '').localeCompare(String(b || ''))
}

const isTitleComparator = (compareFn: ((a: any, b: any) => number) | undefined) => {
  if (!compareFn) return false

  try {
    const source = Function.prototype.toString.call(compareFn)
    return source.includes('localeCompare') && source.includes('title')
  } catch {
    return false
  }
}

const getSortDirection = (
  items: any[],
  compareFn: (a: any, b: any) => number,
): 1 | -1 => {
  const candidates = items.filter((item) => item && typeof item.title === 'string').slice(0, 12)

  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      const a = candidates[i]
      const b = candidates[j]
      const raw = String(a.title).localeCompare(String(b.title))
      if (raw === 0) continue

      const provided = compareFn(a, b)
      if (provided === 0) continue
      return Math.sign(provided) === Math.sign(raw) ? 1 : -1
    }
  }

  return 1
}

// The three library views currently sort title-bearing media arrays with a
// localeCompare comparator. Intercept only that narrow case so title sorting
// can use filing-title rules without altering labels, dates, years, or display text.
Array.prototype.sort = function patchedSort(compareFn?: (a: any, b: any) => number) {
  if (
    compareFn &&
    this.length > 1 &&
    isTitleComparator(compareFn) &&
    this.some((item: any) => item && typeof item.title === 'string')
  ) {
    const direction = getSortDirection(this as any[], compareFn)

    return nativeArraySort.call(this, (a: any, b: any) => {
      if (a && b && typeof a.title === 'string' && typeof b.title === 'string') {
        return direction * compareTitles(a.title, b.title)
      }
      return compareFn(a, b)
    })
  }

  return nativeArraySort.call(this, compareFn as any)
}

const getKind = (): LibraryKind | null => {
  const routeName = String(router.currentRoute.value.name || '')
  if (routeName === 'movies') return 'movies'
  if (routeName === 'tv-shows') return 'tv-shows'
  if (routeName === 'audiobooks') return 'audiobooks'
  return null
}

const getLibraryId = (kind: LibraryKind) => {
  const routeLibrary = String(router.currentRoute.value.query.library || '')
  if (routeLibrary) return routeLibrary

  if (kind === 'audiobooks') {
    return document.querySelector<HTMLSelectElement>('#audiobook-library')?.value || ''
  }

  return kind === 'tv-shows' ? 'default' : ''
}

const getTitleSort = (kind: LibraryKind): { isTitle: boolean; order: SortOrder } => {
  const sortSelect = document.querySelector<HTMLSelectElement>(
    kind === 'audiobooks' ? '#audiobook-sort' : '#sort-select',
  )
  const orderSelect = document.querySelector<HTMLSelectElement>(
    kind === 'audiobooks' ? '#audiobook-order' : '#sort-order',
  )

  return {
    isTitle: (sortSelect?.value || 'title') === 'title',
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

  const request = (async (): Promise<MediaItem[]> => {
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
      return Array.isArray(data) ? (data as MediaItem[]) : []
    } catch {
      return []
    }
  })()

  itemCache.set(cacheKey, request)
  return request
}

const buildTitleJumps = (
  items: MediaItem[],
  order: SortOrder,
  pageSize: number,
): { sorted: MediaItem[]; points: JumpPoint[] } => {
  const direction = order === 'asc' ? 1 : -1
  const sorted = [...items].sort(
    (a, b) => direction * compareTitles(a.title, b.title),
  )
  const seen = new Set<string>()
  const points: JumpPoint[] = []

  sorted.forEach((item, index) => {
    const label = getStartLabel(item.title)
    if (!label || seen.has(label)) return

    seen.add(label)
    points.push({
      label,
      page: Math.floor(index / pageSize) + 1,
    })
  })

  return { sorted, points }
}

const renderTitleJumps = async () => {
  const kind = getKind()
  if (!kind) return

  const { isTitle, order } = getTitleSort(kind)
  if (!isTitle) return

  const strip = document.querySelector<HTMLElement>('.simposter-library-jumps')
  if (!strip) return

  const libraryId = getLibraryId(kind)
  const items = await fetchItems(kind, libraryId)
  if (!strip.isConnected) return

  const pageSize = Math.max(1, Number(settings.posterDensity.value) || 20)
  const currentPage = getCurrentPage()
  const { sorted, points } = buildTitleJumps(items, order, pageSize)

  const firstVisible = sorted[(currentPage - 1) * pageSize]
  const firstVisibleLabel = getStartLabel(firstVisible?.title)
  const activeLabel =
    clickedJump && clickedJump.page === currentPage
      ? clickedJump.label
      : firstVisibleLabel

  const signature = `${order}|${pageSize}|${points
    .map((point) => `${point.label}:${point.page}`)
    .join('|')}`

  if (strip.dataset.articleTitleSignature !== signature) {
    strip.innerHTML = ''

    points.forEach((point) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'simposter-library-jump'
      button.textContent = point.label
      button.title = `Jump to ${point.label}`
      button.dataset.page = String(point.page)
      button.dataset.articleTitle = 'true'
      strip.appendChild(button)
    })

    strip.dataset.articleTitleSignature = signature
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
  await renderTitleJumps()
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

      const jump = target.closest<HTMLButtonElement>(
        '.simposter-library-jump[data-article-title="true"]',
      )
      if (jump) {
        clickedJump = {
          label: (jump.textContent || '').trim(),
          page: Number(jump.dataset.page) || 1,
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

  window.addEventListener('simposter:libraries-rescanned', () => {
    itemCache.clear()
    schedule()
  })
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true })
  } else {
    start()
  }
}
