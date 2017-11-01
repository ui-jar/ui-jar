
export interface CliArgs {
    directory?: string;
    includes?: RegExp[];
    excludes?: RegExp[];
    urlPrefix?: string;
    watch?: boolean;
}

export enum CliCommandOptions {
    DIRECTORY = '--directory',
    INCLUDES = '--includes',
    EXCLUDES = '--excludes',
    URL_PREFIX = '--url-prefix',
    WATCH = '--watch'
}

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
                case CliCommandOptions.INCLUDES:
                case CliCommandOptions.URL_PREFIX:
                    currentArgument = toCamelCase(value.replace('--', ''));
                break;
                case CliCommandOptions.WATCH:
                    currentArgument = toCamelCase(value.replace('--', ''));
                    addArgumentParameter(currentArgument, true);
                break;
                default:
                throw new Error(`The specified argument ${value} is invalid.`)
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

    return formattedArgs;
}

function pluckAdditionalCliArguments(args: string[]) {
    return args.slice(2);
}