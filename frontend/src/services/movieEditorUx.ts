const STYLE_ID = 'simposter-movie-editor-ux-styles'
const LOGO_MAX_WIDTH = 3000

const installStyles = () => {
  if (document.getElementById(STYLE_ID)) return

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    @media (min-width: 901px) {
      .workspace:has(.editor-shell) {
        min-height: 0 !important;
        height: var(--simposter-editor-workspace-height) !important;
        flex: none !important;
        overflow: hidden !important;
      }

      .main-pane:has(.editor-shell) {
        box-sizing: border-box !important;
        min-height: 0 !important;
        height: 100% !important;
        overflow: hidden !important;
      }

      .editor-shell {
        min-height: 0 !important;
        max-height: 100% !important;
        height: 100% !important;
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

const fitEditorWorkspaceToViewport = () => {
  const shells = Array.from(document.querySelectorAll<HTMLElement>('.editor-shell'))

  shells.forEach((shell) => {
    const workspace = shell.closest<HTMLElement>('.workspace')
    if (!workspace) return

    if (window.innerWidth <= 900) {
      workspace.style.removeProperty('--simposter-editor-workspace-height')
      return
    }

    const viewportHeight = document.documentElement.clientHeight
    const workspaceTop = workspace.getBoundingClientRect().top
    const bodyBottomPadding = Number.parseFloat(getComputedStyle(document.body).paddingBottom) || 0
    const availableHeight = Math.max(1, Math.floor(viewportHeight - workspaceTop - bodyBottomPadding))

    workspace.style.setProperty('--simposter-editor-workspace-height', `${availableHeight}px`)
  })
}

let scheduled = false
const run = () => {
  scheduled = false
  updateLogoWidthRange()
  fitEditorWorkspaceToViewport()
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
