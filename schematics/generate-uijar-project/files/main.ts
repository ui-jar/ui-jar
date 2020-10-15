import { enableProdMode } from '@angular/core'
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic'
import { environment } from './environments/environment'
import { UIJarModule } from 'ui-jar'

if (environment.production) {
  enableProdMode()
}

platformBrowserDynamic().bootstrapModule(UIJarModule)
