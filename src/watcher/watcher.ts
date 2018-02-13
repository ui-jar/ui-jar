import * as fs from 'fs';
import * as path from 'path';
import * as EventEmitter from 'events';

export interface FileWatcherOptions {
    directory: string;
    files: string[];
}

export const FileWatcherEvent = {
    REBUILD: 'REBUILD'
};

export class FileWatcher {
    private watchEvent: EventEmitter = new EventEmitter();

    constructor(private config: FileWatcherOptions) { }

    start() {
        console.info('Watching for file changes.');

        let debounceTime = 500;
        let watchTimer = null;
        let watcher = fs.watch(path.resolve(this.config.directory), { encoding: 'utf8', recursive: true, persistent: true });

        watcher.addListener('change', (eventName: string, fileName: string) => {
            if(!this.shouldBeIncluded(fileName)) {
                return;
            }

            clearTimeout(watchTimer);
            watchTimer = setTimeout(() => this.eventHandler(fileName), debounceTime);
        });
    }

    addListener(eventType: string, callback: (fileName: string) => void) {
        if (eventType) {
            this.watchEvent.addListener(eventType, callback);
        }
    }

    private shouldBeIncluded(fileName: string): boolean {
        const result = this.config.files.find((testFile) => {
            return testFile.endsWith(fileName);
        });

        return result !== undefined;
    }

    private eventHandler(fileName: string): void {
        console.info('File change detected. Starting incremental build...');
        this.watchEvent.emit(FileWatcherEvent.REBUILD, fileName);
        console.info('Watching for file changes.');
    }
}