[![npm version](https://badge.fury.io/js/ui-jar.svg)](https://www.npmjs.com/package/ui-jar)

# UI-jar
### Test Driven Style Guide Development - Angular (2.x and above)
A drop in module to automatically create a living style guide based on the test you write for your components.<br/>
Bundle with your favorite build tool and you will automatically get a web app where you can view examples of each component together with associated documentation.<br/><br/>

![screenshot](https://raw.githubusercontent.com/ui-jar/ui-jar/master/images/screenshot.png)

---

## Installation
```bash
npm install ui-jar
```

## CLI

```bash
node node_modules/ui-jar/dist/bin/cli.js --directory ./app/root/dir --includes \.ts$ --excludes \.excludes\.ts$ --url-prefix prefix/url
```

#### CLI options

* **--directory** (string) - path to app root dir e.g. "./src/app"
* **--includes** (RegExp) - space separated list of files to include e.g. "foo\\.ts$ bar\\.ts$"
* **--excludes** (RegExp) - space separated list of files to exclude e.g. "a\\.component\\.ts$ b\\.component\\.ts$"
* **--url-prefix** (string) - add prefix to all urls in UI-jar, e.g. "project-a/styleguide".
* **--watch** - enable watch-mode, UI-jar will watch on file changes in your test files.

## Configuration

Add a entry point to your ui-jar app, e.g ui-jar.ts.<br/>
Bundle with your favorite build tool (use the same configuration as your regular app, but with ui-jar.ts as the entry point).
AoT-build is not supported yet.

```js
import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { UIJarModule } from 'ui-jar';

enableProdMode();
platformBrowserDynamic().bootstrapModule(UIJarModule);
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

Add a JSDoc-comment to your component containing "@group GROUP_NAME" and<br/>
"@component COMPONENT_DISPLAY_NAME".

**@group** is used to group your components in UI-jar navigation.<br/>
**@component** is used as display name of the component in UI-jar.

Description is not required, add if you like. It will be displayed together with your component in UI-jar.

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
It's possible to view test host components in UI-jar, just add "@hostcomponent HOST_COMPONENT_CLASS_NAME" to the JSDoc-comment where you define your module definition.<br/>
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

## Example usage (test with HttpClientTestingModule) - AVAILABLE IN BETA-10

You might want to view a component that is requesting resources using HttpClient in UI-jar. Below is an example on that.

### Source code

```js
import { Component, Renderer2, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';

/**
 * @group Icons
 * @component Icon
 */
@Component({
    selector: 'x-icon',
    template: '<ng-content></ng-content>',
    styleUrls: ['./icon.scss']
})
export class IconComponent {
    private _name: string;

    @Input()
    set name(value: string) {
        this._name = value;
        this.setSvgIcon(this._name);
    }

    constructor(private http: HttpClient, private renderer: Renderer2,
                private elementRef: ElementRef) { }

    private setSvgIcon(name: string): void {
        this.getSvgIcon(name).subscribe((svgIcon) => {
            this.renderer.appendChild(this.elementRef.nativeElement, svgIcon);
        });

        ...
    }

    private getSvgIcon(name: string): Observable<SVGElement> {
        return this.http.get(`/cdn/url/${name}.svg`).pipe(map((response) => { ... }));
    }

    ...
}
```

### Test code

Notice the use of "HttpClientTestingModule" and "HttpTestingController".<br/>
UI-jar will automatically detect each requests you would like to fake for a specified resource if you use "expectOne" on "HttpTestingController". Use "flush" and "error" on "TestRequest" to manage which result you would like to have on your requests when visible in UI-jar.

```js
import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { HttpClientTestingModule, HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { IconComponent } from './icon.component';

describe('IconComponent', () => {
  let component: IconComponent;
  let fixture: ComponentFixture<IconComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async(() => {
    /** 
     * @uijar IconComponent
     */
    const moduleDefinition = {
        imports: [HttpClientTestingModule],
        declarations: [IconComponent],
    };
    TestBed.configureTestingModule(moduleDefinition).compileComponents().then(() => {
        fixture = TestBed.createComponent(IconComponent);
        httpMock = fixture.componentRef.injector.get(HttpTestingController);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });
  }));

    /** @uijarexample */
    it('should load icon', () => {
        component.name = 'icon-name';
        const request: TestRequest = httpMock.expectOne('/cdn/url/icon-name.svg');
        request.flush('<svg>...</svg>');

        ...
    });

    /** @uijarexample */
    it('should return error when trying to load invalid icon', () => {
        component.name = 'icon-does-not-exist';
        const request: TestRequest = httpMock.expectOne('/cdn/url/icon-does-not-exist.svg');
        request.error(new ErrorEvent('404 - Not Found', {
            error: new Error('Icon not found'),
            message: 'Icon not found'
        }));

        ...
    });
});
```

## Example usage (add more details about your component)

UI-jar also automatically create a API documentation for your component.
The documentation view all public methods and properties on each component.
It's possible to add more details by adding a JSDoc-comment together with associated method or property.
In the example below, we are adding more details about "isDisabled" property.

### Source code

```js
import { Component, Input } from '@angular/core';

/**
 * @group Forms
 * @component Checkbox
 */
@Component({
    selector: 'x-checkbox',
    templateUrl: './checkbox.component.html',
    styleUrls: ['./checkbox.component.scss']
})
export class CheckboxComponent {
    /** Indicates whether checkbox is disabled or not */
    @Input('isDisabled') isDisabled: boolean = false;

    ...
}
```

----