import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

export class FileSearch {
    constructor(private includes = [], private excludes = []) { }

    getFiles(directory: string): string[] {
        let results = [];

        let files = fs.readdirSync(directory);

        files.forEach((file) => {
            const filePath = directory + '/' + file;

            let shouldBeExcluded = this.excludes.find((excludeItem) => {
                return new RegExp(excludeItem).test(filePath);
            });

            if (shouldBeExcluded) {
                return;
            }

            if (fs.statSync(filePath).isDirectory()) {
                results = results.concat(this.getFiles(filePath));
            } else if (fs.statSync(filePath).isFile()) {
                let shouldBeIncluded = this.includes.find((includeItem) => {
                    return new RegExp(includeItem).test(filePath);
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
        const checker: ts.TypeChecker = program.getTypeChecker();
        const traverseChild = (childNode: ts.Node) => {
            if (childNode.kind === ts.SyntaxKind.VariableDeclaration) {
                const nodeSymbol = checker.getSymbolAtLocation((childNode as ts.VariableDeclaration).name);

                if (nodeSymbol) {
                    const isTestFile = nodeSymbol.getJsDocTags().find((docs: { name: string, text: string }) => {
                        return docs.name === 'uijar';
                    });

                    if(isTestFile) {
                        return true;
                    }
                }
            } else if(childNode.kind === ts.SyntaxKind.CallExpression) {
                const isTestFile = this.containsUIJarAnnotation(childNode);

                if(isTestFile) {
                    return true;
                }
            }

            return ts.forEachChild(childNode, traverseChild);
        };

        return traverseChild(program.getSourceFile(currentFile)) === true;
    }

    private containsUIJarAnnotation(node: ts.Node) {
        const jsDoc = node.getFullText().replace(node.getText(), '');
        const regexp = /@uijar\s(.+)/i;
        const matches = jsDoc.match(regexp);

        if(matches) {
            return true;
        }

        return false;
    }
}