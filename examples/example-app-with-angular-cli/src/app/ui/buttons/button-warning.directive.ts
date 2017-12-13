import { Directive } from '@angular/core';

@Directive({
  selector: '[warning]',
  host: {
    'class': 'warning'
  }
})
export class ButtonWarningDirective {

  constructor() { }

}
