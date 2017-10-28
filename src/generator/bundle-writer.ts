import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import { ComponentDocs, ModuleDetails } from './source-parser';

export class BundleTemplateWriter {
    private outputFilename: string = '__ui-jar-temp.js';
    private outputDirectoryPath: string = path.resolve(__dirname, '../../../temp'); // dist/src/app...

    constructor(private documentation: ComponentDocs[],
        private urlPrefix: string) {
    }

    getJavascriptFileTemplate() {
        let moduleImportStatements = this.getModuleImportStatements();
        let moduleImportNames = this.getModuleImportNames();
        let navigationLinks = this.getNavigationLinks();
        let visibleComponents = this.getVisibleComponents();
        let componentData = this.getComponentData();
        let examples = this.getComponentExampleProperties();

        let template = `
            ${moduleImportStatements}
            
            export function getAppData() {
                return {
                    modules:  ${moduleImportNames},
                    visibleComponents: ${visibleComponents},
                    navigationLinks: ${navigationLinks},
                    components: ${componentData},
                    urlPrefix: '${this.urlPrefix}',
                    examples: ${examples}
                };
            }
        `;

        return template;
    }

    createBundleFile() {
        const encoding = 'UTF-8';

        let javascriptOutput = ts.transpileModule(this.getJavascriptFileTemplate(), {
            compilerOptions: {
                module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES5,
                removeComments: true
            }
        });

        javascriptOutput.outputText = this.updateImportPathsToMatchGeneratedTestModules(javascriptOutput.outputText);

        try {
            this.createOutputPathIfNotAlreadyExist(this.outputDirectoryPath);
            const outputFilePath = path.resolve(this.outputDirectoryPath, this.outputFilename);
            fs.writeFileSync(outputFilePath, javascriptOutput.outputText, encoding);
        } catch (error) {
            throw new Error(error);
        }
    }

    private updateImportPathsToMatchGeneratedTestModules(source: string): string {
        // fix path ./
        return source.replace(/require\("[\.\/\\]+(__ui-jar-temp-module[0-9]+)"\)/gi, 'require("\.\/$1")');
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

    private getModuleImportNames() {
        let uniqueModules = this.getUniqueModules();
        let moduleNames = [];

        uniqueModules.forEach((moduleDetails: ModuleDetails) => {
            moduleNames.push(moduleDetails.moduleRefName);
        });

        let template = `[${moduleNames}]`;

        return template;
    }

    private getModuleImportStatements() {
        let template = '';
        let moduleImports = this.getUniqueModules();

        moduleImports.forEach((item) => {
            let importPath = path.relative(path.resolve(this.outputDirectoryPath), path.resolve(item.fileName));
            importPath = importPath.replace('.ts', '').replace(/\\/g, '/');
            template += `import {${item.moduleRefName}} from '${importPath}';\n`;
            template += `import {getComponentExampleProperties as getComponentExampleProperties_${item.moduleRefName}} from '${importPath}';\n`;
        });

        return template;
    }

    private getUniqueModules(): ModuleDetails[] {
        let uniqueModules = [];

        this.documentation.forEach((item) => {
            let isModuleUnique = uniqueModules.filter((importedModule) => {
                return item.moduleDetails.moduleRefName === importedModule.moduleRefName; // TODO byta till filename istället?
            }).length === 0;

            if (isModuleUnique) {
                uniqueModules.push(item.moduleDetails);
            }
        });

        return uniqueModules;
    }

    private getComponentData() {
        let result = {};

        this.documentation.forEach((componentDocs: ComponentDocs) => {
            result[componentDocs.componentRefName] = {
                title: componentDocs.componentDocName,
                description: componentDocs.description,
                sourceFilePath: componentDocs.fileName,
                api: {
                    properties: componentDocs.apiDetails.properties,
                    methods: componentDocs.apiDetails.methods
                },
                moduleDependencies: [componentDocs.moduleDetails.moduleRefName],
                exampleTemplate: componentDocs.exampleTemplate
            };
        });

        return JSON.stringify(result);
    }

    private getComponentExampleProperties() {
        let expressions = {};
        this.documentation.forEach((componentDocs: ComponentDocs) => {
            expressions[`${componentDocs.moduleDetails.moduleRefName}`] = `getComponentExampleProperties_${componentDocs.moduleDetails.moduleRefName}()`;
        });

        let template = Object.keys(expressions).reduce((result, exp, index) => {
            result += (index > 0 ? ',' : '') + `${exp}: ${expressions[exp]}`;
            return result;
        }, '');

        template = `{${template}}`;

        return template;
    }

    private getNavigationLinks() {
        let links = [];

        this.documentation.forEach((componentDocs: ComponentDocs) => {
            if (componentDocs.groupDocName) {
                links.push({
                    group: componentDocs.groupDocName,
                    title: componentDocs.componentDocName,
                    path: this.urlPrefix ? this.urlPrefix + '/' + componentDocs.componentRefName : componentDocs.componentRefName
                });
            }
        });

        links.sort((itemA, itemB) => itemA.group.localeCompare(itemB.group));

        return JSON.stringify(links);
    }

    private getVisibleComponents() {
        let components = this.documentation.map((componentDocs: ComponentDocs) => {
            return componentDocs.componentRefName;
        });

        return JSON.stringify(components);
    }
}