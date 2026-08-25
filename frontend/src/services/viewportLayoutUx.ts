const STYLE_ID = 'simposter-viewport-layout-styles'

const installStyles = () => {
  if (document.getElementById(STYLE_ID)) return

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    html,
    body,
    #app {
      width: 100%;
      height: 100%;
      min-height: 0 !important;
      overflow: hidden !important;
    }

    body {
      min-height: 0 !important;
    }

    #app {
      height: 100dvh;
      min-height: 0 !important;
      overflow: hidden !important;
    }

    .shell {
      height: 100% !important;
      min-height: 0 !important;
      max-height: 100% !important;
      overflow: hidden !important;
    }

    .shell > .top-nav {
      flex: 0 0 auto;
    }

    .workspace {
      flex: 1 1 auto !important;
      height: auto !important;
      min-height: 0 !important;
      max-height: 100% !important;
      overflow: hidden !important;
    }

    .workspace > * {
      min-height: 0;
    }

    .main-pane {
      min-width: 0;
      min-height: 0 !important;
      height: auto !important;
      max-height: 100% !important;
      overflow: auto;
      overscroll-behavior: contain;
    }

    /* Library pages: toolbar and pager stay put; only the media grid scrolls. */
    .main-pane:has(> .view > .grid-block) {
      overflow: hidden !important;
    }

    .main-pane > .view:has(> .grid-block) {
      display: flex !important;
      flex-direction: column;
      height: 100% !important;
      min-height: 0 !important;
      overflow: hidden !important;
      padding-bottom: 0 !important;
    }

    .main-pane > .view:has(> .grid-block) > .toolbar:not(.pagination) {
      flex: 0 0 auto;
    }

    .main-pane > .view:has(> .grid-block) > .grid-block {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
      overscroll-behavior: contain;
      padding-right: 2px;
    }

    .main-pane > .view:has(> .grid-block) > .toolbar.pagination.simposter-library-navigation {
      position: static !important;
      inset: auto !important;
      left: auto !important;
      right: auto !important;
      bottom: auto !important;
      width: 100% !important;
      max-width: none !important;
      flex: 0 0 auto;
      margin: 0 !important;
      box-sizing: border-box;
    }

    /* Editor pages use the workspace height directly; no viewport math or page overflow. */
    .workspace:has(.editor-shell) {
      flex: 1 1 auto !important;
      height: auto !important;
      min-height: 0 !important;
      max-height: 100% !important;
      overflow: hidden !important;
    }

    .main-pane:has(.editor-shell) {
      height: auto !important;
      min-height: 0 !important;
      max-height: 100% !important;
      overflow: hidden !important;
    }

    .main-pane:has(.editor-shell) .editor-shell {
      height: 100% !important;
      min-height: 0 !important;
      max-height: 100% !important;
    }

    @media (max-width: 900px) {
      .main-pane > .view:has(> .grid-block) > .grid-block {
        padding-right: 0;
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
