import * as ts from 'typescript';

export interface SourceDocs {
    componentRefName: string;
    componentDocName: string;
    groupDocName: string;
    examples?: { componentProperties: any[] }[];
    description: string;
    fileName: string;
    moduleDetails: ModuleDetails;
    apiDetails: ApiDetails;
    exampleTemplate?: string;
    selector: string;
    bootstrapComponent?: string;
    extendClasses: string[];
}

export interface ApiDetails {
    properties: ApiComponentProperties[];
    methods: any[];
}

export interface ModuleDocs {
    moduleRefName?: string;
    fileName?: string;
    includesComponents?: string[];
}

export interface ModuleDetails {
    moduleRefName: string;
    fileName: string;
}

export interface ApiComponentProperties {
    decoratorNames: string[]; 
    propertyName: string;
    type: string;
    description: string;
}

export class SourceParser {
    private checker: ts.TypeChecker;

    constructor(private config: { rootDir: string, files: string[] }, private program: ts.Program) {
        this.checker = this.program.getTypeChecker();
    }

    getProjectSourceDocumentation(): SourceDocs[] {
        const {
            componentFiles,
            moduleFiles
        } = this.getComponentAndModuleFiles(this.config.files);

        const moduleDocs: ModuleDocs[] = this.getModuleDocs(moduleFiles);
        const sourceDocs: SourceDocs[] = this.getSourceDocs(componentFiles, moduleDocs);

        return sourceDocs;
    }

    private getComponentAndModuleFiles(files: string[]) {
        let componentFiles = [];
        let moduleFiles = [];

        for (let currentFile of files) {
            if (this.isComponentFile(this.program.getSourceFile(currentFile))) {
                componentFiles.push(currentFile);
            }

            if (this.isModuleFile(this.program.getSourceFile(currentFile))) {
                moduleFiles.push(currentFile);
            }
        }

        return { componentFiles, moduleFiles };
    }

    private isComponentFile(sourceFile: ts.SourceFile): boolean {
        let isComponentFile = false;

        const traverseDecorator = (childNode: ts.Node) => {
            if (childNode.kind === ts.SyntaxKind.Identifier &&
                (childNode.getText() === 'Component' || childNode.getText() === 'Directive')) {
                isComponentFile = true;
                return;
            }

            ts.forEachChild(childNode, traverseDecorator);
        };

        const traverseChild = (childNode: ts.Node) => {
            if (childNode.kind == ts.SyntaxKind.Decorator) {
                ts.forEachChild(childNode, traverseDecorator);
            }

            ts.forEachChild(childNode, traverseChild);
        };

        traverseChild(sourceFile);

        return isComponentFile;
    }

    private isModuleFile(sourceFile: ts.SourceFile): boolean {
        let isModuleFile = false;

        const traverseDecorator = (childNode: ts.Node) => {

            if (childNode.kind === ts.SyntaxKind.Identifier && childNode.getText() === 'NgModule') {
                isModuleFile = true;
                return;
            }

            ts.forEachChild(childNode, traverseDecorator);
        };

        const traverseChild = (childNode: ts.Node) => {
            if (childNode.kind == ts.SyntaxKind.Decorator) {
                ts.forEachChild(childNode, traverseDecorator);
            }

            ts.forEachChild(childNode, traverseChild);
        };

        traverseChild(sourceFile);

        return isModuleFile;
    }

    private getModuleDocs(moduleFiles: string[]): ModuleDocs[] {
        let moduleDocs: ModuleDocs[] = [];

        for (let currentFile of moduleFiles) {
            let moduleDoc: ModuleDocs = {};
            let details: any = this.getModuleSourceData(this.program.getSourceFile(currentFile));

            moduleDoc.moduleRefName = details.classRefName;
            let sourceFileAsText = this.program.getSourceFile(currentFile).getFullText();
            moduleDoc.includesComponents = this.getAllComponentDeclarationsInModule(sourceFileAsText);
            moduleDoc.fileName = (this.program.getSourceFile(currentFile) as ts.FileReference).fileName;

            if (moduleDoc.moduleRefName) {
                moduleDocs.push(moduleDoc);
            }
        }

        return moduleDocs;
    }

    private getSourceDocs(componentFiles: string[], moduleDocs: ModuleDocs[]): SourceDocs[] {
        let sourceDocs: SourceDocs[] = [];
        let otherClasses: SourceDocs[] = [];

        for (let currentFile of componentFiles) {
            let details: any = this.getComponentSourceData(this.program.getSourceFile(currentFile));

            let doc: SourceDocs = {            
                componentRefName: details.classRefName,
                componentDocName: details.componentDocName,
                groupDocName: details.groupDocName,
                description: details.description,
                apiDetails: {
                    properties: details.properties,
                    methods: details.methods
                },
                fileName: (this.program.getSourceFile(currentFile) as ts.FileReference).fileName.replace(this.config.rootDir, ''),
                moduleDetails: this.getModuleDetailsToComponent(details.classRefName, moduleDocs),
                selector: details.selector,
                extendClasses: details.extendClasses
            };

            if (doc.componentDocName) {
                sourceDocs.push(doc);
            } else {
                otherClasses.push(doc);
            }
        }

        sourceDocs = this.getPropertiesFromExtendedComponentClasses(sourceDocs, otherClasses);

        return sourceDocs;
    }

    private getPropertiesFromExtendedComponentClasses(componentsWithDocs: SourceDocs[], otherClasses: SourceDocs[]): SourceDocs[] {
        let sourceDocs = [...componentsWithDocs];

        sourceDocs.forEach((doc) => {
            doc.extendClasses.forEach((extendClass) => {
                const extendedClass = otherClasses.find((clazz) => {
                    return extendClass === clazz.componentRefName;
                });

                if(extendedClass) {
                    doc.apiDetails.properties = doc.apiDetails.properties.concat(extendedClass.apiDetails.properties);
                    doc.apiDetails.methods = doc.apiDetails.methods.concat(extendedClass.apiDetails.methods);
                }
            });
        });

        return sourceDocs;
    }

    private getModuleDetailsToComponent(componentRefName: string, moduleDocs: ModuleDocs[]): ModuleDetails {
        return moduleDocs.reduce((result: ModuleDocs[], moduleDoc: ModuleDocs) => {
            moduleDoc.includesComponents.filter((componentName) => {
                return componentName === componentRefName;
            }).forEach(res => result.push(moduleDoc));

            return result;
        }, [])
            .map(docs => {
                return {
                    moduleRefName: docs.moduleRefName,
                    fileName: docs.fileName
                };
            }).shift();
    }

    private getAllComponentDeclarationsInModule(sourceFileAsText): string[] {
        let match = sourceFileAsText.replace(/[\n\r\s]+/gi, '').match(/exports:\[([a-zA-Z-_0-9,]+)]?/);

        return match && match.length > 0 ? match[1].split(',') : [];
    }

    private getNodeComment(nodeSymbol: ts.Symbol | ts.Signature): string {
        const comment = nodeSymbol.getDocumentationComment().reduce((result, comment: { text: string, kind: string }) => {
            if (comment.kind === 'text') {
                result += comment.text;
            }

            return result;
        }, '');

        return comment;
    }

    private getModuleSourceData(node: ts.Node) {
        let details: any = {};

        const traverseChild = (childNode: ts.Node) => {
            if (childNode.kind === ts.SyntaxKind.ClassDeclaration) {
                details.classRefName = (childNode as ts.ClassDeclaration).name.text;
            }

            ts.forEachChild(childNode, traverseChild);
        };

        traverseChild(node);

        return details;
    }

    private getComponentSourceData(node: ts.Node) {
        let details: any = {
            properties: [],
            methods: [],
            selector: '',
            extendClasses: []
        };

        const traverseChild = (childNode: ts.Node) => {
            if (childNode.kind === ts.SyntaxKind.ClassDeclaration) {
                details.classRefName = (childNode as ts.ClassDeclaration).name.text;
                details.selector = this.getComponentSelector((childNode as ts.ClassDeclaration));

                const nodeSymbol = this.checker.getSymbolAtLocation((childNode as ts.ClassDeclaration).name);

                nodeSymbol.getJsDocTags().forEach((docs: { name: string, text: string }) => {
                    switch (docs.name) {
                        case 'group':
                            details.groupDocName = docs.text;
                            break;
                        case 'component':
                            details.componentDocName = docs.text;
                            break;
                        case 'description':
                            details.description = docs.text;
                            break;
                    }
                });

                nodeSymbol.members.forEach((currentMemberSymbol: ts.Symbol) => {
                    let memberDetails = this.getClassMemberDetails(currentMemberSymbol);

                    if (memberDetails) {
                        details.properties = details.properties.concat(memberDetails.properties);
                        details.methods = details.methods.concat(memberDetails.methods);
                    }
                });

            } else if(childNode.kind === ts.SyntaxKind.HeritageClause) {
                childNode.getChildren().forEach((child) => {
                    if(child.kind === ts.SyntaxKind.SyntaxList) {
                        let extendClasses = child.getText().split(',');
                        extendClasses = extendClasses.map((value) => value.trim()).filter((value) => value !== '');
                        details.extendClasses = details.extendClasses.concat(extendClasses);
                    }
                });
            }

            ts.forEachChild(childNode, traverseChild);
        };

        traverseChild(node);

        return details;
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

    private checkIfSymbolHasPrivateModifier(nodeSymbol: ts.Symbol): boolean {
        if (!nodeSymbol.valueDeclaration.modifiers) {
            // default is public, if modifiers is undefined, its public
            return false;
        }

        const hasPrivateModifier = nodeSymbol.valueDeclaration.modifiers.filter(
            (modifier: ts.Modifier) => {
                return modifier.kind === ts.SyntaxKind.PrivateKeyword;
            }).length > 0;

        return hasPrivateModifier;
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

    private getMethodParametersAsString(parameters: ts.NodeArray<ts.ParameterDeclaration>): string {
        const parametersAsString = parameters.reduce((result: string[], parameter: ts.ParameterDeclaration) => {
            result.push(parameter.getText());
            return result;
        }, []).join(',');

        return parametersAsString;
    }
}


