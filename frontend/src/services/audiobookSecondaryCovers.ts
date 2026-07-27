const STYLE_ID = 'simposter-audiobook-secondary-cover-styles'
const FETCH_MARKER = '__simposterSecondaryBookCoverFetch'
const ENHANCED_ATTRIBUTE = 'data-secondary-covers-enhanced'

const requestedBookEditions = new Set<string>()
const loadedBookEditions = new Set<string>()
const openBookEditions = new Set<string>()
let scanTimer: number | null = null

function ratingKeyFromUrl(url: URL): string {
  const match = url.pathname.match(/\/api\/audiobook\/([^/]+)\/cover-options$/)
  return match ? decodeURIComponent(match[1] || '') : ''
}

function ratingKeyForEditor(editor: HTMLElement): string {
  return editor.dataset.audiobookRatingKey || ''
}

function scheduleScan(): void {
  if (scanTimer !== null) window.clearTimeout(scanTimer)
  scanTimer = window.setTimeout(() => {
    scanTimer = null
    enhanceEditors()
  }, 40)
}

function installFetchInterceptor(): void {
  const target = window as typeof window & Record<string, unknown>
  if (target[FETCH_MARKER]) return
  target[FETCH_MARKER] = true

  const previousFetch = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const sourceUrl = input instanceof Request ? input.url : String(input)
    let parsed: URL
    try {
      parsed = new URL(sourceUrl, window.location.origin)
    } catch {
      return previousFetch(input, init)
    }

    const ratingKey = ratingKeyFromUrl(parsed)
    if (!ratingKey) return previousFetch(input, init)

    const includeBookEditions = requestedBookEditions.has(ratingKey)
    parsed.searchParams.set('google', includeBookEditions ? 'true' : 'false')
    parsed.searchParams.set('openlibrary', includeBookEditions ? 'true' : 'false')

    let requestInput: RequestInfo | URL = parsed.href
    if (input instanceof Request) requestInput = new Request(parsed.href, input)

    const response = await previousFetch(requestInput, init)
    if (response.ok) {
      void response.clone().json().then((data: any) => {
        const books = Array.isArray(data?.groups?.book)
          ? data.groups.book
          : Array.isArray(data?.covers)
            ? data.covers.filter((cover: any) => ['google', 'openlibrary'].includes(String(cover?.source || '')))
            : []

        if (includeBookEditions) loadedBookEditions.add(ratingKey)
        window.dispatchEvent(new CustomEvent('simposter:secondary-cover-results', {
          detail: { ratingKey, count: books.length },
        }))
        scheduleScan()
      }).catch(() => undefined)
    }

    return response
  }
}

function installStyles(): void {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    .editor-shell[${ENHANCED_ATTRIBUTE}='true'] .cover-provider-controls label[data-book-provider='true'] {
      display: none !important;
    }

    .audiobook-provider-groups {
      min-width: 0;
    }

    .audiobook-provider-group {
      min-width: 0;
    }

    .audiobook-provider-group > h4 {
      margin-bottom: 9px !important;
    }

    .audiobook-provider-group .cover-thumb-strip,
    .book-edition-body .cover-thumb-strip {
      display: flex !important;
      flex-wrap: nowrap !important;
      align-items: flex-start;
      gap: 10px;
      width: 100%;
      max-width: 100%;
      overflow-x: auto;
      overflow-y: hidden;
      padding: 2px 2px 11px;
      scroll-snap-type: x proximity;
      scrollbar-width: thin;
      overscroll-behavior-inline: contain;
    }

    .audiobook-provider-group .cover-thumb,
    .book-edition-body .cover-thumb {
      flex: 0 0 auto !important;
      min-width: 0 !important;
      scroll-snap-align: start;
      overflow: hidden;
    }

    .audiobook-provider-group.audiobook-cover-group .cover-thumb {
      width: 142px !important;
      height: 142px !important;
      aspect-ratio: 1 / 1;
    }

    .book-edition-cover-group .cover-thumb {
      width: 112px !important;
      height: 156px !important;
      aspect-ratio: 5 / 7;
    }

    .audiobook-provider-group .cover-thumb img,
    .book-edition-body .cover-thumb img {
      display: block;
      width: 100% !important;
      height: 100% !important;
      object-fit: cover !important;
    }

    .book-edition-cover-group {
      border-top: 1px solid var(--border);
      padding-top: 3px;
    }

    .book-edition-toggle {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      width: 100%;
      padding: 11px 2px;
      border: 0;
      background: transparent;
      color: var(--text-secondary);
      cursor: pointer;
      text-align: left;
      font: inherit;
    }

    .book-edition-toggle strong {
      font-size: 12px;
      font-weight: 650;
      letter-spacing: .055em;
      text-transform: uppercase;
    }

    .book-edition-toggle span {
      color: var(--text-muted);
      font-size: 16px;
      transition: transform .18s ease;
    }

    .book-edition-toggle[aria-expanded='true'] span {
      transform: rotate(180deg);
    }

    .book-edition-toggle:hover strong {
      color: var(--accent);
    }

    .book-edition-body[hidden] {
      display: none !important;
    }

    .book-edition-prompt,
    .book-edition-loading {
      padding: 5px 2px 12px;
      color: var(--text-muted);
      font-size: 12px;
      line-height: 1.45;
    }

    @media (max-width: 700px) {
      .audiobook-provider-group.audiobook-cover-group .cover-thumb {
        width: 126px !important;
        height: 126px !important;
      }
      .book-edition-cover-group .cover-thumb {
        width: 104px !important;
        height: 146px !important;
      }
    }
  `
  document.head.appendChild(style)
}

function hideLegacyBookProviderControls(editor: HTMLElement): void {
  const controls = editor.querySelector<HTMLElement>('.cover-provider-controls')
  if (!controls) return

  Array.from(controls.querySelectorAll<HTMLLabelElement>('label')).forEach((label) => {
    const text = label.textContent?.replace(/\s+/g, ' ').trim() || ''
    if (text === 'Google Books' || text === 'Open Library') {
      label.dataset.bookProvider = 'true'
    }
  })
}

function setAudiobookCardSizing(groups: HTMLElement): void {
  Array.from(groups.querySelectorAll<HTMLElement>('.audiobook-provider-group')).forEach((section) => {
    const title = section.querySelector('h4')?.textContent?.trim()
    if (title === 'Audiobook Covers') section.classList.add('audiobook-cover-group')
  })
}

function createBookEditionAccordion(
  editor: HTMLElement,
  groups: HTMLElement,
  section: HTMLElement,
): void {
  const ratingKey = ratingKeyForEditor(editor)
  if (!ratingKey) return

  section.classList.add('book-edition-cover-group')
  const heading = section.querySelector<HTMLElement>('h4')
  if (!heading) return

  const contentNodes = Array.from(section.children).filter((node) => node !== heading)
  const body = document.createElement('div')
  body.className = 'book-edition-body'
  contentNodes.forEach((node) => body.appendChild(node))

  const toggle = document.createElement('button')
  toggle.type = 'button'
  toggle.className = 'book-edition-toggle'
  const label = document.createElement('strong')
  label.textContent = 'Book Edition Covers'
  const chevron = document.createElement('span')
  chevron.textContent = '⌄'
  toggle.append(label, chevron)

  const open = openBookEditions.has(ratingKey)
  toggle.setAttribute('aria-expanded', String(open))
  body.hidden = !open

  const hasResults = body.querySelector('.cover-thumb') !== null
  const loaded = loadedBookEditions.has(ratingKey)
  if (!hasResults) {
    body.replaceChildren()
    const message = document.createElement('div')
    if (requestedBookEditions.has(ratingKey) && !loaded) {
      message.className = 'book-edition-loading'
      message.textContent = 'Searching Google Books and Open Library…'
    } else if (loaded) {
      message.className = 'book-edition-prompt'
      message.textContent = 'No matching book edition covers were found.'
    } else {
      message.className = 'book-edition-prompt'
      message.textContent = 'Open this section to search Google Books and Open Library.'
    }
    body.appendChild(message)
  }

  toggle.addEventListener('click', () => {
    const willOpen = !openBookEditions.has(ratingKey)
    if (willOpen) openBookEditions.add(ratingKey)
    else openBookEditions.delete(ratingKey)

    toggle.setAttribute('aria-expanded', String(willOpen))
    body.hidden = !willOpen

    if (willOpen && !requestedBookEditions.has(ratingKey)) {
      requestedBookEditions.add(ratingKey)
      body.replaceChildren()
      const loading = document.createElement('div')
      loading.className = 'book-edition-loading'
      loading.textContent = 'Searching Google Books and Open Library…'
      body.appendChild(loading)

      const refreshButton = editor.querySelector<HTMLButtonElement>('.cover-refresh-btn')
      refreshButton?.click()
    }
  })

  section.replaceChildren(toggle, body)
  groups.appendChild(section)
}

function enhanceEditor(editor: HTMLElement): void {
  if (editor.querySelector('.kicker')?.textContent?.trim() !== 'Editing Audiobook') return
  editor.setAttribute(ENHANCED_ATTRIBUTE, 'true')
  hideLegacyBookProviderControls(editor)

  const groups = editor.querySelector<HTMLElement>('.audiobook-provider-groups')
  if (!groups) return

  setAudiobookCardSizing(groups)

  const existingAccordion = groups.querySelector<HTMLElement>('.book-edition-cover-group .book-edition-toggle')
  if (existingAccordion) return

  const bookSection = Array.from(groups.querySelectorAll<HTMLElement>('.audiobook-provider-group')).find((section) => {
    return section.querySelector('h4')?.textContent?.trim() === 'Book Edition Covers'
  })
  if (!bookSection) return

  createBookEditionAccordion(editor, groups, bookSection)
}

function enhanceEditors(): void {
  document.querySelectorAll<HTMLElement>('.editor-shell').forEach(enhanceEditor)
}

function start(): void {
  installStyles()
  installFetchInterceptor()
  enhanceEditors()

  const observer = new MutationObserver(() => scheduleScan())
  observer.observe(document.body, { childList: true, subtree: true })
  window.addEventListener('simposter:audiobook-cover-results', scheduleScan)
  window.addEventListener('simposter:secondary-cover-results', scheduleScan)
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true })
  else start()
}
