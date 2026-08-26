const STYLE_ID = 'simposter-editor-action-layout-styles'
const STACK_CLASS = 'simposter-actions-stacked'

const STANDARD_EDITOR = '.editor-shell:not(:has(> .season-panel))'

const installStyles = () => {
  if (document.getElementById(STYLE_ID)) return

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    /* Movies, Anime, and Audiobooks share the standard two-region editor
       behavior. TV has its own three-column composition and is intentionally
       excluded from this service. */
    ${STANDARD_EDITOR} .preview-pane {
      container-type: inline-size;
      min-width: 0 !important;
      overflow-x: hidden !important;
    }

    ${STANDARD_EDITOR} .preview-inner,
    ${STANDARD_EDITOR} .preview-content-wrapper,
    ${STANDARD_EDITOR} .preview-main {
      min-width: 0 !important;
      max-width: 100% !important;
      box-sizing: border-box;
    }

    ${STANDARD_EDITOR} .preview-main > .preview-label {
      width: 100% !important;
      align-self: stretch !important;
      box-sizing: border-box;
    }

    ${STANDARD_EDITOR} .preview-label {
      min-width: 0;
      flex-wrap: nowrap !important;
      align-items: center;
    }

    ${STANDARD_EDITOR} .preview-actions {
      min-width: 0;
      max-width: 100%;
      display: flex !important;
      flex-direction: row;
      flex-wrap: nowrap !important;
      align-items: center;
      justify-content: flex-end !important;
      gap: 8px !important;
      margin-left: auto !important;
      margin-top: 0 !important;
    }

    ${STANDARD_EDITOR} .preview-actions .btn-inline {
      width: auto !important;
      min-width: 0;
      max-width: none;
      white-space: nowrap;
      justify-content: center;
    }

    ${STANDARD_EDITOR} .preview-label.${STACK_CLASS} {
      align-items: flex-start !important;
    }

    ${STANDARD_EDITOR} .preview-label.${STACK_CLASS} .preview-actions {
      flex-direction: column;
      align-items: stretch;
      justify-content: flex-start !important;
      width: auto !important;
      max-width: 180px !important;
      gap: 7px !important;
    }

    ${STANDARD_EDITOR} .preview-label.${STACK_CLASS} .preview-actions .btn-inline {
      width: auto !important;
      min-width: 140px;
      max-width: 180px;
    }

    @container (max-width: 760px) {
      ${STANDARD_EDITOR} .preview-inner {
        display: flex !important;
        flex-direction: column !important;
        align-items: stretch !important;
        justify-content: flex-start !important;
        width: 100% !important;
        max-width: 660px !important;
        gap: 22px !important;
        margin-inline: auto !important;
      }

      ${STANDARD_EDITOR} .preview-content-wrapper {
        order: 1;
        flex: 0 1 auto !important;
        width: 100% !important;
        max-width: 100% !important;
        align-self: stretch !important;
      }

      ${STANDARD_EDITOR} .preview-inner > .preview-main {
        order: 1;
      }

      ${STANDARD_EDITOR} .preview-main {
        flex: 0 1 auto !important;
        width: 100% !important;
        max-width: 100% !important;
        align-self: stretch !important;
        justify-self: stretch;
      }

      ${STANDARD_EDITOR} .preview-existing {
        order: 2;
        display: block !important;
        flex: 0 0 auto !important;
        width: min(260px, 100%) !important;
        max-width: 260px !important;
        align-self: center !important;
        justify-self: center;
      }

      ${STANDARD_EDITOR} .preview-container {
        width: min(100%, 620px) !important;
        max-width: 100% !important;
        margin-inline: auto !important;
      }
    }

    @container (max-width: 360px) {
      ${STANDARD_EDITOR} .preview-label.${STACK_CLASS} {
        display: flex !important;
        flex-direction: column;
        align-items: stretch !important;
        gap: 8px;
      }

      ${STANDARD_EDITOR} .preview-label.${STACK_CLASS} .preview-actions {
        width: 100% !important;
        max-width: none !important;
        margin-left: 0 !important;
      }

      ${STANDARD_EDITOR} .preview-label.${STACK_CLASS} .preview-actions .btn-inline {
        width: 100% !important;
        min-width: 0;
        max-width: none;
      }
    }
  `

  document.head.appendChild(style)
}

const measureNaturalWidth = (label: HTMLElement) => {
  const clone = label.cloneNode(true) as HTMLElement
  clone.classList.remove(STACK_CLASS)
  clone.style.position = 'absolute'
  clone.style.left = '-10000px'
  clone.style.top = '-10000px'
  clone.style.width = 'max-content'
  clone.style.maxWidth = 'none'
  clone.style.display = 'flex'
  clone.style.flexWrap = 'nowrap'
  clone.style.alignItems = 'center'
  clone.style.visibility = 'hidden'
  clone.style.pointerEvents = 'none'

  const actions = clone.querySelector<HTMLElement>('.preview-actions')
  if (actions) {
    actions.style.display = 'flex'
    actions.style.flexDirection = 'row'
    actions.style.flexWrap = 'nowrap'
    actions.style.width = 'max-content'
    actions.style.maxWidth = 'none'
    actions.style.marginLeft = '0'
    actions.style.marginTop = '0'
  }

  document.body.appendChild(clone)
  const width = clone.getBoundingClientRect().width
  clone.remove()
  return width
}

const evaluateLabel = (label: HTMLElement) => {
  const editor = label.closest<HTMLElement>('.editor-shell')
  if (!editor || editor.querySelector(':scope > .season-panel')) return

  const actions = label.querySelector<HTMLElement>('.preview-actions')
  if (!actions) return

  label.classList.remove(STACK_CLASS)

  const availableWidth = label.getBoundingClientRect().width
  if (availableWidth <= 0) return

  const naturalWidth = measureNaturalWidth(label)
  if (naturalWidth > availableWidth - 2) label.classList.add(STACK_CLASS)
}

let scheduled = false
const observedLabels = new WeakSet<HTMLElement>()
const observedPanes = new WeakSet<HTMLElement>()
const resizeObserver =
  typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => schedule()) : null

const run = () => {
  scheduled = false

  document
    .querySelectorAll<HTMLElement>(`${STANDARD_EDITOR} .preview-pane`)
    .forEach((pane) => {
      if (resizeObserver && !observedPanes.has(pane)) {
        observedPanes.add(pane)
        resizeObserver.observe(pane)
      }
    })

  document
    .querySelectorAll<HTMLElement>(`${STANDARD_EDITOR} .preview-label`)
    .forEach((label) => {
      if (!label.querySelector('.preview-actions')) return

      if (resizeObserver && !observedLabels.has(label)) {
        observedLabels.add(label)
        resizeObserver.observe(label)
      }

      evaluateLabel(label)
    })
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
  observer.observe(document.body, { childList: true, subtree: true, characterData: true })

  window.addEventListener('resize', schedule)
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true })
  } else {
    start()
  }
}
