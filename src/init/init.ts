import * as ts from 'typescript';
import * as path from 'path';
import { SourceParser } from '../generator/source-parser';
import { SourceDocs } from '../generator/component-parser';
import { BundleTemplateWriter } from '../generator/bundle-writer';
import { FileSearch } from '../generator/file-search';
import { TestModuleTemplateWriter } from '../generator/test-module-writer';
import { TestModuleGenerator, TestModuleSourceFile } from '../generator/test-module-generator';
import { GeneratedSourceParser } from '../generator/generated-source-parser';
import { TestSourceParser, TestDocs } from '../generator/test-source-parser';
import { CliArgs } from '../cli/cli-utils';

interface ProjectDocumentation {
    docs: SourceDocs[];
    testDocs: TestDocs[];
}

function getProjectDocumentation(options: CliArgs): ProjectDocumentation {
    const fileSearch = new FileSearch(options.includes, options.excludes);
    const sourceFiles = fileSearch.getFiles(options.directory);
    const rootDir = path.resolve(options.directory).replace(/\\/gi, '/');
    const docs = getProjectSourceDocumentation(sourceFiles, rootDir);
    const testDocs = getProjectTestDocumentation(sourceFiles, docs.classesWithDocs, docs.otherClasses);

    return {
        docs: docs.classesWithDocs,
        testDocs
    };
}

function getTestModuleSourceFilesData(testDocs: TestDocs[]): TestModuleSourceFile[] {
    return new TestModuleGenerator().getTestModuleSourceFiles(testDocs);
}

export function generateSingleFile(options: CliArgs, fileName: string) {
    try {
        const generatedTestModuleSourceFilesData = getTestModuleSourceFilesData(getProjectDocumentation(options).testDocs);
        const updateCurrentSourceFile = generatedTestModuleSourceFilesData.filter((file) => {
            return new RegExp((fileName.replace(/\\/gi, '/').replace(/\./gi, '\\.') +'$')).test(file.fileName);
        });

        const generatedTestModuleSourceFiles: ts.SourceFile[] = updateCurrentSourceFile.map((file) => {
            return file.sourceFile;
        });

        createTestModuleFiles(generatedTestModuleSourceFiles);
    } catch (error) {
        console.error(`Failed to generate resources to "${fileName}".`);
    }
}

export function generateRequiredFiles(options: CliArgs) {
    console.info('Generating resources...');

    let { docs, testDocs } = getProjectDocumentation(options);
    const generatedTestModuleSourceFiles: ts.SourceFile[] = getTestModuleSourceFilesData(testDocs).map((file) => {
        return file.sourceFile;
    });

    createTestModuleFiles(generatedTestModuleSourceFiles);

    const generatedSourceFileNames = generatedTestModuleSourceFiles.map((sourceFile) => {
        return sourceFile.fileName;
    });

    let generatedDocs = getGeneratedDocs(generatedSourceFileNames, generatedTestModuleSourceFiles);

    docs.forEach((componentDoc) => {
        generatedDocs.forEach((moduleDocs) => {
            if (moduleDocs.includeTestForComponent === componentDoc.componentRefName) {
                componentDoc.generatedModuleDetails = {
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

    docs = getAllAddedComponentsThatHasTest(docs);

    const fileWriter = new BundleTemplateWriter(docs, options.urlPrefix);

    try {
        fileWriter.createBundleFile();
    } catch (error) {
        console.error('Failed to generate resources: ', error);
        return;
    }

    console.info('Generated resources successfully.');
}

function getProjectSourceDocumentation(sourceFiles: string[], rootDir: string) {
    const program = ts.createProgram([...sourceFiles], { target: ts.ScriptTarget.ES5, module: ts.ModuleKind.CommonJS });
    const sourceParser = new SourceParser({ rootDir, files: sourceFiles }, program);

    return sourceParser.getProjectSourceDocumentation();
}

function getProjectTestDocumentation(sourceFiles, classesWithDocs: SourceDocs[], otherClasses: SourceDocs[]) {
    const program = ts.createProgram([...sourceFiles], { target: ts.ScriptTarget.ES5, module: ts.ModuleKind.CommonJS });
    const testSourceParser = new TestSourceParser({ files: sourceFiles }, program);

    return testSourceParser.getProjectTestDocumentation(classesWithDocs, otherClasses);
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

function createTestModuleFiles(files: ts.SourceFile[]) {
    const testModuleTemplateWriter = new TestModuleTemplateWriter();
    testModuleTemplateWriter.createTestModuleFiles(files);
}

function getAllAddedComponentsThatHasTest(docs: SourceDocs[]) {
    return docs.filter((docs) => {
        if(docs.componentDocName && docs.groupDocName && (docs.examples && docs.examples.length === 0)) {
            console.info(`Could not find any test with /** @uijarexample */ comment for "${docs.componentRefName}".\nAdd a test and make sure it has a comment as following /** @uijarexample */ to make it visible in UI-jar.`);
            return false;
        }

        return true;
    });
}