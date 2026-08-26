const STYLE_ID = 'simposter-editor-action-layout-styles'
const STACK_CLASS = 'simposter-actions-stacked'
const TV_CLASS = 'simposter-tv-editor'

const installStyles = () => {
  if (document.getElementById(STYLE_ID)) return

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    /* The preview pane is the responsive boundary for every editor. */
    .editor-shell .preview-pane {
      container-type: inline-size;
      min-width: 0 !important;
      overflow-x: hidden !important;
    }

    .editor-shell .preview-inner,
    .editor-shell .preview-content-wrapper,
    .editor-shell .preview-main {
      min-width: 0 !important;
      box-sizing: border-box;
    }

    /* Keep the action controls attached to the rendered-preview header. */
    .editor-shell .preview-main > .preview-label {
      width: 100% !important;
      max-width: 100% !important;
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

    /* Added only when the natural horizontal action row will not fit. */
    .editor-shell .preview-label.${STACK_CLASS} {
      align-items: flex-start !important;
    }

    .editor-shell .preview-label.${STACK_CLASS} .preview-actions {
      flex-direction: column;
      align-items: stretch;
      justify-content: flex-start !important;
      width: auto !important;
      max-width: 165px !important;
      gap: 7px !important;
    }

    .editor-shell .preview-label.${STACK_CLASS} .preview-actions .btn-inline,
    .editor-shell .preview-label.${STACK_CLASS} .preview-actions .send-logo-toggle {
      width: 100% !important;
      min-width: 135px;
      max-width: 165px;
      box-sizing: border-box;
    }

    /* ---------------------------------------------------------------
       STANDARD EDITORS — Movies / Anime / Audiobooks
       --------------------------------------------------------------- */
    @container (max-width: 760px) {
      .editor-shell:not(.${TV_CLASS}) .preview-inner {
        display: flex !important;
        flex-direction: column !important;
        align-items: stretch !important;
        justify-content: flex-start !important;
        width: 100% !important;
        max-width: 660px !important;
        gap: 22px !important;
        margin-inline: auto !important;
      }

      .editor-shell:not(.${TV_CLASS}) .preview-content-wrapper,
      .editor-shell:not(.${TV_CLASS}) .preview-main {
        order: 1;
        flex: 0 1 auto !important;
        width: 100% !important;
        max-width: 100% !important;
        align-self: stretch !important;
      }

      .editor-shell:not(.${TV_CLASS}) .preview-existing {
        order: 2;
        display: block !important;
        flex: 0 0 auto !important;
        width: min(260px, 100%) !important;
        max-width: 260px !important;
        align-self: center !important;
      }

      .editor-shell:not(.${TV_CLASS}) .preview-container {
        width: min(100%, 620px) !important;
        max-width: 100% !important;
        margin-inline: auto !important;
      }
    }

    /* ---------------------------------------------------------------
       TV EDITOR

       TV owns a third Seasons column, so its preview needs an explicit
       composition rather than generic flex reordering:

         [ Current Plex rail ] [ Rendered preview + carousel ]

       The whole stage collapses only when the preview pane itself becomes
       too narrow for those two regions.
       --------------------------------------------------------------- */
    @media (min-width: 901px) {
      .editor-shell.${TV_CLASS} {
        grid-template-columns:
          clamp(290px, 34%, 360px)
          125px
          minmax(0, 1fr) !important;
      }
    }

    .editor-shell.${TV_CLASS} .preview-pane {
      align-items: flex-start !important;
      justify-content: center !important;
      padding: 18px !important;
      overflow-y: auto !important;
    }

    .editor-shell.${TV_CLASS} .preview-inner {
      display: grid !important;
      grid-template-columns: 120px minmax(0, 1fr) !important;
      grid-template-rows: auto !important;
      align-items: start !important;
      justify-content: center !important;
      column-gap: 18px !important;
      row-gap: 0 !important;
      width: min(100%, 620px) !important;
      max-width: 620px !important;
      margin: auto !important;
    }

    .editor-shell.${TV_CLASS} .preview-existing {
      grid-column: 1 !important;
      grid-row: 1 !important;
      width: 120px !important;
      max-width: 120px !important;
      align-self: start !important;
      justify-self: center !important;
      text-align: center !important;
      order: initial !important;
    }

    .editor-shell.${TV_CLASS} .preview-existing .existing-img,
    .editor-shell.${TV_CLASS} .preview-existing .existing-logo-area {
      width: 120px !important;
      max-width: 120px !important;
      box-sizing: border-box;
    }

    .editor-shell.${TV_CLASS} .preview-content-wrapper {
      grid-column: 2 !important;
      grid-row: 1 !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: flex-start !important;
      width: 100% !important;
      max-width: 460px !important;
      min-width: 0 !important;
      gap: 12px !important;
      order: initial !important;
      justify-self: center !important;
    }

    .editor-shell.${TV_CLASS} .preview-main {
      width: 100% !important;
      max-width: 460px !important;
      min-width: 0 !important;
      align-items: center !important;
      order: initial !important;
    }

    .editor-shell.${TV_CLASS} .preview-container {
      width: min(100%, 390px, 48vh) !important;
      max-width: 390px !important;
      max-height: 64vh !important;
      margin-inline: auto !important;
      box-sizing: border-box;
    }

    .editor-shell.${TV_CLASS} .preview-img {
      width: 100% !important;
      height: 100% !important;
      max-width: 100% !important;
      max-height: 64vh !important;
      object-fit: contain !important;
    }

    .editor-shell.${TV_CLASS} .rendered-previews-section {
      width: 100% !important;
      max-width: 460px !important;
      margin: 10px auto 0 !important;
      order: initial !important;
      align-self: center !important;
    }

    .editor-shell.${TV_CLASS} .carousel-scroll {
      width: 100% !important;
      max-width: 100% !important;
      box-sizing: border-box;
    }

    /* Collapse the TV stage as one unit — never let its individual pieces
       independently float/reorder around the preview canvas. */
    @container (max-width: 500px) {
      .editor-shell.${TV_CLASS} .preview-inner {
        grid-template-columns: 1fr !important;
        grid-template-rows: auto auto !important;
        width: min(100%, 460px) !important;
        max-width: 460px !important;
        row-gap: 22px !important;
      }

      .editor-shell.${TV_CLASS} .preview-content-wrapper {
        grid-column: 1 !important;
        grid-row: 1 !important;
        width: 100% !important;
        max-width: 460px !important;
      }

      .editor-shell.${TV_CLASS} .preview-existing {
        grid-column: 1 !important;
        grid-row: 2 !important;
        width: 150px !important;
        max-width: 150px !important;
        justify-self: center !important;
      }

      .editor-shell.${TV_CLASS} .preview-existing .existing-img,
      .editor-shell.${TV_CLASS} .preview-existing .existing-logo-area {
        width: 150px !important;
        max-width: 150px !important;
      }

      .editor-shell.${TV_CLASS} .preview-container {
        width: min(100%, 360px, 48vh) !important;
        max-width: 360px !important;
      }
    }

    /* Only at genuinely phone-sized pane widths should a stacked action set
       take a full row beneath the Preview / Rendered labels. */
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

      .editor-shell .preview-label.${STACK_CLASS} .preview-actions .btn-inline,
      .editor-shell .preview-label.${STACK_CLASS} .preview-actions .send-logo-toggle {
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

const classifyEditors = () => {
  document.querySelectorAll<HTMLElement>('.editor-shell').forEach((shell) => {
    const hasSeasonPanel = Boolean(shell.querySelector(':scope > .season-panel'))
    shell.classList.toggle(TV_CLASS, hasSeasonPanel)
  })
}

let scheduled = false
const observedLabels = new WeakSet<HTMLElement>()
const observedPanes = new WeakSet<HTMLElement>()
const resizeObserver = typeof ResizeObserver !== 'undefined'
  ? new ResizeObserver(() => schedule())
  : null

const run = () => {
  scheduled = false
  classifyEditors()

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
