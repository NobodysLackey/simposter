const STYLE_ID = 'simposter-tv-editor-layout-styles'

const installStyles = () => {
  if (document.getElementById(STYLE_ID)) return

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    /* TV owns its own desktop composition. Controls and Seasons stay fixed;
       the remaining space belongs to the rendered poster stage. */
    @media (min-width: 901px) {
      .editor-shell:has(> .season-panel) {
        grid-template-columns:
          clamp(320px, 31vw, 420px)
          clamp(110px, 12vw, 160px)
          minmax(0, 1fr) !important;
      }

      .editor-shell:has(> .season-panel) .preview-pane {
        container-type: inline-size;
        min-width: 0 !important;
        min-height: 0 !important;
        height: 100% !important;
        padding: 18px !important;
        overflow: hidden !important;
        align-items: stretch !important;
        justify-content: stretch !important;
      }

      /* One stage: full-width rendered preview above a compact utility strip. */
      .editor-shell:has(> .season-panel) .preview-inner {
        display: grid !important;
        grid-template-columns: 220px minmax(0, 1fr) !important;
        grid-template-rows: minmax(0, 1fr) auto !important;
        column-gap: 18px !important;
        row-gap: 18px !important;
        width: 100% !important;
        max-width: none !important;
        height: 100% !important;
        min-width: 0 !important;
        min-height: 0 !important;
        margin: 0 !important;
        align-items: start !important;
      }

      /* TV's wrapper only groups the main preview and rendered thumbnails in
         the Vue template. Flatten it so the stage grid controls placement. */
      .editor-shell:has(> .season-panel) .preview-content-wrapper {
        display: contents !important;
      }

      /* Main rendered poster owns the full top row. */
      .editor-shell:has(> .season-panel) .preview-main {
        grid-column: 1 / -1 !important;
        grid-row: 1 !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: flex-start !important;
        width: 100% !important;
        max-width: none !important;
        min-width: 0 !important;
        min-height: 0 !important;
      }

      /* Header follows the same width as the poster, so the actions live
         directly across the top edge of the artwork instead of in a side rail. */
      .editor-shell:has(> .season-panel) .preview-main > .preview-label {
        width: min(100%, 560px) !important;
        max-width: 560px !important;
        min-width: 0 !important;
        margin: 0 auto 10px !important;
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
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
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

      /* Let width drive poster size on tall desktop displays. This uses the
         previously wasted horizontal stage instead of permanently reserving a
         Current Plex rail beside the artwork. */
      .editor-shell:has(> .season-panel) .preview-container {
        width: min(100%, 560px) !important;
        max-width: 560px !important;
        max-height: calc(100% - 46px) !important;
        aspect-ratio: 2 / 3 !important;
        margin: 0 auto !important;
        flex: 0 1 auto !important;
      }

      .editor-shell:has(> .season-panel) .preview-img,
      .editor-shell:has(> .season-panel) .placeholder-img {
        width: 100% !important;
        height: 100% !important;
        max-width: 100% !important;
        max-height: 100% !important;
        object-fit: contain !important;
      }

      /* Current Plex becomes a compact horizontal utility card beneath the
         main poster instead of consuming permanent stage width. */
      .editor-shell:has(> .season-panel) .preview-existing {
        grid-column: 1 !important;
        grid-row: 2 !important;
        display: grid !important;
        grid-template-columns: 88px minmax(0, 1fr) !important;
        grid-template-rows: auto auto !important;
        gap: 5px 10px !important;
        width: 220px !important;
        max-width: 220px !important;
        min-width: 0 !important;
        margin: 0 !important;
        padding: 8px !important;
        box-sizing: border-box !important;
        align-self: start !important;
        text-align: left !important;
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
        width: 78px !important;
        max-width: 78px !important;
        height: auto !important;
        margin-inline: auto !important;
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
        max-width: 110px !important;
        min-height: 42px !important;
        margin-inline: auto !important;
      }

      /* Rendered variants use the rest of the utility row horizontally. */
      .editor-shell:has(> .season-panel) .rendered-previews-section {
        grid-column: 2 !important;
        grid-row: 2 !important;
        width: 100% !important;
        max-width: none !important;
        min-width: 0 !important;
        margin: 0 !important;
        align-self: start !important;
        overflow: hidden !important;
      }

      .editor-shell:has(> .season-panel) .rendered-previews-section .carousel-label {
        margin-bottom: 6px !important;
      }

      .editor-shell:has(> .season-panel) .rendered-previews-section .carousel-hint {
        display: inline !important;
      }

      .editor-shell:has(> .season-panel) .carousel-scroll {
        display: flex !important;
        flex-direction: row !important;
        gap: 8px !important;
        width: 100% !important;
        overflow-x: auto !important;
        overflow-y: hidden !important;
        padding: 2px !important;
      }

      .editor-shell:has(> .season-panel) .carousel-item {
        width: 68px !important;
        max-width: 68px !important;
        margin: 0 !important;
        flex: 0 0 auto !important;
      }

      .editor-shell:has(> .season-panel) .carousel-thumb {
        width: 100% !important;
        height: 100px !important;
        object-fit: contain !important;
      }
    }

    /* If the stage cannot fit all actions beside the metadata, keep the
       controls at the top of the poster by wrapping them onto a second header
       line — never into a detached vertical sidebar. */
    @container (max-width: 640px) {
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

    /* On shorter displays, cap artwork height so the compact utility strip
       remains reachable without turning the whole editor into a page scroll. */
    @media (min-width: 901px) and (max-height: 900px) {
      .editor-shell:has(> .season-panel) .preview-container {
        width: min(100%, 390px) !important;
        max-width: 390px !important;
      }

      .editor-shell:has(> .season-panel) .preview-main > .preview-label {
        width: min(100%, 390px) !important;
        max-width: 390px !important;
      }
    }

    /* Truly narrow preview panes can stack the utility strip; the main poster
       still remains first and full width. */
    @container (max-width: 470px) {
      .editor-shell:has(> .season-panel) .preview-pane {
        overflow-y: auto !important;
      }

      .editor-shell:has(> .season-panel) .preview-inner {
        grid-template-columns: 1fr !important;
        grid-template-rows: auto auto auto !important;
        height: auto !important;
      }

      .editor-shell:has(> .season-panel) .preview-main {
        grid-column: 1 !important;
        grid-row: 1 !important;
      }

      .editor-shell:has(> .season-panel) .preview-existing {
        grid-column: 1 !important;
        grid-row: 2 !important;
        justify-self: center !important;
      }

      .editor-shell:has(> .season-panel) .rendered-previews-section {
        grid-column: 1 !important;
        grid-row: 3 !important;
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
