import * as ts from 'typescript';
import { ModuleParser, ModuleDocs } from './module-parser';
import { ComponentParser, ProjectSourceDocs } from './component-parser';

export class SourceParser {
    private moduleParser: ModuleParser;
    private componentParser: ComponentParser;

    constructor(private config: { rootDir: string, files: string[] }, private program: ts.Program) {
        this.moduleParser = new ModuleParser(program);
        this.componentParser = new ComponentParser(config, program);
    }

    getProjectSourceDocumentation(): ProjectSourceDocs {
        const {
            componentFiles,
            moduleFiles
        } = this.getComponentAndModuleFiles(this.config.files);

        const moduleDocs: ModuleDocs[] = this.moduleParser.getModuleDocs(moduleFiles);
        const sourceDocs: ProjectSourceDocs = this.componentParser.getComponentDocs(componentFiles, moduleDocs);

        return {
            classesWithDocs: sourceDocs.classesWithDocs,
            otherClasses: sourceDocs.otherClasses
        };
    }

    private getComponentAndModuleFiles(files: string[]) {
        let componentFiles = [];
        let moduleFiles = [];

        for (let currentFile of files) {
            if (this.isContainingClass(this.program.getSourceFile(currentFile))) {
                componentFiles.push(currentFile);
            }

            if (this.isModuleFile(this.program.getSourceFile(currentFile))) {
                moduleFiles.push(currentFile);
            }
        }

        return { componentFiles, moduleFiles };
    }

    private isContainingClass(node: ts.Node): boolean {
        const traverseChild = (childNode: ts.Node) => {
            if(childNode.kind === ts.SyntaxKind.ClassDeclaration) {
                return true;
            }

            return ts.forEachChild(childNode, traverseChild);
        };

        return traverseChild(node) === true;
    }

    private isModuleFile(node: ts.SourceFile): boolean {
        const traverseDecorator = (childNode: ts.Node) => {
            if (childNode.kind === ts.SyntaxKind.Identifier && childNode.getText() === 'NgModule') {
                return true;
            }

            return ts.forEachChild(childNode, traverseDecorator);
        };

        const traverseChild = (childNode: ts.Node) => {
            if (childNode.kind == ts.SyntaxKind.Decorator) {
                return ts.forEachChild(childNode, traverseDecorator);
            }

            return ts.forEachChild(childNode, traverseChild);
        };

        return traverseChild(node) === true;
    }
}
