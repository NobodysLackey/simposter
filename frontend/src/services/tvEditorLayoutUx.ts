const STYLE_ID = 'simposter-tv-editor-layout-styles'

const installStyles = () => {
  if (document.getElementById(STYLE_ID)) return

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    /*
      TV has a different workflow from the other editors:
      controls -> choose series/season -> judge rendered poster -> compare/send.

      On desktop, spend horizontal space on the artwork rather than a permanent
      Seasons rail. Seasons become a compact horizontal strip above the stage.
    */
    @media (min-width: 901px) {
      .editor-shell:has(> .season-panel) {
        display: grid !important;
        grid-template-columns: clamp(330px, 34%, 420px) minmax(0, 1fr) !important;
        grid-template-rows: 116px minmax(0, 1fr) !important;
        height: 100% !important;
        min-height: 0 !important;
        overflow: hidden !important;
      }

      .editor-shell:has(> .season-panel) > .controls-sidebar {
        grid-column: 1 !important;
        grid-row: 1 / -1 !important;
        min-width: 0 !important;
        min-height: 0 !important;
      }

      /* --- SEASON STRIP -------------------------------------------------- */
      .editor-shell:has(> .season-panel) > .season-panel {
        grid-column: 2 !important;
        grid-row: 1 !important;
        display: grid !important;
        grid-template-columns: 118px minmax(190px, 250px) minmax(0, 1fr) !important;
        grid-template-rows: 1fr !important;
        min-width: 0 !important;
        min-height: 0 !important;
        height: 116px !important;
        overflow: hidden !important;
        border-right: 0 !important;
        border-bottom: 1px solid var(--border) !important;
        background: rgba(15, 17, 25, 0.92) !important;
      }

      .editor-shell:has(> .season-panel) .season-header {
        grid-column: 1 !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: center !important;
        align-items: stretch !important;
        gap: 8px !important;
        padding: 10px !important;
        border: 0 !important;
        border-right: 1px solid var(--border) !important;
      }

      .editor-shell:has(> .season-panel) .season-title {
        text-align: center !important;
      }

      .editor-shell:has(> .season-panel) .season-controls {
        justify-content: center !important;
      }

      .editor-shell:has(> .season-panel) .current-season-banner {
        grid-column: 2 !important;
        min-width: 0 !important;
        height: 100% !important;
        box-sizing: border-box !important;
        border-top: 0 !important;
        border-bottom: 0 !important;
        border-right: 1px solid var(--border) !important;
        padding: 10px 12px !important;
      }

      .editor-shell:has(> .season-panel) .season-list {
        grid-column: 3 !important;
        display: flex !important;
        flex-direction: row !important;
        align-items: center !important;
        gap: 8px !important;
        min-width: 0 !important;
        min-height: 0 !important;
        overflow-x: auto !important;
        overflow-y: hidden !important;
        padding: 9px !important;
      }

      .editor-shell:has(> .season-panel) .season-item {
        flex: 0 0 122px !important;
        width: 122px !important;
        height: 88px !important;
        box-sizing: border-box !important;
        margin: 0 !important;
        padding: 6px !important;
        gap: 7px !important;
      }

      .editor-shell:has(> .season-panel) .season-thumb-wrap {
        width: 42px !important;
        height: 64px !important;
      }

      .editor-shell:has(> .season-panel) .season-name-row {
        align-items: center !important;
      }

      .editor-shell:has(> .season-panel) .season-title-text {
        overflow: hidden !important;
      }

      .editor-shell:has(> .season-panel) .season-number,
      .editor-shell:has(> .season-panel) .season-badge {
        white-space: nowrap !important;
      }

      /* --- PREVIEW WORKSPACE -------------------------------------------- */
      .editor-shell:has(> .season-panel) > .preview-pane {
        grid-column: 2 !important;
        grid-row: 2 !important;
        container-type: inline-size;
        min-width: 0 !important;
        min-height: 0 !important;
        width: 100% !important;
        height: 100% !important;
        box-sizing: border-box !important;
        padding: 14px 18px 16px !important;
        overflow: hidden !important;
        align-items: stretch !important;
        justify-content: stretch !important;
      }

      /* Main canvas above, comparison/history dock below. */
      .editor-shell:has(> .season-panel) .preview-inner {
        display: grid !important;
        grid-template-columns: 244px minmax(0, 1fr) !important;
        grid-template-rows: minmax(0, 1fr) 154px !important;
        column-gap: 16px !important;
        row-gap: 14px !important;
        width: 100% !important;
        max-width: none !important;
        height: 100% !important;
        min-width: 0 !important;
        min-height: 0 !important;
        margin: 0 !important;
        align-items: stretch !important;
      }

      /* Flatten the template wrapper so the stage and history dock can occupy
         explicit grid cells without moving DOM nodes. */
      .editor-shell:has(> .season-panel) .preview-content-wrapper {
        display: contents !important;
      }

      /* --- MAIN POSTER STAGE -------------------------------------------- */
      .editor-shell:has(> .season-panel) .preview-main {
        grid-column: 1 / -1 !important;
        grid-row: 1 !important;
        display: grid !important;
        grid-template-rows: auto minmax(0, 1fr) !important;
        width: 100% !important;
        height: 100% !important;
        max-width: none !important;
        min-width: 0 !important;
        min-height: 0 !important;
        align-items: stretch !important;
        justify-items: center !important;
      }

      /* Header is the same visual width as the poster. */
      .editor-shell:has(> .season-panel) .preview-main > .preview-label {
        grid-row: 1 !important;
        width: min(100%, 660px) !important;
        max-width: 660px !important;
        min-width: 0 !important;
        margin: 0 auto 9px !important;
        display: flex !important;
        align-items: center !important;
        flex-wrap: nowrap !important;
        gap: 8px !important;
        box-sizing: border-box !important;
      }

      .editor-shell:has(> .season-panel) .preview-main .preview-title-row,
      .editor-shell:has(> .season-panel) .preview-main .status-badge {
        flex: 0 0 auto !important;
        width: max-content !important;
      }

      .editor-shell:has(> .season-panel) .preview-main .current-season-label {
        flex: 1 1 auto !important;
        min-width: 0 !important;
        margin: 0 !important;
        overflow: hidden !important;
        white-space: nowrap !important;
        text-overflow: ellipsis !important;
      }

      .editor-shell:has(> .season-panel) .preview-main .preview-actions {
        display: flex !important;
        flex: 0 0 auto !important;
        flex-direction: row !important;
        flex-wrap: nowrap !important;
        align-items: center !important;
        justify-content: flex-end !important;
        gap: 7px !important;
        width: auto !important;
        max-width: none !important;
        margin: 0 0 0 auto !important;
      }

      .editor-shell:has(> .season-panel) .preview-main .preview-actions .btn-inline,
      .editor-shell:has(> .season-panel) .preview-main .preview-actions .send-logo-toggle {
        width: auto !important;
        min-width: 0 !important;
        max-width: none !important;
        white-space: nowrap !important;
        box-sizing: border-box !important;
      }

      /* The canvas takes every remaining pixel between toolbar and dock.
         Height drives the poster until width becomes the limiting dimension. */
      .editor-shell:has(> .season-panel) .preview-container {
        grid-row: 2 !important;
        align-self: center !important;
        justify-self: center !important;
        width: auto !important;
        height: 100% !important;
        max-width: min(100%, 660px) !important;
        max-height: 100% !important;
        aspect-ratio: 2 / 3 !important;
        margin: 0 !important;
      }

      .editor-shell:has(> .season-panel) .preview-img,
      .editor-shell:has(> .season-panel) .placeholder-img {
        width: 100% !important;
        height: 100% !important;
        max-width: 100% !important;
        max-height: 100% !important;
        object-fit: contain !important;
      }

      /* --- BOTTOM COMPARISON DOCK --------------------------------------- */
      .editor-shell:has(> .season-panel) .preview-existing {
        grid-column: 1 !important;
        grid-row: 2 !important;
        display: grid !important;
        grid-template-columns: 96px minmax(0, 1fr) !important;
        grid-template-rows: auto minmax(0, 1fr) !important;
        gap: 5px 10px !important;
        width: 244px !important;
        max-width: 244px !important;
        min-width: 0 !important;
        min-height: 0 !important;
        margin: 0 !important;
        padding: 8px 10px !important;
        box-sizing: border-box !important;
        align-self: stretch !important;
        text-align: left !important;
        border: 1px solid var(--border) !important;
        border-radius: 10px !important;
        background: rgba(255, 255, 255, 0.025) !important;
      }

      .editor-shell:has(> .season-panel) .preview-existing > .preview-label:first-child {
        grid-column: 1 !important;
        grid-row: 1 !important;
        margin: 0 !important;
        justify-content: center !important;
      }

      .editor-shell:has(> .season-panel) .preview-existing > .existing-img {
        grid-column: 1 !important;
        grid-row: 2 !important;
        width: auto !important;
        height: 104px !important;
        max-width: 90px !important;
        max-height: 104px !important;
        margin: auto !important;
        object-fit: contain !important;
      }

      .editor-shell:has(> .season-panel) .preview-existing > .preview-label:nth-of-type(2) {
        grid-column: 2 !important;
        grid-row: 1 !important;
        margin: 0 !important;
        justify-content: center !important;
      }

      .editor-shell:has(> .season-panel) .preview-existing > .existing-logo-area {
        grid-column: 2 !important;
        grid-row: 2 !important;
        width: 100% !important;
        max-width: 122px !important;
        min-height: 44px !important;
        margin: auto !important;
      }

      .editor-shell:has(> .season-panel) .rendered-previews-section {
        grid-column: 2 !important;
        grid-row: 2 !important;
        display: flex !important;
        flex-direction: column !important;
        width: 100% !important;
        max-width: none !important;
        min-width: 0 !important;
        min-height: 0 !important;
        margin: 0 !important;
        padding: 8px 10px !important;
        box-sizing: border-box !important;
        align-self: stretch !important;
        overflow: hidden !important;
        border: 1px solid var(--border) !important;
        border-radius: 10px !important;
        background: rgba(255, 255, 255, 0.025) !important;
      }

      .editor-shell:has(> .season-panel) .rendered-previews-section .carousel-label {
        flex: 0 0 auto !important;
        margin: 0 0 6px !important;
      }

      .editor-shell:has(> .season-panel) .rendered-previews-section .carousel-hint {
        display: inline !important;
      }

      .editor-shell:has(> .season-panel) .carousel-scroll {
        display: flex !important;
        flex: 1 1 auto !important;
        flex-direction: row !important;
        align-items: flex-start !important;
        gap: 8px !important;
        width: 100% !important;
        min-height: 0 !important;
        overflow-x: auto !important;
        overflow-y: hidden !important;
        padding: 2px !important;
      }

      .editor-shell:has(> .season-panel) .carousel-item {
        width: 70px !important;
        max-width: 70px !important;
        margin: 0 !important;
        flex: 0 0 auto !important;
      }

      .editor-shell:has(> .season-panel) .carousel-thumb {
        width: 100% !important;
        height: 100px !important;
        object-fit: contain !important;
      }
    }

    /* Keep the action controls attached to the poster header. If the metadata
       and buttons no longer fit on one line, the actions become a second
       horizontal toolbar row rather than a detached vertical stack. */
    @container (max-width: 700px) {
      .editor-shell:has(> .season-panel) .preview-main > .preview-label {
        flex-wrap: wrap !important;
      }

      .editor-shell:has(> .season-panel) .preview-main .preview-actions {
        flex-basis: 100% !important;
        width: 100% !important;
        margin-left: 0 !important;
        justify-content: flex-end !important;
      }
    }

    /* Shorter desktop windows spend less height on the comparison dock. */
    @media (min-width: 901px) and (max-height: 850px) {
      .editor-shell:has(> .season-panel) {
        grid-template-rows: 104px minmax(0, 1fr) !important;
      }

      .editor-shell:has(> .season-panel) > .season-panel {
        height: 104px !important;
      }

      .editor-shell:has(> .season-panel) .preview-inner {
        grid-template-rows: minmax(0, 1fr) 124px !important;
      }

      .editor-shell:has(> .season-panel) .season-item {
        height: 78px !important;
      }

      .editor-shell:has(> .season-panel) .season-thumb-wrap {
        width: 36px !important;
        height: 54px !important;
      }

      .editor-shell:has(> .season-panel) .preview-existing > .existing-img {
        height: 78px !important;
      }

      .editor-shell:has(> .season-panel) .carousel-thumb {
        height: 76px !important;
      }
    }

    /* Truly narrow desktop stages can stack the two dock cards. The poster
       remains first and owns the canvas; utilities never become side rails. */
    @container (max-width: 500px) {
      .editor-shell:has(> .season-panel) .preview-pane {
        overflow-y: auto !important;
      }

      .editor-shell:has(> .season-panel) .preview-inner {
        grid-template-columns: 1fr !important;
        grid-template-rows: minmax(420px, 1fr) auto auto !important;
        height: auto !important;
      }

      .editor-shell:has(> .season-panel) .preview-main {
        grid-column: 1 !important;
        grid-row: 1 !important;
        min-height: 420px !important;
      }

      .editor-shell:has(> .season-panel) .preview-existing {
        grid-column: 1 !important;
        grid-row: 2 !important;
        justify-self: center !important;
      }

      .editor-shell:has(> .season-panel) .rendered-previews-section {
        grid-column: 1 !important;
        grid-row: 3 !important;
        min-height: 140px !important;
      }
    }
  `

  document.head.appendChild(style)
}

const start = () => installStyles()

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true })
  } else {
    start()
  }
}
