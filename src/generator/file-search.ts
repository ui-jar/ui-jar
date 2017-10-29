import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

export class FileSearch {
    constructor(private includes = [], private excludes = []) { }

    getFiles(directory: string) {
        let results = [];

        let files = fs.readdirSync(directory);

        files.forEach((file) => {
            const filePath = directory + '/' + file;

            let shouldBeExcluded = this.excludes.find((excludeItem) => {
                return new RegExp(excludeItem).test(file);
            });

            if (shouldBeExcluded) {
                return;
            }

            if (fs.statSync(filePath).isDirectory()) {
                results = results.concat(this.getFiles(filePath));
            } else if (fs.statSync(filePath).isFile()) {
                let shouldBeIncluded = this.includes.find((includeItem) => {
                    return new RegExp(includeItem).test(file);
                });

                if (shouldBeIncluded) {
                    results.push(path.resolve(filePath));
                }
            }
        });

        return results;
    }

    getTestFiles(files: string[], program: ts.Program): string[] {
        let result = [];

        for(let currentFile of files) {
            const isTestFile: boolean = this.getTestSourceDetails(program, currentFile);

            if(isTestFile) {
                result.push(currentFile);
            }
        }

        return result;
    }

    private getTestSourceDetails(program: ts.Program, currentFile: string): boolean {
        let isTestFile = false;
        let checker: ts.TypeChecker = program.getTypeChecker();

        let traverseChild = (childNode: ts.Node) => {
            if (childNode.kind === ts.SyntaxKind.VariableDeclaration) {
                const nodeSymbol = checker.getSymbolAtLocation((childNode as ts.VariableDeclaration).name);

                if (nodeSymbol) {
                    nodeSymbol.getJsDocTags().forEach((docs: { name: string, text: string }) => {
                        if (docs.name === 'uijar') {
                            isTestFile = true;
                        }
                    });
                }
            }

            ts.forEachChild(childNode, traverseChild);
        };

        traverseChild(program.getSourceFile(currentFile));

        return isTestFile;
    }
}