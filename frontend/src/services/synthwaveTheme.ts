const SYNTHWAVE_THEME_VALUE = 'synthwave'
const SYNTHWAVE_THEME_LABEL = 'Synthwave Glow'
const THEME_OPTION_ATTRIBUTE = 'data-simposter-synthwave-theme'

function isThemeSelect(select: HTMLSelectElement): boolean {
  const values = Array.from(select.options).map((option) => option.value)
  return values.includes('neon') && values.includes('slate') && values.includes('dracula')
}

function installThemeOption(select: HTMLSelectElement): void {
  if (select.querySelector(`option[${THEME_OPTION_ATTRIBUTE}]`)) return

  const option = document.createElement('option')
  option.value = SYNTHWAVE_THEME_VALUE
  option.textContent = SYNTHWAVE_THEME_LABEL
  option.setAttribute(THEME_OPTION_ATTRIBUTE, 'true')

  const lightOption = Array.from(select.options).find((entry) => entry.value === 'light')
  if (lightOption) {
    select.insertBefore(option, lightOption)
  } else {
    select.appendChild(option)
  }

  if (document.documentElement.dataset.theme === SYNTHWAVE_THEME_VALUE) {
    select.value = SYNTHWAVE_THEME_VALUE
  }
}

function scanThemeSelects(root: ParentNode = document): void {
  root.querySelectorAll<HTMLSelectElement>('select').forEach((select) => {
    if (isThemeSelect(select)) installThemeOption(select)
  })
}

function startThemeOptionObserver(): void {
  scanThemeSelects()

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return
        if (node instanceof HTMLSelectElement && isThemeSelect(node)) {
          installThemeOption(node)
        }
        scanThemeSelects(node)
      })
    })
  })

  observer.observe(document.body, { childList: true, subtree: true })
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startThemeOptionObserver, { once: true })
  } else {
    startThemeOptionObserver()
  }
}
