import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { UIJarModule } from 'ui-jar';

enableProdMode();
platformBrowserDynamic().bootstrapModule(UIJarModule);
