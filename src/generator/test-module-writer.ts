import * as fs from 'fs';
import * as ts from 'typescript';
import * as path from 'path';
import { ComponentDocs } from './source-parser';

export class TestModuleTemplateWriter {
    static outputFilename: string = '__ui-jar-temp-module';
    private outputDirectoryPath: string = path.resolve(__dirname, '../../../temp'); // dist/src/app...

    constructor(private testDocumentation: any[]) { }

    private getTempModuleTemplate(component: any, moduleId: number) {
        const moduleName = `TempModule${moduleId}`;
        let defaultImports = `import { NgModule, Component } from "@angular/core";`;

        component.moduleSetup.imports = component.moduleSetup.imports || [];

        if (!component.moduleSetup.imports.includes('CommonModule')) {
            defaultImports += `import { CommonModule } from "@angular/common";`;
            component.moduleSetup.imports.push('CommonModule');
        }

        let moduleSetupTemplate = this.getModuleSetupTemplate(component);
        let template = `/**::ui-jar_source_module::${component.includeTestForComponent}*/${defaultImports}`;

        template += this.getResolvedImportStatements(component);
        template += `${component.inlineComponents}`;
        template += `${component.inlineFunctions}`;
        template += `@NgModule(${moduleSetupTemplate}) export class ${moduleName} {}`;
        template += this.getTemplateForExamplePropertiesFunction(component); //exampleProperties;

        return template;
    }

    private getModuleSetupTemplate(component: any): string {
        let moduleSetupTemplate = Object.keys(component.moduleSetup).reduce((result, propertyName) => {
            result += propertyName + ':[' + component.moduleSetup[propertyName] + '],';
            return result;
        }, '');

        moduleSetupTemplate = moduleSetupTemplate.concat(`entryComponents:[${component.bootstrapComponent}]`);

        if (component.moduleSetup.declarations) {
            moduleSetupTemplate = moduleSetupTemplate.concat(`,exports:[${component.moduleSetup.declarations}]`);
        }

        moduleSetupTemplate = `{${moduleSetupTemplate}}`;

        return moduleSetupTemplate;
    }

    private getResolvedImportStatements(component: any): string {
        let importsTemplate = '';

        component.importStatements.forEach((importStatement) => {
            if (this.isImportPathRelative(importStatement)) {
                const importStatementPath = importStatement.path.replace(/[\"']/gi, '');
                const sourceFileDirectoryPath = path.resolve(component.fileName.substr(0, component.fileName.lastIndexOf('/')));
                const testFilePath = path.relative(path.resolve(this.outputDirectoryPath), sourceFileDirectoryPath);
                const sourceFileAbsolutePath = path.resolve(path.resolve(this.outputDirectoryPath), testFilePath, importStatementPath);
                const importPath = path.relative(path.resolve(this.outputDirectoryPath), sourceFileAbsolutePath);

                const replacedImportStatement = importStatement.value.replace(importStatement.path, `'${importPath}'`)
                    .replace(/\\/gi, '/');

                importsTemplate += replacedImportStatement;
            } else {
                importsTemplate += importStatement.value;
            }
        });

        return importsTemplate;
    }

    private getTemplateForExamplePropertiesFunction(component: any): string {
        // TODO (nording) refactor this...
        let exampleProperties = '[';
        component.examples.forEach((example, index) => {

            exampleProperties += '{ properties: {';
            let componentPropertyName = '';

            example.componentProperties.forEach((prop) => {
                componentPropertyName = prop.name;
                const firstIndexOfEquals = prop.expression.indexOf('=');
                let propertyName = prop.expression.substr(0, firstIndexOfEquals);
                propertyName = '"' + propertyName.replace(/\s+/, '') + '"';
                const expression = prop.expression.substr(firstIndexOfEquals + 1);
                const objectSyntax = propertyName + ':' + expression;

                exampleProperties += objectSyntax + `, `;
            });

            exampleProperties += `}, componentPropertyName: "${componentPropertyName}"`;
            exampleProperties += '}' + (index < component.examples.length - 1 ? ',' : '');
        });
        exampleProperties += ']';

        exampleProperties = `export function getComponentExampleProperties () { 
            let examples = ${exampleProperties};
            let modifiedExamples = [];

            return examples.map((example) => {
                let componentProperties = example.properties;
                return Object.keys(componentProperties).map((propertyKey) => {
                    
                    let expressionValue = JSON.stringify(componentProperties[propertyKey]);
                    expressionValue = propertyKey +'='+ expressionValue;
                    
                    return {
                        name: example.componentPropertyName,
                        expression: expressionValue
                    }; 
                });
            });
        }`;

        return exampleProperties;
    }

    getTestModuleSourceFiles(): ts.SourceFile[] {
        let sourceFiles: ts.SourceFile[] = [];

        this.testDocumentation.forEach((component, index) => {
            if (component.bootstrapComponent) {
                let sourceFile = ts.createSourceFile(TestModuleTemplateWriter.outputFilename + index + '.ts',
                    this.getTempModuleTemplate(component, index), ts.ScriptTarget.ES5);

                sourceFiles.push(sourceFile);
            }
        });

        return sourceFiles;
    }

    createTestModuleFiles(sourceFiles: ts.SourceFile[]) {
        const encoding = 'UTF-8';

        this.createOutputPathIfNotAlreadyExist(this.outputDirectoryPath);

        sourceFiles.forEach((sourceFile, index) => {
            let javascriptOutput = ts.transpileModule(sourceFile.getFullText(), {
                compilerOptions: {
                    module: ts.ModuleKind.CommonJS,
                    target: ts.ScriptTarget.ES5,
                    removeComments: true
                }
            });

            const outputFilePath = path.resolve(this.outputDirectoryPath, TestModuleTemplateWriter.outputFilename + index + '.js');

            try {
                fs.writeFileSync(outputFilePath, javascriptOutput.outputText, encoding);
            } catch (error) {
                console.error(error);
            }
        });
    }

    private createOutputPathIfNotAlreadyExist(path) {
        path.split('//').reduce((parent, current) => {
            let nextDirectory = parent ? parent + '/' + current : current;

            if (!fs.existsSync(nextDirectory)) {
                fs.mkdirSync(nextDirectory);
            }

            return nextDirectory;
        }, '');
    }

    private isImportPathRelative(importStatement: any) {
        return importStatement.path.charAt(1) === '.';
    }
}