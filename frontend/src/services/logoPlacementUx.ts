type VueComponentInstance = {
  parent?: VueComponentInstance | null
  props?: Record<string, any>
  setupState?: Record<string, any>
}

type PlacementMode = 'uniform' | 'basic'

type CanvasMetrics = {
  width: number
  height: number
  safeWidth: number
  safeHeight: number
}

type LogoControls = {
  section: HTMLElement
  body: HTMLElement
  mode: PlacementMode
  options: Record<string, any>
  scaleControl: HTMLElement | null
  maxWidthControl: HTMLElement | null
  maxHeightControl: HTMLElement | null
  xControl: HTMLElement | null
  yControl: HTMLElement | null
  hAlignControl: HTMLElement | null
  vAlignControl: HTMLElement | null
  heading: HTMLElement | null
}

const STYLE_ID = 'simposter-logo-placement-styles'
const PANEL_CLASS = 'logo-placement-panel'
const ADVANCED_CLASS = 'logo-placement-advanced-control'
const PRESET_BOUND_ATTRIBUTE = 'data-logo-placement-preset-bound'

let scanTimer: number | null = null

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}

function normalizedText(value: string | null | undefined): string {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function scheduleScan(): void {
  if (scanTimer !== null) window.clearTimeout(scanTimer)
  scanTimer = window.setTimeout(() => {
    scanTimer = null
    scanEditors()
  }, 45)
}

function readSetupValue(state: Record<string, any>, key: string): unknown {
  const current = state[key]
  if (current && typeof current === 'object' && 'value' in current) return current.value
  return current
}

function componentInstance(editor: HTMLElement): VueComponentInstance | null {
  const element = editor as HTMLElement & { __vueParentComponent?: VueComponentInstance }
  let instance = element.__vueParentComponent || null

  while (instance) {
    const state = instance.setupState
    const props = instance.props
    if (state && readSetupValue(state, 'options') && (props?.movie?.key || props?.audiobook?.key)) {
      return instance
    }
    instance = instance.parent || null
  }

  return null
}

function editorIsAudiobook(editor: HTMLElement): boolean {
  return normalizedText(editor.querySelector('.kicker')?.textContent) === 'Editing Audiobook'
}

function canvasMetrics(editor: HTMLElement): CanvasMetrics {
  const height = editorIsAudiobook(editor) ? 2000 : 3000
  const width = 2000
  return {
    width,
    height,
    safeWidth: Math.round(width * 0.72),
    safeHeight: Math.round(height * 0.28),
  }
}

function findLogoSection(editor: HTMLElement): HTMLElement | null {
  const sections = Array.from(editor.querySelectorAll<HTMLElement>('.acc-section'))
  return sections.find((section) => {
    const heading = normalizedText(section.querySelector('.acc-header')?.textContent)
    return heading.startsWith('Logo')
  }) || null
}

function controlLabel(control: HTMLElement): string {
  const label = control.querySelector('label')
  return normalizedText(label?.textContent || control.childNodes[0]?.textContent)
}

function findSlider(body: HTMLElement, labels: string[]): HTMLElement | null {
  const wanted = labels.map((label) => label.toLowerCase())
  return Array.from(body.querySelectorAll<HTMLElement>('.slider')).find((slider) =>
    wanted.includes(controlLabel(slider).toLowerCase()),
  ) || null
}

function findField(body: HTMLElement, labels: string[]): HTMLElement | null {
  const wanted = labels.map((label) => label.toLowerCase())
  return Array.from(body.querySelectorAll<HTMLElement>('.field-label, .slider')).find((field) =>
    wanted.includes(controlLabel(field).toLowerCase()),
  ) || null
}

function getOptions(editor: HTMLElement): Record<string, any> | null {
  const state = componentInstance(editor)?.setupState
  if (!state) return null
  const value = readSetupValue(state, 'options')
  return value && typeof value === 'object' ? value as Record<string, any> : null
}

function placementMode(editor: HTMLElement): PlacementMode {
  if (editorIsAudiobook(editor)) return 'uniform'
  const state = componentInstance(editor)?.setupState
  const selectedTemplate = state ? String(readSetupValue(state, 'selectedTemplate') || '') : ''
  return selectedTemplate === 'uniformlogo' ? 'uniform' : 'basic'
}

function collectControls(editor: HTMLElement): LogoControls | null {
  const section = findLogoSection(editor)
  const body = section?.querySelector<HTMLElement>('.acc-body') || null
  const options = getOptions(editor)
  if (!section || !body || !options) return null

  const mode = placementMode(editor)
  const scaleControl = findSlider(body, ['Scale %', 'Logo Scale %'])
  const maxWidthControl = findSlider(body, ['Max Width (px)'])
  const maxHeightControl = findSlider(body, ['Max Height (px)'])
  const xControl = findSlider(body, ['Logo Box X %'])
  const yControl = findSlider(body, ['Logo Box Y %', 'Logo Position %'])
  const hAlignControl = findField(body, ['Horizontal Align'])
  const vAlignControl = findField(body, ['Vertical Align'])
  const heading = Array.from(body.querySelectorAll<HTMLElement>('.sub-section-title')).find((item) =>
    normalizedText(item.textContent) === 'Position & Size',
  ) || null

  if (mode === 'uniform' && (!maxWidthControl || !maxHeightControl || !xControl || !yControl)) return null
  if (mode === 'basic' && (!scaleControl || !yControl)) return null

  return {
    section,
    body,
    mode,
    options,
    scaleControl,
    maxWidthControl,
    maxHeightControl,
    xControl,
    yControl,
    hAlignControl,
    vAlignControl,
    heading,
  }
}

function numericOption(options: Record<string, any>, key: string, fallback: number): number {
  const value = Number(options[key])
  return Number.isFinite(value) ? value : fallback
}

function deriveValues(editor: HTMLElement, controls: LogoControls): { size: number; x: number; y: number } {
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

function applyValues(
  editor: HTMLElement,
  controls: LogoControls,
  size: number,
  x: number,
  y: number,
): void {
  const metrics = canvasMetrics(editor)
  const options = controls.options

  if (controls.mode === 'uniform') {
    options.uniformLogoMaxW = metrics.safeWidth
    options.uniformLogoMaxH = metrics.safeHeight
    options.logoScale = clamp(Math.round(size), 10, 220)
    options.uniformLogoOffsetX = clamp(Math.round(x), 0, 100)
    options.uniformLogoOffsetY = clamp(Math.round(y), 0, 100)
    options.uniformLogoHAlign = 'center'
    options.uniformLogoVAlign = 'center'
  } else {
    options.logoScale = clamp(Math.round(size * 0.7), 10, 100)
    options.logoOffset = clamp(Math.round(y), 0, 100)
  }
}

function placementCoordinates(size: number, column: number, row: number): { x: number; y: number } {
  const sizeFactor = clamp(size / 100, 0.1, 2.2)
  const halfWidth = clamp(36 * sizeFactor, 4, 45)
  const halfHeight = clamp(14 * sizeFactor, 3, 42)
  const margin = 4

  const xValues = [halfWidth + margin, 50, 100 - halfWidth - margin]
  const yValues = [halfHeight + margin, 50, 100 - halfHeight - margin]

  return {
    x: Math.round(clamp(xValues[column] ?? 50, 0, 100)),
    y: Math.round(clamp(yValues[row] ?? 50, 0, 100)),
  }
}

function createNumberRange(
  labelText: string,
  value: number,
  minimum: number,
  maximum: number,
): { wrapper: HTMLElement; range: HTMLInputElement; number: HTMLInputElement } {
  const wrapper = document.createElement('div')
  wrapper.className = 'logo-placement-slider'

  const label = document.createElement('label')
  label.textContent = labelText

  const row = document.createElement('div')
  row.className = 'logo-placement-slider-row'

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

function setPairValue(range: HTMLInputElement, number: HTMLInputElement, value: number): void {
  const normalized = String(Math.round(value))
  range.value = normalized
  number.value = normalized
}

function markAdvancedControls(controls: LogoControls): void {
  const candidates = [
    controls.heading,
    controls.scaleControl,
    controls.maxWidthControl,
    controls.maxHeightControl,
    controls.xControl,
    controls.yControl,
    controls.hAlignControl,
    controls.vAlignControl,
  ]

  candidates.forEach((candidate) => candidate?.classList.add(ADVANCED_CLASS))
}

function bindRawControlSync(editor: HTMLElement, panel: HTMLElement): void {
  const rawControls = panel.parentElement?.querySelectorAll<HTMLElement>(`.${ADVANCED_CLASS}`)
  rawControls?.forEach((control) => {
    control.querySelectorAll<HTMLInputElement>('input').forEach((input) => {
      if (input.dataset.logoPlacementSyncBound === 'true') return
      input.dataset.logoPlacementSyncBound = 'true'
      input.addEventListener('input', () => window.setTimeout(() => syncPanel(editor), 0))
    })
    control.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
      if (button.dataset.logoPlacementSyncBound === 'true') return
      button.dataset.logoPlacementSyncBound = 'true'
      button.addEventListener('click', () => window.setTimeout(() => syncPanel(editor), 0))
    })
  })
}

function syncPanel(editor: HTMLElement): void {
  const controls = collectControls(editor)
  const panel = controls?.body.querySelector<HTMLElement>(`.${PANEL_CLASS}`)
  if (!controls || !panel) return

  const values = deriveValues(editor, controls)
  const sizeRange = panel.querySelector<HTMLInputElement>('[data-logo-field="size-range"]')
  const sizeNumber = panel.querySelector<HTMLInputElement>('[data-logo-field="size-number"]')
  const xRange = panel.querySelector<HTMLInputElement>('[data-logo-field="x-range"]')
  const xNumber = panel.querySelector<HTMLInputElement>('[data-logo-field="x-number"]')
  const yRange = panel.querySelector<HTMLInputElement>('[data-logo-field="y-range"]')
  const yNumber = panel.querySelector<HTMLInputElement>('[data-logo-field="y-number"]')

  if (sizeRange && sizeNumber) setPairValue(sizeRange, sizeNumber, values.size)
  if (xRange && xNumber) setPairValue(xRange, xNumber, values.x)
  if (yRange && yNumber) setPairValue(yRange, yNumber, values.y)
}

function createPlacementPanel(editor: HTMLElement, controls: LogoControls): HTMLElement {
  const values = deriveValues(editor, controls)
  const panel = document.createElement('div')
  panel.className = PANEL_CLASS
  panel.dataset.mode = controls.mode

  const heading = document.createElement('div')
  heading.className = 'logo-placement-heading'
  const title = document.createElement('div')
  title.innerHTML = '<strong>Logo Placement</strong><span>Transparent padding is ignored automatically.</span>'
  const resetButton = document.createElement('button')
  resetButton.type = 'button'
  resetButton.className = 'logo-placement-reset'
  resetButton.textContent = 'Reset'
  heading.append(title, resetButton)

  const sizeField = createNumberRange('Logo Size %', values.size, controls.mode === 'uniform' ? 10 : 15, controls.mode === 'uniform' ? 220 : 140)
  sizeField.range.dataset.logoField = 'size-range'
  sizeField.number.dataset.logoField = 'size-number'

  const xField = createNumberRange('Horizontal Position %', values.x, 0, 100)
  xField.range.dataset.logoField = 'x-range'
  xField.number.dataset.logoField = 'x-number'
  if (controls.mode === 'basic') xField.wrapper.hidden = true

  const yField = createNumberRange('Vertical Position %', values.y, 0, 100)
  yField.range.dataset.logoField = 'y-range'
  yField.number.dataset.logoField = 'y-number'

  const placementBlock = document.createElement('div')
  placementBlock.className = 'logo-placement-block'
  const placementLabel = document.createElement('span')
  placementLabel.className = 'logo-placement-label'
  placementLabel.textContent = 'Quick Placement'
  placementBlock.appendChild(placementLabel)

  const grid = document.createElement('div')
  grid.className = controls.mode === 'uniform' ? 'logo-placement-grid' : 'logo-placement-grid vertical-only'
  const names = [
    ['Top left', 'Top center', 'Top right'],
    ['Middle left', 'Center', 'Middle right'],
    ['Bottom left', 'Bottom center', 'Bottom right'],
  ]

  ;[0, 1, 2].forEach((row) => {
    const columns = controls.mode === 'uniform' ? [0, 1, 2] : [1]
    columns.forEach((column) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'logo-placement-cell'
      button.title = names[row]?.[column] || 'Place logo'
      button.setAttribute('aria-label', button.title)
      button.dataset.row = String(row)
      button.dataset.column = String(column)
      const dot = document.createElement('span')
      button.appendChild(dot)
      grid.appendChild(button)
    })
  })
  placementBlock.appendChild(grid)

  const advancedButton = document.createElement('button')
  advancedButton.type = 'button'
  advancedButton.className = 'logo-placement-advanced-toggle'
  advancedButton.textContent = 'Advanced Positioning'

  const hint = document.createElement('p')
  hint.className = 'logo-placement-hint'
  hint.textContent = controls.mode === 'uniform'
    ? 'Size is based on the visible logo artwork, not the original image canvas.'
    : 'This template centers logos horizontally. Choose Uniform Logo for horizontal placement controls.'

  panel.append(heading, sizeField.wrapper, xField.wrapper, yField.wrapper, placementBlock, advancedButton, hint)

  const readPanelValues = (): { size: number; x: number; y: number } => ({
    size: Number(sizeField.number.value || sizeField.range.value || values.size),
    x: Number(xField.number.value || xField.range.value || values.x),
    y: Number(yField.number.value || yField.range.value || values.y),
  })

  const applyPanelValues = (clearPlacement = true): void => {
    const next = readPanelValues()
    setPairValue(sizeField.range, sizeField.number, next.size)
    setPairValue(xField.range, xField.number, next.x)
    setPairValue(yField.range, yField.number, next.y)
    if (clearPlacement) panel.dataset.placement = ''
    applyValues(editor, controls, next.size, next.x, next.y)
  }

  ;[
    [sizeField.range, sizeField.number],
    [xField.range, xField.number],
    [yField.range, yField.number],
  ].forEach(([range, number]) => {
    range.addEventListener('input', () => {
      number.value = range.value
      applyPanelValues(range !== sizeField.range)
      if (range === sizeField.range && panel.dataset.placement) {
        const [row, column] = panel.dataset.placement.split(':').map(Number)
        const next = placementCoordinates(Number(range.value), column, row)
        setPairValue(xField.range, xField.number, next.x)
        setPairValue(yField.range, yField.number, next.y)
        applyPanelValues(false)
      }
    })
    number.addEventListener('input', () => {
      range.value = number.value
      applyPanelValues(number !== sizeField.number)
      if (number === sizeField.number && panel.dataset.placement) {
        const [row, column] = panel.dataset.placement.split(':').map(Number)
        const next = placementCoordinates(Number(number.value), column, row)
        setPairValue(xField.range, xField.number, next.x)
        setPairValue(yField.range, yField.number, next.y)
        applyPanelValues(false)
      }
    })
  })

  grid.querySelectorAll<HTMLButtonElement>('.logo-placement-cell').forEach((button) => {
    button.addEventListener('click', () => {
      const row = Number(button.dataset.row || 1)
      const column = Number(button.dataset.column || 1)
      const next = placementCoordinates(Number(sizeField.number.value), column, row)
      setPairValue(xField.range, xField.number, next.x)
      setPairValue(yField.range, yField.number, next.y)
      panel.dataset.placement = `${row}:${column}`
      grid.querySelectorAll('.logo-placement-cell').forEach((item) => item.classList.remove('active'))
      button.classList.add('active')
      applyPanelValues(false)
    })
  })

  resetButton.addEventListener('click', () => {
    setPairValue(sizeField.range, sizeField.number, 100)
    setPairValue(xField.range, xField.number, 50)
    setPairValue(yField.range, yField.number, 78)
    panel.dataset.placement = ''
    grid.querySelectorAll('.logo-placement-cell').forEach((item) => item.classList.remove('active'))
    applyPanelValues(false)
  })

  advancedButton.addEventListener('click', () => {
    const open = controls.body.dataset.logoPlacementAdvanced !== 'true'
    controls.body.dataset.logoPlacementAdvanced = String(open)
    advancedButton.textContent = open ? 'Hide Advanced Positioning' : 'Advanced Positioning'
  })

  applyValues(editor, controls, values.size, values.x, values.y)
  return panel
}

function bindPresetRefresh(editor: HTMLElement): void {
  const select = Array.from(editor.querySelectorAll<HTMLSelectElement>('select')).find((candidate) => {
    const label = candidate.closest('.field-label')
    return normalizedText(label?.childNodes[0]?.textContent) === 'Preset'
  })
  if (!select || select.getAttribute(PRESET_BOUND_ATTRIBUTE) === 'true') return
  select.setAttribute(PRESET_BOUND_ATTRIBUTE, 'true')
  select.addEventListener('change', () => window.setTimeout(() => {
    const panel = findLogoSection(editor)?.querySelector(`.${PANEL_CLASS}`)
    panel?.remove()
    scheduleScan()
  }, 80))
}

function enhanceEditor(editor: HTMLElement): void {
  const controls = collectControls(editor)
  if (!controls) return

  const existing = controls.body.querySelector<HTMLElement>(`.${PANEL_CLASS}`)
  if (existing?.dataset.mode === controls.mode) {
    bindRawControlSync(editor, existing)
    bindPresetRefresh(editor)
    return
  }
  existing?.remove()

  markAdvancedControls(controls)
  controls.body.dataset.logoPlacementAdvanced = 'false'
  const panel = createPlacementPanel(editor, controls)
  const anchor = controls.heading || controls.scaleControl || controls.maxWidthControl || controls.yControl
  if (anchor) controls.body.insertBefore(panel, anchor)
  else controls.body.appendChild(panel)

  bindRawControlSync(editor, panel)
  bindPresetRefresh(editor)
}

function scanEditors(): void {
  document.querySelectorAll<HTMLElement>('.editor-shell').forEach(enhanceEditor)
}

function installStyles(): void {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    .logo-placement-panel {
      display: grid;
      gap: 12px;
      margin: 14px 0;
      padding: 13px;
      border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--border));
      border-radius: 11px;
      background: color-mix(in srgb, var(--accent) 4%, rgba(255,255,255,.018));
    }
    .logo-placement-heading {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
    }
    .logo-placement-heading strong {
      display: block;
      color: var(--text-primary);
      font-size: 13px;
    }
    .logo-placement-heading span {
      display: block;
      margin-top: 3px;
      color: var(--text-muted);
      font-size: 10px;
      line-height: 1.35;
    }
    .logo-placement-reset,
    .logo-placement-advanced-toggle {
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface-soft);
      color: var(--text-secondary);
      cursor: pointer;
    }
    .logo-placement-reset { padding: 5px 8px; font-size: 10px; }
    .logo-placement-advanced-toggle { width: 100%; padding: 8px 10px; font-size: 11px; }
    .logo-placement-slider { display: grid; gap: 6px; }
    .logo-placement-slider > label,
    .logo-placement-label {
      color: var(--text-secondary);
      font-size: 11px;
      font-weight: 600;
    }
    .logo-placement-slider-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 70px;
      gap: 9px;
      align-items: center;
    }
    .logo-placement-slider-row input[type='range'] { width: 100%; accent-color: var(--accent); }
    .logo-placement-slider-row input[type='number'] {
      width: 100%;
      padding: 7px 8px;
      border: 1px solid var(--border);
      border-radius: 7px;
      background: var(--surface-soft);
      color: var(--text-primary);
      text-align: center;
    }
    .logo-placement-block { display: grid; gap: 7px; }
    .logo-placement-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 5px;
      max-width: 174px;
    }
    .logo-placement-grid.vertical-only { grid-template-columns: repeat(3, 1fr); }
    .logo-placement-grid.vertical-only .logo-placement-cell:nth-child(1),
    .logo-placement-grid.vertical-only .logo-placement-cell:nth-child(2),
    .logo-placement-grid.vertical-only .logo-placement-cell:nth-child(3) { grid-column: 2; }
    .logo-placement-cell {
      position: relative;
      height: 35px;
      border: 1px solid var(--border);
      border-radius: 7px;
      background: rgba(255,255,255,.025);
      cursor: pointer;
    }
    .logo-placement-cell span {
      position: absolute;
      left: 50%;
      top: 50%;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--text-muted);
      transform: translate(-50%, -50%);
    }
    .logo-placement-cell:hover,
    .logo-placement-cell.active {
      border-color: color-mix(in srgb, var(--accent) 68%, var(--border));
      background: color-mix(in srgb, var(--accent) 12%, transparent);
    }
    .logo-placement-cell:hover span,
    .logo-placement-cell.active span { background: var(--accent); box-shadow: 0 0 9px color-mix(in srgb, var(--accent) 52%, transparent); }
    .logo-placement-hint {
      margin: -3px 0 0;
      color: var(--text-muted);
      font-size: 10px;
      line-height: 1.45;
    }
    .logo-placement-advanced-control { display: none !important; }
    .acc-body[data-logo-placement-advanced='true'] .logo-placement-advanced-control { display: flex !important; }
    .acc-body[data-logo-placement-advanced='true'] .sub-section-title.logo-placement-advanced-control { display: block !important; }
  `
  document.head.appendChild(style)
}

function start(): void {
  installStyles()
  scanEditors()

  const observer = new MutationObserver(() => scheduleScan())
  observer.observe(document.body, { childList: true, subtree: true })
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true })
  else start()
}
