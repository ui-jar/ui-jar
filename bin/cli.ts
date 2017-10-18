#!/usr/bin/env node
import { GenerateOptionArgs, generateRequiredFiles } from '../src/init/init';
import { FileWatcher, FileWatcherEvent, FileWatcherOptions } from '../src/watcher/watcher';
import { FileSearch } from '../src/generator/file-search';
import * as ts from 'typescript';

interface CliArgs {
    directory?: string;
    includes?: RegExp[];
    excludes?: RegExp[];
    urlPrefix?: string;
}

process.title = 'UI jar';
const cliArgs = parseCliArguments(process.argv);

runCliArguments(cliArgs);

function runCliArguments(cliArgs: CliArgs) {
    if (!cliArgs.directory) {
        console.error('Missing required "directory"-parameter, "directory" should be a path to your app root directory e.g. "directory=./src/app".');
        process.exit(1);
    }

    if (!cliArgs.includes) {
        console.error('Missing required "includes"-parameter, "includes" should be a comma separated list of type RegExp e.g. "includes=foo\\.ts$,bar\\.ts$".');
        process.exit(1);
    }

    const generateOptionArgs: GenerateOptionArgs = {
        directory: cliArgs.directory[0],
        includeFiles: cliArgs.includes,
        excludeFiles: cliArgs.excludes,
        urlPrefix: cliArgs.urlPrefix ? cliArgs.urlPrefix[0] : ''
    }

    generateRequiredFiles(generateOptionArgs);

    if (cliArgs['-watch']) {
        startFileWatcher(generateOptionArgs);
    }
}

function parseCliArguments(args: string[]): CliArgs {
    args = pluckAdditionalCliArguments(args);

    let formattedArgs: CliArgs = {};

    args.forEach((argument) => {
        const splitArgument = argument.split('=');
        const argName = splitArgument[0];
        const argParams = splitArgument.length > 1 ? splitArgument[1].split(',') : [];

        if (!formattedArgs[argName]) {
            formattedArgs[argName] = argParams;
        } else {
            formattedArgs[argName] = formattedArgs[argName].concat(argParams);
        }
    });

    return formattedArgs;
}

function pluckAdditionalCliArguments(args: string[]) {
    return args.slice(2);
}

function startFileWatcher(generateOptionArgs: GenerateOptionArgs) {
    const fileSearch = new FileSearch(generateOptionArgs.includeFiles, generateOptionArgs.excludeFiles);
    const testFiles = fileSearch.getTestFiles(generateOptionArgs.directory,
        { target: ts.ScriptTarget.ES5, module: ts.ModuleKind.CommonJS });

    const fileWatcherOptions: FileWatcherOptions = {
        directory: generateOptionArgs.directory,
        files: testFiles
    };

    const fileWatcher = new FileWatcher(fileWatcherOptions);
    fileWatcher.start();
    fileWatcher.addListener(FileWatcherEvent.REBUILD, () => {
        generateRequiredFiles(generateOptionArgs);
    });
}