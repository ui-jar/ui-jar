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
    fileName: string;
    examples: TestExample[];
    inlineFunctions: string[];
    hasHostComponent: boolean;
}

export interface TestExample {
    componentProperties: { name: string; expression: string }[];
    httpRequests: {
        name: string;
        expression: string;
        url: string;
    }[];
    sourceCode: string;
    title: string;
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
        const testDocs: TestDocs[] = this.getTestDocs(this.config.files, classesWithDocs, otherClasses);

        testDocs.filter((component) => component.moduleSetup['imports']).forEach((component) => {
            classesWithDocs.forEach((classDoc) => {
                if (classDoc.moduleDetails && component.moduleSetup['imports'].indexOf(classDoc.moduleDetails.moduleRefName) > -1) {
                    component.includesComponents = component.includesComponents || [];
                    component.includesComponents.push(classDoc.componentRefName);
                }
            });
        });

        this.verifyBootstrapComponentsIsAvailable(testDocs);

        return testDocs;
    }

    private verifyBootstrapComponentsIsAvailable(docs: TestDocs[]) {
        const missingBootstrapComponents = docs.reduce((missingComponents, component) => {
            const bootstrapComponents = component.examples.map((example) => example.bootstrapComponent);

            const result = bootstrapComponents.reduce((result, bootstrapComponent) => {
                if(!(component.includesComponents && component.includesComponents.includes(bootstrapComponent))
                    && !(component.moduleSetup.declarations && component.moduleSetup.declarations.includes(bootstrapComponent))) {
                    result.push(bootstrapComponent);
                }
                return result;
            }, []);

            missingComponents.push(...result);

            return missingComponents;
        }, []);

        missingBootstrapComponents.forEach((bootstrapComponent) => {
            console.error(`Could not find any reference to "${bootstrapComponent}".`);
            console.error(`1. Verify that "@uijar ${bootstrapComponent}" or "@hostcomponent ${bootstrapComponent}" is using correct component reference name.`);
            console.error(`2. If you have imported the module that has "${bootstrapComponent}" in @NgModule({ declarations: [${bootstrapComponent}] }) in the test setup, make sure that the imported module also has "${bootstrapComponent}" in @NgModule({ exports: [${bootstrapComponent}] })`);
        });
    }

    private getTestDocs(files: string[], classesWithDocs: SourceDocs[], otherClasses: SourceDocs[]): TestDocs[] {
        let docs: TestDocs[] = [];

        for (let currentFile of files) {
            const details: TestDocs = this.getTestSourceDetails(this.program.getSourceFile(currentFile),
                currentFile, classesWithDocs, otherClasses);

            if (details.includeTestForComponent) {
                docs.push(details);
            }
        }

        return docs;
    }

    private getExampleSourceCode(hasHostComponent: boolean, bootstrapComponent: string, classesWithDocs: SourceDocs[],
        otherClasses: SourceDocs[], details: TestDocs, example: TestExample) {

        if(hasHostComponent) {
            return this.getTestHostComponentSourceCode(bootstrapComponent, classesWithDocs, otherClasses);
        }

        return this.getComponentSourceCode(details, classesWithDocs, example);
    }

    private getTestHostComponentSourceCode(componentRefName: string, classesWithDocs: SourceDocs[], otherClasses: SourceDocs[]) {
        const exampleComponent: SourceDocs = [...classesWithDocs, ...otherClasses].find((classDoc) => {
            return classDoc.componentRefName === componentRefName;
        });

        if(exampleComponent) {
            return exampleComponent.source;
        }

        return '';
    }

    private getComponentSourceCode(details: TestDocs, classesWithDocs: SourceDocs[], example: TestExample) {
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
        const exampleComponentProperties = example.componentProperties.map((prop) => {
            const firstIndexOfEquals = prop.expression.indexOf('=');
            let propertyName = prop.expression.substr(0, firstIndexOfEquals);
            propertyName = propertyName.replace(prop.name, '').replace(/[\s\.\[\]"']+/gi, '');

            return propertyName;
        });

        inputProperties.forEach((inputProperty: ApiComponentProperties) => {
            const isExamplePropertyInput: any = exampleComponentProperties.find((componentProperty: string) =>
                componentProperty === inputProperty.propertyName);

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

    private getExampleHttpRequests(childNode: ts.Node) {
        const variableDeclarations: VariableDeclaration[] = this.getVariableDeclarationsDetails(childNode);
        const functionsCall: string[] = this.getExampleFunctionCallsDetails(childNode);
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

    private getTestSourceDetails(node: ts.Node, fileName: string, classesWithDocs: SourceDocs[], otherClasses: SourceDocs[]) {
        let details: TestDocs = {
            importStatements: [],
            moduleSetup: {},
            includeTestForComponent: null,
            inlineComponents: [],
            inlineFunctions: [],
            examples: [],
            hasHostComponent: false,
            fileName: (this.program.getSourceFile(fileName) as ts.FileReference).fileName
        };

        let bootstrapComponent = null;

        let inlineFunctions = [];

        const parseJsDocs = (docsNode: ts.Node, docs: { name: string, text: string }[]) => {
            // TODO (nording) refactor this...
            docs.forEach((doc) => {
                if (doc.name === 'uijar') {
                    if (!bootstrapComponent) {
                        bootstrapComponent = doc.text;
                    }

                    details.includeTestForComponent = doc.text;
                    details.moduleSetup = this.getModuleDefinitionDetails(docsNode);
                } else if (doc.name === 'hostcomponent') {
                    bootstrapComponent = doc.text;
                    details.hasHostComponent = true;
                }
            });
        };

        const traverseChild = (childNode: ts.Node) => {
            if (childNode.kind === ts.SyntaxKind.ImportDeclaration) {
                let importObj = {
                    value: childNode.getText(),
                    path: this.getImportStatementDetails(childNode)
                };

                details.importStatements.push(importObj);
            } else if (childNode.kind === ts.SyntaxKind.VariableDeclaration) {
                const nodeSymbol = this.checker.getSymbolAtLocation((childNode as ts.VariableDeclaration).name);

                if (nodeSymbol) {
                    const docs = nodeSymbol.getJsDocTags().filter((docs: { name: string, text?: string }) => {
                        return docs.name && docs.text;
                    }).map((docs) => {
                        return {
                            name: docs.name,
                            text: docs.text.trim()
                        };
                    });

                    parseJsDocs(childNode, docs);
                }
            } else if (childNode.kind === ts.SyntaxKind.ClassDeclaration) {
                const inlineComponent = this.getInlineComponent((childNode as ts.ClassDeclaration), fileName);

                if (inlineComponent) {
                    details.inlineComponents.push(inlineComponent);
                }
            } else if (childNode.kind === ts.SyntaxKind.CallExpression) {
                if (this.isExampleComment(childNode) && bootstrapComponent) {
                    const example = {
                        componentProperties: null,
                        httpRequests: this.getExampleHttpRequests(childNode),
                        title: this.getExampleTitle(childNode),
                        sourceCode: '',
                        bootstrapComponent: this.getExampleHostComponent(childNode)
                    };

                    if(!example.bootstrapComponent) {
                        example.bootstrapComponent = bootstrapComponent;
                    } else {
                        details.hasHostComponent = true;
                    }

                    example.componentProperties = this.getExampleComponentProperties(childNode, example.bootstrapComponent);

                    example.sourceCode = this.getExampleSourceCode(details.hasHostComponent,
                        example.bootstrapComponent, classesWithDocs, otherClasses, details, example);

                    details.examples.push(example);
                } else {
                    const docs = this.getJsDocTags(childNode);

                    if(docs.length > 0) {
                        const testModuleDeclarationNode = this.getTestModuleDeclarationNode(childNode);

                        parseJsDocs(testModuleDeclarationNode, docs);
                    }
                }
            } else if (childNode.kind === ts.SyntaxKind.FunctionDeclaration) {
                const inlineFunction = this.getInlineFunction((childNode as ts.FunctionDeclaration));

                if (inlineFunction) {
                    inlineFunctions.push(inlineFunction);
                }
            }

            ts.forEachChild(childNode, traverseChild);
        };

        traverseChild(node);

        details.inlineFunctions = this.getCalledFunctionFromTest(inlineFunctions, details.examples);

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
        if (inlineFunctionDeclaration.name) {
            return {
                name: inlineFunctionDeclaration.name.getText(),
                func: inlineFunctionDeclaration.getText()
            };
        }
    }

    private getJsDocTags(node: ts.Node): { name: string, text: string }[] {
        const jsDoc = node.getFullText().replace(node.getText(), '');
        let result = [];

        const componentName = this.getUIJarComponentName(jsDoc);

        if(componentName) {
            result.push(componentName);
        }

        const hostComponentName = this.getHostComponentName(jsDoc);

        if(hostComponentName) {
            result.push(hostComponentName);
        }

        return result;
    }

    private getHostComponentName(jsDoc: string) {
        const regexp = /@hostcomponent\s(.+)/i;
        const matches = jsDoc.match(regexp);

        if(matches) {
            return {
                name: 'hostcomponent',
                text: matches[1].trim()
            };
        }

        return null;
    }

    private getUIJarComponentName(jsDoc: string) {
        const regexp = /@uijar\s(.+)/i;
        const matches = jsDoc.match(regexp);

        if(matches) {
            return {
                name: 'uijar',
                text: matches[1].trim()
            };
        }

        return null;
    }

    private getTestModuleDeclarationNode(node: ts.Node) {
        const traverseChild = (childNode: ts.Node) => {
            if(childNode.kind === ts.SyntaxKind.Identifier) {
                const nodeSymbol = this.checker.getSymbolAtLocation(childNode);

                if(nodeSymbol) {
                    if(nodeSymbol.valueDeclaration) {
                        const result = nodeSymbol.valueDeclaration.getChildren().find((child) => {
                            return child.kind === ts.SyntaxKind.ObjectLiteralExpression;
                        });

                        if(result) {
                            return result;
                        }
                    }
                }
            } else if (childNode.kind === ts.SyntaxKind.ObjectLiteralExpression) {
                return childNode;
            }

            return ts.forEachChild(childNode, traverseChild);
        };

        return traverseChild(node);
    }

    private isExampleComment(node: ts.Node) {
        const comment = node.getFullText().replace(node.getText(), '');
        const regexp = /@uijarexample/i;
        const matches = comment.match(regexp);

        if (matches) {
            return true;
        }

        return false;
    }

    private getExampleTitle(node: ts.Node) {
        const comment = node.getFullText().replace(node.getText(), '');
        const regexp = /@uijarexample\s([a-z0-9!"'#$%&\(\)=_\-\s\t\v\,]+)/i;
        const matches = regexp.exec(comment);

        if (matches) {
            return matches[1].trim();
        }

        return '';
    }

    private getExampleHostComponent(node: ts.Node): string {
        const comment = node.getFullText().replace(node.getText(), '');
        const regexp = /@hostcomponent\s([a-z0-9_\-$]+)/i;
        const matches = regexp.exec(comment);

        if (matches) {
            return matches[1].trim();
        }

        return null;
    }

    private getExampleComponentProperties(node: ts.Node, bootstrapComponent: string): { name: string; expression: string }[] {
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

        return this.getComponentExpressionsFromTest(bootstrapComponent, expressions);
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