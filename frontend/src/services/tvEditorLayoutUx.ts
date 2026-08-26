const STYLE_ID = 'simposter-tv-editor-layout-styles'

const installStyles = () => {
  if (document.getElementById(STYLE_ID)) return

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    /* TV is the only editor with a permanent Seasons column, so give it an
       explicit desktop composition instead of letting generic editor rules
       shuffle its preview pieces independently. */
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
        height: 100% !important;
        padding: 18px !important;
        overflow: hidden !important;
        align-items: stretch !important;
        justify-content: stretch !important;
      }

      .editor-shell:has(> .season-panel) .preview-inner {
        display: grid !important;
        grid-template-columns: 132px minmax(0, 1fr) !important;
        grid-template-rows: auto minmax(0, 1fr) !important;
        column-gap: 22px !important;
        row-gap: 18px !important;
        width: min(100%, 900px) !important;
        max-width: 900px !important;
        height: 100% !important;
        min-width: 0 !important;
        min-height: 0 !important;
        margin: 0 auto !important;
        align-items: start !important;
      }

      /* Flatten TV's extra wrapper so its main preview and rendered-poster
         list participate in one predictable grid. */
      .editor-shell:has(> .season-panel) .preview-content-wrapper {
        display: contents !important;
      }

      .editor-shell:has(> .season-panel) .preview-existing {
        grid-column: 1 !important;
        grid-row: 1 !important;
        width: 132px !important;
        max-width: 132px !important;
        min-width: 0 !important;
        text-align: center !important;
        align-self: start !important;
      }

      .editor-shell:has(> .season-panel) .preview-existing .existing-img {
        width: 118px !important;
        max-width: 118px !important;
        height: auto !important;
      }

      .editor-shell:has(> .season-panel) .preview-existing .existing-logo-area {
        width: 118px !important;
        max-width: 118px !important;
        margin-inline: auto !important;
      }

      .editor-shell:has(> .season-panel) .preview-main {
        grid-column: 2 !important;
        grid-row: 1 / 3 !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: flex-start !important;
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        min-height: 0 !important;
        container-type: inline-size;
      }

      .editor-shell:has(> .season-panel) .preview-main > .preview-label {
        width: 100% !important;
        min-width: 0 !important;
        margin: 0 0 12px !important;
        display: flex !important;
        align-items: center !important;
        flex-wrap: nowrap !important;
        gap: 8px !important;
        box-sizing: border-box;
      }

      .editor-shell:has(> .season-panel) .preview-main .preview-actions {
        display: flex !important;
        flex-direction: row !important;
        flex-wrap: nowrap !important;
        align-items: center !important;
        justify-content: flex-end !important;
        gap: 7px !important;
        width: auto !important;
        max-width: none !important;
        margin: 0 0 0 auto !important;
      }

      .editor-shell:has(> .season-panel) .preview-main .preview-actions .btn-inline {
        width: auto !important;
        min-width: 0 !important;
        max-width: none !important;
        white-space: nowrap !important;
      }

      .editor-shell:has(> .season-panel) .preview-container {
        width: auto !important;
        height: min(62vh, 720px) !important;
        max-width: 100% !important;
        max-height: calc(100% - 54px) !important;
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

      /* Rendered posters use the otherwise-wasted vertical rail below Current
         Plex rather than becoming a detached horizontal strip. */
      .editor-shell:has(> .season-panel) .rendered-previews-section {
        grid-column: 1 !important;
        grid-row: 2 !important;
        width: 132px !important;
        max-width: 132px !important;
        min-width: 0 !important;
        min-height: 0 !important;
        margin: 0 !important;
        align-self: stretch !important;
        overflow: hidden !important;
      }

      .editor-shell:has(> .season-panel) .rendered-previews-section .carousel-label {
        display: block !important;
        margin-bottom: 8px !important;
        line-height: 1.25 !important;
      }

      .editor-shell:has(> .season-panel) .rendered-previews-section .carousel-hint {
        display: none !important;
      }

      .editor-shell:has(> .season-panel) .carousel-scroll {
        display: flex !important;
        flex-direction: column !important;
        gap: 8px !important;
        width: 100% !important;
        max-height: 100% !important;
        overflow-x: hidden !important;
        overflow-y: auto !important;
        padding: 2px !important;
      }

      .editor-shell:has(> .season-panel) .carousel-item {
        width: 96px !important;
        max-width: 96px !important;
        margin-inline: auto !important;
        flex: 0 0 auto !important;
      }

      .editor-shell:has(> .season-panel) .carousel-thumb {
        width: 100% !important;
        height: 138px !important;
        object-fit: contain !important;
      }
    }

    /* When the rendered stage itself is narrower, use the abundant vertical
       space for actions instead of squeezing them across the header. */
    @container (max-width: 680px) {
      .editor-shell:has(> .season-panel) .preview-main > .preview-label {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) auto !important;
        align-items: start !important;
        gap: 8px 12px !important;
      }

      .editor-shell:has(> .season-panel) .preview-main .preview-actions {
        grid-column: 2 !important;
        grid-row: 1 / span 3 !important;
        flex-direction: column !important;
        align-items: stretch !important;
        justify-content: flex-start !important;
        width: 132px !important;
        max-width: 132px !important;
        margin: 0 !important;
      }

      .editor-shell:has(> .season-panel) .preview-main .preview-actions .btn-inline,
      .editor-shell:has(> .season-panel) .preview-main .preview-actions .send-logo-toggle {
        width: 132px !important;
        max-width: 132px !important;
        box-sizing: border-box !important;
      }
    }

    /* Only when the preview pane itself is truly narrow does the stage become
       vertical. Current Plex and rendered thumbnails remain grouped together
       beneath the main preview instead of floating independently. */
    @container (max-width: 430px) {
      .editor-shell:has(> .season-panel) .preview-pane {
        overflow-y: auto !important;
      }

      .editor-shell:has(> .season-panel) .preview-inner {
        display: flex !important;
        flex-direction: column !important;
        align-items: stretch !important;
        height: auto !important;
        gap: 18px !important;
      }

      .editor-shell:has(> .season-panel) .preview-main {
        order: 1 !important;
        width: 100% !important;
      }

      .editor-shell:has(> .season-panel) .preview-existing {
        order: 2 !important;
        width: min(180px, 100%) !important;
        max-width: 180px !important;
        align-self: center !important;
      }

      .editor-shell:has(> .season-panel) .rendered-previews-section {
        order: 3 !important;
        width: 100% !important;
        max-width: 100% !important;
      }

      .editor-shell:has(> .season-panel) .carousel-scroll {
        flex-direction: row !important;
        overflow-x: auto !important;
        overflow-y: hidden !important;
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
