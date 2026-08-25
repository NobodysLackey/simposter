import { router } from '../router'
import { useSettingsStore } from '../stores/settings'
import { getApiBase } from './apiBase'

type LibraryKind = 'movies' | 'tv-shows' | 'audiobooks'
type SortOrder = 'asc' | 'desc'

type LibraryItem = {
  title?: string
}

type ClickedJump = {
  label: string
  page: number
}

const apiBase = getApiBase()
const settings = useSettingsStore()
const itemCache = new Map<string, Promise<LibraryItem[]>>()

let scheduled = false
let clickedJump: ClickedJump | null = null
let resizeObserver: ResizeObserver | null = null
let observedPane: HTMLElement | null = null

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
  const text = document.querySelector<HTMLElement>('.view > .toolbar.pagination .pager span')?.textContent || ''
  const match = text.match(/(\d+)\s*\/\s*(\d+)/)
  return match ? Number(match[1]) : 1
}

const getStartLabel = (title: string | undefined) => {
  const first = String(title || '').trim().charAt(0).toUpperCase()
  if (!first) return ''
  return /^[A-Z]$/.test(first) ? first : '#'
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

const alignFooter = () => {
  const footer = document.querySelector<HTMLElement>('.view > .toolbar.pagination.simposter-library-navigation')
  const pane = footer?.closest<HTMLElement>('.main-pane')
  if (!footer || !pane) return

  const rect = pane.getBoundingClientRect()
  const styles = window.getComputedStyle(pane)
  const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0
  const paddingRight = Number.parseFloat(styles.paddingRight) || 0
  const left = rect.left + paddingLeft
  const width = Math.max(0, rect.width - paddingLeft - paddingRight)

  footer.style.setProperty('left', `${left}px`, 'important')
  footer.style.setProperty('right', 'auto', 'important')
  footer.style.setProperty('width', `${width}px`, 'important')
  footer.style.setProperty('max-width', `${width}px`, 'important')

  if (observedPane !== pane && typeof ResizeObserver !== 'undefined') {
    resizeObserver?.disconnect()
    observedPane = pane
    resizeObserver = new ResizeObserver(() => alignFooter())
    resizeObserver.observe(pane)
  }
}

const polishTitleJumps = async () => {
  const kind = getKind()
  if (!kind) return

  const footer = document.querySelector<HTMLElement>('.view > .toolbar.pagination.simposter-library-navigation')
  const strip = footer?.querySelector<HTMLElement>('.simposter-library-jumps')
  if (!footer || !strip) return

  alignFooter()

  const { isTitle, order } = getTitleSort(kind)
  if (!isTitle) return

  const libraryId = getLibraryId(kind)
  const items = await fetchItems(kind, libraryId)
  if (!strip.isConnected) return

  const availableLetters = new Set(
    items
      .map((item) => getStartLabel(item.title))
      .filter((label) => Boolean(label)),
  )

  const buttons = Array.from(strip.querySelectorAll<HTMLButtonElement>('.simposter-library-jump'))
  buttons.forEach((button) => {
    const label = (button.textContent || '').trim()
    if (!availableLetters.has(label)) button.remove()
  })

  const sorted = [...items].sort((a, b) => {
    const comparison = String(a.title || '').localeCompare(String(b.title || ''))
    return order === 'asc' ? comparison : -comparison
  })

  const currentPage = getCurrentPage()
  const pageSize = Math.max(1, Number(settings.posterDensity.value) || 20)
  const firstVisible = sorted[(currentPage - 1) * pageSize]
  const firstVisibleLabel = getStartLabel(firstVisible?.title)

  const activeLabel =
    clickedJump && clickedJump.page === currentPage && availableLetters.has(clickedJump.label)
      ? clickedJump.label
      : firstVisibleLabel

  Array.from(strip.querySelectorAll<HTMLButtonElement>('.simposter-library-jump')).forEach((button) => {
    const label = (button.textContent || '').trim()
    button.dataset.current = label === activeLabel ? 'true' : 'false'
  })
}

const run = async () => {
  scheduled = false
  alignFooter()
  await polishTitleJumps()
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

  router.afterEach(() => {
    schedule()
  })

  window.addEventListener('resize', schedule)

  document.addEventListener(
    'click',
    (event) => {
      const target = event.target
      if (!(target instanceof Element)) return

      const jumpButton = target.closest<HTMLButtonElement>('.simposter-library-jump')
      if (jumpButton) {
        const label = (jumpButton.textContent || '').trim()
        const page = Number(jumpButton.dataset.page) || 1
        clickedJump = { label, page }
        schedule()
        return
      }

      const pagerButton = target.closest<HTMLButtonElement>('.view > .toolbar.pagination .pager button')
      if (pagerButton) {
        const currentPage = getCurrentPage()
        if (!clickedJump || clickedJump.page === currentPage) {
          clickedJump = null
        }
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
