import { router } from '../router'

const STYLE_ID = 'simposter-library-navigation-direct-ux-styles'

const installStyles = () => {
  if (document.getElementById(STYLE_ID)) return

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    .main-pane > .view {
      min-height: 100%;
    }

    .toolbar.pagination.simposter-library-navigation {
      position: static !important;
      inset: auto !important;
      left: auto !important;
      right: auto !important;
      bottom: auto !important;
      width: 100% !important;
      max-width: 100% !important;
      align-self: stretch;
      box-sizing: border-box;
      margin: auto 0 0 !important;
      z-index: auto;
    }
  `
  document.head.appendChild(style)
}

const normalizeLayout = () => {
  const footer = document.querySelector<HTMLElement>(
    '.view > .toolbar.pagination.simposter-library-navigation',
  )
  if (!footer) return

  footer.style.removeProperty('left')
  footer.style.removeProperty('right')
  footer.style.removeProperty('bottom')
  footer.style.removeProperty('width')
  footer.style.removeProperty('max-width')

  const view = footer.closest<HTMLElement>('.view')
  view?.style.removeProperty('padding-bottom')
}

const jumpDirectly = (targetPage: number) => {
  const route = router.currentRoute.value
  const query = { ...route.query }

  if (targetPage <= 1) delete query.page
  else query.page = String(targetPage)

  void router.replace({
    path: route.path,
    query,
    hash: route.hash,
  })
}

const start = () => {
  installStyles()
  normalizeLayout()

  const observer = new MutationObserver(() => normalizeLayout())
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style'],
  })

  router.afterEach(() => window.requestAnimationFrame(normalizeLayout))
  window.addEventListener('resize', normalizeLayout)

  document.addEventListener(
    'click',
    (event) => {
      const target = event.target
      if (!(target instanceof Element)) return

      const jumpButton = target.closest<HTMLButtonElement>('.simposter-library-jump')
      if (!jumpButton) return

      const targetPage = Number(jumpButton.dataset.page)
      if (!Number.isFinite(targetPage) || targetPage < 1) return

      event.preventDefault()
      event.stopImmediatePropagation()
      jumpDirectly(targetPage)
    },
    true,
  )
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true })
  } else {
    start()
  }
}
