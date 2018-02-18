import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import { SourceDocs, ModuleDetails } from './source-parser';

interface UniqueModulesDetails {
    moduleDetails: ModuleDetails;
    bootstrapComponent: string;
}

export class BundleTemplateWriter {
    private outputFilename: string = '__ui-jar-temp.js';
    private outputDirectoryPath: string = path.resolve(__dirname, '../../../temp'); // dist/src/app...

    constructor(private documentation: SourceDocs[],
        private urlPrefix: string) {
    }

    getJavascriptFileTemplate() {
        const template = `
            ${this.getModuleImportStatements()}
            
            export function getAppData() {
                return {
                    modules:  ${this.getModuleImportNames()},
                    componentRefs: ${this.getComponentRefs()},
                    navigationLinks: ${this.getNavigationLinks()},
                    components: ${this.getComponentData()},
                    urlPrefix: '${this.urlPrefix}',
                    examples: ${this.getComponentExampleProperties()}
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
        return source.replace(/require\("[\.\/\\]+(__ui-jar-temp-module-[a-z0-9]+)"\)/gi, 'require("\.\/$1")');
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

        uniqueModules.forEach((item: UniqueModulesDetails) => {
            moduleNames.push(item.moduleDetails.moduleRefName);
        });

        let template = `[${moduleNames}]`;

        return template;
    }

    private getModuleImportStatements() {
        let template = '';
        let moduleImports = this.getUniqueModules();

        moduleImports.forEach((item) => {
            const componentExamplePropertiesFunction = `getComponentExampleProperties as getComponentExampleProperties_${item.moduleDetails.moduleRefName}`;
            let importPath = path.relative(path.resolve(this.outputDirectoryPath), path.resolve(item.moduleDetails.fileName));
            importPath = importPath.replace('.ts', '').replace(/\\/g, '/');
            template += `import {${item.moduleDetails.moduleRefName}, ${item.bootstrapComponent}, ${componentExamplePropertiesFunction}} from '${importPath}';\n`;
        });

        return template;
    }

    private getUniqueModules(): UniqueModulesDetails[] {
        let uniqueModules: UniqueModulesDetails[] = [];

        this.documentation.forEach((item) => {
            let isModuleUnique = uniqueModules.filter((importedModule) => {
                return item.moduleDetails.moduleRefName === importedModule.moduleDetails.moduleRefName;
            }).length === 0;

            if (isModuleUnique) {
                uniqueModules.push({
                    moduleDetails: item.moduleDetails,
                    bootstrapComponent: item.bootstrapComponent
                });
            }
        });

        return uniqueModules;
    }

    private getComponentData() {
        let result = {};

        this.documentation.forEach((classDoc: SourceDocs) => {
            result[classDoc.componentRefName] = {
                title: classDoc.componentDocName,
                description: classDoc.description,
                sourceFilePath: classDoc.fileName,
                api: {
                    properties: classDoc.apiDetails.properties,
                    methods: classDoc.apiDetails.methods
                },
                moduleDependencies: [classDoc.moduleDetails.moduleRefName],
                bootstrapComponent: classDoc.bootstrapComponent
            };
        });

        return JSON.stringify(result);
    }

    private getComponentExampleProperties() {
        let expressions = {};
        this.documentation.forEach((classDoc: SourceDocs) => {
            expressions[`${classDoc.moduleDetails.moduleRefName}`] = `getComponentExampleProperties_${classDoc.moduleDetails.moduleRefName}()`;
        });

        let template = Object.keys(expressions).reduce((result, exp, index) => {
            result += (index > 0 ? ',' : '') + `${exp}: ${expressions[exp]}`;
            return result;
        }, '');

        template = `{${template}}`;

        return template;
    }

    private getComponentRefs() {
        let componentRefs = [];

        this.documentation.forEach((classDoc: SourceDocs) => {
            componentRefs.push(classDoc.bootstrapComponent);
        });

        let template = `[${componentRefs}]`;

        return template;
    }

    private getNavigationLinks() {
        let links = [];

        this.documentation.forEach((classDoc: SourceDocs) => {
            if (classDoc.groupDocName) {
                links.push({
                    group: classDoc.groupDocName,
                    title: classDoc.componentDocName,
                    path: this.urlPrefix ? this.urlPrefix + '/' + classDoc.componentRefName : classDoc.componentRefName
                });
            }
        });

        links.sort((itemA, itemB) => itemA.group.localeCompare(itemB.group));

        return JSON.stringify(links);
    }
}