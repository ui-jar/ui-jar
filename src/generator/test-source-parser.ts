import * as ts from 'typescript';
import * as path from 'path';
import { SourceDocs, ApiComponentProperties } from './source-parser';

interface VariableDeclaration {
    type: string;
    name: string;
}

export interface InlineComponent {
    source: string;
    template: string;
    name: string;
}

export interface TestDocs {
    importStatements: { value: string, path: string}[];
    moduleSetup: any;
    includeTestForComponent: string;
    includesComponents?: string[];
    inlineComponents: InlineComponent[];
    variableDeclarations: { name: string, type: string }[];
    binaryExpressions: string[];
    fileName: string;
    examples: { componentProperties: any[] }[];
    inlineFunctions: string[];
    bootstrapComponent: string;
    exampleTemplate: string;
}

export class TestSourceParser {
    private checker: ts.TypeChecker;

    constructor(private config: any, private program: ts.Program) {
        this.checker = this.program.getTypeChecker();
    }

    getProjectTestDocumentation(sourceDocs: SourceDocs[]): TestDocs[] {
        const testDocs: any[] = this.getTestDocs(this.config.files, sourceDocs);

        testDocs.filter((component) => component.moduleSetup['imports']).forEach((component) => {
            sourceDocs.forEach((sourceDocs) => {
                if (sourceDocs.moduleDetails && component.moduleSetup['imports'].indexOf(sourceDocs.moduleDetails.moduleRefName) > -1) {
                    component.includesComponents = component.includesComponents || [];
                    component.includesComponents.push(sourceDocs.componentRefName);
                }
            });
        });

        this.verifyBootstrapComponentExist(testDocs);

        return testDocs;
    }

    private verifyBootstrapComponentExist(docs: any[]) {
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
            console.error(`Verify that "@uijar ${testDocs.bootstrapComponent}" or "@hostcomponent ${testDocs.bootstrapComponent}" is using correct component reference name.`);
        });

        if (result.length > 0) {
            process.exit(1);
        }
    }

    private getTestDocs(files: string[], sourceDocs: SourceDocs[]): TestDocs[] {
        let docs: TestDocs[] = [];

        for (let currentFile of files) {
            let details: any = this.getTestSourceDetails(this.program.getSourceFile(currentFile));
            details.fileName = (this.program.getSourceFile(currentFile) as ts.FileReference).fileName;

            details.examples.forEach((example) => {
                const expressions = this.getBinaryExpressionsFromTest(details.bootstrapComponent,
                    details.variableDeclarations, example.binaryExpressions);

                example.componentProperties = expressions;
            });

            details.inlineFunctions = this.getCalledFunctionFromTest(details.inlineFunctions, details.examples);

            if (details.bootstrapComponent) {
                details.exampleTemplate = this.getExampleTemplate(details.inlineComponents,
                    details.bootstrapComponent, sourceDocs, details);
            }

            if (details.bootstrapComponent) {
                docs.push(details);
            }
        }

        return docs;
    }

    private getExampleTemplate(inlineComponents: InlineComponent[],
        bootstrapComponent: string, sourceDocs: SourceDocs[], details: any) {

        let exampleTemplate = inlineComponents
            .filter((inlineComponent) => inlineComponent.name === bootstrapComponent)
            .map((inlineComponent) => inlineComponent.template);

        if (exampleTemplate.length > 0) {
            return exampleTemplate[0];
        }

        return this.getComponentTemplate(details, sourceDocs);
    }

    private getComponentTemplate(details: any, sourceDocs: SourceDocs[]) {
        let template = '';

        const currentComponentSourceDocs = sourceDocs.find((sourceDocs: SourceDocs) => {
            return sourceDocs.componentRefName === details.includeTestForComponent;
        });

        if(!currentComponentSourceDocs) {
            return template;
        }

        const inputProperties = currentComponentSourceDocs.apiDetails.properties.filter((prop) => {
            const isInput = prop.decoratorNames.filter((decoratorName) => {
                return decoratorName.indexOf('@Input(') > -1;
            }).length > 0;

            return isInput;
        });

        details.examples.forEach((example) => {
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
                    inputPropertiesTemplates += ` [${inputProperty.propertyName}]="${isExamplePropertyInput.propertyValue}"`;
                }
            });

            template += `<${currentComponentSourceDocs.selector}${inputPropertiesTemplates}></${currentComponentSourceDocs.selector}>\n`;
        });

        return template;
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

    private getBinaryExpressionsFromTest(bootstrapComponent: string, variableDeclarations: VariableDeclaration[],
        binaryExpressions: string[]) {

        let componentVariable: VariableDeclaration = variableDeclarations.find((item: VariableDeclaration) => {
            return item.type === bootstrapComponent;
        });

        let expressions = [];

        if (componentVariable) {
            expressions = binaryExpressions.filter((expression) => {
                return expression.indexOf(componentVariable.name) === 0;
            }).map((expression) => {
                return {
                    name: componentVariable.name,
                    expression: expression
                };
            });
        }

        return expressions;
    }

    private getResolvedImportPath(importStatement: any, sourceFilePath): string {
        const rootDir = __dirname;
        const importStatementPath = importStatement.path.replace(/[\"']/gi, '');
        const sourceFileDirectoryPath = path.resolve(sourceFilePath.substr(0, sourceFilePath.lastIndexOf('/')));
        const testFilePath = path.relative(path.resolve(rootDir), sourceFileDirectoryPath);
        const sourceFileAbsolutePath = path.resolve(path.resolve(rootDir), testFilePath, importStatementPath);
        const importPath = path.relative(path.resolve(rootDir), sourceFileAbsolutePath);

        const replacedImportStatement = importStatement.value.replace(importStatement.path, `'${importPath}'`).replace(/\\/gi, '/');

        return replacedImportStatement;
    }

    private isImportPathRelative(importStatement: any) {
        return importStatement.path.charAt(1) === '.';
    }

    private getTestSourceDetails(node: ts.Node) {
        let details: any = {
            importStatements: [],
            moduleSetup: {},
            includeTestForComponent: null,
            inlineComponents: [],
            inlineFunctions: [],
            variableDeclarations: [],
            binaryExpressions: [],
            examples: []
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
                    nodeSymbol.getJsDocTags().forEach((docs: { name: string, text: string }) => {
                        if (docs.name === 'uijar') {
                            if (!details.bootstrapComponent) {
                                details.bootstrapComponent = docs.text;
                            }

                            details.includeTestForComponent = docs.text;
                            details.moduleSetup = this.getModuleDefinitionDetails(childNode);
                        } else if (docs.name === 'hostcomponent') {
                            details.bootstrapComponent = docs.text;
                        }
                    });

                    let variableType = this.checker.typeToString(this.checker.getTypeOfSymbolAtLocation(nodeSymbol, nodeSymbol.valueDeclaration));

                    details.variableDeclarations.push({
                        name: nodeSymbol.name,
                        type: variableType
                    });
                }
            } else if (childNode.kind === ts.SyntaxKind.ClassDeclaration) {
                const inlineComponent = this.getInlineComponent((childNode as ts.ClassDeclaration));

                if (inlineComponent) {
                    details.inlineComponents.push(inlineComponent);
                }
            } else if (childNode.kind === ts.SyntaxKind.CallExpression) {
                if (this.isExampleComment(childNode)) {
                    details.examples.push({
                        binaryExpressions: this.getExampleExpressionDetails(childNode)
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

    private getInlineFunction(inlineFunctionDeclaration: ts.FunctionDeclaration) {
        return {
            name: inlineFunctionDeclaration.name.getText(),
            func: inlineFunctionDeclaration.getText()
        };
    }

    private isExampleComment(node: ts.Node) {
        const comment = node.getFullText().replace(/[\s\t\n\r]/gi, '');
        const regexp = /(\/\*{1,}@uijarexample\*{1,})\//;
        const matches = comment.match(regexp);

        if (matches) {
            return comment.indexOf(matches[0]) === 0;
        }

        return false;
    }

    private getExampleExpressionDetails(node: ts.Node): string[] {
        let expressions: string[] = [];

        const traverseChild = (childNode) => {
            if (childNode.kind === ts.SyntaxKind.BinaryExpression) {
                expressions.push(childNode.getText());
            }

            ts.forEachChild(childNode, traverseChild);
        };

        traverseChild(node);

        return expressions;
    }

    private getImportStatementDetails(node: ts.Node) {
        if (node.kind === ts.SyntaxKind.StringLiteral) {
            return node.getText();
        }

        return ts.forEachChild(node, (nextNode) => this.getImportStatementDetails(nextNode));
    }

    private getModuleDefinitionDetails(node: ts.Node) {
        let moduleDefinition: any = {};

        const traverseChild = (childNode: ts.Node) => {
            if (childNode.kind === ts.SyntaxKind.PropertyAssignment) {
                const propertyName = (childNode as ts.PropertyAssignment).name.getText();
                let propertyValue;

                (childNode as ts.PropertyAssignment).getChildren().forEach((child) => {
                    if (child.kind === ts.SyntaxKind.ArrayLiteralExpression) {
                        propertyValue = child.getText();
                    }
                });

                if (propertyName && propertyValue) {
                    moduleDefinition[propertyName] = propertyValue.replace(/[\n\t\r\s\[\]]+/gi, '').split(',');
                }

            }

            ts.forEachChild(childNode, traverseChild);
        };

        traverseChild(node);

        return moduleDefinition;
    }

    private getInlineComponent(node: ts.ClassDeclaration): InlineComponent {
        let inlineComponentTemplate = null;

        const traverseDecorator = (childNode: ts.Node) => {
            if (childNode.kind === ts.SyntaxKind.PropertyAssignment
                && ((childNode as ts.PropertyAssignment).name.getText() === 'template'
                    || (childNode as ts.PropertyAssignment).name.getText() === 'templateUrl')) {
                inlineComponentTemplate = (childNode as ts.PropertyAssignment).initializer.getText();
                inlineComponentTemplate = inlineComponentTemplate.substring(1, inlineComponentTemplate.length - 1);
            }

            ts.forEachChild(childNode, traverseDecorator);
        };

        const isComponent = (childNode: ts.Node) => {
            if (childNode.kind === ts.SyntaxKind.Identifier && childNode.getText() === 'Component') {
                return true;
            }

            return ts.forEachChild(childNode, isComponent);
        };

        let inlineComponent: InlineComponent = null;

        if (node.decorators) {
            node.decorators.forEach((decorator: ts.Decorator) => {
                if (isComponent(decorator)) {
                    traverseDecorator(node);
                    inlineComponent = {
                        source: node.getText(),
                        template: inlineComponentTemplate,
                        name: (node as ts.ClassDeclaration).name.getText()
                    };
                }
            });
        }

        return inlineComponent;
    }

}