import { NgModule, Inject } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { ContainerComponent } from './container/container.component';
import { AppComponent } from './app.component';
import { CodeExampleComponent } from './code-example/code-example.component';
import { IntroductionComponent } from './introduction/introduction.component';
import { ExamplesComponent } from './examples/examples.component';
import { OverviewComponent } from './overview/overview.component';
import { ApiComponent } from './api/api.component';

let generatedOutput = require('../../../temp/__ui-jar-temp');

@NgModule({
    imports: [
        BrowserModule,
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
        CodeExampleComponent,
        IntroductionComponent,
        OverviewComponent,
        ExamplesComponent,
        ApiComponent
    ],
    bootstrap: [
        AppComponent
    ],
    providers: [
        { provide: 'AppData', useFactory: generatedOutput.getAppData }
    ]
})
export class UIJarModule {

}