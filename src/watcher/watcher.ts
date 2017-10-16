import * as fs from 'fs';
import * as path from 'path';
import { GenerateOptionArgs, generateRequiredFiles } from '../init/init';

export class FileWatcher {
    constructor(private config: GenerateOptionArgs) {}

    start() {
        console.log('Watching for file changes.');
        
        let debounceTime = 500;
        let watchTimer = null;
        let watcher = fs.watch(path.resolve(this.config.directory), { encoding: 'utf8', recursive: true, persistent: true });

        watcher.addListener('change', (eventName: string, fileName: string) => {
            clearTimeout(watchTimer);
            
            watchTimer = setTimeout(() => {
                if(this.shouldBeExcluded(fileName)) {
                    return;
                }
                
                if(this.shouldBeIncluded(fileName)) {
                    this.rebuildAll();
                }
            }, debounceTime);
        });
    }

    private shouldBeExcluded(fileName): boolean {
        if(this.config.excludeFiles === undefined || this.config.excludeFiles === null) {
            return false;
        }

        let result = this.config.excludeFiles.find((excludeItem) => {
            return new RegExp(excludeItem).test(fileName);
        });

        return result ? true : false;
    }

    private shouldBeIncluded(fileName: string): boolean {
        if(this.config.testFiles === undefined || this.config.testFiles === null) {
            return false;
        }

        let result = this.config.testFiles.find((testItem) => {
            return new RegExp(testItem).test(fileName);
        });

        return result ? true : false;
    }

    private rebuildAll() {
        console.log('File change detected.');
        generateRequiredFiles(this.config);
    }
}