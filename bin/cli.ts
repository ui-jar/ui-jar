#!/usr/bin/env node
import { generateRequiredFiles, generateSingleFile } from '../src/init/init';
import { FileWatcher, FileWatcherEvent, FileWatcherOptions } from '../src/watcher/watcher';
import { FileSearch } from '../src/generator/file-search';
import * as ts from 'typescript';
import { parseCliArguments, CliArgs } from '../src/cli/cli-utils';

process.title = 'UI-jar';

try {
    const cliArgs = parseCliArguments(process.argv);
    runCliArguments(cliArgs);
} catch (error) {
    console.error(error.message);
    process.exit();
}

function runCliArguments(cliArgs: CliArgs) {
    if (!cliArgs.directory) {
        throw new Error('Missing required --directory argument, --directory should be a path to your app root directory e.g. "--directory ./src/app".');
    }

    if (!cliArgs.includes) {
        throw new Error('Missing required --includes argument, --includes should be a space separated list of type RegExp e.g. "--includes foo\\.ts$ bar\\.ts$".');
    }

    generateRequiredFiles(cliArgs);

    if (cliArgs.watch) {
        startFileWatcher(cliArgs);
    }
}

function startFileWatcher(cliArgs: CliArgs) {
    const fileSearch = new FileSearch(cliArgs.includes, cliArgs.excludes);
    const allFilesInDirectory = fileSearch.getFiles(cliArgs.directory);
    const program: ts.Program = ts.createProgram([...allFilesInDirectory],
        { target: ts.ScriptTarget.ES5, module: ts.ModuleKind.CommonJS });
    const testFiles = fileSearch.getTestFiles(allFilesInDirectory, program);

    const fileWatcherOptions: FileWatcherOptions = {
        directory: cliArgs.directory,
        files: testFiles
    };

    const fileWatcher = new FileWatcher(fileWatcherOptions);
    fileWatcher.start();
    fileWatcher.addListener(FileWatcherEvent.REBUILD, (fileName: string) => {
        generateSingleFile({
            directory: cliArgs.directory,
            includes: cliArgs.includes,
            excludes: cliArgs.excludes
        }, fileName);
    });
}