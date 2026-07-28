import { getApiBase } from './apiBase'

const STYLE_ID = 'simposter-sidebar-rescan-styles'
const BUTTON_ATTRIBUTE = 'data-sidebar-library-rescan'
const apiBase = getApiBase()

let installing = false
let resetTimer: number | null = null

type ScanState = 'idle' | 'running' | 'success' | 'error'

function installStyles(): void {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    .sidebar-rescan-wrap {
      flex-shrink: 0;
      width: 100%;
      margin-top: auto;
      padding-top: 10px;
      border-top: 1px solid var(--border);
    }

    .sidebar-rescan-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      min-height: 40px;
      padding: 9px 10px;
      border: 1px solid rgba(255, 255, 255, .08);
      border-radius: 9px;
      background: rgba(255, 255, 255, .025);
      color: var(--text-secondary, #dbe6ff);
      cursor: pointer;
      font-size: 12px;
      font-weight: 650;
      line-height: 1.2;
      transition: background .18s ease, border-color .18s ease, color .18s ease;
    }

    .sidebar-rescan-btn:hover:not(:disabled) {
      color: var(--accent);
      background: color-mix(in srgb, var(--accent) 8%, transparent);
      border-color: color-mix(in srgb, var(--accent) 28%, var(--border));
    }

    .sidebar-rescan-btn:disabled {
      cursor: wait;
      opacity: .75;
    }

    .sidebar-rescan-btn[data-state='success'] {
      color: #72f1b8;
      border-color: rgba(114, 241, 184, .28);
      background: rgba(114, 241, 184, .07);
    }

    .sidebar-rescan-btn[data-state='error'] {
      color: #ff8fa8;
      border-color: rgba(255, 95, 126, .3);
      background: rgba(255, 95, 126, .075);
    }

    .sidebar-rescan-icon {
      flex: 0 0 auto;
      font-size: 15px;
      line-height: 1;
    }

    .sidebar-rescan-btn[data-state='running'] .sidebar-rescan-icon {
      animation: sidebar-rescan-spin .9s linear infinite;
    }

    .sidebar.collapsed .sidebar-rescan-wrap {
      width: 40px;
      padding-top: 8px;
    }

    .sidebar.collapsed .sidebar-rescan-btn {
      width: 40px;
      height: 40px;
      padding: 0;
    }

    .sidebar.collapsed .sidebar-rescan-label {
      display: none;
    }

    @keyframes sidebar-rescan-spin {
      to { transform: rotate(360deg); }
    }
  `
  document.head.appendChild(style)
}

function setState(
  button: HTMLButtonElement,
  state: ScanState,
  label: string,
  title = label,
): void {
  button.dataset.state = state
  button.disabled = state === 'running'
  button.title = title
  const icon = button.querySelector<HTMLElement>('.sidebar-rescan-icon')
  const text = button.querySelector<HTMLElement>('.sidebar-rescan-label')

  if (icon) {
    icon.textContent = state === 'success' ? '✓' : state === 'error' ? '!' : '↻'
  }
  if (text) text.textContent = label
}

function resetLater(button: HTMLButtonElement): void {
  if (resetTimer !== null) window.clearTimeout(resetTimer)
  resetTimer = window.setTimeout(() => {
    resetTimer = null
    if (button.isConnected) setState(button, 'idle', 'Rescan Libraries')
  }, 4500)
}

async function runScan(button: HTMLButtonElement): Promise<void> {
  if (button.dataset.state === 'running') return
  setState(button, 'running', 'Rescanning…', 'Library rescan in progress')

  try {
    const response = await fetch(`${apiBase}/api/scan-library`, { method: 'POST' })
    let data: any = null
    try {
      data = await response.json()
    } catch {
      data = null
    }

    if (!response.ok) {
      const detail = data?.detail || data?.message || `HTTP ${response.status}`
      throw new Error(String(detail))
    }

    const count = Number(data?.count ?? data?.movies?.length ?? 0)
    const label = count > 0 ? `✓ Rescanned ${count}` : '✓ Rescan complete'
    setState(button, 'success', label, count > 0 ? `Rescanned ${count} library items` : 'Library rescan completed')
    window.dispatchEvent(new CustomEvent('simposter:libraries-rescanned', { detail: data }))
    resetLater(button)
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Unknown error'
    const label = message.toLowerCase().includes('progress') ? 'Scan already running' : '✕ Scan failed'
    setState(button, 'error', label, `Library rescan failed: ${message}`)
    resetLater(button)
  }
}

function makeControl(): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.className = 'sidebar-rescan-wrap'
  wrapper.setAttribute(BUTTON_ATTRIBUTE, 'true')

  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'sidebar-rescan-btn'
  button.dataset.state = 'idle'
  button.title = 'Rescan all configured libraries'

  const icon = document.createElement('span')
  icon.className = 'sidebar-rescan-icon'
  icon.textContent = '↻'

  const label = document.createElement('span')
  label.className = 'sidebar-rescan-label'
  label.textContent = 'Rescan Libraries'

  button.append(icon, label)
  button.addEventListener('click', () => void runScan(button))
  wrapper.appendChild(button)
  return wrapper
}

function installControl(): void {
  if (installing) return
  const sidebar = document.querySelector<HTMLElement>('.sidebar')
  if (!sidebar || sidebar.querySelector(`[${BUTTON_ATTRIBUTE}]`)) return

  installing = true
  sidebar.appendChild(makeControl())
  installing = false
}

function start(): void {
  installStyles()
  installControl()

  const observer = new MutationObserver(() => installControl())
  observer.observe(document.body, { childList: true, subtree: true })
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true })
  else start()
}
