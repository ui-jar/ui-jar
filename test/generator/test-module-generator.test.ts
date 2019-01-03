import * as assert from 'assert';
import * as ts from 'typescript';
import * as sinon from 'sinon';
import * as fs from 'fs';
import { TestModuleGenerator, TestModuleSourceFile } from '../../src/generator/test-module-generator';
import { SourceParser } from '../../src/generator/source-parser';
import { TestSourceParser } from '../../src/generator/test-source-parser';

describe('TestModuleGenerator', () => {
    describe('getTestModuleSourceFiles', () => {
        let testModuleSourceFile;
        let readFileSyncStub;

        beforeEach(() => {
            readFileSyncStub = sinon.stub(fs, 'readFileSync');
            readFileSyncStub.returns('<p>inline-test-with-external-template-using-template-url</p>');

            const sourceFiles = ['foobar.component.ts', 'foobar.component.test.ts'];
            const compilerHost = getTestCompilerHostWithMockComponent();
            const program: ts.Program = ts.createProgram([...sourceFiles],
                { target: ts.ScriptTarget.ES5, module: ts.ModuleKind.CommonJS }, compilerHost);

            const sourceParser = new SourceParser({ rootDir: './', files: sourceFiles }, program);
            const { classesWithDocs, otherClasses } = sourceParser.getProjectSourceDocumentation();

            const testSourceParser = new TestSourceParser({ files: sourceFiles }, program);
            const testDocs = testSourceParser.getProjectTestDocumentation(classesWithDocs, otherClasses);
            const testModuleSourceFiles: TestModuleSourceFile[] = new TestModuleGenerator().getTestModuleSourceFiles(testDocs);
            testModuleSourceFile = testModuleSourceFiles[0].sourceFile.getText();
        });

        after(() => {
            readFileSyncStub.restore();
        });
        
        it('should return generated test source module - including all components and example properties', () => {
            assert.equal(testModuleSourceFile, 
`import { NgModule, Component } from "@angular/core";import { BrowserModule } from "@angular/platform-browser";import { Component } from '@angular/core';import { async, ComponentFixture, TestBed, TestModuleMetadata } from '@angular/core/testing';import { FoobarComponent } from '../foobar.component.ts';import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing.ts';@Component({
          selector: 'x-inline-test',
          template: '<p>inline-test</p>'
      })
      export class InlineTestComponent {
          // ...
      },@Component({
          selector: 'x-inline-test-with-template-url',
          template: \`
<p>inline-test-with-external-template-using-template-url</p>
\`
      })
      export class InlineTestWithTemplateUrlComponent {
          // ...
      }function getOptions() {
                return ["item-1", "item-2", "item-3"];
            },function getTitle() {
                return "Test title";
            },function functionThatIsNotUsedInTestShouldAlsoBeIncluded() {
            return null;
        }@NgModule({imports:[CommonModule,HttpClientTestingModule,BrowserModule],declarations:[FoobarComponent],providers:[{ provide: CustomService, useValue: { foo: true, bar: [{ a: 1}, 2, 'foo bar']}, _bar: true, 'foo-bar': false, $foo: "foo", fooFn: (foo) => { /** jsdoc should be ok */ return foo += 123; }, query: '?foobar=true!#hashbang' },AnotherService],entryComponents:[FoobarComponent,FoobarComponent,FoobarComponent,FoobarComponent,FoobarComponent],exports:[FoobarComponent]}) export class TempModule8b329cf5499a0006dd4ce48ad34ec7f4 {
            private appRef;
            bootstrapComponent(value, bootstrapNode) {
                return this.appRef.bootstrap(value, bootstrapNode);
            }
            
            ngDoBootstrap(appRef) {
                this.appRef = appRef;
            }
        }export function getComponentExampleProperties () { 
            let examples = [{ properties: {"component.title": "Test title", "component.options": ["item-1", "item-2", "item-3"], }, componentPropertyName: "component", httpRequests: {}, sourceCode: "@Component({\\n  selector: 'example-host',\\n  template: \`<x-foobar [options]=\\"options\\"></x-foobar>\`\\n})\\nclass ExampleHostComponent {}", title: "Custom title for example", bootstrapComponent: "FoobarComponent", selector: "x-foobar"},{ properties: {"component.title": 'Test title 2', "component.options": ['item-1', 'item-2'], "component.disabled": true, }, componentPropertyName: "component", httpRequests: {}, sourceCode: "@Component({\\n  selector: 'example-host',\\n  template: \`<x-foobar [options]=\\"options\\" [disabled]=\\"disabled\\"></x-foobar>\`\\n})\\nclass ExampleHostComponent {}", title: "", bootstrapComponent: "FoobarComponent", selector: "x-foobar"},{ properties: {"component.title": getTitle(), "component.options": getOptions(), }, componentPropertyName: "component", httpRequests: {}, sourceCode: "@Component({\\n  selector: 'example-host',\\n  template: \`<x-foobar [options]=\\"options\\"></x-foobar>\`\\n})\\nclass ExampleHostComponent {}", title: "Title-with-dashes_and_"other" _'01234$#%'56,()=789 special chars", bootstrapComponent: "FoobarComponent", selector: "x-foobar"},{ properties: {"component.title": "Test with http request", "component.options": ["item-1", "item-2", "item-3"], }, componentPropertyName: "component", httpRequests: {"request": { expression: "request.flush('Should return this text')", url: "/foobar" }, }, sourceCode: "@Component({\\n  selector: 'example-host',\\n  template: \`<x-foobar [options]=\\"options\\"></x-foobar>\`\\n})\\nclass ExampleHostComponent {}", title: "Another custom title", bootstrapComponent: "FoobarComponent", selector: "x-foobar"},{ properties: {"component.title": "Test with http request error", "component.options": ["item-1", "item-2", "item-3"], }, componentPropertyName: "component", httpRequests: {"request": { expression: "request.error(new ErrorEvent('Server error', { error: new Error('503'), message: 'Server error' }))", url: "/error-url" }, }, sourceCode: "@Component({\\n  selector: 'example-host',\\n  template: \`<x-foobar [options]=\\"options\\"></x-foobar>\`\\n})\\nclass ExampleHostComponent {}", title: "Title with number  1234", bootstrapComponent: "FoobarComponent", selector: "x-foobar"}];
            let modifiedExamples = [];

            return examples.map((example) => {
                let componentProperties = example.properties;
                let result = {};
                result.componentProperties = Object.keys(componentProperties).map((propertyKey) => {
                    
                    let expressionValue = JSON.stringify(componentProperties[propertyKey]);
                    expressionValue = propertyKey +'='+ expressionValue;
                    
                    return {
                        name: example.componentPropertyName,
                        expression: expressionValue
                    }; 
                });

                result.httpRequests = Object.keys(example.httpRequests).map((propertyKey) => {
                    return {
                        name: propertyKey,
                        url: example.httpRequests[propertyKey].url,
                        expression: example.httpRequests[propertyKey].expression
                    }
                });

                result.sourceCode = example.sourceCode;
                result.title = example.title;
                result.bootstrapComponent = example.bootstrapComponent;
                result.selector = example.selector;

                return result;
            });
        }export function getModuleMetadataOverrideProperties () {
            return [{
                moduleRefName: SomeModuleToOverrideMetadataIn,
                entryComponents: [CustomOverridenEntryComponent]
            },];
        }exports.FoobarComponent = FoobarComponent;`);
        });
    });
});

function getTestCompilerHostWithMockComponent() {
    const testSourceFileContent = `
    import { Component } from '@angular/core';
    import { async, ComponentFixture, TestBed, TestModuleMetadata } from '@angular/core/testing';
    import { FoobarComponent } from './foobar.component.ts';
    import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing.ts';

    interface TestRequest {}

    describe('FoobarComponent', () => {
        let component: FoobarComponent;
        let fixture: ComponentFixture<FoobarComponent>;
        let httpMock: HttpTestingController;
      
        beforeEach(async(() => {
          /** 
           * @uijar  FoobarComponent  
           */
          let moduleDef: TestModuleMetadata = {
              imports: [CommonModule, HttpClientTestingModule],
              declarations: [FoobarComponent],
              providers: [{ provide: CustomService, useValue: { foo: true, bar: [{ a: 1}, 2, 'foo bar']}, _bar: true, 'foo-bar': false, $foo: "foo", fooFn: (foo) => { /** jsdoc should be ok */ return foo += 123; }, query: '?foobar=true!#hashbang' }, AnotherService]
            };

          TestBed.overrideModule(SomeModuleToOverrideMetadataIn, {
            set: {
              entryComponents: [ CustomOverridenEntryComponent ]
            }
          };

          TestBed.configureTestingModule(moduleDef).compileComponents();
        }));
      
        beforeEach(() => {
          fixture = TestBed.createComponent(FoobarComponent);
          component = fixture.componentInstance;
          fixture.detectChanges();
        });
        
        // @uijarexample Custom title for example
        it('should parse test correct when using double quotes to set property value', () => {
            component.title = "Test title";
            component.options = ["item-1", "item-2", "item-3"];

            // ...
        });

        /** @uijarexample */
        it('should parse test correct when using single quotes to set property value', () => {
            component.title = \'Test title 2\';
            component.options = [\'item-1\', \'item-2\'];
            component.disabled = true;

            // ...
        });

        /** 
         * @uijarexample Title-with-dashes_and_"other" _\'01234$#%\'56,()=789 special chars            */
        it('should parse test correct when using inline function to set property value', () => {
            function getOptions() {
                return ["item-1", "item-2", "item-3"];
            }

            function getTitle() {
                return "Test title";
            }

            component.title = getTitle();
            component.options = getOptions();

            // ...
        });

        function functionThatIsNotUsedInTestShouldAlsoBeIncluded() {
            return null;
        }

        it('should ignore tests without /** @uijarexample */ annotation', () => {
            component.title = "Title should not be visible in parse";
        });

        /** 
            * @uijarexample Another custom title 
         * 
        */
        it('should parse http request in test (flush)', () => {
            component.title = "Test with http request";
            component.options = ["item-1", "item-2", "item-3"];
            const request: TestRequest = httpMock.expectOne('/foobar');
            request.flush('Should return this text');

            // ...
        });

        /** 
         * @uijarexample  Title with number  1234     
         * **/
        it('should parse http request in test (error)', () => {
            component.title = "Test with http request error";
            component.options = ["item-1", "item-2", "item-3"];
            const request: TestRequest = httpMock.expectOne('/error-url');
            request.error(new ErrorEvent('Server error', { error: new Error('503'), message: 'Server error' }));

            // ...
        });
      });

      @Component({
          selector: 'x-inline-test',
          template: '<p>inline-test</p>'
      })
      export class InlineTestComponent {
          // ...
      }

      @Component({
          selector: 'x-inline-test-with-template-url',
          templateUrl: './inline-test-with-template-url.html'
      })
      export class InlineTestWithTemplateUrlComponent {
          // ...
      }
    `;

    const sourceFileContent = `
        import { Component, Input } from '@angular/core';

        /**
         * @group Layout
         * @component Foobar
         */
        @Component({
            selector: 'x-foobar',
            template: 'test'
        })
        export class FoobarComponent {
            title: string;
            @Input()
            options: string[];
            @Input()
            disabled: boolean;
        }
    `;

    let compilerHost = ts.createCompilerHost({ target: ts.ScriptTarget.ES5, module: ts.ModuleKind.CommonJS });

    compilerHost.getSourceFile = (fileName: string, languageVersion: ts.ScriptTarget,
        onError?: (message: string) => void): ts.SourceFile => {

        if (fileName.indexOf('.test.ts') > -1) {
            return ts.createSourceFile(fileName, testSourceFileContent, ts.ScriptTarget.ES5);
        }

        return ts.createSourceFile(fileName, sourceFileContent, ts.ScriptTarget.ES5);
    };

    compilerHost.fileExists = (fileName: string): boolean => {
        if (fileName.indexOf('.component.ts') > -1) {
            return true;
        }
    };

    return compilerHost;
}