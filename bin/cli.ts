#!/usr/bin/env node
import { GenerateOptionArgs, generateRequiredFiles } from '../src/init/init';
import { FileWatcher } from '../src/watcher/watcher';

interface CliArgs {
    directory?: string;
    includes?: RegExp[];
    excludes?: RegExp[];
    testFiles?: RegExp[];
    urlPrefix?: string;
}

process.title = 'UI jar';
const cliArgs = parseCliArguments(process.argv);

runCliArguments(cliArgs);

function runCliArguments(cliArgs: CliArgs) {
    if(!cliArgs.directory) {
        throw new Error('"directory"-parameter is missing');
    }

    if(!cliArgs.includes) {
        throw new Error('"includes"-parameter is missing');
    }

    if(!cliArgs.testFiles) {
        throw new Error('"testFiles"-parameter is missing');
    }

    const generateOptionArgs: GenerateOptionArgs = {
        directory: cliArgs.directory[0],
        includeFiles: cliArgs.includes,
        excludeFiles: cliArgs.excludes,
        testFiles: cliArgs.testFiles,
        urlPrefix: cliArgs.urlPrefix ? cliArgs.urlPrefix[0] : ''
    }

    generateRequiredFiles(generateOptionArgs);

    if(cliArgs['-watch']) {
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

        if(!formattedArgs[argName]) {
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

function startFileWatcher(options: GenerateOptionArgs) {   
    let fileWatcher = new FileWatcher(options);
    fileWatcher.start();
}