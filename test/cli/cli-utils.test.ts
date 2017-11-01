import * as assert from 'assert';
import { parseCliArguments } from '../../src/cli/cli-utils';

describe('CLI', () => {

    describe('parseCliArguments', () => {
        it('should parse all input arguments', () => {
            const cliArgs = ['path/to/node', 'path/to/cli.js',
                '--directory', './src/app',
                '--includes', 'foo\\.ts$', 'bar\\.ts$',
                '--excludes', '\\.exclude\\.ts',
                '--url-prefix', 'ui-jar.html',
                '--watch'];

            let parsedArgs = parseCliArguments(cliArgs);

            assert.deepEqual(parsedArgs, {
                directory: './src/app',
                includes: ['foo\\.ts$', 'bar\\.ts$'],
                excludes: ['\\.exclude\\.ts'],
                urlPrefix: 'ui-jar.html',
                watch: true
            }, 'Should match object.');
        });

        it('should parse all input arguments and set defaults', () => {
            const cliArgs = ['path/to/node', 'path/to/cli.js',
                '--directory', './src/app',
                '--includes', '\\.ts$'];

            let parsedArgs = parseCliArguments(cliArgs);

            assert.deepEqual(parsedArgs, {
                directory: './src/app',
                includes: ['\\.ts$'],
                urlPrefix: '',
                watch: false
            }, 'Should match object and set defaults.');
        });

        it('should throw exception when invalid argument name is specified', () => {
            const cliArgs = ['path/to/node', 'path/to/cli.js',
                '--not-available-argument', 'not-valid',
                '--includes', '\\.ts$'];

            assert.throws(() => {
                parseCliArguments(cliArgs);
            }, 'Should throw exception when argument name is invalid.');
        });
    });

});
