type EffectValues = {
  matte: number
  fade: number
  vignette: number
  grain: number
}

type EffectControl = {
  slider: HTMLElement
  range: HTMLInputElement | null
  number: HTMLInputElement | null
}

const STYLE_ID = 'simposter-matte-toggle-styles'
const TOGGLE_CLASS = 'simposter-matte-toggle'

const DEFAULT_EFFECTS: EffectValues = {
  matte: 0,
  fade: 15,
  vignette: 15,
  grain: 15,
}

const ZERO_EFFECTS: EffectValues = {
  matte: 0,
  fade: 0,
  vignette: 0,
  grain: 0,
}

const LABELS: Record<keyof EffectValues, string> = {
  matte: 'Matte Height %',
  fade: 'Fade Height %',
  vignette: 'Vignette',
  grain: 'Grain',
}

const rememberedValues = new WeakMap<HTMLElement, EffectValues>()
const applyingEditors = new WeakSet<HTMLElement>()

const installStyles = () => {
  if (document.getElementById(STYLE_ID)) return

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    .${TOGGLE_CLASS} {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      margin: 4px 0 2px;
      padding: 12px 2px 2px;
      border-top: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
    }

    .${TOGGLE_CLASS} .simposter-matte-label {
      color: #dce6ff;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: .1px;
      user-select: none;
    }

    .${TOGGLE_CLASS} .simposter-ios-switch {
      position: relative;
      display: inline-flex;
      width: 48px;
      height: 28px;
      flex: 0 0 auto;
      cursor: pointer;
    }

    .${TOGGLE_CLASS} .simposter-ios-switch input {
      position: absolute;
      width: 1px;
      height: 1px;
      opacity: 0;
      pointer-events: none;
    }

    .${TOGGLE_CLASS} .simposter-switch-track {
      position: absolute;
      inset: 0;
      border: 1px solid color-mix(in srgb, var(--border) 70%, white 8%);
      border-radius: 999px;
      background: rgba(255, 255, 255, .08);
      box-shadow: inset 0 0 0 1px rgba(255,255,255,.025);
      transition: background .2s ease, border-color .2s ease, box-shadow .2s ease;
    }

    .${TOGGLE_CLASS} .simposter-switch-track::before {
      content: '';
      position: absolute;
      top: 3px;
      left: 3px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #f8f9ff;
      box-shadow: 0 2px 7px rgba(0,0,0,.38);
      transition: transform .2s cubic-bezier(.2,.8,.2,1);
    }

    .${TOGGLE_CLASS} input:checked + .simposter-switch-track {
      border-color: color-mix(in srgb, var(--accent) 70%, white 8%);
      background: linear-gradient(120deg, var(--accent), var(--accent-2));
      box-shadow: 0 0 14px color-mix(in srgb, var(--accent) 28%, transparent);
    }

    .${TOGGLE_CLASS} input:checked + .simposter-switch-track::before {
      transform: translateX(20px);
    }

    .${TOGGLE_CLASS} input:focus-visible + .simposter-switch-track {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
  `

  document.head.appendChild(style)
}

const findControl = (editor: HTMLElement, labelText: string): EffectControl | null => {
  const sliders = Array.from(editor.querySelectorAll<HTMLElement>('.slider'))
  const slider = sliders.find((candidate) => candidate.querySelector('label')?.textContent?.trim() === labelText)
  if (!slider) return null

  return {
    slider,
    range: slider.querySelector<HTMLInputElement>('input[type="range"]'),
    number: slider.querySelector<HTMLInputElement>('input[type="number"]'),
  }
}

const findControls = (editor: HTMLElement): Record<keyof EffectValues, EffectControl> | null => {
  const matte = findControl(editor, LABELS.matte)
  const fade = findControl(editor, LABELS.fade)
  const vignette = findControl(editor, LABELS.vignette)
  const grain = findControl(editor, LABELS.grain)

  if (!matte || !fade || !vignette || !grain) return null
  return { matte, fade, vignette, grain }
}

const readControlValue = (control: EffectControl) => {
  const raw = control.number?.value ?? control.range?.value ?? '0'
  const value = Number(raw)
  return Number.isFinite(value) ? value : 0
}

const readValues = (controls: Record<keyof EffectValues, EffectControl>): EffectValues => ({
  matte: readControlValue(controls.matte),
  fade: readControlValue(controls.fade),
  vignette: readControlValue(controls.vignette),
  grain: readControlValue(controls.grain),
})

const valuesAreZero = (values: EffectValues) =>
  values.matte === 0 && values.fade === 0 && values.vignette === 0 && values.grain === 0

const applyControlValue = (control: EffectControl, value: number) => {
  const text = String(value)
  if (control.range) control.range.value = text
  if (control.number) control.number.value = text

  const source = control.range || control.number
  if (!source) return
  source.dispatchEvent(new Event('input', { bubbles: true }))
  source.dispatchEvent(new Event('change', { bubbles: true }))
}

const applyValues = (
  editor: HTMLElement,
  controls: Record<keyof EffectValues, EffectControl>,
  values: EffectValues,
) => {
  applyingEditors.add(editor)
  try {
    applyControlValue(controls.matte, values.matte)
    applyControlValue(controls.fade, values.fade)
    applyControlValue(controls.vignette, values.vignette)
    applyControlValue(controls.grain, values.grain)
  } finally {
    applyingEditors.delete(editor)
  }
}

const syncToggleFromControls = (editor: HTMLElement) => {
  if (applyingEditors.has(editor)) return

  const controls = findControls(editor)
  const checkbox = editor.querySelector<HTMLInputElement>(`.${TOGGLE_CLASS} input[type="checkbox"]`)
  if (!controls || !checkbox) return

  const current = readValues(controls)
  const isOn = !valuesAreZero(current)

  // The four effect fields are the source of truth. This deliberately repairs
  // stale switch state after Vue loads a preset by assigning input values
  // programmatically (which does not necessarily emit a DOM input event).
  checkbox.checked = isOn

  // Whenever real effect values exist, keep the exact combination as the
  // restore snapshot. Zeroing the controls never overwrites this snapshot.
  if (isOn) rememberedValues.set(editor, { ...current })
}

const ensureToggle = (editor: HTMLElement) => {
  const controls = findControls(editor)
  if (!controls) return

  const current = readValues(controls)
  const existing = editor.querySelector<HTMLElement>(`.${TOGGLE_CLASS}`)
  if (existing) {
    syncToggleFromControls(editor)
    return
  }

  if (!valuesAreZero(current)) rememberedValues.set(editor, { ...current })

  const toggleRow = document.createElement('div')
  toggleRow.className = TOGGLE_CLASS

  const label = document.createElement('span')
  label.className = 'simposter-matte-label'
  label.textContent = 'Matte'

  const switchLabel = document.createElement('label')
  switchLabel.className = 'simposter-ios-switch'
  switchLabel.title = 'Toggle matte, fade, vignette, and grain effects'

  const checkbox = document.createElement('input')
  checkbox.type = 'checkbox'
  checkbox.checked = !valuesAreZero(current)
  checkbox.setAttribute('aria-label', 'Matte')

  const track = document.createElement('span')
  track.className = 'simposter-switch-track'

  checkbox.addEventListener('change', () => {
    const liveControls = findControls(editor)
    if (!liveControls) return

    const currentValues = readValues(liveControls)

    if (checkbox.checked) {
      // If a stale OFF switch somehow survives while the fields are already
      // non-zero, never replace those live preset values with defaults.
      if (!valuesAreZero(currentValues)) {
        rememberedValues.set(editor, { ...currentValues })
        checkbox.checked = true
        return
      }

      applyValues(editor, liveControls, rememberedValues.get(editor) || DEFAULT_EFFECTS)
      checkbox.checked = true
      return
    }

    // OFF always snapshots the exact live values first, then zeros all four.
    if (!valuesAreZero(currentValues)) {
      rememberedValues.set(editor, { ...currentValues })
    }
    applyValues(editor, liveControls, ZERO_EFFECTS)
    checkbox.checked = false
  })

  switchLabel.append(checkbox, track)
  toggleRow.append(label, switchLabel)
  controls.grain.slider.insertAdjacentElement('afterend', toggleRow)
}

let scheduled = false
const run = () => {
  scheduled = false
  document.querySelectorAll<HTMLElement>('.editor-shell').forEach((editor) => ensureToggle(editor))
}

const schedule = () => {
  if (scheduled) return
  scheduled = true
  window.requestAnimationFrame(run)
}

const start = () => {
  installStyles()
  schedule()

  const observer = new MutationObserver(() => schedule())
  observer.observe(document.body, { childList: true, subtree: true })

  const syncFromEvent = (event: Event) => {
    const target = event.target
    if (!(target instanceof HTMLInputElement)) return

    const editor = target.closest<HTMLElement>('.editor-shell')
    if (!editor || !target.closest('.slider')) return
    syncToggleFromControls(editor)
  }

  document.addEventListener('input', syncFromEvent)
  document.addEventListener('change', syncFromEvent)

  // Vue can update v-model-backed input.value properties without generating a
  // DOM mutation or input event. Four numeric reads per open editor at this
  // cadence are negligible and keep the switch truthfully synchronized with
  // loaded presets, season changes, and movie/audiobook editor changes.
  window.setInterval(schedule, 250)
  window.addEventListener('focus', schedule)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) schedule()
  })
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true })
  } else {
    start()
  }
}
