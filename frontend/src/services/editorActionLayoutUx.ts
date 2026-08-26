const STYLE_ID = 'simposter-editor-action-layout-styles'
const STACK_CLASS = 'simposter-actions-stacked'

const installStyles = () => {
  if (document.getElementById(STYLE_ID)) return

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    /* Every editor responds to the space actually available to its preview
       pane. This is intentionally library-agnostic so Movies, Anime, TV and
       Audiobooks all follow the same layout rules. */
    .editor-shell .preview-pane {
      container-type: inline-size;
      min-width: 0 !important;
      overflow-x: hidden !important;
    }

    .editor-shell .preview-inner,
    .editor-shell .preview-content-wrapper,
    .editor-shell .preview-main {
      min-width: 0 !important;
      max-width: 100% !important;
      box-sizing: border-box;
    }

    /* TV has a third, season-selection column. Let the controls and season
       columns yield before starving the artwork pane. */
    @media (min-width: 901px) {
      .editor-shell:has(> .season-panel) {
        grid-template-columns:
          clamp(340px, 32vw, 420px)
          clamp(130px, 14vw, 180px)
          minmax(0, 1fr) !important;
      }
    }

    /* TvShowEditorPane centers children inside preview-main, which otherwise
       makes the header shrink to its content and falsely triggers button
       stacking. All editors get a full-width preview header. */
    .editor-shell .preview-main > .preview-label {
      width: 100% !important;
      align-self: stretch !important;
      box-sizing: border-box;
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
      margin-top: 0 !important;
    }

    .editor-shell .preview-actions .btn-inline {
      width: auto !important;
      min-width: 0;
      max-width: none;
      white-space: nowrap;
      justify-content: center;
    }

    /* JS adds this only when the natural one-row action layout genuinely does
       not fit in the current full-width preview header. */
    .editor-shell .preview-label.${STACK_CLASS} {
      align-items: flex-start !important;
    }

    .editor-shell .preview-label.${STACK_CLASS} .preview-actions {
      flex-direction: column;
      align-items: stretch;
      justify-content: flex-start !important;
      width: auto !important;
      max-width: 180px !important;
      gap: 7px !important;
    }

    .editor-shell .preview-label.${STACK_CLASS} .preview-actions .btn-inline {
      width: auto !important;
      min-width: 140px;
      max-width: 180px;
    }

    /* At a genuinely narrow preview-pane width, normalize the standard
       two-column editors. Rendered artwork gets the available width first;
       the current Plex asset moves underneath it. */
    @container (max-width: 760px) {
      .editor-shell .preview-inner {
        display: flex !important;
        flex-direction: column !important;
        align-items: stretch !important;
        justify-content: flex-start !important;
        width: 100% !important;
        max-width: 660px !important;
        gap: 22px !important;
        margin-inline: auto !important;
      }

      /* TV wraps preview-main and its rendered-poster carousel in this extra
         element. Other editors do not. */
      .editor-shell .preview-content-wrapper {
        order: 1;
        flex: 0 1 auto !important;
        width: 100% !important;
        max-width: 100% !important;
        align-self: stretch !important;
      }

      /* Only direct preview-main children need ordering. TV's preview-main is
         nested inside preview-content-wrapper; ordering it used to place the
         rendered carousel above the main preview. */
      .editor-shell .preview-inner > .preview-main {
        order: 1;
      }

      .editor-shell .preview-main {
        flex: 0 1 auto !important;
        width: 100% !important;
        max-width: 100% !important;
        align-self: stretch !important;
        justify-self: stretch;
      }

      .editor-shell .preview-existing {
        order: 2;
        display: block !important;
        flex: 0 0 auto !important;
        width: min(260px, 100%) !important;
        max-width: 260px !important;
        align-self: center !important;
        justify-self: center;
      }

      .editor-shell .preview-container {
        width: min(100%, 620px) !important;
        max-width: 100% !important;
        margin-inline: auto !important;
      }

      /* TV is different: it has already spent horizontal space on a season
         selector. Until the artwork pane is truly tiny, preserve a compact
         Current Plex + Rendered side-by-side composition instead of turning
         the poster into a giant full-width vertical card. */
      .editor-shell:has(> .season-panel) .preview-inner {
        flex-direction: row !important;
        align-items: flex-start !important;
        justify-content: center !important;
        width: 100% !important;
        max-width: 100% !important;
        gap: 12px !important;
        margin-inline: 0 !important;
      }

      .editor-shell:has(> .season-panel) .preview-existing {
        order: 1;
        width: 110px !important;
        max-width: 110px !important;
        align-self: flex-start !important;
      }

      .editor-shell:has(> .season-panel) .preview-existing .existing-img,
      .editor-shell:has(> .season-panel) .preview-existing .existing-logo-area {
        width: 110px !important;
        max-width: 110px !important;
      }

      .editor-shell:has(> .season-panel) .preview-content-wrapper {
        order: 2;
        flex: 1 1 auto !important;
        width: auto !important;
        min-width: 0 !important;
        max-width: 100% !important;
        align-self: flex-start !important;
      }

      .editor-shell:has(> .season-panel) .preview-main {
        width: 100% !important;
        max-width: 100% !important;
      }

      .editor-shell:has(> .season-panel) .preview-container {
        width: min(100%, 38vh, 360px) !important;
        max-width: 100% !important;
        max-height: 57vh !important;
        margin-inline: auto !important;
      }

      .editor-shell:has(> .season-panel) .preview-img {
        width: 100% !important;
        height: 100% !important;
        max-width: 100% !important;
        max-height: 57vh !important;
        object-fit: contain !important;
      }

      .editor-shell:has(> .season-panel) .rendered-previews-section {
        order: initial !important;
        width: 100% !important;
        max-width: 100% !important;
        margin-top: 12px !important;
      }
    }

    /* Once the TV artwork pane itself is genuinely tiny, vertical stacking is
       preferable to crushing both poster columns. */
    @container (max-width: 330px) {
      .editor-shell:has(> .season-panel) .preview-inner {
        flex-direction: column !important;
        align-items: stretch !important;
        gap: 18px !important;
      }

      .editor-shell:has(> .season-panel) .preview-content-wrapper {
        order: 1;
        width: 100% !important;
      }

      .editor-shell:has(> .season-panel) .preview-existing {
        order: 2;
        width: min(180px, 100%) !important;
        max-width: 180px !important;
        align-self: center !important;
      }
    }

    /* Only at genuinely phone-sized pane widths should a stacked action set
       consume the row beneath the Preview/Rendered label. */
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
    actions.style.marginTop = '0'
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
const observedPanes = new WeakSet<HTMLElement>()
const resizeObserver = typeof ResizeObserver !== 'undefined'
  ? new ResizeObserver(() => schedule())
  : null

const run = () => {
  scheduled = false

  document.querySelectorAll<HTMLElement>('.editor-shell .preview-pane').forEach((pane) => {
    if (resizeObserver && !observedPanes.has(pane)) {
      observedPanes.add(pane)
      resizeObserver.observe(pane)
    }
  })

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
