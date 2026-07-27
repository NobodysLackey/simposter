import { getApiBase } from './apiBase'

type ManualLogoRecord = {
  url: string
  active: boolean
  fileName?: string
}

type VueComponentInstance = {
  parent?: VueComponentInstance | null
  props?: Record<string, any>
  setupState?: Record<string, any>
}

const apiBase = getApiBase()
const STORAGE_PREFIX = 'simposter-manual-logo:'
const STYLE_ID = 'simposter-manual-logo-styles'
const PANEL_ATTRIBUTE = 'data-manual-logo-panel'
const FETCH_MARKER = '__simposterManualLogoFetch'
const SUPPORTED_TYPES = new Set(['image/png', 'image/webp', 'image/gif'])
const RENDER_PATHS = new Set([
  '/api/preview',
  '/api/save',
  '/api/plex/send',
  '/api/plex/send-logo',
])

let activeEditorKey = ''
let scanTimer: number | null = null

function storageKey(ratingKey: string): string {
  return `${STORAGE_PREFIX}${ratingKey}`
}

function readRecord(ratingKey: string): ManualLogoRecord | null {
  if (!ratingKey) return null
  try {
    const raw = localStorage.getItem(storageKey(ratingKey))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ManualLogoRecord>
    if (!parsed.url || typeof parsed.url !== 'string') return null
    return {
      url: parsed.url,
      active: parsed.active === true,
      fileName: typeof parsed.fileName === 'string' ? parsed.fileName : undefined,
    }
  } catch {
    return null
  }
}

function writeRecord(ratingKey: string, record: ManualLogoRecord | null): void {
  if (!ratingKey) return
  if (!record) {
    localStorage.removeItem(storageKey(ratingKey))
    return
  }
  localStorage.setItem(storageKey(ratingKey), JSON.stringify(record))
}

function scheduleScan(): void {
  if (scanTimer !== null) window.clearTimeout(scanTimer)
  scanTimer = window.setTimeout(() => {
    scanTimer = null
    scanEditors()
  }, 40)
}

function isMovieOrTvEditor(editor: HTMLElement): boolean {
  const kicker = editor.querySelector('.kicker')?.textContent?.replace(/\s+/g, ' ').trim() || ''
  return kicker.startsWith('Editing') && kicker !== 'Editing Audiobook'
}

function componentInstance(editor: HTMLElement): VueComponentInstance | null {
  const element = editor as HTMLElement & { __vueParentComponent?: VueComponentInstance }
  let instance = element.__vueParentComponent || null
  while (instance) {
    const movie = instance.props?.movie
    if (movie?.key && instance.setupState) return instance
    instance = instance.parent || null
  }
  return null
}

function ratingKeyForEditor(editor: HTMLElement): string {
  const fromDataset = editor.dataset.manualLogoRatingKey || ''
  if (fromDataset) return fromDataset

  const instance = componentInstance(editor)
  const key = instance?.props?.movie?.key
  if (key !== undefined && key !== null) {
    const normalized = String(key)
    editor.dataset.manualLogoRatingKey = normalized
    return normalized
  }
  return activeEditorKey
}

function assignSetupValue(state: Record<string, any>, key: string, value: unknown): boolean {
  if (!(key in state)) return false
  const current = state[key]
  if (current && typeof current === 'object' && 'value' in current) {
    current.value = value
  } else {
    state[key] = value
  }
  return true
}

function readSetupValue(state: Record<string, any>, key: string): unknown {
  const current = state[key]
  if (current && typeof current === 'object' && 'value' in current) return current.value
  return current
}

function ensureActiveComponentLogo(editor: HTMLElement, logoUrl: string): void {
  const state = componentInstance(editor)?.setupState
  if (!state) return
  if (readSetupValue(state, 'selectedLogo') !== logoUrl) {
    assignSetupValue(state, 'selectedLogo', logoUrl)
  }
  if (readSetupValue(state, 'logoMode') === 'none') {
    assignSetupValue(state, 'logoMode', 'original')
  }
}

function setComponentLogo(editor: HTMLElement, logoUrl: string | null, mode: string): boolean {
  const instance = componentInstance(editor)
  const state = instance?.setupState
  if (!state) return false
  const changedLogo = assignSetupValue(state, 'selectedLogo', logoUrl)
  const changedMode = assignSetupValue(state, 'logoMode', mode)
  return changedLogo || changedMode
}

function findLogoSection(editor: HTMLElement): HTMLElement | null {
  const sections = Array.from(editor.querySelectorAll<HTMLElement>('.acc-section'))
  return sections.find((section) => {
    const label = section.querySelector('.acc-header')?.textContent?.replace(/\s+/g, ' ').trim() || ''
    return label.startsWith('Logo')
  }) || null
}

function logoModeSelect(editor: HTMLElement): HTMLSelectElement | null {
  const section = findLogoSection(editor)
  if (!section) return null
  const labels = Array.from(section.querySelectorAll<HTMLElement>('.field-label'))
  const label = labels.find((candidate) => {
    const text = candidate.childNodes[0]?.textContent?.replace(/\s+/g, ' ').trim() || ''
    return text === 'Logo Mode'
  })
  return label?.querySelector<HTMLSelectElement>('select') || null
}

function setLogoModeThroughDom(editor: HTMLElement, mode: string): void {
  const select = logoModeSelect(editor)
  if (!select) return
  select.value = mode
  select.dispatchEvent(new Event('input', { bubbles: true }))
  select.dispatchEvent(new Event('change', { bubbles: true }))
}

function activateRecord(editor: HTMLElement, ratingKey: string, record: ManualLogoRecord): void {
  writeRecord(ratingKey, { ...record, active: true })
  const componentUpdated = setComponentLogo(editor, record.url, 'original')
  if (!componentUpdated) {
    // DOM events are the stable fallback if Vue's internal instance shape changes.
    setLogoModeThroughDom(editor, 'none')
    window.queueMicrotask(() => setLogoModeThroughDom(editor, 'original'))
  }
  updatePanel(editor)
}

function deactivateRecord(editor: HTMLElement, ratingKey: string): void {
  const record = readRecord(ratingKey)
  if (record) writeRecord(ratingKey, { ...record, active: false })
  updatePanel(editor)
}

function removeRecord(editor: HTMLElement, ratingKey: string): void {
  writeRecord(ratingKey, null)
  const sourcedLogo = editor.querySelector<HTMLElement>('.logo-thumb')
  if (sourcedLogo) sourcedLogo.click()
  else {
    setComponentLogo(editor, null, 'none')
    setLogoModeThroughDom(editor, 'none')
  }
  updatePanel(editor)
}

function installStyles(): void {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    .manual-logo-upload-block {
      margin: 12px 0 16px;
    }
    .manual-logo-upload-zone {
      position: relative;
      min-height: 92px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 12px;
      overflow: hidden;
      border: 1px dashed color-mix(in srgb, var(--accent) 45%, var(--border));
      border-radius: 10px;
      background: rgba(255, 255, 255, .025);
      color: var(--text-muted);
      cursor: pointer;
      transition: border-color .2s ease, background .2s ease;
    }
    .manual-logo-upload-zone.drag-over {
      border-color: var(--accent);
      background: color-mix(in srgb, var(--accent) 9%, transparent);
    }
    .manual-logo-upload-zone.active {
      border-style: solid;
      border-color: color-mix(in srgb, var(--accent) 70%, var(--border));
    }
    .manual-logo-upload-preview {
      max-width: 100%;
      max-height: 82px;
      object-fit: contain;
      filter: drop-shadow(0 4px 9px rgba(0, 0, 0, .55));
    }
    .manual-logo-upload-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      margin-top: 8px;
    }
    .manual-logo-upload-actions button {
      padding: 7px 10px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface-soft);
      color: var(--text-primary);
      cursor: pointer;
    }
    .manual-logo-upload-actions button.active {
      border-color: var(--accent);
      color: var(--accent);
      background: color-mix(in srgb, var(--accent) 10%, transparent);
    }
    .manual-logo-upload-status {
      margin: 7px 0 0;
      color: var(--text-muted);
      font-size: 11px;
      line-height: 1.35;
    }
    .manual-logo-upload-status.error { color: #ff8a9a; }
  `
  document.head.appendChild(style)
}

async function uploadLogo(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  const response = await fetch(`${apiBase}/api/upload/background`, {
    method: 'POST',
    body: formData,
  })
  if (!response.ok) throw new Error(await response.text() || 'Logo upload failed.')
  const data = await response.json()
  if (!data.url) throw new Error('Logo upload did not return a URL.')
  return String(data.url).startsWith('http') ? String(data.url) : `${apiBase}${data.url}`
}

function buildPanel(editor: HTMLElement): HTMLElement {
  const block = document.createElement('div')
  block.className = 'manual-logo-upload-block'
  block.setAttribute(PANEL_ATTRIBUTE, 'true')

  const heading = document.createElement('div')
  heading.className = 'sub-section-title'
  heading.textContent = 'Custom Transparent Logo'

  const zone = document.createElement('div')
  zone.className = 'manual-logo-upload-zone'
  zone.tabIndex = 0

  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/png,image/webp,image/gif'
  input.hidden = true

  const actions = document.createElement('div')
  actions.className = 'manual-logo-upload-actions'

  const useButton = document.createElement('button')
  useButton.type = 'button'
  useButton.textContent = 'Use Uploaded Logo'

  const replaceButton = document.createElement('button')
  replaceButton.type = 'button'
  replaceButton.textContent = 'Replace'

  const removeButton = document.createElement('button')
  removeButton.type = 'button'
  removeButton.textContent = 'Remove'

  const status = document.createElement('p')
  status.className = 'manual-logo-upload-status'

  actions.append(useButton, replaceButton, removeButton)
  block.append(heading, zone, input, actions, status)

  const chooseFile = (): void => input.click()
  zone.addEventListener('click', chooseFile)
  zone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      chooseFile()
    }
  })
  replaceButton.addEventListener('click', chooseFile)

  const handleFile = async (file: File | undefined): Promise<void> => {
    if (!file) return
    if (!SUPPORTED_TYPES.has(file.type)) {
      status.className = 'manual-logo-upload-status error'
      status.textContent = 'Use PNG, WebP, or GIF. JPEG files cannot preserve transparency.'
      return
    }

    status.className = 'manual-logo-upload-status'
    status.textContent = 'Uploading transparent logo…'
    try {
      const ratingKey = ratingKeyForEditor(editor)
      if (!ratingKey) throw new Error('Could not determine the selected Plex item.')
      const url = await uploadLogo(file)
      activateRecord(editor, ratingKey, { url, active: true, fileName: file.name })
      status.textContent = `${file.name} uploaded and selected.`
    } catch (error) {
      status.className = 'manual-logo-upload-status error'
      status.textContent = error instanceof Error ? error.message : 'Logo upload failed.'
    } finally {
      input.value = ''
    }
  }

  input.addEventListener('change', () => void handleFile(input.files?.[0]))
  zone.addEventListener('dragover', (event) => {
    event.preventDefault()
    zone.classList.add('drag-over')
  })
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'))
  zone.addEventListener('drop', (event) => {
    event.preventDefault()
    zone.classList.remove('drag-over')
    void handleFile(event.dataTransfer?.files?.[0])
  })

  useButton.addEventListener('click', () => {
    const ratingKey = ratingKeyForEditor(editor)
    const record = readRecord(ratingKey)
    if (record) activateRecord(editor, ratingKey, record)
  })
  removeButton.addEventListener('click', () => {
    const ratingKey = ratingKeyForEditor(editor)
    removeRecord(editor, ratingKey)
  })

  return block
}

function updatePanel(editor: HTMLElement): void {
  const panel = editor.querySelector<HTMLElement>(`[${PANEL_ATTRIBUTE}='true']`)
  if (!panel) return
  const ratingKey = ratingKeyForEditor(editor)
  const record = readRecord(ratingKey)
  const zone = panel.querySelector<HTMLElement>('.manual-logo-upload-zone')
  const actions = panel.querySelector<HTMLElement>('.manual-logo-upload-actions')
  const status = panel.querySelector<HTMLElement>('.manual-logo-upload-status')
  const useButton = actions?.querySelector<HTMLButtonElement>('button:first-child')
  if (!zone || !actions || !status || !useButton) return

  const stateSignature = record
    ? `${record.url}|${record.active ? 'active' : 'inactive'}|${record.fileName || ''}`
    : 'empty'
  if (panel.dataset.manualLogoState === stateSignature) return
  panel.dataset.manualLogoState = stateSignature

  zone.replaceChildren()
  if (record) {
    const image = document.createElement('img')
    image.className = 'manual-logo-upload-preview'
    image.src = record.url
    image.alt = 'Uploaded transparent logo'
    zone.appendChild(image)
    zone.classList.toggle('active', record.active)
    actions.hidden = false
    useButton.classList.toggle('active', record.active)
    useButton.textContent = record.active ? 'Uploaded Logo Active' : 'Use Uploaded Logo'
    status.className = 'manual-logo-upload-status'
    status.textContent = record.active
      ? `${record.fileName || 'Uploaded logo'} is being used for preview, save, and Plex logo actions.`
      : `${record.fileName || 'Uploaded logo'} is stored for this title but is not currently selected.`
  } else {
    const prompt = document.createElement('span')
    prompt.textContent = '⇧ Drop a transparent PNG, WebP, or GIF, or click to upload'
    zone.appendChild(prompt)
    zone.classList.remove('active')
    actions.hidden = true
    status.className = 'manual-logo-upload-status'
    status.textContent = 'Transparency is preserved. Existing TMDb, Fanart, and TVDB logos remain available.'
  }
}

function enhanceEditor(editor: HTMLElement): void {
  if (!isMovieOrTvEditor(editor)) return
  const section = findLogoSection(editor)
  const body = section?.querySelector<HTMLElement>('.acc-body')
  if (!body) return

  if (!body.querySelector(`[${PANEL_ATTRIBUTE}='true']`)) {
    const panel = buildPanel(editor)
    const manualHeading = Array.from(body.querySelectorAll<HTMLElement>('.sub-section-title'))
      .find((candidate) => candidate.textContent?.trim() === 'Manual Selection')
    if (manualHeading) body.insertBefore(panel, manualHeading)
    else body.prepend(panel)
  }

  const key = ratingKeyForEditor(editor)
  const record = readRecord(key)
  if (record?.active) ensureActiveComponentLogo(editor, record.url)
  updatePanel(editor)
}

function scanEditors(): void {
  Array.from(document.querySelectorAll<HTMLElement>('.editor-shell')).forEach(enhanceEditor)
}

function markManualLogoInactive(editor: HTMLElement): void {
  const key = ratingKeyForEditor(editor)
  deactivateRecord(editor, key)
}

function installInteractionTracking(): void {
  document.addEventListener('click', (event) => {
    const target = event.target as Element | null
    const editor = target?.closest<HTMLElement>('.editor-shell')
    if (!editor || !isMovieOrTvEditor(editor)) return
    if (target?.closest('.logo-thumb, .no-logo-btn')) markManualLogoInactive(editor)
  }, true)

  document.addEventListener('change', (event) => {
    const select = event.target as HTMLSelectElement | null
    if (!(select instanceof HTMLSelectElement) || select.value !== 'none') return
    const editor = select.closest<HTMLElement>('.editor-shell')
    if (!editor || !isMovieOrTvEditor(editor) || select !== logoModeSelect(editor)) return
    markManualLogoInactive(editor)
  }, true)
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

    if (!RENDER_PATHS.has(parsed.pathname) || typeof init?.body !== 'string') {
      return previousFetch(input, init)
    }

    try {
      const body = JSON.parse(init.body) as Record<string, any>
      const ratingKey = body.rating_key !== undefined && body.rating_key !== null
        ? String(body.rating_key)
        : ''
      if (ratingKey) {
        activeEditorKey = ratingKey
        const editor = Array.from(document.querySelectorAll<HTMLElement>('.editor-shell'))
          .find(isMovieOrTvEditor)
        if (editor) editor.dataset.manualLogoRatingKey = ratingKey
      }

      const record = readRecord(ratingKey)
      const logoMode = body.options && typeof body.options === 'object'
        ? String(body.options.logo_mode || 'original')
        : 'original'
      if (record?.active && logoMode !== 'none') {
        body.logo_url = record.url
        const nextInit: RequestInit = {
          ...init,
          body: JSON.stringify(body),
        }
        return previousFetch(input, nextInit)
      }
    } catch {
      // Leave non-JSON or unexpected requests untouched.
    }

    return previousFetch(input, init)
  }
}

function start(): void {
  installStyles()
  installFetchInterceptor()
  installInteractionTracking()
  scanEditors()

  const observer = new MutationObserver(scheduleScan)
  observer.observe(document.body, { childList: true, subtree: true })
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true })
  else start()
}
