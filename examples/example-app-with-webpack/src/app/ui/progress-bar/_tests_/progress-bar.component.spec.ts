import { async, ComponentFixture, TestBed, TestModuleMetadata } from '@angular/core/testing';

import { ProgressBarComponent } from '../progress-bar.component';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';

describe('ProgressBarComponent', () => {
  let component: ProgressBarComponent;
  let fixture: ComponentFixture<ProgressBarComponent>;

  beforeEach(async(() => {
    /**
     * @uijar ProgressBarComponent
     */
    TestBed.configureTestingModule({
      declarations: [ ProgressBarComponent ]
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ProgressBarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  /** @uijarexample Indefinite progress bar */
  it('should be created and use "indefinite" as type', () => {
    component.type = 'indefinite';
    fixture.detectChanges();

    expect(component.type).toEqual('indefinite');
    expect(fixture.debugElement.query(By.css('.progress-bar-container')).classes.indefinite).toBeTruthy();
  });

  /** @uijarexample Definite progress bar */
  it('should be created and use "definite" as type', () => {
    component.type = 'definite';
    component.value = 35;
    fixture.detectChanges();

    expect(component.type).toEqual('definite');
    expect(fixture.debugElement.query(By.css('.progress-bar-container')).classes.indefinite).toBeFalsy();
  });

});
