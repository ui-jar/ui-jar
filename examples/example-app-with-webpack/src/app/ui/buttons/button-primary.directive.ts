import { Directive } from '@angular/core';

@Directive({
  selector: '[primary]',
  host: {
    'class': 'primary'
  }
})
export class ButtonPrimaryDirective {

  constructor() { }

}
