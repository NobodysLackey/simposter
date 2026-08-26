const STYLE_ID = 'simposter-editor-action-layout-styles'

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
      container-type: inline-size;
      min-width: 0 !important;
      max-width: 100% !important;
    }

    .editor-shell .preview-label {
      min-width: 0;
      flex-wrap: wrap;
      align-items: flex-start;
    }

    .editor-shell .preview-actions {
      min-width: 0;
      max-width: 100%;
    }

    .editor-shell .preview-actions .btn-inline {
      white-space: nowrap;
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

    /* Keep actions compact. They can stack without turning into giant bars. */
    @container (max-width: 620px) {
      .editor-shell .preview-label {
        align-items: flex-start !important;
      }

      .editor-shell .preview-actions {
        display: flex !important;
        flex-direction: column;
        flex-wrap: nowrap !important;
        align-items: stretch;
        justify-content: flex-start !important;
        width: auto !important;
        max-width: 170px !important;
        margin-left: auto !important;
        gap: 7px !important;
      }

      .editor-shell .preview-actions .btn-inline {
        width: auto !important;
        min-width: 140px;
        max-width: 170px;
        justify-content: center;
      }
    }

    /* Only at genuinely phone-sized pane widths should actions consume the
       row beneath the label. */
    @container (max-width: 360px) {
      .editor-shell .preview-label {
        display: flex !important;
        flex-direction: column;
        align-items: stretch !important;
        gap: 8px;
      }

      .editor-shell .preview-actions {
        width: 100% !important;
        max-width: none !important;
        margin-left: 0 !important;
      }

      .editor-shell .preview-actions .btn-inline {
        width: 100% !important;
        min-width: 0;
        max-width: none;
      }
    }
  `

  document.head.appendChild(style)
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installStyles, { once: true })
  } else {
    installStyles()
  }
}
