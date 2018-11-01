import * as path from 'path';
import * as fs from 'fs';

export interface CliArgs {
    directory?: string;
    includes?: RegExp[];
    excludes?: RegExp[];
    config?: string[];
    urlPrefix?: string;
    watch?: boolean;
}

const CliCommandOptions = {
    CONFIG: '--config',
    DIRECTORY: '--directory',
    EXCLUDES: '--excludes',
    INCLUDES: '--includes',
    URL_PREFIX: '--url-prefix',
    WATCH: '--watch'
};

export function parseCliArguments(args: string[]): CliArgs {
    args = pluckAdditionalCliArguments(args);

    let formattedArgs: CliArgs = {};

    const isArgumentName = (value) => {
        return value.substr(0, 2) === '--';
    };

    const addArgumentParameter = (argumentName, value) => {
        if(argumentName) {
            if (!formattedArgs[argumentName]) {
                formattedArgs[argumentName] = [value];
            } else {
                formattedArgs[argumentName] = formattedArgs[argumentName].concat(value);
            }
        }
    };

    const toCamelCase = (str) => {
        return str.replace(/\-\w/gi, (match) => match[1].toUpperCase());
    };
    
    args.reduce((currentArgument, value) => {
        if(isArgumentName(value)) {
            switch(value) {
                case CliCommandOptions.DIRECTORY:
                case CliCommandOptions.EXCLUDES:
                case CliCommandOptions.CONFIG:
                case CliCommandOptions.INCLUDES:
                case CliCommandOptions.URL_PREFIX:
                    currentArgument = toCamelCase(value.replace('--', ''));
                break;
                case CliCommandOptions.WATCH:
                    currentArgument = toCamelCase(value.replace('--', ''));
                    addArgumentParameter(currentArgument, true);
                break;
                default:
                throw new Error(`The specified argument ${value} is invalid.`);
            }
        } else {
            addArgumentParameter(currentArgument, value);
        }

        return currentArgument;
    }, '');

    if(formattedArgs.directory) {
        formattedArgs.directory = formattedArgs.directory[0];
    }

    if(formattedArgs.urlPrefix) {
        formattedArgs.urlPrefix = formattedArgs.urlPrefix[0];
    } else {
        formattedArgs.urlPrefix = '';
    }

    if(formattedArgs.watch) {
        formattedArgs.watch = formattedArgs.watch[0];
    } else {
        formattedArgs.watch = false;
    }

    if(formattedArgs.config) {
        if(formattedArgs.config.length !== 1) {
            throw new Error(`Expected to receive the configuration path whem using --config.`);
        }

        const configPath = path.resolve(formattedArgs.config[0]);

        if (!fs.existsSync(configPath)) {
            throw new Error(`Invalid configuration path (${configPath}).`);
        }

        formattedArgs = { ...formattedArgs, ...require(configPath) };
    }

    return formattedArgs;
}

function pluckAdditionalCliArguments(args: string[]) {
    return args.slice(2);
}