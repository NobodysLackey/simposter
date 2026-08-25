import './assets/main.css'
import './assets/synthwave.css'
import './services/titleArticleSortUx'
import './services/audiobookCoverQuality'
import './services/audiobookCoverDiscovery'
import './services/audiobookSecondaryCovers'
import './services/manualLogoUpload'
import './services/logoPlacementDomUx'
import './services/sidebarLibraryRescan'
import './services/libraryNavigationUx'
import './services/libraryNavigationSemanticUx'
import './services/libraryNavigationDirectUx'
import './services/movieEditorUx'
import './services/synthwaveTheme'

import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import { APP_VERSION } from './version'

document.title = `Simposter (${APP_VERSION})`

createApp(App).use(router).mount('#app')
