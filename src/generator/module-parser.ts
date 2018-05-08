import * as ts from 'typescript';

export interface ModuleDocs {
    moduleRefName?: string;
    fileName?: string;
    includesComponents?: string[];
}

export class ModuleParser {
    constructor(private program: ts.Program) {}

    getModuleDocs(moduleFiles: string[]): ModuleDocs[] {
        let moduleDocs: ModuleDocs[] = [];

        moduleFiles.forEach((currentFile) => {
            let moduleDoc: ModuleDocs = {};
            let details: any = this.getModuleSourceData(this.program.getSourceFile(currentFile));

            moduleDoc.moduleRefName = details.classRefName;
            let sourceFileAsText = this.program.getSourceFile(currentFile).getFullText();
            moduleDoc.includesComponents = this.getAllComponentDeclarationsInModule(sourceFileAsText);
            moduleDoc.fileName = (this.program.getSourceFile(currentFile) as ts.FileReference).fileName;

            if (moduleDoc.moduleRefName) {
                moduleDocs.push(moduleDoc);
            }
        });

        return moduleDocs;
    }

    private getAllComponentDeclarationsInModule(sourceFileAsText): string[] {
        const match = sourceFileAsText.replace(/[\n\r\s\t]+/gi, '').match(/exports:\[([a-zA-Z\-_0-9,]+)\]/);
        return match && match.length > 0 ? match[1].split(',') : [];
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
}