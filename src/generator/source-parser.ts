import * as ts from 'typescript';

export interface ComponentDocs {
    componentRefName?: string;
    componentDocName?: string;
    groupDocName?: string;
    examples?: { componentProperties: any[] }[];
    description?: string;
    fileName?: string;
    moduleDetails?: ModuleDetails;
    apiDetails?: ApiDetails;
}

export interface ApiDetails {
    properties: any[];
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

export class SourceParser {
    private program: ts.Program;
    private checker: ts.TypeChecker;

    constructor(private config: any, tsOptions: ts.CompilerOptions) {
        let files = config.files;

        this.program = ts.createProgram([...files], tsOptions);
        this.checker = this.program.getTypeChecker();
    }

    getProjectDocumentation(): ComponentDocs[] {
        const {
            componentFiles,
            moduleFiles
        } = this.getComponentAndModuleFiles(this.config.files);

        const moduleDocs: ModuleDocs[] = this.getModuleDocs(moduleFiles);
        const componentDocs: ModuleDocs[] = this.getComponentDocs(componentFiles, moduleDocs);

        return componentDocs;
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
        }

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
        }

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

    private getComponentDocs(componentFiles: string[], moduleDocs: ModuleDocs[]): ComponentDocs[] {
        let componentDocs: ComponentDocs[] = [];

        for (let currentFile of componentFiles) {
            let doc: ComponentDocs = {};
            let details: any = this.getComponentSourceData(this.program.getSourceFile(currentFile));

            doc.componentRefName = details.classRefName;
            doc.componentDocName = details.componentDocName;
            doc.groupDocName = details.groupDocName;
            doc.description = details.description;
            doc.apiDetails = {
                properties: details.properties,
                methods: details.methods
            };
            doc.fileName = (this.program.getSourceFile(currentFile) as ts.FileReference).fileName;
            doc.moduleDetails = this.getModuleDetailsToComponent(doc.componentRefName, moduleDocs);

            if (doc.componentDocName) {
                componentDocs.push(doc);
            }
        }

        return componentDocs;
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
            examples: [],
            properties: [],
            methods: []
        };

        const traverseChild = (childNode: ts.Node) => {
            if (childNode.kind === ts.SyntaxKind.ClassDeclaration) {
                details.classRefName = (childNode as ts.ClassDeclaration).name.text;
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

                nodeSymbol.members.forEach((currentMemberSymbol: ts.Symbol, key: string) => {
                    let memberDetails = this.getClassMemberDetails(currentMemberSymbol, key);

                    if (memberDetails) {
                        details.properties = details.properties.concat(memberDetails.properties);
                        details.methods = details.methods.concat(memberDetails.methods);
                    }
                });

            }

            ts.forEachChild(childNode, traverseChild);
        };

        traverseChild(node);

        return details;
    }

    private checkIfSymbolHasPrivateModifier(nodeSymbol: ts.Symbol): boolean {
        if (!nodeSymbol.valueDeclaration.modifiers) {
            // default is public, if modifiers is undefined, its public
            return false;
        }

        const hasPrivateModifier = nodeSymbol.valueDeclaration.modifiers.filter(
            (modifier: ts.Modifier) => {
                return modifier.kind === ts.SyntaxKind.PrivateKeyword
            }).length > 0;

        return hasPrivateModifier;
    }

    private getClassMemberDetails(currentMemberSymbol: ts.Symbol, key: string) {
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
                details.methods = details.methods.concat(this.getAccessorDeclarationToDetails(currentMemberSymbol));
            }
        }

        return details;
    }

    private getPropertyToDetails(symbol: ts.Symbol) {
        let properties = [];
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
        let methods = [];

        symbol.getDeclarations().forEach((declaration: ts.AccessorDeclaration) => {
            const signature = this.checker.getSignatureFromDeclaration(declaration);
            const nodeComment = this.getNodeComment(signature);
            const parametersAsString = this.getMethodParametersAsString(declaration.parameters);
            const decorators = declaration.decorators;
            let decoratorNames: string[] = [];

            const kindToString = (kind: ts.SyntaxKind) => {
                const kindMap = {
                    153: 'get',
                    154: 'set'
                }

                return kindMap[kind];
            };

            if (decorators) {
                decorators.forEach((decorator: ts.Decorator) => {
                    decoratorNames.push(decorator.getText());
                });
            }

            methods.push({
                decoratorNames,
                methodName: `${kindToString(declaration.kind)} ${declaration.name.getText()}(${parametersAsString})`,
                description: nodeComment
            });
        });

        return methods;
    }

    private getMethodParametersAsString(parameters: ts.ParameterDeclaration[]): string {
        const parametersAsString = parameters.reduce((result: string[], parameter: ts.ParameterDeclaration) => {
            result.push(parameter.getText());
            return result;
        }, []).join(',');

        return parametersAsString;
    }
}


