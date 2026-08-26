const STYLE_ID = 'simposter-tv-editor-layout-styles'

const installStyles = () => {
  if (document.getElementById(STYLE_ID)) return

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    /*
      TV editor desktop layout

      Workflow hierarchy:
      1. Controls stay independently scrollable on the left.
      2. Seasons use a readable responsive grid across the top of the workspace.
      3. The editor/preview workspace receives every remaining pixel below it.
      4. On shorter windows, only the season grid becomes internally scrollable.
      5. Preview, current Plex state, and render history remain stable below.
    */
    @media (min-width: 901px) {
      .editor-shell:has(> .season-panel) {
        display: grid !important;
        grid-template-columns: clamp(330px, 29%, 390px) minmax(0, 1fr) !important;
        grid-template-rows: auto minmax(0, 1fr) !important;
        width: 100% !important;
        height: 100% !important;
        min-width: 0 !important;
        min-height: 0 !important;
        overflow: hidden !important;
      }

      .editor-shell:has(> .season-panel) > .controls-sidebar {
        grid-column: 1 !important;
        grid-row: 1 / -1 !important;
        min-width: 0 !important;
        min-height: 0 !important;
      }

      /* --- SEASONS: readable top grid --------------------------------- */
      .editor-shell:has(> .season-panel) > .season-panel {
        grid-column: 2 !important;
        grid-row: 1 !important;
        display: flex !important;
        flex-direction: column !important;
        width: 100% !important;
        height: auto !important;
        max-height: min(42dvh, 600px) !important;
        min-width: 0 !important;
        min-height: 0 !important;
        overflow: hidden !important;
        border-right: 0 !important;
        border-bottom: 1px solid var(--border) !important;
        background: rgba(15, 17, 25, 0.94) !important;
        box-sizing: border-box !important;
      }

      .editor-shell:has(> .season-panel) .season-header {
        display: flex !important;
        flex: 0 0 40px !important;
        flex-direction: row !important;
        align-items: center !important;
        justify-content: flex-start !important;
        gap: 9px !important;
        width: 100% !important;
        height: 40px !important;
        padding: 6px 12px !important;
        border: 0 !important;
        border-bottom: 1px solid var(--border) !important;
        box-sizing: border-box !important;
      }

      .editor-shell:has(> .season-panel) .season-title {
        margin: 0 !important;
        white-space: nowrap !important;
      }

      .editor-shell:has(> .season-panel) .season-controls {
        display: flex !important;
        align-items: center !important;
        gap: 5px !important;
      }

      .editor-shell:has(> .season-panel) .current-season-banner {
        display: none !important;
      }

      .editor-shell:has(> .season-panel) .season-list {
        display: grid !important;
        grid-template-columns: repeat(auto-fill, minmax(145px, 1fr)) !important;
        grid-auto-rows: 58px !important;
        align-content: start !important;
        gap: 8px !important;
        width: 100% !important;
        height: auto !important;
        min-width: 0 !important;
        min-height: 0 !important;
        max-height: calc(min(42dvh, 600px) - 40px) !important;
        padding: 9px 12px 11px !important;
        overflow-x: hidden !important;
        overflow-y: auto !important;
        box-sizing: border-box !important;
        scrollbar-width: thin;
      }

      .editor-shell:has(> .season-panel) .season-item {
        display: grid !important;
        grid-template-columns: 30px minmax(0, 1fr) auto !important;
        align-items: center !important;
        gap: 8px !important;
        width: 100% !important;
        min-width: 0 !important;
        height: 58px !important;
        min-height: 58px !important;
        margin: 0 !important;
        padding: 4px 8px !important;
        border-radius: 8px !important;
        box-sizing: border-box !important;
      }

      .editor-shell:has(> .season-panel) .season-thumb-wrap {
        display: block !important;
        width: 30px !important;
        height: 45px !important;
        min-width: 30px !important;
        margin: 0 !important;
        border-radius: 4px !important;
      }

      .editor-shell:has(> .season-panel) .season-thumb,
      .editor-shell:has(> .season-panel) .season-thumb-placeholder {
        width: 100% !important;
        height: 100% !important;
        object-fit: cover !important;
      }

      .editor-shell:has(> .season-panel) .season-info {
        min-width: 0 !important;
        width: 100% !important;
      }

      .editor-shell:has(> .season-panel) .season-name-row {
        display: flex !important;
        align-items: center !important;
        justify-content: flex-start !important;
        gap: 5px !important;
        min-width: 0 !important;
      }

      .editor-shell:has(> .season-panel) .season-title-text,
      .editor-shell:has(> .season-panel) .season-number,
      .editor-shell:has(> .season-panel) .season-badge {
        min-width: 0 !important;
        max-width: 100% !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
      }

      .editor-shell:has(> .season-panel) .season-checkbox {
        flex: 0 0 auto !important;
        margin: 0 !important;
      }

      /* --- PREVIEW WORKSPACE: consumes everything left below seasons --- */
      .editor-shell:has(> .season-panel) > .preview-pane {
        grid-column: 2 !important;
        grid-row: 2 !important;
        container-type: inline-size;
        width: 100% !important;
        height: 100% !important;
        min-width: 0 !important;
        min-height: 0 !important;
        padding: 14px 18px 18px !important;
        box-sizing: border-box !important;
        overflow-x: hidden !important;
        overflow-y: auto !important;
        align-items: stretch !important;
        justify-content: stretch !important;
      }

      .editor-shell:has(> .season-panel) .preview-inner {
        display: grid !important;
        grid-template-columns: minmax(340px, 470px) minmax(280px, 1fr) !important;
        grid-template-rows: auto auto minmax(0, 1fr) !important;
        column-gap: 18px !important;
        row-gap: 12px !important;
        width: min(100%, 1120px) !important;
        max-width: 1120px !important;
        height: 100% !important;
        min-width: 0 !important;
        min-height: 0 !important;
        margin: 0 auto !important;
        padding: 0 !important;
        box-sizing: border-box !important;
        align-content: stretch !important;
        align-items: start !important;
      }

      .editor-shell:has(> .season-panel) .preview-content-wrapper,
      .editor-shell:has(> .season-panel) .preview-main {
        display: contents !important;
      }

      /* --- TOOLBAR ------------------------------------------------------ */
      .editor-shell:has(> .season-panel) .preview-main > .preview-label {
        grid-column: 1 / -1 !important;
        grid-row: 1 !important;
        display: flex !important;
        align-items: center !important;
        flex-wrap: nowrap !important;
        gap: 7px !important;
        width: 100% !important;
        min-width: 0 !important;
        margin: 0 !important;
        padding: 0 0 2px !important;
        box-sizing: border-box !important;
      }

      .editor-shell:has(> .season-panel) .preview-main .preview-title-row,
      .editor-shell:has(> .season-panel) .preview-main .status-badge {
        flex: 0 0 auto !important;
        width: max-content !important;
      }

      .editor-shell:has(> .season-panel) .preview-main .current-season-label {
        flex: 1 1 auto !important;
        min-width: 70px !important;
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
        gap: 6px !important;
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

      /* --- RENDERED POSTER: large enough to judge, not the whole app ---- */
      .editor-shell:has(> .season-panel) .preview-container {
        grid-column: 1 !important;
        grid-row: 2 / 4 !important;
        align-self: start !important;
        justify-self: center !important;
        width: min(100%, 470px, calc(62dvh - 70px)) !important;
        height: auto !important;
        max-width: 100% !important;
        max-height: none !important;
        aspect-ratio: 2 / 3 !important;
        margin: 0 !important;
        overflow: hidden !important;
      }

      .editor-shell:has(> .season-panel) .preview-img,
      .editor-shell:has(> .season-panel) .placeholder-img,
      .editor-shell:has(> .season-panel) .placeholder-state {
        width: 100% !important;
        height: 100% !important;
        max-width: 100% !important;
        max-height: 100% !important;
        object-fit: cover !important;
      }

      /* --- CURRENT PLEX COMPARISON ------------------------------------- */
      .editor-shell:has(> .season-panel) .preview-existing {
        grid-column: 2 !important;
        grid-row: 2 !important;
        display: grid !important;
        grid-template-columns: 118px minmax(0, 1fr) !important;
        grid-template-rows: auto auto !important;
        gap: 7px 12px !important;
        width: 100% !important;
        min-width: 0 !important;
        min-height: 0 !important;
        margin: 0 !important;
        padding: 11px 12px !important;
        box-sizing: border-box !important;
        align-items: start !important;
        border: 1px solid var(--border) !important;
        border-radius: 10px !important;
        background: rgba(255, 255, 255, 0.025) !important;
        text-align: left !important;
      }

      .editor-shell:has(> .season-panel) .preview-existing > .preview-label:first-child {
        grid-column: 1 !important;
        grid-row: 1 !important;
        width: 100% !important;
        margin: 0 !important;
        justify-content: center !important;
      }

      .editor-shell:has(> .season-panel) .preview-existing > .preview-label:not(:first-child) {
        grid-column: 2 !important;
        grid-row: 1 !important;
        width: 100% !important;
        margin: 0 !important;
        justify-content: center !important;
      }

      .editor-shell:has(> .season-panel) .preview-existing > .existing-img,
      .editor-shell:has(> .season-panel) .preview-existing > .empty-preview:not(.small) {
        grid-column: 1 !important;
        grid-row: 2 !important;
        width: 104px !important;
        height: 156px !important;
        max-width: 104px !important;
        max-height: 156px !important;
        margin: 0 auto !important;
        object-fit: cover !important;
      }

      .editor-shell:has(> .season-panel) .preview-existing > .existing-logo-area {
        grid-column: 2 !important;
        grid-row: 2 !important;
        width: 100% !important;
        max-width: 200px !important;
        min-height: 56px !important;
        margin: 0 auto !important;
        align-self: start !important;
      }

      /* --- RENDER HISTORY: fills the remaining utility-column height ---- */
      .editor-shell:has(> .season-panel) .rendered-previews-section {
        grid-column: 2 !important;
        grid-row: 3 !important;
        display: flex !important;
        flex-direction: column !important;
        align-self: stretch !important;
        width: 100% !important;
        height: 100% !important;
        max-width: none !important;
        min-width: 0 !important;
        min-height: 120px !important;
        max-height: none !important;
        margin: 0 !important;
        padding: 11px 12px !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
        border: 1px solid var(--border) !important;
        border-radius: 10px !important;
        background: rgba(255, 255, 255, 0.025) !important;
      }

      .editor-shell:has(> .season-panel) .rendered-previews-section .carousel-label {
        flex: 0 0 auto !important;
        margin: 0 0 8px !important;
        line-height: 1.25 !important;
      }

      .editor-shell:has(> .season-panel) .rendered-previews-section .carousel-hint {
        display: inline !important;
        margin-left: 5px !important;
      }

      .editor-shell:has(> .season-panel) .carousel-scroll {
        display: grid !important;
        flex: 1 1 auto !important;
        grid-template-columns: repeat(auto-fill, minmax(74px, 1fr)) !important;
        align-content: start !important;
        gap: 8px !important;
        width: 100% !important;
        min-height: 0 !important;
        overflow-x: hidden !important;
        overflow-y: auto !important;
        padding: 2px !important;
      }

      .editor-shell:has(> .season-panel) .carousel-item {
        width: 100% !important;
        max-width: 92px !important;
        min-width: 0 !important;
        margin: 0 !important;
        justify-self: start !important;
      }

      .editor-shell:has(> .season-panel) .carousel-thumb {
        width: 100% !important;
        height: auto !important;
        aspect-ratio: 2 / 3 !important;
        object-fit: cover !important;
      }
    }

    /* The action toolbar wraps before the editor itself reflows. */
    @container (max-width: 720px) {
      .editor-shell:has(> .season-panel) .preview-main > .preview-label {
        flex-wrap: wrap !important;
      }

      .editor-shell:has(> .season-panel) .preview-main .preview-actions {
        flex-basis: 100% !important;
        width: 100% !important;
        margin-left: 0 !important;
        justify-content: flex-start !important;
      }
    }

    /* On genuinely narrow preview panes, keep the same hierarchy but put
       comparison and history underneath the rendered poster. */
    @container (max-width: 650px) {
      .editor-shell:has(> .season-panel) .preview-inner {
        grid-template-columns: minmax(0, 1fr) !important;
        grid-template-rows: auto auto auto auto !important;
        width: min(100%, 560px) !important;
        max-width: 560px !important;
        height: auto !important;
        min-height: 0 !important;
        gap: 12px !important;
      }

      .editor-shell:has(> .season-panel) .preview-main > .preview-label {
        grid-column: 1 !important;
        grid-row: 1 !important;
      }

      .editor-shell:has(> .season-panel) .preview-container {
        grid-column: 1 !important;
        grid-row: 2 !important;
        width: min(100%, 400px, calc(62dvh - 70px)) !important;
      }

      .editor-shell:has(> .season-panel) .preview-existing {
        grid-column: 1 !important;
        grid-row: 3 !important;
      }

      .editor-shell:has(> .season-panel) .rendered-previews-section {
        grid-column: 1 !important;
        grid-row: 4 !important;
        height: auto !important;
        min-height: 160px !important;
        max-height: 280px !important;
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
