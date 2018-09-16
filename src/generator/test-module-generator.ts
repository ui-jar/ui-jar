import * as ts from 'typescript';
import * as path from 'path';
import * as crypto from 'crypto';
import { InlineComponent, TestDocs, InlineModule } from './test-source-parser';
import { TestModuleTemplateWriter } from './test-module-writer';

export interface TestModuleSourceFile {
    sourceFile: ts.SourceFile; 
    fileName: string;
}

export class TestModuleGenerator {
    private getTempModuleTemplate(component: TestDocs, moduleId: string) {
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
        template += this.getInlineComponentSourceCode(component.inlineComponents);
        template += this.getInlineModuleSourceCode(component.inlineModules);
        template += `${component.inlineFunctions}`;
        template += `@NgModule(${moduleSetupTemplate}) export class ${moduleName} {}`;
        template += this.getTemplateForExamplePropertiesFunction(component);
        template += this.getModuleMetadataOverrideProperties(component);

        const bootstrapComponents = component.examples.map((example) => example.bootstrapComponent);
        const uniqueBootstrapComponents = Array.from(new Set(bootstrapComponents));

        uniqueBootstrapComponents.forEach((bootstrapComponent) => {
            template += `exports.${bootstrapComponent} = ${bootstrapComponent};`;
        });

        return template;
    }

    private getInlineComponentSourceCode(inlineComponents: InlineComponent[]) {
        return inlineComponents.map((inlineComponent) => inlineComponent.source);
    }

    private getInlineModuleSourceCode(inlineModules: InlineModule[]) {
        return inlineModules.map((inlineModule) => inlineModule.source);
    }

    private getModuleSetupTemplate(component: TestDocs): string {
        let moduleSetupTemplate = Object.keys(component.moduleSetup).reduce((result, propertyName) => {
            result += propertyName + ':[' + component.moduleSetup[propertyName] + '],';
            return result;
        }, '');

        const entryComponents = component.examples.filter((example) => example.bootstrapComponent).map((example) => example.bootstrapComponent);

        moduleSetupTemplate = moduleSetupTemplate.concat(`entryComponents:[${entryComponents}]`);

        if (component.moduleSetup.declarations) {
            moduleSetupTemplate = moduleSetupTemplate.concat(`,exports:[${component.moduleSetup.declarations}]`);
        }

        moduleSetupTemplate = `{${moduleSetupTemplate}}`;

        return moduleSetupTemplate;
    }

    private getResolvedImportStatements(component: TestDocs): string {
        let importsTemplate = '';

        component.importStatements.forEach((importStatement) => {
            if (this.isImportPathRelative(importStatement)) {
                const importStatementPath = importStatement.path.replace(/[\"']/gi, '');
                const sourceFileDirectoryPath = path.resolve(component.fileName.substr(0, component.fileName.lastIndexOf('/')));
                const testFilePath = path.relative(path.resolve(TestModuleTemplateWriter.outputDirectoryPath), sourceFileDirectoryPath);
                const sourceFileAbsolutePath = path.resolve(path.resolve(TestModuleTemplateWriter.outputDirectoryPath), testFilePath, importStatementPath);
                const importPath = path.relative(path.resolve(TestModuleTemplateWriter.outputDirectoryPath), sourceFileAbsolutePath);

                const replacedImportStatement = importStatement.value.replace(importStatement.path, `'${importPath}'`)
                    .replace(/\\/gi, '/');

                importsTemplate += replacedImportStatement;
            } else {
                importsTemplate += importStatement.value;
            }
        });

        return importsTemplate;
    }

    private getTemplateForExamplePropertiesFunction(component: TestDocs): string {
        // TODO (nording) refactor this...
        let exampleProperties = '[';
        component.examples.forEach((example, index) => {

            exampleProperties += '{ properties: {';
            let componentPropertyName = '';

            example.componentProperties.forEach((prop) => {
                componentPropertyName = prop.name;
                const firstIndexOfEquals = prop.expression.indexOf('=');
                let propertyName = prop.expression.substr(0, firstIndexOfEquals);
                propertyName = '"' + propertyName.replace(/\s+/gi, '').replace(/"/gi, '\'') + '"';
                const expression = prop.expression.substr(firstIndexOfEquals + 1);
                const objectSyntax = propertyName + ':' + expression;

                exampleProperties += objectSyntax + `, `;
            });

            let exampleHttpRequests = '{';
            example.httpRequests.forEach((httpRequest) => {
                const httRequestPropertyName = httpRequest.name;
                const propertyName = '"' + httpRequest.name.replace(/\s+/gi, '').replace(/"/gi, '\'') + '"';
                exampleHttpRequests += propertyName +': { expression: "'+ httpRequest.expression.replace(/"/gi, '\'') +'", url: "'+ httpRequest.url +'" }';
                exampleHttpRequests += ', ';
            });
            exampleHttpRequests += '}';

            exampleProperties += `}, componentPropertyName: "${componentPropertyName}"`;
            exampleProperties += `, httpRequests: ${exampleHttpRequests}`;
            exampleProperties += `, sourceCode: ${JSON.stringify(example.sourceCode)}`;
            exampleProperties += `, title: "${example.title}"`;
            exampleProperties += `, bootstrapComponent: "${example.bootstrapComponent}"`;
            exampleProperties += '}' + (index < component.examples.length - 1 ? ',' : '');
        });
        exampleProperties += ']';

        exampleProperties = `export function getComponentExampleProperties () { 
            let examples = ${exampleProperties};
            let modifiedExamples = [];

            return examples.map((example) => {
                let componentProperties = example.properties;
                let result = {};
                result.componentProperties = Object.keys(componentProperties).map((propertyKey) => {
                    
                    let expressionValue = JSON.stringify(componentProperties[propertyKey]);
                    expressionValue = propertyKey +'='+ expressionValue;
                    
                    return {
                        name: example.componentPropertyName,
                        expression: expressionValue
                    }; 
                });

                result.httpRequests = Object.keys(example.httpRequests).map((propertyKey) => {
                    return {
                        name: propertyKey,
                        url: example.httpRequests[propertyKey].url,
                        expression: example.httpRequests[propertyKey].expression
                    }
                });

                result.sourceCode = example.sourceCode;
                result.title = example.title;
                result.bootstrapComponent = example.bootstrapComponent;

                return result;
            });
        }`;

        return exampleProperties;
    }

    private getModuleMetadataOverrideProperties(component: TestDocs) {
        let properties = component.moduleMetadataOverride.reduce((result, metadataOverride) => {
            result += `{
                moduleRefName: ${metadataOverride.moduleRefName},
                entryComponents: [${metadataOverride.entryComponents}]
            },`;

            return result;
        }, '');

        properties = `[${properties}]`;

        const template = `export function getModuleMetadataOverrideProperties () {
            return ${properties};
        }`;

        return template;
    }

    getTestModuleSourceFiles(testDocumentation: TestDocs[]): TestModuleSourceFile[] {
        let sourceFiles: TestModuleSourceFile[] = [];

        testDocumentation.forEach((component, index) => {
            if (component.examples.length > 0) {
                let sourceFileNameHash = crypto.createHash('md5').update(component.fileName).digest('hex');
                let sourceFile = ts.createSourceFile(TestModuleTemplateWriter.outputFilename +'-'+ sourceFileNameHash + '.ts',
                    this.getTempModuleTemplate(component, sourceFileNameHash), ts.ScriptTarget.ES5);

                sourceFiles.push({ 
                    sourceFile,
                    fileName: component.fileName
                });
            }
        });

        return sourceFiles;
    }

    private isImportPathRelative(importStatement: any) {
        return importStatement.path.charAt(1) === '.';
    }
}