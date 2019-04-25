import * as ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';
import { ModuleDocs } from './module-parser';
import { TestExample } from './test-source-parser';

export interface SourceDocs {
    componentRefName: string;
    componentDocName: string;
    groupDocName: string;
    examples: TestExample[];
    description: string;
    fileName: string;
    moduleDetails: ModuleDetails;
    apiDetails: ApiDetails;
    exampleTemplate?: string;
    selector: string;
    extendClasses: string[];
    source: string;
    generatedModuleDetails?: {
        moduleRefName: string;
        fileName: string;
    };
}

export interface ApiDetails {
    properties: ApiComponentProperties[];
    methods: any[];
}

export interface ApiComponentProperties {
    decoratorNames: string[]; 
    propertyName: string;
    type: string;
    description: string;
}

export interface ModuleDetails {
    moduleRefName: string;
    fileName: string;
}

export interface ProjectSourceDocs {
    classesWithDocs: SourceDocs[];
    otherClasses: SourceDocs[];
}

export class ComponentParser {
    private checker: ts.TypeChecker;

    constructor(private config: { rootDir: string, files: string[] }, private program: ts.Program) {
        this.checker = this.program.getTypeChecker();
    }

    getComponentDocs(componentFiles: string[], moduleDocs: ModuleDocs[]): ProjectSourceDocs {
        let classesWithDocs: SourceDocs[] = [];
        let otherClasses: SourceDocs[] = [];

        componentFiles.forEach((currentFile) => {
            let classes: any[] = this.getComponentSourceData(this.program.getSourceFile(currentFile), currentFile);

            classes.forEach((details) => {
                let doc: SourceDocs = {
                    componentRefName: details.classRefName,
                    componentDocName: details.componentDocName,
                    groupDocName: details.groupDocName,
                    examples: [],
                    description: details.description,
                    apiDetails: {
                        properties: details.properties,
                        methods: details.methods
                    },
                    fileName: (this.program.getSourceFile(currentFile) as ts.FileReference).fileName.replace(this.config.rootDir, ''),
                    moduleDetails: this.getModuleDetailsToComponent(details.classRefName, moduleDocs),
                    selector: details.selector,
                    extendClasses: details.extendClasses,
                    source: details.source
                };

                if (doc.componentDocName) {
                    classesWithDocs.push(doc);
                } else {
                    otherClasses.push(doc);
                }
            });
        });

        classesWithDocs = this.getPropertiesFromExtendedComponentClasses(classesWithDocs, otherClasses);

        return {
            classesWithDocs,
            otherClasses
        };
    }

    private getModuleDetailsToComponent(componentRefName: string, moduleDocs: ModuleDocs[]): ModuleDetails {
        const moduleDoc = moduleDocs.find((moduleDoc: ModuleDocs) => {
            const componentContainsInModule = moduleDoc.includesComponents.find((componentName) => {
                return componentName === componentRefName;
            });

            return componentContainsInModule !== undefined;
        });

        if(moduleDoc) {
            return {
                moduleRefName: moduleDoc.moduleRefName,
                fileName: moduleDoc.fileName.replace(this.config.rootDir, '')
            };
        }
    }

    private getComponentSourceData(node: ts.Node, fileName: string) {
        let classes = [];
        let classDetails: any = {
            properties: [],
            methods: [],
            selector: '',
            extendClasses: [],
            source: ''
        };

        let currentClassDetails = Object.assign({}, classDetails);

        const traverseChild = (childNode: ts.Node) => {
            if (childNode.kind === ts.SyntaxKind.ClassDeclaration) {
                currentClassDetails = Object.assign({}, classDetails);
                classes.push(currentClassDetails);

                if((childNode as ts.ClassDeclaration).name) {
                    currentClassDetails.classRefName = (childNode as ts.ClassDeclaration).name.text;
                    currentClassDetails.selector = this.getComponentSelector((childNode as ts.ClassDeclaration));
                    currentClassDetails.source = this.getComponentSourceCode((childNode as ts.ClassDeclaration), fileName);

                    const nodeSymbol = this.checker.getSymbolAtLocation((childNode as ts.ClassDeclaration).name);

                    nodeSymbol.getJsDocTags().forEach((docs: { name: string, text: string }) => {
                        switch (docs.name) {
                            case 'group':
                                currentClassDetails.groupDocName = docs.text;
                                break;
                            case 'component':
                                currentClassDetails.componentDocName = docs.text;
                                break;
                            case 'description':
                                currentClassDetails.description = docs.text;
                                break;
                        }
                    });

                    nodeSymbol.members.forEach((currentMemberSymbol: ts.Symbol) => {
                        let memberDetails = this.getClassMemberDetails(currentMemberSymbol);

                        if (memberDetails) {
                            currentClassDetails.properties = currentClassDetails.properties.concat(memberDetails.properties);
                            currentClassDetails.methods = currentClassDetails.methods.concat(memberDetails.methods);
                        }
                    });
                }

            } else if(childNode.kind === ts.SyntaxKind.HeritageClause) {
                childNode.getChildren().forEach((child) => {
                    if(child.kind === ts.SyntaxKind.SyntaxList) {
                        let extendClasses = child.getText().split(',');

                        extendClasses = extendClasses.map((value) => {
                            value = value.trim();
                            value = value.replace(/<.+>/gi, '');

                            return value;
                        }).filter((value) => value !== '');
                        currentClassDetails.extendClasses = currentClassDetails.extendClasses.concat(extendClasses);
                    }
                });
            }

            ts.forEachChild(childNode, traverseChild);
        };

        traverseChild(node);

        return classes;
    }

    private getComponentSelector(node: ts.ClassDeclaration): string {
        let selector = '';

        const traverseDecorator = (childNode: ts.Node) => {
            if (childNode.kind === ts.SyntaxKind.PropertyAssignment
                && (childNode as ts.PropertyAssignment).name.getText() === 'selector') {
                selector = (childNode as ts.PropertyAssignment).initializer.getText();
                selector = selector.substring(1, selector.length - 1);
            }

            ts.forEachChild(childNode, traverseDecorator);
        };

        const isComponent = (childNode: ts.Node) => {
            if (childNode.kind === ts.SyntaxKind.Identifier && childNode.getText() === 'Component') {
                return true;
            }

            return ts.forEachChild(childNode, isComponent);
        };

        if (node.decorators) {
            node.decorators.forEach((decorator: ts.Decorator) => {
                if (isComponent(decorator)) {
                    traverseDecorator(node);
                }
            });
        }

        return selector;
    }

    private getComponentSourceCode(classNode: ts.ClassDeclaration, fileName: string): string {
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

        const isComponent = (childNode: ts.Node) => {
            if (childNode.kind === ts.SyntaxKind.Identifier && childNode.getText() === 'Component') {
                return true;
            }

            return ts.forEachChild(childNode, isComponent);
        };

        if (classNode.decorators) {
            const sourceCode = classNode.decorators.reduce((sourceCode: string, decorator: ts.Decorator) => {
                if (isComponent(decorator)) {
                    const result = traverseDecorator(classNode);
                    let source = classNode.getText();

                    if(result.templateUrlNodeAsString) {
                        source = source.replace(result.templateUrlNodeAsString, 'template: `\n'+ result.template +'\n`');
                    }

                    if(result.styleUrlsNodeAsString) {
                        source = source.replace(result.styleUrlsNodeAsString, 'styles: [`\n'+ result.styles +'\n`]');
                    }

                    sourceCode = source;
                }

                return sourceCode;
            }, null);

            return sourceCode;
        }

        return null;
    }

    private getClassMemberDetails(currentMemberSymbol: ts.Symbol) {
        let details: any = {
            properties: [],
            methods: []
        };

        const currentDeclaration = currentMemberSymbol.valueDeclaration;

        if (currentDeclaration) {
            if (this.checkIfSymbolHasPrivateModifier(currentMemberSymbol)) {
                return;
            }

            if (currentDeclaration.kind === ts.SyntaxKind.PropertyDeclaration) {
                details.properties = details.properties.concat(this.getPropertyToDetails(currentMemberSymbol));
            } else if (currentDeclaration.kind === ts.SyntaxKind.MethodDeclaration) {
                details.methods = details.methods.concat(this.getMethodToDetails(currentMemberSymbol));
            } else if (currentDeclaration.kind === ts.SyntaxKind.GetAccessor
                || currentDeclaration.kind === ts.SyntaxKind.SetAccessor) {
                details.properties = details.properties.concat(this.getAccessorDeclarationToDetails(currentMemberSymbol));
            }
        }

        return details;
    }

    private getMethodToDetails(symbol: ts.Symbol) {
        let methods = [];
        const nodeComment = this.getNodeComment(symbol);
        const declaration = (symbol.valueDeclaration as ts.MethodDeclaration);
        const parametersAsString = this.getMethodParametersAsString(declaration.parameters);

        methods.push({
            methodName: `${symbol.getName()}(${parametersAsString})`,
            description: nodeComment
        });

        return methods;
    }

    private getMethodParametersAsString(parameters: ts.NodeArray<ts.ParameterDeclaration>): string {
        const parametersAsString = parameters.reduce((result: string[], parameter: ts.ParameterDeclaration) => {
            result.push(parameter.getText());
            return result;
        }, []).join(',');

        return parametersAsString;
    }

    private checkIfSymbolHasPrivateModifier(nodeSymbol: ts.Symbol): boolean {
        if (!nodeSymbol.valueDeclaration.modifiers) {
            // default is public, if modifiers is undefined, its public
            return false;
        }

        const hasPrivateModifier = nodeSymbol.valueDeclaration.modifiers.filter(
            (modifier: ts.Modifier) => {
                return modifier.kind === ts.SyntaxKind.PrivateKeyword || modifier.kind === ts.SyntaxKind.ProtectedKeyword;
            }).length > 0;

        return hasPrivateModifier;
    }

    private getAccessorDeclarationToDetails(symbol: ts.Symbol) {
        let properties = [];

        const findIndexForPropertyName = (propertyName): number => {
            return properties.findIndex((item) => {
                return item.propertyName === propertyName;
            });
        };

        symbol.getDeclarations().forEach((declaration: ts.AccessorDeclaration) => {
            const signature = this.checker.getSignatureFromDeclaration(declaration);
            const nodeComment = this.getNodeComment(signature);
            const decorators = declaration.decorators;
            let decoratorNames: string[] = [];

            if (decorators) {
                decorators.forEach((decorator: ts.Decorator) => {
                    decoratorNames.push(decorator.getText());
                });
            }
            
            const propertyItemIndexPosition = findIndexForPropertyName(symbol.getName());

            if(propertyItemIndexPosition > -1) {
                let propertyItem = properties[propertyItemIndexPosition];
                propertyItem.decoratorNames = propertyItem.decoratorNames.concat(decoratorNames);
                propertyItem.description = propertyItem.description += nodeComment;
            } else {
                properties.push({
                    decoratorNames,
                    propertyName: symbol.getName(),
                    type: this.checker.typeToString(this.checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration)),
                    description: nodeComment
                });
            }
        });

        return properties;
    }

    private getPropertyToDetails(symbol: ts.Symbol) {
        let properties: ApiComponentProperties[] = [];
        const decorators = symbol.valueDeclaration.decorators;
        const nodeComment = this.getNodeComment(symbol);
        let decoratorNames: string[] = [];

        if (decorators) {
            decorators.forEach((decorator: ts.Decorator) => {
                decoratorNames.push(decorator.getText());
            });
        }

        properties.push({
            decoratorNames,
            propertyName: symbol.getName(),
            type: this.checker.typeToString(this.checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration)),
            description: nodeComment
        });

        return properties;
    }

    private getNodeComment(nodeSymbol: ts.Symbol | ts.Signature): string {
        const comment = nodeSymbol.getDocumentationComment(this.checker).reduce((result, comment: { text: string, kind: string }) => {
            if (comment.kind === 'text') {
                result += comment.text;
            }

            return result;
        }, '');

        return comment;
    }

    private getPropertiesFromExtendedComponentClasses(classesWithDocs: SourceDocs[], otherClasses: SourceDocs[]): SourceDocs[] {
        const docs = [...classesWithDocs];
        const otherDocsClasses = [...otherClasses];

        const getAllExtendedClassDocs = (componentRefName: string, classes: SourceDocs[]) => {
            let result = [];

            const extendedClassDocs = classes.find((clazz) => {
                return componentRefName === clazz.componentRefName;
            });

            if(extendedClassDocs) {
                result.push(extendedClassDocs);

                extendedClassDocs.extendClasses.forEach((extendClassName) => {
                    result = result.concat(getAllExtendedClassDocs(extendClassName, classes)); 
                });
            }

            return result;
        };

        docs.forEach((doc) => {
            doc.extendClasses.forEach((extendClass) => {
                const extendedClassDocs = getAllExtendedClassDocs(extendClass, otherDocsClasses);

                if(extendedClassDocs.length > 0) {
                    extendedClassDocs.forEach((extendedClass) => {
                        doc.apiDetails.properties = doc.apiDetails.properties.concat(extendedClass.apiDetails.properties);
                        doc.apiDetails.methods = doc.apiDetails.methods.concat(extendedClass.apiDetails.methods);
                    });
                }
            });
        });

        return docs;
    }
}