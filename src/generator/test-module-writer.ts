import * as fs from 'fs';
import * as ts from 'typescript';
import * as path from 'path';

export class TestModuleTemplateWriter {
    static outputFilename: string = '__ui-jar-temp-module';
    static outputDirectoryPath: string = path.resolve(__dirname, '../../../temp'); // dist/src/app...

    createTestModuleFiles(sourceFiles: ts.SourceFile[]) {
        const encoding = 'UTF-8';

        this.createOutputPathIfNotAlreadyExist(TestModuleTemplateWriter.outputDirectoryPath);

        sourceFiles.forEach((sourceFile, index) => {
            let javascriptOutput = ts.transpileModule(sourceFile.getFullText(), {
                compilerOptions: {
                    module: ts.ModuleKind.CommonJS,
                    target: ts.ScriptTarget.ES5,
                    removeComments: true
                }
            });

            const outputFilePath = path.resolve(TestModuleTemplateWriter.outputDirectoryPath, sourceFile.fileName.replace(/\.ts$/, '.js'));

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
}