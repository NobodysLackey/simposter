<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getApiBase } from '@/services/apiBase'
import { useNotification } from '@/composables/useNotification'

type PlexLibrary = {
  id: string
  title: string
  type: string
}

type LibraryMapping = {
  id: string
  title: string
  display_name: string
  enabled: boolean
  default_preset_id: string
}

type AudiobookSettings = {
  enabled: boolean
  library_mappings: LibraryMapping[]
  default_preset_id: string
  save_beside_media: boolean
  fallback_save_path: string
  default_text_enabled: boolean
  default_text: string
  default_logo_mode: 'original' | 'match' | 'hex' | 'none'
  default_grain: number
  default_vignette: number
}

type PresetRecord = {
  id: string
  name?: string
}

type LibraryEntry = {
  library: PlexLibrary
  mapping: LibraryMapping
}

const apiBase = getApiBase()
const router = useRouter()
const { success, error: notifyError } = useNotification()

const defaults: AudiobookSettings = {
  enabled: true,
  library_mappings: [],
  default_preset_id: 'default',
  save_beside_media: true,
  fallback_save_path: '/config/output/{library}/{author}/{title}',
  default_text_enabled: true,
  default_text: '{title}\n{author}',
  default_logo_mode: 'none',
  default_grain: 0,
  default_vignette: 20,
}

const settings = ref<AudiobookSettings>({ ...defaults })
const libraries = ref<PlexLibrary[]>([])
const presets = ref<PresetRecord[]>([])
const loading = ref(true)
const saving = ref(false)
const message = ref('')
const errorMessage = ref('')

const displayedPresets = computed<PresetRecord[]>(() =>
  presets.value.length ? presets.value : [{ id: 'default', name: 'Default' }],
)

const enabledMappings = computed(() => settings.value.library_mappings.filter((mapping) => mapping.enabled))

const createMapping = (library: PlexLibrary, enabled = false): LibraryMapping => ({
  id: library.id,
  title: library.title,
  display_name: library.title,
  enabled,
  default_preset_id: '',
})

const libraryEntries = computed<LibraryEntry[]>(() =>
  libraries.value.map((library) => {
    let mapping = settings.value.library_mappings.find(
      (candidate) => String(candidate.id) === String(library.id),
    )
    if (!mapping) {
      mapping = createMapping(library)
      settings.value.library_mappings.push(mapping)
    }
    return { library, mapping }
  }),
)

const loadSettings = async () => {
  const response = await fetch(`${apiBase}/api/audiobook-settings`)
  if (!response.ok) throw new Error(await response.text())
  const data = await response.json()
  settings.value = {
    ...defaults,
    ...data,
    library_mappings: Array.isArray(data.library_mappings) ? data.library_mappings : [],
  }
}

const loadLibraries = async () => {
  const response = await fetch(`${apiBase}/api/audiobook-libraries`)
  if (!response.ok) throw new Error(await response.text())
  libraries.value = await response.json()
}

const loadPresets = async () => {
  const response = await fetch(`${apiBase}/api/presets`)
  if (!response.ok) return
  const data = await response.json()
  presets.value = Array.isArray(data?.audiobookcover?.presets) ? data.audiobookcover.presets : []
}

const save = async () => {
  saving.value = true
  message.value = ''
  errorMessage.value = ''
  try {
    const response = await fetch(`${apiBase}/api/audiobook-settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings.value),
    })
    if (!response.ok) throw new Error(await response.text())
    message.value = 'Audiobook settings saved.'
    success('Audiobook settings saved')
  } catch (cause) {
    const text = cause instanceof Error ? cause.message : 'Could not save audiobook settings.'
    errorMessage.value = text
    notifyError(text)
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    await Promise.all([loadSettings(), loadLibraries(), loadPresets()])
    if (settings.value.library_mappings.length === 0) {
      settings.value.library_mappings = libraries.value.map((library) => createMapping(library, true))
    }
  } catch (cause) {
    errorMessage.value = cause instanceof Error ? cause.message : 'Could not load audiobook settings.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="settings-view">
    <header class="settings-header">
      <div>
        <p class="kicker">Settings</p>
        <h2>🎧 Audiobooks</h2>
        <p class="subtitle">Configure Plex music libraries, editor defaults, presets, and cover save behavior.</p>
      </div>
      <div class="header-actions">
        <button class="secondary" @click="router.push({ name: 'audiobooks' })">Back to Audiobooks</button>
        <button class="primary" :disabled="saving || loading" @click="save">
          {{ saving ? 'Saving…' : 'Save Settings' }}
        </button>
      </div>
    </header>

    <div v-if="loading" class="callout">Loading audiobook settings…</div>
    <div v-else class="settings-content">
      <p v-if="message" class="callout success">{{ message }}</p>
      <p v-if="errorMessage" class="callout error">{{ errorMessage }}</p>

      <section class="section glass">
        <div class="section-heading">
          <div>
            <h3>Audiobook Functionality</h3>
            <p>Controls whether configured music libraries appear in SimPoster.</p>
          </div>
          <label class="toggle-row">
            <input v-model="settings.enabled" type="checkbox" />
            <span>{{ settings.enabled ? 'Enabled' : 'Disabled' }}</span>
          </label>
        </div>
      </section>

      <section class="section glass">
        <div class="section-heading">
          <div>
            <h3>Plex Music Libraries</h3>
            <p>Select which Plex music sections are treated as audiobook libraries.</p>
          </div>
          <span class="count-chip">{{ enabledMappings.length }} enabled</span>
        </div>

        <div v-if="libraryEntries.length" class="library-grid">
          <article v-for="entry in libraryEntries" :key="entry.library.id" class="library-card">
            <label class="library-toggle">
              <input v-model="entry.mapping.enabled" type="checkbox" />
              <strong>{{ entry.library.title }}</strong>
              <span>Library {{ entry.library.id }}</span>
            </label>

            <template v-if="entry.mapping.enabled">
              <label class="field-label">
                Display Name
                <input v-model="entry.mapping.display_name" type="text" />
              </label>
              <label class="field-label">
                Default Preset
                <select v-model="entry.mapping.default_preset_id">
                  <option value="">Use global default</option>
                  <option v-for="preset in displayedPresets" :key="preset.id" :value="preset.id">
                    {{ preset.name || preset.id }}
                  </option>
                </select>
              </label>
            </template>
          </article>
        </div>
        <p v-else class="empty-state">No Plex music libraries were found.</p>
      </section>

      <section class="section glass">
        <div class="section-heading">
          <div>
            <h3>Editor Defaults</h3>
            <p>These values initialize the editor unless the selected preset overrides them.</p>
          </div>
        </div>

        <div class="two-column">
          <label class="field-label">
            Global Default Preset
            <select v-model="settings.default_preset_id">
              <option v-for="preset in displayedPresets" :key="preset.id" :value="preset.id">
                {{ preset.name || preset.id }}
              </option>
            </select>
          </label>

          <label class="field-label">
            Default Logo Mode
            <select v-model="settings.default_logo_mode">
              <option value="none">No Logo</option>
              <option value="original">Keep Original</option>
              <option value="match">Color Match Cover</option>
              <option value="hex">Custom Hex</option>
            </select>
          </label>

          <label class="field-label">
            Default Grain: {{ settings.default_grain }}
            <input v-model.number="settings.default_grain" type="range" min="0" max="60" />
          </label>

          <label class="field-label">
            Default Vignette: {{ settings.default_vignette }}
            <input v-model.number="settings.default_vignette" type="range" min="0" max="100" />
          </label>
        </div>

        <label class="toggle-row text-toggle">
          <input v-model="settings.default_text_enabled" type="checkbox" />
          <span>Enable custom text by default</span>
        </label>
        <label v-if="settings.default_text_enabled" class="field-label">
          Default Cover Text
          <textarea v-model="settings.default_text" rows="4"></textarea>
          <small>Variables: {title}, {author}, {narrator}, {series}, {series_number}, {year}</small>
        </label>
      </section>

      <section class="section glass">
        <div class="section-heading">
          <div>
            <h3>Saving Covers</h3>
            <p>Choose where SimPoster writes the generated cover file.</p>
          </div>
        </div>

        <label class="toggle-row text-toggle">
          <input v-model="settings.save_beside_media" type="checkbox" />
          <span>Save cover beside the audiobook media when its Plex path is mounted</span>
        </label>

        <label class="field-label">
          Fallback Save Directory
          <input v-model="settings.fallback_save_path" type="text" />
          <small>Variables: {library}, {author}, {title}, {year}, {key}. SimPoster appends cover and the configured output extension.</small>
        </label>
      </section>

      <footer class="sticky-actions">
        <button class="secondary" @click="router.push({ name: 'audiobooks' })">Cancel</button>
        <button class="primary" :disabled="saving" @click="save">{{ saving ? 'Saving…' : 'Save Settings' }}</button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.settings-view { display: flex; flex-direction: column; gap: 18px; height: 100%; overflow-y: auto; padding-bottom: 26px; color: var(--text-primary); }
.settings-header { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 20px 24px; border-bottom: 1px solid var(--border); background: var(--surface); }
.kicker { margin: 0 0 4px; color: var(--accent); font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.2px; }
h2, h3, p { margin: 0; }
h2 { font-size: 28px; }
.subtitle, .section-heading p, small { color: var(--muted); }
.header-actions { display: flex; gap: 10px; }
.settings-content { display: grid; gap: 16px; padding: 0 24px; }
.section { padding: 20px; border-radius: 14px; }
.section-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
.section-heading h3 { margin-bottom: 4px; font-size: 18px; }
.toggle-row { display: inline-flex; align-items: center; gap: 9px; color: #dce6ff; font-weight: 600; }
.toggle-row input { width: 18px; height: 18px; }
.text-toggle { margin-bottom: 16px; }
.count-chip { padding: 5px 9px; border-radius: 999px; background: rgba(61,214,183,.12); color: var(--accent); font-size: 12px; }
.library-grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(260px,1fr)); gap: 14px; }
.library-card { padding: 16px; border: 1px solid var(--border); border-radius: 12px; background: rgba(255,255,255,.025); }
.library-toggle { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 4px 9px; margin-bottom: 14px; }
.library-toggle input { grid-row: 1 / 3; width: 18px; height: 18px; }
.library-toggle span { color: var(--muted); font-size: 11px; }
.field-label { display: flex; flex-direction: column; gap: 7px; margin-bottom: 14px; color: #dce6ff; font-size: 13px; font-weight: 600; }
.field-label input[type='text'], .field-label select, .field-label textarea { width: 100%; padding: 9px 10px; border: 1px solid var(--border); border-radius: 8px; background: rgba(255,255,255,.04); color: #eef2ff; }
.field-label textarea { resize: vertical; }
.two-column { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 0 18px; }
.primary, .secondary { padding: 10px 15px; border-radius: 9px; font-weight: 700; cursor: pointer; }
.primary { border: 0; background: linear-gradient(120deg,#3dd6b7,#5b8dee); color: white; }
.secondary { border: 1px solid var(--border); background: rgba(255,255,255,.04); color: #dce6ff; }
button:disabled { opacity: .5; cursor: not-allowed; }
.callout { margin: 0 24px; padding: 13px 15px; border: 1px solid var(--border); border-radius: 10px; background: rgba(255,255,255,.03); }
.callout.success { border-color: rgba(61,214,183,.35); color: #78e3c1; }
.callout.error { border-color: rgba(255,100,100,.35); color: #ffaaaa; }
.empty-state { padding: 24px; text-align: center; color: var(--muted); }
.sticky-actions { position: sticky; bottom: 0; display: flex; justify-content: flex-end; gap: 10px; padding: 14px; border: 1px solid var(--border); border-radius: 12px; background: rgba(15,17,23,.95); backdrop-filter: blur(10px); }
@media (max-width: 760px) { .settings-header { align-items: flex-start; flex-direction: column; } .header-actions { width: 100%; } .header-actions button { flex: 1; } .two-column { grid-template-columns: 1fr; } .settings-content { padding: 0 14px; } .callout { margin: 0 14px; } }
</style>
