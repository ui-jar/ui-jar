import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import { ModuleDetails, SourceDocs } from './component-parser';

interface UniqueModulesDetails {
    generatedModuleDetails: ModuleDetails;
    bootstrapComponents: string[];
}

export class BundleTemplateWriter {
    private outputFilename: string = '__ui-jar-temp.js';
    private outputDirectoryPath: string = path.resolve(__dirname, '../../../temp'); // dist/src/app...

    constructor(private documentation: SourceDocs[],
        private urlPrefix: string) {
    }

    private getJavascriptFileTemplate() {
        const template = `
            ${this.getModuleImportStatements()}
            
            export function getAppData() {
                return {
                    modules:  ${this.getModuleImportNames()},
                    componentRefs: ${this.getComponentRefs()},
                    navigationLinks: ${this.getNavigationLinks()},
                    components: ${this.getComponentData()},
                    urlPrefix: '${this.urlPrefix}',
                    examples: ${this.getComponentExampleProperties()},
                    moduleMetadataOverrides: ${this.getModuleMetadataOverrideProperties()}
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
            moduleNames.push(item.generatedModuleDetails.moduleRefName);
        });

        let template = '';
        moduleNames.forEach((moduleName, index) => {
            template += `${index > 0 ? ',': ''}{ name: "${moduleName}", moduleRef: ${moduleName}}`;
        });

        template = `[${template}]`;

        return template;
    }

    private getModuleImportStatements() {
        let template = '';
        let moduleImports = this.getUniqueModules();

        moduleImports.forEach((item) => {
            const componentExamplePropertiesFunction = `getComponentExampleProperties as getComponentExampleProperties_${item.generatedModuleDetails.moduleRefName}`;
            const moduleMetadataOverridePropertiesFunction = `getModuleMetadataOverrideProperties as getModuleMetadataOverrideProperties_${item.generatedModuleDetails.moduleRefName}`;
            let importPath = path.relative(path.resolve(this.outputDirectoryPath), path.resolve(item.generatedModuleDetails.fileName));
            importPath = importPath.replace('.ts', '').replace(/\\/g, '/');
            template += `import {${item.generatedModuleDetails.moduleRefName}, ${item.bootstrapComponents}, ${componentExamplePropertiesFunction}, ${moduleMetadataOverridePropertiesFunction}} from '${importPath}';\n`;
        });

        return template;
    }

    private getUniqueModules(): UniqueModulesDetails[] {
        let uniqueModules: UniqueModulesDetails[] = [];

        this.documentation.forEach((item) => {
            const isModuleUnique = uniqueModules.filter((importedModule) => {
                return item.generatedModuleDetails.moduleRefName === importedModule.generatedModuleDetails.moduleRefName;
            }).length === 0;

            const bootstrapComponentsInExample = item.examples.filter((example) => example.bootstrapComponent)
                                                .map((example) => example.bootstrapComponent);

            if (isModuleUnique) {
                uniqueModules.push({
                    generatedModuleDetails: item.generatedModuleDetails,
                    bootstrapComponents: bootstrapComponentsInExample
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
                moduleDetails: classDoc.moduleDetails,
                api: {
                    properties: classDoc.apiDetails.properties,
                    methods: classDoc.apiDetails.methods
                },
                moduleDependencies: [classDoc.generatedModuleDetails.moduleRefName]
            };
        });

        return JSON.stringify(result);
    }

    private getComponentExampleProperties() {
        let expressions = {};
        this.documentation.forEach((classDoc: SourceDocs) => {
            expressions[`${classDoc.generatedModuleDetails.moduleRefName}`] = `getComponentExampleProperties_${classDoc.generatedModuleDetails.moduleRefName}()`;
        });

        let template = Object.keys(expressions).reduce((result, exp, index) => {
            result += (index > 0 ? ',' : '') + `${exp}: ${expressions[exp]}`;
            return result;
        }, '');

        template = `{${template}}`;

        return template;
    }

    private getModuleMetadataOverrideProperties() {
        let expressions = {};
        this.documentation.forEach((classDoc: SourceDocs) => {
            expressions[`${classDoc.generatedModuleDetails.moduleRefName}`] = `getModuleMetadataOverrideProperties_${classDoc.generatedModuleDetails.moduleRefName}()`;
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
            classDoc.examples.forEach((example) => {
                if(example.bootstrapComponent) {
                    componentRefs.push(example.bootstrapComponent);
                }
            });
        });

        let template = '';
        componentRefs.forEach((componentName, index) => {
            template += `${index > 0 ? ',': ''}{ name: "${componentName}", componentRef: ${componentName}}`;
        });

        template = `[${template}]`;

        return template;
    }

    private getNavigationLinks() {
        let links = [];

        this.documentation.forEach((classDoc: SourceDocs) => {
            if (classDoc.groupDocName) {
                let linkGroup = links.find((section) => section.groupName === classDoc.groupDocName);

                if (!linkGroup) {
                    links.push({
                        groupName: classDoc.groupDocName,
                        links: []
                    });

                    linkGroup = links[links.length - 1];
                }

                linkGroup.links.push({
                    title: classDoc.componentDocName,
                    path: this.urlPrefix ? this.urlPrefix + '/' + classDoc.componentRefName : classDoc.componentRefName
                });
            }
        });

        links.forEach((linkGroup) => {
            linkGroup.links.sort((itemA, itemB) => itemA.title.localeCompare(itemB.title));
        });

        links.sort((itemA, itemB) => itemA.groupName.localeCompare(itemB.groupName));

        return JSON.stringify(links);
    }
}