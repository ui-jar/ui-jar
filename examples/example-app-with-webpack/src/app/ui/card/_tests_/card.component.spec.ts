import { async, ComponentFixture, TestBed, TestModuleMetadata } from '@angular/core/testing';

import { CardComponent } from '../card.component';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';

describe('CardComponent', () => {
  let component: CardComponentTestHost;
  let fixture: ComponentFixture<CardComponentTestHost>;

  beforeEach(async(() => {
    /**
     * @uijar CardComponent
     * @hostcomponent CardComponentTestHost
     */
    TestBed.configureTestingModule({
      declarations: [ CardComponent, CardComponentTestHost ]
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CardComponentTestHost);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  /** @uijarexample Card with padding */
  it('should be created and set padding to "true"', () => {
    component.padding = true;
    component.text = 'Lorem ipsum dolor sit amet...';
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.directive(CardComponent)).classes.padding).toBeTruthy();
  });

  /** @uijarexample Card without padding */
  it('should be created and set padding to "false"', () => {
    component.padding = false;
    component.text = 'Lorem ipsum dolor sit amet...';
    fixture.detectChanges();
    
    expect(fixture.debugElement.query(By.directive(CardComponent)).classes.padding).toBeFalsy();
  });
});

@Component({
  selector: 'x-card-test-host',
  template: `
    <x-card [padding]="padding">{{text}}</x-card>
  `
})
class CardComponentTestHost {
  padding: boolean;
  text: string;
}