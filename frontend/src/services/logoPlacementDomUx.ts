const ENHANCED = 'data-logo-placement-dom-enhanced'
const PANEL_CLASS = 'logo-placement-dom-panel'
const ADVANCED_CLASS = 'logo-placement-dom-advanced'
const STYLE_ID = 'simposter-logo-placement-dom-styles'

let scanTimer: number | null = null
let syncTimer: number | null = null

function cleanText(value: string | null | undefined): string {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function findLogoSection(editor: HTMLElement): HTMLElement | null {
  const sections = Array.from(editor.querySelectorAll<HTMLElement>('.acc-section'))
  return sections.find((section) =>
    cleanText(section.querySelector('.acc-header')?.textContent).startsWith('Logo'),
  ) || null
}

function rowLabel(row: HTMLElement): string {
  const label = row.querySelector('label')
  return cleanText(label?.textContent || row.childNodes[0]?.textContent)
}

function findSlider(body: HTMLElement, labels: string[]): HTMLElement | null {
  const wanted = labels.map((label) => label.toLowerCase())
  return Array.from(body.querySelectorAll<HTMLElement>('.slider')).find((row) =>
    wanted.includes(rowLabel(row).toLowerCase()),
  ) || null
}

function findField(body: HTMLElement, labels: string[]): HTMLElement | null {
  const wanted = labels.map((label) => label.toLowerCase())
  return Array.from(body.querySelectorAll<HTMLElement>('.field-label, .slider')).find((row) =>
    wanted.includes(rowLabel(row).toLowerCase()),
  ) || null
}

function rowInputs(row: HTMLElement | null): HTMLInputElement[] {
  return row ? Array.from(row.querySelectorAll<HTMLInputElement>('input')) : []
}

function readRow(row: HTMLElement | null, fallback: number): number {
  const input = rowInputs(row)[0]
  const value = input ? Number(input.value) : Number.NaN
  return Number.isFinite(value) ? value : fallback
}

function setInputValue(input: HTMLInputElement, value: number): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
  const normalized = String(Math.round(value))
  descriptor?.set?.call(input, normalized)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

function writeRow(row: HTMLElement | null, value: number): void {
  rowInputs(row).forEach((input) => setInputValue(input, value))
}

function clickAlignment(row: HTMLElement | null, value: string): void {
  if (!row) return
  const button = Array.from(row.querySelectorAll<HTMLButtonElement>('button')).find(
    (candidate) => cleanText(candidate.textContent).toLowerCase() === value.toLowerCase(),
  )
  button?.click()
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}

function axisCoordinate(index: number, size: number, vertical: boolean): number {
  if (index === 1) return 50
  const factor = clamp(size / 100, 0.1, 2.2)
  const half = vertical
    ? clamp(14 * factor, 4, 42)
    : clamp(36 * factor, 5, 45)
  return Math.round(index === 0 ? half + 4 : 96 - half)
}

type RawControls = {
  body: HTMLElement
  heading: HTMLElement | null
  scale: HTMLElement
  maxWidth: HTMLElement | null
  maxHeight: HTMLElement | null
  x: HTMLElement | null
  y: HTMLElement
  horizontalAlign: HTMLElement | null
  verticalAlign: HTMLElement | null
  uniform: boolean
  safeWidth: number
  safeHeight: number
}

function collect(editor: HTMLElement): RawControls | null {
  const section = findLogoSection(editor)
  const body = section?.querySelector<HTMLElement>('.acc-body') || null
  if (!body) return null

  const scale = findSlider(body, ['Scale %', 'Logo Scale %'])
  const maxWidth = findSlider(body, ['Max Width (px)'])
  const maxHeight = findSlider(body, ['Max Height (px)'])
  const x = findSlider(body, ['Logo Box X %'])
  const y = findSlider(body, ['Logo Box Y %', 'Logo Position %'])
  const horizontalAlign = findField(body, ['Horizontal Align'])
  const verticalAlign = findField(body, ['Vertical Align'])
  const heading = Array.from(body.querySelectorAll<HTMLElement>('.sub-section-title')).find(
    (item) => cleanText(item.textContent) === 'Position & Size',
  ) || null

  if (!scale || !y) return null
  const uniform = Boolean(maxWidth && maxHeight && x)
  const audiobook = cleanText(editor.querySelector('.kicker')?.textContent) === 'Editing Audiobook'

  return {
    body,
    heading,
    scale,
    maxWidth,
    maxHeight,
    x,
    y,
    horizontalAlign,
    verticalAlign,
    uniform,
    safeWidth: 1440,
    safeHeight: Math.round((audiobook ? 2000 : 3000) * 0.28),
  }
}

function derive(raw: RawControls): { size: number; x: number; y: number } {
  if (!raw.uniform) {
    return {
      size: clamp(Math.round(readRow(raw.scale, 50) / 0.7), 15, 140),
      x: 50,
      y: clamp(Math.round(readRow(raw.y, 75)), 0, 100),
    }
  }

  const boxFactor = Math.min(
    readRow(raw.maxWidth, raw.safeWidth) / raw.safeWidth,
    readRow(raw.maxHeight, raw.safeHeight) / raw.safeHeight,
  )
  return {
    size: clamp(Math.round(readRow(raw.scale, 100) * boxFactor), 10, 220),
    x: clamp(Math.round(readRow(raw.x, 50)), 0, 100),
    y: clamp(Math.round(readRow(raw.y, 78)), 0, 100),
  }
}

function apply(raw: RawControls, size: number, x: number, y: number): void {
  if (raw.uniform) {
    writeRow(raw.maxWidth, raw.safeWidth)
    writeRow(raw.maxHeight, raw.safeHeight)
    writeRow(raw.scale, clamp(size, 10, 220))
    writeRow(raw.x, clamp(x, 0, 100))
    writeRow(raw.y, clamp(y, 0, 100))
    clickAlignment(raw.horizontalAlign, 'Center')
    clickAlignment(raw.verticalAlign, 'Center')
    return
  }

  writeRow(raw.scale, clamp(size * 0.7, 10, 100))
  writeRow(raw.y, clamp(y, 0, 100))
}

function setPanelValue(panel: HTMLElement, name: string, value: number): void {
  const normalized = String(Math.round(value))
  panel.querySelectorAll<HTMLInputElement>(`[data-logo-placement-field="${name}"]`).forEach((input) => {
    input.value = normalized
  })
}

function panelValue(panel: HTMLElement, name: string, fallback: number): number {
  const input = panel.querySelector<HTMLInputElement>(`[data-logo-placement-field="${name}"][type="number"]`)
  const value = input ? Number(input.value) : Number.NaN
  return Number.isFinite(value) ? value : fallback
}

function syncPanel(editor: HTMLElement): void {
  const raw = collect(editor)
  const panel = raw?.body.querySelector<HTMLElement>(`.${PANEL_CLASS}`) || null
  if (!raw || !panel || panel.contains(document.activeElement)) return

  if (panel.dataset.uniform !== String(raw.uniform)) {
    panel.remove()
    raw.body.removeAttribute(ENHANCED)
    raw.body.querySelectorAll(`.${ADVANCED_CLASS}`).forEach((item) => item.classList.remove(ADVANCED_CLASS))
    enhance(editor)
    return
  }

  const values = derive(raw)
  setPanelValue(panel, 'size', values.size)
  setPanelValue(panel, 'x', values.x)
  setPanelValue(panel, 'y', values.y)
}

function bindPair(panel: HTMLElement, name: string, onChange: () => void): void {
  const range = panel.querySelector<HTMLInputElement>(`[data-logo-placement-field="${name}"][type="range"]`)
  const number = panel.querySelector<HTMLInputElement>(`[data-logo-placement-field="${name}"][type="number"]`)
  if (!range || !number) return

  range.addEventListener('input', () => {
    number.value = range.value
    onChange()
  })
  number.addEventListener('input', () => {
    range.value = number.value
    onChange()
  })
}

function createPanel(raw: RawControls): HTMLElement {
  const values = derive(raw)
  const panel = document.createElement('div')
  panel.className = PANEL_CLASS
  panel.dataset.uniform = String(raw.uniform)
  panel.innerHTML = `
    <div class="logo-placement-dom-heading">
      <div><strong>Logo Placement</strong><span>Transparent padding is ignored automatically.</span></div>
      <button type="button" class="logo-placement-dom-reset">Reset</button>
    </div>
    <label class="logo-placement-dom-slider">Logo Size %
      <span><input data-logo-placement-field="size" type="range" min="${raw.uniform ? 10 : 15}" max="${raw.uniform ? 220 : 140}" value="${values.size}"><input data-logo-placement-field="size" type="number" min="${raw.uniform ? 10 : 15}" max="${raw.uniform ? 220 : 140}" value="${values.size}"></span>
    </label>
    <label class="logo-placement-dom-slider" ${raw.uniform ? '' : 'hidden'}>Horizontal Position %
      <span><input data-logo-placement-field="x" type="range" min="0" max="100" value="${values.x}"><input data-logo-placement-field="x" type="number" min="0" max="100" value="${values.x}"></span>
    </label>
    <label class="logo-placement-dom-slider">Vertical Position %
      <span><input data-logo-placement-field="y" type="range" min="0" max="100" value="${values.y}"><input data-logo-placement-field="y" type="number" min="0" max="100" value="${values.y}"></span>
    </label>
    <div class="logo-placement-dom-quick"><span>Quick Placement</span><div class="logo-placement-dom-grid"></div></div>
    <button type="button" class="logo-placement-dom-advanced-toggle">Advanced Positioning</button>
    <p>${raw.uniform ? '100% fits the visible logo inside the standard logo safe area.' : 'This template centers logos horizontally. Use Uniform Logo for horizontal placement.'}</p>
  `

  const grid = panel.querySelector<HTMLElement>('.logo-placement-dom-grid')
  if (grid) {
    const rows = [0, 1, 2]
    const columns = raw.uniform ? [0, 1, 2] : [1]
    rows.forEach((row) => {
      columns.forEach((column) => {
        const button = document.createElement('button')
        button.type = 'button'
        button.dataset.row = String(row)
        button.dataset.column = String(column)
        button.title = `${row === 0 ? 'Top' : row === 1 ? 'Middle' : 'Bottom'} ${column === 0 ? 'left' : column === 1 ? 'center' : 'right'}`
        button.innerHTML = '<span></span>'
        grid.appendChild(button)
      })
    })
  }

  const applyPanel = (): void => {
    apply(
      raw,
      panelValue(panel, 'size', values.size),
      panelValue(panel, 'x', values.x),
      panelValue(panel, 'y', values.y),
    )
    panel.querySelectorAll('.logo-placement-dom-grid .active').forEach((item) => item.classList.remove('active'))
  }

  bindPair(panel, 'size', applyPanel)
  bindPair(panel, 'x', applyPanel)
  bindPair(panel, 'y', applyPanel)

  panel.querySelectorAll<HTMLButtonElement>('.logo-placement-dom-grid button').forEach((button) => {
    button.addEventListener('click', () => {
      const size = panelValue(panel, 'size', values.size)
      const row = Number(button.dataset.row || 1)
      const column = Number(button.dataset.column || 1)
      setPanelValue(panel, 'x', axisCoordinate(column, size, false))
      setPanelValue(panel, 'y', axisCoordinate(row, size, true))
      panel.querySelectorAll('.logo-placement-dom-grid .active').forEach((item) => item.classList.remove('active'))
      button.classList.add('active')
      apply(raw, size, panelValue(panel, 'x', 50), panelValue(panel, 'y', 78))
    })
  })

  panel.querySelector<HTMLButtonElement>('.logo-placement-dom-reset')?.addEventListener('click', () => {
    setPanelValue(panel, 'size', 100)
    setPanelValue(panel, 'x', 50)
    setPanelValue(panel, 'y', 78)
    panel.querySelectorAll('.logo-placement-dom-grid .active').forEach((item) => item.classList.remove('active'))
    apply(raw, 100, 50, 78)
  })

  panel.querySelector<HTMLButtonElement>('.logo-placement-dom-advanced-toggle')?.addEventListener('click', (event) => {
    const open = raw.body.classList.toggle('logo-placement-dom-advanced-open')
    ;(event.currentTarget as HTMLButtonElement).textContent = open ? 'Hide Advanced Positioning' : 'Advanced Positioning'
  })

  return panel
}

function enhance(editor: HTMLElement): void {
  const raw = collect(editor)
  if (!raw || raw.body.getAttribute(ENHANCED) === 'true') return

  raw.body.setAttribute(ENHANCED, 'true')
  ;[
    raw.heading,
    raw.scale,
    raw.maxWidth,
    raw.maxHeight,
    raw.x,
    raw.y,
    raw.horizontalAlign,
    raw.verticalAlign,
  ].forEach((item) => item?.classList.add(ADVANCED_CLASS))

  const panel = createPanel(raw)
  const insertionPoint = raw.heading || raw.scale
  raw.body.insertBefore(panel, insertionPoint)

  raw.body.querySelectorAll<HTMLElement>(`.${ADVANCED_CLASS}`).forEach((control) => {
    control.addEventListener('input', () => window.setTimeout(() => syncPanel(editor), 0))
    control.addEventListener('change', () => window.setTimeout(() => syncPanel(editor), 0))
    control.addEventListener('click', () => window.setTimeout(() => syncPanel(editor), 0))
  })

  editor.querySelectorAll<HTMLSelectElement>('select').forEach((select) => {
    select.addEventListener('change', () => window.setTimeout(() => syncPanel(editor), 125))
  })
}

function scan(root: ParentNode = document): void {
  if (root instanceof HTMLElement && root.matches('.editor-shell')) enhance(root)
  root.querySelectorAll<HTMLElement>('.editor-shell').forEach(enhance)
}

function scheduleScan(root: ParentNode = document): void {
  if (scanTimer !== null) window.clearTimeout(scanTimer)
  scanTimer = window.setTimeout(() => {
    scanTimer = null
    scan(root)
  }, 40)
}

function installStyles(): void {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    .logo-placement-dom-panel{display:grid;gap:14px;margin:10px 0 18px;padding:15px;border:1px solid var(--border);border-radius:12px;background:color-mix(in srgb,var(--surface-soft) 84%,transparent)}
    .logo-placement-dom-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.logo-placement-dom-heading strong{display:block;color:var(--text-primary);font-size:13px;letter-spacing:.055em;text-transform:uppercase}.logo-placement-dom-heading span{display:block;margin-top:3px;color:var(--text-muted);font-size:11px}
    .logo-placement-dom-reset,.logo-placement-dom-advanced-toggle{border:1px solid var(--border);border-radius:8px;background:var(--surface-soft);color:var(--text-secondary);cursor:pointer}.logo-placement-dom-reset{padding:7px 10px}.logo-placement-dom-advanced-toggle{width:100%;padding:9px 10px;text-align:left}
    .logo-placement-dom-slider{display:grid;gap:7px;color:var(--text-secondary);font-size:12px;font-weight:600}.logo-placement-dom-slider>span{display:grid;grid-template-columns:minmax(0,1fr) 74px;gap:10px;align-items:center}.logo-placement-dom-slider input[type=range]{width:100%}.logo-placement-dom-slider input[type=number]{width:100%;padding:8px;border:1px solid var(--border);border-radius:8px;background:rgba(255,255,255,.04);color:var(--text-primary);text-align:center}
    .logo-placement-dom-quick{display:grid;gap:8px}.logo-placement-dom-quick>span{color:var(--text-secondary);font-size:12px;font-weight:600}.logo-placement-dom-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.logo-placement-dom-grid button{min-height:36px;border:1px solid var(--border);border-radius:8px;background:var(--surface-soft);cursor:pointer}.logo-placement-dom-grid button span{display:block;width:7px;height:7px;margin:auto;border-radius:50%;background:var(--text-muted)}.logo-placement-dom-grid button:hover,.logo-placement-dom-grid button.active{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 12%,var(--surface-soft))}.logo-placement-dom-grid button.active span{background:var(--accent)}
    .logo-placement-dom-panel p{margin:-4px 0 0;color:var(--text-muted);font-size:11px;line-height:1.45}.logo-placement-dom-advanced{display:none!important}.logo-placement-dom-advanced-open .logo-placement-dom-advanced{display:flex!important}.logo-placement-dom-advanced-open .sub-section-title.logo-placement-dom-advanced{display:block!important}
  `
  document.head.appendChild(style)
}

function start(): void {
  installStyles()
  scan()
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
      if (node instanceof Element) scheduleScan(node)
    }))
  })
  observer.observe(document.body, { childList: true, subtree: true })

  syncTimer = window.setInterval(() => {
    document.querySelectorAll<HTMLElement>('.editor-shell').forEach((editor) => {
      const raw = collect(editor)
      if (!raw) return
      if (!raw.body.querySelector(`.${PANEL_CLASS}`)) enhance(editor)
      else syncPanel(editor)
    })
  }, 750)
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true })
  else start()
  window.addEventListener('beforeunload', () => {
    if (syncTimer !== null) window.clearInterval(syncTimer)
  }, { once: true })
}
