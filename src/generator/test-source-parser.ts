import * as ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';
import { SourceDocs, ApiComponentProperties } from './source-parser';

export interface VariableDeclaration {
    type: string;
    name: string;
    value: string;
}

export interface InlineComponent {
    source: string;
    template: string;
    name: string;
}

export interface TestDocs {
    importStatements: { value: string, path: string }[];
    moduleSetup: any;
    includeTestForComponent: string;
    includesComponents?: string[];
    inlineComponents: InlineComponent[];
    binaryExpressions: BinaryExpression[];
    fileName: string;
    examples: {
        componentProperties: any[],
        variableDeclarations: VariableDeclaration[],
        httpExpressions: {
            name: string;
            expression: string;
            url: string;
        },
        sourceCode: string;
        title: string;
    }[];
    inlineFunctions: string[];
    bootstrapComponent: string;
}

export interface BinaryExpression {
    asString: string;
    expression: ts.BinaryExpression;
}

export class TestSourceParser {
    private checker: ts.TypeChecker;

    constructor(private config: any, private program: ts.Program) {
        this.checker = this.program.getTypeChecker();
    }

    getProjectTestDocumentation(classesWithDocs: SourceDocs[], otherClasses: SourceDocs[]): TestDocs[] {
        const testDocs: any[] = this.getTestDocs(this.config.files, classesWithDocs, otherClasses);

        testDocs.filter((component) => component.moduleSetup['imports']).forEach((component) => {
            classesWithDocs.forEach((classDoc) => {
                if (classDoc.moduleDetails && component.moduleSetup['imports'].indexOf(classDoc.moduleDetails.moduleRefName) > -1) {
                    component.includesComponents = component.includesComponents || [];
                    component.includesComponents.push(classDoc.componentRefName);
                }
            });
        });

        this.verifyBootstrapComponentIsAvailable(testDocs);

        return testDocs;
    }

    private verifyBootstrapComponentIsAvailable(docs: any[]) {
        const result = docs.filter((component, index) => {
            let containsBootstrapComponent = false;

            if (component.includesComponents && component.includesComponents.indexOf(component.bootstrapComponent) > -1) {
                containsBootstrapComponent = true;
            }

            if (component.moduleSetup.declarations &&
                component.moduleSetup.declarations.indexOf(component.bootstrapComponent) > -1) {
                containsBootstrapComponent = true;
            }

            return !containsBootstrapComponent;
        });

        result.forEach((testDocs) => {
            console.error(`Could not find any reference to "${testDocs.bootstrapComponent}".`);
            console.error(`1. Verify that "@uijar ${testDocs.bootstrapComponent}" or "@hostcomponent ${testDocs.bootstrapComponent}" is using correct component reference name.`);
            console.error(`2. If you have imported the module that has "${testDocs.bootstrapComponent}" in @NgModule({ declarations: [${testDocs.bootstrapComponent}] }) in the test setup, make sure that the imported module also has "${testDocs.bootstrapComponent}" in @NgModule({ exports: [${testDocs.bootstrapComponent}] })`);
        });

        if (result.length > 0) {
            process.exit(1);
        }
    }

    private getTestDocs(files: string[], classesWithDocs: SourceDocs[], otherClasses: SourceDocs[]): TestDocs[] {
        let docs: TestDocs[] = [];

        for (let currentFile of files) {
            let details: any = this.getTestSourceDetails(this.program.getSourceFile(currentFile), currentFile);
            details.fileName = (this.program.getSourceFile(currentFile) as ts.FileReference).fileName;

            details.examples.forEach((example) => {
                const componentExpressions = this.getComponentExpressionsFromTest(details.bootstrapComponent, example.binaryExpressions);
                const httpExpressions = this.getHttpExpressionsFromTest(example.variableDeclarations,
                    example.functionsCall);

                example.componentProperties = componentExpressions;
                example.httpRequests = httpExpressions;

                if (details.bootstrapComponent) {
                    example.sourceCode = this.getExampleSourceCode(details.hasHostComponent,
                        details.bootstrapComponent, classesWithDocs, otherClasses, details, example);
                }
            });

            details.inlineFunctions = this.getCalledFunctionFromTest(details.inlineFunctions, details.examples);

            if (details.bootstrapComponent) {
                docs.push(details);
            }
        }

        return docs;
    }

    private getExampleSourceCode(hasHostComponent: boolean, bootstrapComponent: string, classesWithDocs: SourceDocs[],
        otherClasses: SourceDocs[], details: any, example: any) {

        if(hasHostComponent) {
            return this.getTestHostComponentSourceCode(bootstrapComponent, classesWithDocs, otherClasses);
        }

        return this.getComponentSourceCode(details, classesWithDocs, example);
    }

    private getTestHostComponentSourceCode(componentRefName: string, classesWithDocs: SourceDocs[], otherClasses: SourceDocs[]) {
        let exampleComponent: SourceDocs = [...classesWithDocs, ...otherClasses].find((classDoc) => {
            return classDoc.componentRefName === componentRefName;
        });

        return exampleComponent.source;
    }

    private getComponentSourceCode(details: any, classesWithDocs: SourceDocs[], example: any) {
        let template = '';

        const currentComponentSourceDocs = classesWithDocs.find((classDoc: SourceDocs) => {
            return classDoc.componentRefName === details.includeTestForComponent;
        });

        if (!currentComponentSourceDocs) {
            return template;
        }

        const inputProperties = currentComponentSourceDocs.apiDetails.properties.filter((prop) => {
            const isInput = prop.decoratorNames.filter((decoratorName) => {
                return decoratorName.indexOf('@Input(') > -1;
            }).length > 0;

            return isInput;
        });

        let inputPropertiesTemplates = '';
        let exampleComponentProperties = example.componentProperties.map((prop) => {
            const firstIndexOfEquals = prop.expression.indexOf('=');
            let propertyName = prop.expression.substr(0, firstIndexOfEquals);
            propertyName = propertyName.replace(/[\s\.\[\]"']+/gi, '').replace(prop.name, '');
            const expression = prop.expression.substr(firstIndexOfEquals + 1).replace(/"/gi, '\'').trim();

            return {
                propertyName: propertyName,
                propertyValue: expression
            };
        });

        inputProperties.forEach((inputProperty: ApiComponentProperties) => {
            const isExamplePropertyInput: any = exampleComponentProperties.find((componentProperty: any) =>
                componentProperty.propertyName === inputProperty.propertyName);

            if (isExamplePropertyInput) {
                inputPropertiesTemplates += ` [${inputProperty.propertyName}]="${inputProperty.propertyName}"`;
            }
        });

        template += `<${currentComponentSourceDocs.selector}${inputPropertiesTemplates}></${currentComponentSourceDocs.selector}>`;

        return `@Component({\n  selector: 'example-host',\n  template: \`${template}\`\n})\nclass ExampleHostComponent {}`;
    }

    private getCalledFunctionFromTest(inlineFunctions: { name: string, func: string }[],
        examples: any[]): string[] {

        let calledInlineFunctions = inlineFunctions.reduce((result, inlineFunction) => {
            const isCalledFunction = examples.filter((example) => {
                return example.componentProperties.filter((componentProperty) => {
                    const functionCall = inlineFunction.name + '(';
                    return componentProperty.expression.indexOf(functionCall) > -1;
                }).length > 0;
            }).length > 0;

            if (isCalledFunction) {
                result = result.concat(inlineFunction.func);
            }

            return result;
        }, []);

        return calledInlineFunctions;
    }

    private getComponentExpressionsFromTest(bootstrapComponent: string, binaryExpressions: BinaryExpression[]) {

        const variables = this.convertBinaryExpressionToVariableDeclaration(bootstrapComponent, binaryExpressions);
        const componentVariables: VariableDeclaration[] = variables.filter((item: VariableDeclaration) => {
            return item.type === bootstrapComponent;
        });

        const componentExpressions = componentVariables.reduce((result, componentVariable) => {
            const expressions = binaryExpressions.filter((expression) => {
                return expression.asString.indexOf(componentVariable.name) === 0;
            }).map((expression) => {
                return {
                    name: componentVariable.name,
                    expression: expression.asString
                };
            });

            return result = result.concat(expressions);
        }, []);

        return componentExpressions;
    }

    private convertBinaryExpressionToVariableDeclaration(typeToSearchFor: string, binaryExpressions: BinaryExpression[]): VariableDeclaration[] {
        const traverseToParent = (node: ts.Node) => {
            const nodeSymbol = this.checker.getSymbolAtLocation(node);
            let type = null;

            if(nodeSymbol) {
                type = this.checker.typeToString(this.checker.getTypeOfSymbolAtLocation(nodeSymbol, nodeSymbol.valueDeclaration));
            }

            if(type === typeToSearchFor) {
                return node;
            }

            return ts.forEachChild(node, traverseToParent);
        };

        const result = binaryExpressions.reduce((current, expression) => {
            const resultNode = traverseToParent(expression.expression.left);

            if(resultNode) {
                current.push({
                    name: resultNode.getText(),
                    type: typeToSearchFor,
                    value: expression.asString
                });
            }

            return current;
        }, []);

        return result;
    }

    private getHttpExpressionsFromTest(variableDeclarations: VariableDeclaration[], functionsCall: string[]) {
        const testRequestTypeAsString = 'TestRequest';
        const testRequests: VariableDeclaration[] = variableDeclarations.filter((item: VariableDeclaration) => {
            return item.type === testRequestTypeAsString;
        });

        let httpExpressions = [];

        if (testRequests) {
            testRequests.forEach((func) => {

                httpExpressions = httpExpressions.concat(functionsCall.filter((expression) => {
                    return expression.indexOf(func.name + '.flush(') === 0 || expression.indexOf(func.name + '.error(') === 0;
                }).map((expression) => {
                    const httpRequestMatch = new RegExp(/\.expectOne\((.+)\)/gi).exec(func.value) || [];

                    if (httpRequestMatch.length > 1) {
                        return {
                            name: func.name,
                            expression: expression,
                            url: httpRequestMatch[1].replace(/[\'"]/gi, '')
                        };
                    }
                }));
            });
        }

        return httpExpressions;
    }

    private getTestSourceDetails(node: ts.Node, fileName: string) {
        let details: any = {
            importStatements: [],
            moduleSetup: {},
            includeTestForComponent: null,
            inlineComponents: [],
            inlineFunctions: [],
            binaryExpressions: [],
            examples: [],
            hasHostComponent: false
        };

        let traverseChild = (childNode: ts.Node) => {
            if (childNode.kind === ts.SyntaxKind.ImportDeclaration) {
                let importObj = {
                    value: childNode.getText(),
                    path: this.getImportStatementDetails(childNode)
                };

                details.importStatements.push(importObj);
            } else if (childNode.kind === ts.SyntaxKind.VariableDeclaration) {
                const nodeSymbol = this.checker.getSymbolAtLocation((childNode as ts.VariableDeclaration).name);

                if (nodeSymbol) {
                    nodeSymbol.getJsDocTags().map((docs: { name: string, text: string }) => {
                        return {
                            name: docs.name,
                            text: docs.text.trim()
                        };
                    }).forEach((docs: { name: string, text: string }) => {
                        if (docs.name === 'uijar') {
                            if (!details.bootstrapComponent) {
                                details.bootstrapComponent = docs.text;
                            }

                            details.includeTestForComponent = docs.text;
                            details.moduleSetup = this.getModuleDefinitionDetails(childNode);
                        } else if (docs.name === 'hostcomponent') {
                            details.bootstrapComponent = docs.text;
                            details.hasHostComponent = true;
                        }
                    });
                }
            } else if (childNode.kind === ts.SyntaxKind.ClassDeclaration) {
                const inlineComponent = this.getInlineComponent((childNode as ts.ClassDeclaration), fileName);

                if (inlineComponent) {
                    details.inlineComponents.push(inlineComponent);
                }
            } else if (childNode.kind === ts.SyntaxKind.CallExpression) {
                if (this.isExampleComment(childNode)) {
                    details.examples.push({
                        binaryExpressions: this.getExampleExpressionDetails(childNode),
                        functionsCall: this.getExampleFunctionCallsDetails(childNode),
                        variableDeclarations: this.getVariableDeclarationsDetails(childNode),
                        title: this.getExampleTitle(childNode)
                    });
                }
            } else if (childNode.kind === ts.SyntaxKind.FunctionDeclaration) {
                const inlineFunction = this.getInlineFunction((childNode as ts.FunctionDeclaration));
                details.inlineFunctions.push(inlineFunction);
            }

            ts.forEachChild(childNode, traverseChild);
        };

        traverseChild(node);

        return details;
    }

    private getVariableDeclarationsDetails(node: ts.Node): VariableDeclaration[] {
        let variableDeclarations: VariableDeclaration[] = [];

        let traverseChild = (childNode: ts.Node) => {
            if (childNode.kind === ts.SyntaxKind.VariableDeclaration) {
                const nodeSymbol = this.checker.getSymbolAtLocation((childNode as ts.VariableDeclaration).name);

                if (nodeSymbol) {
                    let variableType = this.checker.typeToString(this.checker.getTypeOfSymbolAtLocation(nodeSymbol, nodeSymbol.valueDeclaration));

                    variableDeclarations.push({
                        name: nodeSymbol.name,
                        type: variableType,
                        value: nodeSymbol.valueDeclaration.getText()
                    });
                }
            }

            ts.forEachChild(childNode, traverseChild);
        };

        traverseChild(node);

        return variableDeclarations;
    }

    private getInlineFunction(inlineFunctionDeclaration: ts.FunctionDeclaration) {
        return {
            name: inlineFunctionDeclaration.name.getText(),
            func: inlineFunctionDeclaration.getText()
        };
    }

    private isExampleComment(node: ts.Node) {
        const comment = node.getFullText().replace(/[\s\t\n\r]/gi, '');
        const regexp = /(\/\*{1,}@uijarexample).+\//;
        const matches = comment.match(regexp);

        if (matches) {
            return comment.indexOf(matches[0]) === 0;
        }

        return false;
    }

    private getExampleTitle(node: ts.Node) {
        const comment = node.getFullText();
        const regexp = /\/\*{1,}[\s\t\r\n\*]+@uijarexample\s(.+)[\t\r\n\s\*]+\//gi;
        const matches = regexp.exec(comment);

        if (matches) {
            return matches[1].trim();
        }

        return '';
    }

    private getExampleExpressionDetails(node: ts.Node): BinaryExpression[] {
        let expressions: BinaryExpression[] = [];

        const traverseChild = (childNode) => {
            if (childNode.kind === ts.SyntaxKind.BinaryExpression) {
                expressions.push({
                    expression: (childNode as ts.BinaryExpression),
                    asString: childNode.getText()
                });
            }

            ts.forEachChild(childNode, traverseChild);
        };

        traverseChild(node);

        return expressions;
    }

    private getExampleFunctionCallsDetails(node: ts.Node): string[] {
        let functionCalls: string[] = [];

        const traverseChild = (childNode) => {
            if (childNode.kind === ts.SyntaxKind.CallExpression) {
                functionCalls.push(childNode.getText().replace(/[\n\t\r]+/gi, ''));
            }

            ts.forEachChild(childNode, traverseChild);
        };

        traverseChild(node);

        return functionCalls;
    }

    private getImportStatementDetails(node: ts.Node) {
        if (node.kind === ts.SyntaxKind.StringLiteral) {
            return node.getText();
        }

        return ts.forEachChild(node, (nextNode) => this.getImportStatementDetails(nextNode));
    }

    private getModuleDefinitionDetails(node: ts.Node) {
        let moduleDefinition: any = {};
        let parentNode = null;

        const traverseChild = (childNode: ts.Node) => {
            if (childNode.kind === ts.SyntaxKind.ObjectLiteralExpression && !parentNode) {
                parentNode = childNode;
            }

            if (parentNode && parentNode.getText() === childNode.parent.getText()) {
                if (childNode.kind === ts.SyntaxKind.PropertyAssignment) {
                    const propertyName = (childNode as ts.PropertyAssignment).name.getText();
                    let propertyValue;

                    (childNode as ts.PropertyAssignment).getChildren().forEach((child) => {
                        if (child.kind === ts.SyntaxKind.ArrayLiteralExpression) {
                            propertyValue = child.getText();
                        }
                    });

                    if (propertyName && propertyValue) {
                        let propertyValueTrim = propertyValue.replace(/[\n\t\r]+/gi, '');
                        let customProviders = propertyValueTrim.match(/(\{.+\})/gi);

                        if (customProviders) {
                            customProviders.forEach((provider) => {

                                propertyValueTrim = propertyValueTrim.replace(provider, '');
                            });
                        } else {
                            customProviders = [];
                        }

                        propertyValueTrim = propertyValueTrim.substring(1, propertyValueTrim.length - 1);

                        moduleDefinition[propertyName] = propertyValueTrim.split(',').map((item) => item.trim())
                            .concat(customProviders).filter((item) => item !== '');
                    }
                }
            }

            ts.forEachChild(childNode, traverseChild);
        };

        traverseChild(node);

        return moduleDefinition;
    }

    private getInlineComponent(node: ts.ClassDeclaration, fileName: string): InlineComponent {
        const getPathToTemplateFile = (propertyNode: ts.PropertyAssignment) => {
            let templateUrl = propertyNode.initializer.getText();
            templateUrl = templateUrl.substring(1, templateUrl.length - 1);
            const pathToTemplateFile = path.resolve((this.program.getSourceFile(fileName) as ts.FileReference).fileName, '../'+ templateUrl);

            return pathToTemplateFile;
        };

        const traverseDecorator = (childNode: ts.Node): { template: string, templateUrlNodeAsString?: string } => {
            if (childNode.kind === ts.SyntaxKind.PropertyAssignment) {
                if((childNode as ts.PropertyAssignment).name.getText() === 'template') {
                    let inlineComponentTemplate = (childNode as ts.PropertyAssignment).initializer.getText();
                    inlineComponentTemplate = inlineComponentTemplate.substring(1, inlineComponentTemplate.length - 1);

                    return {
                        template: inlineComponentTemplate
                    };
                } else if((childNode as ts.PropertyAssignment).name.getText() === 'templateUrl') {
                    let templateUrlNodeAsString = childNode.getText();

                    return {
                        template: fs.readFileSync(getPathToTemplateFile((childNode as ts.PropertyAssignment)), 'UTF-8'),
                        templateUrlNodeAsString
                    };
                }
            }

            return ts.forEachChild(childNode, traverseDecorator);
        };

        const isComponent = (childNode: ts.Node) => {
            if (childNode.kind === ts.SyntaxKind.Identifier && childNode.getText() === 'Component') {
                return true;
            }

            return ts.forEachChild(childNode, isComponent);
        };

        if (node.decorators) {
            const inlineComponent = node.decorators.reduce((component: InlineComponent, decorator: ts.Decorator) => {
                if (isComponent(decorator)) {
                    let result = traverseDecorator(node);
                    let source = node.getText();

                    if(result.templateUrlNodeAsString) {
                        source = source.replace(result.templateUrlNodeAsString, 'template: `\n'+ result.template +'\n`');
                    }

                    component = {
                        source: source,
                        template: result.template,
                        name: (node as ts.ClassDeclaration).name.getText()
                    };
                }

                return component;
            }, null);

            return inlineComponent;
        }

        return null;
    }

}