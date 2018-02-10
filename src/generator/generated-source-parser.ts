import * as ts from 'typescript';
import * as fs from 'fs';
import { TestModuleTemplateWriter } from './test-module-writer';

export interface GeneratedSourceParserConfig {
    files?: string[];
    testSourceFiles?: ts.SourceFile[];
}

export interface GeneratedModuleDocs {
    moduleRefName?: string;
    fileName?: string;
    includeTestForComponent?: string;
}

export class GeneratedSourceParser {
    private program: ts.Program;
    private checker: ts.TypeChecker;

    constructor(private config: GeneratedSourceParserConfig, tsOptions: ts.CompilerOptions) {
        let files = config.files;

        this.program = ts.createProgram([...files], tsOptions, this.getCompilerHost());
        this.checker = this.program.getTypeChecker();
    }

    private getCompilerHost(): ts.CompilerHost {
        let testSourceFiles = this.config.testSourceFiles;
        let compilerHost = ts.createCompilerHost({ target: ts.ScriptTarget.ES5, module: ts.ModuleKind.CommonJS });
        compilerHost.getSourceFile = (fileName: string, languageVersion: ts.ScriptTarget,
            onError?: (message: string) => void): ts.SourceFile => {

            if (fileName.indexOf(TestModuleTemplateWriter.outputFilename) > -1) {
                let sourceFile = testSourceFiles.filter((file) => {
                    return file.fileName === fileName;
                }).pop();

                return sourceFile;
            }

            return ts.createSourceFile(fileName, fs.readFileSync(fileName, 'UTF-8'), ts.ScriptTarget.ES5);
        };

        return compilerHost;
    }

    getGeneratedDocumentation(): GeneratedModuleDocs[] {
        const moduleDocs: GeneratedModuleDocs[] = this.getModuleDocs(this.config.files);

        return moduleDocs;
    }

    private getModuleDocs(moduleFiles: string[]): GeneratedModuleDocs[] {
        let moduleDocs: GeneratedModuleDocs[] = [];

        for (let currentFile of moduleFiles) {
            let sourceFileAsText = this.program.getSourceFile(currentFile).getFullText();
            let moduleDoc: GeneratedModuleDocs = this.getSourceFileData(this.program.getSourceFile(currentFile));
            moduleDoc.includeTestForComponent = this.getIncludedTestForComponent(sourceFileAsText);
            moduleDoc.fileName = (this.program.getSourceFile(currentFile) as ts.FileReference).fileName;

            if (moduleDoc.includeTestForComponent) {
                moduleDocs.push(moduleDoc);
            }
        }

        return moduleDocs;
    }

    private getIncludedTestForComponent(sourceFileAsText): string {
        let match = sourceFileAsText.replace(/[\n\r\s]+/gi, '').match(/\/\*\*::ui-jar_source_module::([a-zA-Z0-9_-\s]+)\*\//);

        return match && match.length > 0 ? match[1] : null;
    }

    private getSourceFileData(node: ts.Node): GeneratedModuleDocs {
        let details: GeneratedModuleDocs = {};

        const traverseChild = (childNode: ts.Node) => {
            if (childNode.kind === ts.SyntaxKind.ClassDeclaration) {
                const traverseDecorator = (decoratorChildNode: ts.Node) => {
                    if (decoratorChildNode.kind === ts.SyntaxKind.Identifier && decoratorChildNode.getText() === 'NgModule') {
                        details.moduleRefName = (childNode as ts.ClassDeclaration).name.text;
                    }

                    ts.forEachChild(decoratorChildNode, traverseDecorator);
                };

                const currentNode = (childNode as ts.ClassDeclaration);

                if (currentNode.decorators) {
                    currentNode.decorators.forEach((decorator: ts.Decorator) => {
                        traverseDecorator(decorator);
                    });
                }
            }

            ts.forEachChild(childNode, traverseChild);
        };

        traverseChild(node);

        return details;
    }

}


