type CoverQuality = 'low' | 'medium' | 'high'

const STYLE_ID = 'simposter-audiobook-cover-quality-styles'
const BOUND_ATTRIBUTE = 'data-cover-quality-bound'
const EDITOR_DEFAULTS_ATTRIBUTE = 'data-audiobook-editor-defaults-applied'

function classifyResolution(width: number, height: number): CoverQuality {
  const limitingDimension = Math.min(width, height)
  if (limitingDimension >= 1200) return 'high'
  if (limitingDimension >= 700) return 'medium'
  return 'low'
}

function qualityDescription(quality: CoverQuality): string {
  if (quality === 'high') return 'High-resolution source'
  if (quality === 'medium') return 'Medium-resolution source; moderate upscaling required'
  return 'Low-resolution source; substantial upscaling required'
}

function installStyles(): void {
  if (document.getElementById(STYLE_ID)) return

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    .cover-resolution-corner {
      position: absolute;
      top: 0;
      right: 0;
      z-index: 5;
      width: 0;
      height: 0;
      border-left: 28px solid transparent;
      pointer-events: none;
      filter: drop-shadow(-1px 1px 1px rgba(0, 0, 0, .45));
    }
    .cover-resolution-corner.quality-high { border-top: 28px solid #36c76c; }
    .cover-resolution-corner.quality-medium { border-top: 28px solid #f1c84b; }
    .cover-resolution-corner.quality-low { border-top: 28px solid #ef5a5a; }
  `
  document.head.appendChild(style)
}

function decorateImage(image: HTMLImageElement): void {
  if (image.getAttribute(BOUND_ATTRIBUTE) === 'true') return
  image.setAttribute(BOUND_ATTRIBUTE, 'true')

  const applyResolution = (): void => {
    const button = image.closest<HTMLButtonElement>('.cover-thumb')
    if (!button || image.naturalWidth <= 0 || image.naturalHeight <= 0) return

    const width = image.naturalWidth
    const height = image.naturalHeight
    const quality = classifyResolution(width, height)
    const description = qualityDescription(quality)

    button.querySelector('.cover-resolution-corner')?.remove()

    const corner = document.createElement('span')
    corner.className = `cover-resolution-corner quality-${quality}`
    corner.setAttribute('aria-hidden', 'true')
    button.appendChild(corner)

    if (!button.dataset.coverBaseTitle) {
      button.dataset.coverBaseTitle = button.title || 'Audiobook cover option'
    }
    button.title = `${button.dataset.coverBaseTitle} · ${width}×${height}px · ${description}`
    button.dataset.coverWidth = String(width)
    button.dataset.coverHeight = String(height)
    button.dataset.coverQuality = quality
  }

  if (image.complete && image.naturalWidth > 0) {
    applyResolution()
  } else {
    image.addEventListener('load', applyResolution, { once: true })
  }
}

function scanCoverImages(root: ParentNode = document): void {
  root.querySelectorAll<HTMLImageElement>('.cover-thumb img').forEach(decorateImage)
}

function setAccordionDefault(
  editor: Element,
  sectionName: string,
  shouldBeOpen: boolean,
): void {
  const sections = editor.querySelectorAll<HTMLElement>('.acc-section')
  sections.forEach((section) => {
    const header = section.querySelector<HTMLButtonElement>('.acc-header')
    if (!header) return

    const label = header.textContent?.replace(/\s+/g, ' ').trim() || ''
    if (!label.startsWith(sectionName)) return

    const isOpen = header.querySelector('.chevron')?.classList.contains('open') ?? false
    if (isOpen !== shouldBeOpen) header.click()
  })
}

function configureShiftRange(editor: Element): void {
  editor.querySelectorAll<HTMLElement>('.slider').forEach((slider) => {
    const label = slider.querySelector('label')?.textContent?.trim()
    if (label !== 'Cover Shift Y %') return

    slider.querySelectorAll<HTMLInputElement>('input').forEach((input) => {
      input.min = '-100'
      input.max = '100'
    })
  })
}

function configureAudiobookEditor(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('.editor-shell').forEach((editor) => {
    const kicker = editor.querySelector('.kicker')?.textContent?.trim()
    if (kicker !== 'Editing Audiobook') return

    configureShiftRange(editor)

    if (editor.getAttribute(EDITOR_DEFAULTS_ATTRIBUTE) === 'true') return
    editor.setAttribute(EDITOR_DEFAULTS_ATTRIBUTE, 'true')

    // Apply only once per editor instance so later user toggles remain untouched.
    requestAnimationFrame(() => {
      setAccordionDefault(editor, 'Book Metadata', true)
      setAccordionDefault(editor, 'Logo', false)
      configureShiftRange(editor)
    })
  })
}

function scan(root: ParentNode = document): void {
  scanCoverImages(root)
  configureAudiobookEditor(root)
}

function startAudiobookUiObserver(): void {
  installStyles()
  scan()

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return
        if (node.matches('.cover-thumb img')) decorateImage(node as HTMLImageElement)
        scan(node)
      })
    })
  })

  observer.observe(document.body, { childList: true, subtree: true })
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startAudiobookUiObserver, { once: true })
  } else {
    startAudiobookUiObserver()
  }
}
