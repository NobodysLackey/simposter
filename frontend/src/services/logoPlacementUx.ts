type VueComponentInstance = {
  parent?: VueComponentInstance | null
  props?: Record<string, unknown>
  setupState?: Record<string, unknown>
}

type PlacementMode = 'uniform' | 'basic'

type LogoOptions = Record<string, unknown>

type CanvasMetrics = {
  width: number
  height: number
  safeWidth: number
  safeHeight: number
}

type ExistingControls = {
  section: HTMLElement
  body: HTMLElement
  mode: PlacementMode
  options: LogoOptions
  heading: HTMLElement | null
  scale: HTMLElement | null
  maxWidth: HTMLElement | null
  maxHeight: HTMLElement | null
  x: HTMLElement | null
  y: HTMLElement | null
  horizontalAlign: HTMLElement | null
  verticalAlign: HTMLElement | null
}

type PlacementValues = {
  size: number
  x: number
  y: number
}

type NumberField = {
  wrapper: HTMLElement
  range: HTMLInputElement
  number: HTMLInputElement
}

const STYLE_ID = 'simposter-logo-placement-styles'
const PANEL_CLASS = 'logo-placement-panel'
const ADVANCED_CLASS = 'logo-placement-advanced-control'
const ADVANCED_OPEN_CLASS = 'logo-placement-advanced-open'

let scanTimer: number | null = null

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}

function normalizedText(value: string | null | undefined): string {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function readSetupValue(state: Record<string, unknown>, key: string): unknown {
  const current = state[key]
  if (current && typeof current === 'object' && 'value' in current) {
    return (current as { value?: unknown }).value
  }
  return current
}

function componentInstance(editor: HTMLElement): VueComponentInstance | null {
  const element = editor as HTMLElement & { __vueParentComponent?: VueComponentInstance }
  let instance = element.__vueParentComponent || null

  while (instance) {
    const state = instance.setupState
    const props = instance.props
    const movie = props?.movie as { key?: unknown } | undefined
    const audiobook = props?.audiobook as { key?: unknown } | undefined
    if (state && readSetupValue(state, 'options') && (movie?.key || audiobook?.key)) return instance
    instance = instance.parent || null
  }

  return null
}

function optionsForEditor(editor: HTMLElement): LogoOptions | null {
  const state = componentInstance(editor)?.setupState
  if (!state) return null
  const options = readSetupValue(state, 'options')
  return options && typeof options === 'object' ? options as LogoOptions : null
}

function isAudiobookEditor(editor: HTMLElement): boolean {
  return normalizedText(editor.querySelector('.kicker')?.textContent) === 'Editing Audiobook'
}

function placementMode(editor: HTMLElement): PlacementMode {
  if (isAudiobookEditor(editor)) return 'uniform'
  const state = componentInstance(editor)?.setupState
  const selectedTemplate = state ? String(readSetupValue(state, 'selectedTemplate') || '') : ''
  return selectedTemplate === 'uniformlogo' ? 'uniform' : 'basic'
}

function canvasMetrics(editor: HTMLElement): CanvasMetrics {
  const width = 2000
  const height = isAudiobookEditor(editor) ? 2000 : 3000
  return {
    width,
    height,
    safeWidth: Math.round(width * 0.72),
    safeHeight: Math.round(height * 0.28),
  }
}

function logoSection(editor: HTMLElement): HTMLElement | null {
  const sections = Array.from(editor.querySelectorAll<HTMLElement>('.acc-section'))
  return sections.find((section) =>
    normalizedText(section.querySelector('.acc-header')?.textContent).startsWith('Logo'),
  ) || null
}

function controlLabel(control: HTMLElement): string {
  const label = control.querySelector('label')
  return normalizedText(label?.textContent || control.childNodes.item(0)?.textContent)
}

function findControl(body: HTMLElement, selectors: string, labels: string[]): HTMLElement | null {
  const wanted = new Set(labels.map((label) => label.toLowerCase()))
  return Array.from(body.querySelectorAll<HTMLElement>(selectors)).find((control) =>
    wanted.has(controlLabel(control).toLowerCase()),
  ) || null
}

function collectControls(editor: HTMLElement): ExistingControls | null {
  const section = logoSection(editor)
  const body = section?.querySelector<HTMLElement>('.acc-body') || null
  const options = optionsForEditor(editor)
  if (!section || !body || !options) return null

  const mode = placementMode(editor)
  const controls: ExistingControls = {
    section,
    body,
    mode,
    options,
    heading: Array.from(body.querySelectorAll<HTMLElement>('.sub-section-title')).find((item) =>
      normalizedText(item.textContent) === 'Position & Size',
    ) || null,
    scale: findControl(body, '.slider', ['Scale %', 'Logo Scale %']),
    maxWidth: findControl(body, '.slider', ['Max Width (px)']),
    maxHeight: findControl(body, '.slider', ['Max Height (px)']),
    x: findControl(body, '.slider', ['Logo Box X %']),
    y: findControl(body, '.slider', ['Logo Box Y %', 'Logo Position %']),
    horizontalAlign: findControl(body, '.field-label, .slider', ['Horizontal Align']),
    verticalAlign: findControl(body, '.field-label, .slider', ['Vertical Align']),
  }

  if (mode === 'uniform' && (!controls.maxWidth || !controls.maxHeight || !controls.x || !controls.y)) {
    return null
  }
  if (mode === 'basic' && (!controls.scale || !controls.y)) return null
  return controls
}

function numericOption(options: LogoOptions, key: string, fallback: number): number {
  const value = Number(options[key])
  return Number.isFinite(value) ? value : fallback
}

function deriveValues(editor: HTMLElement, controls: ExistingControls): PlacementValues {
  const metrics = canvasMetrics(editor)
  const options = controls.options

  if (controls.mode === 'uniform') {
    const legacyScale = numericOption(options, 'logoScale', 100)
    const maxWidth = numericOption(options, 'uniformLogoMaxW', metrics.safeWidth)
    const maxHeight = numericOption(options, 'uniformLogoMaxH', metrics.safeHeight)
    const boxFactor = Math.min(maxWidth / metrics.safeWidth, maxHeight / metrics.safeHeight)
    return {
      size: clamp(Math.round(legacyScale * boxFactor), 10, 220),
      x: clamp(Math.round(numericOption(options, 'uniformLogoOffsetX', 50)), 0, 100),
      y: clamp(Math.round(numericOption(options, 'uniformLogoOffsetY', 78)), 0, 100),
    }
  }

  return {
    size: clamp(Math.round(numericOption(options, 'logoScale', 50) / 0.7), 15, 140),
    x: 50,
    y: clamp(Math.round(numericOption(options, 'logoOffset', 75)), 0, 100),
  }
}

function applyValues(editor: HTMLElement, controls: ExistingControls, values: PlacementValues): void {
  const metrics = canvasMetrics(editor)
  const options = controls.options

  if (controls.mode === 'uniform') {
    options.uniformLogoMaxW = metrics.safeWidth
    options.uniformLogoMaxH = metrics.safeHeight
    options.logoScale = clamp(Math.round(values.size), 10, 220)
    options.uniformLogoOffsetX = clamp(Math.round(values.x), 0, 100)
    options.uniformLogoOffsetY = clamp(Math.round(values.y), 0, 100)
    options.uniformLogoHAlign = 'center'
    options.uniformLogoVAlign = 'center'
  } else {
    options.logoScale = clamp(Math.round(values.size * 0.7), 10, 100)
    options.logoOffset = clamp(Math.round(values.y), 0, 100)
  }
}

function placementCoordinates(size: number, column: number, row: number): { x: number; y: number } {
  const sizeFactor = clamp(size / 100, 0.1, 2.2)
  const halfWidth = clamp(36 * sizeFactor, 4, 45)
  const halfHeight = clamp(14 * sizeFactor, 3, 42)
  const xValues: [number, number, number] = [halfWidth + 4, 50, 96 - halfWidth]
  const yValues: [number, number, number] = [halfHeight + 4, 50, 96 - halfHeight]
  const safeColumn = clamp(Math.round(column), 0, 2) as 0 | 1 | 2
  const safeRow = clamp(Math.round(row), 0, 2) as 0 | 1 | 2
  return {
    x: Math.round(clamp(xValues[safeColumn], 0, 100)),
    y: Math.round(clamp(yValues[safeRow], 0, 100)),
  }
}

function createNumberField(labelText: string, value: number, minimum: number, maximum: number): NumberField {
  const wrapper = document.createElement('div')
  wrapper.className = 'logo-placement-field'

  const label = document.createElement('label')
  label.textContent = labelText

  const row = document.createElement('div')
  row.className = 'logo-placement-field-row'

  const range = document.createElement('input')
  range.type = 'range'
  range.min = String(minimum)
  range.max = String(maximum)
  range.value = String(value)

  const number = document.createElement('input')
  number.type = 'number'
  number.min = String(minimum)
  number.max = String(maximum)
  number.value = String(value)

  row.append(range, number)
  wrapper.append(label, row)
  return { wrapper, range, number }
}

function setFieldValue(field: NumberField, value: number): void {
  const normalized = String(Math.round(value))
  field.range.value = normalized
  field.number.value = normalized
}

function readFieldValue(field: NumberField, fallback: number): number {
  const value = Number(field.number.value || field.range.value)
  return Number.isFinite(value) ? value : fallback
}

function markAdvancedControls(controls: ExistingControls): void {
  const candidates = [
    controls.heading,
    controls.scale,
    controls.maxWidth,
    controls.maxHeight,
    controls.x,
    controls.y,
    controls.horizontalAlign,
    controls.verticalAlign,
  ]
  candidates.forEach((control) => control?.classList.add(ADVANCED_CLASS))
}

function panelFields(panel: HTMLElement): { size: NumberField; x: NumberField; y: NumberField } | null {
  const sizeRange = panel.querySelector<HTMLInputElement>('[data-logo-field="size-range"]')
  const sizeNumber = panel.querySelector<HTMLInputElement>('[data-logo-field="size-number"]')
  const xRange = panel.querySelector<HTMLInputElement>('[data-logo-field="x-range"]')
  const xNumber = panel.querySelector<HTMLInputElement>('[data-logo-field="x-number"]')
  const yRange = panel.querySelector<HTMLInputElement>('[data-logo-field="y-range"]')
  const yNumber = panel.querySelector<HTMLInputElement>('[data-logo-field="y-number"]')
  if (!sizeRange || !sizeNumber || !xRange || !xNumber || !yRange || !yNumber) return null
  const placeholder = document.createElement('div')
  return {
    size: { wrapper: placeholder, range: sizeRange, number: sizeNumber },
    x: { wrapper: placeholder, range: xRange, number: xNumber },
    y: { wrapper: placeholder, range: yRange, number: yNumber },
  }
}

function syncPanel(editor: HTMLElement): void {
  const controls = collectControls(editor)
  const panel = controls?.body.querySelector<HTMLElement>(`.${PANEL_CLASS}`)
  if (!controls || !panel) return

  if (panel.dataset.mode !== controls.mode) {
    panel.remove()
    controls.section.classList.remove(ADVANCED_OPEN_CLASS)
    enhanceEditor(editor)
    return
  }

  const fields = panelFields(panel)
  if (!fields) return
  const values = deriveValues(editor, controls)
  setFieldValue(fields.size, values.size)
  setFieldValue(fields.x, values.x)
  setFieldValue(fields.y, values.y)
}

function createPlacementPanel(editor: HTMLElement, controls: ExistingControls): HTMLElement {
  const initial = deriveValues(editor, controls)
  const panel = document.createElement('div')
  panel.className = PANEL_CLASS
  panel.dataset.mode = controls.mode

  const header = document.createElement('div')
  header.className = 'logo-placement-header'
  const title = document.createElement('div')
  title.innerHTML = '<strong>Logo Placement</strong><span>Transparent padding is ignored automatically.</span>'
  const reset = document.createElement('button')
  reset.type = 'button'
  reset.className = 'logo-placement-reset'
  reset.textContent = 'Reset'
  header.append(title, reset)

  const size = createNumberField('Logo Size %', initial.size, controls.mode === 'uniform' ? 10 : 15, controls.mode === 'uniform' ? 220 : 140)
  const x = createNumberField('Horizontal Position %', initial.x, 0, 100)
  const y = createNumberField('Vertical Position %', initial.y, 0, 100)
  size.range.dataset.logoField = 'size-range'
  size.number.dataset.logoField = 'size-number'
  x.range.dataset.logoField = 'x-range'
  x.number.dataset.logoField = 'x-number'
  y.range.dataset.logoField = 'y-range'
  y.number.dataset.logoField = 'y-number'
  if (controls.mode === 'basic') x.wrapper.hidden = true

  const quick = document.createElement('div')
  quick.className = 'logo-placement-quick'
  const quickLabel = document.createElement('span')
  quickLabel.textContent = 'Quick Placement'
  const grid = document.createElement('div')
  grid.className = controls.mode === 'uniform' ? 'logo-placement-grid' : 'logo-placement-grid vertical-only'
  const names: [string[], string[], string[]] = [
    ['Top left', 'Top center', 'Top right'],
    ['Middle left', 'Center', 'Middle right'],
    ['Bottom left', 'Bottom center', 'Bottom right'],
  ]

  const rows: Array<0 | 1 | 2> = [0, 1, 2]
  rows.forEach((row) => {
    const columns: Array<0 | 1 | 2> = controls.mode === 'uniform' ? [0, 1, 2] : [1]
    columns.forEach((column) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'logo-placement-cell'
      button.title = names[row][column] || 'Place logo'
      button.setAttribute('aria-label', button.title)
      button.dataset.row = String(row)
      button.dataset.column = String(column)
      button.appendChild(document.createElement('span'))
      grid.appendChild(button)
    })
  })
  quick.append(quickLabel, grid)

  const advanced = document.createElement('button')
  advanced.type = 'button'
  advanced.className = 'logo-placement-advanced-toggle'
  advanced.textContent = 'Advanced Positioning'

  const hint = document.createElement('p')
  hint.className = 'logo-placement-hint'
  hint.textContent = controls.mode === 'uniform'
    ? '100% fits the visible artwork inside the standard logo safe area.'
    : 'This template centers logos horizontally. Use Uniform Logo for horizontal placement.'

  panel.append(header, size.wrapper, x.wrapper, y.wrapper, quick, advanced, hint)

  const currentValues = (): PlacementValues => ({
    size: readFieldValue(size, initial.size),
    x: readFieldValue(x, initial.x),
    y: readFieldValue(y, initial.y),
  })

  const apply = (clearQuickSelection = true): void => {
    const values = currentValues()
    setFieldValue(size, values.size)
    setFieldValue(x, values.x)
    setFieldValue(y, values.y)
    if (clearQuickSelection) {
      panel.dataset.placement = ''
      grid.querySelectorAll('.active').forEach((item) => item.classList.remove('active'))
    }
    applyValues(editor, controls, values)
  }

  const pairs: Array<[HTMLInputElement, HTMLInputElement]> = [
    [size.range, size.number],
    [x.range, x.number],
    [y.range, y.number],
  ]
  pairs.forEach(([range, number]) => {
    range.addEventListener('input', () => {
      number.value = range.value
      apply()
    })
    number.addEventListener('input', () => {
      range.value = number.value
      apply()
    })
  })

  grid.querySelectorAll<HTMLButtonElement>('.logo-placement-cell').forEach((button) => {
    button.addEventListener('click', () => {
      const row = Number(button.dataset.row || 1)
      const column = Number(button.dataset.column || 1)
      const next = placementCoordinates(readFieldValue(size, initial.size), column, row)
      setFieldValue(x, next.x)
      setFieldValue(y, next.y)
      panel.dataset.placement = `${row}:${column}`
      grid.querySelectorAll('.active').forEach((item) => item.classList.remove('active'))
      button.classList.add('active')
      applyValues(editor, controls, currentValues())
    })
  })

  reset.addEventListener('click', () => {
    setFieldValue(size, 100)
    setFieldValue(x, 50)
    setFieldValue(y, 78)
    panel.dataset.placement = ''
    grid.querySelectorAll('.active').forEach((item) => item.classList.remove('active'))
    applyValues(editor, controls, currentValues())
  })

  advanced.addEventListener('click', () => {
    const open = controls.section.classList.toggle(ADVANCED_OPEN_CLASS)
    advanced.textContent = open ? 'Hide Advanced Positioning' : 'Advanced Positioning'
  })

  return panel
}

function enhanceEditor(editor: HTMLElement): void {
  const controls = collectControls(editor)
  if (!controls) return

  const existing = controls.body.querySelector<HTMLElement>(`.${PANEL_CLASS}`)
  if (existing) {
    syncPanel(editor)
    return
  }

  markAdvancedControls(controls)
  const panel = createPlacementPanel(editor, controls)
  const insertionPoint = controls.heading || controls.scale || controls.maxWidth || controls.y
  if (insertionPoint) insertionPoint.insertAdjacentElement('beforebegin', panel)
  else controls.body.appendChild(panel)
}

function scanEditors(root: ParentNode = document): void {
  if (root instanceof HTMLElement && root.matches('.editor-shell')) enhanceEditor(root)
  root.querySelectorAll<HTMLElement>('.editor-shell').forEach(enhanceEditor)
}

function scheduleScan(delay = 45): void {
  if (scanTimer !== null) window.clearTimeout(scanTimer)
  scanTimer = window.setTimeout(() => {
    scanTimer = null
    scanEditors()
  }, delay)
}

function installStyles(): void {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    .logo-placement-panel {
      display: grid;
      gap: 12px;
      margin: 12px 0 16px;
      padding: 14px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: color-mix(in srgb, var(--surface-soft) 86%, transparent);
    }
    .logo-placement-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
    }
    .logo-placement-header div { display: grid; gap: 3px; }
    .logo-placement-header strong { color: var(--text-primary); font-size: 13px; }
    .logo-placement-header span, .logo-placement-hint { color: var(--text-muted); font-size: 11px; }
    .logo-placement-reset, .logo-placement-advanced-toggle, .logo-placement-cell {
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface-soft);
      color: var(--text-secondary);
      cursor: pointer;
    }
    .logo-placement-reset { padding: 6px 9px; white-space: nowrap; }
    .logo-placement-field { display: grid; gap: 6px; }
    .logo-placement-field label, .logo-placement-quick > span { color: var(--text-secondary); font-size: 12px; font-weight: 600; }
    .logo-placement-field-row { display: grid; grid-template-columns: 1fr 68px; gap: 9px; align-items: center; }
    .logo-placement-field-row input[type='range'] { width: 100%; }
    .logo-placement-field-row input[type='number'] {
      width: 100%;
      padding: 7px;
      border: 1px solid var(--border);
      border-radius: 7px;
      background: rgba(255,255,255,.04);
      color: var(--text-primary);
    }
    .logo-placement-quick { display: grid; gap: 7px; }
    .logo-placement-grid { display: grid; grid-template-columns: repeat(3, 38px); gap: 7px; justify-content: start; }
    .logo-placement-grid.vertical-only { grid-template-columns: 38px; }
    .logo-placement-cell { width: 38px; height: 32px; display: grid; place-items: center; }
    .logo-placement-cell span { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
    .logo-placement-cell:hover, .logo-placement-cell.active, .logo-placement-reset:hover, .logo-placement-advanced-toggle:hover {
      border-color: color-mix(in srgb, var(--accent) 65%, var(--border));
      color: var(--text-primary);
      background: color-mix(in srgb, var(--accent) 12%, var(--surface-soft));
    }
    .logo-placement-advanced-toggle { width: 100%; padding: 8px 10px; text-align: left; }
    .logo-placement-hint { margin: -2px 0 0; line-height: 1.45; }
    .logo-placement-advanced-control { display: none !important; }
    .logo-placement-advanced-open .logo-placement-advanced-control { display: flex !important; }
    .logo-placement-advanced-open .sub-section-title.logo-placement-advanced-control { display: block !important; }
  `
  document.head.appendChild(style)
}

function start(): void {
  installStyles()
  scanEditors()

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof Element) scheduleScan()
      })
    })
  })
  observer.observe(document.body, { childList: true, subtree: true })

  document.addEventListener('change', (event) => {
    if (!(event.target instanceof HTMLElement)) return
    if (!event.target.closest('.editor-shell')) return
    scheduleScan(60)
    window.setTimeout(() => scanEditors(), 250)
  })
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true })
  else start()
}
