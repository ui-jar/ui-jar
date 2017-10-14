# UI-jar
### Test Driven Style Guide Development - Angular (2.x and above)
A drop in module to automatically create a living style guide based on the test you write for your components.<br/>
Bundle with your favorite build tool and you will automatically get a web app where you can view examples of each component together with associated documentation.<br/><br/>
UI-jar is in beta, breaking changes may occur.

## Installation
```bash
npm install ui-jar
```

## CLI

```bash
./node_modules/.bin/ui-jar directory=./app/root/dir includes=.ts$ excludes=.excludes.ts$ urlPrefix=prefix/url
```

## Configuration

Add a entry point to your ui-jar app, e.g ui-jar.ts.<br/>
Bundle with your favorite build tool (use the same configuration as your regular app, but with ui-jar.ts as the entry point).
AoT-build is not supported yet.

```js
import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { UIjarModule } from 'ui-jar';

enableProdMode();
platformBrowserDynamic().bootstrapModule(UIjarModule);
```

```html
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>UI-jar</title>
    <base href="/">
    <link rel="stylesheet" href="/node_modules/ui-jar/dist/src/styles/default.css" type="text/css">
</head>
<body>
    <ui-jar-app></ui-jar-app>
    <script src="path/to/your/ui-jar/app/build/bundle.js"></script>
</body>
</html>
```

## Example usage (basic)

Add a JSDoc-comment to your component containing "@group GROUP_NAME" and 
"@component COMPONENT_DISPLAY_NAME".

**@group** is used to group your components in the UI-jar app navigation.<br/>
**@component** is used as display name of the component in the UI-jar app.

Description is not required, add if you like. It will be displayed together with your component in the UI-jar app.

### Source code

```js
import { Component, Input } from '@angular/core';

/**
 * @group Forms
 * @component Checkbox
 * @description 
 * <div>It's possible use <b>html</b> in the description</div>
 */
@Component({
    selector: 'x-checkbox',
    templateUrl: './checkbox.component.html',
    styleUrls: ['./checkbox.component.scss']
})
export class CheckboxComponent {
    @Input('isDisabled') isDisabled: boolean = false;
    label: string = 'Item A';

    ...
}
```

### Test code

Add a JSDoc-comment with "@uijar COMPONENT_CLASS_NAME" together with a variable that defines test module definition.
In the example below it's defined in "beforeEach".

Also add a JSDoc-comment containing "@uijarexample" to each test you would like to add as a example in UI-jar.<br/>
It's possible to use multiple examples.

```js
import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { CheckboxComponent } from './checkbox.component';

describe('CheckboxComponent', () => {
  let component: CheckboxComponent;
  let fixture: ComponentFixture<CheckboxComponent>;

    beforeEach(async(() => {
        /** 
         * @uijar CheckboxComponent
         */
        let moduleDefinition = {
            declarations: [CheckboxComponent]
        };

        TestBed.configureTestingModule(moduleDefinition).compileComponents().then(() => {
            fixture = TestBed.createComponent(CheckboxComponent);
            component = fixture.componentInstance;
            fixture.detectChanges();      
        });
    }));

    /** @uijarexample */
    it('should create component with "isDisabled" set to true', () => {
        component.isDisabled = true;
        component.label = 'Item A';

        ...
    });

    /** @uijarexample */
    it('should create component with "isDisabled" set to false', () => {
        component.isDisabled = false;
        component.label = 'Item A';

        ...
    });
});
```

## Example usage (with test host component)

### Source code

```js
import { Component } from '@angular/core';

/**
 * @group Buttons & indicators
 * @component Buttons
 */
@Component({
    selector: 'button[buttonA]',
    template: '<ng-content></ng-content>',
    styleUrls: ['./button.scss']
})
export class ButtonComponent {
    ...
}
```

### Test code

Sometimes you want to create a test host component for your tests.<br/>
It's possible to view test host components in UI-jar, just add the "@hostcomponent HOST_COMPONENT_CLASS_NAME" to the JSDoc-comment where you define your module definition.<br/>
In the example below it's defined in "beforeEach".

```js
import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ButtonsModule } from './buttons.module';

describe('ButtonComponent', () => {
  let component: ButtonComponentTestHost;
  let fixture: ComponentFixture<ButtonComponentTestHost>;

  beforeEach(async(() => {
    /** 
     * @uijar ButtonComponent
     * @hostcomponent ButtonComponentTestHost
     */
    let moduleDefinition = { 
        imports: [ButtonsModule],
        declarations: [ButtonComponentTestHost]
    };

    TestBed.configureTestingModule(moduleDefinition).compileComponents().then(() => {
        fixture = TestBed.createComponent(ButtonComponentTestHost);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });
  }));

    /** @uijarexample */
    it('should be created', () => {
        component.buttonText = 'Standard button';

        ...
    });
});

@Component({
    selector: 'x-button-test-host',
    template: `<button buttonA>{{buttonText}}</button>`
})
class ButtonComponentTestHost {
    buttonText: string;
}
```

----