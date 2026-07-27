import { getApiBase } from './apiBase'

type CoverRecord = {
  source?: string
  url?: string
  thumb?: string
  title?: string
  author?: string
  narrator?: string
  asin?: string
  region?: string
  group?: string
}

type CoverResponse = {
  covers?: CoverRecord[]
  asin?: string | null
  detected_asin?: string | null
  asin_source?: 'manual' | 'plex' | 'search' | null
  region?: string
  errors?: Record<string, string>
}

const apiBase = getApiBase()
const REGION_KEY = 'simposter-audible-region'
const ASIN_KEY_PREFIX = 'simposter-audible-asin:'
const STYLE_ID = 'simposter-audiobook-discovery-styles'
const ENHANCED_ATTRIBUTE = 'data-audiobook-discovery-enhanced'
const REGION_OPTIONS = [
  ['us', 'United States'],
  ['uk', 'United Kingdom'],
  ['ca', 'Canada'],
  ['au', 'Australia'],
  ['de', 'Germany'],
  ['fr', 'France'],
  ['es', 'Spain'],
  ['in', 'India'],
  ['it', 'Italy'],
  ['jp', 'Japan'],
] as const

const responses = new Map<string, CoverResponse>()
let activeRatingKey = ''
let enhanceTimer: number | null = null
let settingsRegionLoaded = false
let renderingGroups = false

function normalizeUrl(value: string): string {
  try {
    const url = new URL(value, window.location.origin)
    url.hash = ''
    return url.href
  } catch {
    return value
  }
}

function ratingKeyFromCoverUrl(url: URL): string {
  const match = url.pathname.match(/\/api\/audiobook\/([^/]+)\/cover-options$/)
  return match ? decodeURIComponent(match[1] || '') : ''
}

function currentNarrator(): string {
  const editors = Array.from(document.querySelectorAll<HTMLElement>('.editor-shell'))
  for (const editor of editors) {
    if (editor.querySelector('.kicker')?.textContent?.trim() !== 'Editing Audiobook') continue
    const labels = Array.from(editor.querySelectorAll<HTMLElement>('.field-label'))
    for (const label of labels) {
      const labelText = label.childNodes[0]?.textContent?.trim() || ''
      if (labelText !== 'Narrator') continue
      return label.querySelector<HTMLInputElement>('input')?.value.trim() || ''
    }
  }
  return ''
}

function scheduleEnhance(): void {
  if (enhanceTimer !== null) window.clearTimeout(enhanceTimer)
  enhanceTimer = window.setTimeout(() => {
    enhanceTimer = null
    enhanceAudiobookEditors()
  }, 40)
}

function installFetchInterceptor(): void {
  const marker = '__simposterAudiobookDiscoveryFetch'
  const target = window as typeof window & Record<string, unknown>
  if (target[marker]) return
  target[marker] = true

  const previousFetch = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const sourceUrl = input instanceof Request ? input.url : String(input)
    let parsed: URL
    try {
      parsed = new URL(sourceUrl, window.location.origin)
    } catch {
      return previousFetch(input, init)
    }

    const ratingKey = ratingKeyFromCoverUrl(parsed)
    if (!ratingKey) return previousFetch(input, init)

    activeRatingKey = ratingKey
    const editor = Array.from(document.querySelectorAll<HTMLElement>('.editor-shell'))
      .find((candidate) => candidate.querySelector('.kicker')?.textContent?.trim() === 'Editing Audiobook')
    if (editor) editor.dataset.audiobookRatingKey = ratingKey
    const region = localStorage.getItem(REGION_KEY) || 'us'
    const manualAsin = sessionStorage.getItem(`${ASIN_KEY_PREFIX}${ratingKey}`) || ''
    const narrator = currentNarrator()

    parsed.searchParams.set('region', region)
    parsed.searchParams.set('audible_search', 'true')
    if (manualAsin) parsed.searchParams.set('asin_override', manualAsin)
    else parsed.searchParams.delete('asin_override')
    if (narrator) parsed.searchParams.set('narrator', narrator)

    let requestInput: RequestInfo | URL = parsed.href
    if (input instanceof Request) requestInput = new Request(parsed.href, input)

    const response = await previousFetch(requestInput, init)
    if (response.ok) {
      void response.clone().json().then((data: CoverResponse) => {
        responses.set(ratingKey, data)
        if (data.region && !localStorage.getItem(REGION_KEY)) {
          localStorage.setItem(REGION_KEY, data.region)
        }
        window.dispatchEvent(
          new CustomEvent('simposter:audiobook-cover-results', {
            detail: { ratingKey, data },
          }),
        )
        scheduleEnhance()
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
    .audible-discovery-panel {
      display: grid;
      grid-template-columns: minmax(160px, 1fr) minmax(150px, .75fr) auto;
      gap: 10px;
      align-items: end;
      margin: 12px 0 14px;
      padding: 12px;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: rgba(255, 255, 255, .025);
    }
    .audible-discovery-panel label {
      display: flex;
      flex-direction: column;
      gap: 5px;
      color: var(--text-secondary);
      font-size: 12px;
    }
    .audible-discovery-panel input,
    .audible-discovery-panel select {
      width: 100%;
      min-width: 0;
      padding: 8px 9px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface-soft);
      color: var(--text-primary);
    }
    .audible-discovery-panel button {
      min-height: 36px;
      padding: 8px 12px;
      border: 1px solid color-mix(in srgb, var(--accent) 45%, var(--border));
      border-radius: 8px;
      background: color-mix(in srgb, var(--accent) 12%, transparent);
      color: var(--text-primary);
      cursor: pointer;
    }
    .audible-discovery-status {
      grid-column: 1 / -1;
      margin: 0;
      color: var(--text-muted);
      font-size: 11px;
      line-height: 1.35;
    }
    .audiobook-provider-groups {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .audiobook-provider-group h4 {
      margin: 0 0 7px;
      color: var(--text-secondary);
      font-size: 12px;
      font-weight: 650;
      letter-spacing: .055em;
      text-transform: uppercase;
    }
    .audiobook-provider-group .cover-thumb-strip {
      display: flex !important;
    }
    .editor-shell[${ENHANCED_ATTRIBUTE}='true'] .cover-results > .cover-thumb-strip {
      display: none !important;
    }
    .editor-shell[${ENHANCED_ATTRIBUTE}='true'] .audnexus-row {
      display: none !important;
    }
    .audiobook-provider-empty {
      color: var(--text-muted);
      font-size: 12px;
    }
    @media (max-width: 700px) {
      .audible-discovery-panel { grid-template-columns: 1fr; }
      .audible-discovery-status { grid-column: 1; }
    }
  `
  document.head.appendChild(style)
}

function ratingKeyForEditor(editor: HTMLElement): string {
  return editor.dataset.audiobookRatingKey || activeRatingKey
}

function responseForEditor(editor: HTMLElement): CoverResponse | undefined {
  const ratingKey = ratingKeyForEditor(editor)
  return ratingKey ? responses.get(ratingKey) : undefined
}

function statusText(data: CoverResponse | undefined, manualAsin: string): string {
  if (manualAsin) return `Manual ASIN override: ${manualAsin}`
  if (data?.asin_source === 'plex' && data.detected_asin) {
    return `Detected from Plex metadata: ${data.detected_asin}`
  }
  if (data?.asin_source === 'search' && data.asin) {
    return `No Plex ASIN was found. Top Audible catalog match: ${data.asin}`
  }
  if (data?.asin_source === 'manual' && data.asin) return `Manual ASIN override: ${data.asin}`
  return 'No Audible ASIN detected in Plex. Audible title, author, and narrator matching will be used.'
}

async function persistRegion(region: string): Promise<void> {
  try {
    const current = await fetch(`${apiBase}/api/audiobook-settings`)
    if (!current.ok) return
    const settings = await current.json()
    if (settings.audible_region === region) return
    const response = await fetch(`${apiBase}/api/audiobook-settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...settings, audible_region: region }),
    })
    if (!response.ok) console.warn('[AudiobookDiscovery] Could not save Audible region')
  } catch (error) {
    console.warn('[AudiobookDiscovery] Could not save Audible region:', error)
  }
}

async function loadSavedRegion(): Promise<void> {
  if (settingsRegionLoaded) return
  settingsRegionLoaded = true
  if (localStorage.getItem(REGION_KEY)) return
  try {
    const response = await fetch(`${apiBase}/api/audiobook-settings`)
    if (!response.ok) return
    const data = await response.json()
    if (typeof data.audible_region === 'string') {
      localStorage.setItem(REGION_KEY, data.audible_region)
      scheduleEnhance()
    }
  } catch {
    // US remains the conservative default.
  }
}

function makeDiscoveryPanel(editor: HTMLElement): HTMLElement {
  const panel = document.createElement('div')
  panel.className = 'audible-discovery-panel'

  const asinLabel = document.createElement('label')
  asinLabel.textContent = 'Audible ASIN (optional override)'
  const asinInput = document.createElement('input')
  asinInput.type = 'text'
  asinInput.maxLength = 10
  asinInput.autocomplete = 'off'
  asinInput.placeholder = 'Detected automatically or enter 10-character ASIN'
  asinLabel.appendChild(asinInput)

  const regionLabel = document.createElement('label')
  regionLabel.textContent = 'Audible Marketplace'
  const regionSelect = document.createElement('select')
  REGION_OPTIONS.forEach(([value, label]) => {
    const option = document.createElement('option')
    option.value = value
    option.textContent = label
    regionSelect.appendChild(option)
  })
  regionSelect.value = localStorage.getItem(REGION_KEY) || 'us'
  regionLabel.appendChild(regionSelect)

  const searchButton = document.createElement('button')
  searchButton.type = 'button'
  searchButton.textContent = 'Search Covers'

  const status = document.createElement('p')
  status.className = 'audible-discovery-status'

  panel.append(asinLabel, regionLabel, searchButton, status)

  const refreshPanel = (): void => {
    const data = responseForEditor(editor)
    const key = ratingKeyForEditor(editor)
    const manual = key ? sessionStorage.getItem(`${ASIN_KEY_PREFIX}${key}`) || '' : ''
    if (document.activeElement !== asinInput) {
      asinInput.value = manual || data?.detected_asin || data?.asin || ''
    }
    regionSelect.value = localStorage.getItem(REGION_KEY) || data?.region || 'us'
    status.textContent = statusText(data, manual)
    searchButton.textContent = 'Search Covers'
    searchButton.disabled = false
  }

  searchButton.addEventListener('click', () => {
    const key = ratingKeyForEditor(editor)
    if (!key) return
    const candidate = asinInput.value.trim().toUpperCase()
    if (candidate && !/^[A-Z0-9]{10}$/.test(candidate)) {
      status.textContent = 'ASIN must contain exactly 10 letters or numbers.'
      return
    }

    const detectedAsin = responseForEditor(editor)?.detected_asin || ''
    if (candidate && candidate !== detectedAsin) {
      sessionStorage.setItem(`${ASIN_KEY_PREFIX}${key}`, candidate)
    } else {
      sessionStorage.removeItem(`${ASIN_KEY_PREFIX}${key}`)
    }

    const region = regionSelect.value || 'us'
    localStorage.setItem(REGION_KEY, region)
    void persistRegion(region)

    searchButton.textContent = 'Searching…'
    searchButton.disabled = true
    status.textContent = 'Searching Audible, Audnexus, Google Books, and Open Library…'

    const refreshButton = editor.querySelector<HTMLButtonElement>('.cover-refresh-btn')
    if (refreshButton) refreshButton.click()
    else window.setTimeout(() => {
      searchButton.textContent = 'Search Covers'
      searchButton.disabled = false
    }, 1200)
  })

  regionSelect.addEventListener('change', () => {
    localStorage.setItem(REGION_KEY, regionSelect.value)
    void persistRegion(regionSelect.value)
  })

  const onResults = (): void => {
    if (!panel.isConnected) {
      window.removeEventListener('simposter:audiobook-cover-results', onResults)
      return
    }
    refreshPanel()
  }
  window.addEventListener('simposter:audiobook-cover-results', onResults)
  refreshPanel()
  return panel
}

function findCoverForButton(button: HTMLButtonElement, covers: CoverRecord[]): CoverRecord | undefined {
  const image = button.querySelector<HTMLImageElement>('img')
  const imageUrl = image ? normalizeUrl(image.currentSrc || image.src) : ''
  return covers.find((cover) => {
    const candidates = [cover.thumb, cover.url].filter(Boolean).map((value) => normalizeUrl(String(value)))
    return candidates.includes(imageUrl)
  })
}

function cloneCoverButton(
  original: HTMLButtonElement,
  cover: CoverRecord | undefined,
): HTMLButtonElement {
  const clone = original.cloneNode(true) as HTMLButtonElement
  clone.removeAttribute('data-cover-quality-bound')
  clone.querySelectorAll('[data-cover-quality-bound]').forEach((node) => {
    node.removeAttribute('data-cover-quality-bound')
  })
  const badge = clone.querySelector<HTMLElement>('.source-badge')
  if (badge && cover?.source) {
    badge.textContent = cover.source === 'audible'
      ? 'AUDIBLE'
      : cover.source === 'audnexus'
        ? 'AUDNEXUS'
        : cover.source === 'openlibrary'
          ? 'OPEN LIBRARY'
          : 'GOOGLE'
  }
  clone.addEventListener('click', () => {
    original.click()
    const groups = clone.closest('.audiobook-provider-groups')
    groups?.querySelectorAll('.cover-thumb').forEach((entry) => entry.classList.remove('active'))
    clone.classList.add('active')
  })
  return clone
}

function audiobookToggle(editor: HTMLElement): HTMLInputElement | null {
  const controls = editor.querySelector<HTMLElement>('.cover-provider-controls')
  if (!controls) return null
  const labels = Array.from(controls.querySelectorAll<HTMLLabelElement>('label'))
  const label = labels.find((candidate) => candidate.textContent?.trim() === 'Audiobook Covers')
  return label?.querySelector<HTMLInputElement>('input[type="checkbox"]') || null
}

function renderGroups(editor: HTMLElement): void {
  if (renderingGroups) return
  const results = editor.querySelector<HTMLElement>('.cover-results')
  const originalStrip = results?.querySelector<HTMLElement>(':scope > .cover-thumb-strip')
  if (!results || !originalStrip) return

  const existing = results.querySelector<HTMLElement>('.audiobook-provider-groups')
  const buttons = Array.from(originalStrip.querySelectorAll<HTMLButtonElement>('.cover-thumb'))
  if (!buttons.length) {
    existing?.remove()
    return
  }

  const toggle = audiobookToggle(editor)
  const showAudiobook = toggle?.checked ?? true
  const signature = [
    showAudiobook ? 'audiobook:on' : 'audiobook:off',
    ...buttons.map((button) => {
      const image = button.querySelector<HTMLImageElement>('img')
      return `${image?.src || ''}:${button.classList.contains('active') ? '1' : '0'}`
    }),
  ].join('|')
  if (existing?.dataset.signature === signature) return

  const covers = responseForEditor(editor)?.covers || []
  const audiobook: Array<{ button: HTMLButtonElement; cover?: CoverRecord }> = []
  const books: Array<{ button: HTMLButtonElement; cover?: CoverRecord }> = []

  buttons.forEach((button) => {
    const cover = findCoverForButton(button, covers)
    const badge = button.querySelector('.source-badge')?.textContent?.toLowerCase() || ''
    const source = cover?.source || badge
    const target = source === 'audible' || source === 'audnexus' ? audiobook : books
    target.push({ button, cover })
  })

  const groups = document.createElement('div')
  groups.className = 'audiobook-provider-groups'
  groups.dataset.signature = signature

  const appendGroup = (
    title: string,
    items: Array<{ button: HTMLButtonElement; cover?: CoverRecord }>,
    emptyText: string,
    hidden = false,
  ): void => {
    const section = document.createElement('section')
    section.className = 'audiobook-provider-group'
    section.hidden = hidden
    const heading = document.createElement('h4')
    heading.textContent = title
    section.appendChild(heading)
    if (items.length) {
      const strip = document.createElement('div')
      strip.className = 'cover-thumb-strip'
      items.forEach(({ button, cover }) => strip.appendChild(cloneCoverButton(button, cover)))
      section.appendChild(strip)
    } else {
      const empty = document.createElement('div')
      empty.className = 'audiobook-provider-empty'
      empty.textContent = emptyText
      section.appendChild(empty)
    }
    groups.appendChild(section)
  }

  appendGroup(
    'Audiobook Covers',
    audiobook,
    'No audiobook-specific cover was found.',
    !showAudiobook,
  )
  appendGroup('Book Edition Covers', books, 'No physical or ebook edition cover was found.')

  renderingGroups = true
  if (existing) existing.replaceWith(groups)
  else results.insertBefore(groups, originalStrip)
  window.queueMicrotask(() => {
    renderingGroups = false
  })
}

function enhanceEditor(editor: HTMLElement): void {
  if (editor.querySelector('.kicker')?.textContent?.trim() !== 'Editing Audiobook') return
  editor.setAttribute(ENHANCED_ATTRIBUTE, 'true')

  const coverSections = Array.from(editor.querySelectorAll<HTMLElement>('.acc-section'))
  const coverSection = coverSections.find((section) => {
    const header = section.querySelector('.acc-header')?.textContent?.replace(/\s+/g, ' ').trim() || ''
    return header.startsWith('Cover')
  })
  const body = coverSection?.querySelector<HTMLElement>('.acc-body')
  if (!body) return

  const controls = body.querySelector<HTMLElement>('.cover-provider-controls')
  if (controls) {
    const labels = Array.from(controls.querySelectorAll<HTMLLabelElement>('label'))
    labels.forEach((label) => {
      const text = label.textContent?.trim()
      if (text === 'Audnexus') {
        const span = label.querySelector('span')
        if (span) span.textContent = 'Audiobook Covers'
      }
      if (label.textContent?.trim() === 'Audiobook Covers') {
        const checkbox = label.querySelector<HTMLInputElement>('input[type="checkbox"]')
        if (checkbox && checkbox.dataset.audiobookToggleBound !== 'true') {
          checkbox.dataset.audiobookToggleBound = 'true'
          checkbox.addEventListener('change', scheduleEnhance)
        }
      }
    })
  }

  if (!body.querySelector('.audible-discovery-panel')) {
    const panel = makeDiscoveryPanel(editor)
    controls?.insertAdjacentElement('afterend', panel)
    if (!controls) body.prepend(panel)
  }

  renderGroups(editor)
}

function enhanceAudiobookEditors(): void {
  document.querySelectorAll<HTMLElement>('.editor-shell').forEach(enhanceEditor)
}

function start(): void {
  installStyles()
  installFetchInterceptor()
  void loadSavedRegion()
  enhanceAudiobookEditors()

  const observer = new MutationObserver((mutations) => {
    if (renderingGroups) return
    const relevant = mutations.some((mutation) => {
      const target = mutation.target as Element
      return !target.closest?.('.audiobook-provider-groups')
    })
    if (relevant) scheduleEnhance()
  })
  observer.observe(document.body, { childList: true, subtree: true })

  window.addEventListener('simposter:audiobook-cover-results', scheduleEnhance)
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true })
  else start()
}
