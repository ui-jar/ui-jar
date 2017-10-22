import { Directive } from '@angular/core';

@Directive({
  selector: '[secondary]',
  host: {
    'class': 'secondary'
  }
})
export class ButtonSecondaryDirective {

  constructor() { }

}
