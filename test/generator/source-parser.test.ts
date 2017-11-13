import * as assert from 'assert';
import * as ts from 'typescript';
import { SourceParser } from '../../src/generator/source-parser';

describe('SourceParser', () => {

    describe('getProjectSourceDocumentation', () => {
        let sourceDocs;

        beforeEach(() => {
            const sourceFiles = ['foobar.component.ts', 'foobar.module.ts', 'foobar.component.test.ts'];
            const compilerHost = getTestCompilerHostWithMockModuleAndComponent();
            const program: ts.Program = ts.createProgram([...sourceFiles],
                { target: ts.ScriptTarget.ES5, module: ts.ModuleKind.CommonJS }, compilerHost);

            const sourceParser = new SourceParser({ files: sourceFiles }, program);
            sourceDocs = sourceParser.getProjectSourceDocumentation();
        });

        it('should parse files and return list with SourceDocs', () => {
            assert.equal(sourceDocs.length, 1);
        });

        it('should parse and verify that SourceDocs.componentRefName is valid', () => {
            let firstSourceDoc = sourceDocs[0];

            assert.equal(firstSourceDoc.componentRefName, 'FoobarComponent');
        });

        it('should parse and verify that SourceDocs.componentDocName is set', () => {
            let firstSourceDoc = sourceDocs[0];

            assert.equal(firstSourceDoc.componentDocName, 'Foobar');
        });

        it('should parse and verify that SourceDocs.groupDocName is set', () => {
            let firstSourceDoc = sourceDocs[0];

            assert.equal(firstSourceDoc.groupDocName, 'Layout');
        });

        it('should parse and verify that SourceDocs.description is set', () => {
            let firstSourceDoc = sourceDocs[0];

            assert.equal(firstSourceDoc.description, 'It\'s possible to use <strong>html</strong> in \nthe description');
        });

        it('should parse and verify that SourceDocs.fileName is valid', () => {
            let firstSourceDoc = sourceDocs[0];

            assert.equal(firstSourceDoc.fileName, 'foobar.component.ts');
        });

        it('should parse and verify that SourceDocs.moduleDetails is valid', () => {
            let firstSourceDoc = sourceDocs[0];

            assert.equal(firstSourceDoc.moduleDetails.moduleRefName, 'FoobarModule');
            assert.equal(firstSourceDoc.moduleDetails.fileName, 'foobar.module.ts');
        });

        it('should parse and verify that SourceDocs.selector is valid', () => {
            let firstSourceDoc = sourceDocs[0];

            assert.equal(firstSourceDoc.selector, 'x-foobar');
        });

        it('should parse and verify that SourceDocs.apiDetails.properties contains public component properties', () => {
            let firstSourceDoc = sourceDocs[0];

            firstSourceDoc.apiDetails.properties.forEach((property, index) => {
                if (index === 0) {
                    assert.equal(property.propertyName, 'title');
                    assert.equal(property.type, 'string');
                } else if (index === 1) {
                    assert.equal(property.propertyName, 'options');

                    property.decoratorNames.forEach((decoratorName) => {
                        assert.equal(decoratorName, '@Input()');
                    });
                } else if (index === 2) {
                    assert.equal(property.propertyName, 'changed');

                    property.decoratorNames.forEach((decoratorName) => {
                        assert.equal(decoratorName, '@Output()');
                    });
                } else if (index === 3) {
                    assert.equal(property.propertyName, 'isSmall');

                    property.decoratorNames.forEach((decoratorName, decoratorIndex) => {
                        if (decoratorIndex === 0) {
                            assert.equal(decoratorName, '@HostBinding(\'class.small\')');
                        } else if (decoratorIndex === 1) {
                            assert.equal(decoratorName, '@Input()');
                        }
                    });
                } else if (index === 4) {
                    assert.equal(property.propertyName, 'propertyWithDescription');
                    assert.equal(property.type, 'number');
                    assert.equal(property.description, 'Description to property should be parsed');
                } else {
                    assert.equal(true, false, 'Should not be executed');
                }
            });
        });

        it('should parse and verify that SourceDocs.apiDetails.methods contains public component methods', () => {
            let firstSourceDoc = sourceDocs[0];

            firstSourceDoc.apiDetails.methods.forEach((method, index) => {
                if (index === 0) {
                    assert.equal(method.methodName, 'publicMethod()');
                    assert.equal(method.description, '');
                } else if (index === 1) {
                    assert.equal(method.methodName, 'methodWithPublicModifierShouldBeVisibleInParse()');
                    assert.equal(method.description, '');
                } else if (index === 2) {
                    assert.equal(method.methodName, 'publicMethodWithDescription()');
                    assert.equal(method.description, 'Description to method should be parsed');
                } else {
                    assert.equal(true, false, 'Should not be executed');
                }
            });
        });

    });
});

function getTestCompilerHostWithMockModuleAndComponent() {
    const sourceFileContent = `
        import { Component, Input, Output, EventEmitter, HostBinding } from '@angular/core';

        /**
         * @group Layout
         * @component Foobar
         * @description 
         * It's possible to use <strong>html</strong> in 
         * the description
         */
        @Component({
            selector: 'x-foobar',
            template: 'test'
        })
        export class FoobarComponent {
            title: string;
            @Input() options: string[];
            @Output()
            changed: EventEmitter<boolean> = new EventEmitter();

            @HostBinding('class.small')
            @Input()
            isSmall: boolean = false;

            /**
             * Description to property should be parsed
             */
            propertyWithDescription: number;

            private propertyShouldNotBeVisibleInParse: boolean = true;

            publicMethod(): number {
                return 1;
            }

            private methodShouldNotBeVisibleInParse() {
                return true;
            }

            public methodWithPublicModifierShouldBeVisibleInParse() {
                return true;
            }

            /**
             * Description to method should be parsed
             */
            publicMethodWithDescription() {
                return 1;
            }
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

    const testSourceFileContent = `const foobar = true;`;

    let compilerHost = ts.createCompilerHost({ target: ts.ScriptTarget.ES5, module: ts.ModuleKind.CommonJS });

    compilerHost.getSourceFile = (fileName: string, languageVersion: ts.ScriptTarget,
        onError?: (message: string) => void): ts.SourceFile => {

        if (fileName.indexOf('.test.ts') > -1) {
            return ts.createSourceFile(fileName, testSourceFileContent, ts.ScriptTarget.ES5);
        } else if (fileName.indexOf('.module.ts') > -1) {
            return ts.createSourceFile(fileName, sourceFileModuleContent, ts.ScriptTarget.ES5);
        }

        return ts.createSourceFile(fileName, sourceFileContent, ts.ScriptTarget.ES5);
    };
    
    return compilerHost;
}
