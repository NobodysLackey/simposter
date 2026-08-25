const STYLE_ID = 'simposter-movie-editor-ux-styles'
const LOGO_MAX_WIDTH = 3000
const EDITOR_BOTTOM_GAP = 12

const installStyles = () => {
  if (document.getElementById(STYLE_ID)) return

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    @media (min-width: 901px) {
      .main-pane:has(.editor-shell) {
        overflow: hidden !important;
      }

      .editor-shell {
        min-height: 0 !important;
        max-height: var(--simposter-editor-available-height) !important;
        height: var(--simposter-editor-available-height) !important;
      }

      .editor-shell .controls-sidebar,
      .editor-shell .preview-pane {
        min-height: 0 !important;
        max-height: 100% !important;
      }

      .editor-shell .controls-scroll {
        min-height: 0 !important;
        overflow-y: auto !important;
      }

      .editor-shell .preview-pane {
        overflow: hidden !important;
      }
    }
  `
  document.head.appendChild(style)
}

const updateLogoWidthRange = () => {
  const sliders = Array.from(document.querySelectorAll<HTMLElement>('.editor-shell .slider'))

  sliders.forEach((slider) => {
    const label = slider.querySelector('label')?.textContent?.trim()
    if (label !== 'Max Width (px)') return

    const inputs = slider.querySelectorAll<HTMLInputElement>('input[type="range"], input[type="number"]')
    inputs.forEach((input) => {
      if (input.max !== String(LOGO_MAX_WIDTH)) {
        input.max = String(LOGO_MAX_WIDTH)
      }
    })
  })
}

const fitEditorToViewport = () => {
  const shells = Array.from(document.querySelectorAll<HTMLElement>('.editor-shell'))

  shells.forEach((shell) => {
    if (window.innerWidth <= 900) {
      shell.style.removeProperty('--simposter-editor-available-height')
      return
    }

    const top = shell.getBoundingClientRect().top
    const availableHeight = Math.max(1, Math.floor(window.innerHeight - top - EDITOR_BOTTOM_GAP))
    shell.style.setProperty('--simposter-editor-available-height', `${availableHeight}px`)
  })
}

let scheduled = false
const run = () => {
  scheduled = false
  updateLogoWidthRange()
  fitEditorToViewport()
}

const schedule = () => {
  if (scheduled) return
  scheduled = true
  window.requestAnimationFrame(run)
}

const start = () => {
  installStyles()
  schedule()

  const observer = new MutationObserver(() => schedule())
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  })

  window.addEventListener('resize', schedule)
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true })
  } else {
    start()
  }
}
