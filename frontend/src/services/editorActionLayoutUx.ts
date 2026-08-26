const STYLE_ID = 'simposter-editor-action-layout-styles'

const installStyles = () => {
  if (document.getElementById(STYLE_ID)) return

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    .editor-shell .preview-main {
      container-type: inline-size;
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

    @container (max-width: 620px) {
      .editor-shell .preview-actions {
        display: flex !important;
        flex-direction: column;
        flex-wrap: nowrap !important;
        align-items: stretch;
        justify-content: flex-start !important;
        gap: 7px !important;
      }

      .editor-shell .preview-actions .btn-inline {
        width: 100%;
        min-width: 132px;
        justify-content: center;
      }
    }

    @container (max-width: 390px) {
      .editor-shell .preview-label {
        display: grid !important;
        grid-template-columns: auto 1fr;
        gap: 8px;
      }

      .editor-shell .preview-actions {
        grid-column: 1 / -1;
        width: 100%;
        margin-left: 0 !important;
      }

      .editor-shell .preview-actions .btn-inline {
        min-width: 0;
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
