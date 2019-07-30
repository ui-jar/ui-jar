import * as ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';
import { SourceDocs, ApiComponentProperties } from './component-parser';

export interface VariableDeclaration {
    type: string;
    name: string;
    value: string;
}

export interface InlineClass {
    source: string;
    name: string;
}

export interface TestDocs {
    importStatements: { value: string, path: string }[];
    declaredVariables: any;
    moduleSetup: any;
    includeTestForComponent: string;
    includesComponents?: string[];
    inlineClasses: InlineClass[];
    fileName: string;
    examples: TestExample[];
    inlineFunctions: string[];
    hasHostComponent: boolean;
    moduleMetadataOverride: { 
        moduleRefName: string;
        entryComponents: string[]
    }[];
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
    selector: string;
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

        files.forEach((currentFile) => {
            const details: TestDocs = this.getTestSourceDetails(this.program.getSourceFile(currentFile),
                currentFile, classesWithDocs, otherClasses);

            if (details.includeTestForComponent) {
                docs.push(details);
            }
        });

        return docs;
    }

    private getExampleComponentSourceDocs(bootstrapComponent: string, classesWithDocs: SourceDocs[],
        otherClasses: SourceDocs[], details: TestDocs): SourceDocs {
        const exampleComponent: SourceDocs = [...classesWithDocs, ...otherClasses].find((classDoc) => {
            return classDoc.componentRefName === (details.hasHostComponent ? bootstrapComponent : details.includeTestForComponent);
        });

        return exampleComponent;
    }

    private getExampleSourceCode(hasHostComponent: boolean, exampleComponent: SourceDocs, example: TestExample) {
        if(hasHostComponent) {
            return exampleComponent.source;
        }

        return this.getComponentSourceCode(exampleComponent, example);
    }

    private getComponentSourceCode(exampleComponent: SourceDocs, example: TestExample) {
        let template = '';

        if (!exampleComponent) {
            return template;
        }

        const inputProperties = exampleComponent.apiDetails.properties.filter((prop) => {
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

        template += `<${exampleComponent.selector}${inputPropertiesTemplates}></${exampleComponent.selector}>`;

        return `@Component({\n  selector: 'example-host',\n  template: \`${template}\`\n})\nclass ExampleHostComponent {}`;
    }

    private getComponentExpressionsFromTest(bootstrapComponent: string, binaryExpressions: BinaryExpression[]) {

        const variables = this.convertBinaryExpressionToVariableDeclaration(bootstrapComponent, binaryExpressions);
        const componentVariables: VariableDeclaration[] = variables.filter((item: VariableDeclaration) => {
            return item.type === bootstrapComponent;
        });

        const componentExpressions = componentVariables.reduce((result, componentVariable) => {
            const expressions = binaryExpressions.filter((expression) => {
                return expression.asString.indexOf(componentVariable.value) === 0;
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

    private getTestDeclaredVariables(childNode: ts.Node): Array<string> {
        return this.getVariableDeclarationsDetails(childNode).map( ({value: variableDeclaration})=> {
            return variableDeclaration;
        }).filter( variables => variables);
    }

    private getTestSourceDetails(node: ts.Node, fileName: string, classesWithDocs: SourceDocs[], otherClasses: SourceDocs[]) {
        let details: TestDocs = {
            importStatements: [],
            declaredVariables: [],
            moduleSetup: {},
            includeTestForComponent: null,
            inlineClasses: [],
            inlineFunctions: [],
            examples: [],
            hasHostComponent: false,
            fileName: (this.program.getSourceFile(fileName) as ts.FileReference).fileName,
            moduleMetadataOverride: []
        };

        let bootstrapComponent = null;

        let inlineFunctions = [];

        const parseUIJarJsDocs = (docs: { name: string, text: string }[]) => {
            docs.forEach((doc) => {
                if (doc.name === 'uijar') {
                    if (!bootstrapComponent) {
                        bootstrapComponent = doc.text;
                    }

                    details.includeTestForComponent = doc.text;
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

                    docs.filter((doc) => doc.name === 'uijar').forEach((doc) => {
                        details.moduleSetup = this.getModuleDefinitionDetails(nodeSymbol.valueDeclaration);
                    });

                    parseUIJarJsDocs(docs);
                }
            } else if (childNode.kind === ts.SyntaxKind.ClassDeclaration) {
                details.inlineClasses.push(this.getInlineClass((childNode as ts.ClassDeclaration), fileName));
            } else if (childNode.kind === ts.SyntaxKind.CallExpression) {
                if (this.isExampleComment(childNode) && bootstrapComponent) {

                    const declaredVariablesInExample = this.getTestDeclaredVariables(childNode);
                    if(declaredVariablesInExample.length >= 1) {
                        details.declaredVariables.push(declaredVariablesInExample);
                    }
                    
                    const example = {
                        componentProperties: null,
                        httpRequests: this.getExampleHttpRequests(childNode),
                        title: this.getExampleTitle(childNode),
                        sourceCode: '',
                        bootstrapComponent: this.getExampleHostComponent(childNode),
                        selector: ''
                    };

                    if(!example.bootstrapComponent) {
                        example.bootstrapComponent = bootstrapComponent;
                    } else {
                        details.hasHostComponent = true;
                    }

                    const exampleComponent: SourceDocs = this.getExampleComponentSourceDocs(example.bootstrapComponent, classesWithDocs, otherClasses, details);

                    example.componentProperties = this.getExampleComponentProperties(childNode, example.bootstrapComponent);
                    example.sourceCode = this.getExampleSourceCode(details.hasHostComponent, exampleComponent, example);
                    example.selector = exampleComponent.selector;

                    details.examples.push(example);
                } else if (this.isOverrideModuleExpression(childNode)) {
                    details.moduleMetadataOverride.push(this.getOverrideModuleMetadata(childNode as ts.CallExpression));
                } else {
                    const docs = this.getJsDocTags(childNode);

                    if(docs.length > 0) {
                        docs.filter((doc) => doc.name === 'uijar').forEach((doc) => {
                            // TestBed.configureTestingModule({ imports: [] ... }) or other function with TestModuleMetadata argument
                            details.moduleSetup = this.getModuleDefinitionDetails(this.getTestModuleMetadataNode(childNode));
                        });

                        parseUIJarJsDocs(docs);
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

        details.inlineFunctions = inlineFunctions.map((inlineFunction) => inlineFunction.func);

        return details;
    }

    private getTestModuleMetadataNode(childNode: ts.Node): ts.Node {
        let metadataNode = childNode;

        const getTestModuleMetadata = (currentNode: ts.Node) => {
            if (currentNode.kind === ts.SyntaxKind.CallExpression) {
                this.checker.getResolvedSignature((currentNode as ts.CallExpression)).getParameters().forEach((parameterSymbol, index) => {
                    const variableType = this.checker.typeToString(this.checker.getTypeOfSymbolAtLocation(parameterSymbol, parameterSymbol.valueDeclaration));

                    if (variableType === 'TestModuleMetadata') {
                        let testModuleDefinitionNode: ts.Node = (currentNode as ts.CallExpression).arguments[index];

                        if (testModuleDefinitionNode) {
                            if (testModuleDefinitionNode.kind === ts.SyntaxKind.Identifier) {
                                const nodeSymbol = this.checker.getSymbolAtLocation(testModuleDefinitionNode);

                                if(nodeSymbol) {
                                    testModuleDefinitionNode = nodeSymbol.valueDeclaration;
                                }
                            }

                            metadataNode = testModuleDefinitionNode;
                        }
                    }
                });
            }

            ts.forEachChild(currentNode, getTestModuleMetadata);
        };

        getTestModuleMetadata(childNode);

        return metadataNode;
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

    private getOverrideModuleMetadata(node: ts.CallExpression) {
        let isSetterPropertyAssignment = false;
        let overrideModuleMetadata = {
            moduleRefName: node.arguments[0].getText(),
            entryComponents: []
        };

        const traverseChild = (childNode: ts.Node) => {
            if(childNode.kind === ts.SyntaxKind.PropertyAssignment) {
                const propertyName = (childNode as ts.PropertyAssignment).name.getText();
                if(propertyName === 'set') {
                    isSetterPropertyAssignment = true;
                }

                if(isSetterPropertyAssignment) {
                    if(propertyName === 'entryComponents'){
                        const nodeSymbol = this.checker.getSymbolAtLocation((childNode as ts.PropertyAssignment).name);

                        if(nodeSymbol && nodeSymbol.valueDeclaration) {
                            const result = nodeSymbol.valueDeclaration.getChildren().find((child) => {
                                return child.kind === ts.SyntaxKind.ArrayLiteralExpression;
                            });

                            if(result) {
                                const entryComponents = (result as ts.ArrayLiteralExpression).elements.map((element) => element.getText());
                                overrideModuleMetadata.entryComponents = entryComponents;
                            }
                        }
                    }
                }
            }

            ts.forEachChild(childNode, traverseChild);
        };

        traverseChild(node.arguments[1]);

        return overrideModuleMetadata;
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

    private isExampleComment(node: ts.Node) {
        const comment = node.getFullText().replace(node.getText(), '');
        const regexp = /@uijarexample/i;
        const matches = comment.match(regexp);

        if (matches) {
            return true;
        }

        return false;
    }

    private isOverrideModuleExpression(node: ts.Node) {
        if ((node as ts.CallExpression).expression.getText() === 'TestBed.overrideModule') {
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

                    (childNode as ts.PropertyAssignment).getChildren().forEach((child) => {
                        if (child.kind === ts.SyntaxKind.ArrayLiteralExpression) {
                            (child as ts.ArrayLiteralExpression).elements.forEach((item) => {
                                if (propertyName) {
                                    moduleDefinition[propertyName] = moduleDefinition[propertyName] || [];
                                    moduleDefinition[propertyName].push(item.getText());
                                }
                            });
                        }
                    });
                }
            }

            ts.forEachChild(childNode, traverseChild);
        };

        traverseChild(node);

        return moduleDefinition;
    }

    private getInlineComponent(classNode: ts.ClassDeclaration, fileName: string): InlineClass {
        const getPathToTemplateFile = (propertyNode: ts.PropertyAssignment) => {
            let templateUrl = propertyNode.initializer.getText();
            templateUrl = templateUrl.substring(1, templateUrl.length - 1);
            const pathToTemplateFile = path.resolve((this.program.getSourceFile(fileName) as ts.FileReference).fileName, '../'+ templateUrl);

            return pathToTemplateFile;
        };

        const getPathToStyleFile = (propertyNode: ts.PropertyAssignment) => {
            const styleUrlsAsString = propertyNode.initializer.getText().replace(/[\n\t\r\s]/g, '');
            const styleUrls = styleUrlsAsString.substring(1, styleUrlsAsString.length - 1).split(',');

            return styleUrls.filter((styleUrl) => styleUrl !== '').map((styleUrl) => {
                return path.resolve((this.program.getSourceFile(fileName) as ts.FileReference).fileName, '../', styleUrl.substring(1, styleUrl.length - 1));
            });
        };

        const traverseDecorator = (node: ts.Node): { template: string, templateUrlNodeAsString: string, styles: string, styleUrlsNodeAsString: string } => {
            const result = {
                template: '',
                templateUrlNodeAsString: null,
                styles: '',
                styleUrlsNodeAsString: null
            };

            const traverseChild = (childNode: ts.Node) => {
                if (childNode.kind === ts.SyntaxKind.PropertyAssignment) {
                    if((childNode as ts.PropertyAssignment).name.getText() === 'template') {
                        let inlineComponentTemplate = (childNode as ts.PropertyAssignment).initializer.getText();
                        inlineComponentTemplate = inlineComponentTemplate.substring(1, inlineComponentTemplate.length - 1);
    
                        result.template = inlineComponentTemplate;
                    } else if((childNode as ts.PropertyAssignment).name.getText() === 'templateUrl') {
                        let templateUrlNodeAsString = childNode.getText();
    
                        result.template = fs.readFileSync(getPathToTemplateFile((childNode as ts.PropertyAssignment)), 'UTF-8');
                        result.templateUrlNodeAsString = templateUrlNodeAsString;
                    } else if((childNode as ts.PropertyAssignment).name.getText() === 'styleUrls') {
                        const urls = getPathToStyleFile((childNode as ts.PropertyAssignment));
                        urls.forEach((styleUrl) => {
                            result.styles += fs.readFileSync(styleUrl, 'UTF-8');
                        });

                        result.styleUrlsNodeAsString = childNode.getText();
                    }
                }

                ts.forEachChild(childNode, traverseChild);
            };

            traverseChild(node);

            return result;
        };

        const result = traverseDecorator(classNode);
        let source = classNode.getText();

        if(result.templateUrlNodeAsString) {
            source = source.replace(result.templateUrlNodeAsString, 'template: `\n'+ result.template +'\n`');
        }

        if(result.styleUrlsNodeAsString) {
            source = source.replace(result.styleUrlsNodeAsString, 'styles: [`'+ result.styles +'`]');
        }

        return {
            source: source,
            name: (classNode as ts.ClassDeclaration).name.getText()
        };
    }

    private getInlineClass(classNode: ts.ClassDeclaration, fileName: string): InlineClass {
        const isComponent = (childNode: ts.Node) => {
            if (childNode.kind === ts.SyntaxKind.Identifier && childNode.getText() === 'Component') {
                return true;
            }

            return ts.forEachChild(childNode, isComponent);
        };

        if (classNode.decorators) {
            const inlineClass = classNode.decorators.reduce((clazz: InlineClass, decorator: ts.Decorator) => {
                if (isComponent(decorator)) {
                    return this.getInlineComponent(classNode, fileName);
                } else {
                    clazz = {
                        source: classNode.getText(),
                        name: (classNode as ts.ClassDeclaration).name.getText()
                    };
                }

                return clazz;
            }, null);

            return inlineClass;
        }

        return {
            source: classNode.getText(),
            name: (classNode as ts.ClassDeclaration).name.getText()
        };
    }

}