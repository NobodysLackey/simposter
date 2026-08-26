const STYLE_ID = 'simposter-tv-editor-vertical-density-styles'

const installStyles = () => {
  if (document.getElementById(STYLE_ID)) return

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    /*
      TV editor vertical allocation refinement.

      The season picker gets the vertical space we actually want to use.
      The utility column beside the rendered poster is bounded to roughly
      the poster's height, and render history scrolls internally when needed.
    */
    @media (min-width: 901px) {
      .editor-shell:has(> .season-panel) > .season-panel {
        max-height: min(52dvh, 760px) !important;
      }

      .editor-shell:has(> .season-panel) .season-list {
        max-height: calc(min(52dvh, 760px) - 40px) !important;
      }

      .editor-shell:has(> .season-panel) .preview-inner {
        height: auto !important;
        min-height: 0 !important;
        align-content: start !important;
      }

      .editor-shell:has(> .season-panel) .rendered-previews-section {
        align-self: start !important;
        height: clamp(180px, calc(93dvh - 310px), 480px) !important;
        min-height: 180px !important;
        max-height: 480px !important;
      }

      .editor-shell:has(> .season-panel) .rendered-previews-section .carousel-scroll {
        flex: 1 1 auto !important;
        min-height: 0 !important;
        max-height: 100% !important;
        overflow-x: hidden !important;
        overflow-y: auto !important;
        overscroll-behavior: contain;
      }
    }

    /* Preserve preview usability on shorter desktop windows. */
    @media (min-width: 901px) and (max-height: 1000px) {
      .editor-shell:has(> .season-panel) > .season-panel {
        max-height: 40dvh !important;
      }

      .editor-shell:has(> .season-panel) .season-list {
        max-height: calc(40dvh - 40px) !important;
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
