import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from './button.component';
import { ButtonPrimaryDirective } from './button-primary.directive';
import { ButtonSecondaryDirective } from './button-secondary.directive';
import { ButtonWarningDirective } from './button-warning.directive';

@NgModule({
  imports: [
    CommonModule
  ],
  declarations: [
    ButtonComponent,
    ButtonPrimaryDirective,
    ButtonSecondaryDirective,
    ButtonWarningDirective
  ]
})
export class ButtonModule { }
