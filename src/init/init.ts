import * as ts from 'typescript';
import * as path from 'path';
import { SourceParser } from '../generator/source-parser';
import { BundleTemplateWriter } from '../generator/bundle-writer';
import { FileSearch } from '../generator/file-search';
import { TestModuleTemplateWriter } from '../generator/test-module-writer';
import { GeneratedSourceParser } from '../generator/generated-source-parser';
import { TestSourceParser } from '../generator/test-source-parser';

export interface GenerateOptionArgs {
    directory: string;
    includeFiles: RegExp[];
    excludeFiles?: RegExp[];
    testFiles?: RegExp[];
    urlPrefix?: string;
}

export function generateRequiredFiles(options: GenerateOptionArgs) {
    console.log('Generating resources...');

    const fileSearch = new FileSearch(options.includeFiles, options.excludeFiles);
    const sourceFiles = fileSearch.getFiles(options.directory);
    let docs = getDocs(sourceFiles);
    let testDocs = getTestDocs(sourceFiles, docs);

    let testModuleTemplateWriter = new TestModuleTemplateWriter(testDocs);
    let generatedTestModuleSourceFiles = testModuleTemplateWriter.getTestModuleSourceFiles();

    testModuleTemplateWriter.createTestModuleFiles(generatedTestModuleSourceFiles);

    let generatedSourceFileNames = generatedTestModuleSourceFiles.map((sourceFile) => {
        return sourceFile.fileName;
    });

    let generatedDocs = getGeneratedDocs(generatedSourceFileNames, generatedTestModuleSourceFiles);

    docs.forEach((componentDoc) => {
        generatedDocs.forEach((moduleDocs) => {
            if (moduleDocs.includeTestForComponent === componentDoc.componentRefName) {
                componentDoc.moduleDetails = {
                    moduleRefName: moduleDocs.moduleRefName,
                    fileName: moduleDocs.fileName
                };
            }
        });

        testDocs.forEach((testDoc) => {
            if (testDoc.includeTestForComponent === componentDoc.componentRefName) {
                componentDoc.examples = testDoc.examples;
            }
        });
    });

    let fileWriter = new BundleTemplateWriter(docs, options.urlPrefix);

    try {
        fileWriter.createBundleFile();
    } catch (error) {
        console.log('Failed to generate resources:', error);
        return;
    }

    console.log('Generated resources successfully.');
}

function getDocs(sourceFiles) {
    const sourceParser = new SourceParser({ files: sourceFiles },
        { target: ts.ScriptTarget.ES5, module: ts.ModuleKind.CommonJS });

    return sourceParser.getProjectDocumentation();
}

function getTestDocs(sourceFiles, docs) {
    const testSourceParser = new TestSourceParser({ files: sourceFiles },
        { target: ts.ScriptTarget.ES5, module: ts.ModuleKind.CommonJS });

    return testSourceParser.getProjectTestDocumentation(docs);
}

function getGeneratedDocs(generatedSourceFileNames, generatedTestModuleSourceFiles) {
    let generatedDocumentation = new GeneratedSourceParser(
        {
            files: generatedSourceFileNames,
            testSourceFiles: generatedTestModuleSourceFiles
        },
        {
            target: ts.ScriptTarget.ES5,
            module: ts.ModuleKind.CommonJS
        }
    );

    return generatedDocumentation.getGeneratedDocumentation();
}