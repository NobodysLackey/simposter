const STYLE_ID = 'simposter-tv-editor-layout-styles'

const installStyles = () => {
  if (document.getElementById(STYLE_ID)) return

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
@media (min-width: 901px) {
  .editor-shell:has(> .season-panel) {
    display: grid !important;
    grid-template-columns: clamp(330px, 34%, 420px) minmax(0, 1fr) !important;
    grid-template-rows: 104px minmax(0, 1fr) !important;
    min-width: 0 !important;
    min-height: 0 !important;
    height: 100% !important;
    overflow: hidden !important;
  }

  .editor-shell:has(> .season-panel) > .controls-sidebar {
    grid-column: 1 !important;
    grid-row: 1 / -1 !important;
    min-width: 0 !important;
    min-height: 0 !important;
  }

  .editor-shell:has(> .season-panel) > .season-panel {
    grid-column: 2 !important;
    grid-row: 1 !important;
    display: grid !important;
    grid-template-columns: 104px minmax(185px, 235px) minmax(0, 1fr) !important;
    grid-template-rows: 104px !important;
    width: 100% !important;
    height: 104px !important;
    min-width: 0 !important;
    min-height: 0 !important;
    overflow: hidden !important;
    border-right: 0 !important;
    border-bottom: 1px solid var(--border) !important;
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

  .editor-shell:has(> .season-panel) .season-title,
  .editor-shell:has(> .season-panel) .season-controls {
    justify-content: center !important;
    text-align: center !important;
  }

  .editor-shell:has(> .season-panel) .current-season-banner {
    grid-column: 2 !important;
    height: 100% !important;
    min-width: 0 !important;
    padding: 10px 12px !important;
    box-sizing: border-box !important;
    border-top: 0 !important;
    border-bottom: 0 !important;
    border-right: 1px solid var(--border) !important;
  }

  .editor-shell:has(> .season-panel) .season-list {
    grid-column: 3 !important;
    display: flex !important;
    flex-direction: row !important;
    align-items: center !important;
    gap: 8px !important;
    min-width: 0 !important;
    min-height: 0 !important;
    padding: 8px 10px !important;
    overflow-x: auto !important;
    overflow-y: hidden !important;
  }

  .editor-shell:has(> .season-panel) .season-item {
    flex: 0 0 116px !important;
    width: 116px !important;
    height: 82px !important;
    margin: 0 !important;
    padding: 6px !important;
    box-sizing: border-box !important;
  }

  .editor-shell:has(> .season-panel) .season-thumb-wrap {
    width: 42px !important;
    height: 64px !important;
  }

  .editor-shell:has(> .season-panel) > .preview-pane {
    grid-column: 2 !important;
    grid-row: 2 !important;
    container-type: inline-size;
    width: 100% !important;
    height: 100% !important;
    min-width: 0 !important;
    min-height: 0 !important;
    box-sizing: border-box !important;
    padding: 18px 22px 22px !important;
    overflow: hidden !important;
    align-items: stretch !important;
    justify-content: stretch !important;
  }

  .editor-shell:has(> .season-panel) .preview-inner {
    display: grid !important;
    grid-template-columns: minmax(340px, 660px) 220px !important;
    grid-template-rows: auto auto !important;
    column-gap: 20px !important;
    row-gap: 14px !important;
    justify-content: center !important;
    align-content: start !important;
    align-items: start !important;
    width: min(100%, 900px) !important;
    max-width: 900px !important;
    height: 100% !important;
    min-width: 0 !important;
    min-height: 0 !important;
    margin: 0 auto !important;
    box-sizing: border-box !important;
  }

  .editor-shell:has(> .season-panel) .preview-content-wrapper {
    display: contents !important;
  }

  .editor-shell:has(> .season-panel) .preview-main {
    --tv-poster-width: min(100%, 660px, calc(66.667vh - 210px));
    grid-column: 1 !important;
    grid-row: 1 / span 2 !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: flex-start !important;
    width: 100% !important;
    max-width: 660px !important;
    min-width: 0 !important;
    min-height: 0 !important;
    margin: 0 !important;
  }

  .editor-shell:has(> .season-panel) .preview-main > .preview-label {
    width: var(--tv-poster-width) !important;
    max-width: 100% !important;
    min-width: 0 !important;
    margin: 0 auto 10px !important;
    display: flex !important;
    align-items: center !important;
    flex-wrap: nowrap !important;
    gap: 7px !important;
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

  .editor-shell:has(> .season-panel) .preview-container {
    width: var(--tv-poster-width) !important;
    height: auto !important;
    max-width: 100% !important;
    max-height: none !important;
    aspect-ratio: 2 / 3 !important;
    flex: 0 0 auto !important;
    margin: 0 auto !important;
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

  .editor-shell:has(> .season-panel) .preview-existing {
    grid-column: 2 !important;
    grid-row: 1 !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    width: 220px !important;
    max-width: 220px !important;
    min-width: 0 !important;
    margin: 0 !important;
    padding: 12px !important;
    box-sizing: border-box !important;
    border: 1px solid var(--border) !important;
    border-radius: 10px !important;
    background: rgba(255, 255, 255, 0.025) !important;
    text-align: center !important;
  }

  .editor-shell:has(> .season-panel) .preview-existing > .preview-label {
    width: 100% !important;
    margin: 0 0 8px !important;
    justify-content: center !important;
  }

  .editor-shell:has(> .season-panel) .preview-existing > .preview-label:nth-of-type(2) {
    margin-top: 12px !important;
  }

  .editor-shell:has(> .season-panel) .preview-existing .existing-img {
    width: 118px !important;
    max-width: 118px !important;
    height: auto !important;
    aspect-ratio: 2 / 3 !important;
    object-fit: cover !important;
  }

  .editor-shell:has(> .season-panel) .preview-existing .existing-logo-area {
    width: 100% !important;
    max-width: 170px !important;
    min-height: 54px !important;
    margin: 0 auto !important;
  }

  .editor-shell:has(> .season-panel) .rendered-previews-section {
    grid-column: 2 !important;
    grid-row: 2 !important;
    display: flex !important;
    flex-direction: column !important;
    width: 220px !important;
    max-width: 220px !important;
    min-width: 0 !important;
    min-height: 0 !important;
    margin: 0 !important;
    padding: 12px !important;
    box-sizing: border-box !important;
    border: 1px solid var(--border) !important;
    border-radius: 10px !important;
    background: rgba(255, 255, 255, 0.025) !important;
    overflow: hidden !important;
  }

  .editor-shell:has(> .season-panel) .rendered-previews-section .carousel-label {
    margin: 0 0 8px !important;
    line-height: 1.25 !important;
  }

  .editor-shell:has(> .season-panel) .rendered-previews-section .carousel-hint {
    display: block !important;
    margin-top: 3px !important;
  }

  .editor-shell:has(> .season-panel) .carousel-scroll {
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 8px !important;
    width: 100% !important;
    max-height: 390px !important;
    overflow-x: hidden !important;
    overflow-y: auto !important;
    padding: 2px !important;
  }

  .editor-shell:has(> .season-panel) .carousel-item {
    width: 100% !important;
    max-width: none !important;
    min-width: 0 !important;
    margin: 0 !important;
  }

  .editor-shell:has(> .season-panel) .carousel-thumb {
    width: 100% !important;
    height: auto !important;
    aspect-ratio: 2 / 3 !important;
    object-fit: cover !important;
  }
}

@container (max-width: 760px) {
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

@container (max-width: 560px) {
  .editor-shell:has(> .season-panel) > .preview-pane {
    overflow-y: auto !important;
  }

  .editor-shell:has(> .season-panel) .preview-inner {
    grid-template-columns: minmax(0, 1fr) !important;
    grid-template-rows: auto auto auto !important;
    width: 100% !important;
    max-width: 660px !important;
    height: auto !important;
    gap: 14px !important;
  }

  .editor-shell:has(> .season-panel) .preview-main {
    grid-column: 1 !important;
    grid-row: 1 !important;
  }

  .editor-shell:has(> .season-panel) .preview-existing {
    grid-column: 1 !important;
    grid-row: 2 !important;
    display: grid !important;
    grid-template-columns: 110px minmax(0, 1fr) !important;
    grid-template-rows: auto auto !important;
    gap: 6px 12px !important;
    width: 100% !important;
    max-width: 100% !important;
    align-items: center !important;
  }

  .editor-shell:has(> .season-panel) .preview-existing > .preview-label:first-child {
    grid-column: 1 !important;
    grid-row: 1 !important;
  }

  .editor-shell:has(> .season-panel) .preview-existing .existing-img {
    grid-column: 1 !important;
    grid-row: 2 !important;
    width: 96px !important;
  }

  .editor-shell:has(> .season-panel) .preview-existing > .preview-label:nth-of-type(2) {
    grid-column: 2 !important;
    grid-row: 1 !important;
    margin-top: 0 !important;
  }

  .editor-shell:has(> .season-panel) .preview-existing .existing-logo-area {
    grid-column: 2 !important;
    grid-row: 2 !important;
  }

  .editor-shell:has(> .season-panel) .rendered-previews-section {
    grid-column: 1 !important;
    grid-row: 3 !important;
    width: 100% !important;
    max-width: 100% !important;
  }

  .editor-shell:has(> .season-panel) .carousel-scroll {
    display: flex !important;
    flex-direction: row !important;
    max-height: none !important;
    overflow-x: auto !important;
    overflow-y: hidden !important;
  }

  .editor-shell:has(> .season-panel) .carousel-item {
    flex: 0 0 76px !important;
    width: 76px !important;
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
