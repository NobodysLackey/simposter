const ENHANCED = 'data-logo-placement-ux'
const STYLE_ID = 'simposter-logo-placement-ux-styles'

const POSITION_PRESETS = [
  ['Top Left', 18, 18],
  ['Top Center', 50, 18],
  ['Top Right', 82, 18],
  ['Middle Left', 18, 50],
  ['Center', 50, 50],
  ['Middle Right', 82, 50],
  ['Bottom Left', 18, 82],
  ['Bottom Center', 50, 82],
  ['Bottom Right', 82, 82],
] as const

function installStyles(): void {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    .logo-placement-panel {
      display: grid;
      gap: 12px;
      margin: 14px 0 18px;
      padding: 14px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: color-mix(in srgb, var(--surface-soft) 84%, transparent);
    }
    .logo-placement-panel__heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .logo-placement-panel__heading strong {
      color: var(--text-primary);
      font-size: 13px;
      letter-spacing: .04em;
      text-transform: uppercase;
    }
    .logo-placement-panel__heading span {
      color: var(--text-muted);
      font-size: 11px;
    }
    .logo-placement-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 7px;
    }
    .logo-placement-grid button,
    .logo-placement-reset {
      min-height: 34px;
      padding: 7px 8px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface-soft);
      color: var(--text-secondary);
      cursor: pointer;
      font-size: 11px;
      transition: border-color .16s, color .16s, background .16s;
    }
    .logo-placement-grid button:hover,
    .logo-placement-reset:hover {
      border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
      background: color-mix(in srgb, var(--accent) 10%, var(--surface-soft));
      color: var(--text-primary);
    }
    .logo-placement-advanced {
      margin-top: 14px;
      border-top: 1px solid var(--border);
      padding-top: 12px;
    }
    .logo-placement-advanced summary {
      cursor: pointer;
      color: var(--text-secondary);
      font-size: 12px;
      font-weight: 650;
      letter-spacing: .035em;
      user-select: none;
    }
    .logo-placement-advanced__body {
      display: grid;
      gap: 0;
      padding-top: 14px;
    }
    .logo-placement-help {
      margin: -6px 0 14px;
      color: var(--text-muted);
      font-size: 11px;
      line-height: 1.45;
    }
    @media (max-width: 620px) {
      .logo-placement-grid { grid-template-columns: repeat(3, minmax(72px, 1fr)); overflow-x: auto; }
    }
  `
  document.head.appendChild(style)
}

function normalizedText(element: Element | null): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() || ''
}

function logoSection(editor: HTMLElement): HTMLElement | null {
  const sections = Array.from(editor.querySelectorAll<HTMLElement>('.acc-section'))
  return sections.find((section) => normalizedText(section.querySelector('.acc-header')).startsWith('Logo')) || null
}

function rows(section: HTMLElement): HTMLElement[] {
  return Array.from(section.querySelectorAll<HTMLElement>('.slider, .control-group, .field-group'))
}

function rowByLabel(section: HTMLElement, names: string[]): HTMLElement | null {
  return rows(section).find((row) => {
    const label = normalizedText(row.querySelector('label'))
    return names.some((name) => label.startsWith(name))
  }) || null
}

function inputsForRow(row: HTMLElement | null): HTMLInputElement[] {
  return row ? Array.from(row.querySelectorAll<HTMLInputElement>('input')) : []
}

function setNumericRow(row: HTMLElement | null, value: number): void {
  inputsForRow(row).forEach((input) => {
    const min = input.min === '' ? -Infinity : Number(input.min)
    const max = input.max === '' ? Infinity : Number(input.max)
    const safe = Math.max(min, Math.min(max, value))
    input.value = String(safe)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

function clickAlignment(section: HTMLElement, heading: string, value: string): void {
  const candidates = Array.from(section.querySelectorAll<HTMLElement>('label, .field-label, .control-label'))
  const label = candidates.find((candidate) => normalizedText(candidate).startsWith(heading))
  const container = label?.parentElement || label
  const button = Array.from(container?.querySelectorAll<HTMLButtonElement>('button') || [])
    .find((candidate) => normalizedText(candidate) === value)
  button?.click()
}

function relabel(row: HTMLElement | null, text: string): void {
  const label = row?.querySelector('label')
  if (!label) return
  const textNode = Array.from(label.childNodes).find((node) => node.nodeType === Node.TEXT_NODE)
  if (textNode) textNode.textContent = `${text} `
}

function enhanceEditor(editor: HTMLElement): void {
  if (editor.getAttribute(ENHANCED) === 'true') return
  const section = logoSection(editor)
  const body = section?.querySelector<HTMLElement>('.acc-body')
  if (!section || !body) return

  const scaleRow = rowByLabel(section, ['Scale %', 'Logo Size %'])
  const maxWidthRow = rowByLabel(section, ['Max Width'])
  const maxHeightRow = rowByLabel(section, ['Max Height'])
  const xRow = rowByLabel(section, ['Logo Box X', 'Position X'])
  const yRow = rowByLabel(section, ['Logo Box Y', 'Position Y'])

  if (!scaleRow || !xRow || !yRow) return
  editor.setAttribute(ENHANCED, 'true')

  relabel(scaleRow, 'Logo Size %')
  relabel(xRow, 'Position X %')
  relabel(yRow, 'Position Y %')

  const help = document.createElement('p')
  help.className = 'logo-placement-help'
  help.textContent = 'Logo size is calculated from the visible artwork, so transparent padding no longer changes the result.'
  scaleRow.insertAdjacentElement('afterend', help)

  const panel = document.createElement('div')
  panel.className = 'logo-placement-panel'

  const heading = document.createElement('div')
  heading.className = 'logo-placement-panel__heading'
  const title = document.createElement('strong')
  title.textContent = 'Quick Placement'
  const hint = document.createElement('span')
  hint.textContent = 'Choose a starting point, then fine-tune X and Y.'
  heading.append(title, hint)

  const grid = document.createElement('div')
  grid.className = 'logo-placement-grid'
  POSITION_PRESETS.forEach(([label, x, y]) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = label
    button.addEventListener('click', () => {
      setNumericRow(xRow, x)
      setNumericRow(yRow, y)
      clickAlignment(section, 'Horizontal Align', 'Center')
      clickAlignment(section, 'Vertical Align', 'Center')
    })
    grid.appendChild(button)
  })

  const reset = document.createElement('button')
  reset.type = 'button'
  reset.className = 'logo-placement-reset'
  reset.textContent = 'Reset to Bottom Center'
  reset.addEventListener('click', () => {
    setNumericRow(scaleRow, 100)
    setNumericRow(xRow, 50)
    setNumericRow(yRow, 78)
    clickAlignment(section, 'Horizontal Align', 'Center')
    clickAlignment(section, 'Vertical Align', 'Center')
  })

  panel.append(heading, grid, reset)
  help.insertAdjacentElement('afterend', panel)

  const advanced = document.createElement('details')
  advanced.className = 'logo-placement-advanced'
  const summary = document.createElement('summary')
  summary.textContent = 'Advanced Positioning'
  const advancedBody = document.createElement('div')
  advancedBody.className = 'logo-placement-advanced__body'
  advanced.append(summary, advancedBody)

  if (maxWidthRow) advancedBody.appendChild(maxWidthRow)
  if (maxHeightRow) advancedBody.appendChild(maxHeightRow)

  const alignmentHeadings = Array.from(section.querySelectorAll<HTMLElement>('label, .field-label, .control-label'))
    .filter((candidate) => {
      const text = normalizedText(candidate)
      return text.startsWith('Horizontal Align') || text.startsWith('Vertical Align')
    })
  alignmentHeadings.forEach((label) => {
    const container = label.parentElement || label
    if (!advancedBody.contains(container)) advancedBody.appendChild(container)
  })

  yRow.insertAdjacentElement('afterend', advanced)
}

function scan(root: ParentNode = document): void {
  if (root instanceof HTMLElement && root.matches('.editor-shell')) enhanceEditor(root)
  root.querySelectorAll<HTMLElement>('.editor-shell').forEach(enhanceEditor)
}

function start(): void {
  installStyles()
  scan()
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof Element) scan(node)
      })
    })
  })
  observer.observe(document.body, { childList: true, subtree: true })
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true })
  else start()
}
