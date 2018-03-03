import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { UIJarModule } from 'ui-jar';

import '../node_modules/ui-jar/dist/src/styles/default.css'; // default UI-jar theme

enableProdMode();
platformBrowserDynamic().bootstrapModule(UIJarModule);
