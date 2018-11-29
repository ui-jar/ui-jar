import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { RouterModule } from '@angular/router';
import { ContainerComponent } from './container/container.component';
import { AppComponent } from './app.component';
import { IntroductionComponent } from './introduction/introduction.component';
import { OverviewComponent } from './overview/overview.component';
import { ApiComponent } from './api/api.component';
import { ExamplesModule } from './examples/examples.module';
import { AppConfig } from './app-config.interface';

let generatedOutput = require('../../../temp/__ui-jar-temp');

declare const UIJarConfiguration: AppConfig;

@NgModule({
    imports: [
        BrowserModule,
        BrowserAnimationsModule,
        ExamplesModule,
        RouterModule.forRoot([
            { path: '', component: IntroductionComponent },
            {
                path: ':component',
                component: ContainerComponent,
                children: [
                    {
                        path: '',
                        pathMatch: 'full',
                        redirectTo: 'overview'
                    },
                    {
                        path: 'overview',
                        component: OverviewComponent
                    },
                    {
                        path: 'api',
                        component: ApiComponent
                    }
                ]
            }
        ], { initialNavigation: false })
    ],
    declarations: [
        ContainerComponent,
        AppComponent,
        IntroductionComponent,
        OverviewComponent,
        ApiComponent
    ],
    bootstrap: [
        AppComponent
    ],
    providers: [
        { provide: 'AppData', useFactory: generatedOutput.getAppData },
        { provide: 'AppConfig', useValue: typeof UIJarConfiguration !== 'undefined' ? UIJarConfiguration : {} }
    ]
})
export class UIJarModule {

}
