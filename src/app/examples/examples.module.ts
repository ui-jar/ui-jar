import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CodeExampleComponent } from './example-item/code-example/code-example.component';
import { ExamplesComponent } from './examples.component';
import { ExampleItemComponent } from './example-item/example-item.component';

@NgModule({
    imports: [
        CommonModule,
        RouterModule
    ],
    declarations: [
        CodeExampleComponent,
        ExamplesComponent,
        ExampleItemComponent
    ],
    exports: [
        ExamplesComponent
    ]
})
export class ExamplesModule {

}