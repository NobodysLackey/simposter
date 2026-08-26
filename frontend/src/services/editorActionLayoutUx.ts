const STYLE_ID = 'simposter-editor-action-layout-styles'
const STACK_CLASS = 'simposter-actions-stacked'

const installStyles = () => {
  if (document.getElementById(STYLE_ID)) return

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    /* The preview pane owns editor responsiveness. The browser can still be
       wide while the sidebar leaves this pane narrow, so viewport breakpoints
       are not reliable here. */
    .editor-shell .preview-pane {
      container-type: inline-size;
      min-width: 0 !important;
      overflow-x: hidden !important;
    }

    .editor-shell .preview-inner {
      min-width: 0 !important;
      max-width: 100% !important;
    }

    .editor-shell .preview-main {
      min-width: 0 !important;
      max-width: 100% !important;
    }

    .editor-shell .preview-label {
      min-width: 0;
      flex-wrap: nowrap !important;
      align-items: center;
    }

    .editor-shell .preview-actions {
      min-width: 0;
      max-width: 100%;
      display: flex !important;
      flex-direction: row;
      flex-wrap: nowrap !important;
      align-items: center;
      justify-content: flex-end !important;
      gap: 8px !important;
      margin-left: auto !important;
    }

    .editor-shell .preview-actions .btn-inline {
      width: auto !important;
      min-width: 0;
      max-width: none;
      white-space: nowrap;
      justify-content: center;
    }

    /* JS adds this only when the natural one-row action layout genuinely does
       not fit in the current preview label. */
    .editor-shell .preview-label.${STACK_CLASS} {
      align-items: flex-start !important;
    }

    .editor-shell .preview-label.${STACK_CLASS} .preview-actions {
      flex-direction: column;
      align-items: stretch;
      justify-content: flex-start !important;
      width: auto !important;
      max-width: 170px !important;
      gap: 7px !important;
    }

    .editor-shell .preview-label.${STACK_CLASS} .preview-actions .btn-inline {
      width: auto !important;
      min-width: 140px;
      max-width: 170px;
    }

    /* When the actual preview pane gets tight, stop forcing Current Plex Cover
       and Preview to coexist side-by-side. Give the rendered artwork the full
       pane width and move the current cover beneath it. */
    @container (max-width: 760px) {
      .editor-shell .preview-inner {
        grid-template-columns: minmax(0, 1fr) !important;
        width: 100% !important;
        max-width: 660px !important;
        gap: 22px !important;
        align-items: start !important;
      }

      .editor-shell .preview-main {
        order: 1;
        width: 100% !important;
        justify-self: stretch;
      }

      .editor-shell .preview-existing {
        order: 2;
        display: block !important;
        width: min(260px, 100%) !important;
        justify-self: center;
      }

      .editor-shell .preview-container {
        width: min(100%, 620px) !important;
        max-width: 100% !important;
      }
    }

    /* Only at genuinely phone-sized pane widths should a stacked action set
       consume the row beneath the label. */
    @container (max-width: 360px) {
      .editor-shell .preview-label.${STACK_CLASS} {
        display: flex !important;
        flex-direction: column;
        align-items: stretch !important;
        gap: 8px;
      }

      .editor-shell .preview-label.${STACK_CLASS} .preview-actions {
        width: 100% !important;
        max-width: none !important;
        margin-left: 0 !important;
      }

      .editor-shell .preview-label.${STACK_CLASS} .preview-actions .btn-inline {
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
  }

  document.body.appendChild(clone)
  const width = clone.getBoundingClientRect().width
  clone.remove()
  return width
}

const evaluateLabel = (label: HTMLElement) => {
  const actions = label.querySelector<HTMLElement>('.preview-actions')
  if (!actions) return

  label.classList.remove(STACK_CLASS)

  const availableWidth = label.getBoundingClientRect().width
  if (availableWidth <= 0) return

  const naturalWidth = measureNaturalWidth(label)
  if (naturalWidth > availableWidth - 2) {
    label.classList.add(STACK_CLASS)
  }
}

let scheduled = false
const observedLabels = new WeakSet<HTMLElement>()
const resizeObserver = typeof ResizeObserver !== 'undefined'
  ? new ResizeObserver(() => schedule())
  : null

const run = () => {
  scheduled = false

  document.querySelectorAll<HTMLElement>('.editor-shell .preview-label').forEach((label) => {
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
