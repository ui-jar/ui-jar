import * as assert from 'assert';
import * as ts from 'typescript';
import { TestSourceParser } from '../../src/generator/test-source-parser';
import { SourceParser } from '../../src/generator/source-parser';

describe('TestSourceParser', () => {

    describe('getProjectTestDocumentation', () => {
        let testDocs;

        beforeEach(() => {
            const sourceFiles = ['foobar.component.ts', 'foobar.component.test.ts'];
            const compilerHost = getTestCompilerHostWithMockComponent();
            const program: ts.Program = ts.createProgram([...sourceFiles],
                { target: ts.ScriptTarget.ES5, module: ts.ModuleKind.CommonJS }, compilerHost);

            const sourceParser = new SourceParser({ files: sourceFiles }, program);
            const sourceDocs = sourceParser.getProjectSourceDocumentation();

            const testSourceParser = new TestSourceParser({ files: sourceFiles }, program);
            testDocs = testSourceParser.getProjectTestDocumentation(sourceDocs);
        });

        it('should parse files and return list with TestDocs', () => {
            assert.equal(testDocs.length, 1);
        });

        it('should parse and verify that TestDocs.includeTestForComponent is valid', () => {
            let firstTestDoc = testDocs[0];

            assert.equal(firstTestDoc.includeTestForComponent, 'FoobarComponent');
        });

        it('should parse and verify that TestDocs.bootstrapComponent is valid', () => {
            let firstTestDoc = testDocs[0];

            assert.equal(firstTestDoc.bootstrapComponent, 'FoobarComponent');
        });

        it('should parse and verify that TestDocs.moduleSetup is valid', () => {
            let firstTestDoc = testDocs[0];

            assert.deepEqual(firstTestDoc.moduleSetup.imports, ['CommonModule', 'HttpClientTestingModule']);
            assert.deepEqual(firstTestDoc.moduleSetup.declarations, ['FoobarComponent']);
            assert.deepEqual(firstTestDoc.moduleSetup.providers, [ 'AnotherService', '{ provide: CustomService, useValue: { foo: true, bar: [{ a: 1}, 2, \'foo bar\']}, _bar: true, \'foo-bar\': false, $foo: "foo", fooFn: (foo) => { /** jsdoc should be ok */ return foo += 123; }, query: \'?foobar=true!#hashbang\' }']);
        });

        it('should parse and verify that TestDocs.examples contains valid component properties', () => {
            let firstTestDoc = testDocs[0];

            const componentVariableDeclaration = firstTestDoc.allVariableDeclarations
                .filter((declaration) => declaration.type === 'FoobarComponent')
                .pop();

            firstTestDoc.examples.forEach((example, exampleIndex) => {
                example.componentProperties.forEach((componentProperty, index) => {
                    assert.equal(componentProperty.name, componentVariableDeclaration.name);

                    if (exampleIndex === 0) {
                        if (index === 0) {
                            assert.equal(componentProperty.expression, 'component.title = "Test title"');
                        } else if (index === 1) {
                            assert.equal(componentProperty.expression, 'component.options = ["item-1", "item-2", "item-3"]');
                        }
                    } else if (exampleIndex === 1) {
                        if (index === 0) {
                            assert.equal(componentProperty.expression, 'component.title = \'Test title 2\'');
                        } else if (index === 1) {
                            assert.equal(componentProperty.expression, 'component.options = [\'item-1\', \'item-2\']');
                        }
                    } else if (exampleIndex === 2) {
                        if (index === 0) {
                            assert.equal(componentProperty.expression, 'component.title = getTitle()');
                        } else if (index === 1) {
                            assert.equal(componentProperty.expression, 'component.options = getOptions()');
                        }
                    } else if(exampleIndex === 3) {
                        if (index === 0) {
                            assert.equal(componentProperty.expression, 'component.title = "Test with http request"');
                        } else if (index === 1) {
                            assert.equal(componentProperty.expression, 'component.options = ["item-1", "item-2", "item-3"]');
                        }
                    } else if(exampleIndex === 4) {
                        if (index === 0) {
                            assert.equal(componentProperty.expression, 'component.title = "Test with http request error"');
                        } else if (index === 1) {
                            assert.equal(componentProperty.expression, 'component.options = ["item-1", "item-2", "item-3"]');
                        }
                    } else {
                        assert.equal(true, false, 'Should not be executed');
                    }
                });

                example.httpRequests.forEach((httpRequest, index) => {
                    if(exampleIndex === 3) {
                        if(index === 0) {
                            assert.equal(httpRequest.name, 'request');
                            assert.equal(httpRequest.expression, 'request.flush(\'Should return this text\')');
                            assert.equal(httpRequest.url, '/foobar');
                        }
                    } else if(exampleIndex === 4) {
                        if(index === 0) {
                            assert.equal(httpRequest.name, 'request');
                            assert.equal(httpRequest.expression, 'request.error(new ErrorEvent(\'Server error\', { error: new Error(\'503\'), message: \'Server error\' }))');
                            assert.equal(httpRequest.url, '/error-url');
                        }
                    } else {
                        assert.equal(true, false, 'Should not be executed');
                    }
                });
            });
        });

        it('should parse and verify that TestDocs.exampleTemplate is valid', () => {
            let firstTestDoc = testDocs[0];

            assert.equal(firstTestDoc.exampleTemplate, '<x-foobar [options]="[\'item-1\', \'item-2\', \'item-3\']"></x-foobar>\n<x-foobar [options]="[\'item-1\', \'item-2\']"></x-foobar>\n<x-foobar [options]="getOptions()"></x-foobar>\n<x-foobar [options]="[\'item-1\', \'item-2\', \'item-3\']"></x-foobar>\n<x-foobar [options]="[\'item-1\', \'item-2\', \'item-3\']"></x-foobar>\n');
        });

        it('should parse and verify that TestDocs.importStatements contains test imports', () => {
            let firstTestDoc = testDocs[0];

            firstTestDoc.importStatements.forEach((importStatement, index) => {
                if (index === 0) {
                    assert.equal(importStatement.value, 'import { Component } from \'@angular/core\';');
                    assert.equal(importStatement.path, '\'@angular/core\'');
                } else if (index === 1) {
                    assert.equal(importStatement.value, 'import { async, ComponentFixture, TestBed, TestModuleMetadata } from \'@angular/core/testing\';');
                    assert.equal(importStatement.path, '\'@angular/core/testing\'');
                } else if (index === 2) {
                    assert.equal(importStatement.value, 'import { FoobarComponent } from \'./foobar.component.ts\';');
                    assert.equal(importStatement.path, '\'./foobar.component.ts\'');
                }
            });
        });

        it('should parse and verify that TestDocs.fileName is valid', () => {
            let firstTestDoc = testDocs[0];

            assert.equal(firstTestDoc.fileName, 'foobar.component.test.ts');
        });

        it('should parse and verify that TestDocs.inlineFunctions contains getOptions() and getTitle()', () => {
            let firstTestDoc = testDocs[0];

            firstTestDoc.inlineFunctions.forEach((inlineFunction, index) => {
                if (index === 0) {
                    assert.equal(new RegExp(/function\sgetOptions\(\)\s\{/i).test(inlineFunction), true);
                } else if (index === 1) {
                    assert.equal(new RegExp(/function\sgetTitle\(\)\s\{/i).test(inlineFunction), true);
                } else {
                    assert.equal(true, false, 'Should not be executed');
                }
            });
        });

        it('should parse and verify that TestDocs.inlineComponents contains "InlineTestComponent"', () => {
            let firstTestDoc = testDocs[0];

            firstTestDoc.inlineComponents.forEach((inlineComponent) => {
                assert.equal(inlineComponent.template, '<p>inline-test</p>');
                assert.equal(inlineComponent.name, 'InlineTestComponent');
                assert.equal(inlineComponent.source.indexOf('@Component({') > -1, true);
            });
        });
    });

    describe('getProjectTestDocumentation - with test host component', () => {
        let testDocs;

        beforeEach(() => {
            const sourceFiles = ['foobar.component.ts', 'foobar.module.ts', 'foobar.component.test.ts'];
            const compilerHost = getTestCompilerHostWithMockModuleAndTestHostComponent();
            const program: ts.Program = ts.createProgram([...sourceFiles],
                { target: ts.ScriptTarget.ES5, module: ts.ModuleKind.CommonJS }, compilerHost);

            const sourceParser = new SourceParser({ files: sourceFiles }, program);
            const sourceDocs = sourceParser.getProjectSourceDocumentation();

            const testSourceParser = new TestSourceParser({ files: sourceFiles }, program);
            testDocs = testSourceParser.getProjectTestDocumentation(sourceDocs);
        });

        it('should parse files and return list with TestDocs when using test host component', () => {
            assert.equal(testDocs.length, 1);
        });

        it('should parse and verify that TestDocs.includeTestForComponent is valid when using test host component', () => {
            let firstTestDoc = testDocs[0];

            assert.equal(firstTestDoc.includeTestForComponent, 'FoobarComponent');
        });

        it('should parse and verify that TestDocs.bootstrapComponent is valid when using test host component', () => {
            let firstTestDoc = testDocs[0];

            assert.equal(firstTestDoc.bootstrapComponent, 'FoobarComponentTestHost');
        });

        it('should parse and verify that TestDocs.exampleTemplate is valid when using test host component', () => {
            let firstTestDoc = testDocs[0];

            assert.equal(firstTestDoc.exampleTemplate, '<x-foobar><p>{{content}}</p></x-foobar>');
        });

        it('should parse and verify that TestDocs.moduleSetup is valid when using test host component', () => {
            let firstTestDoc = testDocs[0];

            assert.deepEqual(firstTestDoc.moduleSetup.imports, ['FoobarModule', 'FormsModule']);
            assert.deepEqual(firstTestDoc.moduleSetup.declarations, ['FoobarComponentTestHost']);
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
           * @uijar FoobarComponent
           */
          let moduleDef: TestModuleMetadata = {
              imports: [CommonModule, HttpClientTestingModule],
              declarations: [FoobarComponent],
              providers: [{ provide: CustomService, useValue: { foo: true, bar: [{ a: 1}, 2, 'foo bar']}, _bar: true, 'foo-bar': false, $foo: "foo", fooFn: (foo) => { /** jsdoc should be ok */ return foo += 123; }, query: '?foobar=true!#hashbang' }, AnotherService]
            };
          TestBed.configureTestingModule(moduleDef).compileComponents();
        }));
      
        beforeEach(() => {
          fixture = TestBed.createComponent(FoobarComponent);
          component = fixture.componentInstance;
          fixture.detectChanges();
        });
        
        /** @uijarexample */
        it('should parse test correct when using double quotes to set property value', () => {
            component.title = "Test title";
            component.options = ["item-1", "item-2", "item-3"];

            // ...
        });

        /** @uijarexample */
        it('should parse test correct when using single quotes to set property value', () => {
            component.title = \'Test title 2\';
            component.options = [\'item-1\', \'item-2\'];

            // ...
        });

        /** @uijarexample */
        it('should parse test correct when using inline function to set property value', () => {
            function getOptions() {
                return ["item-1", "item-2", "item-3"];
            }

            function getTitle() {
                return "Test title";
            }

            function functionThatIsNotUsedShouldBeIgnored() {
                return null;
            }

            component.title = getTitle();
            component.options = getOptions();

            // ...
        });

        it('should ignore tests without /** @uijarexample */ annotation', () => {
            function shouldNotBeVisibleInParse() {
                return ['item-1', 'item-2'];
            }

            component.title = "Title should not be visible in parse";
            component.options = shouldNotBeVisibleInParse();
        });

        /** @uijarexample */
        it('should parse http request in test (flush)', () => {
            component.title = "Test with http request";
            component.options = ["item-1", "item-2", "item-3"];
            const request: TestRequest = httpMock.expectOne('/foobar');
            request.flush('Should return this text');

            // ...
        });

        /** @uijarexample */
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

      function shouldBeIgnoredBecauseItIsNotUsed() {
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

function getTestCompilerHostWithMockModuleAndTestHostComponent() {
    const testSourceFileContent = `
    import { Component } from '@angular/core';
    import { FormsModule } from '@angular/forms';
    import { async, ComponentFixture, TestBed, TestModuleMetadata } from '@angular/core/testing';
    import { FoobarModule } from './foobar.module.ts';

    describe('FoobarComponent', () => {
        let hostComponent: FoobarComponentTestHost;
        let fixture: ComponentFixture<FoobarComponentTestHost>;
      
        beforeEach(async(() => {
          /** 
           * @uijar FoobarComponent
           * @hostcomponent FoobarComponentTestHost
           */
          let moduleDef: TestModuleMetadata = { imports: [FoobarModule, FormsModule], declarations: [FoobarComponentTestHost] };
          TestBed.configureTestingModule(moduleDef).compileComponents();
        }));
      
        beforeEach(() => {
          fixture = TestBed.createComponent(FoobarComponentTestHost);
          hostComponent = fixture.componentInstance;
          fixture.detectChanges();
        });
        
        /** @uijarexample */
        it('should parse test correct when using test host', () => {
            hostComponent.content = "Test content";

            // ...
        });

      });

      @Component({
          selector: 'x-foobar-test-host',
          template: '<x-foobar><p>{{content}}</p></x-foobar>'
      })
      export class FoobarComponentTestHost {
          content: string;
          // ...
      }

      function shouldBeIgnoredBecauseItIsNotUsed() {
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
            template: '<ng-content></ng-content>'
        })
        export class FoobarComponent {
            title: string;
            @Input()
            options: string[];
        }
    `;

    const sourceFileModuleContent = `
        import { NgModule } from '@angular/core';
        import { CommonModule } from '@angular/common';

        @NgModule({
            imports: [CommonModule],
            declarations: [FoobarComponent],
            exports: [FoobarComponent]
        })
        export class FoobarModule {
            // ...
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
        if (fileName.indexOf('.module.ts') > -1) {
            return true;
        }
    };

    return compilerHost;
}