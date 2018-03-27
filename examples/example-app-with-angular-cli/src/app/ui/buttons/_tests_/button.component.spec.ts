import { async, ComponentFixture, TestBed, TestModuleMetadata } from '@angular/core/testing';
import { ButtonComponent } from '../button.component';
import { Component } from '@angular/core';
import { ButtonPrimaryDirective } from '../button-primary.directive';
import { ButtonSecondaryDirective } from '../button-secondary.directive';
import { By } from '@angular/platform-browser';
import { ButtonWarningDirective } from '../button-warning.directive';

describe('Buttons', () => {
  let component: ButtonComponentTestHost;
  let fixture: ComponentFixture<ButtonComponentTestHost>;

  beforeEach(async(() => {

    /**
     * @uijar ButtonComponent
     * @hostcomponent ButtonComponentTestHost
     */
    TestBed.configureTestingModule({
      declarations: [
        ButtonComponent,
        ButtonComponentTestHost,
        ButtonPrimaryDirective,
        ButtonSecondaryDirective,
        ButtonWarningDirective
      ]
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ButtonComponentTestHost);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  /** @uijarexample Buttons */
  it('should be created and set correct CSS-classes', () => {
    expect(fixture.debugElement.query(By.directive(ButtonPrimaryDirective)).nativeElement.classList.contains('primary')).toBeTruthy();
    expect(fixture.debugElement.query(By.directive(ButtonSecondaryDirective)).nativeElement.classList.contains('secondary')).toBeTruthy();
    expect(fixture.debugElement.query(By.directive(ButtonWarningDirective)).nativeElement.classList.contains('warning')).toBeTruthy();
  });

});

@Component({
  selector: 'x-button-test-host',
  template: `
    <button primary>Primary</button>
    <button secondary>Secondary</button>
    <button warning>Warning</button>
  `
})
class ButtonComponentTestHost {

}
