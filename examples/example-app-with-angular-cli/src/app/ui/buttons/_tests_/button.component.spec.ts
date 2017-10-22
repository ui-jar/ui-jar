import { async, ComponentFixture, TestBed, TestModuleMetadata } from '@angular/core/testing';

import { ButtonComponent } from '../button.component';
import { Component } from '@angular/core';
import { ButtonPrimaryDirective } from '../button-primary.directive';
import { ButtonSecondaryDirective } from '../button-secondary.directive';
import { By } from '@angular/platform-browser';

describe('Buttons', () => {
  let component: ButtonComponentTestHost;
  let fixture: ComponentFixture<ButtonComponentTestHost>;

  beforeEach(async(() => {

    /**
     * @uijar ButtonComponent
     * @hostcomponent ButtonComponentTestHost
     */
    const moduleDefinition: TestModuleMetadata = {
      declarations: [
        ButtonComponent,
        ButtonComponentTestHost,
        ButtonPrimaryDirective,
        ButtonSecondaryDirective
      ]
    };

    TestBed.configureTestingModule(moduleDefinition)
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ButtonComponentTestHost);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  /** @uijarexample */
  it('should be created and set correct CSS-classes', () => {
    expect(fixture.debugElement.query(By.directive(ButtonPrimaryDirective)).nativeElement.classList.contains('primary')).toBeTruthy();
    expect(fixture.debugElement.query(By.directive(ButtonSecondaryDirective)).nativeElement.classList.contains('secondary')).toBeTruthy();
  });

});

@Component({
  selector: 'x-button-test-host',
  template: `
    <button primary>Primary</button>
    <button secondary>Secondary</button>
  `
})
class ButtonComponentTestHost {

}
